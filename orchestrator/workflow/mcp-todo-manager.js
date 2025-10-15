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
import vm from 'node:vm';
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
     * FIXED 16.10.2025 - Use agent_message for Tetyana/Grisha/Atlas, chat_message for system
     * 
     * @param {string} message - Message to send
     * @param {string} type - Message type or agent name (tetyana, grisha, atlas, agent, info, success, error, progress)
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
            // FIXED 16.10.2025 - Determine if this is an agent message or system message
            const agentNames = ['tetyana', 'grisha', 'atlas', 'agent'];
            const isAgentMessage = agentNames.includes(type.toLowerCase());

            if (isAgentMessage) {
                // Send as agent_message (will show as [TETYANA], [GRISHA], etc in chat)
                let agentName = type.toLowerCase();
                
                // Extract agent name from message if type is 'agent'
                if (agentName === 'agent') {
                    const match = message.match(/^\[([A-Z]+)\]/);
                    if (match) {
                        agentName = match[1].toLowerCase();
                    } else {
                        agentName = 'system'; // Fallback
                    }
                }

                this.logger.system('mcp-todo', `[TODO] Broadcasting agent message: chat/agent_message (agent: ${agentName})`);
                this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
                    content: message,
                    agent: agentName,
                    sessionId: this.currentSessionId,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Send as chat_message (will show as [SYSTEM])
                this.logger.system('mcp-todo', `[TODO] Broadcasting system message: chat/chat_message`);
                this.wsManager.broadcastToSubscribers('chat', 'chat_message', {
                    message,
                    messageType: type,
                    sessionId: this.currentSessionId,
                    timestamp: new Date().toISOString()
                });
            }
            
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
                timeout: 120000  // FIXED 14.10.2025 - 120s для mistral-small-2503 (повільна але якісна модель)
            });

            const response = apiResponse.data.choices[0].message.content;

            // LOG RAW RESPONSE (ADDED 14.10.2025 - Debugging truncated responses)
            this.logger.system('mcp-todo', `[TODO] Raw LLM response length: ${response.length} chars`);
            this.logger.system('mcp-todo', `[TODO] Response preview: ${response.substring(0, 300)}...`);
            this.logger.system('mcp-todo', `[TODO] Response suffix: ...${response.substring(Math.max(0, response.length - 300))}`);

            const todo = this._parseTodoResponse(response, request);

            // Validate TODO structure
            this._validateTodo(todo);

            // Store active TODO
            this.activeTodos.set(todo.id, todo);

            this.logger.system('mcp-todo', `[TODO] Created ${todo.mode} TODO with ${todo.items.length} items (complexity: ${todo.complexity}/10)`);

            // Send chat message (ADDED 14.10.2025)
            const itemsList = todo.items.map((item, idx) => `  ${idx + 1}. ${item.action}`).join('\n');
            const todoMessage = `📋 ${todo.mode === 'extended' ? 'Розширений' : 'Стандартний'} план виконання (${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}):\n\n${itemsList}\n\n⏱️ Орієнтовний час виконання: ${Math.ceil(todo.items.length * 0.2)} ${todo.items.length === 1 ? 'хвилина' : 'хвилини'}`;
            this._sendChatMessage(todoMessage, 'info');

            // TTS feedback (optional - skip if TTS not available)
            if (this.tts && typeof this.tts.speak === 'function') {
                try {
                    // ENHANCED 14.10.2025 NIGHT - Atlas speaks about the plan with more personality
                    const itemCount = todo.items.length;
                    const taskDescription = this._extractTaskDescription(request);

                    let atlasPhrase;
                    if (itemCount === 1) {
                        atlasPhrase = `Розумію, ${taskDescription}. Один крок, виконую`;
                    } else if (itemCount <= 3) {
                        atlasPhrase = `Добре, ${taskDescription}. План з ${itemCount} кроків, починаю`;
                    } else {
                        atlasPhrase = `Зрозумів, ${taskDescription}. Складне завдання, ${itemCount} кроків. Приступаю`;
                    }

                    // FIXED 14.10.2025 NIGHT - Atlas voice for TODO announcement
                    await this._safeTTSSpeak(atlasPhrase, { mode: 'detailed', duration: 3000, agent: 'atlas' });
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

            // Send final summary to chat (ADDED 14.10.2025 NIGHT)
            const summaryEmoji = summary.success_rate === 100 ? '✅' : summary.success_rate >= 80 ? '⚠️' : '❌';
            this._sendChatMessage(
                `${summaryEmoji} Завершено: ${summary.success_rate}% успіху (${summary.completed}/${summary.total})`,
                summary.success_rate === 100 ? 'success' : summary.success_rate >= 80 ? 'info' : 'error'
            );

            // ENHANCED 14.10.2025 NIGHT - Atlas speaks about results with personality
            let atlasSummaryPhrase;
            if (summary.success_rate === 100) {
                atlasSummaryPhrase = `Все готово. Завдання виконано повністю за ${Math.round(duration)} секунд`;
            } else if (summary.success_rate >= 80) {
                atlasSummaryPhrase = `Майже готово. Виконано ${summary.success_rate} відсотків завдання`;
            } else if (summary.success_rate >= 50) {
                atlasSummaryPhrase = `Частково виконано. ${summary.success_rate} відсотків готово, є проблеми`;
            } else {
                atlasSummaryPhrase = `Виникли проблеми. Виконано тільки ${summary.success_rate} відсотків`;
            }

            // FIXED 14.10.2025 NIGHT - Atlas voice for final summary
            await this._safeTTSSpeak(atlasSummaryPhrase, { mode: 'detailed', duration: 3000, agent: 'atlas' });

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
                await this._safeTTSSpeak(plan.tts_phrase, { mode: 'quick', duration: 150, agent: 'tetyana' });

                // Stage 2.2: Execute Tools (Tetyana)
                const execution = await this.executeTools(plan, item);
                this._sendChatMessage(`✅ Виконано: "${item.action}"`, 'tetyana');
                await this._safeTTSSpeak(execution.tts_phrase, { mode: 'normal', duration: 800, agent: 'tetyana' });

                // Stage 2.3: Verify Item (Grisha)
                const verification = await this.verifyItem(item, execution);
                // FIXED 14.10.2025 NIGHT - Grisha's voice for verification
                await this._safeTTSSpeak(verification.tts_phrase, { mode: 'normal', duration: 800, agent: 'grisha' });

                // Check verification result
                if (verification.verified) {
                    item.status = 'completed';
                    item.execution_results = execution.results;
                    item.verification = verification;

                    this.logger.system('mcp-todo', `[TODO] ✅ Item ${item.id} completed on attempt ${attempt}`);
                    // Chat message already sent by verifyItem()

                    // FIXED 14.10.2025 NIGHT - Grisha confirms success
                    await this._safeTTSSpeak(verification.tts_phrase || '✅ Виконано', { mode: 'quick', duration: 100, agent: 'grisha' });

                    return { status: 'completed', attempts: attempt, item };
                }

                // Verification failed
                this.logger.warn(`[MCP-TODO] Item ${item.id} verification failed: ${verification.reason}`, { category: 'mcp-todo', component: 'mcp-todo' });
                // Chat message already sent by verifyItem()
                lastError = verification.reason;

                // Stage 3: Adjust TODO (if attempts remain)
                if (attempt < item.max_attempts) {
                    const adjustment = await this.adjustTodoItem(item, verification, attempt);

                    // Apply adjustments
                    Object.assign(item, adjustment.updated_todo_item);

                    // ENHANCED 14.10.2025 NIGHT - Atlas speaks about adjustment strategy
                    let atlasAdjustmentPhrase;
                    if (adjustment.strategy === 'retry') {
                        atlasAdjustmentPhrase = 'Пробую інший підхід';
                    } else if (adjustment.strategy === 'alternative_approach') {
                        atlasAdjustmentPhrase = 'Змінюю стратегію';
                    } else if (adjustment.strategy === 'skip') {
                        atlasAdjustmentPhrase = 'Пропускаю цей крок';
                    } else {
                        atlasAdjustmentPhrase = 'Коригую та повторюю';
                    }

                    await this._safeTTSSpeak(atlasAdjustmentPhrase, { mode: 'normal', duration: 1000 });
                } else {
                    // Final attempt failed
                    await this._safeTTSSpeak('Не вдалось виконати', { mode: 'normal', duration: 800 });
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
    async planTools(item, todo, options = {}) {
        this.logger.system('mcp-todo', `[TODO] Planning tools for item ${item.id}`);

        try {
            // DIAGNOSTIC: Check mcpManager before using
            if (!this.mcpManager) {
                this.logger.error(`[MCP-TODO] MCP Manager is null in planTools!`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo'
                });
                throw new Error('MCP Manager is not initialized (null) in planTools. Check DI registration and service instantiation.');
            }

            // OPTIMIZATION 15.10.2025 - Use compact tools summary instead of full schemas
            // Reduces prompt size from 8000+ to ~500 tokens
            let toolsSummary;
            if (options.toolsSummary) {
                // Use pre-generated summary from stage processor (preferred)
                toolsSummary = options.toolsSummary;
                this.logger.system('mcp-todo', `[TODO] Using provided tools summary (${toolsSummary.length} chars)`);
            } else {
                // Fallback: generate compact summary ourselves
                if (typeof this.mcpManager.getToolsSummary !== 'function') {
                    this.logger.error(`[MCP-TODO] MCP Manager missing getToolsSummary method!`, {
                        category: 'mcp-todo',
                        component: 'mcp-todo'
                    });
                    throw new Error('MCP Manager does not have getToolsSummary() method. Update to latest version.');
                }
                toolsSummary = this.mcpManager.getToolsSummary();
                this.logger.system('mcp-todo', `[TODO] Generated tools summary (${toolsSummary.length} chars)`);
            }

            // Import Tetyana Plan Tools prompt
            const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
            const planPrompt = MCP_PROMPTS.TETYANA_PLAN_TOOLS;

            // FIXED 15.10.2025 - Truncate execution_results to prevent 413 errors
            const previousItemsSummary = todo.items.slice(0, item.id - 1).map(i => {
                const summary = {
                    id: i.id,
                    action: i.action,
                    status: i.status
                };

                // Include truncated execution_results if available
                if (i.execution_results && i.execution_results.results) {
                    summary.results_summary = i.execution_results.results.map(r => {
                        const truncated = { tool: r.tool, success: r.success };
                        // Truncate content/text to 200 chars max
                        if (r.content && typeof r.content === 'string') {
                            truncated.content = r.content.substring(0, 200) + (r.content.length > 200 ? '...[truncated]' : '');
                        }
                        if (r.text && typeof r.text === 'string') {
                            truncated.text = r.text.substring(0, 200) + (r.text.length > 200 ? '...[truncated]' : '');
                        }
                        if (r.error) {
                            truncated.error = typeof r.error === 'string' ? r.error.substring(0, 100) : 'error';
                        }
                        return truncated;
                    });
                }

                return summary;
            });

            // OPTIMIZATION 15.10.2025 - Substitute {{AVAILABLE_TOOLS}} placeholder with compact summary
            let systemPrompt = planPrompt.systemPrompt || planPrompt.SYSTEM_PROMPT;
            if (systemPrompt.includes('{{AVAILABLE_TOOLS}}')) {
                systemPrompt = systemPrompt.replace('{{AVAILABLE_TOOLS}}', toolsSummary);
                this.logger.system('mcp-todo', `[TODO] Substituted {{AVAILABLE_TOOLS}} in prompt`);
            }

            const userMessage = `
TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}
Suggested Tools: ${item.tools_needed ? item.tools_needed.join(', ') : 'not specified'}
Previous items: ${JSON.stringify(previousItemsSummary, null, 2)}

Create precise MCP tool execution plan.
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

                // FIXED 14.10.2025 - Increase timeout for reasoning models
                // FIXED 15.10.2025 - Increase to 180s for ALL models (web scraping може бути повільним)
                const isReasoningModel = modelConfig.model.includes('reasoning') || modelConfig.model.includes('phi-4');
                const timeoutMs = isReasoningModel ? 180000 : 120000;  // 180s for reasoning, 120s for others

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
                    timeout: timeoutMs,
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
            let parameters = { ...(toolCall.parameters || {}) };

            try {
                this.logger.system('mcp-todo', `[TODO] Calling ${toolCall.tool} on ${toolCall.server}`);

                // Auto-correct AppleScript parameters if LLM used legacy field names
                if (toolCall.server === 'applescript' && toolCall.tool === 'applescript_execute') {
                    if (!parameters.code_snippet && typeof parameters.script === 'string') {
                        parameters.code_snippet = parameters.script;
                        this.logger.system('mcp-todo', '[TODO] Auto-filled code_snippet from script for applescript_execute');
                    }
                    if (!parameters.code_snippet && typeof parameters.code === 'string') {
                        parameters.code_snippet = parameters.code;
                        this.logger.system('mcp-todo', '[TODO] Auto-filled code_snippet from code for applescript_execute');
                    }
                    if (!parameters.language) {
                        parameters.language = 'applescript';
                        this.logger.system('mcp-todo', '[TODO] Defaulted AppleScript language parameter to "applescript"');
                    }
                }

                const result = await this.mcpManager.executeTool(
                    toolCall.server,
                    toolCall.tool,
                    parameters
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
                    metadata: { ...toolCall, parameters }
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
     * REDESIGNED 16.10.2025 - Grisha now EXECUTES MCP tools for verification (screenshot, file checks, etc)
     * 
     * @param {TodoItem} item - Item to verify
     * @param {Object} execution - Execution results from Tetyana
     * @returns {Promise<Object>} Verification result
     */
    async verifyItem(item, execution, options = {}) {
        this.logger.system('mcp-todo', `[TODO] 🔍 Grisha verifying item ${item.id}`);
        this._sendChatMessage(`🔍 Перевіряю: "${item.action}"`, 'grisha');

        try {
            // STEP 1: Grisha plans which verification tools to use (screenshot is mandatory)
            this.logger.system('mcp-todo', `[TODO] 📋 Grisha planning verification tools...`);
            const verificationPlan = await this._planVerificationTools(item, execution, options);
            
            this.logger.system('mcp-todo', `[TODO] 📋 Grisha planned ${verificationPlan.tool_calls.length} verification tools`);

            // STEP 2: Grisha executes verification tools
            this.logger.system('mcp-todo', `[TODO] 🔧 Grisha executing verification tools...`);
            const verificationResults = await this._executeVerificationTools(verificationPlan, item);
            
            this.logger.system('mcp-todo', `[TODO] 🔧 Verification tools executed: ${verificationResults.all_successful ? 'SUCCESS' : 'PARTIAL'}`);

            // STEP 3: Grisha analyzes results and makes final decision
            this.logger.system('mcp-todo', `[TODO] 🧠 Grisha analyzing verification results...`);
            const verification = await this._analyzeVerificationResults(item, execution, verificationResults, options);

            // Send chat message from Grisha
            if (verification.verified) {
                this._sendChatMessage(`✅ Перевірено: "${item.action}"\nПідтвердження: ${verification.reason}`, 'grisha');
            } else {
                this._sendChatMessage(`⚠️ Не підтверджено: "${item.action}"\nПричина: ${verification.reason}`, 'grisha');
            }

            this.logger.system('mcp-todo', `[TODO] 🔍 Grisha verification result for item ${item.id}: ${verification.verified ? '✅ PASS' : '❌ FAIL'}`);

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
            // FIXED 14.10.2025 - Handle ellipsis patterns (...) in JSON
            let cleanResponse = response;
            if (typeof cleanResponse === 'string') {
                // Remove markdown wrappers
                cleanResponse = cleanResponse
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim();
                // Remove JS-style comments (fix for LLM output)
                cleanResponse = cleanResponse.replace(/\/\*[\s\S]*?\*\//g, '');
            }
            const parsed = JSON.parse(cleanResponse);

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
            // FIXED 14.10.2025 - Better error logging with response preview
            this.logger.error(`[MCP-TODO] Failed to parse TODO response: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                errorName: error.name,
                responseLength: response?.length || 0,
                responsePreview: response?.substring(0, 200) || 'N/A',
                responseSuffix: response?.substring(Math.max(0, (response?.length || 0) - 100)) || 'N/A',
                stack: error.stack
            });
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
            // FIXED 14.10.2025 - Handle <think> tags from reasoning models (phi-4-reasoning)
            // FIXED 14.10.2025 - Aggressive extraction: handle unclosed tags and extract JSON
            // FIXED 14.10.2025 NIGHT - Ultra-aggressive: cut at <think>, then extract JSON
            let cleanResponse = response;
            if (typeof response === 'string') {
                // Step 1: ULTRA-AGGRESSIVE - cut everything from <think> onwards
                // phi-4-reasoning sometimes doesn't close tags - just remove everything after <think>
                const thinkIndex = response.indexOf('<think>');
                if (thinkIndex !== -1) {
                    // Cut before <think> - reasoning models put <think> FIRST
                    cleanResponse = response.substring(0, thinkIndex).trim();
                } else {
                    cleanResponse = response;
                }

                // Step 2: Clean markdown wrappers
                cleanResponse = cleanResponse
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Step 3: Aggressive JSON extraction - find first { to last }
                // This handles cases where LLM adds text before/after JSON
                const firstBrace = cleanResponse.indexOf('{');
                const lastBrace = cleanResponse.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
                } else {
                    // No JSON found in response - try to extract from original
                    // Some models put JSON AFTER <think>, so try original response too
                    const origFirstBrace = response.indexOf('{');
                    const origLastBrace = response.lastIndexOf('}');

                    if (origFirstBrace !== -1 && origLastBrace !== -1 && origLastBrace > origFirstBrace) {
                        cleanResponse = response.substring(origFirstBrace, origLastBrace + 1);
                    } else {
                        throw new Error('No JSON object found in response (no curly braces)');
                    }
                }
            }

            let parsed;
            if (typeof cleanResponse === 'string') {
                try {
                    parsed = JSON.parse(cleanResponse);
                } catch (parseError) {
                    // FIXED 15.10.2025 - ALWAYS attempt sanitization on ANY parse error
                    // Previous logic only sanitized for specific error patterns, missing some cases
                    this.logger.warn(`[MCP-TODO] Initial JSON parse failed: ${parseError.message}. Attempting sanitization...`, {
                        category: 'mcp-todo',
                        component: 'mcp-todo',
                        errorPosition: parseError.message.match(/position (\d+)/)?.[1] || 'unknown'
                    });
                    
                    try {
                        const sanitized = this._sanitizeJsonString(cleanResponse);
                        parsed = JSON.parse(sanitized);
                        this.logger.warn('[MCP-TODO] ✅ JSON sanitization successful for tool plan response', {
                            category: 'mcp-todo',
                            component: 'mcp-todo',
                            originalError: parseError.message,
                            originalLength: cleanResponse.length,
                            sanitizedLength: sanitized.length
                        });
                    } catch (sanitizedError) {
                        // Log both original and sanitized responses for debugging
                        this.logger.error(`[MCP-TODO] ❌ JSON sanitization also failed. Original error: ${parseError.message}. Sanitized error: ${sanitizedError.message}`, {
                            category: 'mcp-todo',
                            component: 'mcp-todo',
                            originalResponse: cleanResponse.substring(0, 500),
                            originalError: parseError.message,
                            sanitizedError: sanitizedError.message
                        });
                        sanitizedError.originalMessage = parseError.message;
                        throw sanitizedError;
                    }
                }
            } else {
                parsed = cleanResponse;
            }
            return {
                tool_calls: parsed.tool_calls || [],
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            // Truncate long responses for logging
            const truncatedResponse = typeof response === 'string' && response.length > 500
                ? response.substring(0, 500) + '... [truncated]'
                : response;
            this.logger.error(`[MCP-TODO] Failed to parse tool plan. Raw response: ${truncatedResponse}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                parseError: error.message
            });
            throw new Error(`Failed to parse tool plan: ${error.message}`);
        }
    }

    _parseVerification(response) {
        try {
            // FIXED 13.10.2025 - Clean markdown wrappers before parsing
            // FIXED 14.10.2025 - Handle <think> tags from reasoning models
            // FIXED 14.10.2025 - Aggressive extraction: handle unclosed tags
            // FIXED 14.10.2025 NIGHT - Ultra-aggressive: cut at <think>, then extract JSON
            let cleanResponse = response;
            if (typeof response === 'string') {
                // Step 1: ULTRA-AGGRESSIVE - cut everything from <think> onwards
                const thinkIndex = response.indexOf('<think>');
                if (thinkIndex !== -1) {
                    cleanResponse = response.substring(0, thinkIndex).trim();
                } else {
                    cleanResponse = response;
                }

                // Step 2: Clean markdown wrappers
                cleanResponse = cleanResponse
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Step 3: Aggressive JSON extraction - find first { to last }
                const firstBrace = cleanResponse.indexOf('{');
                const lastBrace = cleanResponse.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
                } else {
                    // Try original response
                    const origFirstBrace = response.indexOf('{');
                    const origLastBrace = response.lastIndexOf('}');

                    if (origFirstBrace !== -1 && origLastBrace !== -1 && origLastBrace > origFirstBrace) {
                        cleanResponse = response.substring(origFirstBrace, origLastBrace + 1);
                    } else {
                        throw new Error('No JSON object found in response (no curly braces)');
                    }
                }
            }

            // FIXED 15.10.2025 - Use sanitization logic like _parseToolPlan
            let parsed;
            if (typeof cleanResponse === 'string') {
                try {
                    parsed = JSON.parse(cleanResponse);
                } catch (parseError) {
                    this.logger.warn(`[MCP-TODO] Verification JSON parse failed: ${parseError.message}. Attempting sanitization...`, {
                        category: 'mcp-todo',
                        component: 'mcp-todo'
                    });
                    
                    try {
                        const sanitized = this._sanitizeJsonString(cleanResponse);
                        parsed = JSON.parse(sanitized);
                        this.logger.warn('[MCP-TODO] ✅ Verification JSON sanitization successful', {
                            category: 'mcp-todo',
                            component: 'mcp-todo'
                        });
                    } catch (sanitizedError) {
                        this.logger.error(`[MCP-TODO] ❌ Verification JSON sanitization failed: ${sanitizedError.message}`, {
                            category: 'mcp-todo',
                            component: 'mcp-todo',
                            originalResponse: cleanResponse.substring(0, 500)
                        });
                        sanitizedError.originalMessage = parseError.message;
                        throw sanitizedError;
                    }
                }
            } else {
                parsed = cleanResponse;
            }
            
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
            throw new Error(`Failed to parse verification: ${error.message}`);
        }
    }

    _parseAdjustment(response) {
        try {
            // FIXED 13.10.2025 - Clean markdown wrappers before parsing
            // FIXED 14.10.2025 - Extract JSON from text if LLM added explanation
            // FIXED 14.10.2025 - Aggressive extraction: handle unclosed tags
            // FIXED 14.10.2025 NIGHT - Ultra-aggressive: cut at <think>, then extract JSON
            let cleanResponse = response;
            if (typeof response === 'string') {
                // Step 1: ULTRA-AGGRESSIVE - cut everything from <think> onwards
                const thinkIndex = response.indexOf('<think>');
                if (thinkIndex !== -1) {
                    cleanResponse = response.substring(0, thinkIndex).trim();
                } else {
                    cleanResponse = response;
                }

                // Step 2: Clean markdown wrappers
                cleanResponse = cleanResponse
                    .replace(/^```json\s*/i, '')  // Remove opening ```json
                    .replace(/^```\s*/i, '')       // Remove opening ```
                    .replace(/\s*```$/i, '')       // Remove closing ```
                    .trim();

                // Step 3: Aggressive JSON extraction - find first { to last }
                const firstBrace = cleanResponse.indexOf('{');
                const lastBrace = cleanResponse.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
                } else {
                    // Fallback: Try original response
                    const origFirstBrace = response.indexOf('{');
                    const origLastBrace = response.lastIndexOf('}');

                    if (origFirstBrace !== -1 && origLastBrace !== -1 && origLastBrace > origFirstBrace) {
                        cleanResponse = response.substring(origFirstBrace, origLastBrace + 1);
                    } else {
                        throw new Error('No JSON object found in response (no curly braces)');
                    }
                }
            }

            // FIXED 15.10.2025 - Use sanitization logic like _parseToolPlan
            let parsed;
            if (typeof cleanResponse === 'string') {
                try {
                    parsed = JSON.parse(cleanResponse);
                } catch (parseError) {
                    this.logger.warn(`[MCP-TODO] Adjustment JSON parse failed: ${parseError.message}. Attempting sanitization...`, {
                        category: 'mcp-todo',
                        component: 'mcp-todo'
                    });
                    
                    try {
                        const sanitized = this._sanitizeJsonString(cleanResponse);
                        parsed = JSON.parse(sanitized);
                        this.logger.warn('[MCP-TODO] ✅ Adjustment JSON sanitization successful', {
                            category: 'mcp-todo',
                            component: 'mcp-todo'
                        });
                    } catch (sanitizedError) {
                        this.logger.error(`[MCP-TODO] ❌ Adjustment JSON sanitization failed: ${sanitizedError.message}`, {
                            category: 'mcp-todo',
                            component: 'mcp-todo',
                            originalResponse: cleanResponse.substring(0, 500)
                        });
                        sanitizedError.originalMessage = parseError.message;
                        throw sanitizedError;
                    }
                }
            } else {
                parsed = cleanResponse;
            }
            
            return {
                strategy: parsed.strategy || 'retry',
                updated_todo_item: parsed.updated_todo_item || {},
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            const truncatedResponse = typeof response === 'string' && response.length > 500
                ? response.substring(0, 500) + '... [truncated]'
                : response;
            this.logger.error(`[MCP-TODO] Failed to parse adjustment. Raw response: ${truncatedResponse}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                parseError: error.message
            });
            throw new Error(`Failed to parse adjustment: ${error.message}`);
        }
    }

    _sanitizeJsonString(rawPayload) {
        if (typeof rawPayload !== 'string') {
            throw new TypeError('Expected string payload for JSON sanitization');
        }

        let sanitized = rawPayload.trim()
            .replace(/\uFEFF/g, '')
            .replace(/['‛'`´]/g, "'")
            .replace(/[""]/g, '"');

        // Quote property names that are missing double quotes.
        sanitized = sanitized.replace(/([,{]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');

        // ENHANCED 15.10.2025 - More aggressive trailing comma removal
        // Remove trailing commas before closing braces/brackets (handles newlines and multiple spaces)
        sanitized = sanitized.replace(/,(\s*[\r\n]+\s*)([}\]])/g, '$1$2');  // comma before newline and }]
        sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');  // comma directly before }]
        
        // ADDED 15.10.2025 - Remove multiple consecutive commas
        sanitized = sanitized.replace(/,\s*,+/g, ',');
        
        // ADDED 15.10.2025 - Remove trailing commas at end of lines
        sanitized = sanitized.replace(/,(\s*[\r\n])/g, '$1');

        try {
            JSON.parse(sanitized);
            return sanitized;
        } catch (firstError) {
            // Attempt to convert single-quoted strings to double-quoted strings.
            const withDoubleQuotedStrings = sanitized.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
                const escaped = inner
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"');
                return `: "${escaped}"`;
            }).replace(/\[\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
                const escaped = inner
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"');
                return `[ "${escaped}"`;
            }).replace(/,\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
                const escaped = inner
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"');
                return `, "${escaped}"`;
            });

            try {
                JSON.parse(withDoubleQuotedStrings);
                return withDoubleQuotedStrings;
            } catch (secondError) {
                try {
                    const evaluated = vm.runInNewContext(`(${sanitized})`, {}, { timeout: 50 });
                    return JSON.stringify(evaluated);
                } catch (vmError) {
                    secondError.originalError = firstError.message;
                    secondError.vmError = vmError.message;
                    throw secondError;
                }
            }
        }
    }

    _generatePlanTTS(plan, item) {
        // ENHANCED 14.10.2025 NIGHT - More informative TTS phrases
        const toolCount = plan.tool_calls.length;
        const actionVerb = item.action.split(' ')[0];

        // Tetyana speaks about what she's planning to do
        if (toolCount === 1) {
            return `${actionVerb}`;
        } else {
            return `${actionVerb}, ${toolCount} кроки`;
        }
    }

    _generateExecutionTTS(results, item, allSuccessful) {
        // ENHANCED 14.10.2025 NIGHT - More informative Tetyana execution phrases
        if (allSuccessful) {
            // Extract key result with more context
            const mainAction = item.action.toLowerCase();

            // Specific action feedback
            if (mainAction.includes('створ') && mainAction.includes('файл')) {
                return 'Файл створено';
            }
            if (mainAction.includes('відкр') && mainAction.includes('калькулятор')) {
                return 'Калькулятор відкрито';
            }
            if (mainAction.includes('відкр') && mainAction.includes('браузер')) {
                return 'Браузер відкрито';
            }
            if (mainAction.includes('збер')) {
                return 'Дані збережено';
            }
            if (mainAction.includes('знайд')) {
                return 'Знайдено';
            }
            if (mainAction.includes('введ') || mainAction.includes('ввод')) {
                return 'Введено';
            }
            if (mainAction.includes('скріншот') || mainAction.includes('screenshot')) {
                return 'Скріншот зроблено';
            }

            // Generic successful execution
            return 'Виконано';
        }

        // Partial success - be specific
        const successCount = results.filter(r => r.success).length;
        return `Виконано ${successCount} з ${results.length}`;
    }

    /**
     * Safe TTS helper - speaks only if TTS is available
     * FIXED 13.10.2025 - Added null-safety for TTS
     * FIXED 14.10.2025 NIGHT - Pass wsManager for frontend TTS delivery
     * 
     * @param {string} phrase - Text to speak
     * @param {Object} options - TTS options (mode, duration)
     * @param {string} [options.agent='tetyana'] - Agent name for voice
     * @returns {Promise<void>}
     */
    async _safeTTSSpeak(phrase, options = {}) {
        // FIXED 14.10.2025 NIGHT v2 - TTSSyncManager has wsManager internally now
        const ttsOptions = {
            ...options,
            agent: options.agent || 'tetyana'  // Default to Tetyana for execution
        };

        // Debug TTS availability (ADDED 15.10.2025)
        this.logger.system('mcp-todo', `[TODO] 🔍 TTS check: tts=${!!this.tts}, speak=${this.tts ? typeof this.tts.speak : 'N/A'}`);

        // REMOVED 16.10.2025 - Don't send chat messages from TTS, they're sent by verifyItem/executeTools
        // Chat messages are now sent by the methods that call _safeTTSSpeak

        if (this.tts && typeof this.tts.speak === 'function') {
            try {
                this.logger.system('mcp-todo', `[TODO] 🔊 Requesting TTS: "${phrase}" (agent: ${ttsOptions.agent})`);
                await this.tts.speak(phrase, ttsOptions);
                this.logger.system('mcp-todo', `[TODO] ✅ TTS completed successfully`);
            } catch (ttsError) {
                this.logger.warn(`[MCP-TODO] TTS failed: ${ttsError.message}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    stack: ttsError.stack
                });
            }
        } else {
            this.logger.warn(`[MCP-TODO] TTS not available - tts=${!!this.tts}, speak=${this.tts ? typeof this.tts.speak : 'N/A'}`, {
                category: 'mcp-todo',
                component: 'mcp-todo'
            });
        }
        // Silently skip if TTS not available
    }

    /**
     * Extract short task description for Atlas TTS
     * ADDED 14.10.2025 NIGHT - Atlas speaks more naturally
     * 
     * @param {string} request - User's original request
     * @returns {string} Short task description
     */
    _extractTaskDescription(request) {
        const lowerRequest = request.toLowerCase();

        // Extract main action keywords
        if (lowerRequest.includes('калькулятор')) return 'калькулятор';
        if (lowerRequest.includes('браузер')) return 'браузер';
        if (lowerRequest.includes('файл')) return 'робота з файлами';
        if (lowerRequest.includes('скріншот')) return 'скріншот';
        if (lowerRequest.includes('знайд')) return 'пошук';
        if (lowerRequest.includes('створ')) return 'створення';
        if (lowerRequest.includes('відкр')) return 'відкриття';
        if (lowerRequest.includes('збер')) return 'збереження';

        // Fallback: take first 3-4 words
        const words = request.split(' ').slice(0, 4).join(' ');
        return words.length > 30 ? words.substring(0, 30) + '...' : words;
    }

    _getPluralForm(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;

        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
    }

    /**
     * Plan verification tools for Grisha (NEW 16.10.2025)
     * Grisha decides which MCP tools to use for verification (screenshot is mandatory)
     * 
     * @param {TodoItem} item - Item being verified
     * @param {Object} execution - Tetyana's execution results
     * @param {Object} options - Options (toolsSummary, etc)
     * @returns {Promise<Object>} Verification tool plan
     * @private
     */
    async _planVerificationTools(item, execution, options = {}) {
        this.logger.system('mcp-todo', `[TODO] 🔍 Grisha planning verification tools for item ${item.id}`);

        try {
            // Get tools summary
            const toolsSummary = options.toolsSummary || this.mcpManager.getToolsSummary();

            // Build prompt for Grisha to plan verification tools
            const planPrompt = `Ти Гриша - верифікатор. Визнач які MCP інструменти потрібні для перевірки виконання.

⚠️ ОБОВ'ЯЗКОВО: ЗАВЖДИ включай screenshot для візуальної перевірки!

TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}
Tetyana's Execution Results: ${JSON.stringify(execution.results, null, 2)}

Доступні MCP інструменти:
${toolsSummary}

Обери МІНІМАЛЬНИЙ набір інструментів для перевірки. Screenshot ОБОВ'ЯЗКОВИЙ.

Приклади:
- Для "Відкрити калькулятор" → [{"server": "shell", "tool": "run_shell_command", "parameters": {"command": "screencapture -x /tmp/verify_calc.png"}}]
- Для "Створити файл" → [{"server": "filesystem", "tool": "read_file", "parameters": {"path": "..."}}]

Return ONLY JSON:
{
  "tool_calls": [
    {"server": "...", "tool": "...", "parameters": {...}, "reasoning": "..."}
  ],
  "reasoning": "...",
  "tts_phrase": "Перевіряю докази"
}`;

            await this._waitForRateLimit();

            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('verify_item');
            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only API. Return ONLY valid JSON, no markdown, no explanations.' },
                    { role: 'user', content: planPrompt }
                ],
                temperature: 0.3,  // Lower temperature for precise tool selection
                max_tokens: 2000
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });

            const response = apiResponse.data.choices[0].message.content;
            const plan = this._parseToolPlan(response);  // Reuse existing parser

            this.logger.system('mcp-todo', `[TODO] 🔍 Grisha planned ${plan.tool_calls.length} verification tools`);

            return plan;

        } catch (error) {
            this.logger.error(`[MCP-TODO] Grisha failed to plan verification tools: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                stack: error.stack
            });
            throw new Error(`Verification tool planning failed: ${error.message}`);
        }
    }

    /**
     * Execute verification tools for Grisha (NEW 16.10.2025)
     * Grisha executes MCP tools (screenshot, file checks, etc) to gather evidence
     * 
     * @param {Object} plan - Verification tool plan
     * @param {TodoItem} item - Item being verified
     * @returns {Promise<Object>} Verification execution results
     * @private
     */
    async _executeVerificationTools(plan, item) {
        this.logger.system('mcp-todo', `[TODO] 🔧 Grisha executing ${plan.tool_calls.length} verification tools`);

        const results = [];
        let allSuccessful = true;

        for (const toolCall of plan.tool_calls) {
            try {
                this.logger.system('mcp-todo', `[TODO] 🔧 Grisha calling ${toolCall.tool} on ${toolCall.server}`);

                const result = await this.mcpManager.executeTool(
                    toolCall.server,
                    toolCall.tool,
                    toolCall.parameters || {}
                );

                results.push({
                    tool: toolCall.tool,
                    server: toolCall.server,
                    success: true,
                    result
                });

                this.logger.system('mcp-todo', `[TODO] ✅ Grisha tool ${toolCall.tool} succeeded`);

            } catch (error) {
                this.logger.error(`[MCP-TODO] Grisha tool ${toolCall.tool} failed: ${error.message}`, {
                    category: 'mcp-todo',
                    component: 'mcp-todo',
                    toolCall,
                    stack: error.stack
                });

                results.push({
                    tool: toolCall.tool,
                    server: toolCall.server,
                    success: false,
                    error: error.message
                });

                allSuccessful = false;
            }
        }

        return {
            results,
            all_successful: allSuccessful
        };
    }

    /**
     * Analyze verification results and make final decision (NEW 16.10.2025)
     * Grisha analyzes evidence from MCP tools and decides if item is verified
     * 
     * @param {TodoItem} item - Item being verified
     * @param {Object} execution - Tetyana's execution results
     * @param {Object} verificationResults - Results from Grisha's verification tools
     * @param {Object} options - Options
     * @returns {Promise<Object>} Final verification decision
     * @private
     */
    async _analyzeVerificationResults(item, execution, verificationResults, options = {}) {
        this.logger.system('mcp-todo', `[TODO] 🧠 Grisha analyzing verification evidence`);

        try {
            // Truncate results to avoid token limits
            const truncatedExecution = execution.results.map(result => {
                const truncated = { ...result };
                if (truncated.content && typeof truncated.content === 'string' && truncated.content.length > 300) {
                    truncated.content = truncated.content.substring(0, 300) + '... [truncated]';
                }
                if (truncated.error && typeof truncated.error === 'string' && truncated.error.length > 200) {
                    truncated.error = truncated.error.substring(0, 200) + '... [truncated]';
                }
                return truncated;
            });

            const truncatedVerification = verificationResults.results.map(result => {
                const truncated = { ...result };
                if (truncated.result && typeof truncated.result === 'object') {
                    // Truncate screenshot paths and large content
                    if (truncated.result.content && typeof truncated.result.content === 'string' && truncated.result.content.length > 500) {
                        truncated.result.content = truncated.result.content.substring(0, 500) + '... [truncated]';
                    }
                }
                return truncated;
            });

            const analysisPrompt = `Ти Гриша - верифікатор. Проаналізуй докази та визнач чи виконано завдання.

TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}

Tetyana's Execution Results:
${JSON.stringify(truncatedExecution, null, 2)}

Grisha's Verification Evidence (screenshot, file checks, etc):
${JSON.stringify(truncatedVerification, null, 2)}

⚠️ КРИТИЧНО ВАЖЛИВІ ПРАВИЛА ВЕРИФІКАЦІЇ:

1. **Якщо Tetyana's execution показує success=true + Grisha's tools виконані успішно:**
   → verified=true (ДОВІРЯЙ інструментам!)
   
2. **Якщо Tetyana's execution показує error АБО Grisha's tools показують error:**
   → verified=false
   
3. **Якщо screenshot/file check показують КОНКРЕТНУ помилку:**
   → verified=false + опиши помилку

4. **Якщо ВСІ інструменти виконані успішно (success=true):**
   → verified=true (НЕ вигадуй проблеми!)

ПРИКЛАДИ:

✅ ПРАВИЛЬНО:
Tetyana: applescript_execute success=true
Grisha: playwright_screenshot success=true
→ {"verified": true, "reason": "Калькулятор відкрито успішно"}

❌ НЕПРАВИЛЬНО:
Tetyana: applescript_execute success=true
Grisha: playwright_screenshot success=true
→ {"verified": false, "reason": "Немає доказів"} ← ЦЕ ПОМИЛКА! Інструменти успішні!

Return ONLY JSON:
{
  "verified": boolean,
  "reason": "string",
  "evidence": {...},
  "tts_phrase": "Підтверджено" або "Не підтверджено"
}`;

            await this._waitForRateLimit();

            const modelConfig = MCP_MODEL_CONFIG.getStageConfig('verify_item');
            const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
                model: modelConfig.model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only API. Return ONLY valid JSON, no markdown, no explanations.' },
                    { role: 'user', content: analysisPrompt }
                ],
                temperature: 0.2,  // Very low temperature for precise verification
                max_tokens: 1000
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });

            const response = apiResponse.data.choices[0].message.content;
            const verification = this._parseVerification(response);

            // Add TTS phrase if not provided
            if (!verification.tts_phrase) {
                verification.tts_phrase = verification.verified ? 'Підтверджено' : 'Не підтверджено';
            }

            this.logger.system('mcp-todo', `[TODO] 🧠 Grisha analysis: ${verification.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}`);

            return verification;

        } catch (error) {
            this.logger.error(`[MCP-TODO] Grisha failed to analyze verification results: ${error.message}`, {
                category: 'mcp-todo',
                component: 'mcp-todo',
                stack: error.stack
            });
            throw new Error(`Verification analysis failed: ${error.message}`);
        }
    }
}

export default MCPTodoManager;
