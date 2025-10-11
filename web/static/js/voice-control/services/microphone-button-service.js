/**
 * @fileoverview Менеджер кнопки мікрофону з інтелектуальним управлінням станами
 * Замінює MicrophoneButtonManager з поліпшеною архітектурою та функціональністю
 */

import { BaseService } from '../core/base-service.js';
import { Events, eventManager } from '../events/event-manager.js';
import { ConversationEvents } from '../conversation/constants.js'; // ADDED: для conversation events
import { createLogger } from '../core/logger.js';
import { MediaManager } from './microphone/media-manager.js';
import { ButtonStateManager } from './microphone/button-state-manager.js';
import { ButtonAnimationController } from './microphone/button-animation-controller.js';

const SERVICE_STATE_NAMES = new Set(['inactive', 'initializing', 'active', 'destroyed']);

/**
 * @typedef {'idle'|'listening'|'recording'|'processing'|'error'|'disabled'} MicrophoneState
 * @typedef {'click'|'voice_activation'|'keyboard'} ActivationTrigger
 * @typedef {'user_stop'|'timeout'|'silence'|'error'|'system'} StopReason
 */

/**
 * @typedef {Object} RecordingSession
 * @property {string} id - Унікальний ID сесії
 * @property {Date} startTime - Час початку запису
 * @property {Date} [endTime] - Час завершення запису
 * @property {ActivationTrigger} trigger - Тригер активації
 * @property {'short'|'long'|'continuous'} mode - Режим запису
 * @property {number} duration - Тривалість запису (мс)
 * @property {Blob} [audioBlob] - Аудіо дані
 * @property {string} [transcription] - Результат транскрипції
 * @property {StopReason} [stopReason] - Причина завершення
 */

/**
 * Сервіс для управління кнопкою мікрофону та записом аудіо
 */
export class MicrophoneButtonService extends BaseService {
  constructor(config = {}) {
    super({
      name: 'MICROPHONE_BUTTON',
      version: '2.0.0',
      healthCheckInterval: 5000,
      ...config
    });

    // DOM елементи
    this.micButton = null;
    this.statusIndicator = null;
    this.recordingIndicator = null;

    // Конфігурація
    this.config = {
      maxRecordingDuration: config.maxRecordingDuration || 60000, // 60 секунд
      minRecordingDuration: config.minRecordingDuration || 500,   // 0.5 секунди
      silenceTimeout: config.silenceTimeout || 6000,             // 6 секунд (збільшено)
      enableVoiceActivation: config.enableVoiceActivation !== false,
      enableKeyboardShortcuts: config.enableKeyboardShortcuts !== false,
      debounceInterval: config.debounceInterval || 200,          // 200мс
      ...config
    };

    // Стан
    this.currentState = 'idle';
    this.isInitialized = false;
    this.currentSession = null;

    // Модулі
    this.mediaManager = null;
    this.stateManager = null;
    this.animationController = null;

    // Контролери
    this.recordingTimer = null;
    this._ttsLocked = false;
    this._ttsAgent = null;
    this._ttsLockTimestamp = null;
    this._ttsTimeoutTimer = null;
    this._preTTSState = null;

    // Статистика
    this.statistics = {
      totalSessions: 0,
      totalRecordingTime: 0,
      averageSessionDuration: 0,
      successRate: 0,
      lastActivity: null
    };

    // Історія сесій
    this.sessionHistory = [];
  }

  /**
     * Налаштування safety timeout для TTS lock
     * @private
     */
  _setupTTSTimeoutTimer() {
    this._clearTTSTimeoutTimer();

    // Safety timeout на випадок якщо TTS не викличе resume
    this._ttsTimeoutTimer = setTimeout(() => {
      const lockDuration = Date.now() - this._ttsLockTimestamp;
      this.logger.warn('TTS lock timeout exceeded, force resuming', {
        lockDuration,
        agent: this._ttsAgent
      });

      this.resumeAfterTTS(this._ttsAgent || 'timeout');
    }, 30000); // 30 секунд safety timeout
  }

  /**
     * Скидання TTS timeout timer
     * @private
     */
  _resetTTSTimeoutTimer() {
    this._setupTTSTimeoutTimer();
  }

  /**
     * Очищення TTS timeout timer
     * @private
     */
  _clearTTSTimeoutTimer() {
    if (this._ttsTimeoutTimer) {
      clearTimeout(this._ttsTimeoutTimer);
      this._ttsTimeoutTimer = null;
    }
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    try {
      // Знаходження DOM елементів
      if (!this.findDOMElements()) {
        throw new Error('Required DOM elements not found');
      }

      // Ініціалізація підмодулів
      await this.initializeSubModules();

      // Налаштування event listeners
      this.setupEventListeners();

      // Початковий стан
      this.setState('idle');

      // Перевірка доступності медіа API (non-blocking - тільки попередження)
      try {
        await this.checkMediaSupport();
      } catch (mediaError) {
        this.logger.warn('Media support check failed during initialization (will retry on first use)', null, mediaError);
        // НЕ блокуємо ініціалізацію - перевірка відбудеться при спробі запису
      }

      this.isInitialized = true;
      this.logger.info('Microphone button service initialized');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize microphone button service', null, error);
      this.setState('error');
      return false;
    }
  }

  /**
     * Безпечне знищення сервісу з повним очищенням ресурсів
     * @returns {Promise<void>}
     */
  async onDestroy() {
    this.logger.info('MicrophoneButtonService destroying...');

    const destructionStartTime = performance.now();
    const errors = [];

    try {
      // Етап 1: Зупинка поточних операцій
      await this._gracefulStopOperations(errors);

      // Етап 2: Очищення таймерів та інтервалів
      this._clearAllTimers(errors);

      // Етап 3: Очищення event listeners
      this._cleanupEventListeners(errors);

      // Етап 4: Знищення підмодулів
      await this._destroySubmodules(errors);

      // Етап 5: Очищення стану
      this._resetInternalState(errors);

      // Етап 6: Очищення DOM references
      this._cleanupDOMReferences(errors);

      const destructionTime = performance.now() - destructionStartTime;

      this.logger.info('MicrophoneButtonService destroyed successfully', {
        destructionTime: Math.round(destructionTime),
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined
      });

    } catch (criticalError) {
      this.logger.error('Critical error during destruction', {
        error: criticalError.message,
        stack: criticalError.stack,
        errors: errors
      });
      throw criticalError;
    }
  }

  /**
     * Graceful зупинка поточних операцій
     * @private
     */
  async _gracefulStopOperations(errors) {
    try {
      // Зупинка поточного запису з timeout
      if (this.currentSession) {
        const stopPromise = this.stopRecording('system');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stop recording timeout')), 3000)
        );

        try {
          await Promise.race([stopPromise, timeoutPromise]);
        } catch (error) {
          errors.push({
            operation: 'stopRecording',
            error: error.message
          });

          // Примусова зупинка
          await this._forceStopRecording();
        }
      }

      // Скидання TTS lock
      if (this._ttsLocked) {
        this._ttsLocked = false;
        this.logger.debug('TTS lock cleared during destruction');
      }

      // Скидання стану обробки
      if (this.isProcessing) {
        this.isProcessing = false;
        this.logger.debug('Processing state cleared during destruction');
      }

    } catch (error) {
      errors.push({
        operation: 'gracefulStopOperations',
        error: error.message
      });
    }
  }

  /**
     * Примусова зупинка запису
     * @private
     */
  async _forceStopRecording() {
    try {
      if (this.mediaManager) {
        await this.mediaManager.forceStop();
      }
      this.currentSession = null;
      this.currentState = 'idle';
    } catch (error) {
      this.logger.warn('Force stop recording failed', { error: error.message });
    }
  }

  /**
     * Очищення всіх таймерів
     * @private
     */
  _clearAllTimers(errors) {
    try {
      const timers = [
        'recordingTimeout',
        'silenceTimer',
        'uiUpdateInterval',
        'healthCheckTimer',
        'debounceTimer',
        'processingTimeout'
      ];

      timers.forEach(timerName => {
        if (this[timerName]) {
          clearTimeout(this[timerName]);
          this[timerName] = null;
        }
      });

      // Очищення інтервалів
      const intervals = [
        'metricsInterval',
        'statusUpdateInterval'
      ];

      intervals.forEach(intervalName => {
        if (this[intervalName]) {
          clearInterval(this[intervalName]);
          this[intervalName] = null;
        }
      });

    } catch (error) {
      errors.push({
        operation: 'clearAllTimers',
        error: error.message
      });
    }
  }

  /**
     * Очищення event listeners
     * @private
     */
  _cleanupEventListeners(errors) {
    try {
      // Очищення глобальних event listeners
      const globalEvents = [
        'keydown',
        'keyup',
        'beforeunload',
        'visibilitychange'
      ];

      globalEvents.forEach(eventType => {
        if (this[`_${eventType}Handler`]) {
          document.removeEventListener(eventType, this[`_${eventType}Handler`]);
          this[`_${eventType}Handler`] = null;
        }
      });

      // Очищення Events subscriptions
      if (this.eventSubscriptions) {
        this.eventSubscriptions.forEach(unsubscribe => {
          try {
            unsubscribe();
          } catch (error) {
            this.logger.warn('Failed to unsubscribe event', { error: error.message });
          }
        });
        this.eventSubscriptions = [];
      }

    } catch (error) {
      errors.push({
        operation: 'cleanupEventListeners',
        error: error.message
      });
    }
  }

  /**
     * Знищення підмодулів
     * @private
     */
  async _destroySubmodules(errors) {
    const submodules = [
      'mediaManager',
      'buttonStateManager',
      'buttonAnimationController',
      'gestureHandler',
      'audioVisualizer'
    ];

    for (const moduleName of submodules) {
      try {
        const module = this[moduleName];
        if (module && typeof module.destroy === 'function') {
          await module.destroy();
          this[moduleName] = null;
        }
      } catch (error) {
        errors.push({
          operation: `destroy_${moduleName}`,
          error: error.message
        });
      }
    }
  }

  /**
     * Скидання внутрішнього стану
     * @private
     */
  _resetInternalState(errors) {
    try {
      // Скидання всіх станів
      this.currentState = 'idle';
      this.currentSession = null;
      this.isProcessing = false;
      this._ttsLocked = false;
      this.isInitialized = false;

      // Очищення колекцій
      this.recordingSessions = [];
      this.eventSubscriptions = [];

      // Скидання метрик
      this.metrics = {
        totalRecordings: 0,
        totalDuration: 0,
        averageDuration: 0,
        errorCount: 0
      };

    } catch (error) {
      errors.push({
        operation: 'resetInternalState',
        error: error.message
      });
    }
  }

  /**
     * Очищення DOM references
     * @private
     */
  _cleanupDOMReferences(errors) {
    try {
      // Видалення event listeners з DOM елементів
      if (this.micButton) {
        const buttonEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
        buttonEvents.forEach(eventType => {
          if (this.micButton.removeEventListener) {
            this.micButton.removeEventListener(eventType, this[`_${eventType}Handler`]);
          }
        });
      }

      // Скидання DOM references
      this.micButton = null;
      this.statusIndicator = null;
      this.recordingIndicator = null;
      this.progressBar = null;

    } catch (error) {
      errors.push({
        operation: 'cleanupDOMReferences',
        error: error.message
      });
    }
  }

  /**
     * Перевірка здоров'я сервісу
     * @returns {Promise<boolean>} - Стан здоров'я
     */
  async checkHealth() {
    const baseHealth = await super.checkHealth();

    if (!baseHealth) return false;

    // Перевірка DOM елементів
    if (!this.micButton || !this.micButton.isConnected) {
      this.logger.warn('Microphone button not found in DOM');
      return false;
    }

    // Перевірка медіа можливостей
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.logger.warn('Media devices not supported');
      return false;
    }

    return true;
  }

  /**
     * Знаходження DOM елементів
     * @returns {boolean} - Чи знайдено всі необхідні елементи
     */
  findDOMElements() {
    // Основна кнопка мікрофону
    this.micButton = document.getElementById('mic-button') ||
      document.getElementById('microphone-btn') ||
      document.querySelector('.microphone-button') ||
      document.querySelector('[data-mic-button]');

    if (!this.micButton) {
      this.logger.error('Microphone button not found');
      return false;
    }

    // Індикатор статусу
    this.statusIndicator = document.getElementById('mic-status') ||
      this.micButton.querySelector('.status-indicator') ||
      this.createStatusIndicator();

    // Індикатор запису
    this.recordingIndicator = document.getElementById('recording-indicator') ||
      this.micButton.querySelector('.recording-indicator') ||
      this.createRecordingIndicator();

    return true;
  }

  /**
     * Створення індикатора статусу
     * @returns {HTMLElement} - Створений індикатор
     */
  createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'mic-status-indicator';
    indicator.id = 'mic-status';
    this.micButton.appendChild(indicator);
    return indicator;
  }

  /**
     * Створення індикатора запису
     * @returns {HTMLElement} - Створений індикатор
     */
  createRecordingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'recording-indicator';
    indicator.innerHTML = '<div class="pulse-dot"></div>';
    this.micButton.appendChild(indicator);
    return indicator;
  }

  /**
     * Ініціалізація підмодулів
     * @returns {Promise<void>}
     */
  async initializeSubModules() {
    const baseLogger = typeof this.logger?.category === 'function'
      ? this.logger
      : createLogger(this.name || 'MICROPHONE_BUTTON');

    this.logger = baseLogger;

    this.mediaManager = new MediaManager({
      logger: typeof baseLogger.category === 'function'
        ? baseLogger.category('MEDIA')
        : baseLogger
    });

    // Менеджер станів
    this.stateManager = new ButtonStateManager({
      logger: typeof baseLogger.category === 'function'
        ? baseLogger.category('STATE')
        : baseLogger,
      onStateChange: (oldState, newState, reason) => {
        this.handleStateChange(oldState, newState, reason);
      }
    });

    // Контролер анімацій
    this.animationController = new ButtonAnimationController({
      button: this.micButton,
      statusIndicator: this.statusIndicator,
      recordingIndicator: this.recordingIndicator,
      logger: typeof baseLogger.category === 'function'
        ? baseLogger.category('ANIMATION')
        : baseLogger
    });

    // Ініціалізація підмодулів
    await this.mediaManager.initialize();
    this.stateManager.initialize();
    this.animationController.initialize();
  }

  /**
     * Налаштування event listeners
     */
  setupEventListeners() {
    // ВАЖЛИВО: Кнопка мікрофону тепер керується ConversationModeManager!
    // Старі обробники кліків ВИМКНЕНІ щоб уникнути конфліктів
    // ConversationModeManager емітує події CONVERSATION_MODE_QUICK_SEND_START
    // та CONVERSATION_RECORDING_START, на які ми підписуємось нижче

    // Клавіатурні комбінації (залишаємо для accessibility)
    if (this.config.enableKeyboardShortcuts) {
      document.addEventListener('keydown', this.handleKeyboardShortcut);
      document.addEventListener('keyup', this.handleKeyboardShortcut);
    }

    // Зміна видимості сторінки
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Події системи розпізнавання
    this.subscribeToSystemEvents();
  }

  /**
     * Підписка на події системи
     */
  subscribeToSystemEvents() {
    // Готовність до голосової активації
    this.subscribe(Events.SPEECH_READY, () => {
      if (this.currentState === 'idle') {
        this.logger.debug('Speech recognition ready, enabling voice activation');
      }
    });

    // Виявлення ключових слів
    this.subscribe(Events.KEYWORD_DETECTED, (event) => {
      if (this.config.enableVoiceActivation && this.currentState === 'idle') {
        this.handleVoiceActivation(event.payload);
      }
    });

    // Завершення транскрипції
    this.subscribe(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
      if (this.currentSession && this.currentSession.id === event.payload.sessionId) {
        this.handleTranscriptionComplete(event.payload);
      }
    });

    // Помилки транскрипції
    this.subscribe(Events.WHISPER_TRANSCRIPTION_ERROR, (event) => {
      if (this.currentSession && this.currentSession.id === event.payload.sessionId) {
        this.handleTranscriptionError(event.payload);
      }
    });

    // === CONVERSATION MODE EVENTS ===
    // FIXED (11.10.2025 - 21:15): Використовуємо this.eventManager замість глобального

    // Quick-send режим (одне натискання -> запис -> Whisper -> чат)
    // FIXED (11.10.2025 - 22:05): використовуємо ConversationEvents константу
    this.eventManager.on(ConversationEvents.CONVERSATION_MODE_QUICK_SEND_START, async (event) => {
      console.log('[MICROPHONE_BUTTON] 🔔 Received CONVERSATION_MODE_QUICK_SEND_START event!', {
        event,
        payload: event?.payload,
        currentState: this.currentState,
        ttsLocked: this._ttsLocked
      });
      this.logger.info('🎤 Quick-send mode activated via conversation manager');
      await this.handleQuickSendModeStart(event.payload);
    });

    // Conversation режим - початок запису після виявлення keyword
    // FIXED (11.10.2025 - 22:05): використовуємо ConversationEvents константу
    this.eventManager.on(ConversationEvents.CONVERSATION_RECORDING_START, async (event) => {
      this.logger.info('🎤 Conversation recording start via conversation manager');
      await this.handleConversationRecordingStart(event.payload);
    });

    // Запит на початок keyword detection
    // FIXED (11.10.2025 - 22:05): використовуємо Events.START_KEYWORD_DETECTION константу
    this.eventManager.on(Events.START_KEYWORD_DETECTION, async (event) => {
      this.logger.info('🔍 Starting keyword detection for conversation mode', event.payload);
      // Keyword detection service має підхопити цю подію
    });
  }

  /**
     * Перевірка підтримки медіа API
     * @returns {Promise<void>}
     */
  async checkMediaSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media devices not supported');
    }

    try {
      // Тестова перевірка доступу до мікрофону
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        this.logger.warn('Microphone permission denied');
        this.setState('disabled');
      } else {
        throw error;
      }
    }
  }

  /**
     * Встановлення стану кнопки
     * @param {MicrophoneState} newState - Новий стан
     * @param {string} [reason] - Причина зміни стану
     */
  setState(newState, reason = '') {
    if (SERVICE_STATE_NAMES.has(newState)) {
      super.setState(newState);
      return;
    }

    if (newState === 'error' && this.state !== 'error') {
      super.setState('error');
    }

    if (!this.stateManager) {
      this.currentState = newState;
      return;
    }

    this.stateManager.setState(newState, reason);
  }

  /**
     * Обробка зміни стану
{{ ... }}
     * @param {MicrophoneState} oldState - Попередній стан
     * @param {MicrophoneState} newState - Новий стан
     * @param {string} reason - Причина зміни
     */
  handleStateChange(oldState, newState, reason) {
    this.currentState = newState;

    this.logger.debug(`State changed: ${oldState} -> ${newState} (${reason})`);

    // Оновлення візуального стану
    if (this.animationController) {
      this.animationController.updateState(newState, oldState);
    }

    // Оновлення доступності кнопки
    this.updateButtonAccessibility(newState);

    // Емісія події зміни стану
    this.emit(Events.MICROPHONE_STATE_CHANGED, {
      oldState,
      newState,
      reason,
      timestamp: new Date()
    });
  }

  /**
     * Оновлення доступності кнопки
     * @param {MicrophoneState} state - Поточний стан
     */
  updateButtonAccessibility(state) {
    if (!this.micButton) return;

    const isDisabled = state === 'disabled' || state === 'error';
    const isActive = state === 'recording' || state === 'listening';

    // Атрибути доступності
    this.micButton.disabled = isDisabled;
    this.micButton.setAttribute('aria-pressed', isActive.toString());
    this.micButton.setAttribute('data-state', state);

    // CSS класи
    this.micButton.className = this.micButton.className
      .replace(/\bstate-\w+\b/g, '')
      .trim() + ` state-${state}`;

    // Текст для скрін-рідерів
    const stateTexts = {
      idle: 'Натисніть для запису голосового повідомлення',
      listening: 'Слухаю... Говоріть зараз',
      recording: 'Записую... Натисніть для завершення',
      processing: 'Обробляю запис...',
      error: 'Помилка мікрофону',
      disabled: 'Мікрофон недоступний'
    };

    this.micButton.setAttribute('aria-label', stateTexts[state] || state);
  }

  /**
     * Обробка кліку по кнопці
     * @param {Event} event - Подія кліку
     */
  async handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();

    // Debounce для запобігання подвійних кліків
    if (this.debounceTimer) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
    }, this.config.debounceInterval);

    try {
      await this.handleActivation('click');
    } catch (error) {
      this.logger.error('Error handling button click', null, error);
      this.setState('error', 'Button click error');
    }
  }

  /**
     * Обробка клавіатурного скорочення
     * @param {KeyboardEvent} event - Подія клавіатури
     */
  handleKeyboardShortcut(event) {
    // Ctrl/Cmd + Shift + M для переключення стану
    const isShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyM';

    if (isShortcut && event.type === 'keydown') {
      event.preventDefault();
      this.handleActivation('keyboard');
    }
  }

  /**
     * Обробка голосової активації
     * @param {Object} payload - Дані активації
     */
  async handleVoiceActivation(payload) {
    if (!this.config.enableVoiceActivation) return;

    this.logger.info(`Voice activation detected: "${payload.keyword}"`);

    try {
      await this.handleActivation('voice_activation', {
        keyword: payload.keyword,
        confidence: payload.confidence
      });
    } catch (error) {
      this.logger.error('Error handling voice activation', null, error);
    }
  }

  /**
   * Обробка Quick-send режиму (одне натискання)
   * @param {Object} payload - Дані події
   */
  async handleQuickSendModeStart(payload = {}) {
    this.logger.info('🎤 Quick-send mode: starting recording');

    if (this._ttsLocked) {
      this.logger.warn('Quick-send ignored during TTS playback');
      return;
    }

    if (this.currentState !== 'idle') {
      this.logger.warn(`Quick-send ignored - current state: ${this.currentState}`);
      return;
    }

    try {
      // Початок запису з міткою quick-send
      await this.startRecording('click', {
        mode: 'quick-send',
        conversationMode: false,
        ...payload
      });

      this.logger.debug('Quick-send recording started successfully');
    } catch (error) {
      this.logger.error('Failed to start quick-send recording', null, error);
      this.setState('error', 'Quick-send failed');
    }
  }

  /**
   * Обробка Conversation режиму - запис після виявлення keyword
   * @param {Object} payload - Дані події
   */
  async handleConversationRecordingStart(payload = {}) {
    this.logger.info('🎤 Conversation mode: starting recording after keyword detection');

    if (this._ttsLocked) {
      this.logger.warn('Conversation recording ignored during TTS playback');
      return;
    }

    // FIXED (11.10.2025 - 17:05): Дозволяємо 'processing' стан після TTS resume
    // Race condition: setState('idle') може бути ПІСЛЯ startRecording()
    const allowedStates = ['idle', 'processing'];
    if (!allowedStates.includes(this.currentState)) {
      this.logger.warn(`Conversation recording ignored - current state: ${this.currentState} (allowed: ${allowedStates.join(', ')})`);
      return;
    }

    try {
      // Примусово встановлюємо idle якщо processing (після TTS)
      if (this.currentState === 'processing') {
        this.logger.debug('Resetting state from processing to idle before conversation recording');
        this.setState('idle', 'pre_conversation_recording');
      }

      // Початок запису з міткою conversation
      await this.startRecording('voice_activation', {
        mode: 'conversation',
        conversationMode: true,
        keyword: payload.keyword || 'атлас',
        ...payload
      });

      this.logger.debug('Conversation recording started successfully');
    } catch (error) {
      this.logger.error('Failed to start conversation recording', null, error);
      this.setState('error', 'Conversation recording failed');
    }
  }

  /**
     * Універсальна обробка активації
     * @param {ActivationTrigger} trigger - Тип тригера
     * @param {Object} [metadata] - Додаткові дані
     */
  async handleActivation(trigger, metadata = {}) {
    this.logger.debug(`Activation triggered by: ${trigger}`);

    if (this._ttsLocked) {
      this.logger.debug('Activation ignored during TTS playback lock');
      return;
    }

    switch (this.currentState) {
    case 'idle':
      await this.startRecording(trigger, metadata);
      break;

    case 'listening':
    case 'recording':
      await this.stopRecording('user_stop');
      break;

    case 'processing':
      this.logger.debug('Ignoring activation during processing');
      break;

    case 'error':
      // Спроба відновлення
      await this.resetToIdle();
      break;

    case 'disabled':
      this.logger.warn('Cannot activate: microphone disabled');
      break;
    }
  }

  /**
     * Початок запису
     * @param {ActivationTrigger} trigger - Тип активації
     * @param {Object} [metadata] - Метадані активації
     * @returns {Promise<void>}
     */
  async startRecording(trigger, metadata = {}) {
    try {
      this.logger.info(`Starting recording (trigger: ${trigger})`);

      // Перевірка доступності медіа ПЕРЕД спробою запису
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser');
      }

      // Створення нової сесії
      this.currentSession = this.createRecordingSession(trigger, metadata);

      // Перехід в стан слухання
      this.setState('listening', `Started by ${trigger}`);

      // Запуск медіа запису
      await this.mediaManager.startRecording({
        sessionId: this.currentSession.id,
        maxDuration: this.config.maxRecordingDuration,
        onAudioData: (data) => this.handleAudioData(data),
        onSilenceDetected: () => this.handleSilenceDetected(),
        onError: (error) => this.handleRecordingError(error)
      });

      // Встановлення таймерів
      this.setupRecordingTimers();

      // Перехід в стан запису
      this.setState('recording', 'Recording started');

      // Емісія події
      this.emit(Events.RECORDING_STARTED, {
        sessionId: this.currentSession.id,
        trigger,
        metadata,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to start recording', null, error);
      this.setState('error', 'Recording start failed');
      this.currentSession = null;
      throw error;
    }
  }

  /**
     * Зупинка запису
     * @param {StopReason} reason - Причина зупинки
     * @returns {Promise<void>}
     */
  async stopRecording(reason) {
    if (!this.currentSession) {
      this.logger.warn('No active recording session to stop');
      return;
    }

    try {
      this.logger.info(`Stopping recording (reason: ${reason})`);

      // Перехід в стан обробки
      this.setState('processing', `Stopped: ${reason}`);

      // Очищення таймерів
      this.clearRecordingTimers();

      // Зупинка медіа запису
      const audioBlob = await this.mediaManager.stopRecording();

      // Завершення сесії
      this.currentSession.endTime = new Date();
      this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
      this.currentSession.stopReason = reason;
      this.currentSession.audioBlob = audioBlob;

      // Перевірка наявності аудіо даних
      if (!audioBlob || !audioBlob.size) {
        this.logger.warn(`No audio captured, skipping transcription (reason: ${reason}, duration: ${this.currentSession.duration}ms)`);
        await this.resetToIdle('No audio captured');
        return;
      }

      // Перевірка мінімальної тривалості
      if (this.currentSession.duration < this.config.minRecordingDuration) {
        this.logger.warn(`Recording too short, discarding (duration: ${this.currentSession.duration}ms, min: ${this.config.minRecordingDuration}ms, reason: ${reason})`);
        await this.resetToIdle('Recording too short');
        return;
      }

      // Відправка на транскрипцію
      await this.submitForTranscription();

      // Емісія події
      this.emit(Events.RECORDING_STOPPED, {
        sessionId: this.currentSession.id,
        reason,
        duration: this.currentSession.duration,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to stop recording', null, error);
      this.setState('error', 'Recording stop failed');
      await this.resetToIdle('Stop error');
    }
  }

  /**
     * Створення сесії запису
     * @param {ActivationTrigger} trigger - Тип активації
     * @param {Object} metadata - Метадані
     * @returns {RecordingSession} - Нова сесія
     */
  createRecordingSession(trigger, metadata) {
    const session = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      trigger,
      mode: metadata.mode || 'short',
      duration: 0,
      metadata: { ...metadata }
    };

    this.statistics.totalSessions++;
    this.statistics.lastActivity = new Date();

    return session;
  }

  /**
     * Налаштування таймерів запису
     */
  setupRecordingTimers() {
    // Максимальна тривалість запису
    this.recordingTimer = setTimeout(() => {
      this.logger.info('Recording timeout reached');
      this.stopRecording('timeout');
    }, this.config.maxRecordingDuration);

    // Таймер тиші (якщо підтримується)
    if (this.config.silenceTimeout > 0) {
      this.silenceTimer = setTimeout(() => {
        this.logger.info('Silence timeout reached');
        this.stopRecording('silence');
      }, this.config.silenceTimeout);
    }
  }

  /**
     * Очищення таймерів запису
     */
  clearRecordingTimers() {
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
     * Очищення всіх таймерів
     */
  clearAllTimers() {
    this.clearRecordingTimers();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
     * Обробка аудіо даних під час запису
     * @param {Object} audioData - Дані аудіо
     */
  handleAudioData(audioData) {
    // Скидання таймера тиші при виявленні звуку
    if (audioData.hasVoiceActivity && this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        this.stopRecording('silence');
      }, this.config.silenceTimeout);
    }

    // Оновлення індикаторів рівня звуку
    if (this.animationController) {
      this.animationController.updateAudioLevel(audioData.level || 0);
    }
  }

  /**
     * Обробка виявлення тиші
     */
  handleSilenceDetected() {
    this.logger.debug('Silence detected during recording');
    // Логіка вже обробляється в handleAudioData
  }

  /**
     * Обробка помилки запису
     * @param {Error} error - Помилка
     */
  handleRecordingError(error) {
    this.logger.error('Recording error occurred', null, error);
    this.stopRecording('error');
  }

  /**
     * Відправка на транскрипцію
     * @returns {Promise<void>}
     */
  async submitForTranscription() {
    if (!this.currentSession || !this.currentSession.audioBlob || !this.currentSession.audioBlob.size) {
      this.logger.debug('No audio data to transcribe, skipping');
      return;
    }

    try {
      this.logger.info(`📤 Submitting audio for transcription (session: ${this.currentSession.id}, size: ${this.currentSession.audioBlob.size} bytes, duration: ${this.currentSession.duration}ms)`);

      // Емісія події для WhisperService
      this.emit(Events.AUDIO_READY_FOR_TRANSCRIPTION, {
        sessionId: this.currentSession.id,
        audioBlob: this.currentSession.audioBlob,
        mode: this.currentSession.mode,
        trigger: this.currentSession.trigger,
        duration: this.currentSession.duration
      });

      this.logger.debug(`Audio submitted for transcription (session: ${this.currentSession.id})`);

    } catch (error) {
      this.logger.error('Failed to submit for transcription', null, error);
      throw error;
    }
  }

  /**
     * Обробка завершення транскрипції
     * @param {Object} result - Результат транскрипції
     */
  async handleTranscriptionComplete(result) {
    if (!this.currentSession) return;

    try {
      // Збереження результату в сесії
      this.currentSession.transcription = result.text;

      // Додавання в історію
      this.addToHistory(this.currentSession);

      // Оновлення статистики
      this.updateStatistics(this.currentSession, true);

      // Повернення в режим очікування
      await this.resetToIdle('Transcription complete');

      this.logger.info(`Transcription completed: "${result.text}"`);

    } catch (error) {
      this.logger.error('Error handling transcription completion', null, error);
      await this.resetToIdle('Transcription completion error');
    }
  }

  /**
     * Обробка помилки транскрипції
     * @param {Object} error - Помилка транскрипції
     */
  async handleTranscriptionError(error) {
    if (!this.currentSession) return;

    this.logger.error('Transcription failed', null, error.error);

    // Оновлення статистики
    this.updateStatistics(this.currentSession, false);

    // Повернення в режим очікування
    await this.resetToIdle('Transcription error');
  }

  /**
     * Обробка зміни видимості сторінки
     */
  handleVisibilityChange() {
    if (document.hidden && this.currentSession) {
      this.logger.info('Page hidden, stopping current recording');
      this.stopRecording('system');
    }
  }

  /**
     * Повернення до стану очікування
     * @param {string} [reason] - Причина скидання
     * @returns {Promise<void>}
     */
  async resetToIdle(reason = 'Reset') {
    // Очищення таймерів
    this.clearAllTimers();

    // Зупинка запису якщо активний
    if (this.mediaManager && this.mediaManager.isRecording()) {
      await this.mediaManager.stopRecording();
    }

    // Завершення поточної сесії
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession = null;
    }

    // Встановлення стану
    this.setState('idle', reason);

    this.logger.debug(`Reset to idle state (${reason})`);
  }

  /**
     * Додавання сесії в історію
     * @param {RecordingSession} session - Завершена сесія
     */
  addToHistory(session) {
    this.sessionHistory.unshift(session);

    // Обмеження історії
    const maxHistorySize = 50;
    if (this.sessionHistory.length > maxHistorySize) {
      this.sessionHistory = this.sessionHistory.slice(0, maxHistorySize);
    }
  }

  /**
     * Оновлення статистики
     * @param {RecordingSession} session - Сесія
     * @param {boolean} _success - Чи успішна сесія
     */
  updateStatistics(session, _success) {
    this.statistics.totalRecordingTime += session.duration;

    if (this.statistics.totalSessions > 0) {
      this.statistics.averageSessionDuration =
        this.statistics.totalRecordingTime / this.statistics.totalSessions;
    }

    // Розрахунок успішності за останні сесії
    const recentSessions = this.sessionHistory.slice(0, 10);
    const successfulSessions = recentSessions.filter(s => s.transcription).length;

    if (recentSessions.length > 0) {
      this.statistics.successRate = successfulSessions / recentSessions.length;
    }
  }

  /**
     * Отримання поточного стану
     * @returns {MicrophoneState} - Поточний стан
     */
  getCurrentState() {
    return this.currentState;
  }

  /**
     * Отримання статистики
     * @returns {Object} - Статистика використання
     */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
     * Отримання історії сесій
     * @param {number} [limit] - Максимальна кількість сесій
     * @returns {RecordingSession[]} - Масив сесій
     */
  getSessionHistory(limit = 10) {
    return this.sessionHistory.slice(0, limit);
  }

  /**
     * Перевірка чи активний запис
     * @returns {boolean} - Чи активний запис
     */
  isRecording() {
    return ['listening', 'recording'].includes(this.currentState);
  }

  /**
     * Примусова зупинка всіх операцій
     * @returns {Promise<void>}
     */
  async forceStop() {
    this.logger.info('Force stopping all microphone operations');

    try {
      if (this.currentSession) {
        await this.stopRecording('system');
      }

      await this.resetToIdle('Force stopped');

    } catch (error) {
      this.logger.error('Error during force stop', null, error);
      this.setState('error', 'Force stop error');
    }
  }

  /**
     * Очищення event listeners
     */
  cleanupEventListeners() {
    if (this.micButton) {
      this.micButton.removeEventListener('click', this.handleButtonClick);
      this.micButton.removeEventListener('touchstart', this.handleButtonClick);
    }

    document.removeEventListener('keydown', this.handleKeyboardShortcut);
    document.removeEventListener('keyup', this.handleKeyboardShortcut);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}

