/**
 * @fileoverview AI Provider Interface - уніфікований інтерфейс для всіх AI backends
 * Підтримує Goose Desktop та прямі MCP сервери з автоматичним routing та fallback
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../utils/logger.js';

/**
 * Головний інтерфейс для взаємодії з AI backends
 * Підтримує: Goose Desktop, Direct MCP, Hybrid mode
 */
export class AIProviderInterface {
  /**
   * @param {Object} config - AI_BACKEND_CONFIG з global-config.js
   */
  constructor(config) {
    this.config = config;
    this.providers = {};
    this.metrics = {
      goose: { requests: 0, errors: 0, totalLatency: 0 },
      mcp: { requests: 0, errors: 0, totalLatency: 0 }
    };
  }

  /**
   * Ініціалізація всіх enabled backends
   */
  async initialize() {
    logger.system('ai-provider', '[AI Provider] Initializing backends...');

    // Динамічні імпорти для уникнення circular dependencies
    if (this.config.providers.goose?.enabled) {
      const { GooseBackend } = await import('./backends/goose-backend.js');
      this.providers.goose = new GooseBackend(this.config.providers.goose);
      await this.providers.goose.initialize();
      logger.system('ai-provider', '[AI Provider] ✅ Goose backend initialized');
    }

    if (this.config.providers.mcp?.enabled) {
      const { MCPBackend } = await import('./backends/mcp-backend.js');
      this.providers.mcp = new MCPBackend(this.config.providers.mcp);
      await this.providers.mcp.initialize();
      logger.system('ai-provider', '[AI Provider] ✅ MCP backend initialized');
    }

    const enabledBackends = Object.keys(this.providers);
    logger.system('ai-provider', `[AI Provider] Mode: ${this.config.mode}, Primary: ${this.config.primary}, Enabled: ${enabledBackends.join(', ')}`);
  }

  /**
   * Виконати AI запит через відповідний backend
   * 
   * @param {string} prompt - Текст запиту
   * @param {Object} context - Контекст (sessionId, history, etc)
   * @param {Object} options - Опції виконання
   * @param {string} options.agent - Назва агента (atlas, tetyana, grisha)
   * @param {boolean} options.enableTools - Дозволити використання tools
   * @param {string} options.forceBackend - Примусово використати backend ('goose' | 'mcp')
   * @returns {Promise<Object>} Відповідь AI з метаданими
   */
  async execute(prompt, context, options = {}) {
    const startTime = Date.now();

    // Вибрати backend
    const backend = this.selectBackend(prompt, options);
    
    logger.debug('ai-provider', `[AI Provider] Executing via ${backend} backend`, {
      agent: options.agent,
      enableTools: options.enableTools,
      promptLength: prompt.length
    });

    try {
      // Спроба через primary backend
      const result = await this._executeWithBackend(backend, prompt, context, options);
      
      // Метрики
      const latency = Date.now() - startTime;
      this.metrics[backend].requests++;
      this.metrics[backend].totalLatency += latency;

      logger.debug('ai-provider', `[AI Provider] ✅ Success via ${backend} (${latency}ms)`);

      return {
        ...result,
        metadata: {
          backend,
          latency,
          fallback: false
        }
      };

    } catch (error) {
      logger.error('ai-provider', `[AI Provider] ❌ ${backend} failed: ${error.message}`);
      this.metrics[backend].errors++;

      // Fallback якщо є інший backend
      if (this.config.fallback && this.config.fallback !== backend && this.providers[this.config.fallback]) {
        logger.warn('ai-provider', `[AI Provider] 🔄 Switching to fallback: ${this.config.fallback}`);
        
        try {
          const result = await this._executeWithBackend(this.config.fallback, prompt, context, options);
          const latency = Date.now() - startTime;

          return {
            ...result,
            metadata: {
              backend: this.config.fallback,
              latency,
              fallback: true,
              originalBackend: backend,
              originalError: error.message
            }
          };
        } catch (fallbackError) {
          logger.error('ai-provider', `[AI Provider] ❌ Fallback also failed: ${fallbackError.message}`);
          throw new Error(`Both ${backend} and ${this.config.fallback} backends failed`);
        }
      }

      throw error;
    }
  }

  /**
   * Виконати через конкретний backend
   * @private
   */
  async _executeWithBackend(backend, prompt, context, options) {
    const provider = this.providers[backend];
    
    if (!provider) {
      throw new Error(`Backend ${backend} not available`);
    }

    return await provider.execute(prompt, context, options);
  }

  /**
   * Вибрати backend на основі prompt, options, та routing rules
   * 
   * @param {string} prompt - Текст запиту
   * @param {Object} options - Опції (може містити forceBackend)
   * @returns {string} Назва backend ('goose' | 'mcp')
   */
  selectBackend(prompt, options) {
    // Якщо явно вказано backend
    if (options.forceBackend) {
      logger.debug('ai-provider', `[AI Provider] Backend forced: ${options.forceBackend}`);
      return options.forceBackend;
    }

    // Якщо mode не hybrid - використовувати primary
    if (this.config.mode !== 'hybrid') {
      return this.config.primary;
    }

    // Hybrid mode: перевірити routing rules
    const promptLower = prompt.toLowerCase();

    // Перевірка MCP keywords (пріоритет для simple operations)
    const mcpMatches = this.config.routing?.mcpKeywords?.some(kw => 
      promptLower.includes(kw.toLowerCase())
    );

    if (mcpMatches && this.providers.mcp) {
      logger.debug('ai-provider', '[AI Provider] Routing to MCP (keyword match)');
      return 'mcp';
    }

    // Перевірка Goose keywords (для reasoning)
    const gooseMatches = this.config.routing?.gooseKeywords?.some(kw => 
      promptLower.includes(kw.toLowerCase())
    );

    if (gooseMatches && this.providers.goose) {
      logger.debug('ai-provider', '[AI Provider] Routing to Goose (keyword match)');
      return 'goose';
    }

    // Default: primary backend
    logger.debug('ai-provider', `[AI Provider] Using primary backend: ${this.config.primary}`);
    return this.config.primary;
  }

  /**
   * Отримати метрики всіх backends
   * @returns {Object} Статистика використання
   */
  getMetrics() {
    const metrics = {};

    for (const [name, stats] of Object.entries(this.metrics)) {
      metrics[name] = {
        ...stats,
        avgLatency: stats.requests > 0 ? Math.round(stats.totalLatency / stats.requests) : 0,
        errorRate: stats.requests > 0 ? (stats.errors / stats.requests * 100).toFixed(2) + '%' : '0%'
      };
    }

    return metrics;
  }

  /**
   * Отримати список доступних backends
   * @returns {string[]} Масив назв backends
   */
  getAvailableBackends() {
    return Object.keys(this.providers);
  }

  /**
   * Перевірити чи backend доступний
   * @param {string} backend - Назва backend
   * @returns {boolean}
   */
  isBackendAvailable(backend) {
    return !!this.providers[backend];
  }

  /**
   * Graceful shutdown всіх backends
   */
  async shutdown() {
    logger.system('ai-provider', '[AI Provider] Shutting down backends...');

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        if (provider.shutdown) {
          await provider.shutdown();
          logger.system('ai-provider', `[AI Provider] ✅ ${name} backend stopped`);
        }
      } catch (error) {
        logger.error('ai-provider', `[AI Provider] ❌ Error stopping ${name}: ${error.message}`);
      }
    }
  }
}

export default AIProviderInterface;
