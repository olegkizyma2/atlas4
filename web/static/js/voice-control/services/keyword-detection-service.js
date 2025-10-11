/**
 * @fileoverview Оптимізований сервіс детекції ключових слів
 * Забезпечує надійне розпізнавання активаційних команд з розумною обробкою помилок
 */

import { BaseService } from '../core/base-service.js';
import { VOICE_CONFIG } from '../core/config.js';
import { Events } from '../events/event-manager.js';
import { containsActivationKeyword, isStopCommand } from '../utils/voice-utils.js';

/**
 * @typedef {Object} KeywordDetectionConfig
 * @property {string[]} keywords - Ключові слова для активації
 * @property {number} confidence - Поріг впевненості [0-1]
 * @property {string} language - Мова розпізнавання
 * @property {number} timeout - Таймаут активації (мс)
 * @property {boolean} continuous - Безперервне розпізнавання
 * @property {boolean} interimResults - Проміжні результати
 */

/**
 * Сервіс для детекції ключових слів активації
 */
export class KeywordDetectionService extends BaseService {
  constructor(config = {}) {
    console.log('[KEYWORD] 🏗️ Constructor called with config:', {
      hasEventManager: !!config.eventManager,
      hasLogger: !!config.logger,
      keywords: config.detection?.keywords || VOICE_CONFIG.activation.keywords
    });

    super({
      name: 'KeywordDetection',
      version: '4.0.0',
      ...config
    });

    this.detectionConfig = {
      ...VOICE_CONFIG.activation,
      ...config.detection
    };

    this.errorHandling = {
      ...VOICE_CONFIG.recognition.errorHandling,
      ...config.errorHandling
    };

    // Web Speech API
    this.recognition = null;

    // Стан детекції
    this.isActive = false;
    this.isRecognitionRunning = false;
    this.manualStop = false;

    // Управління помилками
    this.errorCounters = {
      noSpeech: 0,
      network: 0,
      consecutive: 0,
      total: 0
    };

    this.backoffState = {
      cooldownUntil: 0,
      lastErrorType: null,
      lastNetworkErrorTime: 0
    };

    // Listeners
    this.eventListeners = new Map();

    // Restart management
    this.restartTimer = null;
    this.isRestarting = false;
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    try {
      // Перевірка підтримки Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        this.logger.error('Speech Recognition API not supported in this browser');
        return false;
      }

      // Створення інстансу розпізнавання
      this.recognition = new SpeechRecognition();
      this.configureRecognition();
      this.setupEventHandlers();
      this.bindBrowserEvents();

      // Підписка на події conversation mode
      this.subscribeToConversationEvents();

      this.logger.info('Keyword detection service initialized');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize keyword detection', null, error);
      return false;
    }
  }

  /**
   * Підписка на події conversation mode
   */
  subscribeToConversationEvents() {
    console.log('[KEYWORD] 🎬 Subscribing to conversation events...');

    // Запит на початок keyword detection від conversation mode
    if (!this.eventManager) {
      console.error('[KEYWORD] ❌ EventManager is undefined!');
      this.logger.error('EventManager not available in KeywordDetectionService');
      return;
    }

    console.log('[KEYWORD] ✅ EventManager available:', typeof this.eventManager);

    this.eventManager.on('START_KEYWORD_DETECTION', async (event) => {
      const { keywords, mode } = event.payload || {};
      console.log('[KEYWORD] 📨 Received START_KEYWORD_DETECTION request:', { keywords, mode });
      this.logger.info('🔍 Received START_KEYWORD_DETECTION request', { keywords, mode });

      // Оновлення keywords якщо передані
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        this.detectionConfig.keywords = keywords;
        console.log('[KEYWORD] 📝 Updated keywords to:', keywords);
        this.logger.debug(`Updated keywords to: ${keywords.join(', ')}`);
      }

      // Запуск детекції
      console.log('[KEYWORD] 🎤 Starting detection...');
      const started = await this.startDetection();
      console.log(`[KEYWORD] ${started ? '✅' : '❌'} Detection start result:`, started);
    });

    console.log('[KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION event');
    this.logger.debug('Subscribed to conversation mode events');
  }

  /**
     * Знищення сервісу
     * @returns {Promise<void>}
     */
  async onDestroy() {
    await this.stopDetection();
    this.cleanupResources();
  }

  /**
     * Налаштування параметрів розпізнавання
     */
  configureRecognition() {
    if (!this.recognition) return;

    this.recognition.lang = this.detectionConfig.language;
    this.recognition.continuous = this.detectionConfig.continuous;
    this.recognition.interimResults = this.detectionConfig.interimResults;
    this.recognition.maxAlternatives = 3;

    this.logger.debug('Speech recognition configured', {
      language: this.detectionConfig.language,
      continuous: this.detectionConfig.continuous,
      interimResults: this.detectionConfig.interimResults
    });
  }

  /**
     * Налаштування обробників подій Web Speech API
     */
  setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isRecognitionRunning = true;
      this.manualStop = false;
      this.logger.info('🎤 Keyword detection started');

      // Скидання лічильників при успішному запуску
      this.resetErrorCounters();

      this.emit(Events.KEYWORD_DETECTION_STARTED, {
        keywords: this.detectionConfig.keywords
      });
    };

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onend = () => {
      this.isRecognitionRunning = false;
      this.logger.info('🎤 Keyword detection ended');

      this.emit(Events.KEYWORD_DETECTION_STOPPED, {
        wasManual: this.manualStop
      });

      // Автоматичний перезапуск якщо активний режим
      if (this.isActive && !this.manualStop) {
        this.scheduleRestart();
      }
    };
  }

  /**
     * Обробка результатів розпізнавання
     * @param {SpeechRecognitionEvent} event - Подія розпізнавання
     */
  handleRecognitionResult(event) {
    // Скидання лічильників помилок при успішному розпізнаванні
    this.resetNoSpeechCounter();

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence || 1.0;

      // ✅ ДОДАНО: Детальне логування КОЖНОГО розпізнаного результату
      console.log('[KEYWORD] 🎤 Web Speech recognized:', {
        text: transcript,
        confidence: confidence.toFixed(2),
        isFinal: result.isFinal,
        alternatives: result.length
      });

      this.logger.debug(`Speech result: "${transcript}" (confidence: ${confidence}, final: ${result.isFinal})`);

      if (result.isFinal) {
        this.processFinalResult(transcript, confidence);
      }

      // Емісія події для проміжних результатів
      if (!result.isFinal && this.detectionConfig.interimResults) {
        this.emit(Events.SPEECH_INTERIM_RESULT, {
          text: transcript,
          confidence,
          source: 'keyword_detection'
        });
      }
    }
  }

  /**
     * Обробка фінального результату розпізнавання
     * @param {string} transcript - Розпізнаний текст
     * @param {number} confidence - Впевненість розпізнавання
     */
  processFinalResult(transcript, confidence) {
    this.logger.debug(`Processing final result: "${transcript}"`);

    // Перевірка на ключове слово
    if (containsActivationKeyword(transcript, this.detectionConfig.keywords)) {
      this.handleKeywordDetection(transcript, confidence);
      return;
    }

    // Перевірка на стоп-команду
    if (isStopCommand(transcript)) {
      this.handleStopCommand(transcript);
      return;
    }

    // Інші результати мови передаємо далі
    this.emit(Events.SPEECH_RESULT, {
      text: transcript,
      confidence,
      source: 'keyword_detection',
      isFinal: true
    });
  }

  /**
     * Обробка виявлення ключового слова
     * @param {string} transcript - Повний текст
     * @param {number} confidence - Впевненість розпізнавання
     */
  async handleKeywordDetection(transcript, confidence) {
    console.log('[KEYWORD] 🎯 Keyword detected!:', transcript, 'confidence:', confidence);
    this.logger.info(`🎯 Keyword detected: "${transcript}" (confidence: ${confidence})`);

    // Генерація випадкової відповіді
    const response = this.getRandomActivationResponse();
    console.log('[KEYWORD] 🗣️ Generated response:', response);

    // Емісія події виявлення ключового слова
    console.log('[KEYWORD] 📡 Emitting KEYWORD_DETECTED event...');
    await this.emit(Events.KEYWORD_DETECTED, {
      transcript,
      confidence,
      response,
      keyword: this.detectionConfig.keywords[0], // Додаємо конкретне ключове слово
      timestamp: new Date(),
      keywords: this.detectionConfig.keywords
    });
    console.log('[KEYWORD] ✅ KEYWORD_DETECTED event emitted');

    this.logger.info(`🗣️ Activation response: "${response}"`);
  }

  /**
     * Обробка стоп-команди
     * @param {string} transcript - Текст стоп-команди
     */
  async handleStopCommand(transcript) {
    this.logger.info(`🛑 Stop command detected: "${transcript}"`);

    // Емісія події стоп-команди
    await this.emit(Events.STOP_COMMAND_DETECTED, {
      transcript,
      timestamp: new Date(),
      source: 'keyword_detection'
    });
  }

  /**
     * Обробка помилок розпізнавання
     * @param {SpeechRecognitionErrorEvent} event - Подія помилки
     */
  handleRecognitionError(event) {
    // Ігнорування помилок після ручної зупинки
    if (this.manualStop) {
      this.logger.debug('Error occurred after manual stop, ignoring');
      return;
    }

    const errorType = event.error;
    this.errorCounters.total++;

    // Розрізняємо типи помилок
    if (errorType === 'no-speech') {
      this.handleNoSpeechError();
    } else if (errorType === 'network') {
      this.handleNetworkError();
    } else {
      this.handleOtherError(errorType);
    }

    // Емісія події помилки
    this.emit(Events.KEYWORD_DETECTION_ERROR, {
      errorType,
      message: event.message || 'Unknown error',
      counters: { ...this.errorCounters },
      timestamp: new Date()
    });
  }

  /**
     * Обробка помилки 'no-speech'
     */
  handleNoSpeechError() {
    this.errorCounters.noSpeech++;
    this.errorCounters.consecutive++;
    this.backoffState.lastErrorType = 'no-speech';

    this.logger.debug(`No speech detected (consecutive: ${this.errorCounters.consecutive}, total: ${this.errorCounters.noSpeech})`);

    // Помилка no-speech нормальна, просто продовжуємо
  }

  /**
     * Обробка мережевих помилок
     */
  handleNetworkError() {
    this.errorCounters.network++;
    this.errorCounters.consecutive++;
    this.errorCounters.noSpeech = 0; // Скидаємо no-speech при мережевих помилках
    this.backoffState.lastErrorType = 'network';
    this.backoffState.lastNetworkErrorTime = Date.now();

    const cooldown = this.calculateNetworkBackoff();
    this.backoffState.cooldownUntil = Math.max(this.backoffState.cooldownUntil, Date.now() + cooldown);

    this.logger.warn(`Network error (${this.errorCounters.network}). Cooldown for ${cooldown}ms`);

    // Перевірка досягнення максимуму мережевих помилок
    if (this.errorCounters.network >= this.errorHandling.maxNetworkErrors) {
      this.logger.error(`Maximum network errors reached (${this.errorCounters.network}). Disabling keyword detection.`);
      this.stopDetection();
    }
  }

  /**
     * Обробка інших помилок
     * @param {string} errorType - Тип помилки
     */
  handleOtherError(errorType) {
    this.errorCounters.consecutive++;
    this.errorCounters.noSpeech = 0; // Скидаємо лічильник no-speech
    this.backoffState.lastErrorType = errorType;

    this.logger.warn(`Speech recognition error: ${errorType}`);
  }

  /**
     * Розрахунок затримки для мережевих помилок
     * @returns {number} - Затримка в мілісекундах
     */
  calculateNetworkBackoff() {
    const baseDelay = this.errorHandling.networkBackoffBase || 2000;
    const maxDelay = this.errorHandling.networkBackoffMax || 60000;
    const count = this.errorCounters.network;

    if (count <= 1) return baseDelay;
    if (count <= 3) return baseDelay * 2;
    if (count <= 5) return baseDelay * 4;
    if (count <= 8) return baseDelay * 8;

    // Експоненційний backoff з jitter для великої кількості помилок
    const multiplier = Math.min(Math.pow(1.5, count - 8), maxDelay / baseDelay);
    const jitter = Math.floor(Math.random() * 1000);
    return Math.min(baseDelay * multiplier + jitter, maxDelay);
  }

  /**
     * Планування перезапуску детекції
     */
  scheduleRestart() {
    if (this.isRestarting || !this.isActive || this.manualStop) {
      return;
    }

    // Перевірка guard-умов
    const guardReason = this.getRestartGuardReason();
    if (guardReason) {
      this.logger.debug(`Restart blocked: ${guardReason}`);

      // Повторна спроба через деякий час
      const retryDelay = this.backoffState.lastErrorType === 'network' ? 5000 : 1000;
      setTimeout(() => {
        if (this.isActive && !this.isRecognitionRunning) {
          this.scheduleRestart();
        }
      }, retryDelay);
      return;
    }

    this.isRestarting = true;
    const delay = this.calculateRestartDelay();

    this.logger.info(`⏳ Restarting keyword detection in ${delay}ms (reason: ${this.backoffState.lastErrorType || 'normal'})`);

    this.restartTimer = setTimeout(() => {
      this.isRestarting = false;
      this.restartTimer = null;

      if (this.isActive && !this.manualStop && !this.isRecognitionRunning) {
        this.startRecognition();
      }
    }, delay);
  }

  /**
     * Перевірка причин блокування перезапуску
     * @returns {string|null} - Причина блокування або null
     */
  getRestartGuardReason() {
    if (this.isRestarting) return 'already restarting';
    if (!this.isOnline()) return 'browser offline';
    if (Date.now() < this.backoffState.cooldownUntil) return 'cooldown active';
    if (document && document.visibilityState === 'hidden') return 'tab hidden';
    return null;
  }

  /**
     * Розрахунок затримки перезапуску
     * @returns {number} - Затримка в мілісекундах
     */
  calculateRestartDelay() {
    if (this.backoffState.lastErrorType === 'network') {
      return this.calculateNetworkBackoff();
    }

    if (this.backoffState.lastErrorType === 'no-speech') {
      const maxAttempts = this.errorHandling.maxConsecutiveNoSpeech || 3;
      if (this.errorCounters.consecutive < maxAttempts) {
        return 100; // Швидкий перезапуск для no-speech
      }

      // Exponential backoff для багатьох no-speech
      const multiplier = Math.min(this.errorCounters.consecutive - maxAttempts + 1, 6);
      return Math.min(100 * Math.pow(2, multiplier), 10000);
    }

    // Для інших помилок - помірна затримка з jitter
    return 500 + Math.floor(Math.random() * 300);
  }

  /**
     * Внутрішній запуск розпізнавання
     * @returns {boolean} - Чи успішно запущено
     */
  startRecognition() {
    console.log('[KEYWORD] 🚀 startRecognition() called');

    if (!this.recognition) {
      console.error('[KEYWORD] ❌ Recognition not initialized');
      this.logger.error('Recognition not initialized');
      return false;
    }

    if (this.isRecognitionRunning) {
      console.log('[KEYWORD] ⚠️ Recognition already running');
      this.logger.warn('Recognition already running');
      return false;
    }

    const guardReason = this.getRestartGuardReason();
    if (guardReason) {
      console.log('[KEYWORD] 🚫 Start blocked:', guardReason);
      this.logger.debug(`Start blocked: ${guardReason}`);
      return false;
    }

    try {
      console.log('[KEYWORD] 📞 Calling recognition.start()...');
      this.recognition.start();
      console.log('[KEYWORD] ✅ Recognition started successfully');
      this.logger.debug('🔄 Recognition started');
      return true;
    } catch (error) {
      console.error('[KEYWORD] ❌ Failed to start recognition:', error);
      this.logger.error('Failed to start recognition', null, error);

      // Спроба forced cleanup
      try {
        this.recognition.stop();
      } catch (e) {
        this.logger.warn('Failed to stop recognition during error recovery', null, e);
      }

      return false;
    }
  }

  /**
     * Запуск детекції ключових слів
     * @returns {Promise<boolean>} - Успішність запуску
     */
  async startDetection() {
    console.log('[KEYWORD] 🎤 startDetection() called');

    if (!this.isInitialized) {
      console.error('[KEYWORD] ❌ Service not initialized');
      this.logger.error('Service not initialized');
      return false;
    }

    if (this.isActive) {
      console.log('[KEYWORD] ⚠️ Keyword detection already active');
      this.logger.debug('Keyword detection already active');
      return true;
    }

    console.log('[KEYWORD] 🎯 Starting keyword detection for:', this.detectionConfig.keywords);
    this.logger.info(`🎯 Starting keyword detection for: ${this.detectionConfig.keywords.join(', ')}`);

    this.isActive = true;
    this.manualStop = false;
    this.resetErrorCounters();

    console.log('[KEYWORD] 📞 Calling startRecognition()...');
    // Запуск розпізнавання якщо немає guard-причин
    if (!this.isRecognitionRunning) {
      const success = this.startRecognition();
      if (!success) {
        // Відкладений запуск
        setTimeout(() => {
          if (this.isActive && !this.isRecognitionRunning) {
            this.startRecognition();
          }
        }, 300);
      }
    }

    return true;
  }

  /**
     * Зупинка детекції ключових слів
     * @returns {Promise<void>}
     */
  async stopDetection() {
    this.logger.info('🎯 Stopping keyword detection');

    this.isActive = false;
    this.isRestarting = false;
    this.manualStop = true;

    // Скидання лічильників
    this.resetErrorCounters();
    this.backoffState.cooldownUntil = 0;

    // Зупинка таймера перезапуску
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Зупинка розпізнавання
    if (this.recognition && this.isRecognitionRunning) {
      try {
        // Тимчасова заміна onend щоб не викликати перезапуск
        const originalOnEnd = this.recognition.onend;
        this.recognition.onend = () => {
          this.isRecognitionRunning = false;
          this.logger.info('🎤 Keyword detection ended (manual stop)');

          // Відновлення оригінального обробника
          this.recognition.onend = originalOnEnd;

          // Скидання прапорця через мікротаск
          setTimeout(() => {
            this.manualStop = false;
          }, 0);
        };

        this.recognition.stop();
      } catch (error) {
        this.logger.warn('Error stopping recognition', null, error);
      }
    }
  }

  /**
     * Скидання лічильників помилок
     */
  resetErrorCounters() {
    this.errorCounters = {
      noSpeech: 0,
      network: 0,
      consecutive: 0,
      total: this.errorCounters.total // Зберігаємо загальний лічильник
    };
    this.backoffState.lastErrorType = null;
    this.backoffState.lastNetworkErrorTime = 0;
    this.logger.debug('Error counters reset');
  }

  /**
     * Скидання лічильника no-speech (при успішному розпізнаванні)
     */
  resetNoSpeechCounter() {
    if (this.errorCounters.noSpeech > 0) {
      this.logger.debug(`Speech detected, resetting no-speech counter from ${this.errorCounters.noSpeech} to 0`);
      this.errorCounters.noSpeech = 0;
      this.errorCounters.consecutive = 0;
    }

    // Скидання мережевих помилок при успішному розпізнаванні
    if (this.errorCounters.network > 0) {
      this.logger.debug(`Successful recognition, resetting network errors from ${this.errorCounters.network} to 0`);
      this.errorCounters.network = 0;
      this.backoffState.cooldownUntil = 0;
    }
  }

  /**
     * Отримання відповідей активації з промптів або fallback
     * @returns {string[]} - Масив відповідей
     */
  getActivationResponses() {
    // Fallback відповіді, якщо промпти недоступні
    const fallbackResponses = [
      'я уважно Вас слухаю Олег Миколайович',
      'так творець, ви мене звали',
      'весь в увазі',
      'слухаю',
      'так, Олег Миколайович',
      'я тут, що потрібно?',
      'готовий до роботи',
      'на зв\'язку',
      'слухаю уважно',
      'так, творець',
      'що бажаєте?',
      'я готовий допомогти',
      'у вашому розпорядженні',
      'слухаю команди',
      'готовий до виконання',
      'так, шефе',
      'активований та готовий',
      'всі системи в нормі, слухаю',
      'підключений, очікую інструкцій',
      'готовий працювати, Олег Миколайович'
    ];

    // TODO: Інтеграція з prompt system коли буде доступна в браузері
    // В майбутньому тут буде виклик до серверного API для отримання промптів

    return fallbackResponses;
  }

  /**
     * Отримання випадкової відповіді на активацію
     * @returns {string} - Випадкова відповідь
     */
  getRandomActivationResponse() {
    const responses = this.getActivationResponses();
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  /**
     * Прив'язка до подій браузера
     */
  bindBrowserEvents() {
    // Відстеження статусу мережі
    window.addEventListener('online', () => {
      this.logger.info('🌐 Browser is online');
      this.backoffState.cooldownUntil = 0;

      if (this.isActive && !this.isRecognitionRunning) {
        setTimeout(() => this.startRecognition(), 500);
      }
    });

    window.addEventListener('offline', () => {
      this.logger.warn('🌐 Browser is offline');
    });

    // Відстеження видимості сторінки
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.logger.debug('👁️ Tab visible');

        if (this.isActive && !this.isRecognitionRunning) {
          setTimeout(() => {
            if (!this.isRecognitionRunning) {
              this.startRecognition();
            }
          }, 300);
        }
      } else {
        this.logger.debug('👁️ Tab hidden');
      }
    });
  }

  /**
     * Перевірка онлайн статусу
     * @returns {boolean} - Чи онлайн браузер
     */
  isOnline() {
    return typeof navigator !== 'undefined' ? (navigator.onLine !== false) : true;
  }

  /**
     * Очищення ресурсів
     */
  cleanupResources() {
    // Зупинка таймерів
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Очищення посилань
    this.recognition = null;
    this.eventListeners.clear();

    this.logger.debug('Resources cleaned up');
  }

  /**
     * Отримання статистики помилок
     * @returns {Object} - Статистика помилок та стан
     */
  getErrorStats() {
    return {
      counters: { ...this.errorCounters },
      backoff: { ...this.backoffState },
      isInCooldown: Date.now() < this.backoffState.cooldownUntil,
      timeUntilRestart: Math.max(0, this.backoffState.cooldownUntil - Date.now()),
      isRecognitionRunning: this.isRecognitionRunning,
      isActive: this.isActive
    };
  }

  /**
     * Перевірка чи активна детекція
     * @returns {boolean} - Чи активна детекція
     */
  isDetectionActive() {
    return this.isActive;
  }
}

export default KeywordDetectionService;
