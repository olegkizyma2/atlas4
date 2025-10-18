/**
 * @fileoverview Tetyana Execute Tools Processor (Stage 2.2-MCP)
 * Executes planned MCP tool calls for TODO items
 * 
 * UPDATED 2025-10-18: Added step-by-step execution mode
 * - Execute tools one-by-one for complex items
 * - Intermediate checks between tools
 * - Better failure detection
 * 
 * @version 4.1.0
 * @date 2025-10-18
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
     * NEW 2025-10-18: Supports step-by-step execution mode
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

            // NEW 2025-10-18: Detect if step-by-step execution is needed
            const needsStepByStep = this._shouldExecuteStepByStep(plan, currentItem);
            
            if (needsStepByStep) {
                this.logger.system('tetyana-execute-tools', '[STAGE-2.2-MCP] 🔄 Using STEP-BY-STEP execution mode');
                const executionResult = await this._executeStepByStep(plan, currentItem);
                
                // Log results
                this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP] Step-by-step execution completed`);
                this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   Success: ${executionResult.all_successful ? '✅' : '❌'}`);
                this.logger.system('tetyana-execute-tools', `[STAGE-2.2-MCP]   Completed: ${executionResult.successful_calls}/${plan.tool_calls.length}`);
                
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
                        executionMode: 'step_by_step',
                        stoppedAt: executionResult.stopped_at_index
                    }
                };
            }

            // LEGACY: Batch execution (all tools at once)
            this.logger.system('tetyana-execute-tools', '[STAGE-2.2-MCP] Using BATCH execution mode');
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

    /**
     * Determine if step-by-step execution is needed
     * NEW 2025-10-18
     * 
     * @param {Object} plan - Tool execution plan
     * @param {Object} item - TODO item
     * @returns {boolean} True if step-by-step execution recommended
     * @private
     */
    _shouldExecuteStepByStep(plan, item) {
        // RULE 1: More than 3 playwright tools → step-by-step
        const playwrightTools = plan.tool_calls.filter(t => t.server === 'playwright').length;
        if (playwrightTools > 3) {
            this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] Triggered: ${playwrightTools} playwright tools > 3`);
            return true;
        }

        // RULE 2: Item involves search/scraping → step-by-step
        const actionLower = item.action.toLowerCase();
        const searchKeywords = ['знайди', 'знайти', 'search', 'пошук', 'зібрати', 'collect', 'scrape'];
        for (const keyword of searchKeywords) {
            if (actionLower.includes(keyword)) {
                this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] Triggered: action contains "${keyword}"`);
                return true;
            }
        }

        // RULE 3: Retry attempt → step-by-step (previous batch failed)
        if (item.attempt && item.attempt > 1) {
            this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] Triggered: retry attempt ${item.attempt}`);
            return true;
        }

        // RULE 4: Mix of different servers → step-by-step
        const uniqueServers = new Set(plan.tool_calls.map(t => t.server));
        if (uniqueServers.size > 2) {
            this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] Triggered: ${uniqueServers.size} different servers`);
            return true;
        }

        // Default: use batch execution
        return false;
    }

    /**
     * Execute tools step-by-step with intermediate checks
     * NEW 2025-10-18
     * 
     * @param {Object} plan - Tool execution plan
     * @param {Object} item - TODO item
     * @returns {Promise<Object>} Execution result
     * @private
     */
    async _executeStepByStep(plan, item) {
        const results = [];
        let successfulCalls = 0;
        let failedCalls = 0;
        const startTime = Date.now();

        for (let i = 0; i < plan.tool_calls.length; i++) {
            const toolCall = plan.tool_calls[i];
            
            this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] [${i + 1}/${plan.tool_calls.length}] ${toolCall.server}__${toolCall.tool}`);

            try {
                // Execute ONE tool
                const result = await this._executeOneTool(toolCall);
                results.push(result);

                if (result.success) {
                    successfulCalls++;
                    this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] ✅ Success`);
                } else {
                    failedCalls++;
                    this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] ❌ Failed: ${result.error}`);
                    
                    // CRITICAL: Stop on first failure
                    this.logger.warn(`[STEP-BY-STEP] Stopping execution at tool ${i + 1} due to failure`, {
                        category: 'tetyana-execute-tools',
                        component: 'tetyana-execute-tools'
                    });
                    
                    return {
                        all_successful: false,
                        successful_calls: successfulCalls,
                        failed_calls: failedCalls,
                        results,
                        stopped_at_index: i,
                        stopped_reason: result.error,
                        execution_time_ms: Date.now() - startTime
                    };
                }

                // Wait between tools (especially for web operations)
                const delay = this._getDelayBetweenTools(toolCall);
                if (delay > 0 && i < plan.tool_calls.length - 1) {
                    this.logger.system('tetyana-execute-tools', `[STEP-BY-STEP] Waiting ${delay}ms before next tool...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            } catch (error) {
                failedCalls++;
                this.logger.error(`[STEP-BY-STEP] Tool execution error: ${error.message}`, {
                    category: 'tetyana-execute-tools',
                    component: 'tetyana-execute-tools'
                });
                
                results.push({
                    success: false,
                    error: error.message,
                    tool: `${toolCall.server}__${toolCall.tool}`
                });

                // Stop on error
                return {
                    all_successful: false,
                    successful_calls: successfulCalls,
                    failed_calls: failedCalls,
                    results,
                    stopped_at_index: i,
                    stopped_reason: error.message,
                    execution_time_ms: Date.now() - startTime
                };
            }
        }

        // All tools executed successfully
        return {
            all_successful: true,
            successful_calls: successfulCalls,
            failed_calls: failedCalls,
            results,
            execution_time_ms: Date.now() - startTime
        };
    }

    /**
     * Execute a single tool call
     * NEW 2025-10-18
     * 
     * @param {Object} toolCall - Tool call specification
     * @returns {Promise<Object>} Tool execution result
     * @private
     */
    async _executeOneTool(toolCall) {
        try {
            // Use MCPManager to execute the tool
            const result = await this.mcpManager.callTool(
                toolCall.server,
                toolCall.tool,
                toolCall.parameters
            );

            return {
                success: true,
                tool: `${toolCall.server}__${toolCall.tool}`,
                data: result,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                tool: `${toolCall.server}__${toolCall.tool}`,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get delay duration between tools
     * NEW 2025-10-18
     * 
     * @param {Object} toolCall - Just executed tool call
     * @returns {number} Delay in milliseconds
     * @private
     */
    _getDelayBetweenTools(toolCall) {
        // Playwright tools need more time for page updates
        if (toolCall.server === 'playwright') {
            // navigate, fill, click need time
            if (['playwright_navigate', 'playwright_fill', 'playwright_click'].includes(toolCall.tool)) {
                return 2000; // 2 seconds
            }
            // Other playwright tools
            return 1000; // 1 second
        }

        // Filesystem, shell - minimal delay
        if (toolCall.server === 'filesystem' || toolCall.server === 'shell') {
            return 200; // 200ms
        }

        // Default
        return 500; // 500ms
    }
}

export default TetyanaExecuteToolsProcessor;
