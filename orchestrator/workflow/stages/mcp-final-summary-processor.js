/**
 * @fileoverview MCP Final Summary Processor (Stage 8-MCP)
 * Generates comprehensive workflow summaries with tone awareness
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';

/**
 * MCP Final Summary Processor
 * 
 * Generates tone-aware summaries based on success rate:
 * - Positive (✅ success >= 80%): Enthusiastic, achievement-focused
 * - Neutral (⚠️ success 50-79%): Balanced, constructive
 * - Critical (❌ success < 50%): Problem-focused, actionable
 */
export class McpFinalSummaryProcessor {
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
     * Execute final summary generation
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.todo - Completed TODO list
     * @param {Object} [context.session] - Session context
     * @returns {Promise<Object>} Summary result
     */
    async execute(context) {
        this.logger.system('mcp-final-summary', '[STAGE-8-MCP] 📊 Generating final summary...');

        const { todo, session } = context;

        if (!todo) {
            throw new Error('todo is required for summary generation');
        }

        try {
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] TODO: ${todo.id}`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Mode: ${todo.mode}`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Items: ${todo.items.length}`);

            // Calculate metrics
            const metrics = this._calculateMetrics(todo);

            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Success rate: ${metrics.success_rate}%`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Completed: ${metrics.completed_items}`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Failed: ${metrics.failed_items}`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Skipped: ${metrics.skipped_items}`);

            // Generate summary using MCPTodoManager
            const summaryResult = await this.mcpTodoManager.generateSummary(todo);

            if (!summaryResult) {
                throw new Error('MCPTodoManager.generateSummary() returned null/undefined');
            }

            // Determine tone
            const tone = this._getTone(metrics.success_rate);

            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] Tone: ${tone}`);
            this.logger.system('mcp-final-summary', `[STAGE-8-MCP] ✅ Summary generated`);

            // Format final message
            const finalMessage = this._formatFinalMessage(summaryResult, metrics, tone);

            return {
                success: true,
                summary: summaryResult,
                finalMessage,
                metrics,
                tone,
                metadata: {
                    todoId: todo.id,
                    itemsTotal: todo.items.length,
                    itemsCompleted: metrics.completed_items,
                    itemsFailed: metrics.failed_items,
                    itemsSkipped: metrics.skipped_items,
                    successRate: metrics.success_rate,
                    totalAttempts: metrics.total_attempts,
                    prompt: MCP_PROMPTS.MCP_FINAL_SUMMARY.name
                }
            };

        } catch (error) {
            this.logger.error('mcp-final-summary', `[STAGE-8-MCP] ❌ Summary generation failed: ${error.message}`);
            this.logger.error('mcp-final-summary', error.stack);

            // Generate fallback summary
            const fallbackSummary = this._generateFallbackSummary(todo, error);

            return {
                success: false,
                error: error.message,
                summary: fallbackSummary,
                finalMessage: fallbackSummary.text,
                metadata: {
                    todoId: todo.id,
                    errorType: error.name,
                    stage: 'summary',
                    fallback: true
                }
            };
        }
    }

    /**
     * Calculate execution metrics
     * 
     * @param {Object} todo - TODO list
     * @returns {Object} Metrics
     * @private
     */
    _calculateMetrics(todo) {
        const metrics = {
            total_items: todo.items.length,
            completed_items: 0,
            failed_items: 0,
            skipped_items: 0,
            total_attempts: 0,
            success_rate: 0
        };

        for (const item of todo.items) {
            // Count attempts
            metrics.total_attempts += item.attempt || 1;

            // Count status
            if (item.status === 'completed') {
                metrics.completed_items++;
            } else if (item.status === 'skipped') {
                metrics.skipped_items++;
            } else if (item.status === 'failed') {
                metrics.failed_items++;
            }
        }

        // Calculate success rate
        if (metrics.total_items > 0) {
            metrics.success_rate = Math.round(
                (metrics.completed_items / metrics.total_items) * 100
            );
        }

        return metrics;
    }

    /**
     * Get tone based on success rate
     * 
     * @param {number} successRate - Success rate (0-100)
     * @returns {string} Tone ('positive', 'neutral', 'critical')
     * @private
     */
    _getTone(successRate) {
        if (successRate >= 80) {
            return 'positive';
        } else if (successRate >= 50) {
            return 'neutral';
        } else {
            return 'critical';
        }
    }

    /**
     * Format final message for user
     * 
     * @param {Object} summary - Summary from LLM
     * @param {Object} metrics - Execution metrics
     * @param {string} tone - Tone
     * @returns {string} Formatted message
     * @private
     */
    _formatFinalMessage(summary, metrics, tone) {
        const lines = [];

        // Add tone-specific header
        if (tone === 'positive') {
            lines.push('✅ Завдання виконано успішно!');
        } else if (tone === 'neutral') {
            lines.push('⚠️ Завдання виконано частково');
        } else {
            lines.push('❌ Виконання завдання з проблемами');
        }

        lines.push('');

        // Add summary text from LLM
        if (summary.text) {
            lines.push(summary.text);
        }

        lines.push('');

        // Add metrics
        lines.push('📊 Статистика:');
        lines.push(`   Виконано: ${metrics.completed_items}/${metrics.total_items}`);
        
        if (metrics.failed_items > 0) {
            lines.push(`   Помилки: ${metrics.failed_items}`);
        }
        
        if (metrics.skipped_items > 0) {
            lines.push(`   Пропущено: ${metrics.skipped_items}`);
        }
        
        lines.push(`   Спроб: ${metrics.total_attempts}`);
        lines.push(`   Успішність: ${metrics.success_rate}%`);

        return lines.join('\n');
    }

    /**
     * Generate fallback summary when LLM fails
     * 
     * @param {Object} todo - TODO list
     * @param {Error} error - Error that occurred
     * @returns {Object} Fallback summary
     * @private
     */
    _generateFallbackSummary(todo, error) {
        const metrics = this._calculateMetrics(todo);
        const tone = this._getTone(metrics.success_rate);

        const lines = [];

        // Header
        if (tone === 'positive') {
            lines.push('✅ Завдання виконано');
        } else if (tone === 'neutral') {
            lines.push('⚠️ Завдання виконано частково');
        } else {
            lines.push('❌ Виконання з помилками');
        }

        lines.push('');

        // List completed items
        if (metrics.completed_items > 0) {
            lines.push('Виконано:');
            
            for (const item of todo.items) {
                if (item.status === 'completed') {
                    lines.push(`  ✅ ${item.action}`);
                }
            }
            
            lines.push('');
        }

        // List failed items
        if (metrics.failed_items > 0) {
            lines.push('Помилки:');
            
            for (const item of todo.items) {
                if (item.status === 'failed') {
                    lines.push(`  ❌ ${item.action}`);
                    
                    if (item.verification && item.verification.reason) {
                        lines.push(`     ${item.verification.reason}`);
                    }
                }
            }
            
            lines.push('');
        }

        // List skipped items
        if (metrics.skipped_items > 0) {
            lines.push('Пропущено:');
            
            for (const item of todo.items) {
                if (item.status === 'skipped') {
                    lines.push(`  ⏭️ ${item.action}`);
                    
                    if (item.skip_reason) {
                        lines.push(`     ${item.skip_reason}`);
                    }
                }
            }
            
            lines.push('');
        }

        // Metrics
        lines.push('📊 Статистика:');
        lines.push(`   Успішність: ${metrics.success_rate}%`);
        lines.push(`   Виконано: ${metrics.completed_items}/${metrics.total_items}`);
        lines.push(`   Спроб: ${metrics.total_attempts}`);

        // Error note
        lines.push('');
        lines.push(`⚠️ Помилка генерації підсумку: ${error.message}`);

        return {
            text: lines.join('\n'),
            success_rate: metrics.success_rate,
            key_results: [],
            issues: [error.message],
            fallback: true
        };
    }

    /**
     * Extract key results from TODO items
     * 
     * @param {Object} todo - TODO list
     * @returns {Array<string>} Key results
     * @private
     */
    _extractKeyResults(todo) {
        const results = [];

        for (const item of todo.items) {
            if (item.status === 'completed' && item.execution_results) {
                // Extract meaningful results
                if (item.execution_results.file_created) {
                    results.push(`Файл створено: ${item.execution_results.file_created}`);
                } else if (item.execution_results.data_collected) {
                    results.push(`Дані зібрано: ${item.execution_results.data_collected}`);
                } else if (item.execution_results.action_performed) {
                    results.push(item.execution_results.action_performed);
                }
            }
        }

        return results;
    }
}

export default McpFinalSummaryProcessor;
