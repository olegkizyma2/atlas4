/**
 * @fileoverview Mode Selection Processor (Stage 0-MCP)
 * Determines if user request is chat or task mode
 * 
 * @version 5.0.0
 * @date 2025-10-16
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';
import axios from 'axios';
import GlobalConfig from '../../../config/global-config.js';

/**
 * Mode Selection Processor
 * 
 * Analyzes user requests and determines:
 * - chat: Simple conversation, Atlas can respond directly
 * - task: Requires MCP tools and multi-agent workflow
 */
export class ModeSelectionProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.llmClient - LLM client for reasoning
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ llmClient, logger: loggerInstance }) {
        this.llmClient = llmClient;
        this.logger = loggerInstance || logger;

        // Get API endpoint and model from GlobalConfig (lazy evaluation)
        this.apiEndpoint = null;
        this.apiTimeout = 60000;
        this.modelConfig = null;
    }

    _ensureConfig() {
        if (!this.modelConfig) {
            const apiConfig = GlobalConfig.MCP_MODEL_CONFIG.apiEndpoint;
            this.apiEndpoint = apiConfig.useFallback && apiConfig.fallback
                ? apiConfig.fallback
                : apiConfig.primary;
            this.apiTimeout = apiConfig.timeout || 60000;
            this.modelConfig = GlobalConfig.MCP_MODEL_CONFIG.stages.mode_selection;
            
            this.logger.system('mode-selection', `[STAGE-0-MCP] 🔧 Using API: ${this.apiEndpoint}, Model: ${this.modelConfig.model}`);
        }
    }

    /**
     * Execute mode selection
     * 
     * @param {Object} context - Stage context
     * @param {string} context.userMessage - User request
     * @param {Object} [context.session] - Session context
     * @returns {Promise<Object>} Selection result with mode
     */
    async execute(context) {
        this._ensureConfig();
        this.logger.system('mode-selection', '[STAGE-0-MCP] 🔍 Starting mode selection...');

        const { userMessage, session } = context;

        try {
            const prompt = MCP_PROMPTS.MODE_SELECTION;

            this.logger.system('mode-selection', `[STAGE-0-MCP] Analyzing: "${userMessage}"`);

            // Build messages for LLM
            const messages = [
                { role: 'system', content: prompt.SYSTEM_PROMPT },
                { role: 'user', content: prompt.buildUserPrompt(userMessage) }
            ];

            // Call LLM API
            this.logger.system('mode-selection', `[STAGE-0-MCP] Calling API: ${this.apiEndpoint}`);
            this.logger.system('mode-selection', `[STAGE-0-MCP] Messages: ${JSON.stringify(messages.map(m => ({ role: m.role, content: m.content.substring(0, 80) })))}`);

            const response = await axios.post(this.apiEndpoint, {
                model: this.modelConfig.model,
                messages,
                temperature: this.modelConfig.temperature,
                max_tokens: this.modelConfig.max_tokens
            }, {
                timeout: this.apiTimeout  // Use configured timeout with fallback support
            });

            this.logger.system('mode-selection', `[STAGE-0-MCP] Response received: status=${response.status}, has_data=${!!response.data}, has_choices=${!!response.data.choices}`);

            if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error('Invalid API response structure');
            }

            const rawResponse = response.data.choices[0].message.content;

            this.logger.system('mode-selection', `[STAGE-0-MCP] Raw response: ${rawResponse}`);

            // Parse JSON response
            const result = this._parseResponse(rawResponse);

            this.logger.system('mode-selection', `[STAGE-0-MCP] ✅ Mode: ${result.mode} (confidence: ${result.confidence})`);
            this.logger.system('mode-selection', `[STAGE-0-MCP]    Reasoning: ${result.reasoning}`);

            return {
                success: true,
                mode: result.mode,
                confidence: result.confidence,
                reasoning: result.reasoning,
                metadata: {
                    userMessage,
                    timestamp: new Date().toISOString(),
                    prompt: 'MODE_SELECTION'
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-0-MCP] Mode selection failed: ${error.message}`);
            this.logger.error(`[STAGE-0-MCP] Error stack: ${error.stack}`);
            this.logger.error(`[STAGE-0-MCP] Error name: ${error.name}`);

            // Log axios-specific details
            if (error.response) {
                this.logger.error(`[STAGE-0-MCP] API Response Error: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                this.logger.error(`[STAGE-0-MCP] No response received from API`);
            }

            // FIXED 16.10.2025: Default to chat mode on error (intelligent fallback)
            // Причина: Chat безпечніше за Task при помилці класифікації
            // - Chat: розмова (користувач просто говорить)
            // - Task: виконання дій (ризик випадкового запуску команд)
            this.logger.warn(`[STAGE-0-MCP] ⚠️ Intelligent fallback: використовую CHAT mode замість task`);
            return {
                success: true,
                mode: 'chat',
                confidence: 0.5,
                reasoning: 'Помилка класифікації, використовую chat mode (інтелектуальний fallback)'
            };
        }
    }

    /**
     * Parse LLM response to extract mode selection
     * @private
     */
    _parseResponse(rawResponse) {
        try {
            // Clean markdown wrappers if present
            let cleanResponse = rawResponse.trim();
            cleanResponse = cleanResponse
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            // Parse JSON
            const parsed = JSON.parse(cleanResponse);

            // Validate structure
            if (!parsed.mode || !['chat', 'task'].includes(parsed.mode)) {
                throw new Error(`Invalid mode: ${parsed.mode}`);
            }

            if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
                throw new Error(`Invalid confidence: ${parsed.confidence}`);
            }

            return {
                mode: parsed.mode,
                confidence: parsed.confidence,
                reasoning: parsed.reasoning || 'No reasoning provided'
            };

        } catch (error) {
            this.logger.warn('mode-selection', `Failed to parse response: ${error.message}`);
            this.logger.warn('mode-selection', `Raw response: ${rawResponse}`);

            // Simple fallback parsing
            if (rawResponse.toLowerCase().includes('"mode":"chat"') ||
                rawResponse.toLowerCase().includes("'mode':'chat'")) {
                return { mode: 'chat', confidence: 0.7, reasoning: 'Fallback parsing' };
            }

            return { mode: 'task', confidence: 0.7, reasoning: 'Fallback parsing (default)' };
        }
    }
}

export default ModeSelectionProcessor;
