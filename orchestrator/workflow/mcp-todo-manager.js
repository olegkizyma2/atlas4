/**
 * @fileoverview MCP Dynamic TODO Workflow Manager
 * Manages item-by-item execution of TODO lists with adaptive planning,
 * MCP tool integration, verification, and automatic retry/adjustment.
 * 
 * @version 4.0.0
 * @date 2025-10-13
 * UPDATED 14.10.2025 - Added MCP_MODEL_CONFIG support for per-stage models
 */

import logger from '../utils/logger.js';
import axios from 'axios';
import GlobalConfig, { MCP_MODEL_CONFIG } from '../../config/global-config.js';

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
     * @param {Object} dependencies.wsManager - WebSocket Manager for chat updates
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpManager, llmClient, ttsSyncManager, wsManager, logger: loggerInstance }) {
        this.mcpManager = mcpManager;
        this.llmClient = llmClient;
        this.tts = ttsSyncManager;
        this.wsManager = wsManager;  // ADDED 14.10.2025 - For chat updates
        this.logger = loggerInstance || logger;

        this.activeTodos = new Map(); // todoId -> TodoList
        this.completedTodos = new Map(); // todoId -> results
        this.currentSessionId = null;  // ADDED 14.10.2025 - Track current session

        // Rate limiting state (ADDED 14.10.2025)
        this.lastApiCall = 0;
        this.minApiDelay = 2000; // INCREASED 14.10.2025 - 2000ms between API calls to avoid rate limits
    }

    /**
     * Wait before making API call to avoid rate limits
     * ADDED 14.10.2025 - Prevent parallel API calls
     * 
     * @private
     */
    async _waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;

        if (timeSinceLastCall < this.minApiDelay) {
            const delay = this.minApiDelay - timeSinceLastCall;
            this.logger.system('mcp-todo', `[RATE-LIMIT] Waiting ${delay}ms before API call`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastApiCall = Date.now();
    }

    /**
     * Send message to chat via WebSocket
     * ADDED 14.10.2025 - Enable chat updates during workflow
     * 
     * @param {string} message - Message to send
     * @param {string} type - Message type (info, success, error, progress)
     * @private
     */
    _sendChatMessage(message, type = 'info') {
        // DEBUG 14.10.2025 - Log every call
        this.logger.system('mcp-todo', `[TODO] _sendChatMessage called: "${message}" (type: ${type}, wsManager: ${!!this.wsManager})`);
        
        if (!this.wsManager) {
            this.logger.warn(`[MCP-TODO] WebSocket Manager not available, skipping chat message`, {
                category: 'mcp-todo',
                component: 'mcp-todo'
            });
            return; // Gracefully skip if WebSocket not available
        }

        try {
            // FIXED 14.10.2025 - Use broadcastToSubscribers instead of broadcastToSession
            this.logger.system('mcp-todo', `[TODO] Broadcasting to subscribers: chat/chat_message`);
            this.wsManager.broadcastToSubscribers('chat', 'chat_message', {
                message,
                messageType: type,
                sessionId: this.currentSessionId,
                timestamp: new Date().toISOString()
            });
            this.logger.system('mcp-todo', `[TODO] ✅ Chat message sent successfully`);
        } catch (error) {
            this.logger.warn(`[MCP-TODO] Failed to send chat message: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                stack: error.stack
            });
        }
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
        
        // ADDED 14.10.2025 - Store sessionId for WebSocket updates
        if (context.sessionId) {
            this.currentSessionId = context.sessionId;
        }

        try {
            // Import full prompt from MCP prompts
            const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
            const todoPrompt = MCP_PROMPTS.ATLAS_TODO_PLANNING;

            // Build user message with context
            const userMessage = todoPrompt.userPrompt
                .replace('{{request}}', request)
                .replace('{{context}}', JSON.stringify(context, null, 2));

            // Wait for rate limit (ADDED 14.10.2025)
            await this._waitForRateLimit();

            // FIXED 13.10.2025 - Use FULL prompt with JSON schema and examples
            // FIXED 14.10.2025 - Use MCP_MODEL_CONFIG for per-stage models
            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('todo_planning');
            
            // LOG MODEL SELECTION (ADDED 14.10.2025 - Debugging)
            this.logger.system('mcp-todo', `[TODO] Using model: ${modelConfig.model} (temp: ${modelConfig.temperature}, max_tokens: ${modelConfig.max_tokens})`);
            
            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    { role: 'system', content: todoPrompt.systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: modelConfig.temperature,
                max_tokens: modelConfig.max_tokens
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000  // FIXED 14.10.2025 - 60s для o1-mini reasoning models (moved to config)
            });

            const response = apiResponse.data.choices[0].message.content;

            const todo = this._parseTodoResponse(response, request);

            // Validate TODO structure
            this._validateTodo(todo);

            // Store active TODO
            this.activeTodos.set(todo.id, todo);

            this.logger.system('mcp-todo', `[TODO] Created ${todo.mode} TODO with ${todo.items.length} items (complexity: ${todo.complexity}/10)`);

            // Send chat message (ADDED 14.10.2025)
            const itemsList = todo.items.map((item, idx) => `${idx + 1}. ${item.action}`).join('\n');
            this._sendChatMessage(
                `📋 План створено (${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}):\n${itemsList}`,
                'info'
            );

            // TTS feedback (optional - skip if TTS not available)
            if (this.tts && typeof this.tts.speak === 'function') {
                try {
                    await this._safeTTSSpeak(
                        `План створено, ${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}, починаю виконання`,
                        { mode: 'detailed', duration: 2500 }
                    );
                } catch (ttsError) {
                    this.logger.warn(`[MCP-TODO] TTS feedback failed: ${ttsError.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
                }
            }

            return todo;

        } catch (error) {
            this.logger.error(`[MCP-TODO] Failed to create TODO: ${error.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
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
                    this.logger.warn(`[MCP-TODO] Item ${item.id} skipped - dependencies not met`, { category: 'mcp-todo', component: 'mcp-todo' });
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
            this.logger.error(`[MCP-TODO] Execution failed: ${error.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
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
        this._sendChatMessage(`🔄 Виконую: ${item.action}`, 'progress');  // ADDED 14.10.2025

        item.status = 'in_progress';
        let lastError = null;

        for (let attempt = 1; attempt <= item.max_attempts; attempt++) {
            item.attempt = attempt;

            try {
                this.logger.system('mcp-todo', `[TODO] Item ${item.id} - Attempt ${attempt}/${item.max_attempts}`);
                if (attempt > 1) {
                    this._sendChatMessage(`🔁 Спроба ${attempt}/${item.max_attempts}`, 'info');  // ADDED 14.10.2025
                }

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
                    this._sendChatMessage(`✅ Виконано: ${item.action}`, 'success');  // ADDED 14.10.2025

                    await this._safeTTSSpeak('✅ Виконано', { mode: 'quick', duration: 100 });

                    return { status: 'completed', attempts: attempt, item };
                }

                // Verification failed
                this.logger.warn(`[MCP-TODO] Item ${item.id} verification failed: ${verification.reason}`, { category: 'mcp-todo', component: 'mcp-todo' });
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
                this.logger.error(`[MCP-TODO] Item ${item.id} attempt ${attempt} error: ${error.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
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

        this.logger.error(`[MCP-TODO] ❌ Item ${item.id} failed after ${item.max_attempts} attempts`, { category: 'mcp-todo', component: 'mcp-todo' });
        this._sendChatMessage(`❌ Не вдалося: ${item.action}`, 'error');  // ADDED 14.10.2025

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

        try {
            // DIAGNOSTIC: Check mcpManager before using
            if (!this.mcpManager) {
                // FIXED 14.10.2025 - Use correct logger signature for error() method
                this.logger.error(`[MCP-TODO] MCP Manager is null in planTools!`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo'
                });
                throw new Error('MCP Manager is not initialized (null) in planTools. Check DI registration and service instantiation.');
            }
            if (typeof this.mcpManager.listTools !== 'function') {
                // FIXED 14.10.2025 - Use correct logger signature for error() method
                this.logger.error(`[MCP-TODO] MCP Manager missing listTools method! Type: ${typeof this.mcpManager.listTools}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    mcpManagerType: typeof this.mcpManager,
                    listToolsType: typeof this.mcpManager.listTools
                });
                throw new Error('MCP Manager does not have listTools() method. Check implementation and DI registration.');
            }
            // Get available MCP tools
            const availableTools = await this.mcpManager.listTools();

            // OPTIMIZATION 14.10.2025 - Send only essential tool info, not full JSON schemas
            // This reduces prompt size from 8000+ tokens to ~1000 tokens
            const toolsSummary = availableTools.map(tool => ({
                name: tool.name,
                description: tool.description || tool.inputSchema?.description || 'No description',
                // Include only required parameter names, not full schemas
                required_params: tool.inputSchema?.required || []
            }));

            // Import Tetyana Plan Tools prompt
            const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
            const planPrompt = MCP_PROMPTS.TETYANA_PLAN_TOOLS;

            const userMessage = `
TODO Item: ${item.action}
Available MCP Tools: ${JSON.stringify(toolsSummary, null, 2)}
Previous items: ${JSON.stringify(todo.items.slice(0, item.id - 1).map(i => ({ id: i.id, action: i.action, status: i.status })), null, 2)}

Визнач які інструменти потрібні та параметри для виконання.
`;

            // FIXED 13.10.2025 - Use correct API call format
            // FIXED 14.10.2025 - Use MCP_MODEL_CONFIG for per-stage models
            let apiResponse;
            try {
                const modelConfig = MCP_MODEL_CONFIG.getStageConfig('plan_tools');
                
                // LOG MODEL SELECTION (ADDED 14.10.2025 - Debugging)
                this.logger.system('mcp-todo', `[TODO] Planning tools with model: ${modelConfig.model} (temp: ${modelConfig.temperature}, max_tokens: ${modelConfig.max_tokens})`);
                this.logger.system('mcp-todo', `[TODO] Calling LLM API at ${MCP_MODEL_CONFIG.apiEndpoint}...`);

                // Wait for rate limit (ADDED 14.10.2025)
                await this._waitForRateLimit();

                apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                    model: modelConfig.model,
                    messages: [
                        {
                            role: 'system',
                            content: planPrompt.systemPrompt || planPrompt.SYSTEM_PROMPT
                        },
                        {
                            role: 'user',
                            content: userMessage
                        }
                    ],
                    temperature: modelConfig.temperature,
                    max_tokens: modelConfig.max_tokens
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000,  // FIXED 14.10.2025 - Збільшено до 60s для повільних LLM відповідей
                    maxContentLength: 50 * 1024 * 1024,  // 50MB
                    maxBodyLength: 50 * 1024 * 1024  // 50MB
                });

                this.logger.system('mcp-todo', `[TODO] LLM API responded successfully`);

            } catch (apiError) {
                // FIXED 14.10.2025 - Use correct logger signature for error() method
                this.logger.error(`[MCP-TODO] LLM API call failed: ${apiError.message}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    errorName: apiError.name,
                    code: apiError.code,
                    stack: apiError.stack
                });
                if (apiError.code === 'ECONNREFUSED') {
                    throw new Error('LLM API not available at localhost:4000. Start it with: ./start-llm-api-4000.sh');
                }
                throw new Error(`LLM API error: ${apiError.message}`);
            }

            const response = apiResponse.data.choices[0].message.content;

            // DIAGNOSTIC: Log raw response
            this.logger.system('mcp-todo', `[TODO] Raw LLM response (first 200 chars): ${response.substring(0, 200)}`);
            this.logger.system('mcp-todo', `[TODO] Full LLM response: ${response}`);

            const plan = this._parseToolPlan(response);
            this.logger.system('mcp-todo', `[TODO] Parsed plan: ${JSON.stringify(plan, null, 2)}`);

            plan.tts_phrase = this._generatePlanTTS(plan, item);

            this.logger.system('mcp-todo', `[TODO] Planned ${plan.tool_calls.length} tool calls for item ${item.id}`);

            // DIAGNOSTIC: Check if tool_calls is empty
            if (!plan.tool_calls || plan.tool_calls.length === 0) {
                // FIXED 14.10.2025 - Use correct logger signature for warn() method
                this.logger.warn(`[MCP-TODO] Warning: No tool calls in plan! Plan: ${JSON.stringify(plan)}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    plan
                });
                throw new Error('No tool calls generated - plan is empty');
            }

            return plan;

        } catch (error) {
            // FIXED 14.10.2025 - Use correct logger signature for error() method
            this.logger.error(`[MCP-TODO] Failed to plan tools for item ${item.id}: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                itemId: item.id,
                errorName: error.name,
                stack: error.stack
            });
            throw new Error(`Tool planning failed: ${error.message}`);
        }
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
                // Enhanced diagnostics: include stack and toolCall metadata
                // FIXED 14.10.2025 - Use correct logger signature for error() method
                this.logger.error(`[MCP-TODO] Tool ${toolCall.tool} on ${toolCall.server} failed: ${error.message}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    toolCall,
                    server: toolCall.server,
                    itemId: item.id,
                    errorName: error.name,
                    stack: error.stack
                });

                results.push({
                    tool: toolCall.tool,
                    server: toolCall.server,
                    success: false,
                    error: error.message,
                    stack: error.stack || null,
                    metadata: toolCall
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

        try {
            // Import Grisha Verify Item prompt
            const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
            const verifyPrompt = MCP_PROMPTS.GRISHA_VERIFY_ITEM;

            // FIXED 14.10.2025 - Truncate long content to avoid token limits
            // FIXED 14.10.2025 - Also truncate error messages and stacks to avoid JSON parsing issues
            const truncatedResults = execution.results.map(result => {
                const truncated = { ...result };
                if (truncated.content && typeof truncated.content === 'string' && truncated.content.length > 1000) {
                    truncated.content = truncated.content.substring(0, 1000) + '... [truncated]';
                }
                if (truncated.text && typeof truncated.text === 'string' && truncated.text.length > 1000) {
                    truncated.text = truncated.text.substring(0, 1000) + '... [truncated]';
                }
                // НОВИНКА 14.10.2025 - Truncate error messages to avoid JSON parsing issues
                if (truncated.error && typeof truncated.error === 'string' && truncated.error.length > 500) {
                    truncated.error = truncated.error.substring(0, 500) + '... [truncated]';
                }
                if (truncated.stack && typeof truncated.stack === 'string' && truncated.stack.length > 500) {
                    truncated.stack = truncated.stack.substring(0, 500) + '... [truncated]';
                }
                return truncated;
            });

            const userMessage = `
TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}
Execution Results: ${JSON.stringify(truncatedResults, null, 2)}

Перевір чи виконано успішно. Використовуй MCP інструменти для перевірки (скріншот, file read, etc).
`;

            // FIXED 13.10.2025 - Use correct API call format
            // FIXED 14.10.2025 - Use MCP_MODEL_CONFIG for per-stage models
            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('verify_item');

            // Wait for rate limit (ADDED 14.10.2025)
            await this._waitForRateLimit();

            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: verifyPrompt.systemPrompt || verifyPrompt.SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                temperature: modelConfig.temperature,
                max_tokens: modelConfig.max_tokens
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000,  // FIXED 14.10.2025 - Збільшено до 60s для verification
                maxContentLength: 50 * 1024 * 1024,  // 50MB
                maxBodyLength: 50 * 1024 * 1024  // 50MB
            });

            const response = apiResponse.data.choices[0].message.content;
            const verification = this._parseVerification(response);
            verification.tts_phrase = verification.verified ? '✅ Підтверджено' : '❌ Не підтверджено';

            this.logger.system('mcp-todo', `[TODO] Verification result for item ${item.id}: ${verification.verified ? 'PASS' : 'FAIL'}`);

            return verification;

        } catch (error) {
            // FIXED 14.10.2025 - Use correct logger signature for error() method
            this.logger.error(`[MCP-TODO] Failed to verify item ${item.id}: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                itemId: item.id,
                errorName: error.name,
                stack: error.stack
            });
            throw new Error(`Verification failed: ${error.message}`);
        }
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

        try {
            // Import Atlas Adjust TODO prompt
            const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
            const adjustPrompt = MCP_PROMPTS.ATLAS_ADJUST_TODO;

            const userMessage = `
Failed TODO Item: ${JSON.stringify(item, null, 2)}
Verification: ${JSON.stringify(verification, null, 2)}
Attempt: ${attempt}/${item.max_attempts}

Визнач як скоригувати пункт TODO для успішного виконання.
Стратегії: retry (повтор), modify (зміна параметрів), split (розділити), skip (пропустити).
`;

            // FIXED 13.10.2025 - Use correct API call format
            // FIXED 14.10.2025 - Use MCP_MODEL_CONFIG for per-stage models
            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('adjust_todo');

            // Wait for rate limit (ADDED 14.10.2025)
            await this._waitForRateLimit();

            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: adjustPrompt.systemPrompt || adjustPrompt.SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                temperature: modelConfig.temperature,
                max_tokens: modelConfig.max_tokens
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000  // FIXED 14.10.2025 - Збільшено з 15s до 30s для adjustment
            });

            const response = apiResponse.data.choices[0].message.content;
            const adjustment = this._parseAdjustment(response);

            this.logger.system('mcp-todo', `[TODO] Adjustment strategy for item ${item.id}: ${adjustment.strategy}`);

            return adjustment;

        } catch (error) {
            this.logger.error(`[MCP-TODO] Failed to adjust item ${item.id}: ${error.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
            throw new Error(`Adjustment failed: ${error.message}`);
        }
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
                this.logger.warn(`[MCP-TODO] Dependency ${depId} not completed for item ${item.id}`, { category: 'mcp-todo', component: 'mcp-todo' });
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

        // FIXED 14.10.2025 - Safe access to execution.total_attempts with fallback
        const totalAttempts = todo.execution?.total_attempts || 0;

        const prompt = `
Original Request: ${todo.request}
TODO Items: ${todo.items.length}
Completed: ${completedItems.length}
Failed: ${failedItems.length}
Skipped: ${skippedItems.length}
Total Attempts: ${totalAttempts}

Results: ${JSON.stringify(todo.items.map(i => ({
            id: i.id,
            action: i.action,
            status: i.status,
            verification: i.verification
        })), null, 2)}

Створи підсумковий звіт виконання.
`;

        // Use axios POST to local LLM endpoint for consistent response structure
        // FIXED 14.10.2025 - Use MCP_MODEL_CONFIG for per-stage models
        let llmText = '';
        try {
            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('final_summary');

            // Wait for rate limit (ADDED 14.10.2025)
            await this._waitForRateLimit();

            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    { role: 'system', content: 'MCP_FINAL_SUMMARY' },
                    { role: 'user', content: prompt }
                ],
                temperature: modelConfig.temperature,
                max_tokens: modelConfig.max_tokens
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000
            });

            llmText = apiResponse.data?.choices?.[0]?.message?.content || '';
        } catch (err) {
            this.logger.warn(`[MCP-TODO] LLM summary generation failed: ${err.message}`, { category: 'mcp-todo', component: 'mcp-todo', stack: err.stack });
            // Fallback: create a minimal summary based on counts
            llmText = `Summary generation failed: ${err.message}. Completed ${completedItems.length}/${todo.items.length} items.`;
        }

        const summary = {
            success_rate: successRate,
            completed_items: completedItems.length,
            failed_items: failedItems.length,
            skipped_items: skippedItems.length,
            total_attempts: totalAttempts,  // FIXED 14.10.2025 - Use safe variable
            summary: llmText,
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
            // FIXED 14.10.2025 - Extract JSON from text if LLM added explanation
            let cleanResponse = response;
            if (typeof response === 'string') {
                // Remove ```json and ``` wrappers
                cleanResponse = response
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Extract JSON object from text (starts with '{' and ends with '}')
                // Look for JSON with "mode" or "items" field
                const jsonMatch = cleanResponse.match(/\{[\s\S]*"(mode|items)"[\s\S]*\}/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[0];
                }
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
                })),
                // FIXED 14.10.2025 - Initialize execution object to prevent undefined errors
                execution: {
                    start_time: Date.now(),
                    end_time: null,
                    total_attempts: 0,
                    status: 'pending'
                }
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
            this.logger.warn(`[MCP-TODO] Standard mode has ${todo.items.length} items (recommended 1-3)`, { category: 'mcp-todo', component: 'mcp-todo' });
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
            // FIXED 13.10.2025 - Clean markdown wrappers before parsing
            // FIXED 14.10.2025 - Extract JSON from text if LLM added explanation
            let cleanResponse = response;
            if (typeof response === 'string') {
                cleanResponse = response
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Extract JSON object from text (starts with '{' and ends with '}')
                // Look for JSON with "tool_calls" field
                const jsonMatch = cleanResponse.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[0];
                }
            }

            const parsed = typeof cleanResponse === 'string' ? JSON.parse(cleanResponse) : cleanResponse;
            return {
                tool_calls: parsed.tool_calls || [],
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            this.logger.error(`[MCP-TODO] Failed to parse tool plan. Raw response: ${response}`, { category: 'mcp-todo', component: 'mcp-todo' });
            throw new Error(`Failed to parse tool plan: ${error.message}`);
        }
    }

    _parseVerification(response) {
        try {
            // FIXED 13.10.2025 - Clean markdown wrappers before parsing
            let cleanResponse = response;
            if (typeof response === 'string') {
                cleanResponse = response
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // FIXED 14.10.2025 - Extract JSON from text if LLM added explanation
                // Шукаємо JSON object в тексті (починається з '{' та закінчується '}')
                const jsonMatch = cleanResponse.match(/\{[\s\S]*"verified"[\s\S]*\}/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[0];
                }
            }

            const parsed = typeof cleanResponse === 'string' ? JSON.parse(cleanResponse) : cleanResponse;
            return {
                verified: parsed.verified === true,
                reason: parsed.reason || '',
                evidence: parsed.evidence || {}
            };
        } catch (error) {
            // НОВИНКА 14.10.2025 - Better error handling with fallback
            const truncatedResponse = typeof response === 'string' && response.length > 500 
                ? response.substring(0, 500) + '... [truncated]' 
                : response;
            
            this.logger.error(`[MCP-TODO] Failed to parse verification. Raw response: ${truncatedResponse}`, { 
                category: 'mcp-todo', 
                component: 'mcp-todo',
                parseError: error.message 
            });
            
            // Fallback: return failed verification with error details
            return {
                verified: false,
                reason: `JSON parsing failed: ${error.message}`,
                evidence: { parseError: error.message, responsePreview: truncatedResponse }
            };
        }
    }

    _parseAdjustment(response) {
        try {
            // FIXED 13.10.2025 - Clean markdown wrappers before parsing
            // FIXED 14.10.2025 - Extract JSON from text if LLM added explanation
            let cleanResponse = response;
            if (typeof response === 'string') {
                cleanResponse = response
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Extract JSON object from text (starts with '{' and ends with '}')
                // Look for JSON with "strategy" field
                const jsonMatch = cleanResponse.match(/\{[\s\S]*"strategy"[\s\S]*\}/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[0];
                }
            }

            const parsed = typeof cleanResponse === 'string' ? JSON.parse(cleanResponse) : cleanResponse;
            return {
                strategy: parsed.strategy || 'retry',
                updated_todo_item: parsed.updated_todo_item || {},
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            this.logger.error(`[MCP-TODO] Failed to parse adjustment. Raw response: ${response}`, { category: 'mcp-todo', component: 'mcp-todo' });
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
                this.logger.warn(`[MCP-TODO] TTS failed: ${ttsError.message}`, { category: 'mcp-todo', component: 'mcp-todo' });
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
