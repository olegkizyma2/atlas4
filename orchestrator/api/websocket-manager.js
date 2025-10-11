/**
 * WEBSOCKET MANAGER
 * Управління WebSocket з'єднаннями для real-time комунікації
 */

import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';
import webIntegration from './web-integration.js';

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.heartbeatInterval = 30000; // 30 секунд
    this.heartbeatTimer = null;
  }

  /**
     * Запуск WebSocket сервера
     */
  start(port = 5102) {
    this.wss = new WebSocketServer({
      port,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024 // 1MB
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket Server error', {
        error: error.message,
        stack: error.stack
      });
    });

    // Запуск heartbeat
    this.startHeartbeat();

    logger.info(`WebSocket server started on port ${port}`, {
      port,
      heartbeatInterval: this.heartbeatInterval
    });

    return this.wss;
  }

  /**
     * Обробка нового WebSocket з'єднання
     */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: Date.now(),
      lastPong: Date.now(),
      subscriptions: new Set(['logs', 'model3d', 'tts']) // За замовчуванням підписані на все
    };

    this.clients.set(clientId, clientInfo);
    webIntegration.addConnection(ws);

    logger.info('New WebSocket connection', {
      clientId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent?.substring(0, 50) + '...',
      totalClients: this.clients.size
    });

    // Налаштування обробників повідомлень
    ws.on('message', (message) => {
      this.handleMessage(clientId, message);
    });

    ws.on('pong', () => {
      if (this.clients.has(clientId)) {
        this.clients.get(clientId).lastPong = Date.now();
      }
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error', {
        clientId,
        error: error.message,
        ip: clientInfo.ip
      });
      this.handleDisconnection(clientId, 1006, 'Error');
    });

    // Відправляємо welcome повідомлення
    this.sendToClient(clientId, 'welcome', {
      clientId,
      serverTime: Date.now(),
      availableSubscriptions: ['logs', 'model3d', 'tts', 'chat', 'workflow'],
      currentSubscriptions: Array.from(clientInfo.subscriptions)
    });
  }

  /**
     * Обробка повідомлень від клієнтів
     */
  handleMessage(clientId, rawMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const messageString = rawMessage.toString();

      // Перевіряємо чи повне повідомлення
      if (!messageString.trim().endsWith('}')) {
        logger.error('Incomplete JSON message received', {
          clientId,
          messageLength: messageString.length,
          lastChars: messageString.slice(-50)
        });
        return;
      }

      const message = JSON.parse(messageString);
      const { type, data } = message;

      logger.debug('WebSocket message received', {
        clientId,
        type,
        dataSize: rawMessage.length
      });

      switch (type) {
      case 'subscribe':
        this.handleSubscribe(clientId, data.channels);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, data.channels);
        break;

      case 'model3d-command':
        this.handle3DCommand(clientId, data);
        break;

      case 'tts-command':
        this.handleTTSCommand(clientId, data);
        break;

      case 'ping':
        this.sendToClient(clientId, 'pong', { timestamp: Date.now() });
        break;

      case 'get-state':
        this.sendToClient(clientId, 'current-state', webIntegration.getWebState());
        break;

      default:
        logger.warn('Unknown WebSocket message type', {
          clientId,
          type,
          availableTypes: ['subscribe', 'unsubscribe', 'model3d-command', 'tts-command', 'ping', 'get-state']
        });
      }

    } catch (error) {
      const messageString = rawMessage.toString();

      logger.error('Failed to parse WebSocket message', {
        clientId,
        error: error.message,
        messageLength: messageString.length,
        messageStart: messageString.substring(0, 100),
        messageEnd: messageString.substring(Math.max(0, messageString.length - 100)),
        isValidJSON: messageString.trim().startsWith('{') && messageString.trim().endsWith('}')
      });

      this.sendToClient(clientId, 'error', {
        message: 'Invalid JSON message',
        error: error.message,
        originalMessage: messageString.substring(0, 200) + (messageString.length > 200 ? '...' : '')
      });
    }
  }

  /**
     * Обробка підписки на канали
     */
  handleSubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.add(channel));
    }

    logger.debug('Client subscribed to channels', {
      clientId,
      newChannels: channels,
      totalSubscriptions: client.subscriptions.size
    });

    this.sendToClient(clientId, 'subscribed', {
      channels,
      currentSubscriptions: Array.from(client.subscriptions)
    });
  }

  /**
     * Обробка відписки від каналів
     */
  handleUnsubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.delete(channel));
    }

    logger.debug('Client unsubscribed from channels', {
      clientId,
      removedChannels: channels,
      remainingSubscriptions: client.subscriptions.size
    });

    this.sendToClient(clientId, 'unsubscribed', {
      channels,
      currentSubscriptions: Array.from(client.subscriptions)
    });
  }

  /**
     * Обробка команд для 3D моделі
     */
  handle3DCommand(clientId, data) {
    const { action, params } = data;

    switch (action) {
    case 'trigger-animation':
      webIntegration.triggerAnimation(params.type, params.context);
      break;

    case 'set-emotion':
      webIntegration.setAgentEmotion(params.agent, params.emotion, params.intensity, params.duration);
      break;

    case 'update-state':
      webIntegration.update3DModel(params);
      break;

    default:
      logger.warn('Unknown 3D command', { clientId, action, params });
      this.sendToClient(clientId, 'error', { message: `Unknown 3D action: ${action}` });
    }
  }

  /**
     * Обробка команд для TTS
     */
  handleTTSCommand(clientId, data) {
    const { action, params } = data;

    switch (action) {
    case 'start-visualization':
      webIntegration.startTTSVisualization(params.text, params.options);
      break;

    case 'stop-visualization':
      webIntegration.stopTTSVisualization();
      break;

    case 'update-analysis':
      webIntegration.updateAudioAnalysis(params.analysisData);
      break;

    default:
      logger.warn('Unknown TTS command', { clientId, action, params });
      this.sendToClient(clientId, 'error', { message: `Unknown TTS action: ${action}` });
    }
  }

  /**
     * Обробка відключення клієнта
     */
  handleDisconnection(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      const duration = Date.now() - client.connectedAt;

      logger.info('WebSocket connection closed', {
        clientId,
        duration: `${Math.round(duration / 1000)}s`,
        code,
        reason: reason?.toString(),
        ip: client.ip,
        remainingClients: this.clients.size - 1
      });

      this.clients.delete(clientId);
    }
  }

  /**
     * Відправити повідомлення конкретному клієнту
     */
  sendToClient(clientId, type, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) {
      return false;
    }

    try {
      const message = JSON.stringify({
        type,
        data,
        timestamp: Date.now(),
        clientId
      });

      client.ws.send(message);
      return true;
    } catch (error) {
      logger.error('Failed to send message to client', {
        clientId,
        type,
        error: error.message
      });
      this.handleDisconnection(clientId, 1006, 'Send error');
      return false;
    }
  }

  /**
     * Broadcast повідомлення всім клієнтам з певною підпискою
     */
  broadcastToSubscribers(channel, type, data) {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel) && client.ws.readyState === 1) {
        if (this.sendToClient(clientId, type, data)) {
          sentCount++;
        }
      }
    }

    logger.debug(`Broadcast to ${channel} subscribers`, {
      channel,
      type,
      sentTo: sentCount,
      totalClients: this.clients.size
    });

    return sentCount;
  }

  /**
     * Запуск heartbeat перевірки
     */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.heartbeatInterval * 2; // Подвійний timeout

      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === 1) {
          // Відправляємо ping
          client.ws.ping();

          // Перевіряємо timeout
          if (now - client.lastPong > timeout) {
            logger.warn('Client heartbeat timeout', {
              clientId,
              lastPong: new Date(client.lastPong),
              timeout: `${timeout / 1000}s`
            });
            client.ws.terminate();
            this.handleDisconnection(clientId, 1001, 'Heartbeat timeout');
          }
        } else {
          this.handleDisconnection(clientId, client.ws.readyState, 'Connection closed');
        }
      }
    }, this.heartbeatInterval);
  }

  /**
     * Зупинка WebSocket сервера
     */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server stopped', {
          finalClientCount: this.clients.size
        });
      });
    }

    // Закриваємо всі з'єднання
    for (const [clientId, client] of this.clients) {
      client.ws.close(1001, 'Server shutdown');
    }
    this.clients.clear();
  }

  /**
     * Генерація унікального ID клієнта
     */
  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Отримати статистику WebSocket сервера
     */
  getStats() {
    const connections = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      ip: client.ip,
      connectedAt: new Date(client.connectedAt),
      duration: Date.now() - client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      readyState: client.ws.readyState
    }));

    return {
      isRunning: !!this.wss,
      totalConnections: this.clients.size,
      connections,
      heartbeatInterval: this.heartbeatInterval
    };
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

// Налаштовуємо обробники подій від webIntegration
webIntegration.on('web-log', (logEntry) => {
  wsManager.broadcastToSubscribers('logs', 'new-log', logEntry);
});

webIntegration.on('model3d-update', (updateData) => {
  wsManager.broadcastToSubscribers('model3d', 'model3d-state-change', updateData);
});

webIntegration.on('tts-start', (ttsData) => {
  wsManager.broadcastToSubscribers('tts', 'tts-started', ttsData);
});

webIntegration.on('tts-stop', (ttsData) => {
  wsManager.broadcastToSubscribers('tts', 'tts-stopped', ttsData);
});

webIntegration.on('audio-analysis', (analysisData) => {
  wsManager.broadcastToSubscribers('tts', 'audio-analysis-update', analysisData);
});

webIntegration.on('agent-emotion', (emotionData) => {
  wsManager.broadcastToSubscribers('model3d', 'agent-emotion-change', emotionData);
});

webIntegration.on('animation-trigger', (animationData) => {
  wsManager.broadcastToSubscribers('model3d', 'animation-triggered', animationData);
});

export default wsManager;
