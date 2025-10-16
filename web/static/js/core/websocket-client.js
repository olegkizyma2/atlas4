/**
 * ATLAS WEBSOCKET CLIENT
 * Реальний час зв'язок з оркестратором
 */

import { logger } from './logger.js';

class AtlasWebSocketClient {
  constructor(url = 'ws://localhost:5102') {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 секунда
    this.heartbeatInterval = 30000; // 30 секунд
    this.heartbeatTimer = null;
    this.isManualDisconnect = false;

    this.subscriptions = new Set(['logs', 'model3d', 'tts', 'chat']); // ADDED 'chat' 16.10.2025
    this.listeners = new Map();

    this.logger = logger;
  }

  /**
     * Підключення до WebSocket сервера
     */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.logger.warn('WebSocket already connecting');
      return;
    }

    try {
      this.logger.info(`Connecting to WebSocket: ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      this.logger.error('Failed to create WebSocket connection', error);
      this.scheduleReconnect();
    }
  }

  /**
     * Відключення від WebSocket сервера
     */
  disconnect() {
    this.isManualDisconnect = true;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
    }

    this.logger.info('WebSocket manually disconnected');
  }

  /**
     * Обробка відкриття з'єднання
     */
  handleOpen(event) {
    this.logger.success('WebSocket connected successfully');

    // Додаємо лог у веб-інтерфейс
    if (window.atlasLogger) {
      window.atlasLogger.success('🔗 WebSocket підключення встановлено', 'WebSocket');
    }

    this.reconnectAttempts = 0;
    this.isManualDisconnect = false;

    // Підписуємось на канали
    this.subscribe(Array.from(this.subscriptions));

    // Запускаємо heartbeat
    this.startHeartbeat();

    // Емітуємо подію
    this.emit('connected', { url: this.url });
  }

  /**
     * Обробка повідомлень
     */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      const { type, data, timestamp, clientId } = message;

      // Перевірка на валідний тип
      if (!type || type === 'undefined' || type === undefined) {
        this.logger.debug('WebSocket message with missing or undefined type', message);
        return; // Пропускаємо повідомлення без типу
      }

      this.logger.debug(`WebSocket message: ${type}`, data);

      switch (type) {
      case 'welcome':
        this.handleWelcome(data);
        break;

      case 'new-log':
        this.emit('log', data);
        break;

      case 'model3d-state-change':
        this.emit('model3d-update', data);
        break;

      case 'tts-started':
        this.emit('tts-start', data);
        break;

      case 'tts-stopped':
        this.emit('tts-stop', data);
        break;

      case 'audio-analysis-update':
        this.emit('audio-analysis', data);
        break;

      case 'agent-emotion-change':
        this.emit('agent-emotion', data);
        break;

      case 'animation-triggered':
        this.emit('animation-trigger', data);
        break;

      case 'current-state':
      case 'initial-state':
        this.emit('state-update', data);
        break;

      // ADDED 16.10.2025 - Handle agent and chat messages from MCP workflow
      case 'agent_message':
        // FIXED 16.10.2025 - Передаємо весь message object з type та data
        this.logger.debug('Agent message received', { type, data });
        this.emit('agent-message', { type, data });
        break;

      case 'chat_message':
        // FIXED 16.10.2025 - Передаємо весь message object з type та data
        this.logger.debug('Chat message received', { type, data });
        this.emit('chat-message', { type, data });
        break;

      case 'subscribed':
        this.logger.info('Subscribed to channels', data.channels);
        break;

      case 'unsubscribed':
        this.logger.info('Unsubscribed from channels', data.channels);
        break;

      case 'pong':
        // Heartbeat відповідь
        break;

      case 'health_check':
        // Системна перевірка здоров'я
        this.logger.debug('Health check received');
        break;

      case 'error':
        this.logger.error('WebSocket server error', data);
        this.emit('error', data);
        break;

      default:
        // Обробка випадків з undefined або null типом
        if (!type || type === 'undefined') {
          this.logger.debug('WebSocket message with undefined type received', data);
        } else {
          this.logger.warn(`Unknown WebSocket message type: ${type}`, data);
        }
      }

    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', {
        error: error.message,
        rawMessage: event.data
      });
    }
  }

  /**
     * Обробка welcome повідомлення
     */
  handleWelcome(data) {
    this.clientId = data.clientId;
    this.logger.info('WebSocket welcome received', {
      clientId: this.clientId,
      availableSubscriptions: data.availableSubscriptions
    });

    this.emit('welcome', data);
  }

  /**
     * Обробка закриття з'єднання
     */
  handleClose(event) {
    this.stopHeartbeat();

    const reason = event.reason || 'Unknown';
    this.logger.warn(`WebSocket closed: ${event.code} - ${reason}`);

    this.emit('disconnected', {
      code: event.code,
      reason,
      wasClean: event.wasClean
    });

    // Автоматичне перепідключення якщо це не manual disconnect
    if (!this.isManualDisconnect && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
     * Обробка помилок
     */
  handleError(event) {
    this.logger.error('WebSocket error occurred', {
      error: event.error,
      message: event.message,
      type: event.type
    });

    this.emit('error', event);
  }

  /**
     * Планування повторного підключення
     */
  scheduleReconnect() {
    if (this.isManualDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.isManualDisconnect) {
        this.connect();
      }
    }, delay);
  }

  /**
     * Відправка повідомлення
     */
  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.error('Cannot send message - WebSocket not connected', { type, data });
      return false;
    }

    const message = {
      type,
      data,
      timestamp: Date.now()
    };

    try {
      let messageString = JSON.stringify(message);

      // Перевіряємо розмір повідомлення (збільшуємо ліміт до 128KB)
      const maxSize = 128 * 1024; // 128KB
      if (messageString.length > maxSize) {
        // Якщо повідомлення занадто велике, обрізаємо текст
        if (data.params && data.params.text && typeof data.params.text === 'string') {
          const originalText = data.params.text;
          const maxTextLength = Math.floor(maxSize * 0.8); // Залишаємо більше місця для структури JSON

          // Створюємо новий об'єкт повідомлення з обрізаним текстом
          const truncatedMessage = {
            type,
            data: {
              ...data,
              params: {
                ...data.params,
                text: originalText.substring(0, maxTextLength) + '...'
              }
            },
            timestamp: Date.now()
          };

          messageString = JSON.stringify(truncatedMessage);

          this.logger.warn(`Message too large, text truncated from ${originalText.length} to ${truncatedMessage.data.params.text.length} chars`, {
            type,
            originalLength: originalText.length,
            truncatedLength: truncatedMessage.data.params.text.length,
            finalMessageLength: messageString.length
          });
        } else {
          this.logger.error('Message too large and cannot be truncated', {
            type,
            messageSize: messageString.length,
            maxSize
          });
          return false;
        }
      }

      // Додамо детальне логування для TTS команд
      if (type === 'tts-command') {
        this.logger.debug(`TTS WebSocket command: ${messageString.substring(0, 200)}`, {
          type,
          action: data.action,
          hasVoice: !!data.voice || !!(data.params && data.params.voice),
          messageLength: messageString.length
        });
      }

      this.ws.send(messageString);
      this.logger.debug(`Sent WebSocket message: ${type}`, data);
      return true;
    } catch (error) {
      this.logger.error('Failed to send WebSocket message', {
        type,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
     * Підписка на канали
     */
  subscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    channels.forEach(channel => this.subscriptions.add(channel));

    return this.send('subscribe', { channels });
  }

  /**
     * Відписка від каналів
     */
  unsubscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    channels.forEach(channel => this.subscriptions.delete(channel));

    return this.send('unsubscribe', { channels });
  }

  /**
     * Команди для 3D моделі
     */
  triggerAnimation(type, context = {}) {
    return this.send('model3d-command', {
      action: 'trigger-animation',
      params: { type, context }
    });
  }

  setEmotion(agent, emotion, intensity = 0.7, duration = 2000) {
    return this.send('model3d-command', {
      action: 'set-emotion',
      params: { agent, emotion, intensity, duration }
    });
  }

  updateModel3D(updates) {
    return this.send('model3d-command', {
      action: 'update-state',
      params: updates
    });
  }

  /**
     * Команди для TTS
     */
  startTTSVisualization(text, options = {}) {
    return this.send('tts-command', {
      action: 'start-visualization',
      params: { text, options }
    });
  }

  stopTTSVisualization() {
    return this.send('tts-command', {
      action: 'stop-visualization',
      params: {}
    });
  }

  updateAudioAnalysis(analysisData) {
    return this.send('tts-command', {
      action: 'update-analysis',
      params: { analysisData }
    });
  }

  /**
     * Запит поточного стану
     */
  requestState() {
    return this.send('get-state');
  }

  /**
     * Ping для перевірки з'єднання
     */
  ping() {
    return this.send('ping');
  }

  /**
     * Heartbeat для підтримки з'єднання
     */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
     * Event system
     */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }

    const callbacks = this.listeners.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.logger.error(`Error in WebSocket event callback for '${event}'`, error);
      }
    });
  }

  /**
     * Отримати статус підключення
     */
  getStatus() {
    return {
      connected: this.ws && this.ws.readyState === WebSocket.OPEN,
      connecting: this.ws && this.ws.readyState === WebSocket.CONNECTING,
      clientId: this.clientId,
      subscriptions: Array.from(this.subscriptions),
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    };
  }

  /**
     * Перевірка чи підключено
     */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const atlasWebSocket = new AtlasWebSocketClient();

export default atlasWebSocket;
export { AtlasWebSocketClient };
