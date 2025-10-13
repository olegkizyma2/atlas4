/**
 * ATLAS ORCHESTRATOR - Chat Routes
 * Version: 4.0
 * 
 * Chat streaming endpoints and session management
 */

import logger from '../../utils/logger.js';
import pauseState from '../../state/pause-state.js';
import { executeStepByStepWorkflow } from '../../workflow/executor-v3.js';
import { chatCompletion, getAvailableModels } from '../../ai/fallback-llm.js';

/**
 * Налаштовує chat та session management routes
 * @param {express.Application} app Express додаток
 * @param {Object} context Контекст з sessions, networkConfig та DI container
 */
export function setupChatRoutes(app, context) {
    const { sessions, networkConfig, container } = context;

    // =============================================================================
    // CHAT STREAMING ENDPOINT
    // =============================================================================

    app.post('/chat/stream', async (req, res) => {
        const { message, sessionId = 'default', stopDispatch = false } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        logger.workflow('start', 'system', `Starting workflow for message: "${message.substring(0, 100)}..."`, {
            sessionId,
            messageLength: message.length
        });

        // Налаштовуємо streaming response (SSE формат)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }

        // Отримуємо існуючу або створюємо нову сесію
        let session = sessions.get(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                history: [],
                currentStage: 0,
                retryCycle: 0,
                lastInteraction: Date.now(),
                originalMessage: message,
                waitingForConfirmation: false,
                lastMode: undefined,
                chatThread: { messages: [], lastTopic: undefined },
                container: container  // ✅ NEW: Add DI container to session for MCP workflow
            };
            sessions.set(sessionId, session);
        } else {
            session.lastInteraction = Date.now();
            session.originalMessage = message;
            session.container = container;  // ✅ NEW: Update container in existing session
        }

        // Keep-alive пінги
        const keepAlive = setInterval(() => {
            try {
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ type: 'keepalive', ts: Date.now() })}\n\n`);
                }
            } catch (e) {
                clearInterval(keepAlive);
            }
        }, networkConfig.KEEPALIVE_INTERVAL);

        // Запускаємо workflow
        try {
            await executeStepByStepWorkflow(message, session, res, { stopDispatch });
        } catch (error) {
            logger.error('Step-by-step workflow failed', {
                error: error.message,
                sessionId,
                stack: error.stack
            });
            if (!res.headersSent) {
                res.write(`data: ${JSON.stringify({
                    type: 'workflow_error',
                    data: {
                        error: 'Workflow failed',
                        details: error.message
                    }
                })}\n\n`);
            }
        } finally {
            clearInterval(keepAlive);
            if (!res.writableEnded) {
                res.end();
            }
        }
    });

    // =============================================================================
    // SESSION MANAGEMENT
    // =============================================================================

    // Pause session
    app.post('/session/pause', (req, res) => {
        const { sessionId } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
        pauseState.setPaused(sessionId, true);
        logger.session(sessionId, 'pause', 'Session paused by user request');
        res.json({ success: true, paused: true });
    });

    // Resume session
    app.post('/session/resume', (req, res) => {
        const { sessionId } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
        pauseState.setPaused(sessionId, false);
        logger.session(sessionId, 'resume', 'Session resumed by user request');
        res.json({ success: true, paused: false });
    });

    // Confirmation endpoint
    app.post('/chat/confirm', async (req, res) => {
        const { sessionId, messageId } = req.body;

        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        logger.session(sessionId, 'confirm', `Message confirmed: ${messageId}`);

        session.waitingForConfirmation = false;
        session.lastConfirmedMessage = messageId;
        session.lastInteraction = Date.now();

        res.json({ success: true, confirmed: messageId });
    });

    // TTS Optimization Settings
    app.get('/tts/optimization/settings', async (req, res) => {
        try {
            const { default: ttsOptimizer } = await import('../../agents/tts-optimizer.js');
            const stats = ttsOptimizer.getStats();

            res.json({
                success: true,
                settings: {
                    currentLimit: stats.characterLimit.current,
                    customLimit: stats.characterLimit.custom,
                    defaultLimit: stats.characterLimit.default,
                    isCustomSet: stats.characterLimit.isCustomSet,
                    optimizer: {
                        name: stats.name,
                        signature: stats.signature,
                        status: stats.status
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting TTS optimization settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get TTS optimization settings',
                details: error.message
            });
        }
    });

    // Set TTS character limit
    app.post('/tts/optimization/limit', async (req, res) => {
        try {
            const { limit } = req.body;

            if (typeof limit !== 'number' || limit <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid limit. Must be a positive number.'
                });
            }

            const { default: ttsOptimizer } = await import('../../agents/tts-optimizer.js');
            const result = ttsOptimizer.setUserCharacterLimit(limit);

            if (result) {
                res.json({
                    success: true,
                    message: `Character limit set to ${limit}`,
                    newLimit: ttsOptimizer.getCurrentCharacterLimit()
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to set character limit'
                });
            }
        } catch (error) {
            logger.error('Error setting TTS character limit:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to set character limit',
                details: error.message
            });
        }
    });

    // Reset TTS character limit
    app.post('/tts/optimization/reset', async (req, res) => {
        try {
            const { default: ttsOptimizer } = await import('../../agents/tts-optimizer.js');
            ttsOptimizer.resetUserCharacterLimit();

            res.json({
                success: true,
                message: 'Character limit reset to default',
                currentLimit: ttsOptimizer.getCurrentCharacterLimit()
            });
        } catch (error) {
            logger.error('Error resetting TTS character limit:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset character limit',
                details: error.message
            });
        }
    });

    // =============================================================================
    // FALLBACK LLM ENDPOINTS
    // =============================================================================

    // List models
    app.get('/v1/models', (req, res) => {
        res.json({
            object: 'list',
            data: getAvailableModels()
        });
    });

    // Chat completions
    app.post('/v1/chat/completions', async (req, res) => {
        try {
            const result = await chatCompletion(req.body.messages, {
                model: req.body.model,
                max_tokens: req.body.max_tokens,
                temperature: req.body.temperature,
                stream: req.body.stream
            });

            if (req.body.stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                result.data.on('data', chunk => {
                    res.write(chunk);
                });

                result.data.on('end', () => {
                    res.end();
                });
            } else {
                res.json(result);
            }
        } catch (error) {
            logger.error('Fallback LLM error', { error: error.message, stack: error.stack });
            res.status(500).json({
                error: {
                    message: error.message,
                    type: 'internal_error'
                }
            });
        }
    });
}

export default setupChatRoutes;
