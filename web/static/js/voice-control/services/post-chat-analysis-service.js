/**
 * @fileoverview Оптимізований пост-чат аналізатор
 * Аналізує чи звертається користувач після відповіді Atlas з кращими алгоритмами
 */

import { BaseService } from '../core/base-service.js';
import { VOICE_CONFIG } from '../core/config.js';
import { Events } from '../events/event-manager.js';
import { analyzeAudioQuality, throttle } from '../utils/voice-utils.js';

/**
 * @typedef {Object} PostChatConfig
 * @property {number} analysisWindow - Вікно аналізу (мс)
 * @property {number} analysisInterval - Інтервал аналізу (мс)
 * @property {number} confidenceThreshold - Поріг впевненості [0-1]
 * @property {number} vadThreshold - Поріг виявлення голосу [0-1]
 * @property {number} minSpeechDuration - Мінімальна тривалість мовлення (мс)
 * @property {number} minSilenceMs - Мінімальна тиша для закінчення (мс)
 * @property {number} speechStartConfidence - Поріг впевненості для старту мовлення [0-1]
 * @property {number} snrMin - Мінімальне співвідношення сигнал/шум
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {'speech_detected'|'silence'|'noise'|'timeout'} type - Тип результату
 * @property {number} confidence - Впевненість [0-1]
 * @property {number} duration - Тривалість аналізу (мс)
 * @property {Object} audioMetrics - Метрики аудіо якості
 * @property {Date} timestamp - Час завершення аналізу
 */

/**
 * Сервіс для пост-чат аналізу мовлення
 */
export class PostChatAnalysisService extends BaseService {
  constructor(config = {}) {
    super({
      name: 'POST_CHAT_ANALYZER',
      version: '2.0.0',
      healthCheckInterval: 0, // Відключено для цього сервісу
      ...config
    });

    this.analysisConfig = {
      ...VOICE_CONFIG.postChat,
      ...config.analysis
    };

    // Audio Context та аналіз (створюємо на вимогу через ensureAudioContext)
    this.audioContext = null;
    this.analyzer = null;
    this.mediaStreamSource = null;

    // Стан аналізу
    this.isAnalyzing = false;
    this.analysisStartTime = null;
    this.analysisTimer = null;
    this.windowTimer = null;

    // Буфери для аналізу
    this.audioBuffer = new Float32Array(2048);
    this.analysisResults = [];
    this.confidenceHistory = [];

    // Стан мовлення
    this.speechState = {
      active: false,
      startedAt: null,
      lastActivity: null,
      silenceStartAt: null,
      totalSpeechDuration: 0
    };

    // Throttled функції
    this.throttledAnalysis = throttle(this.performAnalysis.bind(this), 50);

    // Callbacks
    this.callbacks = {
      onSpeechStart: null,
      onSpeechEnd: null,
      onWindowElapsed: null,
      onAnalysisComplete: null
    };
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    this.logger.info('Post-chat analysis service ready (audio context will initialize on demand)');
    return true;
  }

  /**
     * Знищення сервісу
     * @returns {Promise<void>}
     */
  async onDestroy() {
    await this.stopAnalysis();
    this.cleanupAudioResources();
  }

  /**
     * Запуск пост-чат аналізу
     * @param {MediaStream} mediaStream - Аудіо потік для аналізу
     * @param {Object} [options] - Опції аналізу
     * @param {Function} [options.onSpeechStart] - Callback початку мовлення
     * @param {Function} [options.onSpeechEnd] - Callback кінця мовлення
     * @param {Function} [options.onWindowElapsed] - Callback закінчення вікна
     * @param {Function} [options.onAnalysisComplete] - Callback завершення аналізу
     * @returns {Promise<AnalysisResult>} - Результат аналізу
     */
  async startAnalysis(mediaStream, options = {}) {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    if (!mediaStream || !mediaStream.getAudioTracks().length) {
      throw new Error('Valid media stream required');
    }

    this.logger.info('Starting post-chat analysis');

    try {
      await this.ensureAudioContext();

      // Налаштування callbacks
      this.callbacks = {
        onSpeechStart: options.onSpeechStart || null,
        onSpeechEnd: options.onSpeechEnd || null,
        onWindowElapsed: options.onWindowElapsed || null,
        onAnalysisComplete: options.onAnalysisComplete || null
      };

      // Підключення медіа потоку
      await this.connectMediaStream(mediaStream);

      // Ініціалізація стану
      this.resetAnalysisState();

      // Запуск аналізу
      this.isAnalyzing = true;
      this.analysisStartTime = Date.now();

      // Емісія події початку аналізу
      await this.emit(Events.POST_CHAT_ANALYSIS_STARTED, {
        windowMs: this.analysisConfig.analysisWindow,
        interval: this.analysisConfig.analysisInterval
      });

      // Запуск циклу аналізу
      this.startAnalysisLoop();

      // Встановлення таймера вікна аналізу
      this.setWindowTimer();

      // Повернення Promise який resolve при завершенні
      return new Promise((resolve, reject) => {
        this.analysisPromise = { resolve, reject };
      });

    } catch (error) {
      this.isAnalyzing = false;
      this.logger.error('Failed to start post-chat analysis', null, error);
      throw error;
    }
  }

  /**
     * Зупинка аналізу
     * @param {string} [reason='manual'] - Причина зупинки
     * @returns {Promise<AnalysisResult>} - Результат аналізу
     */
  async stopAnalysis(reason = 'manual') {
    if (!this.isAnalyzing) {
      return null;
    }

    this.logger.info(`Stopping post-chat analysis (reason: ${reason})`);

    try {
      // Зупинка таймерів
      this.stopTimers();

      // Створення результату
      const result = this.createAnalysisResult(reason);

      // Очищення стану
      this.isAnalyzing = false;
      this.disconnectMediaStream();

      // Емісія події завершення
      await this.emit(Events.POST_CHAT_ANALYSIS_COMPLETED, {
        result,
        reason,
        duration: Date.now() - this.analysisStartTime
      });

      // Виклик callback
      if (this.callbacks.onAnalysisComplete) {
        try {
          this.callbacks.onAnalysisComplete(result);
        } catch (error) {
          this.logger.warn('Error in analysis complete callback', null, error);
        }
      }

      // Завершення Promise
      if (this.analysisPromise) {
        this.analysisPromise.resolve(result);
        this.analysisPromise = null;
      }

      return result;

    } catch (error) {
      this.logger.error('Error stopping analysis', null, error);

      if (this.analysisPromise) {
        this.analysisPromise.reject(error);
        this.analysisPromise = null;
      }

      throw error;
    }
  }

  /**
     * Підключення медіа потоку до аналізатора
     * @param {MediaStream} mediaStream - Медіа потік
     * @returns {Promise<void>}
     */
  async connectMediaStream(mediaStream) {
    await this.ensureAudioContext();

    // Створення джерела з медіа потоку
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);
    this.mediaStreamSource.connect(this.analyzer);

    this.logger.debug('Media stream connected to analyzer');
  }

  /**
     * Безпечне забезпечення готовності AudioContext з обробкою browser policies
     */
  async ensureAudioContext() {
    try {
      // Перевірка та створення AudioContext
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.logger.debug('Creating new AudioContext');

        // Створення з перевіркою підтримки
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('AudioContext not supported in this browser');
        }

        this.audioContext = new AudioContextClass();

        // Налаштування аналізатора
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
        this.analyzer.smoothingTimeConstant = 0.8;
        this.analyzer.minDecibels = -90;
        this.analyzer.maxDecibels = -10;

        this.audioBuffer = new Float32Array(this.analyzer.fftSize);

        this.logger.debug('AudioContext created successfully', {
          state: this.audioContext.state,
          sampleRate: this.audioContext.sampleRate
        });
      }

      // Обробка suspended стану (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.logger.debug('Attempting to resume suspended AudioContext');

        try {
          await this.audioContext.resume();
          this.logger.debug('AudioContext resumed successfully');
        } catch (error) {
          this.logger.warn('Failed to resume AudioContext - likely requires user gesture', {
            error: error.message,
            state: this.audioContext.state
          });

          // Не кидаємо помилку, даємо можливість спробувати пізніше
          // після user interaction
          return false;
        }
      }

      // Перевірка фінального стану
      if (this.audioContext.state !== 'running') {
        this.logger.warn('AudioContext is not in running state', {
          state: this.audioContext.state
        });
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to ensure AudioContext', {
        error: error.message,
        contextState: this.audioContext?.state || 'none'
      });
      throw new Error(`AudioContext initialization failed: ${error.message}`);
    }
  }

  /**
     * Відключення медіа потоку
     */
  disconnectMediaStream() {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
      this.logger.debug('Media stream disconnected');
    }
  }

  /**
     * Скидання стану аналізу
     */
  resetAnalysisState() {
    this.analysisResults = [];
    this.confidenceHistory = [];

    this.speechState = {
      active: false,
      startedAt: null,
      lastActivity: null,
      silenceStartAt: null,
      totalSpeechDuration: 0
    };
  }

  /**
     * Запуск циклу аналізу з безпечним управлінням таймерами
     */
  startAnalysisLoop() {
    // Очищення попереднього таймера якщо існує
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }

    // Створення безпечної рекурсивної функції
    const scheduleNextAnalysis = () => {
      // Подвійна перевірка стану для уникнення race conditions
      if (!this.isAnalyzing || this.analysisTimer) {
        return;
      }

      this.analysisTimer = setTimeout(() => {
        // Скидання таймера перед виконанням
        this.analysisTimer = null;

        // Перевірка стану перед виконанням аналізу
        if (!this.isAnalyzing) {
          return;
        }

        try {
          this.throttledAnalysis();
        } catch (error) {
          this.logger.error('Analysis execution failed', error);
          // Зупинка аналізу при критичній помилці
          this.stopAnalysis('error');
          return;
        }

        // Планування наступного циклу
        scheduleNextAnalysis();
      }, this.analysisConfig.analysisInterval);
    };

    // Запуск першого циклу
    scheduleNextAnalysis();
  }

  /**
     * Встановлення таймера вікна аналізу
     */
  setWindowTimer() {
    this.windowTimer = setTimeout(async () => {
      if (this.isAnalyzing) {
        this.logger.debug('Analysis window elapsed');

        // Виклик callback
        if (this.callbacks.onWindowElapsed) {
          try {
            this.callbacks.onWindowElapsed();
          } catch (error) {
            this.logger.warn('Error in window elapsed callback', null, error);
          }
        }

        // Завершення аналізу по таймауту
        await this.stopAnalysis('timeout');
      }
    }, this.analysisConfig.analysisWindow);
  }

  /**
     * Виконання аналізу аудіо
     */
  performAnalysis() {
    if (!this.analyzer || !this.isAnalyzing) return;

    // Отримання аудіо даних
    this.analyzer.getFloatTimeDomainData(this.audioBuffer);

    // Аналіз якості аудіо
    const audioMetrics = analyzeAudioQuality(this.audioBuffer);

    // Voice Activity Detection
    const isVoiceActive = this.detectVoiceActivity(audioMetrics);

    // Оновлення стану мовлення
    this.updateSpeechState(isVoiceActive, audioMetrics);

    // Збереження результату
    this.analysisResults.push({
      timestamp: Date.now(),
      voiceActive: isVoiceActive,
      audioMetrics,
      speechActive: this.speechState.active
    });

    // Обмеження розміру буферу
    if (this.analysisResults.length > 100) {
      this.analysisResults = this.analysisResults.slice(-50);
    }
  }

  /**
     * Виявлення голосової активності
     * @param {Object} audioMetrics - Метрики аудіо
     * @returns {boolean} - Чи активний голос
     */
  detectVoiceActivity(audioMetrics) {
    const { rms, snr, quality } = audioMetrics;

    // Базовий VAD на основі RMS та SNR
    const rmsThreshold = this.analysisConfig.vadThreshold;
    const snrThreshold = this.analysisConfig.snrMin || 2.0;

    const isActive = rms > rmsThreshold && snr > snrThreshold && quality !== 'poor';

    if (isActive) {
      this.logger.debug(`Voice activity detected (RMS: ${rms}, SNR: ${snr}, Quality: ${quality})`);
    }

    return isActive;
  }

  /**
     * Оновлення стану мовлення
     * @param {boolean} isVoiceActive - Чи активний голос
     * @param {Object} audioMetrics - Метрики аудіо
     */
  updateSpeechState(isVoiceActive, audioMetrics) {
    const now = Date.now();
    const minSpeechDuration = this.analysisConfig.minSpeechDuration;
    const minSilence = this.analysisConfig.minSilenceMs;

    if (isVoiceActive) {
      this.speechState.lastActivity = now;

      // Початок мовлення
      if (!this.speechState.active && !this.speechState.startedAt) {
        this.speechState.startedAt = now;
        this.speechState.silenceStartAt = null;

        this.logger.debug('Potential speech start detected');
      }

      // Підтвердження мовлення після мінімальної тривалості
      if (!this.speechState.active && this.speechState.startedAt) {
        const speechDuration = now - this.speechState.startedAt;

        if (speechDuration >= minSpeechDuration) {
          this.speechState.active = true;

          this.logger.info(`🗣️ Speech started (duration: ${speechDuration}ms)`);

          // Емісія події та callback
          this.emit(Events.POST_CHAT_SPEECH_DETECTED, {
            startTime: this.speechState.startedAt,
            audioMetrics
          });

          if (this.callbacks.onSpeechStart) {
            try {
              this.callbacks.onSpeechStart(audioMetrics);
            } catch (error) {
              this.logger.warn('Error in speech start callback', null, error);
            }
          }
        }
      }
    } else {
      // Початок тиші
      if (this.speechState.active && !this.speechState.silenceStartAt) {
        this.speechState.silenceStartAt = now;
        this.logger.debug('Silence started');
      }
    }

    // Перевірка завершення мовлення
    if (this.speechState.active && this.speechState.silenceStartAt) {
      const silenceDuration = now - this.speechState.silenceStartAt;

      if (silenceDuration >= minSilence) {
        this.handleSpeechEnd();
      }
    }
  }

  /**
     * Обробка завершення мовлення
     */
  async handleSpeechEnd() {
    if (!this.speechState.active) return;

    const now = Date.now();
    const totalDuration = now - this.speechState.startedAt;

    this.speechState.totalSpeechDuration += totalDuration;
    this.speechState.active = false;

    this.logger.info(`🤫 Speech ended (duration: ${totalDuration}ms, total: ${this.speechState.totalSpeechDuration}ms)`);

    // Емісія події
    await this.emit(Events.POST_CHAT_SPEECH_ENDED, {
      duration: totalDuration,
      totalDuration: this.speechState.totalSpeechDuration
    });

    // Callback
    if (this.callbacks.onSpeechEnd) {
      try {
        this.callbacks.onSpeechEnd({
          duration: totalDuration,
          totalDuration: this.speechState.totalSpeechDuration
        });
      } catch (error) {
        this.logger.warn('Error in speech end callback', null, error);
      }
    }

    // Автоматичне завершення аналізу після виявлення мовлення
    setTimeout(async () => {
      if (this.isAnalyzing) {
        await this.stopAnalysis('speech_completed');
      }
    }, 500);
  }

  /**
     * Створення результату аналізу
     * @param {string} reason - Причина завершення
     * @returns {AnalysisResult} - Результат аналізу
     */
  createAnalysisResult(reason) {
    const now = Date.now();
    const duration = this.analysisStartTime ? now - this.analysisStartTime : 0;

    // Визначення типу результату
    let type = 'timeout';
    let confidence = 0;

    if (this.speechState.totalSpeechDuration > 0) {
      type = 'speech_detected';
      confidence = Math.min(this.speechState.totalSpeechDuration / 1000, 1.0);
    } else if (this.analysisResults.length > 0) {
      // Аналіз шуму vs тиші
      const noiseResults = this.analysisResults.filter(r =>
        r.audioMetrics.rms > 0.005 && !r.voiceActive);

      if (noiseResults.length > this.analysisResults.length * 0.3) {
        type = 'noise';
        confidence = 0.3;
      } else {
        type = 'silence';
        confidence = 0.1;
      }
    }

    // Обчислення середніх метрик
    const avgMetrics = this.calculateAverageMetrics();

    return {
      type,
      confidence,
      duration,
      audioMetrics: avgMetrics,
      speechDuration: this.speechState.totalSpeechDuration,
      timestamp: new Date(),
      reason,
      analysisPoints: this.analysisResults.length
    };
  }

  /**
     * Обчислення середніх метрик аудіо
     * @returns {Object} - Середні метрики
     */
  calculateAverageMetrics() {
    if (this.analysisResults.length === 0) {
      return { rms: 0, peak: 0, snr: 0, quality: 'poor' };
    }

    const totals = this.analysisResults.reduce((acc, result) => {
      const metrics = result.audioMetrics;
      acc.rms += metrics.rms;
      acc.peak += metrics.peak;
      acc.snr += metrics.snr;
      return acc;
    }, { rms: 0, peak: 0, snr: 0 });

    const count = this.analysisResults.length;

    return {
      rms: Math.round(totals.rms / count * 1000) / 1000,
      peak: Math.round(totals.peak / count * 1000) / 1000,
      snr: Math.round(totals.snr / count * 10) / 10,
      quality: totals.snr / count > 15 ? 'good' : 'fair'
    };
  }

  /**
     * Безпечна зупинка всіх таймерів з перевіркою race conditions
     */
  stopTimers() {
    // Атомарно очищуємо всі таймери
    const analysisTimer = this.analysisTimer;
    const windowTimer = this.windowTimer;

    // Скидуємо посилання перед очищенням
    this.analysisTimer = null;
    this.windowTimer = null;

    // Очищуємо таймери
    if (analysisTimer) {
      clearTimeout(analysisTimer);
    }

    if (windowTimer) {
      clearTimeout(windowTimer);
    }

    this.logger.debug('All timers stopped', {
      hadAnalysisTimer: !!analysisTimer,
      hadWindowTimer: !!windowTimer
    });
  }

  /**
     * Очищення аудіо ресурсів
     */
  cleanupAudioResources() {
    this.stopTimers();
    this.disconnectMediaStream();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      // Не закриваємо контекст повністю, може бути використаний іншими сервісами
      // this.audioContext.close();
    }

    this.logger.debug('Audio resources cleaned up');
  }

  /**
     * Перевірка чи аналіз активний
     * @returns {boolean} - Чи активний аналіз
     */
  isAnalysisActive() {
    return this.isAnalyzing;
  }

  /**
     * Отримання поточного стану мовлення
     * @returns {Object} - Стан мовлення
     */
  getSpeechState() {
    return {
      ...this.speechState,
      isAnalyzing: this.isAnalyzing,
      analysisPoints: this.analysisResults.length,
      elapsedTime: this.analysisStartTime ? Date.now() - this.analysisStartTime : 0
    };
  }
}

export default PostChatAnalysisService;
