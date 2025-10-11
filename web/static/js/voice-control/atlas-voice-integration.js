/**
 * @fileoverview Приклад інтеграції та використання нової системи voice-control
 * Демонструє як підключити та налаштувати VoiceControlManager
 */

import { VoiceControlFactory } from './voice-control-manager.js';
import { VoiceControlMonitoring } from './monitoring/voice-control-monitoring.js';

/**
 * Головний клас для інтеграції voice-control в ATLAS систему
 */
export class AtlasVoiceIntegration {
  constructor() {
    this.voiceControl = null;
    this.monitoring = null;
    this.isInitialized = false;

    // Chat інтеграція
    this.chatSystem = null;
    this.onMessageReceived = null;

    // UI елементи
    this.statusElement = null;
    this.metricsElement = null;
  }

  /**
     * Ініціалізація voice-control системи
     * @param {Object} config - Конфігурація системи
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async initialize(config = {}) {
    try {
      console.log('🎙️ Initializing ATLAS Voice Control System...');

      // Налаштування моніторингу
      this.monitoring = new VoiceControlMonitoring({
        enableMetrics: true,
        enableAlerts: true,
        onAlert: (alert) => this.handleAlert(alert),
        onHealthChange: (service, healthy) => this.handleHealthChange(service, healthy)
      });

      // Створення voice control системи з callbacks
      this.voiceControl = await VoiceControlFactory.createWithCallbacks({
        onTranscription: (result) => this.handleTranscription(result),
        onKeyword: (keyword) => this.handleKeyword(keyword),
        onError: (error) => this.handleError(error),
        onReady: () => this.handleSystemReady()
      }, {
        enableKeywordDetection: config.enableKeywordDetection !== false,
        enablePostChatAnalysis: config.enablePostChatAnalysis !== false,
        logLevel: config.logLevel || 'info',
        autoStart: config.autoStart !== false,
        serviceConfigs: {
          whisper: {
            retryAttempts: 3,
            timeout: 30000,
            ...config.whisper
          },
          microphone: {
            maxRecordingDuration: 60000,
            enableVoiceActivation: true,
            ...config.microphone
          },
          keyword: {
            keywords: ['атлас', 'atlas', 'атлаз', 'атлус', 'атлес', 'слухай', 'олег миколайович'],
            sensitivity: 0.7,
            whisperUrl: 'http://localhost:3002',  // Whisper backend для keyword detection
            useWebSpeechFallback: false,  // НЕ використовувати Web Speech API (низька точність для української)
            ...config.keyword
          },
          results: {
            maxResults: 50,
            enableFiltering: true,
            ...config.results
          }
        }
      });

      // Реєстрація сервісів для моніторингу
      this.registerServicesForMonitoring();

      // Налаштування UI
      this.setupUI();

      this.isInitialized = true;
      console.log('✅ ATLAS Voice Control System initialized successfully');

      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Voice Control System:', error);
      return false;
    }
  }

  /**
     * Реєстрація сервісів для моніторингу
     */
  registerServicesForMonitoring() {
    const services = ['whisper', 'microphone', 'results', 'keyword', 'postChat'];

    for (const serviceName of services) {
      const service = this.voiceControl.getService(serviceName);
      if (service) {
        this.monitoring.registerService(serviceName, service);
      }
    }
  }

  /**
     * Налаштування UI елементів
     */
  setupUI() {
    // Знаходження або створення статус індикатора
    this.statusElement = document.getElementById('voice-control-status') ||
      this.createStatusElement();

    // Знаходження або створення панелі метрик
    this.metricsElement = document.getElementById('voice-control-metrics') ||
      this.createMetricsElement();

    // Оновлення початкового статусу
    this.updateStatusUI('initializing');
  }

  /**
     * Створення статус елемента
     * @returns {HTMLElement} - Створений елемент
     */
  createStatusElement() {
    const element = document.createElement('div');
    element.id = 'voice-control-status';
    element.className = 'voice-control-status';
    element.innerHTML = `
            <div class="status-indicator">
                <span class="status-dot"></span>
                <span class="status-text">Initializing...</span>
            </div>
        `;

    // Додавання в підходящий контейнер
    const container = document.querySelector('.chat-controls') ||
      document.querySelector('.main-controls') ||
      document.body;
    container.appendChild(element);

    return element;
  }

  /**
     * Створення панелі метрик
     * @returns {HTMLElement} - Створений елемент
     */
  createMetricsElement() {
    const element = document.createElement('div');
    element.id = 'voice-control-metrics';
    element.className = 'voice-control-metrics';
    element.style.display = 'none'; // Приховано за замовчуванням

    const container = document.querySelector('.debug-panel') ||
      document.querySelector('.sidebar') ||
      document.body;
    container.appendChild(element);

    return element;
  }

  /**
     * Інтеграція з chat системою
     * @param {Object} chatSystem - Об'єкт chat системи
     */
  integrateChatSystem(chatSystem) {
    this.chatSystem = chatSystem;

    // Налаштування передачі повідомлень в chat
    if (this.voiceControl) {
      this.voiceControl.setTranscriptionCallback((payload) => {
        // payload = {result: {text, confidence, ...}, latency, audioSize}
        const text = payload?.result?.text || payload?.text || '';

        if (this.chatSystem && typeof this.chatSystem.sendMessage === 'function' && text.trim()) {
          this.chatSystem.sendMessage(text.trim());
        }
      });
    }
  }

  /**
     * Обробка результату транскрипції
     * @param {Object} result - Результат транскрипції
     */
  handleTranscription(result) {
    console.log('🗣️ Transcription result:', result);

    // Запис метрики
    this.monitoring.recordMetric('whisper_transcription_count', 1,
      { mode: result.mode }, 'counter');

    if (result.latency) {
      this.monitoring.recordMetric('whisper_transcription_duration',
        result.latency, { mode: result.mode }, 'histogram');
    }

    // Відправка в chat якщо налаштовано
    if (this.chatSystem && result.text && result.text.trim()) {
      try {
        this.chatSystem.sendMessage(result.text.trim());
      } catch (error) {
        console.error('Error sending message to chat:', error);
      }
    }
  }

  /**
     * Обробка виявлення ключового слова
     * @param {Object} keyword - Дані ключового слова
     */
  handleKeyword(keyword) {
    console.log('🎯 Keyword detected:', keyword);

    // Запис метрики
    this.monitoring.recordMetric('keyword_detection_count', 1,
      { keyword: keyword.keyword }, 'counter');

    // Візуальний індикатор активації
    this.showKeywordActivation(keyword.keyword);

    // Можна додати додаткову логіку активації
    this.triggerVoiceActivation(keyword);
  }

  /**
     * Обробка помилки системи
     * @param {Object} error - Дані помилки
     */
  handleError(error) {
    console.error('❌ Voice Control Error:', error);

    // Запис метрики
    this.monitoring.recordMetric('voice_control_error_count', 1,
      { type: error.type, service: error.service }, 'counter');

    // Оновлення UI
    this.updateStatusUI('error', error.error);

    // Можна додати сповіщення користувача
    this.showErrorNotification(error);
  }

  /**
     * Обробка готовності системи
     */
  handleSystemReady() {
    console.log('✅ Voice Control System is ready');

    // Оновлення UI
    this.updateStatusUI('ready');

    // Запуск періодичного оновлення метрик UI
    this.startMetricsUpdates();
  }

  /**
     * Обробка алерту
     * @param {Object} alert - Дані алерту
     */
  handleAlert(alert) {
    console.warn('⚠️ Voice Control Alert:', alert);

    // Можна додати сповіщення або логування в зовнішню систему
    if (alert.severity === 'critical') {
      this.showCriticalAlert(alert);
    }
  }

  /**
     * Обробка зміни здоров'я сервісу
     * @param {string} service - Назва сервісу
     * @param {boolean} healthy - Стан здоров'я
     */
  handleHealthChange(service, healthy) {
    console.log(`🔧 Service ${service} health changed:`, healthy ? 'healthy' : 'unhealthy');

    // Оновлення метрик UI
    this.updateServiceHealth(service, healthy);
  }

  /**
     * Оновлення статусу UI
     * @param {string} status - Статус системи
     * @param {string} [message] - Додаткове повідомлення
     */
  updateStatusUI(status, message = '') {
    if (!this.statusElement) return;

    const statusDot = this.statusElement.querySelector('.status-dot');
    const statusText = this.statusElement.querySelector('.status-text');

    if (statusDot) {
      statusDot.className = `status-dot status-${status}`;
    }

    if (statusText) {
      const statusMessages = {
        initializing: 'Initializing...',
        ready: 'Voice Control Ready',
        listening: 'Listening...',
        recording: 'Recording...',
        processing: 'Processing...',
        error: `Error: ${message}`,
        disabled: 'Voice Control Disabled'
      };

      statusText.textContent = statusMessages[status] || status;
    }
  }

  /**
     * Показ активації ключового слова
     * @param {string} keyword - Виявлене ключове слово
     */
  showKeywordActivation(keyword) {
    // Анімація активації або звуковий сигнал
    if (this.statusElement) {
      this.statusElement.classList.add('keyword-activated');
      setTimeout(() => {
        this.statusElement.classList.remove('keyword-activated');
      }, 1000);
    }
  }

  /**
     * Тригер голосової активації
     * @param {Object} keyword - Дані ключового слова
     */
  triggerVoiceActivation(keyword) {
    // Можна додати спеціальну логіку активації
    // наприклад, автоматичний старт запису
  }

  /**
     * Показ повідомлення про помилку
     * @param {Object} error - Дані помилки
     */
  showErrorNotification(error) {
    // Створення toast повідомлення або інший спосіб сповіщення
    console.error('Voice Control Error:', error);
  }

  /**
     * Показ критичного алерту
     * @param {Object} alert - Дані алерту
     */
  showCriticalAlert(alert) {
    // Важливе сповіщення для критичних проблем
    console.error('CRITICAL Voice Control Alert:', alert);
  }

  /**
     * Запуск оновлення метрик UI
     */
  startMetricsUpdates() {
    // Оновлення кожні 10 секунд
    setInterval(() => {
      if (this.metricsElement && this.isMetricsVisible()) {
        this.updateMetricsUI();
      }
    }, 10000);
  }

  /**
     * Перевірка чи видима панель метрик
     * @returns {boolean} - Чи видима панель
     */
  isMetricsVisible() {
    return this.metricsElement &&
      this.metricsElement.style.display !== 'none';
  }

  /**
     * Оновлення UI метрик
     */
  updateMetricsUI() {
    if (!this.monitoring) return;

    const report = this.monitoring.generateHealthReport();

    this.metricsElement.innerHTML = `
            <div class="metrics-header">
                <h3>Voice Control Metrics</h3>
                <div class="system-status ${report.status}">
                    ${report.status.toUpperCase()}
                </div>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Uptime</div>
                    <div class="metric-value">${this.formatDuration(report.uptime)}</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Avg Latency</div>
                    <div class="metric-value">${Math.round(report.performance.averageLatency)}ms</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Success Rate</div>
                    <div class="metric-value">${Math.round(report.performance.successRate * 100)}%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Throughput</div>
                    <div class="metric-value">${report.performance.throughput.toFixed(2)}/s</div>
                </div>
            </div>
            
            <div class="services-status">
                <h4>Services</h4>
                ${Object.entries(report.services).map(([name, data]) => `
                    <div class="service-item ${data.healthy ? 'healthy' : 'unhealthy'}">
                        <span class="service-name">${name}</span>
                        <span class="service-status">${data.healthy ? '✅' : '❌'}</span>
                    </div>
                `).join('')}
            </div>
            
            ${report.alerts.length > 0 ? `
                <div class="alerts-section">
                    <h4>Active Alerts</h4>
                    ${report.alerts.map(alert => `
                        <div class="alert-item severity-${alert.severity}">
                            <div class="alert-name">${alert.name}</div>
                            <div class="alert-description">${alert.description}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
  }

  /**
     * Форматування тривалості
     * @param {number} ms - Мілісекунди
     * @returns {string} - Відформатована тривалість
     */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
     * Оновлення здоров'я сервісу
     * @param {string} service - Назва сервісу
     * @param {boolean} healthy - Стан здоров'я
     */
  updateServiceHealth(service, healthy) {
    // Логіка оновлення конкретного сервісу в UI
    const serviceElement = this.metricsElement?.querySelector(`.service-${service}`);
    if (serviceElement) {
      serviceElement.className = `service-item ${healthy ? 'healthy' : 'unhealthy'}`;
    }
  }

  /**
     * Переключення видимості панелі метрик
     */
  toggleMetrics() {
    if (this.metricsElement) {
      const isVisible = this.metricsElement.style.display !== 'none';
      this.metricsElement.style.display = isVisible ? 'none' : 'block';

      if (!isVisible) {
        this.updateMetricsUI();
      }
    }
  }

  /**
     * Ручна транскрипція файлу
     * @param {File} file - Аудіо файл
     * @returns {Promise<Object>} - Результат транскрипції
     */
  async transcribeFile(file) {
    if (!this.voiceControl) {
      throw new Error('Voice Control System not initialized');
    }

    return this.voiceControl.transcribeAudio(file);
  }

  /**
     * Примусова зупинка запису
     */
  async stopRecording() {
    if (this.voiceControl) {
      await this.voiceControl.stopRecording();
    }
  }

  /**
     * Очищення результатів
     */
  clearResults() {
    if (this.voiceControl) {
      this.voiceControl.clearAllResults();
    }
  }

  /**
     * Отримання EventManager для інтеграції з іншими компонентами
     * @returns {EventManager|null} - EventManager інстанс
     */
  getEventManager() {
    if (!this.voiceControl) {
      console.warn('[AtlasVoiceIntegration] Voice control not initialized, cannot get EventManager');
      return null;
    }
    return this.voiceControl.getEventManager();
  }

  /**
     * Отримання статусу системи
     * @returns {Object} - Поточний статус
     */
  getSystemStatus() {
    if (!this.voiceControl) {
      return { initialized: false };
    }

    return {
      initialized: this.isInitialized,
      voiceControlStatus: this.voiceControl.getSystemStatus(),
      monitoringStatus: this.monitoring?.generateHealthReport()
    };
  }

  /**
     * Експорт метрик
     * @param {string} format - Формат експорту
     * @returns {Object|string} - Експортовані дані
     */
  exportMetrics(format = 'json') {
    if (!this.monitoring) {
      return null;
    }

    return this.monitoring.exportMetrics(format);
  }

  /**
     * Знищення інтеграції
     */
  async destroy() {
    console.log('🔄 Shutting down Voice Control Integration...');

    if (this.voiceControl) {
      await this.voiceControl.destroy();
      this.voiceControl = null;
    }

    if (this.monitoring) {
      this.monitoring.destroy();
      this.monitoring = null;
    }

    this.isInitialized = false;
    console.log('✅ Voice Control Integration shut down');
  }
}

// Глобальна інстанція для легкого доступу
export let atlasVoice = null;

/**
 * Ініціалізація ATLAS voice control системи
 * @param {Object} config - Конфігурація
 * @returns {Promise<AtlasVoiceIntegration>} - Ініціалізована система
 */
export async function initializeAtlasVoice(config = {}) {
  if (atlasVoice) {
    console.warn('ATLAS Voice Control already initialized');
    return atlasVoice;
  }

  atlasVoice = new AtlasVoiceIntegration();
  const success = await atlasVoice.initialize(config);

  if (!success) {
    atlasVoice = null;
    throw new Error('Failed to initialize ATLAS Voice Control');
  }

  // Глобальний доступ для debugging
  window.atlasVoice = atlasVoice;

  return atlasVoice;
}

export default AtlasVoiceIntegration;
