/**
 * @fileoverview Atlas Adjust TODO Processor (Stage 3-MCP)
 * Adaptive TODO item adjustment on verification failure
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';

/**
 * Atlas Adjust TODO Processor
 * 
 * Analyzes verification failures and adjusts TODO items using 4 strategies:
 * - retry: Temporary errors (network, timing)
 * - modify: Wrong parameters (path, URL, selector)
 * - split: Too complex (multiple actions in one item)
 * - skip: Impossible to execute (only on attempt >= 3)
 */
export class AtlasAdjustTodoProcessor {
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
     * Execute TODO adjustment
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item (failed)
     * @param {Object} context.verification - Verification result
     * @param {Object} context.todo - Full TODO list
     * @param {number} context.attemptNumber - Current attempt number
     * @returns {Promise<Object>} Adjustment result
     */
    async execute(context) {
        this.logger.system('atlas-adjust-todo', '[STAGE-3-MCP] 🔧 Adjusting TODO item...');

        const { currentItem, verification, todo, attemptNumber } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for adjustment');
        }

        if (!verification) {
            throw new Error('verification results are required for adjustment');
        }

        try {
            const attempt = attemptNumber || currentItem.attempt || 1;

            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] Item: ${currentItem.id}. ${currentItem.action}`);
            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] Attempt: ${attempt}/${currentItem.max_attempts || 3}`);
            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] Verification reason: ${verification.reason}`);

            // Adjust using MCPTodoManager
            const adjustment = await this.mcpTodoManager.adjustTodoItem(
                currentItem,
                verification,
                attempt
            );

            if (!adjustment) {
                throw new Error('MCPTodoManager.adjustTodoItem() returned null/undefined');
            }

            // Log adjustment strategy
            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] ✅ Strategy: ${adjustment.strategy}`);
            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP]    Reasoning: ${adjustment.reasoning}`);

            // Log changes based on strategy
            if (adjustment.strategy === 'modify' && adjustment.updated_todo_item) {
                this._logModifications(currentItem, adjustment.updated_todo_item);
            } else if (adjustment.strategy === 'split' && adjustment.new_items) {
                this._logSplitItems(currentItem, adjustment.new_items);
            }

            // Generate summary
            const summary = this._generateAdjustmentSummary(currentItem, adjustment);

            // Apply adjustment
            const appliedResult = this._applyAdjustment(todo, currentItem, adjustment);

            return {
                success: true,
                strategy: adjustment.strategy,
                adjustment,
                summary,
                appliedResult,
                metadata: {
                    itemId: currentItem.id,
                    attemptNumber: attempt,
                    strategy: adjustment.strategy,
                    modificationsCount: this._countModifications(adjustment),
                    prompt: MCP_PROMPTS.ATLAS_ADJUST_TODO.name
                }
            };

        } catch (error) {
            this.logger.error('atlas-adjust-todo', `[STAGE-3-MCP] ❌ Adjustment failed: ${error.message}`);
            this.logger.error('atlas-adjust-todo', error.stack);

            return {
                success: false,
                error: error.message,
                strategy: 'skip',
                summary: `⚠️ Не вдалося відкоригувати "${currentItem.action}": ${error.message}`,
                metadata: {
                    itemId: currentItem.id,
                    errorType: error.name,
                    stage: 'adjustment'
                }
            };
        }
    }

    /**
     * Log modifications between original and updated item
     * 
     * @param {Object} original - Original item
     * @param {Object} updated - Updated item
     * @private
     */
    _logModifications(original, updated) {
        const changes = [];

        // Check action change
        if (original.action !== updated.action) {
            changes.push(`Action: "${original.action}" → "${updated.action}"`);
        }

        // Check tools change
        if (JSON.stringify(original.tools_needed) !== JSON.stringify(updated.tools_needed)) {
            changes.push(`Tools: ${original.tools_needed?.join(', ') || 'none'} → ${updated.tools_needed?.join(', ') || 'none'}`);
        }

        // Check parameters change
        if (JSON.stringify(original.parameters) !== JSON.stringify(updated.parameters)) {
            changes.push('Parameters: updated');
        }

        // Check success criteria change
        if (original.success_criteria !== updated.success_criteria) {
            changes.push(`Success criteria: "${original.success_criteria}" → "${updated.success_criteria}"`);
        }

        // Log all changes
        if (changes.length > 0) {
            this.logger.system('atlas-adjust-todo', '[STAGE-3-MCP] Modifications:');
            for (const change of changes) {
                this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP]    - ${change}`);
            }
        }
    }

    /**
     * Log split items
     * 
     * @param {Object} original - Original item
     * @param {Array} newItems - New split items
     * @private
     */
    _logSplitItems(original, newItems) {
        this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] Split "${original.action}" into ${newItems.length} items:`);
        
        for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];
            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP]    ${i + 1}. ${item.action}`);
            
            if (item.dependencies && item.dependencies.length > 0) {
                this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP]       Dependencies: ${item.dependencies.join(', ')}`);
            }
        }
    }

    /**
     * Generate summary of adjustment
     * 
     * @param {Object} item - Original item
     * @param {Object} adjustment - Adjustment result
     * @returns {string} Summary text
     * @private
     */
    _generateAdjustmentSummary(item, adjustment) {
        const lines = [];

        switch (adjustment.strategy) {
            case 'retry':
                lines.push(`🔄 Повторна спроба: "${item.action}"`);
                lines.push(`   Причина: ${adjustment.reasoning}`);
                break;

            case 'modify':
                lines.push(`✏️ Коригування: "${item.action}"`);
                lines.push(`   Зміни: ${adjustment.reasoning}`);
                
                if (adjustment.updated_todo_item) {
                    lines.push(`   Нова дія: "${adjustment.updated_todo_item.action}"`);
                }
                break;

            case 'split':
                lines.push(`✂️ Розділення: "${item.action}"`);
                
                if (adjustment.new_items && adjustment.new_items.length > 0) {
                    lines.push(`   На ${adjustment.new_items.length} ${this._getPluralForm(adjustment.new_items.length, 'пункт', 'пункти', 'пунктів')}:`);
                    
                    for (let i = 0; i < adjustment.new_items.length; i++) {
                        lines.push(`     ${i + 1}. ${adjustment.new_items[i].action}`);
                    }
                }
                break;

            case 'skip':
                lines.push(`⏭️ Пропуск: "${item.action}"`);
                lines.push(`   Причина: ${adjustment.reasoning}`);
                break;

            default:
                lines.push(`⚠️ Невідома стратегія: ${adjustment.strategy}`);
        }

        return lines.join('\n');
    }

    /**
     * Apply adjustment to TODO list
     * 
     * @param {Object} todo - TODO list
     * @param {Object} item - Original item
     * @param {Object} adjustment - Adjustment result
     * @returns {Object} Application result
     * @private
     */
    _applyAdjustment(todo, item, adjustment) {
        const result = {
            applied: false,
            action: adjustment.strategy,
            details: {}
        };

        try {
            switch (adjustment.strategy) {
                case 'retry':
                    // Just increment attempt counter
                    item.attempt = (item.attempt || 1) + 1;
                    result.applied = true;
                    result.details = { attemptNumber: item.attempt };
                    break;

                case 'modify':
                    // Update item with modified version
                    if (adjustment.updated_todo_item) {
                        Object.assign(item, adjustment.updated_todo_item);
                        item.attempt = (item.attempt || 1) + 1;
                        result.applied = true;
                        result.details = { itemUpdated: true };
                    }
                    break;

                case 'split':
                    // Replace original item with new split items
                    if (adjustment.new_items && adjustment.new_items.length > 0) {
                        const originalIndex = todo.items.indexOf(item);
                        
                        if (originalIndex !== -1) {
                            // Remove original item
                            todo.items.splice(originalIndex, 1);
                            
                            // Insert new items at same position
                            todo.items.splice(originalIndex, 0, ...adjustment.new_items);
                            
                            result.applied = true;
                            result.details = {
                                removedItems: 1,
                                addedItems: adjustment.new_items.length
                            };
                        }
                    }
                    break;

                case 'skip':
                    // Mark item as skipped
                    item.status = 'skipped';
                    item.skip_reason = adjustment.reasoning;
                    result.applied = true;
                    result.details = { itemSkipped: true };
                    break;
            }

            this.logger.system('atlas-adjust-todo', `[STAGE-3-MCP] Adjustment applied: ${result.applied}`);

        } catch (error) {
            this.logger.error('atlas-adjust-todo', `[STAGE-3-MCP] Failed to apply adjustment: ${error.message}`);
            result.error = error.message;
        }

        return result;
    }

    /**
     * Count modifications in adjustment
     * 
     * @param {Object} adjustment - Adjustment result
     * @returns {number} Number of modifications
     * @private
     */
    _countModifications(adjustment) {
        if (adjustment.strategy === 'split' && adjustment.new_items) {
            return adjustment.new_items.length;
        } else if (adjustment.strategy === 'modify' && adjustment.updated_todo_item) {
            return 1;
        } else {
            return 0;
        }
    }

    /**
     * Get correct plural form for Ukrainian words
     * 
     * @param {number} count - Number
     * @param {string} one - Form for 1
     * @param {string} few - Form for 2-4
     * @param {string} many - Form for 5+
     * @returns {string} Correct plural form
     * @private
     */
    _getPluralForm(count, one, few, many) {
        if (count % 10 === 1 && count % 100 !== 11) {
            return one;
        } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
            return few;
        } else {
            return many;
        }
    }
}

export default AtlasAdjustTodoProcessor;
