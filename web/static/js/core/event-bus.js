/**
 * Event Bus - Централізована система подій для ATLAS v4.0
 *
 * Замінює множинні event managers єдиною системою
 * Забезпечує type-safe події з namespace підтримкою
 *
 * @example
 * // Subscribe
 * eventBus.on('chat:message-sent', (payload) => {
 *     console.log('Message sent:', payload);
 * });
 *
 * // Emit
 * eventBus.emit('chat:message-sent', { text: 'Hello!' });
 *
 * // Unsubscribe
 * const unsubscribe = eventBus.on('event', handler);
 * unsubscribe();
 */

export class EventBus {
  constructor(options = {}) {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.wildcardListeners = new Set();
    this.eventHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;
    this.enableLogging = options.enableLogging || false;
    this.errorHandler = options.errorHandler || this.defaultErrorHandler;
  }

  /**
     * Підписується на подію
     *
     * @param {string} event - Назва події (підтримує wildcards: 'chat:*')
     * @param {Function} handler - Обробник події
     * @param {Object} context - Контекст виклику (this)
     * @returns {Function} - Unsubscribe function
     */
  on(event, handler, context = null) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    // Wildcard support
    if (event.includes('*')) {
      this.wildcardListeners.add({ pattern: event, handler, context });
      return () => this.off(event, handler);
    }

    // Normal event
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener = { handler, context };
    this.listeners.get(event).add(listener);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
     * Підписується на подію один раз
     *
     * @param {string} event - Назва події
     * @param {Function} handler - Обробник події
     * @param {Object} context - Контекст виклику
     * @returns {Function} - Unsubscribe function
     */
  once(event, handler, context = null) {
    const wrappedHandler = (...args) => {
      this.off(event, wrappedHandler);
      handler.apply(context, args);
    };

    return this.on(event, wrappedHandler, context);
  }

  /**
     * Відписується від події
     *
     * @param {string} event - Назва події
     * @param {Function} handler - Обробник події (optional)
     */
  off(event, handler = null) {
    // Remove all listeners for event
    if (!handler) {
      this.listeners.delete(event);

      // Remove wildcard listeners
      this.wildcardListeners.forEach(listener => {
        if (listener.pattern === event) {
          this.wildcardListeners.delete(listener);
        }
      });
      return;
    }

    // Remove specific handler
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        if (listener.handler === handler) {
          listeners.delete(listener);
        }
      });

      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    // Remove wildcard handler
    this.wildcardListeners.forEach(listener => {
      if (listener.pattern === event && listener.handler === handler) {
        this.wildcardListeners.delete(listener);
      }
    });
  }

  /**
     * Емітує подію
     *
     * @param {string} event - Назва події
     * @param {*} payload - Дані події
     * @param {Object} options - Опції емісії
     */
  emit(event, payload = {}, options = {}) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    const eventData = {
      event,
      payload,
      timestamp: Date.now(),
      ...options
    };

    // Add to history
    this.addToHistory(eventData);

    // Log if enabled
    if (this.enableLogging) {
      console.log(`[EventBus] ${event}`, payload);
    }

    // Call normal listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        this.callListener(listener, payload, event);
      });
    }

    // Call wildcard listeners
    this.wildcardListeners.forEach(listener => {
      if (this.matchWildcard(event, listener.pattern)) {
        this.callListener(listener, payload, event);
      }
    });
  }

  /**
     * Async emit - чекає на всі async handlers
     *
     * @param {string} event - Назва події
     * @param {*} payload - Дані події
     * @returns {Promise<Array>} - Results from all handlers
     */
  async emitAsync(event, payload = {}) {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return [];
    }

    const promises = Array.from(listeners).map(listener =>
      Promise.resolve(
        this.callListener(listener, payload, event)
      ).catch(error => {
        this.errorHandler(error, event, listener);
        return null;
      })
    );

    return Promise.all(promises);
  }

  /**
     * Викликає listener з обробкою помилок
     *
     * @private
     */
  callListener(listener, payload, event) {
    try {
      return listener.handler.call(listener.context, payload, event);
    } catch (error) {
      this.errorHandler(error, event, listener);
    }
  }

  /**
     * Перевіряє чи події є listeners
     *
     * @param {string} event - Назва події
     * @returns {boolean}
     */
  hasListeners(event) {
    return this.listeners.has(event) && this.listeners.get(event).size > 0;
  }

  /**
     * Повертає кількість listeners для події
     *
     * @param {string} event - Назва події
     * @returns {number}
     */
  listenerCount(event) {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
     * Повертає всі події з listeners
     *
     * @returns {Array<string>}
     */
  getEvents() {
    return Array.from(this.listeners.keys());
  }

  /**
     * Очищує всі listeners
     *
     * @param {string} namespace - Optional namespace для очищення (e.g., 'chat:*')
     */
  clear(namespace = null) {
    if (namespace) {
      // Clear by namespace
      const events = this.getEvents().filter(event =>
        event.startsWith(namespace.replace('*', ''))
      );
      events.forEach(event => this.listeners.delete(event));
    } else {
      // Clear all
      this.listeners.clear();
      this.wildcardListeners.clear();
    }
  }

  /**
     * Matches wildcard pattern
     *
     * @private
     */
  matchWildcard(event, pattern) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(event);
  }

  /**
     * Додає подію в історію
     *
     * @private
     */
  addToHistory(eventData) {
    this.eventHistory.push(eventData);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
     * Повертає історію подій
     *
     * @param {number} limit - Максимальна кількість
     * @param {string} filter - Фільтр за назвою події
     * @returns {Array}
     */
  getHistory(limit = 10, filter = null) {
    let history = this.eventHistory;

    if (filter) {
      history = history.filter(item => item.event.includes(filter));
    }

    return history.slice(-limit);
  }

  /**
     * Очищує історію
     */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
     * Default error handler
     *
     * @private
     */
  defaultErrorHandler(error, event, listener) {
    console.error(`[EventBus] Error in handler for "${event}":`, error);
    console.error('Listener:', listener);
  }

  /**
     * Створює namespace event emitter
     *
     * @param {string} namespace - Namespace (e.g., 'chat')
     * @returns {Object} - Namespaced emitter
     */
  namespace(ns) {
    return {
      on: (event, handler, context) =>
        this.on(`${ns}:${event}`, handler, context),

      once: (event, handler, context) =>
        this.once(`${ns}:${event}`, handler, context),

      off: (event, handler) =>
        this.off(`${ns}:${event}`, handler),

      emit: (event, payload, options) =>
        this.emit(`${ns}:${event}`, payload, options),

      emitAsync: (event, payload) =>
        this.emitAsync(`${ns}:${event}`, payload),

      clear: () =>
        this.clear(`${ns}:*`)
    };
  }

  /**
     * Pipe - передає події від одного bus до іншого
     *
     * @param {EventBus} targetBus - Цільовий bus
     * @param {Array<string>} events - Eventi для pipe (підтримує wildcards)
     */
  pipe(targetBus, events = ['*']) {
    events.forEach(eventPattern => {
      this.on(eventPattern, (payload, event) => {
        targetBus.emit(event, payload);
      });
    });
  }

  /**
     * Debug - виводить інформацію про bus
     */
  debug() {
    console.group('📡 Event Bus Debug');
    console.log('Total events:', this.listeners.size);
    console.log('Events:', this.getEvents());
    console.log('Wildcard listeners:', this.wildcardListeners.size);
    console.log('History size:', this.eventHistory.length);

    this.listeners.forEach((listeners, event) => {
      console.log(`  ${event}: ${listeners.size} listeners`);
    });

    console.groupEnd();
  }
}

/**
 * Event Names Registry
 * Централізований реєстр всіх подій системи
 */
export const EventNames = {
  // Conversation events
  CONVERSATION: {
    QUICK_SEND_START: 'conversation:quick-send-start',
    QUICK_SEND_END: 'conversation:quick-send-end',
    MODE_ACTIVATED: 'conversation:mode-activated',
    MODE_DEACTIVATED: 'conversation:mode-deactivated',
    KEYWORD_DETECTED: 'conversation:keyword-detected',
    RECORDING_START: 'conversation:recording-start',
    RECORDING_STOP: 'conversation:recording-stop',
    TTS_STARTED: 'conversation:tts-started',
    TTS_COMPLETED: 'conversation:tts-completed'
  },

  // Model3D events
  MODEL3D: {
    EMOTION_CHANGED: 'model3d:emotion-changed',
    SPEAKING_START: 'model3d:speaking-start',
    SPEAKING_STOP: 'model3d:speaking-stop',
    BREATHING_TOGGLE: 'model3d:breathing-toggle',
    MOUSE_MOVED: 'model3d:mouse-moved'
  },

  // Voice events
  VOICE: {
    RECORDING_START: 'voice:recording-start',
    RECORDING_STOP: 'voice:recording-stop',
    TRANSCRIPTION_START: 'voice:transcription-start',
    TRANSCRIPTION_COMPLETE: 'voice:transcription-complete',
    KEYWORD_DETECTED: 'voice:keyword-detected',
    TTS_START: 'voice:tts-start',
    TTS_COMPLETE: 'voice:tts-complete'
  },

  // Chat events
  CHAT: {
    MESSAGE_SENT: 'chat:message-sent',
    MESSAGE_RECEIVED: 'chat:message-received',
    TYPING_START: 'chat:typing-start',
    TYPING_STOP: 'chat:typing-stop',
    TTS_TOGGLE: 'chat:tts-toggle'
  },

  // WebSocket events
  WS: {
    CONNECTED: 'ws:connected',
    DISCONNECTED: 'ws:disconnected',
    MESSAGE: 'ws:message',
    ERROR: 'ws:error'
  },

  // System events
  SYSTEM: {
    INIT_START: 'system:init-start',
    INIT_COMPLETE: 'system:init-complete',
    ERROR: 'system:error',
    ONLINE: 'system:online',
    OFFLINE: 'system:offline'
  }
};

/**
 * Глобальний event bus для ATLAS
 */
export const eventBus = new EventBus({
  enableLogging: false,
  maxHistorySize: 100
});

export default eventBus;
