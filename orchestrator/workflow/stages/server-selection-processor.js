/**
 * @fileoverview MCP Server Selection Processor (Stage 2.0-MCP)
 * Аналізує TODO item і визначає 1-2 найрелевантніших MCP серверів
 * Оптимізує кількість tools для Тетяни з 92+ до 30-50
 * 
 * @version 4.2.0
 * @date 2025-10-15
 */

import logger from '../../utils/logger.js';
import axios from 'axios';
import GlobalConfig from '../../../config/global-config.js';

export class ServerSelectionProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpManager - MCPManager instance
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpManager, logger: loggerInstance }) {
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Виконати підбір MCP серверів для TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item
     * @param {Object} context.todo - Full TODO list
     * @returns {Promise<Object>} Selected servers result
     */
    async execute(context) {
        this.logger.system('server-selection', '[STAGE-2.0-MCP] 🔍 Selecting MCP servers...');

        const { currentItem, todo } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for server selection');
        }

        try {
            this.logger.system('server-selection', `[STAGE-2.0-MCP] Item ${currentItem.id}: ${currentItem.action}`);

            // Отримати список доступних MCP серверів
            const availableServers = this._getAvailableServers();
            const serversDescription = this._buildServersDescription(availableServers);

            this.logger.system('server-selection', `[STAGE-2.0-MCP] Available servers: ${availableServers.map(s => s.name).join(', ')}`);

            // Викликати LLM для аналізу
            const result = await this._analyzeAndSelectServers(currentItem, serversDescription);

            this.logger.system('server-selection', `[STAGE-2.0-MCP] ✅ Selected: ${result.selected_servers.join(', ')} (confidence: ${result.confidence})`);

            // Валідація вибраних серверів
            const validation = this._validateSelectedServers(result.selected_servers, availableServers);

            if (!validation.valid) {
                this.logger.warn(`[STAGE-2.0-MCP] ⚠️ Server validation FAILED: ${validation.errors.join(', ')}`, {
                    category: 'server-selection',
                    component: 'server-selection'
                });

                return {
                    success: false,
                    error: 'Invalid servers selected',
                    validationErrors: validation.errors,
                    summary: '⚠️ LLM обрав невалідні сервери',
                    metadata: {
                        itemId: currentItem.id,
                        stage: 'server-selection',
                        needsRetry: true
                    }
                };
            }

            // Успішний результат
            return {
                success: true,
                selected_servers: result.selected_servers,
                reasoning: result.reasoning,
                confidence: result.confidence,
                summary: `✅ Обрано сервери: ${result.selected_servers.join(', ')}`,
                metadata: {
                    itemId: currentItem.id,
                    stage: 'server-selection',
                    serversCount: result.selected_servers.length,
                    toolsCount: this._countToolsForServers(result.selected_servers)
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-2.0-MCP] ❌ Server selection failed: ${error.message}`, {
                category: 'server-selection',
                component: 'server-selection',
                errorName: error.name,
                stack: error.stack
            });

            throw error;
        }
    }

    /**
     * Отримати список доступних MCP серверів
     * @private
     * @returns {Array<Object>} Список серверів з metadata
     */
    _getAvailableServers() {
        const servers = [];

        for (const [name, server] of this.mcpManager.servers.entries()) {
            if (!Array.isArray(server.tools)) continue;

            servers.push({
                name: name,
                toolsCount: server.tools.length,
                tools: server.tools.map(t => t.name)
            });
        }

        return servers;
    }

    /**
     * Створити текстовий опис серверів для LLM
     * @private
     * @param {Array<Object>} servers - Список серверів
     * @returns {string} Текстовий опис
     */
    _buildServersDescription(servers) {
        const lines = servers.map(s => {
            const toolSample = s.tools.slice(0, 5).join(', ');
            const moreCount = s.toolsCount > 5 ? ` (+${s.toolsCount - 5} more)` : '';
            return `- **${s.name}** (${s.toolsCount} tools): ${toolSample}${moreCount}`;
        });

        return lines.join('\n');
    }

    /**
     * Викликати LLM для аналізу та підбору серверів
     * @private
     * @param {Object} item - TODO item
     * @param {string} serversDescription - Опис доступних серверів
     * @returns {Promise<Object>} {selected_servers, reasoning, confidence}
     */
    async _analyzeAndSelectServers(item, serversDescription) {
        // Завантажити промпт
        const { default: prompt } = await import('../../../prompts/mcp/stage2_0_server_selection.js');

        // Побудувати user message
        const userMessage = prompt.USER_PROMPT
            .replace('{{ITEM_ID}}', item.id)
            .replace('{{ITEM_ACTION}}', item.action)
            .replace('{{SUCCESS_CRITERIA}}', item.success_criteria || 'Виконати завдання успішно')
            .replace('{{MCP_SERVERS_LIST}}', serversDescription);

        // Викликати LLM API (швидкий endpoint для classification)
        const modelConfig = GlobalConfig.AI_MODEL_CONFIG.getModelByType('classification');

        this.logger.debug('server-selection', `[STAGE-2.0-MCP] Calling LLM API: ${modelConfig.model}`);

        const apiResponse = await axios.post(modelConfig.endpoint, {
            model: modelConfig.model,
            messages: [
                { role: 'system', content: prompt.SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
            ],
            temperature: modelConfig.temperature,
            max_tokens: modelConfig.max_tokens
        }, {
            timeout: 30000 // 30s timeout
        });

        const rawResponse = apiResponse.data.choices[0].message.content;

        this.logger.debug('server-selection', `[STAGE-2.0-MCP] Raw LLM response: ${rawResponse.substring(0, 200)}`);

        // Парсинг JSON (з очищенням markdown)
        const parsed = this._parseServerSelectionResponse(rawResponse);

        return parsed;
    }

    /**
     * Парсити відповідь LLM (з очищенням markdown)
     * @private
     * @param {string} response - Raw LLM response
     * @returns {Object} Parsed result
     */
    _parseServerSelectionResponse(response) {
        let cleanResponse = response;

        if (typeof response === 'string') {
            // Видалити markdown wrappers
            cleanResponse = response
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
        }

        try {
            const parsed = JSON.parse(cleanResponse);

            // Валідація структури
            if (!parsed.selected_servers || !Array.isArray(parsed.selected_servers)) {
                throw new Error('Invalid response: selected_servers must be an array');
            }

            if (parsed.selected_servers.length === 0) {
                throw new Error('Invalid response: selected_servers cannot be empty');
            }

            if (parsed.selected_servers.length > 2) {
                this.logger.warn('[STAGE-2.0-MCP] ⚠️ LLM selected >2 servers, trimming to 2', {
                    category: 'server-selection',
                    component: 'server-selection'
                });
                parsed.selected_servers = parsed.selected_servers.slice(0, 2);
            }

            return {
                selected_servers: parsed.selected_servers,
                reasoning: parsed.reasoning || 'No reasoning provided',
                confidence: parsed.confidence || 0.5
            };

        } catch (error) {
            this.logger.error(`[STAGE-2.0-MCP] ❌ JSON parse failed: ${error.message}`, {
                category: 'server-selection',
                component: 'server-selection',
                rawResponse: cleanResponse.substring(0, 500)
            });

            throw new Error(`Failed to parse server selection response: ${error.message}`);
        }
    }

    /**
     * Валідувати вибрані сервери
     * @private
     * @param {Array<string>} selectedServers - Обрані сервери
     * @param {Array<Object>} availableServers - Доступні сервери
     * @returns {Object} {valid, errors}
     */
    _validateSelectedServers(selectedServers, availableServers) {
        const errors = [];
        const availableNames = availableServers.map(s => s.name);

        for (const serverName of selectedServers) {
            if (!availableNames.includes(serverName)) {
                errors.push(`Server '${serverName}' not available. Available: ${availableNames.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Підрахувати кількість tools для вибраних серверів
     * @private
     * @param {Array<string>} selectedServers - Обрані сервери
     * @returns {number} Total tools count
     */
    _countToolsForServers(selectedServers) {
        let count = 0;

        for (const serverName of selectedServers) {
            const server = this.mcpManager.servers.get(serverName);
            if (server && Array.isArray(server.tools)) {
                count += server.tools.length;
            }
        }

        return count;
    }
}

export default ServerSelectionProcessor;
