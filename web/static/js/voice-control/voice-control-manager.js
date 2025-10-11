/**
 * @fileoverview Головний менеджер системи голосового управління
 * Оркеструє всі voice-control сервіси та надає єдиний API для інтеграції
 */

import { BaseService } from './core/base-service.js';
import { EventManager, Events } from './events/event-manager.js';
import { VOICE_CONFIG } from './core/config.js';
import { createLogger } from './core/logger.js';

// Імпорт всіх сервісів
import { WhisperService } from './services/whisper-service.js';
import { KeywordDetectionService } from './services/keyword-detection-service.js';
import { WhisperKeywordDetection } from './services/whisper-keyword-detection.js';
import { PostChatAnalysisService } from './services/post-chat-analysis-service.js';
import { SpeechResultsService } from './services/speech-results-service.js';
import { MicrophoneButtonService } from './services/microphone-button-service.js';

/**
 * @typedef {Object} VoiceControlStatus
 * @property {boolean} isInitialized - Чи ініціалізована система
 * @property {boolean} isActive - Чи активна система
 * @property {Object<string, boolean>} services - Стан кожного сервісу
 * @property {Object} capabilities - Доступні можливості
 * @property {Array} errors - Поточні помилки
 * @property {Object} statistics - Загальна статистика
 */

/**
 * @typedef {Object} VoiceControlConfig
 * @property {boolean} enableKeywordDetection - Увімкнути детекцію ключових слів
 * @property {boolean} enablePostChatAnalysis - Увімкнути пост-чат аналіз
 * @property {boolean} enableResultsFiltering - Увімкнути фільтрацію результатів
 * @property {boolean} autoStart - Автозапуск системи
 * @property {string} logLevel - Рівень логування
 * @property {Object} serviceConfigs - Конфігурації окремих сервісів
 */

/**
 * Головний менеджер системи голосового управління
 */
export class VoiceControlManager extends BaseService {
  constructor(config = {}) {
    super({
      name: 'VOICE_CONTROL_MANAGER',
      version: '2.0.0',
      healthCheckInterval: 10000,
      ...config
    });

    // Конфігурація системи
    this.config = {
      enableKeywordDetection: config.enableKeywordDetection !== false,
      enablePostChatAnalysis: config.enablePostChatAnalysis !== false,
      enableResultsFiltering: config.enableResultsFiltering !== false,
      autoStart: config.autoStart !== false,
      logLevel: config.logLevel || 'info',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 2000,
      serviceConfigs: config.serviceConfigs || {},
      ...config
    };

    // Сервіси системи
    this.services = new Map();
    this.serviceOrder = [
      'whisper',
      'microphone',
      'results',
      'keyword',
      'postChat'
    ];

    // Стан системи
    this.isInitialized = false;
    this.isActive = false;
    this.initializationPromise = null;
    this.startupErrors = [];

    // Глобальний event manager
    this.eventManager = null;

    // Статистика системи
    this.systemStatistics = {
      startTime: null,
      uptime: 0,
      totalTranscriptions: 0,
      totalKeywordDetections: 0,
      totalErrors: 0,
      serviceRestarts: 0,
      lastActivity: null
    };

    // Callbacks для інтеграції
    this.onTranscriptionResult = null;
    this.onKeywordDetected = null;
    this.onSystemError = null;
    this.onSystemReady = null;

    // Bind methods
    this.handleSystemError = this.handleSystemError.bind(this);
    this.handleServiceFailure = this.handleServiceFailure.bind(this);
  }

  /**
     * Ініціалізація системи голосового управління
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    try {
      this.logger.info('Initializing Voice Control System v4.0');

      const baseLogger = typeof this.logger?.category === 'function'
        ? this.logger
        : createLogger(this.name || 'VOICE_CONTROL_MANAGER');

      this.logger = baseLogger;

      // Створення глобального event manager
      this.eventManager = new EventManager({
        logger: typeof baseLogger.category === 'function'
          ? baseLogger.category('EVENTS')
          : baseLogger
      });

      // Встановлення глобального доступу до event manager
      window.voiceControlEvents = this.eventManager;

      // Ініціалізація сервісів
      await this.initializeServices();

      // Налаштування міжсервісної комунікації
      this.setupServiceCommunication();

      // Запуск системи якщо увімкнено автозапуск
      if (this.config.autoStart) {
        await this.startSystem();
      }

      this.isInitialized = true;
      this.systemStatistics.startTime = new Date();

      this.logger.info('Voice Control System initialized successfully');

      // Виклик callback готовності
      if (this.onSystemReady) {
        try {
          this.onSystemReady(this.getSystemStatus());
        } catch (error) {
          this.logger.warn('Error in system ready callback', null, error);
        }
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Voice Control System', null, error);
      this.startupErrors.push({
        error,
        timestamp: new Date(),
        phase: 'initialization'
      });
      return false;
    }
  }

  /**
     * Знищення системи
     * @returns {Promise<void>}
     */
  async onDestroy() {
    this.logger.info('Shutting down Voice Control System');

    try {
      // Зупинка системи
      await this.stopSystem();

      // Знищення всіх сервісів
      for (const [name, service] of this.services) {
        try {
          await service.destroy();
          this.logger.debug(`Service ${name} destroyed`);
        } catch (error) {
          this.logger.error(`Error destroying service ${name}`, null, error);
        }
      }

      // Очищення event manager
      if (this.eventManager) {
        this.eventManager.destroy();
        this.eventManager = null;
      }

      // Очищення глобального доступу
      if (window.voiceControlEvents) {
        delete window.voiceControlEvents;
      }

      this.services.clear();
      this.isInitialized = false;
      this.isActive = false;

    } catch (error) {
      this.logger.error('Error during system shutdown', null, error);
    }
  }

  /**
     * Перевірка здоров'я системи
     * @returns {Promise<boolean>} - Стан здоров'я
     */
  async checkHealth() {
    const baseHealth = await super.checkHealth();

    if (!baseHealth || !this.isInitialized) {
      return false;
    }

    // Перевірка критично важливих сервісів
    const criticalServices = ['whisper', 'microphone'];

    for (const serviceName of criticalServices) {
      const service = this.services.get(serviceName);

      if (!service || !await service.checkHealth()) {
        this.logger.warn(`Critical service ${serviceName} is unhealthy`);
        return false;
      }
    }

    return true;
  }

  /**
     * Ініціалізація всіх сервісів
     * @returns {Promise<void>}
     */
  async initializeServices() {
    const serviceConfigs = this.config.serviceConfigs;

    // Whisper Service (обов'язковий)
    const whisperService = new WhisperService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('WHISPER')
        : this.logger,
      eventManager: this.eventManager,
      ...serviceConfigs.whisper
    });
    this.services.set('whisper', whisperService);

    // Microphone Button Service (обов'язковий)
    const microphoneService = new MicrophoneButtonService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('MICROPHONE')
        : this.logger,
      eventManager: this.eventManager,
      ...serviceConfigs.microphone
    });
    this.services.set('microphone', microphoneService);

    // Speech Results Service (обов'язковий)
    const resultsService = new SpeechResultsService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('RESULTS')
        : this.logger,
      eventManager: this.eventManager,
      ...serviceConfigs.results
    });
    this.services.set('results', resultsService);

    // Keyword Detection Service (опціональний)
    // ВИКОРИСТОВУЄМО WHISPER замість Web Speech для кращої точності!
    if (this.config.enableKeywordDetection) {
      const whisperKeywordService = new WhisperKeywordDetection({
        logger: typeof this.logger.category === 'function'
          ? this.logger.category('WHISPER_KEYWORD')
          : this.logger,
        eventManager: this.eventManager,
        keywords: ['атлас', 'atlas', 'атлаз', 'атлус', 'атлес', 'слухай', 'олег миколайович'],
        ...serviceConfigs.keyword
      });
      this.services.set('keyword', whisperKeywordService);

      // Також тримаємо старий Web Speech як fallback (відключений за замовчуванням)
      if (serviceConfigs.keyword?.useWebSpeechFallback) {
        const webSpeechKeywordService = new KeywordDetectionService({
          logger: typeof this.logger.category === 'function'
            ? this.logger.category('KEYWORD_WEBSPEECH')
            : this.logger,
          eventManager: this.eventManager,
          ...serviceConfigs.keyword
        });
        this.services.set('keyword_webspeech', webSpeechKeywordService);
      }
    }

    // Post Chat Analysis Service (опціональний)
    if (this.config.enablePostChatAnalysis) {
      const postChatService = new PostChatAnalysisService({
        logger: typeof this.logger.category === 'function'
          ? this.logger.category('POST_CHAT')
          : this.logger,
        eventManager: this.eventManager,
        ...serviceConfigs.postChat
      });
      this.services.set('postChat', postChatService);
    }

    // Ініціалізація сервісів у правильному порядку
    for (const serviceName of this.serviceOrder) {
      const service = this.services.get(serviceName);

      if (service) {
        try {
          this.logger.debug(`Initializing service: ${serviceName}`);
          const success = await service.initialize();

          if (!success) {
            throw new Error(`Service ${serviceName} failed to initialize`);
          }

          this.logger.debug(`Service ${serviceName} initialized successfully`);

        } catch (error) {
          this.logger.error(`Failed to initialize service ${serviceName}`, null, error);

          // Критичні сервіси
          const criticalServices = ['whisper', 'microphone'];
          if (criticalServices.includes(serviceName)) {
            throw error;
          } else {
            // Не критичні сервіси - просто видаляємо
            this.services.delete(serviceName);
            this.startupErrors.push({
              error,
              service: serviceName,
              timestamp: new Date(),
              phase: 'service_initialization'
            });
          }
        }
      }
    }

    this.logger.info(`Initialized ${this.services.size} services`);
  }

  /**
     * Налаштування комунікації між сервісами
     */
  setupServiceCommunication() {
    // Інтеграція результатів з chat системою
    const resultsService = this.services.get('results');
    if (resultsService && this.onTranscriptionResult) {
      resultsService.setResultClickCallback(this.onTranscriptionResult);
    }

    // Підписка на ключові події системи
    this.subscribeToSystemEvents();

    // Налаштування cross-service callbacks
    this.setupCrossServiceCallbacks();
  }

  /**
     * Підписка на події системи
     */
  subscribeToSystemEvents() {
    // Транскрипція завершена
    this.eventManager.on(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
      this.systemStatistics.totalTranscriptions++;
      this.systemStatistics.lastActivity = new Date();

      if (this.onTranscriptionResult) {
        this.onTranscriptionResult(event.payload);
      }
    });

    // Виявлено ключове слово
    this.eventManager.on(Events.KEYWORD_DETECTED, (event) => {
      this.systemStatistics.totalKeywordDetections++;
      this.systemStatistics.lastActivity = new Date();

      if (this.onKeywordDetected) {
        this.onKeywordDetected(event.payload);
      }
    });

    // Помилки сервісів
    this.eventManager.on(Events.SERVICE_ERROR, (event) => {
      this.handleServiceError(event.payload, event);
    });

    // Збої сервісів
    this.eventManager.on(Events.SERVICE_FAILURE, (event) => {
      this.handleServiceFailure(event.payload, event);
    });

    // Системні помилки
    this.eventManager.on(Events.SYSTEM_ERROR, (event) => {
      this.handleSystemError(event.payload, event);
    });
  }

  /**
     * Налаштування cross-service callbacks
     */
  setupCrossServiceCallbacks() {
    // Microphone -> Whisper інтеграція
    const micService = this.services.get('microphone');
    const whisperService = this.services.get('whisper');

    // ✅ ВИДАЛЕНО дублікат обробника - WhisperService вже підписаний на AUDIO_READY_FOR_TRANSCRIPTION
    // У WhisperService.subscribeToMicrophoneEvents() є власний обробник

    // Keyword -> Microphone інтеграція
    const keywordService = this.services.get('keyword');
    if (keywordService && micService) {
      this.eventManager.on(Events.KEYWORD_DETECTED, (event) => {
        // Keyword detection буде тригерити microphone через event
        this.logger.debug(`Keyword detection will trigger microphone: ${event.payload.keyword}`);
      });
    }
  }

  /**
     * Запуск системи
     * @returns {Promise<void>}
     */
  async startSystem() {
    if (this.isActive) {
      this.logger.warn('System is already active');
      return;
    }

    try {
      this.logger.info('Starting Voice Control System');

      // Запуск сервісів у правильному порядку
      for (const serviceName of this.serviceOrder) {
        const service = this.services.get(serviceName);

        if (service && typeof service.start === 'function') {
          try {
            await service.start();
            this.logger.debug(`Service ${serviceName} started`);
          } catch (error) {
            this.logger.error(`Failed to start service ${serviceName}`, null, error);

            // Критичні сервіси зупиняють весь запуск
            if (['whisper', 'microphone'].includes(serviceName)) {
              throw error;
            }
          }
        }
      }

      this.isActive = true;

      // Емісія події готовності системи
      await this.eventManager.emit(Events.SYSTEM_READY, {
        timestamp: new Date(),
        services: Array.from(this.services.keys()),
        configuration: this.config
      }, { source: this.name || 'voice-control-manager' });

      this.logger.info('Voice Control System started successfully');

    } catch (error) {
      this.logger.error('Failed to start Voice Control System', null, error);
      await this.stopSystem(); // Cleanup на випадок часткового запуску
      throw error;
    }
  }

  /**
     * Зупинка системи
     * @returns {Promise<void>}
     */
  async stopSystem() {
    if (!this.isActive) {
      this.logger.debug('System is not active');
      return;
    }

    try {
      this.logger.info('Stopping Voice Control System');

      // Зупинка сервісів у зворотному порядку
      const reverseOrder = [...this.serviceOrder].reverse();

      for (const serviceName of reverseOrder) {
        const service = this.services.get(serviceName);

        if (service && typeof service.stop === 'function') {
          try {
            await service.stop();
            this.logger.debug(`Service ${serviceName} stopped`);
          } catch (error) {
            this.logger.error(`Error stopping service ${serviceName}`, null, error);
          }
        }
      }

      this.isActive = false;

      // Емісія події зупинки
      await this.eventManager.emit(Events.SYSTEM_STOPPED, {
        timestamp: new Date()
      }, { source: this.name || 'voice-control-manager' });

      this.logger.info('Voice Control System stopped');

    } catch (error) {
      this.logger.error('Error during system stop', null, error);
      this.isActive = false; // Примусова зупинка
    }
  }

  /**
     * Перезапуск системи
     * @returns {Promise<void>}
     */
  async restartSystem() {
    this.logger.info('Restarting Voice Control System');

    try {
      await this.stopSystem();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза
      await this.startSystem();

      this.systemStatistics.serviceRestarts++;

    } catch (error) {
      this.logger.error('Failed to restart system', null, error);
      throw error;
    }
  }

  /**
     * Перезапуск конкретного сервісу
     * @param {string} serviceName - Назва сервісу
     * @returns {Promise<boolean>} - Успішність перезапуску
     */
  async restartService(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      this.logger.warn(`Service ${serviceName} not found`);
      return false;
    }

    try {
      this.logger.info(`Restarting service: ${serviceName}`);

      // Зупинка сервісу
      if (typeof service.stop === 'function') {
        await service.stop();
      }

      // Пауза
      await new Promise(resolve => setTimeout(resolve, 500));

      // Повторна ініціалізація
      await service.destroy();
      const success = await service.initialize();

      if (success && typeof service.start === 'function') {
        await service.start();
      }

      this.systemStatistics.serviceRestarts++;
      this.logger.info(`Service ${serviceName} restarted successfully`);

      return success;

    } catch (error) {
      this.logger.error(`Failed to restart service ${serviceName}`, null, error);
      return false;
    }
  }

  /**
     * Обробка помилок сервісу
     * @param {Object} errorPayload - Дані про помилку
     */
  handleServiceError(errorPayload = {}, event = {}) {
    try {
      this.systemStatistics.totalErrors++;

      const eventSource = event.source && event.source !== 'unknown' ? event.source : null;
      const serviceName = errorPayload.service || errorPayload.serviceName || eventSource || 'unknown_service';
      const errorMessage = errorPayload.error || errorPayload.message || errorPayload.toString() || 'unspecified_error';

      this.logger.warn(`Service error in ${serviceName}: ${errorMessage}`, {
        payload: errorPayload,
        eventSource: event.source
      });

      if (this.onSystemError) {
        this.onSystemError({
          type: 'service_error',
          service: serviceName,
          error: errorMessage,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Error in handleServiceError handler', { originalPayload: errorPayload }, error);
    }
  }

  /**
     * Обробка збою сервісу
     * @param {Object} failurePayload - Дані про збій
     */
  async handleServiceFailure(failurePayload = {}, event = {}) {
    try {
      const eventSource = event.source && event.source !== 'unknown' ? event.source : null;
      const serviceName = failurePayload.service || failurePayload.serviceName || eventSource || 'unknown_service';
      const failureError = failurePayload.error || failurePayload.message || failurePayload.toString() || 'unspecified_failure';

      this.logger.error(`Service failure: ${serviceName} (${failureError})`, {
        payload: failurePayload,
        eventSource: event.source
      });

      const isCritical = ['whisper', 'microphone'].includes(serviceName);

      if (isCritical) {
        this.logger.error(`Critical service ${serviceName} failed, attempting restart`);

        try {
          const restarted = await this.restartService(serviceName);

          if (!restarted) {
            throw new Error(`Failed to restart critical service ${serviceName}`);
          }

        } catch (error) {
          // Критичний збій - зупинка всієї системи
          this.logger.error('Critical service restart failed, stopping system', null, error);
          await this.stopSystem();

          if (this.onSystemError) {
            this.onSystemError({
              type: 'critical_failure',
              service: serviceName,
              error: error.message || failureError,
              timestamp: new Date()
            });
          }
        }
      } else {
        // Не критичний сервіс - просто логування
        this.logger.warn(`Non-critical service ${serviceName} failed, continuing operation`);
      }
    } catch (error) {
      this.logger.error('Error in handleServiceFailure handler', { originalPayload: failurePayload }, error);
    }
  }

  /**
     * Обробка системних помилок
     * @param {Object} errorPayload - Дані про помилку
     */
  handleSystemError(errorPayload = {}, event = {}) {
    try {
      this.systemStatistics.totalErrors++;

      const eventSource = event.source && event.source !== 'unknown' ? event.source : null;
      const errorMessage = errorPayload.error || errorPayload.message || errorPayload.toString() || `unspecified_system_error${eventSource ? ` (source: ${eventSource})` : ''}`;

      this.logger.error(`System error: ${errorMessage}`, {
        payload: errorPayload,
        eventSource: event.source
      });

      if (this.onSystemError) {
        this.onSystemError({
          type: 'system_error',
          error: errorMessage,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.error('Error in handleSystemError handler', { originalPayload: errorPayload }, error);
    }
  }

  /**
     * Отримання статусу системи
     * @returns {VoiceControlStatus} - Поточний статус
     */
  getSystemStatus() {
    const services = {};
    const errors = [];

    // Статус кожного сервісу
    for (const [name, service] of this.services) {
      services[name] = {
        initialized: service.isInitialized || false,
        healthy: service.isHealthy || false,
        version: service.version || 'unknown'
      };
    }

    // Поточні помилки
    errors.push(...this.startupErrors);

    // Можливості системи
    const capabilities = {
      canTranscribe: this.services.has('whisper'),
      canDetectKeywords: this.services.has('keyword'),
      canAnalyzePostChat: this.services.has('postChat'),
      canFilterResults: this.services.has('results'),
      canRecordAudio: this.services.has('microphone')
    };

    // Статистика з uptime
    const statistics = {
      ...this.systemStatistics,
      uptime: this.systemStatistics.startTime ?
        Date.now() - this.systemStatistics.startTime : 0
    };

    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      services,
      capabilities,
      errors: errors.slice(-10), // Останні 10 помилок
      statistics
    };
  }

  /**
     * Отримання статистики конкретного сервісу
     * @param {string} serviceName - Назва сервісу
     * @returns {Object|null} - Статистика сервісу
     */
  getServiceStatistics(serviceName) {
    const service = this.services.get(serviceName);

    if (!service || typeof service.getStatistics !== 'function') {
      return null;
    }

    return service.getStatistics();
  }

  /**
     * Експорт системних логів
     * @param {Object} [options] - Опції експорту
     * @returns {Object} - Дані логів
     */
  exportSystemLogs(options = {}) {
    const logs = {
      system: {
        status: this.getSystemStatus(),
        configuration: this.config,
        timestamp: new Date()
      },
      services: {}
    };

    // Логи кожного сервісу
    for (const [name, service] of this.services) {
      if (typeof service.exportLogs === 'function') {
        logs.services[name] = service.exportLogs(options);
      }
    }

    // Глобальні логи event manager
    if (this.eventManager && typeof this.eventManager.exportLogs === 'function') {
      logs.events = this.eventManager.exportLogs(options);
    }

    return logs;
  }

  /**
     * Встановлення callback для результатів транскрипції
     * @param {Function} callback - Функція callback
     */
  setTranscriptionCallback(callback) {
    this.onTranscriptionResult = callback;

    // Оновлення існуючого сервісу результатів
    const resultsService = this.services.get('results');
    if (resultsService) {
      resultsService.setResultClickCallback(callback);
    }
  }

  /**
     * Встановлення callback для виявлення ключових слів
     * @param {Function} callback - Функція callback
     */
  setKeywordCallback(callback) {
    this.onKeywordDetected = callback;
  }

  /**
     * Встановлення callback для системних помилок
     * @param {Function} callback - Функція callback
     */
  setErrorCallback(callback) {
    this.onSystemError = callback;
  }

  /**
     * Встановлення callback для готовності системи
     * @param {Function} callback - Функція callback
     */
  setReadyCallback(callback) {
    this.onSystemReady = callback;
  }

  /**
     * Отримання сервісу за назвою
     * @param {string} name - Назва сервісу
     * @returns {BaseService|null} - Сервіс або null
     */
  getService(name) {
    return this.services.get(name) || null;
  }

  /**
     * Перевірка наявності певної можливості
     * @param {string} capability - Назва можливості
     * @returns {boolean} - Чи доступна можливість
     */
  hasCapability(capability) {
    const status = this.getSystemStatus();
    return status.capabilities[capability] || false;
  }

  /**
     * Отримання EventManager для інтеграції
     * @returns {EventManager} - EventManager інстанс
     */
  getEventManager() {
    return this.eventManager;
  }

  /**
     * Ручна транскрипція аудіо
     * @param {Blob} audioBlob - Аудіо дані
     * @param {string} [mode='short'] - Режим транскрипції
     * @param {Object} [options] - Додаткові опції
     * @returns {Promise<Object>} - Результат транскрипції
     */
  async transcribeAudio(audioBlob, mode = 'short', options = {}) {
    const whisperService = this.services.get('whisper');

    if (!whisperService) {
      throw new Error('Whisper service not available');
    }

    return whisperService.transcribeAudio(audioBlob, mode, options);
  }

  /**
     * Примусова зупинка запису
     * @returns {Promise<void>}
     */
  async stopRecording() {
    const micService = this.services.get('microphone');

    if (micService && typeof micService.forceStop === 'function') {
      await micService.forceStop();
    }
  }

  /**
     * Очищення всіх результатів
     * @returns {void}
     */
  clearAllResults() {
    const resultsService = this.services.get('results');

    if (resultsService && typeof resultsService.clearAllResults === 'function') {
      resultsService.clearAllResults();
    }
  }
}

// Глобальна фабрика для створення системи
export class VoiceControlFactory {
  /**
     * Створення та ініціалізація системи голосового управління
     * @param {VoiceControlConfig} config - Конфігурація системи
     * @returns {Promise<VoiceControlManager>} - Ініціалізована система
     */
  static async create(config = {}) {
    const manager = new VoiceControlManager(config);

    const success = await manager.initialize();

    if (!success) {
      throw new Error('Failed to initialize Voice Control System');
    }

    return manager;
  }

  /**
     * Створення системи з автозапуском
     * @param {VoiceControlConfig} config - Конфігурація
     * @returns {Promise<VoiceControlManager>} - Запущена система
     */
  static async createAndStart(config = {}) {
    const manager = await VoiceControlFactory.create({
      autoStart: true,
      ...config
    });

    return manager;
  }

  /**
     * Створення системи з інтеграційними callbacks
     * @param {Object} callbacks - Callbacks для інтеграції
     * @param {VoiceControlConfig} config - Конфігурація
     * @returns {Promise<VoiceControlManager>} - Налаштована система
     */
  static async createWithCallbacks(callbacks = {}, config = {}) {
    const manager = await VoiceControlFactory.create(config);

    // Встановлення callbacks
    if (callbacks.onTranscription) {
      manager.setTranscriptionCallback(callbacks.onTranscription);
    }

    if (callbacks.onKeyword) {
      manager.setKeywordCallback(callbacks.onKeyword);
    }

    if (callbacks.onError) {
      manager.setErrorCallback(callbacks.onError);
    }

    if (callbacks.onReady) {
      manager.setReadyCallback(callbacks.onReady);
    }

    return manager;
  }
}

// Експорт для глобального використання
export default VoiceControlManager;
