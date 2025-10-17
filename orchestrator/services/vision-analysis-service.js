/**
 * @fileoverview Vision Analysis Service
 * AI-powered visual analysis for screenshot verification
 * 
 * Provides:
 * - GPT-4 Vision API integration for screenshot analysis
 * - Visual evidence extraction
 * - Success criteria matching through vision
 * - Fallback to CLIP/YOLO for specific object detection (future)
 * 
 * @version 5.0.0
 * @date 2025-10-17
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { VISION_CONFIG } from '../../config/global-config.js';

/**
 * Vision Analysis Service
 * Uses AI vision models to analyze screenshots
 * 
 * PRIORITY:
 * 1. Ollama local llama3.2-vision (FREE!)
 * 2. OpenRouter Llama-11b ($0.0002/img)
 * 3. Fallback to cheapest/standard models
 */
export class VisionAnalysisService {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logger - Logger instance
     * @param {Object} dependencies.config - Configuration
     */
    constructor({ logger, config = {} }) {
        this.logger = logger;
        this.config = config || {};

        // Determine vision model (priority: Ollama → OpenRouter)
        this.visionProvider = config.visionProvider || 'auto'; // 'ollama', 'openrouter', or 'auto'
        this.visionModel = config.visionModel || null;

        this.initialized = false;
        this.ollamaAvailable = false;
    }

    /**
     * Initialize vision analysis service
     * Checks Ollama availability and selects best model
     */
    async initialize() {
        this.logger.system('vision-analysis', '[VISION] Initializing Vision Analysis Service...');

        // Check if Ollama is available
        this.ollamaAvailable = await this._checkOllamaAvailability();

        if (this.ollamaAvailable && this.visionProvider !== 'openrouter') {
            this.logger.system('vision-analysis', '[VISION] ✅ Ollama detected - using LOCAL llama3.2-vision (FREE!)');
            this.visionProvider = 'ollama';
            this.visionModel = VISION_CONFIG.local.model;
        } else if (this.visionProvider === 'auto') {
            this.logger.system('vision-analysis', '[VISION] ℹ️ Ollama not available - using OpenRouter Llama-11b');
            this.visionProvider = 'openrouter';
            this.visionModel = VISION_CONFIG.fast.model;
        }

        this.initialized = true;
        this.logger.system('vision-analysis', `[VISION] ✅ Vision Analysis initialized: ${this.visionProvider}/${this.visionModel}`);
    }

    /**
     * Check if Ollama is available
     * @returns {Promise<boolean>}
     * @private
     */
    async _checkOllamaAvailability() {
        try {
            const response = await axios.get('http://localhost:11434/api/tags', {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Analyze screenshot against success criteria
     * 
     * @param {string} screenshotPath - Path to screenshot file
     * @param {string} successCriteria - What to verify in the screenshot
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeScreenshot(screenshotPath, successCriteria, context = {}) {
        this.logger.system('vision-analysis', `[VISION] 🔍 Analyzing screenshot: ${path.basename(screenshotPath)}`);
        this.logger.system('vision-analysis', `[VISION] Success criteria: ${successCriteria}`);

        try {
            // Read screenshot file
            const imageBuffer = await fs.readFile(screenshotPath);
            const base64Image = imageBuffer.toString('base64');

            // Construct vision analysis prompt
            const prompt = this._constructAnalysisPrompt(successCriteria, context);

            // Call vision API
            const analysis = await this._callVisionAPI(base64Image, prompt);

            this.logger.system('vision-analysis', `[VISION] ✅ Analysis complete: ${analysis.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);

            return analysis;

        } catch (error) {
            this.logger.error(`[VISION] Analysis failed: ${error.message}`, {
                category: 'vision-analysis',
                component: 'vision-analysis',
                screenshotPath,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Compare two screenshots and detect changes
     * 
     * @param {string} screenshot1Path - Path to first screenshot
     * @param {string} screenshot2Path - Path to second screenshot
     * @param {string} expectedChange - What change to look for
     * @returns {Promise<Object>} Comparison result
     */
    async compareScreenshots(screenshot1Path, screenshot2Path, expectedChange) {
        this.logger.system('vision-analysis', `[VISION] 🔄 Comparing screenshots for change: ${expectedChange}`);

        try {
            // Read both screenshots
            const [image1Buffer, image2Buffer] = await Promise.all([
                fs.readFile(screenshot1Path),
                fs.readFile(screenshot2Path)
            ]);

            const base64Image1 = image1Buffer.toString('base64');
            const base64Image2 = image2Buffer.toString('base64');

            // Construct comparison prompt
            const prompt = this._constructComparisonPrompt(expectedChange);

            // Call vision API with both images
            const comparison = await this._callVisionAPIMultiImage([base64Image1, base64Image2], prompt);

            this.logger.system('vision-analysis', `[VISION] ✅ Comparison complete: ${comparison.changeDetected ? 'CHANGE DETECTED' : 'NO CHANGE'}`);

            return comparison;

        } catch (error) {
            this.logger.error(`[VISION] Comparison failed: ${error.message}`, {
                category: 'vision-analysis',
                component: 'vision-analysis',
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Detect if system is stuck (no visual changes)
     * 
     * @param {Array<string>} screenshotPaths - Array of screenshot paths (chronological)
     * @param {string} expectedActivity - What should be happening
     * @returns {Promise<Object>} Stuck detection result
     */
    async detectStuckState(screenshotPaths, expectedActivity) {
        this.logger.system('vision-analysis', `[VISION] 🔍 Detecting stuck state across ${screenshotPaths.length} screenshots`);

        try {
            // Read all screenshots
            const imageBuffers = await Promise.all(
                screenshotPaths.map(path => fs.readFile(path))
            );
            const base64Images = imageBuffers.map(buf => buf.toString('base64'));

            // Construct stuck detection prompt
            const prompt = this._constructStuckDetectionPrompt(expectedActivity);

            // Call vision API with multiple images
            const detection = await this._callVisionAPIMultiImage(base64Images, prompt);

            this.logger.system('vision-analysis', `[VISION] ✅ Stuck detection complete: ${detection.stuck ? 'STUCK' : 'PROGRESSING'}`);

            return detection;

        } catch (error) {
            this.logger.error(`[VISION] Stuck detection failed: ${error.message}`, {
                category: 'vision-analysis',
                component: 'vision-analysis',
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Construct analysis prompt for success criteria verification
     * 
     * @param {string} successCriteria - What to verify
     * @param {Object} context - Additional context
     * @returns {string} Prompt
     * @private
     */
    _constructAnalysisPrompt(successCriteria, context) {
        return `You are a visual verification expert analyzing a screenshot to verify task completion.

**Success Criteria:** ${successCriteria}

${context.action ? `**Task Action:** ${context.action}` : ''}
${context.executionResults ? `**Execution Results:** ${JSON.stringify(context.executionResults)}` : ''}

**Instructions:**
1. Carefully examine the screenshot
2. Verify if the success criteria is met based on what you see
3. Provide specific visual evidence from the screenshot
4. Return ONLY a JSON object with NO markdown formatting

**Required JSON format:**
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "string - explanation why verified or not",
  "visual_evidence": {
    "observed": "string - what you see in the screenshot",
    "matches_criteria": boolean,
    "details": "string - specific visual details that confirm or deny"
  },
  "suggestions": "string - if not verified, what needs to change"
}

Analyze the screenshot and return ONLY the JSON object.`;
    }

    /**
     * Construct comparison prompt for change detection
     * 
     * @param {string} expectedChange - What change to look for
     * @returns {string} Prompt
     * @private
     */
    _constructComparisonPrompt(expectedChange) {
        return `You are comparing two screenshots to detect changes.

**Expected Change:** ${expectedChange}

**Instructions:**
1. Examine both screenshots carefully
2. Identify any differences between them
3. Determine if the expected change occurred
4. Provide specific visual evidence

**Required JSON format:**
{
  "changeDetected": boolean,
  "matchesExpectedChange": boolean,
  "confidence": number (0-100),
  "differences": ["array of specific differences observed"],
  "visual_evidence": "string - describe the change visually",
  "explanation": "string - whether this matches the expected change"
}

Return ONLY the JSON object.`;
    }

    /**
     * Construct stuck detection prompt
     * 
     * @param {string} expectedActivity - What should be happening
     * @returns {string} Prompt
     * @private
     */
    _constructStuckDetectionPrompt(expectedActivity) {
        return `You are analyzing a series of screenshots to detect if a system is stuck.

**Expected Activity:** ${expectedActivity}

**Instructions:**
1. Compare all screenshots chronologically
2. Look for signs of progress or stuck state
3. Identify if the expected activity is occurring
4. Detect repetitive states, frozen UI, or lack of progress

**Required JSON format:**
{
  "stuck": boolean,
  "confidence": number (0-100),
  "reason": "string - why stuck or progressing",
  "visual_evidence": {
    "progress_indicators": ["array of progress signs if any"],
    "stuck_indicators": ["array of stuck signs if any"],
    "last_change_detected": "string - description of last visual change"
  },
  "recommendation": "string - what action to take if stuck"
}

Return ONLY the JSON object.`;
    }

    /**
     * Call vision API with single image
     * Automatically chooses between Ollama (local) or OpenRouter (cloud)
     * 
     * @param {string} base64Image - Base64 encoded image
     * @param {string} prompt - Analysis prompt
     * @returns {Promise<Object>} Parsed analysis result
     * @private
     */
    async _callVisionAPI(base64Image, prompt) {
        try {
            // Use Ollama if available and configured
            if (this.visionProvider === 'ollama' && this.ollamaAvailable) {
                return await this._callOllamaVisionAPI(base64Image, prompt);
            }

            // Fallback to OpenRouter
            return await this._callOpenRouterVisionAPI(base64Image, prompt);

        } catch (error) {
            this.logger.error(`[VISION] API call failed: ${error.message}`, {
                category: 'vision-analysis',
                component: 'vision-analysis',
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Call Ollama vision API (local)
     * @param {string} base64Image - Base64 encoded image
     * @param {string} prompt - Analysis prompt
     * @returns {Promise<Object>} Parsed analysis result
     * @private
     */
    async _callOllamaVisionAPI(base64Image, prompt) {
        try {
            this.logger.system('vision-analysis', '[OLLAMA] Calling local Ollama vision API...');

            const response = await axios.post('http://localhost:11434/api/generate', {
                model: this.visionModel,
                prompt: prompt,
                images: [base64Image],
                stream: false
            }, {
                timeout: 300000,  // 5min timeout for local Ollama processing (M1 MAX needs 120+ sec)
                headers: { 'Content-Type': 'application/json' }
            });

            const content = response.data.response;
            this.logger.system('vision-analysis', '[OLLAMA] ✅ Response received');

            return this._parseVisionResponse(content);

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                this.logger.warn('[OLLAMA] Connection refused - falling back to OpenRouter', {
                    category: 'vision-analysis'
                });
                this.ollamaAvailable = false;
                return await this._callOpenRouterVisionAPI(base64Image, prompt);
            }
            
            // Handle timeout error - fall back to OpenRouter
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                this.logger.warn('[OLLAMA] Timeout after 300s - falling back to OpenRouter', {
                    category: 'vision-analysis',
                    error: error.message
                });
                this.ollamaAvailable = false;
                return await this._callOpenRouterVisionAPI(base64Image, prompt);
            }
            
            throw error;
        }
    }

    /**
     * Call OpenRouter vision API (cloud)
     * @param {string} base64Image - Base64 encoded image
     * @param {string} prompt - Analysis prompt
     * @returns {Promise<Object>} Parsed analysis result
     * @private
     */
    async _callOpenRouterVisionAPI(base64Image, prompt) {
        try {
            this.logger.system('vision-analysis', '[OPENROUTER] Calling OpenRouter vision API...');

            const apiEndpoint = 'http://localhost:4000/v1/chat/completions';
            const response = await axios.post(apiEndpoint, {
                model: this.visionModel,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`,
                                    detail: 'auto'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.2
            }, {
                timeout: 120000,  // 2min timeout for OpenRouter cloud API
                headers: { 'Content-Type': 'application/json' }
            });

            const content = response.data.choices[0].message.content;
            this.logger.system('vision-analysis', '[OPENROUTER] ✅ Response received');

            return this._parseVisionResponse(content);

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Vision API endpoint not available. Ensure OpenRouter API is running on localhost:4000.');
            }
            
            // Handle timeout error
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                this.logger.error('[OPENROUTER] Timeout - both vision APIs failed', {
                    category: 'vision-analysis',
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * Call vision API with multiple images
     * 
     * @param {Array<string>} base64Images - Array of base64 encoded images
     * @param {string} prompt - Analysis prompt
     * @returns {Promise<Object>} Parsed analysis result
     * @private
     */
    async _callVisionAPIMultiImage(base64Images, prompt) {
        try {
            const content = [
                { type: 'text', text: prompt }
            ];

            // Add all images
            for (let i = 0; i < base64Images.length; i++) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/png;base64,${base64Images[i]}`,
                        detail: this.config.imageDetailLevel
                    }
                });
            }

            const response = await axios.post(this.config.apiEndpoint, {
                model: this.config.visionModel,
                messages: [
                    {
                        role: 'user',
                        content
                    }
                ],
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature
            }, {
                timeout: this.config.timeout,
                headers: { 'Content-Type': 'application/json' }
            });

            const responseContent = response.data.choices[0].message.content;

            // Parse JSON response
            return this._parseVisionResponse(responseContent);

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Vision API endpoint not available. Ensure API server is running.');
            }
            throw error;
        }
    }

    /**
     * Parse vision API response
     * Handles markdown-wrapped JSON
     * 
     * @param {string} content - Raw API response
     * @returns {Object} Parsed JSON
     * @private
     */
    _parseVisionResponse(content) {
        let cleaned = content.trim();

        // Remove markdown code block wrappers
        cleaned = cleaned
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch (error) {
            this.logger.error(`[VISION] Failed to parse vision response: ${error.message}`, {
                category: 'vision-analysis',
                component: 'vision-analysis',
                rawContent: content.substring(0, 200)
            });
            throw new Error(`Vision API returned invalid JSON: ${error.message}`);
        }
    }

    /**
     * Get service status
     * 
     * @returns {Object} Status info
     */
    getStatus() {
        return {
            initialized: this.initialized,
            visionModel: this.config.visionModel,
            apiEndpoint: this.config.apiEndpoint,
            imageDetailLevel: this.config.imageDetailLevel
        };
    }

    /**
     * Cleanup and shutdown
     */
    async destroy() {
        this.initialized = false;
        this.logger.system('vision-analysis', '[VISION] Vision Analysis Service destroyed');
    }
}

export default VisionAnalysisService;
