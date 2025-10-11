/**
 * ATLAS ORCHESTRATOR - Application Lifecycle Manager
 * Version: 4.0
 * 
 * Управління життєвим циклом додатку: ініціалізація, запуск, зупинка
 * Використовує DI Container для управління залежностями
 */

import { DIContainer } from './di-container.js';
import { registerAllServices } from './service-registry.js';
import { createApp, setupErrorHandling } from '../app.js';
import { configureAxios } from '../utils/axios-config.js';

// Routes
import setupHealthRoutes from '../api/routes/health.routes.js';
import setupChatRoutes from '../api/routes/chat.routes.js';
import setupWebRoutes from '../api/routes/web.routes.js';

/**
 * Клас управління життєвим циклом ATLAS Orchestrator
 */
export class Application {
    constructor() {
        this.app = null;
        this.server = null;
        this.container = new DIContainer();
        this.configInitialized = false;

        // Services (будуть резолвлені через DI)
        this.logger = null;
        this.config = null;
        this.wsManager = null;
        this.errorHandler = null;
        this.sessions = null;
        this.networkConfig = null;
    }

    /**
     * Ініціалізація DI Container та сервісів
     */
    async initializeServices() {
        // Configure Axios з retry logic для 429 помилок
        configureAxios();
        this.logger?.system?.('axios', 'Axios configured with 429 rate limit handling') ||
            console.log('[INIT] Axios configured with 429 rate limit handling');

        // Реєструємо всі сервіси
        registerAllServices(this.container);

        // Ініціалізуємо сервіси (викликає onInit hooks)
        await this.container.initialize();

        // Резолвимо необхідні сервіси
        this.logger = this.container.resolve('logger');
        this.config = this.container.resolve('config');
        this.wsManager = this.container.resolve('wsManager');
        this.errorHandler = this.container.resolve('errorHandler');
        this.sessions = this.container.resolve('sessions');
        this.networkConfig = this.container.resolve('networkConfig');

        this.logger.system('startup', '[DI] All services resolved successfully');
    }

    /**
     * Ініціалізація конфігурації
     */
    async initializeConfig() {
        try {
            this.logger.system('startup', 'Validating configuration...');
            this.config.validateConfig();

            this.configInitialized = true;

            this.logger.system('startup', 'Configuration validated successfully', {
                agents: Object.keys(this.config.AGENTS).length,
                stages: this.config.WORKFLOW_STAGES.length,
                services: Object.keys(this.networkConfig.services).length
            });
        } catch (error) {
            this.logger.error('Failed to validate configuration', { error: error.message });
            throw error;
        }
    }

    /**
     * Створення та налаштування Express app
     */
    async setupApplication() {
        // Створюємо Express app
        this.app = createApp();

        // Налаштовуємо routes
        setupHealthRoutes(this.app, { configInitialized: this.configInitialized, networkConfig: this.networkConfig });
        setupChatRoutes(this.app, { sessions: this.sessions, networkConfig: this.networkConfig });
        setupWebRoutes(this.app);

        // Налаштовуємо обробку помилок
        setupErrorHandling(this.app, this.errorHandler);

        this.logger.system('startup', 'Application routes configured');
    }

    /**
     * Запуск session cleanup таймера
     */
    startSessionCleanup() {
        const maxAge = this.networkConfig.SESSION_TIMEOUT;

        setInterval(() => {
            const now = Date.now();

            for (const [sessionId, session] of this.sessions.entries()) {
                if (now - session.lastInteraction > maxAge) {
                    this.sessions.delete(sessionId);
                    this.logger.session(sessionId, 'cleanup', 'Session expired and removed');
                }
            }
        }, Math.floor(this.networkConfig.SESSION_TIMEOUT / 2));

        this.logger.system('startup', 'Session cleanup timer started');
    }

    /**
     * Запуск WebSocket сервера
     */
    async startWebSocket() {
        const wsPort = this.networkConfig.services.recovery.port;
        this.wsManager.start(wsPort);
        this.logger.system('websocket', `WebSocket server running on port ${wsPort}`);
    }

    /**
     * Запуск HTTP сервера
     */
    async startServer() {
        const PORT = this.networkConfig.services.orchestrator.port;

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(PORT, () => {
                    this.logger.system('startup', `🚀 ATLAS Orchestrator v4.0 running on port ${PORT}`);
                    this.logger.system('features', 'DI Container, Unified Configuration, Prompt Registry, Web Integration, Real-time Logging, 3D Model Control, TTS Visualization, Centralized State, Unified Error Handling, Agent Manager, Telemetry & Monitoring');
                    this.logger.system('config', `Configuration loaded: ${Object.keys(this.config.AGENTS).length} agents, ${this.config.WORKFLOW_STAGES.length} stages`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    this.logger.error('Server failed to start', { error: error.message });
                    reject(error);
                });
            } catch (error) {
                this.logger.error('Server startup error', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('Shutting down gracefully...');

        try {
            // Зупиняємо сервіси через DI lifecycle
            await this.container.stop();

            // Закриваємо HTTP сервер
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }

            this.logger.system('shutdown', 'Application stopped successfully');
        } catch (error) {
            console.error('Error during shutdown:', error);
            throw error;
        }
    }

    /**
     * Повний цикл запуску додатку
     */
    async start() {
        try {
            // 1. Ініціалізуємо DI Container та сервіси
            await this.initializeServices();

            // 2. Валідуємо конфігурацію
            await this.initializeConfig();

            // 3. Запускаємо сервіси (onStart hooks)
            await this.container.start();

            // 4. Налаштовуємо додаток
            await this.setupApplication();

            // 5. Запускаємо session cleanup
            this.startSessionCleanup();

            // 6. Запускаємо WebSocket
            await this.startWebSocket();

            // 7. Запускаємо HTTP сервер
            await this.startServer();

            // 8. Налаштовуємо graceful shutdown
            this.setupShutdownHandlers();

            this.logger.system('startup', '✅ ATLAS Orchestrator fully initialized with DI Container');
        } catch (error) {
            if (this.logger) {
                this.logger.error('Application startup failed', { error: error.message });
            } else {
                console.error('Application startup failed:', error);
            }
            process.exit(1);
        }
    }

    /**
     * Налаштування обробників graceful shutdown
     */
    setupShutdownHandlers() {
        process.on('SIGINT', () => {
            this.shutdown()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
        });

        process.on('SIGTERM', () => {
            this.shutdown()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
        });
    }
}

export default Application;
