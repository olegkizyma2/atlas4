/**
 * @fileoverview Tetyana Plan Tools Processor (Stage 2.1-MCP)
 * Selects optimal MCP tools for TODO item execution
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';

/**
 * Tetyana Plan Tools Processor
 * 
 * Analyzes TODO items and selects optimal MCP tools from available servers:
 * - filesystem (read/write/list/create/delete/move)
 * - playwright (browser operations, scraping)
 * - computercontroller (system operations, screenshots)
 */
export class TetyanaПlanToolsProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpTodoManager - MCPTodoManager instance
     * @param {Object} dependencies.mcpManager - MCPManager instance for available tools
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpTodoManager, mcpManager, logger: loggerInstance }) {
        this.mcpTodoManager = mcpTodoManager;
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute tool planning for TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item being planned
     * @param {Object} context.todo - Full TODO list
     * @param {Object} [context.executionContext] - Execution context (results so far)
     * @returns {Promise<Object>} Planning result with tool calls
     */
    async execute(context) {
        this.logger.system('tetyana-plan-tools', '[STAGE-2.1-MCP] 🛠️ Planning tool selection...');

        const { currentItem, todo, executionContext } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for tool planning');
        }

        try {
            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] Item: ${currentItem.id}. ${currentItem.action}`);

            // Get available MCP tools + compact summary for prompt
            const availableTools = await this._getAvailableTools();
            const toolsSummary = this.mcpManager.getToolsSummary();

            // Log server names (NOT all tool instances)
            const uniqueServers = [...new Set(availableTools.map(t => t.server))];
            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] Available: ${uniqueServers.join(', ')} (${availableTools.length} tools)`);

            // OPTIMIZATION (15.10.2025): Pass toolsSummary to planTools for {{AVAILABLE_TOOLS}} substitution
            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] Tools summary:\n${toolsSummary}`);

            // Plan tools using MCPTodoManager with dynamic tools list
            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] Calling mcpTodoManager.planTools()...`);

            const plan = await this.mcpTodoManager.planTools(currentItem, todo, { toolsSummary });

            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] planTools() returned: ${JSON.stringify(plan).substring(0, 300)}`);

            if (!plan || !plan.tool_calls) {
                throw new Error('MCPTodoManager.planTools() returned invalid plan');
            }

            // Validate plan against available tools (CRITICAL)
            const validation = this.mcpManager.validateToolCalls(plan.tool_calls);

            if (!validation.valid) {
                this.logger.warn(`[STAGE-2.1-MCP] ⚠️ Plan validation FAILED:`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });
                this.logger.warn(`[STAGE-2.1-MCP]   Errors: ${validation.errors.join(', ')}`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });

                if (validation.suggestions.length > 0) {
                    this.logger.warn(`[STAGE-2.1-MCP]   Suggestions: ${validation.suggestions.join(', ')}`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });
                }

                // Return error with suggestions for LLM to retry
                return {
                    success: false,
                    error: 'Invalid tools in plan',
                    validationErrors: validation.errors,
                    suggestions: validation.suggestions,
                    summary: `⚠️ План містить невалідні інструменти. ${validation.suggestions[0] || ''}`,
                    metadata: {
                        itemId: currentItem.id,
                        stage: 'tool-planning',
                        needsRetry: true
                    }
                };
            }

            // Log planned tools
            this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP] ✅ Planned ${plan.tool_calls.length} tool call(s):`);

            for (const call of plan.tool_calls) {
                this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP]    ${call.server}__${call.tool}`);
                this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP]      Parameters: ${JSON.stringify(call.parameters)}`);

                if (call.reasoning) {
                    this.logger.system('tetyana-plan-tools', `[STAGE-2.1-MCP]      Reasoning: ${call.reasoning}`);
                }
            }

            // Generate summary
            const summary = this._generatePlanSummary(currentItem, plan);

            return {
                success: true,
                plan,
                summary,
                metadata: {
                    itemId: currentItem.id,
                    toolCount: plan.tool_calls.length,
                    servers: [...new Set(plan.tool_calls.map(c => c.server))],
                    validation,
                    prompt: MCP_PROMPTS.TETYANA_PLAN_TOOLS.name,
                    optimized: true  // NEW: mark as using optimized prompt
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-2.1-MCP] ❌ Tool planning failed: ${error.message}`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });
            this.logger.error(`Stack trace: ${error.stack}`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });

            return {
                success: false,
                error: error.message,
                summary: `⚠️ Не вдалося спланувати інструменти для "${currentItem.action}": ${error.message}`,
                metadata: {
                    itemId: currentItem.id,
                    errorType: error.name,
                    stage: 'tool-planning'
                }
            };
        }
    }

    /**
     * Get available MCP tools from all servers
     * 
     * @returns {Promise<Array>} Available tools
     * @private
     */
    async _getAvailableTools() {
        try {
            // Get tools from MCPManager
            const tools = await this.mcpManager.getAvailableTools();

            if (!tools || tools.length === 0) {
                this.logger.warn(`[STAGE-2.1-MCP] No MCP tools available, using default list`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });

                // Return default tool list if MCPManager not ready
                return this._getDefaultTools();
            }

            return tools;

        } catch (error) {
            this.logger.warn(`[STAGE-2.1-MCP] Failed to get tools from MCPManager: ${error.message}`, { category: 'tetyana-plan-tools', component: 'tetyana-plan-tools' });

            // Fallback to default tools
            return this._getDefaultTools();
        }
    }

    /**
     * Get default tool list (fallback when MCPManager unavailable)
     * FIXED 14.10.2025 - Removed non-existent 'computercontroller', added real 'shell' server
     * 
     * @returns {Array} Default tools
     * @private
     */
    _getDefaultTools() {
        return [
            // Filesystem tools
            { server: 'filesystem', tool: 'read_file', description: 'Read file content' },
            { server: 'filesystem', tool: 'write_file', description: 'Write content to file' },
            { server: 'filesystem', tool: 'list_directory', description: 'List directory contents' },
            { server: 'filesystem', tool: 'create_directory', description: 'Create directory' },
            { server: 'filesystem', tool: 'move_file', description: 'Move/rename file' },
            { server: 'filesystem', tool: 'get_file_info', description: 'Get file metadata' },

            // Playwright tools
            { server: 'playwright', tool: 'browser_open', description: 'Open browser' },
            { server: 'playwright', tool: 'browser_navigate', description: 'Navigate to URL' },
            { server: 'playwright', tool: 'browser_click', description: 'Click element' },
            { server: 'playwright', tool: 'browser_type', description: 'Type text' },
            { server: 'playwright', tool: 'browser_search', description: 'Search on page' },
            { server: 'playwright', tool: 'browser_scrape', description: 'Scrape page data' },
            { server: 'playwright', tool: 'browser_screenshot', description: 'Take screenshot' },

            // Shell tools (REAL server that exists in MCP config)
            { server: 'shell', tool: 'run_shell_command', description: 'Execute shell command' },
            { server: 'shell', tool: 'run_applescript', description: 'Execute AppleScript for Mac automation' }
        ];
    }

    /**
     * Validate tool plan against available tools
     * 
     * @param {Object} plan - Tool plan
     * @param {Array} availableTools - Available MCP tools
     * @returns {Object} Validation result
     * @private
     */
    _validatePlan(plan, availableTools) {
        const issues = [];
        const warnings = [];

        // Check each tool call
        for (const call of plan.tool_calls) {
            // Check if tool exists
            // FIXED 14.10.2025 - MCP tools have 'name' property, not 'tool'
            const toolExists = availableTools.some(
                t => t.server === call.server && t.name === call.tool
            );

            if (!toolExists) {
                issues.push(`Tool ${call.server}__${call.tool} not found in available tools`);
            }

            // Check parameters
            if (!call.parameters || typeof call.parameters !== 'object') {
                issues.push(`Tool ${call.server}__${call.tool} has invalid parameters`);
            }

            // Warn about missing reasoning
            if (!call.reasoning) {
                warnings.push(`Tool ${call.server}__${call.tool} has no reasoning`);
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings
        };
    }

    /**
     * Generate summary of tool plan
     * 
     * @param {Object} item - TODO item
     * @param {Object} plan - Tool plan
     * @returns {string} Summary text
     * @private
     */
    _generatePlanSummary(item, plan) {
        const lines = [];

        lines.push(`🛠️ План для "${item.action}":`);
        lines.push('');

        // List tools
        for (let i = 0; i < plan.tool_calls.length; i++) {
            const call = plan.tool_calls[i];
            lines.push(`  ${i + 1}. ${call.server}__${call.tool}`);

            // Show key parameters
            const keyParams = this._extractKeyParameters(call.parameters);
            if (keyParams.length > 0) {
                lines.push(`     ${keyParams.join(', ')}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Extract key parameters for display
     * 
     * @param {Object} params - Parameters object
     * @returns {Array<string>} Key parameter strings
     * @private
     */
    _extractKeyParameters(params) {
        const keyParams = [];

        // Common important parameters
        const importantKeys = ['path', 'url', 'selector', 'text', 'command', 'destination'];

        for (const key of importantKeys) {
            if (params[key]) {
                let value = params[key];

                // Truncate long values
                if (typeof value === 'string' && value.length > 50) {
                    value = value.substring(0, 47) + '...';
                }

                keyParams.push(`${key}=${value}`);
            }
        }

        return keyParams;
    }
}

export default TetyanaПlanToolsProcessor;
