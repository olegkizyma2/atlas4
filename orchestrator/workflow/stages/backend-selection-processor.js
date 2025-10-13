/**
 * @fileoverview Backend Selection Processor (Stage 0.5)
 * Routes requests to Goose or MCP workflow based on keywords and configuration
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';
import GlobalConfig from '../../../config/global-config.js';

/**
 * Backend Selection Processor
 * 
 * Determines whether to use Goose Desktop or MCP Direct workflow
 * based on request analysis and AI_BACKEND_CONFIG settings.
 */
export class BackendSelectionProcessor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ logger: loggerInstance }) {
        this.logger = loggerInstance || logger;
        this.config = GlobalConfig.AI_BACKEND_CONFIG;
    }

    /**
     * Execute backend selection
     * 
     * @param {Object} context - Stage context
     * @param {string} context.userMessage - User request
     * @param {Object} [context.session] - Session context
     * @returns {Promise<Object>} Selection result
     */
    async execute(context) {
        this.logger.system('backend-selection', '[STAGE-0.5] Starting backend selection...');

        const { userMessage, session } = context;

        try {
            // Get configured mode
            const configuredMode = this.config.mode;

            this.logger.system('backend-selection', `[STAGE-0.5] Configured mode: ${configuredMode}`);

            let selectedBackend;

            switch (configuredMode) {
                case 'goose':
                    // Always use Goose
                    selectedBackend = 'goose';
                    this.logger.system('backend-selection', '[STAGE-0.5] Mode=goose → Routing to Goose Desktop');
                    break;

                case 'mcp':
                    // Always use MCP
                    selectedBackend = 'mcp';
                    this.logger.system('backend-selection', '[STAGE-0.5] Mode=mcp → Routing to MCP Direct');
                    break;

                case 'hybrid':
                    // Analyze request and select automatically
                    selectedBackend = this._analyzeRequest(userMessage);
                    this.logger.system('backend-selection', `[STAGE-0.5] Mode=hybrid → Analysis result: ${selectedBackend}`);
                    break;

                default:
                    // Default to primary backend
                    selectedBackend = this.config.primary || 'goose';
                    this.logger.warning('backend-selection', `[STAGE-0.5] Unknown mode '${configuredMode}', defaulting to ${selectedBackend}`);
            }

            // Log selection reasoning
            const reasoning = this._getSelectionReasoning(userMessage, selectedBackend);

            this.logger.system('backend-selection', `[STAGE-0.5] ✅ Selected backend: ${selectedBackend}`);
            this.logger.system('backend-selection', `[STAGE-0.5] Reasoning: ${reasoning}`);

            return {
                success: true,
                backend: selectedBackend,
                reasoning,
                metadata: {
                    configuredMode,
                    primaryBackend: this.config.primary,
                    fallbackBackend: this.config.fallback,
                    analysisPerformed: configuredMode === 'hybrid'
                }
            };

        } catch (error) {
            this.logger.error('backend-selection', `[STAGE-0.5] Selection failed: ${error.message}`);
            
            // Fallback to primary backend on error
            const fallbackBackend = this.config.primary || 'goose';
            
            this.logger.warning('backend-selection', `[STAGE-0.5] Falling back to ${fallbackBackend}`);

            return {
                success: true,
                backend: fallbackBackend,
                reasoning: `Error during selection, falling back to ${fallbackBackend}`,
                metadata: {
                    error: error.message,
                    fallback: true
                }
            };
        }
    }

    /**
     * Analyze request and determine optimal backend
     * 
     * @param {string} request - User request text
     * @returns {string} Selected backend ('goose' or 'mcp')
     * @private
     */
    _analyzeRequest(request) {
        const requestLower = request.toLowerCase();

        // Get keyword lists from config
        const mcpKeywords = this.config.routing?.mcpKeywords || [];
        const gooseKeywords = this.config.routing?.gooseKeywords || [];

        // Count keyword matches
        let mcpScore = 0;
        let gooseScore = 0;

        // Check MCP keywords
        for (const keyword of mcpKeywords) {
            if (requestLower.includes(keyword.toLowerCase())) {
                mcpScore++;
                this.logger.system('backend-selection', `[STAGE-0.5] MCP keyword matched: "${keyword}"`);
            }
        }

        // Check Goose keywords
        for (const keyword of gooseKeywords) {
            if (requestLower.includes(keyword.toLowerCase())) {
                gooseScore++;
                this.logger.system('backend-selection', `[STAGE-0.5] Goose keyword matched: "${keyword}"`);
            }
        }

        this.logger.system('backend-selection', `[STAGE-0.5] Keyword scores - MCP: ${mcpScore}, Goose: ${gooseScore}`);

        // Decision logic
        if (mcpScore > gooseScore) {
            return 'mcp';
        } else if (gooseScore > mcpScore) {
            return 'goose';
        } else {
            // Tie or no matches - additional heuristics
            return this._applyHeuristics(request);
        }
    }

    /**
     * Apply additional heuristics when keyword scores are tied
     * 
     * @param {string} request - User request text
     * @returns {string} Selected backend ('goose' or 'mcp')
     * @private
     */
    _applyHeuristics(request) {
        const requestLower = request.toLowerCase();

        // MCP heuristics - concrete actions with specific tools
        const mcpPatterns = [
            /створ(и|ити|ю)\s+(файл|теку|папку)/i,
            /відкр(ий|ити|иваю)\s+(браузер|сторінк)/i,
            /збер(и|ігти|ежи)\s+(файл|на\s+desktop)/i,
            /скрін(шот|)/i,
            /знайд(и|іть)\s+(на|в)\s+(сайті|auto\.ria|olx)/i,
            /зібр(ати|ай)\s+(дані|ціни|інформацію)/i
        ];

        // Goose heuristics - analytical tasks
        const goosePatterns = [
            /проаналіз(уй|ювати)/i,
            /порівня(й|ти)/i,
            /поясн(и|ити)/i,
            /знайд(и|іть)\s+(інформацію|дані)\s+про/i,
            /що\s+таке/i,
            /як\s+працює/i,
            /навіщо/i,
            /чому/i
        ];

        // Check MCP patterns
        for (const pattern of mcpPatterns) {
            if (pattern.test(request)) {
                this.logger.system('backend-selection', `[STAGE-0.5] MCP pattern matched: ${pattern}`);
                return 'mcp';
            }
        }

        // Check Goose patterns
        for (const pattern of goosePatterns) {
            if (pattern.test(request)) {
                this.logger.system('backend-selection', `[STAGE-0.5] Goose pattern matched: ${pattern}`);
                return 'goose';
            }
        }

        // Request length heuristic
        const wordCount = request.split(/\s+/).length;
        
        if (wordCount <= 5) {
            // Short requests - likely concrete actions → MCP
            this.logger.system('backend-selection', `[STAGE-0.5] Short request (${wordCount} words) → MCP`);
            return 'mcp';
        } else if (wordCount > 15) {
            // Long requests - likely complex analysis → Goose
            this.logger.system('backend-selection', `[STAGE-0.5] Long request (${wordCount} words) → Goose`);
            return 'goose';
        }

        // Default to primary backend
        const defaultBackend = this.config.primary || 'goose';
        this.logger.system('backend-selection', `[STAGE-0.5] No clear match, defaulting to ${defaultBackend}`);
        
        return defaultBackend;
    }

    /**
     * Get human-readable reasoning for selection
     * 
     * @param {string} request - User request
     * @param {string} backend - Selected backend
     * @returns {string} Reasoning text
     * @private
     */
    _getSelectionReasoning(request, backend) {
        const requestLower = request.toLowerCase();

        if (backend === 'mcp') {
            // Find which MCP keyword/pattern matched
            const mcpKeywords = this.config.routing?.mcpKeywords || [];
            
            for (const keyword of mcpKeywords) {
                if (requestLower.includes(keyword.toLowerCase())) {
                    return `Concrete action detected ("${keyword}") → Direct MCP execution for speed`;
                }
            }

            return 'Request pattern suggests concrete file/browser/system operations → MCP Direct';
        } else {
            // Goose reasoning
            const gooseKeywords = this.config.routing?.gooseKeywords || [];
            
            for (const keyword of gooseKeywords) {
                if (requestLower.includes(keyword.toLowerCase())) {
                    return `Analytical task detected ("${keyword}") → Goose Desktop for complex reasoning`;
                }
            }

            return 'Request requires analysis/research/comparison → Goose Desktop';
        }
    }

    /**
     * Get backend configuration
     * 
     * @returns {Object} Backend config
     */
    getBackendConfig() {
        return {
            mode: this.config.mode,
            primary: this.config.primary,
            fallback: this.config.fallback,
            mcpKeywords: this.config.routing?.mcpKeywords || [],
            gooseKeywords: this.config.routing?.gooseKeywords || []
        };
    }
}

export default BackendSelectionProcessor;
