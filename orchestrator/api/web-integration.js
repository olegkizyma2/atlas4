/**
 * WEB INTEGRATION API
 * Інтеграція з новими веб-компонентами (логування, 3D модель, TTS)
 */

import { EventEmitter } from 'events';

class WebIntegrationManager extends EventEmitter {
  constructor() {
    super();
    this.activeConnections = new Set();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.model3DState = {
      currentAnimation: 'idle',
      emotion: 'neutral',
      isVisible: true,
      lastInteraction: Date.now()
    };
    this.ttsState = {
      isPlaying: false,
      currentText: null,
      visualEffects: [],
      audioAnalysis: null
    };
  }

  /**
     * Отримати поточний стан для веб-інтерфейсу
     */
  getWebState() {
    return {
      logs: this.logBuffer.slice(-50), // Останні 50 логів
      model3D: this.model3DState,
      tts: this.ttsState,
      timestamp: Date.now()
    };
  }

  /**
     * Додати лог для веб-інтерфейсу
     */
  addWebLog(level, message, source = 'system', metadata = {}) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      source,
      metadata,
      category: metadata.category || 'general'
    };

    this.logBuffer.push(logEntry);

    // Обмежуємо розмір буферу
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Емітуємо подію для WebSocket
    this.emit('web-log', logEntry);

    return logEntry;
  }

  /**
     * Оновити стан 3D моделі
     */
  update3DModel(updates) {
    const previousState = { ...this.model3DState };

    Object.assign(this.model3DState, {
      ...updates,
      lastInteraction: Date.now()
    });

    // Просто оновлюємо стан без логування (уникаємо циклічну рекурсію)

    this.emit('model3d-update', {
      previous: previousState,
      current: this.model3DState,
      changes: updates
    });

    return this.model3DState;
  }

  /**
     * Почати TTS візуалізацію
     */
  startTTSVisualization(text, options = {}) {
    this.ttsState = {
      isPlaying: true,
      currentText: text,
      startTime: Date.now(),
      options,
      visualEffects: options.effects || ['glow', 'mouth'],
      audioAnalysis: null
    };

    // Оновлюємо 3D модель для TTS
    this.update3DModel({
      currentAnimation: 'speaking',
      emotion: options.emotion || 'focused'
    });

    console.log('TTS visualization started', options.voice || 'unknown', text);

    this.emit('tts-start', {
      text,
      options,
      modelState: this.model3DState
    });

    return this.ttsState;
  }

  /**
     * Зупинити TTS візуалізацію
     */
  stopTTSVisualization() {
    const previousState = { ...this.ttsState };

    this.ttsState = {
      isPlaying: false,
      currentText: null,
      visualEffects: [],
      audioAnalysis: null,
      endTime: Date.now()
    };

    // Повертаємо 3D модель у спокійний стан
    this.update3DModel({
      currentAnimation: 'idle',
      emotion: 'calm'
    });

    console.log('TTS visualization stopped');

    this.emit('tts-stop', {
      previous: previousState,
      duration: previousState.startTime ? Date.now() - previousState.startTime : 0
    });

    return this.ttsState;
  }

  /**
     * Оновити аудіо аналіз для TTS
     */
  updateAudioAnalysis(analysisData) {
    if (!this.ttsState.isPlaying) {
      return null;
    }

    this.ttsState.audioAnalysis = {
      ...analysisData,
      timestamp: Date.now()
    };

    // Оновлюємо 3D модель базуючись на аудіо даних
    if (analysisData.volume > 0.3) {
      this.update3DModel({
        emotion: analysisData.volume > 0.7 ? 'excited' : 'speaking'
      });
    }

    this.emit('audio-analysis', this.ttsState.audioAnalysis);

    return this.ttsState.audioAnalysis;
  }

  /**
     * Встановити емоцію агента
     */
  setAgentEmotion(agentName, emotion, intensity = 0.7, duration = 2000) {
    const emotionData = {
      agent: agentName,
      emotion,
      intensity,
      duration,
      timestamp: Date.now()
    };

    this.update3DModel({
      emotion,
      emotionIntensity: intensity,
      emotionAgent: agentName
    });

    this.addWebLog('info', `Агент ${agentName} змінив емоцію на ${emotion}`, 'emotion', {
      category: 'emotion',
      agent: agentName,
      emotion,
      intensity
    });

    this.emit('agent-emotion', emotionData);

    return emotionData;
  }

  /**
     * Тригер анімації для специфічної події
     */
  triggerAnimation(animationType, context = {}) {
    const animationData = {
      type: animationType,
      context,
      timestamp: Date.now()
    };

    this.update3DModel({
      currentAnimation: animationType,
      animationContext: context
    });

    this.addWebLog('debug', `Тригер анімації: ${animationType}`, 'animation', {
      category: 'animation',
      type: animationType,
      context
    });

    this.emit('animation-trigger', animationData);

    return animationData;
  }

  /**
     * Додати WebSocket з'єднання
     */
  addConnection(ws) {
    this.activeConnections.add(ws);

    // Відправити поточний стан при підключенні
    ws.send(JSON.stringify({
      type: 'initial-state',
      data: this.getWebState()
    }));

    ws.on('close', () => {
      this.activeConnections.delete(ws);
    });

    console.log('WebSocket connection added');
  }

  /**
     * Відправити повідомлення всім підключеним клієнтам
     */
  broadcastToClients(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    this.activeConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
        } catch (error) {
          console.error('Failed to send WebSocket message', error.message);
          this.activeConnections.delete(ws);
        }
      } else {
        this.activeConnections.delete(ws);
      }
    });
  }

  /**
     * Очистити старі логи
     */
  clearOldLogs(maxAge = 24 * 60 * 60 * 1000) { // 24 години за замовчуванням
    const cutoffTime = Date.now() - maxAge;
    const initialLength = this.logBuffer.length;

    this.logBuffer = this.logBuffer.filter(log =>
      new Date(log.timestamp).getTime() > cutoffTime
    );

    const removedCount = initialLength - this.logBuffer.length;

    if (removedCount > 0) {
      console.log(`Cleared ${removedCount} old log entries`);
    }

    return removedCount;
  }

  /**
     * Отримати статистику
     */
  getStats() {
    return {
      connections: this.activeConnections.size,
      logBuffer: this.logBuffer.length,
      model3DState: this.model3DState,
      ttsState: {
        isPlaying: this.ttsState.isPlaying,
        duration: this.ttsState.startTime ? Date.now() - this.ttsState.startTime : 0
      },
      uptime: process.uptime()
    };
  }
}

// Singleton instance
const webIntegration = new WebIntegrationManager();

// Автоматичне очищення старих логів кожну годину
setInterval(() => {
  webIntegration.clearOldLogs();
}, 60 * 60 * 1000);

export default webIntegration;
