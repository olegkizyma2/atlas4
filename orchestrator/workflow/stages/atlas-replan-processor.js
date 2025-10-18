/**
 * @fileoverview Atlas Replan Processor (Stage 3.5-MCP)
 * Deep failure analysis and dynamic TODO replanning
 * Triggered when invalid tools are detected or verification fails critically
 * 
 * @version 1.0.0
 * @date 2025-10-18
 */

import logger from '../../utils/logger.js';

/**
 * Atlas Replan Processor
 * 
 * Analyzes failures deeply using Tetyana + Grisha data and rebuilds TODO plan
 */
export class AtlasReplanProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpTodoManager - MCPTodoManager instance
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpTodoManager, logger: loggerInstance }) {
        this.mcpTodoManager = mcpTodoManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute replan analysis for failed TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Failed TODO item
     * @param {Object} context.todo - Full TODO list
     * @param {Object} context.tetyanaData - Tetyana's execution data (plan + results)
     * @param {Object} context.grishaData - Grisha's verification data
     * @returns {Promise<Object>} Replan result with new items or strategy
     */
    async execute(context) {
        this.logger.system('atlas-replan', '[STAGE-3.5-MCP] 🔍 Atlas analyzing failure and replanning...');

        const { currentItem, todo, tetyanaData, grishaData } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for replan');
        }

        if (!todo) {
            throw new Error('todo is required for replan');
        }

        try {
            this.logger.system('atlas-replan', `[STAGE-3.5-MCP] Failed Item: ${currentItem.id}. ${currentItem.action}`);
            this.logger.system('atlas-replan', `[STAGE-3.5-MCP] Failure reason: ${grishaData?.reason || 'Unknown'}`);

            // Call Atlas replan through mcpTodoManager
            const replanResult = await this.mcpTodoManager._analyzeAndReplanTodo(
                currentItem,
                todo,
                tetyanaData,
                grishaData
            );

            // Log replan decision
            this.logger.system('atlas-replan', `[STAGE-3.5-MCP] Atlas decision: ${replanResult.strategy}`);
            this.logger.system('atlas-replan', `[STAGE-3.5-MCP] Replanned: ${replanResult.replanned}`);

            if (replanResult.replanned && replanResult.new_items) {
                this.logger.system('atlas-replan', `[STAGE-3.5-MCP] ✅ ${replanResult.new_items.length} new items created`);
                
                for (const newItem of replanResult.new_items) {
                    this.logger.system('atlas-replan', `[STAGE-3.5-MCP]   - ${newItem.action}`);
                }
            }

            // Generate summary
            const summary = this._generateReplanSummary(currentItem, replanResult);

            return {
                success: true,
                replanResult,
                summary,
                metadata: {
                    itemId: currentItem.id,
                    strategy: replanResult.strategy,
                    replanned: replanResult.replanned,
                    newItemsCount: replanResult.new_items?.length || 0,
                    modifiedItemsCount: replanResult.modified_items?.length || 0,
                    continueFromItemId: replanResult.continue_from_item_id
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-3.5-MCP] Replan failed: ${error.message}`, {
                category: 'atlas-replan',
                component: 'atlas-replan',
                stack: error.stack
            });

            // Return fallback strategy
            return {
                success: false,
                error: error.message,
                replanResult: {
                    replanned: false,
                    reasoning: `Replan error: ${error.message}`,
                    strategy: 'skip_and_continue',
                    new_items: [],
                    continue_from_item_id: currentItem.id + 1
                },
                summary: `⚠️ Atlas replan failed: ${error.message}. Continuing with next item.`,
                metadata: {
                    itemId: currentItem.id,
                    error: error.message
                }
            };
        }
    }

    /**
     * Generate summary of replan decision
     * 
     * @param {Object} item - Failed item
     * @param {Object} replanResult - Replan result from Atlas
     * @returns {string} Human-readable summary
     * @private
     */
    _generateReplanSummary(item, replanResult) {
        const { strategy, replanned, new_items, reasoning } = replanResult;

        let summary = `🔄 Atlas: ${reasoning}`;

        if (replanned && new_items && new_items.length > 0) {
            summary += `\n📋 Додано ${new_items.length} нових пунктів:`;
            for (let i = 0; i < Math.min(new_items.length, 3); i++) {
                summary += `\n  ${i + 1}. ${new_items[i].action}`;
            }
            if (new_items.length > 3) {
                summary += `\n  ... та ще ${new_items.length - 3}`;
            }
        } else if (strategy === 'skip_and_continue') {
            summary += '\n⏭️ Пропускаю і продовжую з наступного пункту';
        } else if (strategy === 'abort') {
            summary += '\n⛔ Зупиняю виконання - проблема критична';
        }

        return summary;
    }

    /**
     * Get available tools for context
     * 
     * @returns {Promise<Array>} Available tools
     * @private
     */
    async _getAvailableTools() {
        // This would be implemented to get tools from mcpManager
        // For now, return empty array as fallback
        return [];
    }
}

export default AtlasReplanProcessor;
