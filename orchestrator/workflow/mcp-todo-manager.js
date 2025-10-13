/**
 * @fileoverview MCP Dynamic TODO Workflow Manager
 * Manages item-by-item execution of TODO lists with adaptive planning,
 * MCP tool integration, verification, and automatic retry/adjustment.
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../utils/logger.js';
import axios from 'axios';

/**
 * @typedef {Object} TodoItem
 * @property {number} id - Unique item ID
 * @property {string} action - Concrete action to perform
 * @property {string[]} tools_needed - MCP tools required
 * @property {string[]} mcp_servers - MCP server names
 * @property {Object} parameters - Tool-specific parameters
 * @property {string} success_criteria - Clear verification criteria
 * @property {string[]} fallback_options - Alternative approaches
 * @property {number[]} dependencies - Item IDs that must complete first
 * @property {number} attempt - Current attempt number (1-3)
 * @property {number} max_attempts - Maximum retry attempts (default 3)
 * @property {'pending'|'in_progress'|'completed'|'failed'|'skipped'} status
 * @property {Object} [execution_results] - Tool execution results
 * @property {Object} [verification] - Verification results
 * @property {Object} tts - TTS phrases for different events
 * @property {string} tts.start - Phrase when starting item
 * @property {string} tts.success - Phrase on success
 * @property {string} tts.failure - Phrase on failure
 * @property {string} tts.verify - Phrase during verification
 */

/**
 * @typedef {Object} TodoList
 * @property {string} id - Unique TODO list ID
 * @property {string} request - Original user request
 * @property {'standard'|'extended'} mode - TODO mode
 * @property {number} complexity - Complexity score 1-10
 * @property {TodoItem[]} items - TODO items
 * @property {Object} execution - Execution state
 * @property {number} execution.current_item_index - Current item being processed
 * @property {number} execution.completed_items - Count of completed items
 * @property {number} execution.failed_items - Count of failed items
 * @property {number} execution.total_attempts - Total retry attempts made
 * @property {Object} [results] - Final results summary
 */

/**
 * MCP Dynamic TODO Workflow Manager
 * 
 * Orchestrates item-by-item execution with:
 * - Tetyana planning and executing tools
 * - Grisha verifying each item
 * - Atlas adjusting TODO on failures
 * - Dependency management
 * - Synchronized TTS feedback
 */
export class MCPTodoManager {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpManager - MCP Manager instance
     * @param {Object} dependencies.llmClient - LLM Client for reasoning
     * @param {Object} dependencies.ttsSyncManager - TTS Sync Manager
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpManager, llmClient, ttsSyncManager, logger: loggerInstance }) {
        this.mcpManager = mcpManager;
        this.llmClient = llmClient;
        this.tts = ttsSyncManager;
        this.logger = loggerInstance || logger;
        
        this.activeTodos = new Map(); // todoId -> TodoList
        this.completedTodos = new Map(); // todoId -> results
    }

    /**
     * Create TODO list from user request
     * 
     * @param {string} request - User request text
     * @param {Object} context - Additional context
     * @returns {Promise<TodoList>} Created TODO list
     */
    async createTodo(request, context = {}) {
        this.logger.system('mcp-todo', `[TODO] Creating TODO for request: "${request}"`);

        try {
            // Call LLM to generate TODO structure via System API (port 4000)
            const prompt = this._buildTodoCreationPrompt(request, context);
            
            // FIXED 13.10.2025 - Use direct axios call to port 4000 API
            const apiResponse = await axios.post('http://localhost:4000/v1/chat/completions', {
                model: 'openai/gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are Atlas, a planning AI. Create a TODO list in JSON format based on user requests.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            const response = apiResponse.data.choices[0].message.content;

            const todo = this._parseTodoResponse(response, request);
            
            // Validate TODO structure
            this._validateTodo(todo);
            
            // Store active TODO
            this.activeTodos.set(todo.id, todo);
            
            this.logger.system('mcp-todo', `[TODO] Created ${todo.mode} TODO with ${todo.items.length} items (complexity: ${todo.complexity}/10)`);
            
            // TTS feedback (optional - skip if TTS not available)
            if (this.tts && typeof this.tts.speak === 'function') {
                try {
                    await this._safeTTSSpeak(
                        `План створено, ${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}, починаю виконання`,
                        { mode: 'detailed', duration: 2500 }
                    );
                } catch (ttsError) {
                    this.logger.warn('mcp-todo', `[TODO] TTS feedback failed: ${ttsError.message}`);
                }
            }

            return todo;

        } catch (error) {
            this.logger.error('mcp-todo', `[TODO] Failed to create TODO: ${error.message}`);
            throw new Error(`TODO creation failed: ${error.message}`);
        }
    }

    /**
     * Execute TODO list item by item
     * 
     * @param {TodoList} todo - TODO list to execute
     * @returns {Promise<Object>} Execution results
     */
    async executeTodo(todo) {
        this.logger.system('mcp-todo', `[TODO] Starting execution of TODO ${todo.id} (${todo.items.length} items)`);

        const startTime = Date.now();
        todo.execution = {
            current_item_index: 0,
            completed_items: 0,
            failed_items: 0,
            total_attempts: 0
        };

        try {
            // Execute items sequentially
            for (let i = 0; i < todo.items.length; i++) {
                const item = todo.items[i];
                todo.execution.current_item_index = i;

                this.logger.system('mcp-todo', `[TODO] Processing item ${item.id}: "${item.action}"`);

                // Check dependencies
                if (!this._checkDependencies(item, todo)) {
                    this.logger.warn('mcp-todo', `[TODO] Item ${item.id} skipped - dependencies not met`);
                    item.status = 'skipped';
                    continue;
                }

                // Execute with retry
                const itemResult = await this.executeItemWithRetry(item, todo);

                // Update counters
                if (itemResult.status === 'completed') {
                    todo.execution.completed_items++;
                } else if (itemResult.status === 'failed') {
                    todo.execution.failed_items++;
                }
                todo.execution.total_attempts += itemResult.attempts;
            }

            // Generate final summary
            const summary = await this.generateSummary(todo);
            todo.results = summary;

            // Move to completed
            this.activeTodos.delete(todo.id);
            this.completedTodos.set(todo.id, todo);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            this.logger.system('mcp-todo', `[TODO] Execution completed in ${duration}s - Success: ${summary.success_rate}%`);

            // Final TTS
            await this._safeTTSSpeak(
                `Завдання виконано на ${summary.success_rate}%`,
                { mode: 'detailed', duration: 2500 }
            );

            return summary;

        } catch (error) {
            this.logger.error('mcp-todo', `[TODO] Execution failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute single TODO item with retry logic
     * 
     * @param {TodoItem} item - Item to execute
     * @param {TodoList} todo - Parent TODO list
     * @returns {Promise<Object>} Execution result
     */
    async executeItemWithRetry(item, todo) {
        this.logger.system('mcp-todo', `[TODO] Executing item ${item.id} with max ${item.max_attempts} attempts`);

        item.status = 'in_progress';
        let lastError = null;

        for (let attempt = 1; attempt <= item.max_attempts; attempt++) {
            item.attempt = attempt;

            try {
                this.logger.system('mcp-todo', `[TODO] Item ${item.id} - Attempt ${attempt}/${item.max_attempts}`);

                // Stage 2.1: Plan Tools (Tetyana)
                const plan = await this.planTools(item, todo);
                await this._safeTTSSpeak(plan.tts_phrase, { mode: 'quick', duration: 150 });

                // Stage 2.2: Execute Tools (Tetyana)
                const execution = await this.executeTools(plan, item);
                await this._safeTTSSpeak(execution.tts_phrase, { mode: 'normal', duration: 800 });

                // Stage 2.3: Verify Item (Grisha)
                const verification = await this.verifyItem(item, execution);
                await this._safeTTSSpeak(verification.tts_phrase, { mode: 'normal', duration: 800 });

                // Check verification result
                if (verification.verified) {
                    item.status = 'completed';
                    item.execution_results = execution.results;
                    item.verification = verification;

                    this.logger.system('mcp-todo', `[TODO] ✅ Item ${item.id} completed on attempt ${attempt}`);
                    
                    await this._safeTTSSpeak('✅ Виконано', { mode: 'quick', duration: 100 });
                    
                    return { status: 'completed', attempts: attempt, item };
                }

                // Verification failed
                this.logger.warn('mcp-todo', `[TODO] Item ${item.id} verification failed: ${verification.reason}`);
                lastError = verification.reason;

                // Stage 3: Adjust TODO (if attempts remain)
                if (attempt < item.max_attempts) {
                    const adjustment = await this.adjustTodoItem(item, verification, attempt);
                    
                    // Apply adjustments
                    Object.assign(item, adjustment.updated_todo_item);
                    
                    await this._safeTTSSpeak('Коригую та повторюю...', { mode: 'normal', duration: 1000 });
                } else {
                    // Final attempt failed
                    await this._safeTTSSpeak('❌ Помилка', { mode: 'quick', duration: 100 });
                }

            } catch (error) {
                this.logger.error('mcp-todo', `[TODO] Item ${item.id} attempt ${attempt} error: ${error.message}`);
                lastError = error.message;

                if (attempt >= item.max_attempts) {
                    break;
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // All attempts failed
        item.status = 'failed';
        item.execution_results = { error: lastError };

        this.logger.error('mcp-todo', `[TODO] ❌ Item ${item.id} failed after ${item.max_attempts} attempts`);

        return { status: 'failed', attempts: item.max_attempts, item, error: lastError };
    }

    /**
     * Plan which MCP tools to use for item (Stage 2.1 - Tetyana)
     * 
     * @param {TodoItem} item - Item to plan
     * @param {TodoList} todo - Parent TODO list
     * @returns {Promise<Object>} Tool plan
     */
    async planTools(item, todo) {
        this.logger.system('mcp-todo', `[TODO] Planning tools for item ${item.id}`);

        // Get available MCP tools
        const availableTools = await this.mcpManager.listTools();

        const prompt = `
TODO Item: ${item.action}
Available MCP Tools: ${JSON.stringify(availableTools, null, 2)}
Previous items: ${JSON.stringify(todo.items.slice(0, item.id - 1).map(i => ({ id: i.id, action: i.action, status: i.status })), null, 2)}

Визнач які інструменти потрібні та параметри для виконання.
`;

        const response = await this.llmClient.generate({
            systemPrompt: 'TETYANA_PLAN_TOOLS',
            userMessage: prompt,
            temperature: 0.2,
            maxTokens: 1000
        });

        const plan = this._parseToolPlan(response);
        plan.tts_phrase = this._generatePlanTTS(plan, item);

        this.logger.system('mcp-todo', `[TODO] Planned ${plan.tool_calls.length} tool calls for item ${item.id}`);

        return plan;
    }

    /**
     * Execute planned MCP tools (Stage 2.2 - Tetyana)
     * 
     * @param {Object} plan - Tool execution plan
     * @param {TodoItem} item - Item being executed
     * @returns {Promise<Object>} Execution results
     */
    async executeTools(plan, item) {
        this.logger.system('mcp-todo', `[TODO] Executing ${plan.tool_calls.length} tool calls for item ${item.id}`);

        const results = [];
        let allSuccessful = true;

        for (const toolCall of plan.tool_calls) {
            try {
                this.logger.system('mcp-todo', `[TODO] Calling ${toolCall.tool} on ${toolCall.server}`);

                const result = await this.mcpManager.executeTool(
                    toolCall.server,
                    toolCall.tool,
                    toolCall.parameters
                );

                results.push({
                    tool: toolCall.tool,
                    server: toolCall.server,
                    success: true,
                    result
                });

            } catch (error) {
                this.logger.error('mcp-todo', `[TODO] Tool ${toolCall.tool} failed: ${error.message}`);
                
                results.push({
                    tool: toolCall.tool,
                    server: toolCall.server,
                    success: false,
                    error: error.message
                });
                
                allSuccessful = false;
            }
        }

        const execution = {
            results,
            all_successful: allSuccessful,
            tts_phrase: this._generateExecutionTTS(results, item, allSuccessful)
        };

        this.logger.system('mcp-todo', `[TODO] Tool execution ${allSuccessful ? 'successful' : 'partial'} for item ${item.id}`);

        return execution;
    }

    /**
     * Verify item execution (Stage 2.3 - Grisha)
     * 
     * @param {TodoItem} item - Item to verify
     * @param {Object} execution - Execution results
     * @returns {Promise<Object>} Verification result
     */
    async verifyItem(item, execution) {
        this.logger.system('mcp-todo', `[TODO] Verifying item ${item.id}`);

        const prompt = `
TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}
Execution Results: ${JSON.stringify(execution.results, null, 2)}

Перевір чи виконано успішно. Використовуй MCP інструменти для перевірки (скріншот, file read, etc).
`;

        const response = await this.llmClient.generate({
            systemPrompt: 'GRISHA_VERIFY_ITEM',
            userMessage: prompt,
            temperature: 0.1,
            maxTokens: 800
        });

        const verification = this._parseVerification(response);
        verification.tts_phrase = verification.verified ? '✅ Підтверджено' : '❌ Не підтверджено';

        this.logger.system('mcp-todo', `[TODO] Verification result for item ${item.id}: ${verification.verified ? 'PASS' : 'FAIL'}`);

        return verification;
    }

    /**
     * Adjust TODO item on failure (Stage 3 - Atlas)
     * 
     * @param {TodoItem} item - Failed item
     * @param {Object} verification - Verification result
     * @param {number} attempt - Current attempt number
     * @returns {Promise<Object>} Adjustment plan
     */
    async adjustTodoItem(item, verification, attempt) {
        this.logger.system('mcp-todo', `[TODO] Adjusting item ${item.id} after attempt ${attempt}`);

        const prompt = `
Failed TODO Item: ${JSON.stringify(item, null, 2)}
Verification: ${JSON.stringify(verification, null, 2)}
Attempt: ${attempt}/${item.max_attempts}

Визнач як скоригувати пункт TODO для успішного виконання.
Стратегії: retry (повтор), modify (зміна параметрів), split (розділити), skip (пропустити).
`;

        const response = await this.llmClient.generate({
            systemPrompt: 'ATLAS_ADJUST_TODO',
            userMessage: prompt,
            temperature: 0.3,
            maxTokens: 1000
        });

        const adjustment = this._parseAdjustment(response);

        this.logger.system('mcp-todo', `[TODO] Adjustment strategy for item ${item.id}: ${adjustment.strategy}`);

        return adjustment;
    }

    /**
     * Check if item dependencies are satisfied
     * 
     * @param {TodoItem} item - Item to check
     * @param {TodoList} todo - Parent TODO list
     * @returns {boolean} True if dependencies met
     */
    _checkDependencies(item, todo) {
        if (!item.dependencies || item.dependencies.length === 0) {
            return true;
        }

        for (const depId of item.dependencies) {
            const depItem = todo.items.find(i => i.id === depId);
            
            if (!depItem || depItem.status !== 'completed') {
                this.logger.warn('mcp-todo', `[TODO] Dependency ${depId} not completed for item ${item.id}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Generate final summary (Stage 8-MCP)
     * 
     * @param {TodoList} todo - Completed TODO list
     * @returns {Promise<Object>} Summary results
     */
    async generateSummary(todo) {
        this.logger.system('mcp-todo', `[TODO] Generating summary for TODO ${todo.id}`);

        const completedItems = todo.items.filter(i => i.status === 'completed');
        const failedItems = todo.items.filter(i => i.status === 'failed');
        const skippedItems = todo.items.filter(i => i.status === 'skipped');

        const successRate = Math.round((completedItems.length / todo.items.length) * 100);

        const prompt = `
Original Request: ${todo.request}
TODO Items: ${todo.items.length}
Completed: ${completedItems.length}
Failed: ${failedItems.length}
Skipped: ${skippedItems.length}
Total Attempts: ${todo.execution.total_attempts}

Results: ${JSON.stringify(todo.items.map(i => ({
    id: i.id,
    action: i.action,
    status: i.status,
    verification: i.verification
})), null, 2)}

Створи підсумковий звіт виконання.
`;

        const response = await this.llmClient.generate({
            systemPrompt: 'MCP_FINAL_SUMMARY',
            userMessage: prompt,
            temperature: 0.2,
            maxTokens: 1500
        });

        const summary = {
            success_rate: successRate,
            completed_items: completedItems.length,
            failed_items: failedItems.length,
            skipped_items: skippedItems.length,
            total_attempts: todo.execution.total_attempts,
            summary: response,
            key_results: completedItems.map(i => ({
                action: i.action,
                results: i.execution_results
            })),
            issues: failedItems.map(i => ({
                action: i.action,
                error: i.execution_results?.error
            }))
        };

        return summary;
    }

    // ==================== PRIVATE HELPER METHODS ====================

    _buildTodoCreationPrompt(request, context) {
        return `
User Request: ${request}
Context: ${JSON.stringify(context, null, 2)}

Створи TODO список для виконання запиту.
Режими: standard (1-3 пункти) або extended (4-10 пунктів).

⚠️ CRITICAL: Return ONLY raw JSON without markdown code blocks.
❌ DO NOT wrap response in \`\`\`json ... \`\`\` 
✅ Return ONLY: {"mode": "...", "items": [...], ...}
`;
    }

    _parseTodoResponse(response, request) {
        // Parse LLM response into TodoList structure
        // Expected JSON format from LLM
        try {
            // FIXED 13.10.2025 - Strip markdown code blocks (```json ... ```)
            let cleanResponse = response;
            if (typeof response === 'string') {
                // Remove ```json and ``` wrappers
                cleanResponse = response
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();
            }
            
            const parsed = typeof cleanResponse === 'string' ? JSON.parse(cleanResponse) : cleanResponse;
            
            return {
                id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                request,
                mode: parsed.mode || 'standard',
                complexity: parsed.complexity || 5,
                items: parsed.items.map((item, idx) => ({
                    id: idx + 1,
                    action: item.action,
                    tools_needed: item.tools_needed || [],
                    mcp_servers: item.mcp_servers || [],
                    parameters: item.parameters || {},
                    success_criteria: item.success_criteria || 'Action completed without errors',
                    fallback_options: item.fallback_options || [],
                    dependencies: item.dependencies || [],
                    attempt: 0,
                    max_attempts: 3,
                    status: 'pending',
                    tts: {
                        start: item.tts?.start || `Виконую: ${item.action}`,
                        success: item.tts?.success || '✅ Виконано',
                        failure: item.tts?.failure || '❌ Помилка',
                        verify: item.tts?.verify || 'Перевіряю...'
                    }
                }))
            };
        } catch (error) {
            throw new Error(`Failed to parse TODO response: ${error.message}`);
        }
    }

    _validateTodo(todo) {
        if (!todo.items || todo.items.length === 0) {
            throw new Error('TODO must have at least one item');
        }

        if (todo.mode === 'standard' && todo.items.length > 3) {
            this.logger.warn('mcp-todo', `[TODO] Standard mode has ${todo.items.length} items (recommended 1-3)`);
        }

        if (todo.mode === 'extended' && todo.items.length > 10) {
            throw new Error('Extended mode cannot exceed 10 items');
        }

        // Validate dependencies
        for (const item of todo.items) {
            for (const depId of item.dependencies || []) {
                if (!todo.items.find(i => i.id === depId)) {
                    throw new Error(`Item ${item.id} has invalid dependency ${depId}`);
                }
                if (depId >= item.id) {
                    throw new Error(`Item ${item.id} has forward/circular dependency ${depId}`);
                }
            }
        }
    }

    _parseToolPlan(response) {
        try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            return {
                tool_calls: parsed.tool_calls || [],
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            throw new Error(`Failed to parse tool plan: ${error.message}`);
        }
    }

    _parseVerification(response) {
        try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            return {
                verified: parsed.verified === true,
                reason: parsed.reason || '',
                evidence: parsed.evidence || {}
            };
        } catch (error) {
            throw new Error(`Failed to parse verification: ${error.message}`);
        }
    }

    _parseAdjustment(response) {
        try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            return {
                strategy: parsed.strategy || 'retry',
                updated_todo_item: parsed.updated_todo_item || {},
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            throw new Error(`Failed to parse adjustment: ${error.message}`);
        }
    }

    _generatePlanTTS(plan, item) {
        const actionVerb = item.action.split(' ')[0];
        return `${actionVerb}...`;
    }

    _generateExecutionTTS(results, item, allSuccessful) {
        if (allSuccessful) {
            // Extract key result
            const mainAction = item.action.toLowerCase();
            if (mainAction.includes('створ')) return 'Створено';
            if (mainAction.includes('відкр')) return 'Відкрито';
            if (mainAction.includes('збер')) return 'Збережено';
            if (mainAction.includes('знайд')) return 'Знайдено';
            return 'Готово';
        }
        return 'Виконано частково';
    }

    /**
     * Safe TTS helper - speaks only if TTS is available
     * FIXED 13.10.2025 - Added null-safety for TTS
     * 
     * @param {string} phrase - Text to speak
     * @param {Object} options - TTS options (mode, duration)
     * @returns {Promise<void>}
     */
    async _safeTTSSpeak(phrase, options = {}) {
        if (this.tts && typeof this.tts.speak === 'function') {
            try {
                await this.tts.speak(phrase, options);
            } catch (ttsError) {
                this.logger.warn('mcp-todo', `[TODO] TTS failed: ${ttsError.message}`);
            }
        }
        // Silently skip if TTS not available
    }

    _getPluralForm(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
    }
}

export default MCPTodoManager;
