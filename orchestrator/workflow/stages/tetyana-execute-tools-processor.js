/**
 * @fileoverview Tetyana Execute Tools Processor (Stage 2.2-MCP)
 * Executes planned MCP tool calls for TODO items
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';

/**
 * Tetyana Execute Tools Processor
 * 
 * Executes MCP tool calls planned in Stage 2.1:
 * - Calls each tool sequentially
 * - Collects results from all calls
 * - Handles errors gracefully
 * - Reports execution success/failure
 */
export class TetyanaExecuteToolsProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpTodoManager - MCPTodoManager instance
     * @param {Object} dependencies.mcpManager - MCPManager instance for tool execution
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpTodoManager, mcpManager, logger: loggerInstance }) {
        this.mcpTodoManager = mcpTodoManager;
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute planned tools for TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item
     * @param {Object} context.plan - Tool plan from Stage 2.1
     * @param {Object} context.todo - Full TODO list
     * @returns {Promise<Object>} Execution result
     */
    async execute(context) {
        this.logger.system('tetyana-execute-tools', '[STAGE-2.2-MCP] ⚙️ Executing tools...');

        const { currentItem, plan, todo } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for tool execution');
        }

        if (!plan || !plan.tool_calls) {
            throw new Error('plan with tool_calls is required for execution');
        }

        try {
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP] Item: ${currentItem.id}. ${currentItem.action}`);
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP] Executing ${plan.tool_calls.length} tool call(s)...`);

            // Execute tools using MCPTodoManager
            const executionResult = await this.mcpTodoManager.executeTools(plan, currentItem);

            if (!executionResult) {
                throw new Error('MCPTodoManager.executeTools() returned null/undefined');
            }

            // Log results
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP] Execution completed`);
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   Success: ${executionResult.all_successful ? '✅' : '❌'}`);
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   Successful calls: ${executionResult.successful_calls || 0}`);
            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   Failed calls: ${executionResult.failed_calls || 0}`);

            // Log individual results
            if (executionResult.results && Array.isArray(executionResult.results)) {
                for (let i = 0; i < executionResult.results.length; i++) {
                    const result = executionResult.results[i];
                    const call = plan.tool_calls[i];
                    
                    if (call) {
                        const status = result.success ? '✅' : '❌';
                        this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   ${status} ${call.server}__${call.tool}`);
                        
                        if (!result.success && result.error) {
                            this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]      Error: ${result.error}`);
                        }
                    }
                }
            }

            // Generate summary
            const summary = this._generateExecutionSummary(currentItem, executionResult);

            return {
                success: executionResult.all_successful,
                execution: executionResult,
                summary,
                metadata: {
                    itemId: currentItem.id,
                    toolCount: plan.tool_calls.length,
                    successfulCalls: executionResult.successful_calls || 0,
                    failedCalls: executionResult.failed_calls || 0,
                    allSuccessful: executionResult.all_successful,
                    executionTime: executionResult.execution_time_ms
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-2.2-MCP] ❌ Execution failed: ${error.message}`, { category: 'tetyana-execute-tools', component: 'tetyana-execute-tools' });
            this.logger.error(`Stack trace: ${error.stack}`, { category: 'tetyana-execute-tools', component: 'tetyana-execute-tools' });

            return {
                success: false,
                error: error.message,
                execution: {
                    all_successful: false,
                    successful_calls: 0,
                    failed_calls: plan.tool_calls?.length || 0,
                    results: [],
                    error: error.message
                },
                summary: `❌ Не вдалося виконати "${currentItem.action}": ${error.message}`,
                metadata: {
                    itemId: currentItem.id,
                    errorType: error.name,
                    stage: 'tool-execution'
                }
            };
        }
    }

    /**
     * Generate summary of execution results
     * 
     * @param {Object} item - TODO item
     * @param {Object} execution - Execution results
     * @returns {string} Summary text
     * @private
     */
    _generateExecutionSummary(item, execution) {
        const lines = [];

        if (execution.all_successful) {
            lines.push(`✅ Виконано: "${item.action}"`);
        } else {
            lines.push(`⚠️ Часткове виконання: "${item.action}"`);
            lines.push(`   Успішно: ${execution.successful_calls || 0}`);
            lines.push(`   Помилки: ${execution.failed_calls || 0}`);
        }

        // Add key results if available
        const keyResults = this._extractKeyResults(execution.results);
        if (keyResults.length > 0) {
            lines.push('');
            lines.push('📋 Результати:');
            
            for (const result of keyResults) {
                lines.push(`   ${result}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Extract key results from execution
     * 
     * @param {Array} results - Tool execution results
     * @returns {Array<string>} Key result strings
     * @private
     */
    _extractKeyResults(results) {
        const keyResults = [];

        if (!Array.isArray(results)) {
            return keyResults;
        }

        for (const result of results) {
            if (!result.success) {
                continue;
            }

            // Extract meaningful information based on result type
            if (result.data) {
                // File written
                if (result.data.path && result.data.bytes_written) {
                    keyResults.push(`Файл збережено: ${result.data.path} (${result.data.bytes_written} байт)`);
                }
                
                // Directory created
                else if (result.data.path && result.data.created) {
                    keyResults.push(`Теку створено: ${result.data.path}`);
                }
                
                // File read
                else if (result.data.content && result.data.size) {
                    keyResults.push(`Файл прочитано: ${result.data.size} байт`);
                }
                
                // Browser opened
                else if (result.data.url && result.data.page_title) {
                    keyResults.push(`Браузер: ${result.data.page_title}`);
                }
                
                // Data scraped
                else if (result.data.items_count !== undefined) {
                    keyResults.push(`Зібрано даних: ${result.data.items_count} елементів`);
                }
                
                // Screenshot taken
                else if (result.data.screenshot_path) {
                    keyResults.push(`Скріншот: ${result.data.screenshot_path}`);
                }
                
                // Generic success message
                else if (result.data.message) {
                    keyResults.push(result.data.message);
                }
            }
        }

        return keyResults;
    }

    /**
     * Format execution time for display
     * 
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted time
     * @private
     */
    _formatExecutionTime(ms) {
        if (ms < 1000) {
            return `${ms}мс`;
        } else if (ms < 60000) {
            const seconds = (ms / 1000).toFixed(1);
            return `${seconds}с`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}хв ${seconds}с`;
        }
    }

    /**
     * Get error category for failed execution
     * 
     * @param {string} errorMessage - Error message
     * @returns {string} Error category
     * @private
     */
    _getErrorCategory(errorMessage) {
        const msgLower = errorMessage.toLowerCase();

        if (msgLower.includes('timeout')) {
            return 'timeout';
        } else if (msgLower.includes('not found') || msgLower.includes('404')) {
            return 'not_found';
        } else if (msgLower.includes('permission') || msgLower.includes('denied')) {
            return 'permission';
        } else if (msgLower.includes('network') || msgLower.includes('connection')) {
            return 'network';
        } else if (msgLower.includes('invalid') || msgLower.includes('parameter')) {
            return 'invalid_params';
        } else {
            return 'unknown';
        }
    }
}

export default TetyanaExecuteToolsProcessor;
