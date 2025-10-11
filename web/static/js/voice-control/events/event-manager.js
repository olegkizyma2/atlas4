/**
 * @fileoverview Система подій для voice-control модулів
 * Забезпечує слабозв'язану комунікацію між компонентами
 */

import { createLogger } from '../core/logger.js';

const logger = createLogger('EVENT_MANAGER');

/**
 * @typedef {Object} EventData
 * @property {string} type - Тип події
 * @property {*} payload - Дані події
 * @property {Date} timestamp - Час створення події
 * @property {string} source - Джерело події
 */

/**
 * Централізований менеджер подій
 */
export class EventManager {
  constructor() {
    this.listeners = new Map(); // type -> Set of handlers
    this.onceListeners = new Map(); // type -> Set of handlers
    this.wildcardListeners = new Set(); // handlers for all events
    this.eventHistory = [];
    this.maxHistorySize = 100;

    // Метрики
    this.metrics = {
      eventsEmitted: 0,
      listenersAdded: 0,
      listenersRemoved: 0,
      errorCount: 0
    };

    logger.debug('EventManager initialized');
  }

  /**
     * Підписка на подію
     * @param {string} eventType - Тип події
     * @param {Function} handler - Обробник події
     * @param {Object} [options] - Опції підписки
     * @param {boolean} [options.once=false] - Одноразова підписка
     * @param {number} [options.priority=0] - Пріоритет (вищий = раніше)
     * @returns {string} - ID підписки для відписки
     */
  on(eventType, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const subscription = {
      id: this._generateId(),
      handler,
      priority: options.priority || 0,
      once: options.once || false
    };

    // Wildcard підписка
    if (eventType === '*') {
      this.wildcardListeners.add(subscription);
      logger.debug(`Added wildcard listener ${subscription.id}`);
    } else {
      // Звичайна підписка
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, new Set());
      }

      if (options.once) {
        if (!this.onceListeners.has(eventType)) {
          this.onceListeners.set(eventType, new Set());
        }
        this.onceListeners.get(eventType).add(subscription);
        logger.debug(`Added once listener ${subscription.id} for ${eventType}`);
      } else {
        this.listeners.get(eventType).add(subscription);
        logger.debug(`Added listener ${subscription.id} for ${eventType}`);
      }
    }

    this.metrics.listenersAdded++;
    return subscription.id;
  }

  /**
     * Одноразова підписка на подію
     * @param {string} eventType - Тип події
     * @param {Function} handler - Обробник події
     * @returns {string} - ID підписки
     */
  once(eventType, handler) {
    return this.on(eventType, handler, { once: true });
  }

  /**
     * Відписка від події
     * @param {string} subscriptionId - ID підписки
     * @returns {boolean} - Чи була підписка знайдена та видалена
     */
  off(subscriptionId) {
    // Пошук у wildcard слухачах
    for (const subscription of this.wildcardListeners) {
      if (subscription.id === subscriptionId) {
        this.wildcardListeners.delete(subscription);
        this.metrics.listenersRemoved++;
        logger.debug(`Removed wildcard listener ${subscriptionId}`);
        return true;
      }
    }

    // Пошук у звичайних слухачах
    for (const [eventType, listeners] of this.listeners) {
      for (const subscription of listeners) {
        if (subscription.id === subscriptionId) {
          listeners.delete(subscription);
          if (listeners.size === 0) {
            this.listeners.delete(eventType);
          }
          this.metrics.listenersRemoved++;
          logger.debug(`Removed listener ${subscriptionId} for ${eventType}`);
          return true;
        }
      }
    }

    // Пошук у once слухачах
    for (const [eventType, listeners] of this.onceListeners) {
      for (const subscription of listeners) {
        if (subscription.id === subscriptionId) {
          listeners.delete(subscription);
          if (listeners.size === 0) {
            this.onceListeners.delete(eventType);
          }
          this.metrics.listenersRemoved++;
          logger.debug(`Removed once listener ${subscriptionId} for ${eventType}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
     * Відписка всіх слухачів певного типу події
     * @param {string} eventType - Тип події
     * @returns {number} - Кількість видалених підписок
     */
  removeAllListeners(eventType) {
    let removed = 0;

    if (this.listeners.has(eventType)) {
      removed += this.listeners.get(eventType).size;
      this.listeners.delete(eventType);
    }

    if (this.onceListeners.has(eventType)) {
      removed += this.onceListeners.get(eventType).size;
      this.onceListeners.delete(eventType);
    }

    this.metrics.listenersRemoved += removed;
    logger.debug(`Removed ${removed} listeners for ${eventType}`);
    return removed;
  }

  /**
     * Генерування події
     * @param {string} eventType - Тип події
     * @param {*} payload - Дані події
     * @param {Object} [options] - Опції події
     * @param {string} [options.source] - Джерело події
     * @param {boolean} [options.async=false] - Асинхронна обробка
     * @returns {Promise<boolean>} - Чи була подія оброблена
     */
  async emit(eventType, payload = null, options = {}) {
    const event = {
      type: eventType,
      payload,
      timestamp: new Date(),
      source: options.source || 'unknown'
    };

    // Додавання в історію
    this._addToHistory(event);
    this.metrics.eventsEmitted++;

    logger.debug(`Emitting event: ${eventType}`, { source: event.source });

    let handlersInvoked = 0;
    const errors = [];

    try {
      // Обробка wildcard слухачів
      handlersInvoked += await this._invokeHandlers(
        Array.from(this.wildcardListeners),
        event,
        options.async
      );

      // Обробка звичайних слухачів
      if (this.listeners.has(eventType)) {
        const regularListeners = Array.from(this.listeners.get(eventType));
        handlersInvoked += await this._invokeHandlers(
          regularListeners,
          event,
          options.async
        );
      }

      // Обробка одноразових слухачів
      if (this.onceListeners.has(eventType)) {
        const onceListeners = Array.from(this.onceListeners.get(eventType));
        handlersInvoked += await this._invokeHandlers(
          onceListeners,
          event,
          options.async
        );

        // Видалення одноразових слухачів
        this.onceListeners.delete(eventType);
      }

    } catch (error) {
      this.metrics.errorCount++;
      logger.error(`Error emitting event ${eventType}`, null, error);
      throw error;
    }

    logger.debug(`Event ${eventType} handled by ${handlersInvoked} listeners`);
    return handlersInvoked > 0;
  }

  /**
     * Виклик обробників з підтримкою пріоритетів
     * @param {Array} handlers - Масив обробників
     * @param {EventData} event - Дані події
     * @param {boolean} async - Асинхронна обробка
     * @returns {Promise<number>} - Кількість викликаних обробників
     */
  async _invokeHandlers(handlers, event, async = false) {
    if (handlers.length === 0) return 0;

    // Сортування за пріоритетом
    const sortedHandlers = handlers.sort((a, b) => b.priority - a.priority);

    let invoked = 0;

    if (async) {
      // Паралельне виконання
      const promises = sortedHandlers.map(async (subscription) => {
        try {
          await subscription.handler(event);
          invoked++;
        } catch (error) {
          this.metrics.errorCount++;
          logger.error(`Error in event handler for ${event.type}`,
            { subscriptionId: subscription.id }, error);
        }
      });

      await Promise.all(promises);
    } else {
      // Послідовне виконання
      for (const subscription of sortedHandlers) {
        try {
          await subscription.handler(event);
          invoked++;
        } catch (error) {
          this.metrics.errorCount++;
          logger.error(`Error in event handler for ${event.type}`,
            { subscriptionId: subscription.id }, error);
        }
      }
    }

    return invoked;
  }

  /**
     * Додавання події в історію
     * @param {EventData} event - Подія
     */
  _addToHistory(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
     * Генерування унікального ID
     * @returns {string} - Унікальний ID
     */
  _generateId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Отримання історії подій
     * @param {Object} [filters] - Фільтри
     * @param {string} [filters.type] - Тип події
     * @param {string} [filters.source] - Джерело події
     * @param {Date} [filters.since] - Події після дати
     * @returns {EventData[]} - Відфільтровані події
     */
  getEventHistory(filters = {}) {
    let events = [...this.eventHistory];

    if (filters.type) {
      events = events.filter(e => e.type === filters.type);
    }

    if (filters.source) {
      events = events.filter(e => e.source === filters.source);
    }

    if (filters.since) {
      events = events.filter(e => e.timestamp >= filters.since);
    }

    return events;
  }

  /**
     * Отримання метрик
     * @returns {Object} - Метрики системи подій
     */
  getMetrics() {
    return {
      ...this.metrics,
      activeListeners: this._countActiveListeners(),
      eventTypes: Array.from(this.listeners.keys())
    };
  }

  /**
     * Підрахунок активних слухачів
     * @returns {number} - Кількість активних слухачів
     */
  _countActiveListeners() {
    let count = this.wildcardListeners.size;

    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }

    for (const listeners of this.onceListeners.values()) {
      count += listeners.size;
    }

    return count;
  }

  /**
     * Очищення всіх слухачів та історії
     */
  clear() {
    this.listeners.clear();
    this.onceListeners.clear();
    this.wildcardListeners.clear();
    this.eventHistory = [];

    logger.info('EventManager cleared');
  }
}

// Глобальний інстанс менеджера подій
const globalEventManager = new EventManager();

// Експорт для використання
export const eventManager = globalEventManager;

/**
 * Зручні хелпери для роботи з подіями
 */
export const Events = {
  // Voice Control події
  VOICE_CONTROL_INITIALIZED: 'voice.control.initialized',
  VOICE_CONTROL_DESTROYED: 'voice.control.destroyed',

  // Keyword Detection події
  KEYWORD_DETECTED: 'keyword.detected',
  KEYWORD_DETECTION_STARTED: 'keyword.detection.started',
  KEYWORD_DETECTION_STOPPED: 'keyword.detection.stopped',
  KEYWORD_DETECTION_ERROR: 'keyword.detection.error',
  START_KEYWORD_DETECTION: 'START_KEYWORD_DETECTION', // Для conversation mode

  // Microphone події
  MICROPHONE_STATE_CHANGED: 'microphone.state.changed',
  MICROPHONE_RECORDING_STARTED: 'microphone.recording.started',
  MICROPHONE_RECORDING_STOPPED: 'microphone.recording.stopped',
  MICROPHONE_PERMISSION_GRANTED: 'microphone.permission.granted',
  MICROPHONE_PERMISSION_DENIED: 'microphone.permission.denied',

  // Speech Recognition події
  SPEECH_RESULT: 'speech.result',
  SPEECH_INTERIM_RESULT: 'speech.interim.result',
  SPEECH_ERROR: 'speech.error',
  SPEECH_NO_SPEECH: 'speech.no.speech',

  // Whisper Service події
  WHISPER_TRANSCRIPTION_STARTED: 'whisper.transcription.started',
  WHISPER_TRANSCRIPTION_COMPLETED: 'whisper.transcription.completed',
  WHISPER_TRANSCRIPTION_ERROR: 'whisper.transcription.error',
  WHISPER_SERVICE_AVAILABLE: 'whisper.service.available',
  WHISPER_SERVICE_UNAVAILABLE: 'whisper.service.unavailable',

  // TTS події
  TTS_STARTED: 'tts.started',
  TTS_COMPLETED: 'tts.completed',
  TTS_ERROR: 'tts.error',

  // Post Chat Analysis події
  POST_CHAT_ANALYSIS_STARTED: 'post.chat.analysis.started',
  POST_CHAT_SPEECH_DETECTED: 'post.chat.speech.detected',
  POST_CHAT_ANALYSIS_COMPLETED: 'post.chat.analysis.completed',

  // Service Lifecycle события
  SERVICE_INITIALIZED: 'service.initialized',
  SERVICE_DESTROYED: 'service.destroyed',
  SERVICE_UNHEALTHY: 'service.unhealthy',
  SERVICE_STATE_CHANGED: 'service.state.changed',

  // Service Error события
  SERVICE_ERROR: 'service.error',
  SERVICE_FAILURE: 'service.failure',

  // System Events
  SYSTEM_READY: 'system.ready',
  SYSTEM_STOPPED: 'system.stopped',
  SYSTEM_ERROR: 'system.error',
  SERVICE_HEALTH_CHECK: 'service.health.check',
  ERROR_THRESHOLD_EXCEEDED: 'error.threshold.exceeded',
  CONFIGURATION_CHANGED: 'configuration.changed'
};

export default eventManager;
