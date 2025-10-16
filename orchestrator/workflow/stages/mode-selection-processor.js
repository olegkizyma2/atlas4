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
        this.apiEndpoint = 'http://localhost:4000/v1/chat/completions';
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
            const response = await axios.post(this.apiEndpoint, {
                model: 'openai/gpt-4o-mini',  // Fast model for classification
                messages,
                temperature: 0.1,  // Low temp for deterministic classification
                max_tokens: 150
            }, {
                timeout: 10000  // 10s timeout for quick response
            });

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
            this.logger.error('mode-selection', `[STAGE-0-MCP] ❌ Selection failed: ${error.message}`);
            this.logger.error('mode-selection', error.stack);

            // Default to task mode on error (safer)
            return {
                success: true,  // Don't fail the workflow
                mode: 'task',
                confidence: 0.5,
                reasoning: 'Помилка класифікації, використовую task mode',
                error: error.message,
                metadata: {
                    userMessage,
                    timestamp: new Date().toISOString(),
                    fallback: true
                }
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
