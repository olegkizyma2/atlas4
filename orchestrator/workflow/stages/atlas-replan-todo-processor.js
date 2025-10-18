/**
 * @fileoverview Atlas Replan TODO Processor (Stage 3.5-MCP)
 * Deep analysis and TODO replanning after max attempts
 * 
 * CREATED 2025-10-18: Separated from adjust-todo-processor for clarity
 * - Preprocesses data from Grisha + Tetyana
 * - Performs deep analysis with specialized prompt
 * - Generates new TODO items based on visual evidence
 * 
 * @version 1.0.0
 * @date 2025-10-18
 */

import logger from '../../utils/logger.js';
import axios from 'axios';
import GlobalConfig from '../../../config/global-config.js';

/**
 * Atlas Replan TODO Processor
 * 
 * Handles deep analysis and replanning after max attempts:
 * - Aggregates failure context from multiple sources
 * - Uses specialized prompt for replan analysis
 * - Generates actionable new TODO items
 * - Provides detailed reasoning
 */
export class AtlasReplanTodoProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpManager - MCPManager instance
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpManager, logger: loggerInstance }) {
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute deep analysis and replanning
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.failedItem - Failed TODO item
     * @param {Object} context.todo - Full TODO list
     * @param {Object} context.tetyanaData - Tetyana's execution data
     * @param {Object} context.grishaData - Grisha's visual analysis data
     * @param {Object} context.session - Session data
     * @param {Object} context.res - Response stream
     * @returns {Promise<Object>} Replan result
     */
    async execute(context) {
        this.logger.system('atlas-replan-todo', '[STAGE-3.5-MCP] 🔍 Atlas deep analysis and replanning...');

        const { failedItem, todo, tetyanaData, grishaData, session, res } = context;

        if (!failedItem || !todo) {
            throw new Error('failedItem and todo are required');
        }

        try {
            // Step 1: Preprocess and aggregate all context
            const aggregatedContext = this._preprocessContext(failedItem, todo, tetyanaData, grishaData);

            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP] Context aggregated:`);
            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   Root cause: ${aggregatedContext.root_cause}`);
            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   Confidence: ${aggregatedContext.grisha_confidence}%`);
            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   Suggestions: ${aggregatedContext.suggestions.length}`);

            // Step 2: Call LLM with specialized replan prompt
            const replanResult = await this._analyzeAndReplan(aggregatedContext);

            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP] ✅ Replan complete:`);
            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   Strategy: ${replanResult.strategy}`);
            this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   Replanned: ${replanResult.replanned}`);
            
            if (replanResult.new_items) {
                this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP]   New items: ${replanResult.new_items.length}`);
            }

            // Step 3: Generate summary
            const summary = this._generateReplanSummary(failedItem, replanResult);

            return {
                success: true,
                replanned: replanResult.replanned,
                strategy: replanResult.strategy,
                reasoning: replanResult.reasoning,
                new_items: replanResult.new_items || [],
                modified_items: replanResult.modified_items || [],
                continue_from_item_id: replanResult.continue_from_item_id,
                summary,
                metadata: {
                    itemId: failedItem.id,
                    root_cause: aggregatedContext.root_cause,
                    grisha_confidence: aggregatedContext.grisha_confidence,
                    suggestions_count: aggregatedContext.suggestions.length,
                    new_items_count: replanResult.new_items?.length || 0
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-3.5-MCP] ❌ Replan failed: ${error.message}`, {
                category: 'atlas-replan-todo',
                component: 'atlas-replan-todo',
                stack: error.stack
            });

            return {
                success: false,
                replanned: false,
                strategy: 'skip_and_continue',
                reasoning: `Replan error: ${error.message}`,
                error: error.message,
                summary: `❌ Не вдалося перебудувати план: ${error.message}`,
                metadata: {
                    itemId: failedItem.id,
                    errorType: error.name
                }
            };
        }
    }

    /**
     * Preprocess and aggregate context from all sources
     * 
     * @param {Object} failedItem - Failed TODO item
     * @param {Object} todo - TODO list
     * @param {Object} tetyanaData - Tetyana data
     * @param {Object} grishaData - Grisha data
     * @returns {Object} Aggregated context
     * @private
     */
    _preprocessContext(failedItem, todo, tetyanaData, grishaData) {
        // Extract root cause and recommendations
        const rootCause = grishaData.failure_analysis?.likely_cause || 'unknown';
        const recommendedStrategy = grishaData.failure_analysis?.recommended_strategy || 'modify';
        
        // Format visual evidence
        const visualEvidence = {
            observed: grishaData.visual_evidence?.observed || 'No data',
            matches_criteria: grishaData.visual_evidence?.matches_criteria || false,
            details: grishaData.visual_evidence?.details || 'No details',
            screenshot_path: grishaData.screenshot_path || null
        };

        // Format execution summary
        const executionSummary = {
            tools_used: tetyanaData.tools_used || [],
            all_successful: tetyanaData.execution?.all_successful || false,
            successful_calls: tetyanaData.execution?.successful_calls || 0,
            failed_calls: tetyanaData.execution?.failed_calls || 0,
            stopped_at: tetyanaData.execution?.stopped_at_index
        };

        // Get context from TODO list
        const completedItems = todo.items.filter(i => i.status === 'completed').map(i => ({
            id: i.id,
            action: i.action
        }));

        const remainingItems = todo.items.slice(failedItem.id).map(i => ({
            id: i.id,
            action: i.action,
            status: i.status
        }));

        return {
            // Item info
            item_id: failedItem.id,
            item_action: failedItem.action,
            success_criteria: failedItem.success_criteria,
            attempts: failedItem.attempt || failedItem.max_attempts || 3,
            max_attempts: failedItem.max_attempts || 3,

            // Original request
            original_request: todo.request,

            // Grisha analysis
            root_cause: rootCause,
            recommended_strategy: recommendedStrategy,
            grisha_confidence: grishaData.confidence || 0,
            grisha_reason: grishaData.reason || 'Unknown',
            visual_evidence: visualEvidence,
            suggestions: grishaData.suggestions || [],

            // Tetyana execution
            execution_summary: executionSummary,
            planned_tools: tetyanaData.plan?.tool_calls || [],

            // TODO context
            completed_items: completedItems,
            remaining_items: remainingItems,
            total_items: todo.items.length,
            completed_count: completedItems.length
        };
    }

    /**
     * Analyze and generate replan using LLM
     * 
     * @param {Object} context - Aggregated context
     * @returns {Promise<Object>} Replan result
     * @private
     */
    async _analyzeAndReplan(context) {
        // Import replan prompt
        const { MCP_PROMPTS } = await import('../../../prompts/mcp/index.js');
        const replanPrompt = MCP_PROMPTS.ATLAS_REPLAN_TODO;

        if (!replanPrompt) {
            throw new Error('ATLAS_REPLAN_TODO prompt not found');
        }

        // Build user message with rich context
        const userMessage = this._buildReplanUserMessage(context);

        // Get model config
        const modelConfig = GlobalConfig.MCP_MODEL_CONFIG?.getStageConfig?.('replan_todo') || {
            model: 'copilot-gpt-4o',
            temperature: 0.3,
            max_tokens: 3000
        };

        this.logger.system('atlas-replan-todo', `[STAGE-3.5-MCP] Using model: ${modelConfig.model}`);

        // Get API endpoint
        const apiEndpointConfig = GlobalConfig.MCP_MODEL_CONFIG?.apiEndpoint;
        const apiUrl = apiEndpointConfig
            ? (typeof apiEndpointConfig === 'string' ? apiEndpointConfig : apiEndpointConfig.primary)
            : 'http://localhost:4000/v1/chat/completions';

        // Call LLM
        const apiResponse = await axios.post(apiUrl, {
            model: modelConfig.model,
            messages: [
                {
                    role: 'system',
                    content: replanPrompt.systemPrompt || replanPrompt.SYSTEM_PROMPT
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
            timeout: 60000  // 60s for deep analysis
        });

        const response = apiResponse.data.choices[0].message.content;

        // Parse response
        return this._parseReplanResponse(response);
    }

    /**
     * Build user message for replan prompt
     * 
     * @param {Object} context - Aggregated context
     * @returns {string} User message
     * @private
     */
    _buildReplanUserMessage(context) {
        return `
## ORIGINAL REQUEST
${context.original_request}

## FAILED ITEM
**ID:** ${context.item_id}
**Action:** ${context.item_action}
**Success Criteria:** ${context.success_criteria}
**Attempts:** ${context.attempts}/${context.max_attempts}

## GRISHA'S VISUAL ANALYSIS
**Root Cause:** ${context.root_cause}
**Recommended Strategy:** ${context.recommended_strategy}
**Confidence:** ${context.grisha_confidence}%
**Reason:** ${context.grisha_reason}

**Visual Evidence:**
- Observed: ${context.visual_evidence.observed}
- Matches Criteria: ${context.visual_evidence.matches_criteria ? 'Yes' : 'No'}
- Details: ${context.visual_evidence.details}
${context.visual_evidence.screenshot_path ? `- Screenshot: ${context.visual_evidence.screenshot_path}` : ''}

**Suggestions:**
${context.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## TETYANA'S EXECUTION
**Tools Used:** ${context.execution_summary.tools_used.join(', ') || 'None'}
**All Successful:** ${context.execution_summary.all_successful ? 'Yes' : 'No'}
**Success Rate:** ${context.execution_summary.successful_calls}/${context.execution_summary.successful_calls + context.execution_summary.failed_calls}
${context.execution_summary.stopped_at !== undefined ? `**Stopped At Tool:** ${context.execution_summary.stopped_at + 1}` : ''}

**Planned Tools:**
${context.planned_tools.map((t, i) => `${i + 1}. ${t.server}__${t.tool}`).join('\n') || 'None'}

## TODO CONTEXT
**Total Items:** ${context.total_items}
**Completed:** ${context.completed_count}

**Completed Items:**
${context.completed_items.map(i => `  ${i.id}. ${i.action}`).join('\n') || '  None'}

**Remaining Items (including failed):**
${context.remaining_items.map(i => `  ${i.id}. ${i.action} [${i.status}]`).join('\n') || '  None'}

## YOUR TASK
Based on Grisha's visual analysis and Tetyana's execution results, decide:

1. **Should we replan?** (add new items, modify approach, change strategy)
2. **Or should we skip and continue?** (if impossible or not critical)
3. **Or should we abort?** (if fundamental blocker)

Focus on the ROOT CAUSE (${context.root_cause}) and use Grisha's SUGGESTIONS.

Respond with JSON in this format:
\`\`\`json
{
  "replanned": true/false,
  "strategy": "replan_and_continue" | "skip_and_continue" | "abort",
  "reasoning": "detailed explanation based on visual evidence",
  "new_items": [
    {
      "id": <next_id>,
      "action": "specific action",
      "tools_needed": ["tool1", "tool2"],
      "success_criteria": "clear criteria",
      "max_attempts": 3
    }
  ],
  "modified_items": [],
  "continue_from_item_id": <id>,
  "tts_phrase": "Ukrainian phrase for Atlas"
}
\`\`\`
`;
    }

    /**
     * Parse replan response from LLM
     * 
     * @param {string} response - LLM response
     * @returns {Object} Parsed replan
     * @private
     */
    _parseReplanResponse(response) {
        try {
            // Remove markdown wrappers
            let cleaned = response.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleaned);

            return {
                replanned: parsed.replanned || false,
                strategy: parsed.strategy || 'skip_and_continue',
                reasoning: parsed.reasoning || 'No reasoning provided',
                new_items: parsed.new_items || [],
                modified_items: parsed.modified_items || [],
                continue_from_item_id: parsed.continue_from_item_id || null,
                tts_phrase: parsed.tts_phrase || 'Аналіз завершено'
            };

        } catch (error) {
            this.logger.error(`[STAGE-3.5-MCP] Failed to parse replan response: ${error.message}`, {
                category: 'atlas-replan-todo',
                component: 'atlas-replan-todo',
                response: response.substring(0, 500)
            });

            return {
                replanned: false,
                strategy: 'skip_and_continue',
                reasoning: 'Parse error',
                error: error.message
            };
        }
    }

    /**
     * Generate summary of replan result
     * 
     * @param {Object} item - Failed item
     * @param {Object} replan - Replan result
     * @returns {string} Summary
     * @private
     */
    _generateReplanSummary(item, replan) {
        const lines = [];

        lines.push(`🔍 Аналіз провалу "${item.action}":`);
        lines.push('');

        if (replan.replanned) {
            lines.push(`✅ План перебудовано (${replan.strategy})`);
            lines.push(`   Нових пунктів: ${replan.new_items?.length || 0}`);
            lines.push(`   Причина: ${replan.reasoning}`);
        } else {
            lines.push(`⚠️ План не змінено (${replan.strategy})`);
            lines.push(`   Причина: ${replan.reasoning}`);
        }

        return lines.join('\n');
    }
}

export default AtlasReplanTodoProcessor;
