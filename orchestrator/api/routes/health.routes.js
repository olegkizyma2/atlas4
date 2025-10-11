/**
 * ATLAS ORCHESTRATOR - Health Routes
 * Version: 4.0
 * 
 * Health check, configuration info, metrics endpoints
 */

import GlobalConfig from '../../../config/global-config.js';
import wsManager from '../websocket-manager.js';
import webIntegration from '../web-integration.js';

/**
 * Налаштовує health та system info routes
 * @param {express.Application} app Express додаток
 * @param {Object} context Контекст з configInitialized та networkConfig
 */
export function setupHealthRoutes(app, context) {
    const { configInitialized, networkConfig } = context;

    // Health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            version: '4.0',
            config: configInitialized,
            promptsValidated: true
        });
    });

    // Configuration info
    app.get('/config', (req, res) => {
        if (!configInitialized) {
            return res.status(503).json({ error: 'Configuration not initialized' });
        }
        res.json({
            agents: Object.keys(GlobalConfig.AGENTS).length,
            stages: GlobalConfig.WORKFLOW_STAGES.length,
            services: Object.keys(GlobalConfig.NETWORK_CONFIG.services).length,
            initialized: configInitialized
        });
    });

    // System metrics
    app.get('/metrics', (req, res) => {
        res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            websocket: wsManager.getStats(),
            webIntegration: webIntegration.getStats()
        });
    });

    // Agents configuration
    app.get('/agents', async (req, res) => {
        if (!configInitialized) {
            return res.status(503).json({ error: 'Configuration not initialized' });
        }

        const agents = GlobalConfig.AGENTS;
        res.json(agents);
    });

    // Workflow configuration
    app.get('/workflow', async (req, res) => {
        if (!configInitialized) {
            return res.status(503).json({ error: 'Configuration not initialized' });
        }

        const config = GlobalConfig;
        res.json({
            stages: config.WORKFLOW_STAGES,
            config: config.WORKFLOW_CONFIG
        });
    });
}

export default setupHealthRoutes;
