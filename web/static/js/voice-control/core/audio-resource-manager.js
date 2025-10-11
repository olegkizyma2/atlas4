/**
 * @fileoverview Централізований менеджер аудіо ресурсів для ATLAS
 * Забезпечує координацію доступу до мікрофона між всіма voice services
 * Реалізує patterns: Resource Manager + Observer + State Machine + Circuit Breaker
 */

import { BaseService } from './base-service.js';
import { Events } from '../events/event-manager.js';
import { VoiceLogger } from '../utils/voice-logger.js';

/**
 * @typedef {Object} AudioMode
 * @property {string} name - Назва режиму
 * @property {number} priority - Пріоритет режиму (вищий номер = вищий пріоритет)
 * @property {string} serviceId - ID сервісу який запитує режим
 * @property {Object} constraints - Обмеження для аудіо потоку
 */

/**
 * @typedef {Object} StateTransition
 * @property {string} from - Початковий стан
 * @property {string} to - Цільовий стан
 * @property {boolean} allowed - Чи дозволений перехід
 * @property {Function} validator - Функція валідації переходу
 * @property {Function} onTransition - Колбек при переході
 */

/**
 * Централізований менеджер аудіо ресурсів
 */
export class AudioResourceManager extends BaseService {
  constructor(config = {}) {
    super({
      name: 'AUDIO_RESOURCE_MANAGER',
      version: '1.0.0',
      healthCheckInterval: 5000,
      ...config
    });

    // Поточний стан системи
    this.currentMode = 'idle';
    this.activeService = null;
    this.resourceQueue = [];
    this.stateHistory = [];

    // Система обсерверів
    this.observers = new Set();

    // Аудіо ресурси
    this.audioContext = null;
    this.mediaStream = null;
    this.audioAnalyser = null;

    // Метрики та моніторинг
    this.metrics = {
      modeTransitions: 0,
      resourceConflicts: 0,
      averageTransitionTime: 0,
      errorRate: 0,
      totalRequests: 0,
      deniedRequests: 0
    };

    // Налаштування режимів
    this.modes = new Map([
      ['idle', { priority: 0, constraints: null }],
      ['keyword_detection', { priority: 1, constraints: { audio: true, video: false } }],
      ['manual_recording', { priority: 3, constraints: { audio: true, video: false, echoCancellation: true } }],
      ['post_chat_analysis', { priority: 2, constraints: { audio: true, video: false, noiseSuppression: false } }],
      ['tts_playback', { priority: 4, constraints: null }] // Блокує всі інші режими
    ]);

    // Дозволені переходи між станами
    this.stateTransitions = new Map();
    this._initializeStateTransitions();

    // Таймери та інтервали
    this.transitionTimeout = null;
    this.metricsInterval = null;

    this.logger = new VoiceLogger('AudioResourceManager');

    this._setupEventListeners();
    this._startMetricsCollection();
  }

  /**
     * Ініціалізація дозволених переходів між станами
     * @private
     */
  _initializeStateTransitions() {
    const allowedTransitions = [
      // З idle можна перейти до будь-якого режиму
      { from: 'idle', to: 'keyword_detection', allowed: true },
      { from: 'idle', to: 'manual_recording', allowed: true },
      { from: 'idle', to: 'post_chat_analysis', allowed: true },
      { from: 'idle', to: 'tts_playback', allowed: true },

      // Keyword detection може бути перервана записом або TTS
      { from: 'keyword_detection', to: 'manual_recording', allowed: true },
      { from: 'keyword_detection', to: 'tts_playback', allowed: true },
      { from: 'keyword_detection', to: 'idle', allowed: true },

      // Manual recording має найвищий пріоритет, може бути перервана тільки TTS
      { from: 'manual_recording', to: 'tts_playback', allowed: true },
      { from: 'manual_recording', to: 'idle', allowed: true },
      { from: 'manual_recording', to: 'post_chat_analysis', allowed: true },

      // Post-chat analysis може бути перервана записом або TTS
      { from: 'post_chat_analysis', to: 'manual_recording', allowed: true },
      { from: 'post_chat_analysis', to: 'tts_playback', allowed: true },
      { from: 'post_chat_analysis', to: 'keyword_detection', allowed: true },
      { from: 'post_chat_analysis', to: 'idle', allowed: true },

      // TTS має абсолютний пріоритет
      { from: 'tts_playback', to: 'idle', allowed: true },
      { from: 'tts_playback', to: 'keyword_detection', allowed: true },
      { from: 'tts_playback', to: 'post_chat_analysis', allowed: true }
    ];

    allowedTransitions.forEach(transition => {
      const key = `${transition.from}->${transition.to}`;
      this.stateTransitions.set(key, transition);
    });
  }

  /**
     * Запит на зміну режиму роботи з аудіо ресурсами
     * @param {string} newMode - Новий режим
     * @param {string} serviceId - ID сервісу який запитує
     * @param {Object} options - Додаткові параметри
     * @returns {Promise<boolean>} - Успішність переходу
     */
  async requestMode(newMode, serviceId, options = {}) {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      this.logger.debug(`Mode request: ${this.currentMode} -> ${newMode}`, {
        serviceId,
        options,
        currentService: this.activeService?.id
      });

      // Валідація запиту
      const validation = this._validateModeRequest(newMode, serviceId, options);
      if (!validation.valid) {
        this.metrics.deniedRequests++;
        this.logger.warn('Mode request denied', validation);
        return false;
      }

      // Перевірка пріоритетів
      if (!this._checkPriority(newMode, serviceId)) {
        this.metrics.resourceConflicts++;
        this.logger.warn('Mode request denied due to priority', {
          requestedMode: newMode,
          currentMode: this.currentMode,
          serviceId
        });
        return false;
      }

      // Виконання переходу
      const success = await this._executeTransition(newMode, serviceId, options);

      if (success) {
        this._updateMetrics(startTime);
        this._recordStateHistory(newMode, serviceId);
        this._notifyObservers('modeChanged', {
          from: this.currentMode,
          to: newMode,
          serviceId,
          timestamp: Date.now()
        });
      }

      return success;

    } catch (error) {
      this.metrics.errorRate++;
      this.logger.error('Mode request failed', { newMode, serviceId, error });

      // Спроба rollback при помилці
      await this._attemptRollback();
      return false;
    }
  }

  /**
     * Валідація запиту на зміну режиму
     * @private
     */
  _validateModeRequest(newMode, serviceId, options) {
    // Перевірка існування режиму
    if (!this.modes.has(newMode)) {
      return { valid: false, reason: 'Unknown mode', mode: newMode };
    }

    // Перевірка дозволених переходів
    const transitionKey = `${this.currentMode}->${newMode}`;
    const transition = this.stateTransitions.get(transitionKey);

    if (!transition || !transition.allowed) {
      return {
        valid: false,
        reason: 'Transition not allowed',
        from: this.currentMode,
        to: newMode
      };
    }

    // Валідація сервісу
    if (!serviceId) {
      return { valid: false, reason: 'Service ID required' };
    }

    return { valid: true };
  }

  /**
     * Перевірка пріоритетів між режимами
     * @private
     */
  _checkPriority(newMode, serviceId) {
    const currentPriority = this.modes.get(this.currentMode)?.priority || 0;
    const requestedPriority = this.modes.get(newMode)?.priority || 0;

    // Режим з вищим пріоритетом може перервати поточний
    if (requestedPriority > currentPriority) {
      return true;
    }

    // Той самий сервіс може змінювати свій режим
    if (this.activeService?.id === serviceId) {
      return true;
    }

    // Перехід в idle завжди дозволений
    if (newMode === 'idle') {
      return true;
    }

    return requestedPriority >= currentPriority;
  }

  /**
     * Виконання переходу між режимами
     * @private
     */
  async _executeTransition(newMode, serviceId, options) {
    try {
      // Graceful shutdown поточного режиму
      if (this.activeService && this.activeService.id !== serviceId) {
        await this._gracefulShutdown(this.activeService);
      }

      // Підготовка аудіо ресурсів для нового режиму
      await this._prepareAudioResources(newMode);

      // Оновлення стану
      const previousMode = this.currentMode;
      this.currentMode = newMode;
      this.activeService = { id: serviceId, mode: newMode, startTime: Date.now() };

      this.logger.info('Mode transition completed', {
        from: previousMode,
        to: newMode,
        serviceId
      });

      return true;

    } catch (error) {
      this.logger.error('Transition execution failed', { newMode, serviceId, error });
      throw error;
    }
  }

  /**
     * Підготовка аудіо ресурсів для режиму
     * @private
     */
  async _prepareAudioResources(mode) {
    const modeConfig = this.modes.get(mode);

    if (mode === 'idle' || mode === 'tts_playback') {
      // Звільнення ресурсів для idle або TTS
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      return;
    }

    // Підготовка AudioContext якщо необхідно
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Отримання MediaStream з відповідними constraints
    if (modeConfig.constraints && !this.mediaStream) {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(modeConfig.constraints);

        // Створення аналізатора для моніторингу
        if (this.audioContext && !this.audioAnalyser) {
          this.audioAnalyser = this.audioContext.createAnalyser();
          const source = this.audioContext.createMediaStreamSource(this.mediaStream);
          source.connect(this.audioAnalyser);
        }

      } catch (error) {
        this.logger.error('Failed to acquire media stream', { mode, error });
        throw new Error(`Media access denied for mode: ${mode}`);
      }
    }
  }

  /**
     * Graceful shutdown поточного сервісу
     * @private
     */
  async _gracefulShutdown(service) {
    try {
      this.logger.debug('Graceful shutdown initiated', service);

      // Надіслати подію про необхідність зупинки
      Events.emit('audioResourceManager:shutdownRequest', {
        serviceId: service.id,
        mode: service.mode,
        timeout: 2000 // 2 секунди на graceful shutdown
      });

      // Дати час сервісу на коректне завершення
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      this.logger.warn('Graceful shutdown failed', { service, error });
    }
  }

  /**
     * Спроба rollback при помилці
     * @private
     */
  async _attemptRollback() {
    try {
      const lastValidState = this.stateHistory[this.stateHistory.length - 2];
      if (lastValidState) {
        this.logger.warn('Attempting rollback to previous state', lastValidState);
        this.currentMode = lastValidState.mode;
        this.activeService = lastValidState.service;
      } else {
        // Fallback до idle
        this.currentMode = 'idle';
        this.activeService = null;
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
      }
    } catch (error) {
      this.logger.error('Rollback failed', error);
    }
  }

  /**
     * Реєстрація observer для подій
     */
  addObserver(observer) {
    this.observers.add(observer);
  }

  /**
     * Видалення observer
     */
  removeObserver(observer) {
    this.observers.delete(observer);
  }

  /**
     * Сповіщення observers про події
     * @private
     */
  _notifyObservers(eventType, data) {
    this.observers.forEach(observer => {
      try {
        if (typeof observer === 'function') {
          observer(eventType, data);
        } else if (observer[eventType]) {
          observer[eventType](data);
        }
      } catch (error) {
        this.logger.warn('Observer notification failed', { observer, error });
      }
    });
  }

  /**
     * Отримання поточних метрик
     */
  getMetrics() {
    return {
      ...this.metrics,
      currentMode: this.currentMode,
      activeService: this.activeService,
      resourcesActive: !!this.mediaStream,
      audioContextState: this.audioContext?.state || 'none',
      uptime: Date.now() - this.startTime
    };
  }

  /**
     * Отримання поточного стану аудіо ресурсів
     */
  getResourceStatus() {
    return {
      mode: this.currentMode,
      serviceId: this.activeService?.id || null,
      hasMediaStream: !!this.mediaStream,
      hasAudioContext: !!this.audioContext,
      audioContextState: this.audioContext?.state || 'none',
      isResourcesBusy: this.currentMode !== 'idle'
    };
  }

  /**
     * Примусове звільнення всіх ресурсів
     */
  async forceReleaseResources() {
    this.logger.warn('Force releasing all audio resources');

    try {
      // Зупинка MediaStream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Закриття AudioContext
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
        this.audioAnalyser = null;
      }

      // Скидання стану
      this.currentMode = 'idle';
      this.activeService = null;

      this._notifyObservers('resourcesReleased', {
        timestamp: Date.now(),
        forced: true
      });

    } catch (error) {
      this.logger.error('Force release failed', error);
    }
  }

  /**
     * Оновлення метрик
     * @private
     */
  _updateMetrics(startTime) {
    const duration = performance.now() - startTime;
    this.metrics.modeTransitions++;

    // Обчислення mid average transition time
    const totalTime = this.metrics.averageTransitionTime * (this.metrics.modeTransitions - 1) + duration;
    this.metrics.averageTransitionTime = totalTime / this.metrics.modeTransitions;
  }

  /**
     * Запис історії станів
     * @private
     */
  _recordStateHistory(mode, serviceId) {
    this.stateHistory.push({
      mode,
      serviceId,
      timestamp: Date.now(),
      service: this.activeService
    });

    // Обмеження розміру історії
    if (this.stateHistory.length > 100) {
      this.stateHistory = this.stateHistory.slice(-50);
    }
  }

  /**
     * Налаштування event listeners
     * @private
     */
  _setupEventListeners() {
    // Слухання TTS подій
    Events.on('tts:started', () => {
      this.requestMode('tts_playback', 'tts-manager');
    });

    Events.on('tts:finished', () => {
      this.requestMode('idle', 'tts-manager');
    });

    // Слухання системних подій
    Events.on('system:shutdown', () => {
      this.forceReleaseResources();
    });
  }

  /**
     * Запуск збору метрик
     * @private
     */
  _startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      Events.emit('audioResourceManager:metrics', metrics);
    }, 10000); // Кожні 10 секунд
  }

  /**
     * Знищення сервісу
     */
  async onDestroy() {
    this.logger.info('AudioResourceManager destroying...');

    // Очищення таймерів
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Звільнення ресурсів
    await this.forceReleaseResources();

    // Очищення observers
    this.observers.clear();

    await super.onDestroy();
  }
}

/**
 * Глобальний експорт singleton instance
 */
export const audioResourceManager = new AudioResourceManager();
