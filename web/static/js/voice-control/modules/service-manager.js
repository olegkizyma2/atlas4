/**
 * Voice Control Service Manager - v4.0
 * Відповідає за ініціалізацію, управління та координацію всіх voice сервісів
 */

import { createLogger } from '../core/logger.js';
import { EventManager, Events } from '../events/event-manager.js';

// Імпорт сервісів
import { WhisperService } from '../services/whisper-service.js';
import { KeywordDetectionService } from '../services/keyword-detection-service.js';
import { PostChatAnalysisService } from '../services/post-chat-analysis-service.js';
import { SpeechResultsService } from '../services/speech-results-service.js';
import { MicrophoneButtonService } from '../services/microphone-button-service.js';

export class ServiceManager {
  constructor(config = {}, eventManager, logger) {
    this.config = config;
    this.eventManager = eventManager;
    this.logger = logger || createLogger('SERVICE-MANAGER');

    // Сервіси системи
    this.services = new Map();
    this.serviceOrder = [
      'whisper',
      'microphone',
      'results',
      'keyword',
      'postChat'
    ];

    // Помилки ініціалізації
    this.startupErrors = [];
  }

  /**
     * Ініціалізація всіх сервісів
     */
  async initializeServices() {
    const serviceConfigs = this.config.serviceConfigs || {};

    this.logger.info('Initializing voice control services...');

    // Whisper Service (обов'язковий)
    await this.createWhisperService(serviceConfigs.whisper);

    // Microphone Button Service (обов'язковий)
    await this.createMicrophoneService(serviceConfigs.microphone);

    // Speech Results Service (обов'язковий)
    await this.createResultsService(serviceConfigs.results);

    // Keyword Detection Service (опціональний)
    if (this.config.enableKeywordDetection) {
      this.logger.info('🔑 Creating Keyword Detection Service (enableKeywordDetection=true)');
      await this.createKeywordService(serviceConfigs.keyword);
    } else {
      this.logger.warn('⚠️ Keyword Detection Service DISABLED (enableKeywordDetection=false)');
    }

    // Post Chat Analysis Service (опціональний)
    if (this.config.enablePostChatAnalysis) {
      await this.createPostChatService(serviceConfigs.postChat);
    }

    // Ініціалізація сервісів у правильному порядку
    await this.initializeServicesInOrder();

    this.logger.info(`Successfully initialized ${this.services.size} services`);
  }

  /**
     * Створення Whisper сервісу
     */
  async createWhisperService(config = {}) {
    const whisperService = new WhisperService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('WHISPER')
        : this.logger,
      eventManager: this.eventManager,
      ...config
    });
    this.services.set('whisper', whisperService);
  }

  /**
     * Створення Microphone сервісу
     */
  async createMicrophoneService(config = {}) {
    const microphoneService = new MicrophoneButtonService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('MICROPHONE')
        : this.logger,
      eventManager: this.eventManager,
      ...config
    });
    this.services.set('microphone', microphoneService);
  }

  /**
     * Створення Results сервісу
     */
  async createResultsService(config = {}) {
    const resultsService = new SpeechResultsService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('RESULTS')
        : this.logger,
      eventManager: this.eventManager,
      ...config
    });
    this.services.set('results', resultsService);
  }

  /**
     * Створення Keyword Detection сервісу
     */
  async createKeywordService(config = {}) {
    console.log('[SERVICE-MANAGER] 🔑 Creating KeywordDetectionService with config:', {
      hasEventManager: !!this.eventManager,
      hasLogger: !!this.logger,
      config
    });

    const keywordService = new KeywordDetectionService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('KEYWORD')
        : this.logger,
      eventManager: this.eventManager,
      ...config
    });

    console.log('[SERVICE-MANAGER] ✅ KeywordDetectionService created, adding to services map');
    this.services.set('keyword', keywordService);
  }

  /**
     * Створення Post Chat Analysis сервісу
     */
  async createPostChatService(config = {}) {
    const postChatService = new PostChatAnalysisService({
      logger: typeof this.logger.category === 'function'
        ? this.logger.category('POST_CHAT')
        : this.logger,
      eventManager: this.eventManager,
      ...config
    });
    this.services.set('postChat', postChatService);
  }

  /**
     * Ініціалізація сервісів у правильному порядку
     */
  async initializeServicesInOrder() {
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
  }

  /**
     * Запуск всіх сервісів
     */
  async startServices() {
    this.logger.info('Starting voice control services...');

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

    this.logger.info('All services started successfully');
  }

  /**
     * Зупинка всіх сервісів
     */
  async stopServices() {
    this.logger.info('Stopping voice control services...');

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

    this.logger.info('All services stopped');
  }

  /**
     * Знищення всіх сервісів
     */
  async destroyServices() {
    this.logger.info('Destroying voice control services...');

    for (const [name, service] of this.services) {
      try {
        await service.destroy();
        this.logger.debug(`Service ${name} destroyed`);
      } catch (error) {
        this.logger.error(`Error destroying service ${name}`, null, error);
      }
    }

    this.services.clear();
    this.logger.info('All services destroyed');
  }

  /**
     * Перевірка здоров'я сервісів
     */
  async checkServicesHealth() {
    const healthResults = new Map();

    for (const [name, service] of this.services) {
      try {
        const isHealthy = await service.checkHealth();
        healthResults.set(name, isHealthy);
      } catch (error) {
        this.logger.warn(`Health check failed for service ${name}`, null, error);
        healthResults.set(name, false);
      }
    }

    return healthResults;
  }

  /**
     * Отримання сервісу за назвою
     */
  getService(name) {
    return this.services.get(name);
  }

  /**
     * Отримання всіх сервісів
     */
  getAllServices() {
    return new Map(this.services);
  }

  /**
     * Отримання стану сервісів
     */
  getServicesStatus() {
    const status = {};

    for (const [name, service] of this.services) {
      status[name] = {
        initialized: !!service,
        healthy: false // Буде оновлено async
      };
    }

    return status;
  }

  /**
     * Отримання помилок ініціалізації
     */
  getStartupErrors() {
    return [...this.startupErrors];
  }
}
