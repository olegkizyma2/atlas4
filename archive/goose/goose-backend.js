/**
 * @fileoverview Goose Desktop Backend - обгортка над goose-client.js
 * Адаптує існуючий Goose WebSocket client до уніфікованого AI Provider Interface
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import { callGooseAgent } from '../goose-client.js';
import logger from '../../utils/logger.js';

/**
 * Backend для роботи з Goose Desktop через WebSocket
 * Використовує MCP extensions налаштовані в Goose
 */
export class GooseBackend {
  /**
   * @param {Object} config - Goose конфігурація з AI_BACKEND_CONFIG
   */
  constructor(config) {
    this.config = config;
    this.wsUrl = config.url || 'ws://localhost:3000/ws';
    this.model = config.model || 'gpt-4o';
    this.extensions = config.extensions || [];
  }

  /**
   * Ініціалізація Goose backend
   */
  async initialize() {
    logger.system('goose-backend', `[Goose Backend] Initializing (WS: ${this.wsUrl})`);
    
    // Перевірка що Goose Desktop доступний
    try {
      const healthCheck = await fetch('http://localhost:3000/health', {
        method: 'GET',
        timeout: 3000
      }).catch(() => null);

      if (!healthCheck || !healthCheck.ok) {
        logger.warn('goose-backend', '[Goose Backend] ⚠️ Goose Desktop may not be running (health check failed)');
      } else {
        logger.system('goose-backend', '[Goose Backend] ✅ Goose Desktop is running');
      }
    } catch (error) {
      logger.warn('goose-backend', `[Goose Backend] ⚠️ Could not verify Goose Desktop: ${error.message}`);
    }

    // Логування MCP extensions
    if (this.extensions.length > 0) {
      logger.system('goose-backend', `[Goose Backend] MCP Extensions: ${this.extensions.join(', ')}`);
    } else {
      logger.warn('goose-backend', '[Goose Backend] ⚠️ No MCP extensions configured');
    }
  }

  /**
   * Виконати AI запит через Goose Desktop
   * 
   * @param {string} prompt - Текст запиту
   * @param {Object} context - Контекст виконання
   * @param {string} context.sessionId - ID сесії
   * @param {Array} context.history - Історія розмови (опціонально)
   * @param {Object} options - Опції виконання
   * @param {string} options.agent - Назва агента (atlas, tetyana, grisha)
   * @param {boolean} options.enableTools - Дозволити використання tools
   * @returns {Promise<Object>} Результат від Goose
   */
  async execute(prompt, context, options = {}) {
    const startTime = Date.now();

    logger.debug('goose-backend', '[Goose Backend] Executing request', {
      agent: options.agent,
      enableTools: options.enableTools,
      sessionId: context.sessionId,
      promptLength: prompt.length
    });

    try {
      // Виклик існуючого goose-client.js
      const result = await callGooseAgent(prompt, context.sessionId, {
        agent: options.agent,
        enableTools: options.enableTools,
        history: context.history
      });

      const latency = Date.now() - startTime;

      logger.debug('goose-backend', `[Goose Backend] ✅ Success (${latency}ms, ${result.length} chars)`);

      // Повернути у стандартизованому форматі
      return {
        text: result,
        agent: options.agent,
        tools: [], // TODO: парсити tool calls з Goose response
        confidence: 1.0 // Goose не повертає confidence
      };

    } catch (error) {
      logger.error('goose-backend', `[Goose Backend] ❌ Error: ${error.message}`, {
        agent: options.agent,
        sessionId: context.sessionId
      });

      // Re-throw з додатковим контекстом
      const enhancedError = new Error(`Goose execution failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.backend = 'goose';
      enhancedError.agent = options.agent;
      
      throw enhancedError;
    }
  }

  /**
   * Отримати статус Goose Desktop
   * @returns {Promise<Object>} Статус інформація
   */
  async getStatus() {
    try {
      const response = await fetch('http://localhost:3000/health');
      
      return {
        available: response.ok,
        wsUrl: this.wsUrl,
        model: this.model,
        extensions: this.extensions
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown (Goose Desktop керує WS сам)
   */
  async shutdown() {
    logger.system('goose-backend', '[Goose Backend] Shutting down (WebSocket connections auto-close)');
    // Goose Desktop сам керує WebSocket connections
    // Нічого не треба робити тут
  }
}

export default GooseBackend;
