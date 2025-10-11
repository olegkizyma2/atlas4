/**
 * ATLAS ORCHESTRATOR - Express App Configuration
 * Version: 4.0
 * 
 * Налаштування Express додатку з middleware та CORS
 */

import express from 'express';
import cors from 'cors';
import logger from './utils/logger.js';
import telemetry from './utils/telemetry.js';
import GlobalConfig from '../config/global-config.js';

/**
 * Створює та налаштовує Express додаток
 * @returns {express.Application} Налаштований Express app
 */
export function createApp() {
    const app = express();

    // CORS configuration
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Secret-Key']
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));

    // Request logging and metrics middleware
    app.use((req, res, next) => {
        const start = Date.now();

        // Перехоплюємо завершення відповіді
        res.on('finish', () => {
            const duration = Date.now() - start;
            const status = res.statusCode;

            // Розумний HTTP logger (автоматично фільтрує polling)
            logger.http(req.method, req.url, status, duration, {
                ip: req.ip,
                userAgent: req.get('User-Agent')?.substring(0, 50) + '...' || 'unknown'
            });

            // Метрики
            telemetry.recordExecution('http_request', duration, status < 400, {
                method: req.method,
                path: req.url,
                status
            });
        });

        next();
    });

    return app;
}

/**
 * Налаштовує обробку помилок для Express app
 * @param {express.Application} app Express додаток
 */
export function setupErrorHandling(app, errorHandler) {
    // Серіалізація помилок
    const serializeError = (error) => {
        if (!error || typeof error !== 'object') {
            return { message: String(error) };
        }

        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            details: error.details
        };
    };

    // Global error handlers
    process.on('uncaughtException', (error) => {
        const serialized = serializeError(error);
        logger.error('Необроблене виключення', { error: serialized });
        errorHandler.handleError(error, { global: true })
            .catch(err => {
                logger.error('Помилка при обробці виключення', { error: serializeError(err) });
                process.exit(1);
            });
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Необроблене відхилення проміса', { reason: serializeError(reason) });
        errorHandler.handleError(reason, { global: true, isRejection: true })
            .catch(err => {
                logger.error('Помилка при обробці відхилення проміса', { error: serializeError(err) });
            });
    });

    // Express error handling middleware
    app.use((err, req, res, next) => {
        errorHandler.handleError(err, {
            route: req.path,
            method: req.method
        })
            .then(result => {
                res.status(500).json({
                    error: true,
                    message: err.message,
                    recoveryAction: result.action
                });
            })
            .catch(handlerError => {
                logger.error('Помилка обробника помилок:', handlerError);
                res.status(500).json({
                    error: true,
                    message: 'Internal server error'
                });
            });
    });
}

export default createApp;
