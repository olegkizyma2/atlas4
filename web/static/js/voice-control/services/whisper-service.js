/**
 * @fileoverview Оптимізований Whisper сервіс для високоякісного розпізнавання мови
 * Забезпечує інтеграцію з локальним Whisper API та обробку аудіо даних
 */

import { BaseService } from '../core/base-service.js';
import { API_ENDPOINTS, AUDIO_CONFIG } from '../core/config.js';
import { Events } from '../events/event-manager.js';
import { retry, createAudioConstraints } from '../utils/voice-utils.js';

/**
 * @typedef {Object} TranscriptionOptions
 * @property {string} [model='whisper-1'] - Модель Whisper
 * @property {string} [language='uk'] - Мова розпізнавання
 * @property {string} [response_format='json'] - Формат відповіді
 * @property {number} [temperature=0.2] - Температура [0-1]
 * @property {number} [maxDuration=60000] - Максимальна тривалість (мс)
 */

/**
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Розпізнаний текст
 * @property {string} language - Виявлена мова
 * @property {number} duration - Тривалість аудіо (сек)
 * @property {number} confidence - Впевненість розпізнавання [0-1]
 * @property {Array<{text: string, start: number, end: number}>} [segments] - Сегменти
 */

/**
 * Сервіс для роботи з Whisper API
 */
export class WhisperService extends BaseService {
  constructor(config = {}) {
    super({
      name: 'WHISPER_SERVICE',
      version: '2.0.0',
      healthCheckInterval: 30000,
      maxRetries: 3,
      ...config
    });

    this.serviceUrl = config.serviceUrl || API_ENDPOINTS.whisper;
    this.defaultOptions = {
      model: 'whisper-1',
      language: 'uk',
      response_format: 'json',
      temperature: 0.2,
      maxDuration: 60000,
      ...config.defaultOptions
    };

    // Стан запису
    this.mediaRecorder = null;
    this.audioStream = null;
    this.isRecording = false;
    this.recordingPromise = null;

    // Буфер аудіо даних
    this.audioChunks = [];

    // Метрики
    this.transcriptionMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalDuration: 0,
      averageAccuracy: 0
    };
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    try {
      // Перевірка доступності сервісу
      const available = await this.checkServiceAvailability();
      if (!available) {
        this.logger.warn('Whisper service not available, service will work in fallback mode');
        return false;
      }

      // Перевірка підтримки MediaRecorder
      if (!window.MediaRecorder) {
        this.logger.error('MediaRecorder not supported in this browser');
        return false;
      }

      // Підписка на події від MicrophoneButtonService
      this.subscribeToMicrophoneEvents();

      this.logger.info(`Whisper service initialized (URL: ${this.serviceUrl})`);
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Whisper service', null, error);
      return false;
    }
  }

  /**
     * Підписка на події від мікрофона
     */
  subscribeToMicrophoneEvents() {
    // Обробка готового аудіо для транскрипції
    this.subscribe(Events.AUDIO_READY_FOR_TRANSCRIPTION, (event) => {
      this.handleAudioReadyForTranscription(event.payload);
    });

    this.logger.debug('Subscribed to microphone events (AUDIO_READY_FOR_TRANSCRIPTION)');
  }

  /**
     * Обробка події готовності аудіо для транскрипції
     * @param {Object} payload - Дані події
     */
  async handleAudioReadyForTranscription(payload) {
    try {
      // Перевірка наявності audioBlob - тихо виходимо якщо немає
      if (!payload || !payload.audioBlob) {
        // Подія може емітуватись і для інших цілей, не тільки для транскрипції
        return;
      }

      this.logger.info(`🎙️ Received audio for transcription (session: ${payload.sessionId}, size: ${payload.audioBlob.size} bytes)`);

      // Виконання транскрипції
      const result = await this.transcribeAudio(payload.audioBlob, {
        mode: payload.mode,
        language: 'uk'
      });

      this.logger.info(`✅ Transcription successful: "${result.text}"`);

    } catch (error) {
      this.logger.error('Failed to process audio for transcription', {
        sessionId: payload?.sessionId
      }, error);
    }
  }

  /**
     * Знищення сервісу
     * @returns {Promise<void>}
     */
  async onDestroy() {
    await this.stopRecording();
    this.cleanupAudioResources();
  }

  /**
     * Перевірка здоров'я сервісу
     * @returns {Promise<boolean>} - Чи здоровий сервіс
     */
  async onHealthCheck() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      this.logger.debug('Health check failed', null, error);
      return false;
    }
  }

  /**
     * Перевірка доступності Whisper сервісу
     * @returns {Promise<boolean>} - Чи доступний сервіс
     */
  async checkServiceAvailability() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.logger.info(`Whisper service available: ${data.backend || data.model || 'unknown'} on ${data.device}`);

      // Емісія події про доступність сервісу
      await this.emit(Events.WHISPER_SERVICE_AVAILABLE, {
        model: data.backend || data.model || 'unknown',
        device: data.device,
        version: data.version
      });

      return true;

    } catch (error) {
      this.logger.warn(`Whisper service not available: ${error.message}`);

      await this.emit(Events.WHISPER_SERVICE_UNAVAILABLE, {
        error: error.message,
        url: this.serviceUrl
      });

      return false;
    }
  }

  /**
     * Ініціалізація запису аудіо
     * @param {Object} [constraints] - MediaStream constraints
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async initializeRecording(constraints = null) {
    try {
      if (this.isRecording) {
        this.logger.warn('Recording already in progress');
        return false;
      }

      // Використання існуючого потоку або створення нового
      if (!this.audioStream) {
        const audioConstraints = constraints || createAudioConstraints(AUDIO_CONFIG);
        this.audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        await this.emit(Events.MICROPHONE_PERMISSION_GRANTED, {
          constraints: audioConstraints
        });
      }

      // Створення MediaRecorder
      const options = {
        mimeType: this.getSupportedMimeType()
      };

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      this.setupRecorderEventHandlers();

      this.logger.debug('Audio recording initialized', {
        mimeType: options.mimeType,
        audioTracks: this.audioStream.getAudioTracks().length
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to initialize recording', null, error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        await this.emit(Events.MICROPHONE_PERMISSION_DENIED, {
          error: error.message
        });
      }

      return false;
    }
  }

  /**
     * Налаштування обробників подій MediaRecorder
     */
  setupRecorderEventHandlers() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.logger.debug(`Audio chunk received: ${event.data.size} bytes`);
      }
    };

    this.mediaRecorder.onstart = () => {
      this.isRecording = true;
      this.audioChunks = [];
      this.logger.info('Audio recording started');
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      this.logger.info('Audio recording stopped');
    };

    this.mediaRecorder.onerror = (event) => {
      this.logger.error('MediaRecorder error', null, event.error);
      this.isRecording = false;
    };
  }

  /**
     * Визначення підтримуваного MIME типу для запису
     * @returns {string} - MIME тип
     */
  getSupportedMimeType() {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    this.logger.warn('No supported MIME type found, using default');
    return '';
  }

  /**
     * Запуск запису аудіо
     * @param {Object} [options] - Опції запису
     * @param {number} [options.maxDuration] - Максимальна тривалість (мс)
     * @param {number} [options.timeslice] - Інтервал генерації даних (мс)
     * @returns {Promise<void>}
     */
  async startRecording(options = {}) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    if (!this.mediaRecorder) {
      const initialized = await this.initializeRecording();
      if (!initialized) {
        throw new Error('Failed to initialize recording');
      }
    }

    const { maxDuration = this.defaultOptions.maxDuration, timeslice } = options;

    // Створення Promise для відстеження запису
    this.recordingPromise = new Promise((resolve, reject) => {
      const startTime = Date.now();
      let maxDurationTimer;

      const cleanup = () => {
        if (maxDurationTimer) {
          clearTimeout(maxDurationTimer);
        }
      };

      this.mediaRecorder.onstop = () => {
        cleanup();
        const duration = Date.now() - startTime;

        this.logger.info(`Recording completed (duration: ${duration}ms, chunks: ${this.audioChunks.length})`);

        if (this.audioChunks.length === 0) {
          reject(new Error('No audio data recorded'));
        } else {
          resolve(this.createAudioBlob());
        }
      };

      this.mediaRecorder.onerror = (event) => {
        cleanup();
        reject(event.error || new Error('Recording error'));
      };

      // Автоматична зупинка після максимальної тривалості
      if (maxDuration > 0) {
        maxDurationTimer = setTimeout(() => {
          if (this.isRecording) {
            this.logger.debug(`Auto-stopping recording after ${maxDuration}ms`);
            this.stopRecording();
          }
        }, maxDuration);
      }
    });

    // Емісія події початку запису
    await this.emit(Events.MICROPHONE_RECORDING_STARTED, {
      maxDuration,
      timeslice
    });

    // Запуск запису
    if (timeslice) {
      this.mediaRecorder.start(timeslice);
    } else {
      this.mediaRecorder.start();
    }
  }

  /**
     * Зупинка запису аудіо
     * @returns {Promise<Blob>} - Blob з аудіо даними
     */
  async stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      this.logger.warn('No active recording to stop');
      return null;
    }

    // Зупинка запису
    this.mediaRecorder.stop();

    // Емісія події зупинки запису
    await this.emit(Events.MICROPHONE_RECORDING_STOPPED, {
      chunks: this.audioChunks.length
    });

    // Очікування завершення запису
    try {
      const audioBlob = await this.recordingPromise;
      return audioBlob;
    } finally {
      this.recordingPromise = null;
    }
  }

  /**
     * Створення Blob з аудіо даних
     * @returns {Blob} - Blob з аудіо даними
     */
  createAudioBlob() {
    if (this.audioChunks.length === 0) {
      throw new Error('No audio chunks to create blob');
    }

    const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
    const blob = new Blob(this.audioChunks, { type: mimeType });

    this.logger.debug(`Created audio blob: ${blob.size} bytes, type: ${blob.type}`);
    return blob;
  }

  /**
     * Транскрипція аудіо файлу
     * @param {Blob} audioBlob - Аудіо дані
     * @param {TranscriptionOptions} [options] - Опції транскрипції
     * @returns {Promise<TranscriptionResult>} - Результат транскрипції
     */
  async transcribeAudio(audioBlob, options = {}) {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid audio data provided');
    }

    const transcriptionOptions = {
      ...this.defaultOptions,
      ...options
    };

    // Емісія події початку транскрипції
    await this.emit(Events.WHISPER_TRANSCRIPTION_STARTED, {
      audioSize: audioBlob.size,
      options: transcriptionOptions
    });

    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(async () => {
        return await this.performTranscription(audioBlob, transcriptionOptions);
      }, {
        maxRetries: this.config.maxRetries
      });

      const latency = Date.now() - startTime;

      // Оновлення метрик
      this.updateTranscriptionMetrics(latency, true, result.confidence);

      // Емісія події завершення транскрипції
      // FIXED (11.10.2025 - 17:10): Додаємо text на верхній рівень для conversation-mode
      await this.emit(Events.WHISPER_TRANSCRIPTION_COMPLETED, {
        text: result.text,      // Для conversation-mode compatibility
        result,                 // Повний результат
        latency,
        audioSize: audioBlob.size,
        confidence: result.confidence
      });

      this.logger.info(`Transcription completed in ${latency}ms: "${result.text}"`);
      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateTranscriptionMetrics(latency, false);

      await this.emit(Events.WHISPER_TRANSCRIPTION_ERROR, {
        error: error.message,
        latency,
        audioSize: audioBlob.size
      });

      this.logger.error('Transcription failed', { latency, audioSize: audioBlob.size }, error);
      throw error;
    }
  }

  /**
     * Виконання запиту до Whisper API
     * @param {Blob} audioBlob - Аудіо дані
     * @param {TranscriptionOptions} options - Опції транскрипції
     * @returns {Promise<TranscriptionResult>} - Результат транскрипції
     */
  async performTranscription(audioBlob, options) {
    const formData = new FormData();

    // Whisper.cpp використовує ім'я поля 'audio' замість 'file'
    formData.append('audio', audioBlob, 'audio.webm');

    // Додаємо параметри
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && key !== 'maxDuration') {
        formData.append(key, value.toString());
      }
    });

    // Whisper.cpp endpoint: /transcribe (НЕ /v1/audio/transcriptions як OpenAI)
    const response = await fetch(`${this.serviceUrl}/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // Ігнорування помилки парсингу JSON
      }

      throw new Error(`Whisper API error: ${errorMessage}`);
    }

    const data = await response.json();

    // Нормалізація результату
    return this.normalizeTranscriptionResult(data);
  }

  /**
     * Нормалізація результату транскрипції
     * @param {Object} rawResult - Сирий результат від API
     * @returns {TranscriptionResult} - Нормалізований результат
     */
  normalizeTranscriptionResult(rawResult) {
    return {
      text: rawResult.text || '',
      language: rawResult.language || this.defaultOptions.language,
      duration: rawResult.duration || 0,
      confidence: rawResult.confidence || 1.0,
      segments: rawResult.segments || []
    };
  }

  /**
     * Оновлення метрик транскрипції
     * @param {number} latency - Час виконання (мс)
     * @param {boolean} success - Чи успішно
     * @param {number} [confidence] - Впевненість результату
     */
  updateTranscriptionMetrics(latency, success, confidence = null) {
    const metrics = this.transcriptionMetrics;

    metrics.totalRequests++;

    if (success) {
      metrics.successfulRequests++;

      // Оновлення середньої затримки
      const totalLatency = metrics.averageLatency * (metrics.successfulRequests - 1) + latency;
      metrics.averageLatency = Math.round(totalLatency / metrics.successfulRequests);

      // Оновлення середньої точності
      if (confidence !== null) {
        const totalAccuracy = metrics.averageAccuracy * (metrics.successfulRequests - 1) + confidence;
        metrics.averageAccuracy = totalAccuracy / metrics.successfulRequests;
      }
    } else {
      metrics.failedRequests++;
    }
  }

  /**
     * Запис і транскрипція за один виклик
     * @param {Object} [recordingOptions] - Опції запису
     * @param {TranscriptionOptions} [transcriptionOptions] - Опції транскрипції
     * @returns {Promise<TranscriptionResult>} - Результат транскрипції
     */
  async recordAndTranscribe(recordingOptions = {}, transcriptionOptions = {}) {
    this.logger.info('Starting record and transcribe operation');

    try {
      // Запуск запису
      await this.startRecording(recordingOptions);

      // Очікування завершення запису (має бути зупинено зовні або автоматично)
      const audioBlob = await this.recordingPromise;

      if (!audioBlob) {
        throw new Error('Recording failed - no audio data');
      }

      // Транскрипція
      const result = await this.transcribeAudio(audioBlob, transcriptionOptions);

      this.logger.info(`Record and transcribe completed: "${result.text}"`);
      return result;

    } catch (error) {
      // Зупинка запису у випадку помилки
      if (this.isRecording) {
        try {
          this.mediaRecorder.stop();
        } catch (e) {
          this.logger.warn('Failed to stop recording during error cleanup', null, e);
        }
      }

      throw error;
    }
  }

  /**
     * Очищення аудіо ресурсів
     */
  cleanupAudioResources() {
    // Зупинка запису
    if (this.isRecording && this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        this.logger.warn('Error stopping MediaRecorder during cleanup', null, error);
      }
    }

    // Закриття аудіо потоку
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => {
        track.stop();
      });
      this.audioStream = null;
    }

    // Очищення посилань
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingPromise = null;

    this.logger.debug('Audio resources cleaned up');
  }

  /**
     * Отримання метрик сервісу
     * @returns {Object} - Метрики транскрипції та загальні метрики сервісу
     */
  getMetrics() {
    return {
      ...super.getMetrics(),
      transcription: { ...this.transcriptionMetrics },
      recording: {
        isRecording: this.isRecording,
        hasAudioStream: !!this.audioStream,
        audioChunks: this.audioChunks.length
      }
    };
  }
}

export default WhisperService;
