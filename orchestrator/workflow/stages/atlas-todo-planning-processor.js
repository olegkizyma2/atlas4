/**
 * @fileoverview Atlas TODO Planning Processor (Stage 1-MCP)
 * Creates structured TODO lists from user requests using Atlas prompts
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';

/**
 * Atlas TODO Planning Processor
 * 
 * Analyzes user requests and creates structured TODO lists with:
 * - Standard mode (1-3 items) for simple tasks
 * - Extended mode (4-10 items) for complex tasks
 * - Dependencies between items
 * - TTS phrases for each item
 */
export class AtlasTodoPlanningProcessor {
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
     * Execute TODO planning
     * 
     * @param {Object} context - Stage context
     * @param {string} context.userMessage - User request
     * @param {Object} [context.session] - Session context
     * @param {Object} [context.previousResults] - Results from previous stages
     * @returns {Promise<Object>} Planning result with TODO list
     */
    async execute(context) {
        this.logger.system('atlas-todo-planning', '[STAGE-1-MCP] 🎯 Starting TODO planning...');

        const { userMessage, session, previousResults } = context;

        try {
            // Build context for TODO creation
            const planningContext = this._buildPlanningContext(userMessage, session, previousResults);

            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP] Request: "${userMessage}"`);
            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP] Context: ${JSON.stringify(planningContext)}`);

            // Create TODO using MCPTodoManager
            const todo = await this.mcpTodoManager.createTodo(userMessage, planningContext);

            if (!todo) {
                throw new Error('MCPTodoManager.createTodo() returned null/undefined');
            }

            // Log TODO details
            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP] ✅ TODO created: ${todo.id}`);
            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP]    Mode: ${todo.mode}`);
            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP]    Complexity: ${todo.complexity}/10`);
            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP]    Items: ${todo.items.length}`);

            // Log each item
            for (const item of todo.items) {
                this.logger.system('atlas-todo-planning', `[STAGE-1-MCP]      ${item.id}. ${item.action}`);
                
                if (item.dependencies && item.dependencies.length > 0) {
                    this.logger.system('atlas-todo-planning', `[STAGE-1-MCP]         Dependencies: ${item.dependencies.join(', ')}`);
                }
            }

            // Generate summary for response
            const summary = this._generatePlanSummary(todo);

            this.logger.system('atlas-todo-planning', `[STAGE-1-MCP] ✅ Planning complete`);

            return {
                success: true,
                todo,
                summary,
                metadata: {
                    mode: todo.mode,
                    complexity: todo.complexity,
                    itemCount: todo.items.length,
                    hasDependencies: todo.items.some(item => item.dependencies && item.dependencies.length > 0),
                    estimatedDuration: this._estimateDuration(todo),
                    prompt: MCP_PROMPTS.ATLAS_TODO_PLANNING.name
                }
            };

        } catch (error) {
            this.logger.error('atlas-todo-planning', `[STAGE-1-MCP] ❌ Planning failed: ${error.message}`);
            this.logger.error('atlas-todo-planning', error.stack);

            return {
                success: false,
                error: error.message,
                summary: `⚠️ Не вдалося створити план виконання: ${error.message}`,
                metadata: {
                    errorType: error.name,
                    stage: 'planning'
                }
            };
        }
    }

    /**
     * Build context for TODO planning
     * 
     * @param {string} request - User request
     * @param {Object} session - Session data
     * @param {Object} previousResults - Previous stage results
     * @returns {Object} Planning context
     * @private
     */
    _buildPlanningContext(request, session, previousResults) {
        const context = {
            request,
            timestamp: new Date().toISOString()
        };

        // Add session context if available
        if (session) {
            context.sessionId = session.id;
            
            // Add relevant conversation history (last 3 messages)
            if (session.chatThread && session.chatThread.messages) {
                const recentMessages = session.chatThread.messages.slice(-3);
                context.recentContext = recentMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content.substring(0, 100) // Truncate for brevity
                }));
            }
        }

        // Add previous results if this is a retry
        if (previousResults && previousResults.attemptNumber) {
            context.retry = {
                attemptNumber: previousResults.attemptNumber,
                previousError: previousResults.error,
                previousApproach: previousResults.approach
            };
        }

        return context;
    }

    /**
     * Generate human-readable summary of TODO plan
     * 
     * @param {Object} todo - TODO list object
     * @returns {string} Summary text
     * @private
     */
    _generatePlanSummary(todo) {
        const lines = [];

        // Header
        if (todo.mode === 'standard') {
            lines.push(`📋 План виконання (${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}):`);
        } else {
            lines.push(`📋 Розширений план виконання (${todo.items.length} ${this._getPluralForm(todo.items.length, 'пункт', 'пункти', 'пунктів')}):`);
        }

        lines.push('');

        // List items
        for (const item of todo.items) {
            let line = `  ${item.id}. ${item.action}`;
            
            if (item.dependencies && item.dependencies.length > 0) {
                line += ` (залежить від: ${item.dependencies.join(', ')})`;
            }
            
            lines.push(line);
        }

        lines.push('');

        // Footer
        const duration = this._estimateDuration(todo);
        lines.push(`⏱️ Орієнтовний час виконання: ${duration}`);

        return lines.join('\n');
    }

    /**
     * Estimate execution duration based on TODO complexity
     * 
     * @param {Object} todo - TODO list
     * @returns {string} Duration estimate
     * @private
     */
    _estimateDuration(todo) {
        const itemCount = todo.items.length;
        const complexity = todo.complexity;

        // Base time per item (seconds)
        let baseTime = 5;

        // Adjust for complexity (1-10)
        const complexityMultiplier = 1 + (complexity / 10);

        // Calculate total seconds
        const totalSeconds = Math.ceil(itemCount * baseTime * complexityMultiplier);

        // Format as human-readable
        if (totalSeconds < 60) {
            return `${totalSeconds} секунд`;
        } else if (totalSeconds < 300) {
            const minutes = Math.ceil(totalSeconds / 60);
            return `${minutes} ${this._getPluralForm(minutes, 'хвилина', 'хвилини', 'хвилин')}`;
        } else {
            const minutes = Math.ceil(totalSeconds / 60);
            return `${minutes} хвилин`;
        }
    }

    /**
     * Get correct plural form for Ukrainian words
     * 
     * @param {number} count - Number
     * @param {string} one - Form for 1 (пункт)
     * @param {string} few - Form for 2-4 (пункти)
     * @param {string} many - Form for 5+ (пунктів)
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

    /**
     * Validate TODO structure
     * 
     * @param {Object} todo - TODO to validate
     * @returns {boolean} Valid or not
     * @private
     */
    _validateTodo(todo) {
        if (!todo || typeof todo !== 'object') {
            this.logger.error('atlas-todo-planning', '[STAGE-1-MCP] Invalid TODO: not an object');
            return false;
        }

        if (!Array.isArray(todo.items) || todo.items.length === 0) {
            this.logger.error('atlas-todo-planning', '[STAGE-1-MCP] Invalid TODO: items must be non-empty array');
            return false;
        }

        if (!todo.mode || !['standard', 'extended'].includes(todo.mode)) {
            this.logger.error('atlas-todo-planning', `[STAGE-1-MCP] Invalid TODO: mode must be 'standard' or 'extended', got '${todo.mode}'`);
            return false;
        }

        // All checks passed
        return true;
    }
}

export default AtlasTodoPlanningProcessor;
