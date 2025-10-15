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
import { MCPManager } from '../ai/mcp-manager.js';
import { MCPTodoManager } from '../workflow/mcp-todo-manager.js';
import { TTSSyncManager } from '../workflow/tts-sync-manager.js';
import {
    BackendSelectionProcessor,
    AtlasTodoPlanningProcessor,
    ServerSelectionProcessor,  // NEW 15.10.2025
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    McpFinalSummaryProcessor
} from '../workflow/stages/index.js';

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
 * Реєструє MCP workflow сервіси (Phase 4)
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerMCPWorkflowServices(container) {

    // MCPManager - керування MCP servers
    // FIXED 14.10.2025 - Create instance synchronously, initialize in lifecycle
    container.singleton('mcpManager', (c) => {
        const config = c.resolve('config');
        const serversConfig = config.AI_BACKEND_CONFIG?.providers?.mcp?.servers || {};

        // Create MCPManager instance (doesn't start servers yet)
        // Actual initialization (spawning servers) happens in onInit hook
        return new MCPManager(serversConfig);
    }, {
        dependencies: ['config'],
        metadata: { category: 'workflow', priority: 55 },
        lifecycle: {
            onInit: async function () {
                // FIXED 14.10.2025 - Initialize MCPManager (spawn servers, load tools)
                // this = MCPManager instance
                // Without this call, listTools() returns empty array!
                await this.initialize();
                logger.system('startup', '[DI] MCPManager initialized with servers');
            }
        }
    });

    // TTSSyncManager - TTS synchronization для MCP workflow
    // FIXED 14.10.2025 NIGHT - Pass wsManager as ttsService for WebSocket TTS delivery
    container.singleton('ttsSyncManager', (c) => {
        return new TTSSyncManager({
            ttsService: c.resolve('wsManager'),  // FIXED: Use wsManager for WebSocket TTS
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['wsManager', 'logger'],  // FIXED: Added wsManager dependency
        metadata: { category: 'workflow', priority: 60 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] TTSSyncManager initialized with WebSocket TTS');
            }
        }
    });

    // MCPTodoManager - головний менеджер MCP TODO
    container.singleton('mcpTodoManager', (c) => {
        return new MCPTodoManager({
            mcpManager: c.resolve('mcpManager'),
            llmClient: null,  // Will be lazy-loaded when needed
            ttsSyncManager: c.resolve('ttsSyncManager'),
            wsManager: c.resolve('wsManager'),  // ADDED 14.10.2025 - For chat updates
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpManager', 'ttsSyncManager', 'wsManager', 'logger'],
        metadata: { category: 'workflow', priority: 50 },
        lifecycle: {
            onInit: async function () {
                logger.system('startup', '[DI] MCPTodoManager initialized');
            }
        }
    });

    return container;
}

/**
 * Реєструє MCP stage processors (Phase 4)
 *
 * @param {DIContainer} container - DI контейнер
 * @returns {DIContainer}
 */
export function registerMCPProcessors(container) {
    // Backend Selection Processor (Stage 0.5)
    container.singleton('backendSelectionProcessor', (c) => {
        return new BackendSelectionProcessor({
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Atlas TODO Planning Processor (Stage 1-MCP)
    container.singleton('atlasTodoPlanningProcessor', (c) => {
        return new AtlasTodoPlanningProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Server Selection Processor (Stage 2.0-MCP) - NEW 15.10.2025
    container.singleton('serverSelectionProcessor', (c) => {
        return new ServerSelectionProcessor({
            mcpManager: c.resolve('mcpManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Tetyana Plan Tools Processor (Stage 2.1-MCP)
    container.singleton('tetyanaПlanToolsProcessor', (c) => {
        return new TetyanaПlanToolsProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            mcpManager: c.resolve('mcpManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Tetyana Execute Tools Processor (Stage 2.2-MCP)
    container.singleton('tetyanaExecuteToolsProcessor', (c) => {
        return new TetyanaExecuteToolsProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Grisha Verify Item Processor (Stage 2.3-MCP)
    container.singleton('grishaVerifyItemProcessor', (c) => {
        return new GrishaVerifyItemProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            mcpManager: c.resolve('mcpManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // Atlas Adjust TODO Processor (Stage 3-MCP)
    container.singleton('atlasAdjustTodoProcessor', (c) => {
        return new AtlasAdjustTodoProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    // MCP Final Summary Processor (Stage 8-MCP)
    container.singleton('mcpFinalSummaryProcessor', (c) => {
        return new McpFinalSummaryProcessor({
            mcpTodoManager: c.resolve('mcpTodoManager'),
            logger: c.resolve('logger')
        });
    }, {
        dependencies: ['mcpTodoManager', 'logger'],
        metadata: { category: 'processors', priority: 40 }
    });

    logger.system('startup', '[DI] Registered 8 MCP stage processors');  // UPDATED 15.10.2025 (was 7)

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
    registerMCPWorkflowServices(container);
    registerMCPProcessors(container);

    logger.system('startup', `[DI] Registered ${container.getServices().length} services`, {
        services: container.getServices()
    });

    return container;
}

export default registerAllServices;
