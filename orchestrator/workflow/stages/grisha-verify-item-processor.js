/**
 * @fileoverview Grisha Verify Item Processor (Stage 2.3-MCP)
 * Evidence-based verification of TODO item execution
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';

/**
 * Grisha Verify Item Processor
 * 
 * Performs strict evidence-based verification:
 * - NEVER accepts without proof
 * - Uses MCP tools to verify results
 * - Checks against success criteria
 * - Returns verified=true ONLY if all criteria met
 */
export class GrishaVerifyItemProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpTodoManager - MCPTodoManager instance
     * @param {Object} dependencies.mcpManager - MCPManager instance for verification tools
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ mcpTodoManager, mcpManager, logger: loggerInstance }) {
        this.mcpTodoManager = mcpTodoManager;
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute verification for TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item
     * @param {Object} context.execution - Execution results from Stage 2.2
     * @param {Object} context.todo - Full TODO list
     * @returns {Promise<Object>} Verification result
     */
    async execute(context) {
        this.logger.system('grisha-verify-item', '[STAGE-2.3-MCP] 🔍 Verifying execution...');

        const { currentItem, execution, todo } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for verification');
        }

        if (!execution) {
            throw new Error('execution results are required for verification');
        }

        try {
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP] Item: ${currentItem.id}. ${currentItem.action}`);
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP] Success criteria: ${currentItem.success_criteria}`);

            // OPTIMIZATION 15.10.2025 - Get compact tools summary for verification
            const toolsSummary = this.mcpManager.getToolsSummary();
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP] Tools summary: ${toolsSummary.length} chars`);

            // Verify using MCPTodoManager with tools summary
            const verification = await this.mcpTodoManager.verifyItem(currentItem, execution, { toolsSummary });

            if (!verification) {
                throw new Error('MCPTodoManager.verifyItem() returned null/undefined');
            }

            // Log verification result
            const status = verification.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED';
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP] ${status}`);
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP]   Reason: ${verification.reason}`);

            if (verification.evidence) {
                this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP]   Evidence: ${verification.evidence}`);
            }

            if (verification.used_tools && verification.used_tools.length > 0) {
                this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP]   Verification tools: ${verification.used_tools.join(', ')}`);
            }

            // Generate summary
            const summary = this._generateVerificationSummary(currentItem, verification);

            // Determine next action
            const nextAction = this._determineNextAction(verification, currentItem);

            return {
                success: true,
                verified: verification.verified,
                verification,
                summary,
                nextAction,
                metadata: {
                    itemId: currentItem.id,
                    verified: verification.verified,
                    evidenceProvided: !!verification.evidence,
                    toolsUsed: verification.used_tools || [],
                    prompt: MCP_PROMPTS.GRISHA_VERIFY_ITEM.name
                }
            };

        } catch (error) {
            this.logger.error(`[STAGE-2.3-MCP] ❌ Verification failed: ${error.message}`, { category: 'grisha-verify-item', component: 'grisha-verify-item' });
            this.logger.error(`Stack trace: ${error.stack}`, { category: 'grisha-verify-item', component: 'grisha-verify-item' });

            return {
                success: false,
                verified: false,
                error: error.message,
                verification: {
                    verified: false,
                    reason: `Помилка під час перевірки: ${error.message}`,
                    evidence: null
                },
                summary: `⚠️ Не вдалося перевірити "${currentItem.action}": ${error.message}`,
                nextAction: 'adjust',
                metadata: {
                    itemId: currentItem.id,
                    errorType: error.name,
                    stage: 'verification'
                }
            };
        }
    }

    /**
     * Generate summary of verification
     * 
     * @param {Object} item - TODO item
     * @param {Object} verification - Verification result
     * @returns {string} Summary text
     * @private
     */
    _generateVerificationSummary(item, verification) {
        const lines = [];

        if (verification.verified) {
            lines.push(`✅ Перевірено: "${item.action}"`);

            if (verification.evidence) {
                lines.push(`   Підтвердження: ${verification.evidence}`);
            }
        } else {
            lines.push(`❌ Не підтверджено: "${item.action}"`);
            lines.push(`   Причина: ${verification.reason}`);

            if (verification.missing_criteria) {
                lines.push(`   Не виконано: ${verification.missing_criteria}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Determine next action based on verification
     * 
     * @param {Object} verification - Verification result
     * @param {Object} item - TODO item
     * @returns {string} Next action ('continue', 'adjust', 'retry')
     * @private
     */
    _determineNextAction(verification, item) {
        if (verification.verified) {
            // Success - continue to next item
            return 'continue';
        }

        // Check if we've reached max attempts
        const currentAttempt = item.attempt || 1;
        const maxAttempts = item.max_attempts || 3;

        if (currentAttempt >= maxAttempts) {
            // Max attempts reached - need adjustment
            this.logger.system('grisha-verify-item', `[STAGE-2.3-MCP] Max attempts (${maxAttempts}) reached, adjustment needed`);
            return 'adjust';
        }

        // Check verification reason for hints
        const reasonLower = (verification.reason || '').toLowerCase();

        // Temporary failures - retry without adjustment
        const temporaryFailureKeywords = [
            'timeout',
            'тимчасов',
            'мережа',
            'network',
            'connection'
        ];

        for (const keyword of temporaryFailureKeywords) {
            if (reasonLower.includes(keyword)) {
                this.logger.system('grisha-verify-item', '[STAGE-2.3-MCP] Temporary failure detected, retry recommended');
                return 'retry';
            }
        }

        // Structural failures - need adjustment
        const structuralFailureKeywords = [
            'не існує',
            'not found',
            'невірний',
            'invalid',
            'неправильн',
            'wrong'
        ];

        for (const keyword of structuralFailureKeywords) {
            if (reasonLower.includes(keyword)) {
                this.logger.system('grisha-verify-item', '[STAGE-2.3-MCP] Structural failure detected, adjustment needed');
                return 'adjust';
            }
        }

        // Default - adjust for safety
        return 'adjust';
    }

    /**
     * Analyze verification evidence quality
     * 
     * @param {Object} verification - Verification result
     * @returns {Object} Evidence quality analysis
     * @private
     */
    _analyzeEvidenceQuality(verification) {
        const analysis = {
            hasEvidence: !!verification.evidence,
            usedTools: verification.used_tools && verification.used_tools.length > 0,
            evidenceType: 'none',
            quality: 'low'
        };

        if (!verification.evidence) {
            return analysis;
        }

        const evidence = verification.evidence.toLowerCase();

        // Check evidence type
        if (evidence.includes('файл') || evidence.includes('file')) {
            analysis.evidenceType = 'file';
        } else if (evidence.includes('скріншот') || evidence.includes('screenshot')) {
            analysis.evidenceType = 'screenshot';
        } else if (evidence.includes('дані') || evidence.includes('data')) {
            analysis.evidenceType = 'data';
        } else if (evidence.includes('браузер') || evidence.includes('browser')) {
            analysis.evidenceType = 'browser';
        }

        // Check quality
        if (analysis.usedTools) {
            analysis.quality = 'high'; // Tools used - concrete evidence
        } else if (evidence.length > 50) {
            analysis.quality = 'medium'; // Detailed description
        }

        return analysis;
    }

    /**
     * Get verification confidence score
     * 
     * @param {Object} verification - Verification result
     * @returns {number} Confidence score (0-100)
     * @private
     */
    _getVerificationConfidence(verification) {
        let confidence = 50; // Base confidence

        // Increase confidence if tools were used
        if (verification.used_tools && verification.used_tools.length > 0) {
            confidence += 30;
        }

        // Increase confidence if evidence is detailed
        if (verification.evidence && verification.evidence.length > 100) {
            confidence += 10;
        }

        // Decrease confidence if verification failed without tools
        if (!verification.verified && (!verification.used_tools || verification.used_tools.length === 0)) {
            confidence -= 20;
        }

        // Cap at 0-100
        return Math.max(0, Math.min(100, confidence));
    }
}

export default GrishaVerifyItemProcessor;
