/**
 * ATLAS ORCHESTRATOR - Web Integration Routes
 * Version: 4.0
 * 
 * Web interface state, logs, 3D model, TTS visualization
 */

import webIntegration from '../web-integration.js';
import wsManager from '../websocket-manager.js';

/**
 * Налаштовує web integration routes
 * @param {express.Application} app Express додаток
 */
export function setupWebRoutes(app) {
    // =============================================================================
    // WEB STATE & LOGS
    // =============================================================================

    // Отримати поточний стан веб-інтерфейсу
    app.get('/web/state', (req, res) => {
        res.json(webIntegration.getWebState());
    });

    // Додати лог до веб-інтерфейсу
    app.post('/web/logs', (req, res) => {
        const { level, message, source, metadata } = req.body;

        if (!level || !message) {
            return res.status(400).json({ error: 'Level and message are required' });
        }

        const logEntry = webIntegration.addWebLog(level, message, source, metadata);
        res.json({ success: true, logEntry });
    });

    // =============================================================================
    // 3D MODEL API
    // =============================================================================

    // Update 3D model state
    app.post('/web/model3d/update', (req, res) => {
        const updates = req.body;
        const newState = webIntegration.update3DModel(updates);
        res.json({ success: true, state: newState });
    });

    // Trigger animation
    app.post('/web/model3d/animation', (req, res) => {
        const { type, context } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'Animation type is required' });
        }

        const result = webIntegration.triggerAnimation(type, context);
        res.json({ success: true, animation: result });
    });

    // Set agent emotion
    app.post('/web/model3d/emotion', (req, res) => {
        const { agent, emotion, intensity, duration } = req.body;

        if (!agent || !emotion) {
            return res.status(400).json({ error: 'Agent and emotion are required' });
        }

        const result = webIntegration.setAgentEmotion(agent, emotion, intensity, duration);
        res.json({ success: true, emotion: result });
    });

    // =============================================================================
    // TTS VISUALIZATION API
    // =============================================================================

    // Start TTS visualization
    app.post('/web/tts/start', (req, res) => {
        const { text, options } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const result = webIntegration.startTTSVisualization(text, options);
        res.json({ success: true, tts: result });
    });

    // Stop TTS visualization
    app.post('/web/tts/stop', (req, res) => {
        const result = webIntegration.stopTTSVisualization();
        res.json({ success: true, tts: result });
    });

    // Update audio analysis
    app.post('/web/tts/analysis', (req, res) => {
        const { analysisData } = req.body;

        if (!analysisData) {
            return res.status(400).json({ error: 'Analysis data is required' });
        }

        const result = webIntegration.updateAudioAnalysis(analysisData);
        res.json({ success: true, analysis: result });
    });

    // =============================================================================
    // WEBSOCKET STATUS
    // =============================================================================

    // WebSocket status
    app.get('/web/websocket/status', (req, res) => {
        res.json(wsManager.getStats());
    });
}

export default setupWebRoutes;
