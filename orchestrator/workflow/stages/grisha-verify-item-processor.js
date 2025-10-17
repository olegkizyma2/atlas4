/**
 * @fileoverview Grisha Verify Item Processor (Stage 2.3-MCP) - VISUAL VERIFICATION
 * Visual evidence-based verification using screenshots and AI vision
 * 
 * REFACTORED 17.10.2025: Switched from MCP tools to visual verification
 * - Uses continuous screenshot monitoring
 * - AI vision analysis (GPT-4 Vision)
 * - Stuck state detection
 * - Dynamic feedback for corrections
 * 
 * @version 5.0.0
 * @date 2025-10-17
 */

import logger from '../../utils/logger.js';
import { MCP_PROMPTS } from '../../../prompts/mcp/index.js';
import { VisualCaptureService } from '../../services/visual-capture-service.js';
import { VisionAnalysisService } from '../../services/vision-analysis-service.js';

/**
 * Grisha Verify Item Processor
 * 
 * Performs strict visual evidence-based verification:
 * - ALWAYS captures screenshots for verification
 * - Uses AI vision (GPT-4 Vision) to analyze screenshots
 * - Detects stuck states through visual monitoring
 * - Returns verified=true ONLY if visual evidence confirms success
 * - NO MCP tool selection - pure visual verification
 */
export class GrishaVerifyItemProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mcpTodoManager - MCPTodoManager instance (for messaging)
     * @param {Object} dependencies.logger - Logger instance
     * @param {Object} dependencies.config - Visual verification config
     */
    constructor({ mcpTodoManager, logger: loggerInstance, config = {} }) {
        this.mcpTodoManager = mcpTodoManager;
        this.logger = loggerInstance || logger;
        
        // Initialize visual services
        this.visualCapture = new VisualCaptureService({
            logger: this.logger,
            config: {
                captureInterval: config.captureInterval || 2000,
                screenshotDir: config.screenshotDir || '/tmp/atlas_visual',
                maxStoredScreenshots: config.maxStoredScreenshots || 10
            }
        });
        
        this.visionAnalysis = new VisionAnalysisService({
            logger: this.logger,
            config: {
                visionModel: config.visionModel || 'gpt-4-vision-preview',
                apiEndpoint: config.visionApiEndpoint || 'http://localhost:4000/v1/chat/completions',
                temperature: config.visionTemperature || 0.2
            }
        });
        
        this.initialized = false;
    }
    
    /**
     * Initialize visual verification services
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        
        this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] Initializing visual verification services...');
        
        await Promise.all([
            this.visualCapture.initialize(),
            this.visionAnalysis.initialize()
        ]);
        
        this.initialized = true;
        this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] ✅ Visual verification services ready');
    }

    /**
     * Execute visual verification for TODO item
     * 
     * @param {Object} context - Stage context
     * @param {Object} context.currentItem - Current TODO item
     * @param {Object} context.execution - Execution results from Stage 2.2
     * @param {Object} context.todo - Full TODO list
     * @returns {Promise<Object>} Verification result
     */
    async execute(context) {
        // Ensure services are initialized
        await this.initialize();
        
        this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] 🔍 Starting visual verification...');

        const { currentItem, execution, todo } = context;

        if (!currentItem) {
            throw new Error('currentItem is required for verification');
        }

        if (!execution) {
            throw new Error('execution results are required for verification');
        }

        try {
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] Item: ${currentItem.id}. ${currentItem.action}`);
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] Success criteria: ${currentItem.success_criteria}`);

            // Step 1: Capture screenshot of current state
            const screenshot = await this.visualCapture.captureScreenshot(`item_${currentItem.id}_verify`);
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] 📸 Screenshot captured: ${screenshot.filename}`);

            // Step 2: Analyze screenshot with AI vision
            const analysisContext = {
                action: currentItem.action,
                executionResults: execution.results || []
            };
            
            const visionAnalysis = await this.visionAnalysis.analyzeScreenshot(
                screenshot.filepath,
                currentItem.success_criteria,
                analysisContext
            );

            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] 🤖 Vision analysis complete (confidence: ${visionAnalysis.confidence}%)`);

            // Step 3: Build verification result
            const verification = {
                verified: visionAnalysis.verified && visionAnalysis.confidence >= 70, // Require 70% confidence
                confidence: visionAnalysis.confidence,
                reason: visionAnalysis.reason,
                visual_evidence: visionAnalysis.visual_evidence,
                screenshot_path: screenshot.filepath,
                screenshot_hash: screenshot.hash,
                vision_model: this.visionAnalysis.config.visionModel,
                from_visual_analysis: true
            };

            // Log verification result
            const status = verification.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED';
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] ${status}`);
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA]   Reason: ${verification.reason}`);
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA]   Visual Evidence: ${verification.visual_evidence.observed}`);

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
                    confidence: verification.confidence,
                    screenshotPath: screenshot.filepath,
                    visualEvidence: true,
                    verificationMethod: 'visual_ai'
                }
            };

        } catch (error) {
            this.logger.error(`[VISUAL-GRISHA] ❌ Verification failed: ${error.message}`, {
                category: 'grisha-verify-item',
                component: 'grisha-verify-item',
                stack: error.stack
            });

            return {
                success: false,
                verified: false,
                error: error.message,
                verification: {
                    verified: false,
                    reason: `Помилка під час візуальної перевірки: ${error.message}`,
                    visual_evidence: null
                },
                summary: `⚠️ Не вдалося перевірити "${currentItem.action}": ${error.message}`,
                nextAction: 'adjust',
                metadata: {
                    itemId: currentItem.id,
                    errorType: error.name,
                    stage: 'visual_verification'
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
            lines.push(`✅ Візуально підтверджено: "${item.action}"`);

            if (verification.visual_evidence && verification.visual_evidence.observed) {
                lines.push(`   Візуальні докази: ${verification.visual_evidence.observed}`);
            }
            
            if (verification.confidence) {
                lines.push(`   Впевненість: ${verification.confidence}%`);
            }
        } else {
            lines.push(`❌ Візуально не підтверджено: "${item.action}"`);
            lines.push(`   Причина: ${verification.reason}`);

            if (verification.visual_evidence && verification.visual_evidence.details) {
                lines.push(`   Деталі: ${verification.visual_evidence.details}`);
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
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] Max attempts (${maxAttempts}) reached, adjustment needed`);
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
            'connection',
            'loading'
        ];

        for (const keyword of temporaryFailureKeywords) {
            if (reasonLower.includes(keyword)) {
                this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] Temporary failure detected, retry recommended');
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
            'wrong',
            'відсутній',
            'missing'
        ];

        for (const keyword of structuralFailureKeywords) {
            if (reasonLower.includes(keyword)) {
                this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] Structural failure detected, adjustment needed');
                return 'adjust';
            }
        }

        // Check confidence level - low confidence suggests uncertainty, try adjustment
        if (verification.confidence && verification.confidence < 50) {
            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] Low confidence (${verification.confidence}%), adjustment needed`);
            return 'adjust';
        }

        // Default - adjust for safety
        return 'adjust';
    }

    /**
     * Detect if execution is stuck by analyzing multiple screenshots
     * 
     * @param {Object} item - TODO item being executed
     * @param {number} durationMs - How long execution has been running
     * @returns {Promise<Object>} Stuck detection result
     */
    async detectStuckState(item, durationMs = 10000) {
        try {
            // Start monitoring if not already
            if (!this.visualCapture.isMonitoring) {
                await this.visualCapture.startMonitoring();
                
                // Wait for a few screenshots to accumulate
                await new Promise(resolve => setTimeout(resolve, this.visualCapture.config.captureInterval * 3));
            }

            // Get recent screenshots
            const since = Date.now() - durationMs;
            const recentScreenshots = this.visualCapture.getScreenshotsSince(since);

            if (recentScreenshots.length < 2) {
                // Not enough screenshots to determine stuck state
                return {
                    stuck: false,
                    reason: 'Insufficient screenshots for stuck detection',
                    confidence: 0
                };
            }

            // Use vision analysis to detect stuck state
            const screenshotPaths = recentScreenshots.map(s => s.filepath);
            const stuckAnalysis = await this.visionAnalysis.detectStuckState(
                screenshotPaths,
                item.action
            );

            this.logger.system('grisha-verify-item', `[VISUAL-GRISHA] Stuck detection: ${stuckAnalysis.stuck ? 'STUCK' : 'PROGRESSING'} (confidence: ${stuckAnalysis.confidence}%)`);

            return stuckAnalysis;

        } catch (error) {
            this.logger.error(`[VISUAL-GRISHA] Stuck detection failed: ${error.message}`, {
                category: 'grisha-verify-item',
                component: 'grisha-verify-item'
            });
            
            // Return not stuck on error (fail-safe)
            return {
                stuck: false,
                reason: `Stuck detection error: ${error.message}`,
                confidence: 0,
                error: true
            };
        }
    }

    /**
     * Get current verification status
     * 
     * @returns {Object} Status info
     */
    getStatus() {
        return {
            initialized: this.initialized,
            visualCapture: this.visualCapture?.getStatus(),
            visionAnalysis: this.visionAnalysis?.getStatus()
        };
    }

    /**
     * Cleanup and shutdown
     */
    async destroy() {
        if (this.visualCapture) {
            await this.visualCapture.destroy();
        }
        
        if (this.visionAnalysis) {
            await this.visionAnalysis.destroy();
        }
        
        this.initialized = false;
        this.logger.system('grisha-verify-item', '[VISUAL-GRISHA] Processor destroyed');
    }
}

export default GrishaVerifyItemProcessor;
