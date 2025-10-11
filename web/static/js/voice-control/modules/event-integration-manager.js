/**
 * Voice Control Event Integration Manager - v4.0
 * Відповідає за налаштування комунікації між сервісами та обробку подій
 */

import { Events } from '../events/event-manager.js';

export class EventIntegrationManager {
  constructor(serviceManager, eventManager, logger) {
    this.serviceManager = serviceManager;
    this.eventManager = eventManager;
    this.logger = logger;

    // Callbacks для інтеграції
    this.onTranscriptionResult = null;
    this.onKeywordDetected = null;
    this.onSystemError = null;

    // Статистика
    this.statistics = {
      totalTranscriptions: 0,
      totalKeywordDetections: 0,
      totalErrors: 0,
      lastActivity: null
    };
  }

  /**
     * Налаштування комунікації між сервісами
     */
  setupServiceCommunication() {
    this.logger.info('Setting up service communication...');

    // Інтеграція результатів з chat системою
    this.setupResultsIntegration();

    // Підписка на ключові події системи
    this.subscribeToSystemEvents();

    // Налаштування cross-service callbacks
    this.setupCrossServiceCallbacks();

    this.logger.info('Service communication setup complete');
  }

  /**
     * Налаштування інтеграції результатів
     */
  setupResultsIntegration() {
    const resultsService = this.serviceManager.getService('results');
    if (resultsService && this.onTranscriptionResult) {
      resultsService.setResultClickCallback(this.onTranscriptionResult);
    }
  }

  /**
     * Підписка на події системи
     */
  subscribeToSystemEvents() {
    // Транскрипція завершена
    this.eventManager.on(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
      this.statistics.totalTranscriptions++;
      this.statistics.lastActivity = new Date();

      if (this.onTranscriptionResult) {
        this.onTranscriptionResult(event.payload);
      }
    });

    // Виявлено ключове слово
    this.eventManager.on(Events.KEYWORD_DETECTED, (event) => {
      this.statistics.totalKeywordDetections++;
      this.statistics.lastActivity = new Date();

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
    this.setupMicrophoneWhisperIntegration();

    // Keyword -> Microphone інтеграція
    this.setupKeywordMicrophoneIntegration();
  }

  /**
     * Налаштування інтеграції Microphone -> Whisper
     */
  setupMicrophoneWhisperIntegration() {
    const micService = this.serviceManager.getService('microphone');
    const whisperService = this.serviceManager.getService('whisper');

    if (micService && whisperService) {
      this.eventManager.on(Events.AUDIO_READY_FOR_TRANSCRIPTION, async (event) => {
        try {
          const { audioBlob, mode, sessionId } = event.payload || {};

          if (!audioBlob || !audioBlob.size) {
            this.logger.info('Skipping transcription for empty audio payload', {
              sessionId,
              mode,
              reason: 'empty_audio_blob'
            });
            return;
          }

          await whisperService.transcribeAudio(
            audioBlob,
            mode,
            { sessionId }
          );
        } catch (error) {
          this.logger.error('Error in microphone->whisper integration', event.payload, error);
        }
      });
    }
  }

  /**
     * Налаштування інтеграції Keyword -> Microphone
     */
  setupKeywordMicrophoneIntegration() {
    const keywordService = this.serviceManager.getService('keyword');
    const micService = this.serviceManager.getService('microphone');

    if (keywordService && micService) {
      this.eventManager.on(Events.KEYWORD_DETECTED, (event) => {
        this.logger.debug(`Keyword detection will trigger microphone: ${event.payload.keyword}`);
      });
    }
  }

  /**
     * Обробка помилки сервісу
     */
  handleServiceError(payload, event) {
    this.statistics.totalErrors++;
    this.logger.warn('Service error occurred', payload);

    if (this.onSystemError) {
      this.onSystemError({
        type: 'service_error',
        payload,
        event,
        timestamp: new Date()
      });
    }
  }

  /**
     * Обробка збою сервісу
     */
  handleServiceFailure(payload, event) {
    this.statistics.totalErrors++;
    this.logger.error('Service failure occurred', payload);

    if (this.onSystemError) {
      this.onSystemError({
        type: 'service_failure',
        payload,
        event,
        timestamp: new Date()
      });
    }
  }

  /**
     * Обробка системної помилки
     */
  handleSystemError(payload, event) {
    this.statistics.totalErrors++;
    this.logger.error('System error occurred', payload);

    if (this.onSystemError) {
      this.onSystemError({
        type: 'system_error',
        payload,
        event,
        timestamp: new Date()
      });
    }
  }

  /**
     * Встановлення callback для результатів транскрипції
     */
  setTranscriptionResultCallback(callback) {
    this.onTranscriptionResult = callback;

    // Оновлюємо results service якщо вже ініціалізований
    const resultsService = this.serviceManager.getService('results');
    if (resultsService) {
      resultsService.setResultClickCallback(callback);
    }
  }

  /**
     * Встановлення callback для виявлення ключових слів
     */
  setKeywordDetectedCallback(callback) {
    this.onKeywordDetected = callback;
  }

  /**
     * Встановлення callback для системних помилок
     */
  setSystemErrorCallback(callback) {
    this.onSystemError = callback;
  }

  /**
     * Отримання статистики подій
     */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
     * Скидання статистики
     */
  resetStatistics() {
    this.statistics = {
      totalTranscriptions: 0,
      totalKeywordDetections: 0,
      totalErrors: 0,
      lastActivity: null
    };
  }
}
