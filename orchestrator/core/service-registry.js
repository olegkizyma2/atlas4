/**
 * ATLAS ORCHESTRATOR - Service Registry
 * Version: 4.0
 *
 * Централізована реєстрація всіх сервісів orchestrator
 * Визначає залежності та lifecycle для кожного сервісу
 */

import logger from '../utils/logger.js';
import errorHandler from '../errors/error-handler.js';
import telemetry from '../utils/telemetry.js';
import wsManager from '../api/websocket-manager.js';
import webIntegration from '../api/web-integration.js';
import GlobalConfig from '../../config/global-config.js';

/**
 * Реєструє всі core сервіси в DI контейнері
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerCoreServices(container) {
    // 1. Configuration - завжди першим
    container.singleton('config', () => GlobalConfig, {
        metadata: { category: 'core', priority: 100 }
    });

    // 2. Logger - базова інфраструктура
    container.singleton('logger', () => logger, {
        metadata: { category: 'infrastructure', priority: 90 },
        lifecycle: {
            onInit: async function () {
                this.system('startup', '[DI] Logger service initialized');
            }
        }
    });

    // 3. Error Handler - обробка помилок
    container.singleton('errorHandler', () => errorHandler, {
        dependencies: ['logger'],
        metadata: { category: 'infrastructure', priority: 85 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] Error handler initialized');
            }
        }
    });

    // 4. Telemetry - метрики та моніторинг
    container.singleton('telemetry', () => telemetry, {
        dependencies: ['logger'],
        metadata: { category: 'monitoring', priority: 80 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] Telemetry initialized');
            }
        }
    });

    return container;
}

/**
 * Реєструє API сервіси
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerApiServices(container) {
    // WebSocket Manager
    container.singleton('wsManager', () => wsManager, {
        dependencies: ['logger', 'config'],
        metadata: { category: 'api', priority: 60 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] WebSocket manager initialized');
            },
            onStart: async function () {
                // WebSocket запускається окремо в Application.startWebSocket()
                logger.system('startup', '[DI] WebSocket manager ready');
            },
            onStop: async function () {
                // Закриття WebSocket connections
                logger.system('shutdown', '[DI] WebSocket manager stopped');
            }
        }
    });

    // Web Integration
    container.singleton('webIntegration', () => webIntegration, {
        dependencies: ['logger'],
        metadata: { category: 'api', priority: 50 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] Web integration initialized');
            }
        }
    });

    return container;
}

/**
 * Реєструє state management сервіси
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerStateServices(container) {
    // Session Store - буде створений динамічно в Application
    container.singleton('sessions', () => new Map(), {
        metadata: { category: 'state', priority: 70 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] Session store initialized');
            },
            onStop: async function () {
                this.clear();
                logger.system('shutdown', '[DI] Session store cleared');
            }
        }
    });

    return container;
}

/**
 * Реєструє utility сервіси
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerUtilityServices(container) {
    // Network Config
    container.value('networkConfig', GlobalConfig.NETWORK_CONFIG);

    return container;
}

/**
 * Повна реєстрація всіх сервісів
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerAllServices(container) {
    logger.system('startup', '[DI] Registering all services...');

    registerCoreServices(container);
    registerApiServices(container);
    registerStateServices(container);
    registerUtilityServices(container);

    logger.system('startup', `[DI] Registered ${container.getServices().length} services`, {
        services: container.getServices()
    });

    return container;
}

export default registerAllServices;
