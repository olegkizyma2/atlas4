/**
 * @fileoverview Базовий клас для всіх сервісів voice-control системи
 * Забезпечує консистентну архітектуру та функціональність
 */

import { createLogger } from '../core/logger.js';
import { eventManager, Events } from '../events/event-manager.js';

/**
 * @typedef {Object} ServiceConfig
 * @property {string} name - Назва сервісу
 * @property {string} [version] - Версія сервісу
 * @property {boolean} [enabled=true] - Чи увімкнено сервіс
 * @property {number} [healthCheckInterval=30000] - Інтервал перевірки здоров'я (мс)
 * @property {number} [maxRetries=3] - Максимальна кількість повторних спроб
 * @property {number} [retryDelay=1000] - Затримка між повторними спробами (мс)
 */

/**
 * Базовий клас для всіх сервісів
 * @abstract
 */
export class BaseService {
  /**
     * @param {ServiceConfig} config - Конфігурація сервісу
     */
  constructor(config) {
    if (new.target === BaseService) {
      throw new Error('BaseService cannot be instantiated directly');
    }

    this.config = {
      enabled: true,
      healthCheckInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.name = this.config.name;
    this.version = this.config.version || '1.0.0';
    this.logger = config.logger || createLogger(this.name);

    // КРИТИЧНО: Використовуємо переданий eventManager або fallback на глобальний
    this.eventManager = config.eventManager || eventManager;

    // Стан сервісу
    this.state = 'inactive'; // inactive | initializing | active | error | destroyed
    this.isInitialized = false;
    this.isDestroyed = false;

    // Метрики та здоров'я
    this.metrics = {
      startTime: null,
      operationsCount: 0,
      errorsCount: 0,
      lastOperation: null,
      lastError: null
    };

    this.healthStatus = {
      healthy: false,
      lastCheck: null,
      consecutiveFailures: 0,
      message: 'Not initialized'
    };

    // Таймери
    this.healthCheckTimer = null;
    this.retryTimer = null;

    // Event subscriptions
    this.subscriptions = new Set();

    this.logger.debug(`${this.name} service created`);
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async initialize() {
    if (this.isInitialized || this.isDestroyed) {
      return this.isInitialized;
    }

    this.logger.info(`Initializing ${this.name} service`);
    this.setState('initializing');

    try {
      // Виклик конкретної імплементації
      const success = await this.onInitialize();

      if (success) {
        this.isInitialized = true;
        this.metrics.startTime = new Date();
        this.setState('active');
        this.healthStatus.healthy = true;
        this.healthStatus.message = 'Initialized successfully';

        // Запуск перевірки здоров'я
        this.startHealthCheck();

        // Емісія події (тільки якщо eventManager доступний)
        if (this.eventManager) {
          await this.eventManager.emit(Events.SERVICE_INITIALIZED, {
            serviceName: this.name,
            version: this.version
          }, { source: this.name });
        }

        this.logger.info(`${this.name} service initialized successfully`);
      } else {
        this.setState('error');
        this.healthStatus.message = 'Initialization failed';
        this.logger.error(`Failed to initialize ${this.name} service`);
      }

      return success;

    } catch (error) {
      this.setState('error');
      this.healthStatus.message = `Initialization error: ${error.message}`;
      this.metrics.errorsCount++;
      this.metrics.lastError = error;

      this.logger.error(`Error initializing ${this.name} service`, null, error);
      return false;
    }
  }

  /**
     * Знищення сервісу та очищення ресурсів
     * @returns {Promise<void>}
     */
  async destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.logger.info(`Destroying ${this.name} service`);

    try {
      // Зупинка таймерів
      this.stopHealthCheck();
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      // Відписка від подій (тільки якщо eventManager доступний)
      if (this.eventManager) {
        this.subscriptions.forEach(id => this.eventManager.off(id));
      }
      this.subscriptions.clear();

      // Виклик конкретної імплементації
      await this.onDestroy();

      this.isDestroyed = true;
      this.isInitialized = false;
      this.setState('destroyed');

      // Емісія події (тільки якщо eventManager доступний)
      if (this.eventManager) {
        await this.eventManager.emit(Events.SERVICE_DESTROYED, {
          serviceName: this.name
        }, { source: this.name });
      }

      this.logger.info(`${this.name} service destroyed`);

    } catch (error) {
      this.logger.error(`Error destroying ${this.name} service`, null, error);
    }
  }

  /**
     * Перевірка здоров'я сервісу
     * @returns {Promise<boolean>} - Чи здоровий сервіс
     */
  async checkHealth() {
    try {
      const healthy = await this.onHealthCheck();
      this.healthStatus.lastCheck = new Date();

      if (healthy) {
        this.healthStatus.healthy = true;
        this.healthStatus.consecutiveFailures = 0;
        this.healthStatus.message = 'Healthy';
      } else {
        this.healthStatus.healthy = false;
        this.healthStatus.consecutiveFailures++;
        this.healthStatus.message = 'Health check failed';

        // Емісія події про проблеми зі здоров'ям (тільки якщо eventManager доступний)
        if (this.healthStatus.consecutiveFailures >= 3 && this.eventManager) {
          await this.eventManager.emit(Events.SERVICE_UNHEALTHY, {
            serviceName: this.name,
            consecutiveFailures: this.healthStatus.consecutiveFailures
          }, { source: this.name });
        }
      }

      return healthy;

    } catch (error) {
      this.healthStatus.healthy = false;
      this.healthStatus.consecutiveFailures++;
      this.healthStatus.lastCheck = new Date();
      this.healthStatus.message = `Health check error: ${error.message}`;

      this.logger.warn(`Health check failed for ${this.name}`, null, error);
      return false;
    }
  }

  /**
     * Виконання операції з автоматичними повторними спробами
     * @param {Function} operation - Операція для виконання
     * @param {Object} [options] - Опції виконання
     * @param {number} [options.maxRetries] - Максимальна кількість спроб
     * @param {number} [options.retryDelay] - Затримка між спробами
     * @returns {Promise<*>} - Результат операції
     */
  async executeWithRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || this.config.maxRetries;
    const retryDelay = options.retryDelay || this.config.retryDelay;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        this.metrics.operationsCount++;
        this.metrics.lastOperation = new Date();
        return result;

      } catch (error) {
        lastError = error;
        this.metrics.errorsCount++;
        this.metrics.lastError = error;

        this.logger.warn(`Operation failed (attempt ${attempt}/${maxRetries + 1})`,
          { operation: operation.name }, error);

        if (attempt <= maxRetries) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
     * Підписка на подію з автоматичним відстеженням
     * @param {string} eventType - Тип події
     * @param {Function} handler - Обробник події
     * @param {Object} [options] - Опції підписки
     * @returns {string} - ID підписки або null якщо eventManager недоступний
     */
  subscribe(eventType, handler, options = {}) {
    if (!this.eventManager) {
      this.logger?.warn?.(`EventManager not available, cannot subscribe to: ${eventType}`);
      return null;
    }
    const subscriptionId = this.eventManager.on(eventType, handler, options);
    this.subscriptions.add(subscriptionId);
    return subscriptionId;
  }

  /**
     * Відписка від події
     * @param {string} subscriptionId - ID підписки
     */
  unsubscribe(subscriptionId) {
    if (!subscriptionId || !this.eventManager) {
      return;
    }
    this.eventManager.off(subscriptionId);
    this.subscriptions.delete(subscriptionId);
  }

  /**
     * Емісія події від сервісу
     * @param {string} eventType - Тип події
     * @param {*} payload - Дані події
     * @returns {Promise<boolean>} - Чи була подія оброблена
     */
  async emit(eventType, payload) {
    // Перевірка наявності eventManager
    if (!this.eventManager) {
      this.logger?.debug?.(`EventManager not available, skipping emit: ${eventType}`);
      return false;
    }
    return await this.eventManager.emit(eventType, payload, { source: this.name });
  }

  /**
     * Встановлення стану сервісу
     * @param {'inactive'|'initializing'|'active'|'error'|'destroyed'} newState - Новий стан
     */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      this.logger.debug(`State changed: ${oldState} -> ${newState}`);

      // Емісія події зміни стану (тільки якщо eventManager доступний)
      if (this.eventManager) {
        this.emit(Events.SERVICE_STATE_CHANGED, {
          serviceName: this.name,
          oldState,
          newState
        });
      }
    }
  }

  /**
     * Запуск періодичної перевірки здоров'я
     */
  startHealthCheck() {
    if (this.healthCheckTimer || !this.config.healthCheckInterval) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.checkHealth();
    }, this.config.healthCheckInterval);

    this.logger.debug(`Health check started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
     * Зупинка перевірки здоров'я
     */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.debug('Health check stopped');
    }
  }

  /**
     * Затримка виконання
     * @param {number} ms - Кількість мілісекунд
     * @returns {Promise<void>}
     */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Отримання інформації про сервіс
     * @returns {Object} - Інформація про сервіс
     */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      state: this.state,
      isInitialized: this.isInitialized,
      isDestroyed: this.isDestroyed,
      config: { ...this.config },
      metrics: { ...this.metrics },
      healthStatus: { ...this.healthStatus },
      uptime: this.metrics.startTime ? Date.now() - this.metrics.startTime.getTime() : 0
    };
  }

  // Абстрактні методи для перевизначення в дочірніх класах

  /**
     * Конкретна ініціалізація сервісу (має бути перевизначена)
     * @abstract
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    throw new Error('onInitialize must be implemented in subclass');
  }

  /**
     * Конкретне знищення сервісу (має бути перевизначена)
     * @abstract
     * @returns {Promise<void>}
     */
  async onDestroy() {
    // За замовчуванням нічого не робимо
  }

  /**
     * Конкретна перевірка здоров'я (має бути перевизначена)
     * @abstract
     * @returns {Promise<boolean>} - Чи здоровий сервіс
     */
  async onHealthCheck() {
    return this.isInitialized && !this.isDestroyed;
  }
}

export default BaseService;
