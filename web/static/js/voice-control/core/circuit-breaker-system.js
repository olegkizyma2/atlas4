/**
 * @fileoverview Circuit Breaker System для ATLAS Voice Services
 * Забезпечує надійне відновлення після помилок та graceful degradation
 * Реалізує patterns: Circuit Breaker + Bulkhead + Timeout + Retry with Backoff
 */

import { VoiceLogger } from '../utils/voice-logger.js';
import { Events } from '../events/event-manager.js';

/**
 * @typedef {Object} CircuitBreakerConfig
 * @property {number} failureThreshold - Кількість помилок для відкриття circuit
 * @property {number} recoveryTimeout - Час очікування перед спробою відновлення (ms)
 * @property {number} halfOpenMaxCalls - Максимум викликів у half-open стані
 * @property {number} timeout - Таймаут для операцій (ms)
 * @property {Function} onOpen - Колбек при відкритті circuit
 * @property {Function} onHalfOpen - Колбек при переході в half-open
 * @property {Function} onClose - Колбек при закритті circuit
 */

/**
 * Стани Circuit Breaker
 */
const CircuitState = {
  CLOSED: 'closed',       // Нормальна робота
  OPEN: 'open',           // Circuit відкритий, запити блокуються
  HALF_OPEN: 'half_open'  // Тестування відновлення
};

/**
 * Circuit Breaker для одного сервісу
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 секунд
      halfOpenMaxCalls: 3,
      timeout: 5000, // 5 секунд
      onOpen: () => {},
      onHalfOpen: () => {},
      onClose: () => {},
      ...config
    };

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = null;
    this.recoveryTimer = null;

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpenCount: 0,
      timeouts: 0,
      averageResponseTime: 0
    };

    this.logger = new VoiceLogger(`CircuitBreaker-${config.name || 'Unknown'}`);
  }

  /**
     * Виконання операції через circuit breaker
     * @param {Function} operation - Асинхронна операція для виконання
     * @param {...any} args - Аргументи для операції
     * @returns {Promise<any>} - Результат операції
     */
  async execute(operation, ...args) {
    const startTime = performance.now();
    this.metrics.totalCalls++;

    // Перевірка стану circuit
    if (this.state === CircuitState.OPEN) {
      throw new CircuitBreakerError('Circuit breaker is OPEN', 'CIRCUIT_OPEN');
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerError('Circuit breaker HALF_OPEN limit exceeded', 'HALF_OPEN_LIMIT');
    }

    try {
      // Виконання операції з таймаутом
      const result = await this._executeWithTimeout(operation, ...args);

      // Успішне виконання
      this._onSuccess(performance.now() - startTime);
      return result;

    } catch (error) {
      // Обробка помилки
      this._onFailure(error, performance.now() - startTime);
      throw error;
    }
  }

  /**
     * Виконання операції з таймаутом
     * @private
     */
  async _executeWithTimeout(operation, ...args) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new CircuitBreakerError('Operation timeout', 'TIMEOUT'));
      }, this.config.timeout);

      try {
        if (this.state === CircuitState.HALF_OPEN) {
          this.halfOpenCallCount++;
        }

        const result = await operation(...args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
     * Обробка успішного виконання
     * @private
     */
  _onSuccess(responseTime) {
    this.metrics.successfulCalls++;
    this._updateAverageResponseTime(responseTime);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      // Якщо достатньо успішних викликів, закриваємо circuit
      if (this.successCount >= this.config.halfOpenMaxCalls) {
        this._closeCircuit();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Скидання лічильника помилок при успішному виклику
      this.failureCount = 0;
    }
  }

  /**
     * Обробка помилки
     * @private
     */
  _onFailure(error, responseTime) {
    this.metrics.failedCalls++;
    this._updateAverageResponseTime(responseTime);

    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.logger.warn('Circuit breaker operation failed', {
      error: error.message,
      failureCount: this.failureCount,
      state: this.state
    });

    if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this._openCircuit();
    } else if (this.state === CircuitState.HALF_OPEN) {
      // При помилці в half-open повертаємось до open
      this._openCircuit();
    }
  }

  /**
     * Відкриття circuit breaker
     * @private
     */
  _openCircuit() {
    this.state = CircuitState.OPEN;
    this.metrics.circuitOpenCount++;
    this.halfOpenCallCount = 0;
    this.successCount = 0;

    this.logger.warn('Circuit breaker OPENED', {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    });

    // Запуск таймера відновлення
    this.recoveryTimer = setTimeout(() => {
      this._halfOpenCircuit();
    }, this.config.recoveryTimeout);

    // Виклик callback
    try {
      this.config.onOpen();
    } catch (error) {
      this.logger.error('onOpen callback failed', error);
    }

    // Емісія події
    Events.emit('circuitBreaker:opened', {
      name: this.config.name,
      failureCount: this.failureCount,
      metrics: this.getMetrics()
    });
  }

  /**
     * Перехід в half-open стан
     * @private
     */
  _halfOpenCircuit() {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenCallCount = 0;
    this.successCount = 0;

    this.logger.info('Circuit breaker HALF_OPEN', {
      recoveryTimeout: this.config.recoveryTimeout
    });

    // Виклик callback
    try {
      this.config.onHalfOpen();
    } catch (error) {
      this.logger.error('onHalfOpen callback failed', error);
    }

    // Емісія події
    Events.emit('circuitBreaker:halfOpen', {
      name: this.config.name,
      metrics: this.getMetrics()
    });
  }

  /**
     * Закриття circuit breaker
     * @private
     */
  _closeCircuit() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCallCount = 0;
    this.successCount = 0;

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    this.logger.info('Circuit breaker CLOSED', {
      successCount: this.successCount
    });

    // Виклик callback
    try {
      this.config.onClose();
    } catch (error) {
      this.logger.error('onClose callback failed', error);
    }

    // Емісія події
    Events.emit('circuitBreaker:closed', {
      name: this.config.name,
      metrics: this.getMetrics()
    });
  }

  /**
     * Оновлення середнього часу відповіді
     * @private
     */
  _updateAverageResponseTime(responseTime) {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalCalls - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalCalls;
  }

  /**
     * Отримання поточних метрик
     */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      failureCount: this.failureCount,
      successRate: this.metrics.totalCalls > 0 ?
        (this.metrics.successfulCalls / this.metrics.totalCalls) * 100 : 0,
      isHealthy: this.state === CircuitState.CLOSED && this.failureCount < this.config.failureThreshold / 2
    };
  }

  /**
     * Ручне скидання circuit breaker
     */
  reset() {
    this.logger.info('Circuit breaker manually reset');

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;

    Events.emit('circuitBreaker:reset', {
      name: this.config.name
    });
  }

  /**
     * Знищення circuit breaker
     */
  destroy() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }
}

/**
 * Помилка Circuit Breaker
 */
export class CircuitBreakerError extends Error {
  constructor(message, code = 'CIRCUIT_BREAKER_ERROR') {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = code;
  }
}

/**
 * Система відновлення для Voice Services
 */
export class VoiceSystemRecovery {
  constructor() {
    this.circuitBreakers = new Map();
    this.recoveryStrategies = new Map();
    this.fallbackHandlers = new Map();

    this.logger = new VoiceLogger('VoiceSystemRecovery');

    this._initializeDefaultStrategies();
    this._setupEventListeners();
  }

  /**
     * Створення circuit breaker для сервісу
     */
  createCircuitBreaker(serviceName, config = {}) {
    const breaker = new CircuitBreaker({
      name: serviceName,
      failureThreshold: 5,
      recoveryTimeout: 30000,
      timeout: 5000,
      ...config,
      onOpen: () => this._handleServiceFailure(serviceName),
      onHalfOpen: () => this._attemptServiceRecovery(serviceName),
      onClose: () => this._notifyServiceRecovery(serviceName)
    });

    this.circuitBreakers.set(serviceName, breaker);

    this.logger.info('Circuit breaker created', { serviceName, config });
    return breaker;
  }

  /**
     * Отримання circuit breaker для сервісу
     */
  getCircuitBreaker(serviceName) {
    return this.circuitBreakers.get(serviceName);
  }

  /**
     * Виконання операції через circuit breaker
     */
  async execute(serviceName, operation, ...args) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) {
      throw new Error(`No circuit breaker found for service: ${serviceName}`);
    }

    try {
      return await breaker.execute(operation, ...args);
    } catch (error) {
      // Спроба fallback якщо основна операція не вдалась
      return await this._attemptFallback(serviceName, error, ...args);
    }
  }

  /**
     * Реєстрація fallback handler для сервісу
     */
  registerFallback(serviceName, fallbackHandler) {
    this.fallbackHandlers.set(serviceName, fallbackHandler);
    this.logger.debug('Fallback handler registered', { serviceName });
  }

  /**
     * Спроба fallback операції
     * @private
     */
  async _attemptFallback(serviceName, originalError, ...args) {
    const fallbackHandler = this.fallbackHandlers.get(serviceName);

    if (!fallbackHandler) {
      this.logger.warn('No fallback available', { serviceName, error: originalError.message });
      throw originalError;
    }

    try {
      this.logger.info('Attempting fallback', { serviceName });
      const result = await fallbackHandler(...args);

      Events.emit('voiceSystemRecovery:fallbackSuccess', {
        serviceName,
        originalError: originalError.message
      });

      return result;
    } catch (fallbackError) {
      this.logger.error('Fallback failed', {
        serviceName,
        originalError: originalError.message,
        fallbackError: fallbackError.message
      });

      Events.emit('voiceSystemRecovery:fallbackFailed', {
        serviceName,
        originalError: originalError.message,
        fallbackError: fallbackError.message
      });

      throw originalError; // Повертаємо оригінальну помилку
    }
  }

  /**
     * Обробка відмови сервісу
     * @private
     */
  _handleServiceFailure(serviceName) {
    this.logger.error('Service failure detected', { serviceName });

    const strategy = this.recoveryStrategies.get(serviceName);
    if (strategy) {
      strategy.onFailure(serviceName);
    }

    Events.emit('voiceSystemRecovery:serviceFailure', { serviceName });
  }

  /**
     * Спроба відновлення сервісу
     * @private
     */
  _attemptServiceRecovery(serviceName) {
    this.logger.info('Attempting service recovery', { serviceName });

    const strategy = this.recoveryStrategies.get(serviceName);
    if (strategy) {
      strategy.onRecoveryAttempt(serviceName);
    }

    Events.emit('voiceSystemRecovery:recoveryAttempt', { serviceName });
  }

  /**
     * Сповіщення про відновлення сервісу
     * @private
     */
  _notifyServiceRecovery(serviceName) {
    this.logger.info('Service recovered', { serviceName });

    const strategy = this.recoveryStrategies.get(serviceName);
    if (strategy) {
      strategy.onRecovery(serviceName);
    }

    Events.emit('voiceSystemRecovery:serviceRecovered', { serviceName });
  }

  /**
     * Ініціалізація стандартних стратегій відновлення
     * @private
     */
  _initializeDefaultStrategies() {
    // Стратегія для keyword detection
    this.recoveryStrategies.set('keyword-detection', {
      onFailure: (serviceName) => {
        // Перехід на manual activation mode
        Events.emit('keywordDetection:enableManualMode');
      },
      onRecoveryAttempt: (serviceName) => {
        // Тестування базового розпізнавання
        Events.emit('keywordDetection:testBasicRecognition');
      },
      onRecovery: (serviceName) => {
        // Відновлення автоматичного режиму
        Events.emit('keywordDetection:enableAutoMode');
      }
    });

    // Стратегія для post-chat analysis
    this.recoveryStrategies.set('post-chat-analysis', {
      onFailure: (serviceName) => {
        // Перехід на простий timeout режим
        Events.emit('postChatAnalysis:enableSimpleMode');
      },
      onRecoveryAttempt: (serviceName) => {
        // Тестування базового VAD
        Events.emit('postChatAnalysis:testBasicVAD');
      },
      onRecovery: (serviceName) => {
        // Відновлення повного аналізу
        Events.emit('postChatAnalysis:enableFullMode');
      }
    });

    // Стратегія для speech recognition
    this.recoveryStrategies.set('speech-recognition', {
      onFailure: (serviceName) => {
        // Активація текстового input
        Events.emit('speechRecognition:enableTextInput');
      },
      onRecoveryAttempt: (serviceName) => {
        // Тестування простого розпізнавання
        Events.emit('speechRecognition:testSimpleRecognition');
      },
      onRecovery: (serviceName) => {
        // Відновлення голосового вводу
        Events.emit('speechRecognition:enableVoiceInput');
      }
    });
  }

  /**
     * Налаштування event listeners
     * @private
     */
  _setupEventListeners() {
    // Автоматичне створення circuit breakers для сервісів
    Events.on('service:registered', (data) => {
      if (data.type === 'voice' && !this.circuitBreakers.has(data.name)) {
        this.createCircuitBreaker(data.name, data.circuitBreakerConfig || {});
      }
    });
  }

  /**
     * Адаптивний backoff з jitter
     */
  calculateAdaptiveBackoff(attempt, baseDelay = 1000, maxDelay = 30000, jitter = 0.1) {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitterRange = exponentialDelay * jitter;
    const jitterValue = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, exponentialDelay + jitterValue);
  }

  /**
     * Graceful degradation при критичних помилках
     */
  async gracefulDegrade(failedService, fallbackOptions = {}) {
    this.logger.warn('Initiating graceful degradation', { failedService, fallbackOptions });

    const degradationMap = {
      'keyword-detection': () => this._enableManualActivation(fallbackOptions),
      'post-chat-analysis': () => this._enableSimpleTimeoutMode(fallbackOptions),
      'speech-recognition': () => this._enableTextInputFallback(fallbackOptions),
      'microphone-button': () => this._enableKeyboardShortcuts(fallbackOptions)
    };

    const degradationHandler = degradationMap[failedService];
    if (degradationHandler) {
      return await degradationHandler();
    } else {
      this.logger.warn('No degradation strategy for service', { failedService });
    }
  }

  /**
     * Активація manual activation режиму
     * @private
     */
  async _enableManualActivation(options) {
    Events.emit('ui:showManualActivationButton');
    Events.emit('notification:show', {
      type: 'warning',
      message: 'Голосова активація тимчасово недоступна. Використовуйте кнопку мікрофона.',
      duration: 5000
    });
    return { mode: 'manual_activation', enabled: true };
  }

  /**
     * Активація простого timeout режиму
     * @private
     */
  async _enableSimpleTimeoutMode(options) {
    const timeout = options.timeout || 3000;
    Events.emit('postChatAnalysis:setSimpleTimeout', { timeout });
    return { mode: 'simple_timeout', timeout };
  }

  /**
     * Активація текстового input fallback
     * @private
     */
  async _enableTextInputFallback(options) {
    Events.emit('ui:showTextInput');
    Events.emit('notification:show', {
      type: 'info',
      message: 'Голосовий ввід недоступний. Використовуйте текстове поле.',
      duration: 5000
    });
    return { mode: 'text_input', enabled: true };
  }

  /**
     * Активація keyboard shortcuts
     * @private
     */
  async _enableKeyboardShortcuts(options) {
    Events.emit('ui:enableKeyboardShortcuts');
    Events.emit('notification:show', {
      type: 'info',
      message: 'Використовуйте клавіші: Пробіл - запис, Enter - відправка.',
      duration: 5000
    });
    return { mode: 'keyboard_shortcuts', enabled: true };
  }

  /**
     * Отримання метрик всіх circuit breakers
     */
  getAllMetrics() {
    const metrics = {};
    this.circuitBreakers.forEach((breaker, serviceName) => {
      metrics[serviceName] = breaker.getMetrics();
    });
    return metrics;
  }

  /**
     * Скидання всіх circuit breakers
     */
  resetAll() {
    this.logger.info('Resetting all circuit breakers');
    this.circuitBreakers.forEach((breaker, serviceName) => {
      breaker.reset();
    });
  }

  /**
     * Знищення системи відновлення
     */
  destroy() {
    this.circuitBreakers.forEach(breaker => breaker.destroy());
    this.circuitBreakers.clear();
    this.recoveryStrategies.clear();
    this.fallbackHandlers.clear();
  }
}

/**
 * Глобальний експорт singleton instance
 */
export const voiceSystemRecovery = new VoiceSystemRecovery();
