/**
 * @fileoverview Менеджер режимів спілкування з користувачем
 *
 * Два режими роботи:
 * 1. Quick-send: одне натискання -> запис -> VAD детектує кінець -> відправка в Whisper -> чат
 * 2. Conversation: утримання 2 сек -> Atlas відповідає (ротація фраз) -> живе спілкування STT→TTS→STT
 *
 * WORKFLOW Quick-send (Mode 1):
 * - User: Клік на кнопку
 * - System: Запис аудіо (VAD моніторить рівень)
 * - VAD: Визначає кінець фрази (1.5 сек тиші)
 * - System: Автостоп → Whisper транскрипція → відправка в чат
 * - Atlas: Відповідь → TTS → повернення до idle
 *
 * WORKFLOW Conversation (Mode 2):
 * - User: Утримання кнопки 2 секунди
 * - System: Активація conversation mode
 * - System: Прослуховування ключового слова "Атлас" (через Whisper)
 * - User: Говорить "Атлас"
 * - System: Відповідь з ротацією ("слухаю", "в увазі", etc.) → TTS
 * - System: Після TTS → початок запису користувача
 * - User: Говорить запит
 * - VAD: Визначає кінець фрази → автостоп
 * - System: Whisper транскрипція → фільтрація → чат
 * - Atlas: Відповідь → TTS
 * - System: Після TTS → автоматичний continuous listening (БЕЗ "Атлас"!)
 * - User: Може одразу говорити NEXT запит
 * - VAD: Визначає кінець фрази → автостоп → Whisper → чат → LOOP
 * - Exit: 5 сек тиші → повернення до прослуховування "Атлас"
 * - Exit: Task mode → повне завершення conversation loop
 *
 * @version 4.0.0 - Refactored with modular architecture
 * @date 2025-10-11
 */

import { createLogger } from './core/logger.js';
import { eventManager, Events } from './events/event-manager.js';

// New modular imports
import { ConversationModes, ConversationEvents, Timeouts } from './conversation/constants.js';
import { filterTranscription } from './conversation/filters.js';
import { createStateManager } from './conversation/state-manager.js';
import { createEventHandlers } from './conversation/event-handlers.js';
import { createUIController } from './conversation/ui-controller.js';

/**
 * @typedef {'idle'|'quick-send'|'conversation'} ConversationMode
 */

export class ConversationModeManager {
  constructor(config = {}) {
    this.logger = createLogger('CONVERSATION_MODE');
    this.logger.info('🏗️ Initializing with modular architecture...');

    // EventManager (використовуємо переданий або fallback на глобальний)
    this.eventManager = config.eventManager || eventManager;

    // Конфігурація (тепер використовує Timeouts constants)
    this.config = {
      longPressDuration: config.longPressDuration || Timeouts.LONG_PRESS,
      quickSendMaxDuration: config.quickSendMaxDuration || Timeouts.QUICK_SEND_MAX,
      conversationTimeout: config.conversationTimeout || Timeouts.CONVERSATION_TOTAL,
      keywordForActivation: config.keywordForActivation || 'атлас',
      ...config
    };

    // 🆕 State Manager - централізоване управління станом
    this.state = createStateManager({
      conversationTimeout: this.config.conversationTimeout,
      maxHistorySize: config.maxHistorySize || 20
    });

    // 🆕 Event Handlers - будуть створені в initialize() після UI
    this.eventHandlers = null;

    // 🆕 UI Controller - будe створений в initialize()
    this.ui = null;

    // Таймери (залишаємо для backward compatibility)
    this.longPressTimer = null;
    this.conversationTimer = null;
    this.responseWaitTimer = null;

    // DOM елементи (будуть ініціалізовані в initialize())
    this.micButton = null;

    // Bind methods
    this.handleButtonMouseDown = this.handleButtonMouseDown.bind(this);
    this.handleButtonMouseUp = this.handleButtonMouseUp.bind(this);
    this.handleButtonTouchStart = this.handleButtonTouchStart.bind(this);
    this.handleButtonTouchEnd = this.handleButtonTouchEnd.bind(this);
  }

  /**
   * Ініціалізація менеджера
   */
  async initialize() {
    this.logger.info('🎙️ Initializing Conversation Mode Manager (Modular)...');

    // Знаходження DOM елементів
    this.micButton = document.getElementById('microphone-btn');
    if (!this.micButton) {
      this.logger.error('Microphone button not found!');
      return false;
    }

    // 🆕 Створюємо UI Controller
    this.ui = createUIController({
      micButton: this.micButton,
      autoCreateStatus: true
    });
    await this.ui.initialize();

    // 🆕 Створюємо Event Handlers з callbacks
    // NOTE: Callback methods MUST exist in class or be defined inline
    this.eventHandlers = createEventHandlers({
      eventManager: this.eventManager,
      stateManager: this.state,
      // Quick-send mode activation (on microphone button click)
      // ПРИМІТКА: НЕ викликаємо activateQuickSendMode() тут!
      // Він вже викликаний через endPressTimer → emit
      // Цей callback тільки для додаткової логіки (якщо потрібна)
      onQuickSend: (_payload) => {
        this.logger.info('🎤 Quick-send mode activation confirmed');
        // Додаткова логіка (якщо потрібна)
      },
      // Conversation mode activation (on long-press)
      // ПРИМІТКА: НЕ викликаємо activateConversationMode() тут!
      // Він вже викликаний через startPressTimer → setTimeout
      // Цей callback тільки для додаткової логіки (якщо потрібна)
      onConversationStart: (_payload) => {
        this.logger.info('💬 Conversation mode activation confirmed');
        // Додаткова логіка (якщо потрібна)
      },
      // Conversation mode deactivation
      onConversationEnd: (_payload) => {
        this.logger.info('🛑 Conversation mode deactivated');
        this.deactivateConversationMode();
      },
      // Transcription results from Whisper
      onTranscription: this.handleTranscriptionComplete.bind(this),
      // TTS playback completed
      onTTSComplete: this.handleTTSCompleted.bind(this),
      // Keyword detected in conversation mode
      onKeywordDetected: this.handleKeywordDetected.bind(this),
      onError: (error) => this.logger.error('Event handler error:', error)
    });

    // Підписуємося на всі події
    this.eventHandlers.subscribeToEvents();

    // Налаштування button listeners
    this.setupEventListeners();

    // Підписка на conversation state changes
    this.state.onStateChange((eventType, data) => {
      this.logger.debug(`State changed: ${eventType}`, data);
    });

    this.logger.info('✅ Conversation Mode Manager initialized (Modular)');
    return true;
  }

  /**
     * Налаштування event listeners для кнопки
     */
  setupEventListeners() {
    // Mouse events
    this.micButton.addEventListener('mousedown', this.handleButtonMouseDown);
    this.micButton.addEventListener('mouseup', this.handleButtonMouseUp);
    this.micButton.addEventListener('mouseleave', this.handleButtonMouseUp);

    // Touch events
    this.micButton.addEventListener('touchstart', this.handleButtonTouchStart, { passive: true });
    this.micButton.addEventListener('touchend', this.handleButtonTouchEnd);
    this.micButton.addEventListener('touchcancel', this.handleButtonTouchEnd);

    this.logger.debug('Event listeners attached to microphone button');
  }

  /**
     * Підписка на системні події
     */
  subscribeToSystemEvents() {
    // Завершення транскрипції
    this.eventManager.on(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
      this.handleTranscriptionComplete(event.payload);
    });

    // Початок TTS
    this.eventManager.on('TTS_STARTED', (event) => {
      this.handleTTSStarted(event);
    });

    // Завершення TTS - FIXED (11.10.2025 - 17:25): використовуємо Events.TTS_COMPLETED ('tts.completed')
    this.eventManager.on(Events.TTS_COMPLETED, (event) => {
      this.handleTTSCompleted(event);
    });

    // Виявлення ключового слова
    this.eventManager.on(Events.KEYWORD_DETECTED, (event) => {
      this.handleKeywordDetected(event.payload);
    });

    this.logger.debug('Subscribed to system events');
  }

  /**
     * Початок натискання кнопки (mouse)
     */
  handleButtonMouseDown(event) {
    event.preventDefault();
    this.startPressTimer();
  }

  /**
     * Кінець натискання кнопки (mouse)
     */
  handleButtonMouseUp(event) {
    event?.preventDefault();
    this.endPressTimer();
  }

  /**
     * Початок натискання кнопки (touch)
     */
  handleButtonTouchStart(_event) {
    this.startPressTimer();
  }

  /**
     * Кінець натискання кнопки (touch)
     */
  handleButtonTouchEnd(event) {
    event?.preventDefault();
    this.endPressTimer();
  }

  /**
     * Початок таймера довгого натискання
     */
  startPressTimer() {
    if (this.longPressTimer) return;

    this.logger.debug('Started long press timer');

    // Візуальний feedback через UI
    this.ui?.showButtonPressed();

    // Таймер для conversation mode
    this.longPressTimer = setTimeout(() => {
      this.logger.info('🎙️ Long press detected - activating Conversation Mode');

      // 1. Викликаємо активацію БЕЗ emit всередині
      this.activateConversationMode();

      // 2. Емітуємо подію ПІСЛЯ активації
      // 3. Callback onConversationStart() НЕ викликає activateConversationMode (тільки логує)
      // 4. Результат: NO infinite loop
      this.eventHandlers?.emitConversationActivated();
    }, this.config.longPressDuration);
  }

  /**
     * Закінчення таймера і визначення типу натискання
     */
  endPressTimer() {
    if (!this.longPressTimer) {
      // Якщо таймер вже спрацював, значить ми в conversation mode
      return;
    }

    // Очищення таймера
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;

    // Видалення візуального feedback через UI
    this.ui?.showIdleMode();

    // ПЕРЕВІРКА: якщо режим вже активний - вимкнути його кліком
    if (this.state.getCurrentMode() === ConversationModes.CONVERSATION && this.state.isInConversation()) {
      this.logger.info('🛑 Deactivating conversation mode by click');
      this.deactivateConversationMode();
      return;
    }

    if (this.state.getCurrentMode() === ConversationModes.QUICK_SEND) {
      this.logger.info('🛑 Stopping quick-send by click');
      // FIXED (11.10.2025 - 22:05): використовуємо ConversationEvents константу
      this.eventManager.emit(ConversationEvents.CONVERSATION_MODE_QUICK_SEND_END, {
        mode: 'idle',
        timestamp: Date.now()
      });
      this.state.returnToIdle();
      this.resetUI();
      return;
    }

    // Коротке натискання (<2s) → Quick-send mode
    // 1. Емітуємо подію СПОЧАТКУ
    // 2. Callback onQuickSend() НЕ викликає activateQuickSendMode (тільки логує)
    // 3. Викликаємо activateQuickSendMode() БЕЗ emit всередині
    // 4. Результат: NO infinite loop
    this.logger.info('📤 Quick press detected - emitting quick-send event');
    this.eventManager.emit(ConversationEvents.CONVERSATION_MODE_QUICK_SEND_START, {
      timestamp: Date.now()
    });

    // Викликаємо активацію БЕЗ emit
    this.activateQuickSendMode();
  }

  /**
   * Активація Quick-send режиму (одне натискання)
   */
  async activateQuickSendMode() {
    // 🆕 State validation
    if (this.state.isInConversation()) {
      this.logger.warn('Cannot activate quick-send during conversation');
      return;
    }

    // 🆕 State transition
    this.state.enterQuickSendMode();
    this.logger.info('🎤 Quick-send mode activated');

    // 🆕 UI updates через UI controller
    this.ui?.showQuickSendMode();

    // ПРИМІТКА: НЕ емітуємо подію тут!
    // Подія вже емітована через endPressTimer → emit(CONVERSATION_MODE_QUICK_SEND_START)
    // Щоб уникнути дублювання подій та infinite loop

    // Автоматична зупинка через максимальний час
    setTimeout(() => {
      if (this.state.getCurrentMode() === ConversationModes.QUICK_SEND) {
        this.logger.info('Quick-send timeout reached');
        this.deactivateQuickSendMode();
      }
    }, this.config.quickSendMaxDuration);
  }

  /**
   * Деактивація Quick-send режиму
   */
  deactivateQuickSendMode() {
    if (this.state.getCurrentMode() !== ConversationModes.QUICK_SEND) return;

    this.logger.info('📤 Quick-send mode deactivated');

    // 🆕 State transition
    this.state.returnToIdle();

    // 🆕 UI updates
    this.ui?.showIdleMode();
  }

  /**
   * Активація Conversation режиму (утримання 2 сек)
   */
  async activateConversationMode() {
    this.logger.info('🎬 Activating conversation mode...');
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;

    // 🆕 State transition
    this.state.enterConversationMode();
    this.logger.info('💬 Conversation mode activated', this.state.getDebugInfo());

    // 🆕 UI updates через UI controller
    this.ui?.showConversationActivated();

    // ПРИМІТКА: НЕ емітуємо подію тут!
    // Подія емітиться автоматично через state transition
    // Щоб уникнути дублювання подій та infinite loop

    // Початок прослуховування для ключового слова
    this.startListeningForKeyword();

    // Таймаут розмови
    this.startConversationTimer();
  }

  /**
   * Деактивація Conversation режиму
   */
  deactivateConversationMode() {
    if (!this.state.isInConversation()) return;

    this.logger.info('💬 Conversation mode deactivated');

    // 🆕 State transition
    this.state.exitConversationMode();

    // Очищення таймерів
    this.clearConversationTimer();
    this.clearResponseWaitTimer();

    // 🆕 UI updates
    this.ui?.showConversationEnded('completed');

    // 🆕 Event emission
    this.eventHandlers?.emitConversationDeactivated('user_action');
  }

  /**
   * Початок прослуховування ключового слова "Атлас"
   */
  startListeningForKeyword() {
    this.logger.debug('🔍 Started listening for activation keyword');

    // 🆕 UI update
    this.ui?.showConversationWaitingForKeyword();

    // 🆕 Event emission через event handlers
    this.eventHandlers?.emitStartKeywordDetection();
    this.ui?.showStatus('Скажіть "Атлас" для початку...');

    console.log('[CONVERSATION] 📡 Emitting START_KEYWORD_DETECTION event with keyword:', this.config.keywordForActivation);

    // Перевірка EventManager перед використанням
    if (!this.eventManager) {
      console.error('[CONVERSATION] ❌ EventManager is not available!');
      this.logger.error('EventManager is not available in ConversationModeManager');
      return;
    }

    if (typeof this.eventManager.emit !== 'function') {
      console.error('[CONVERSATION] ❌ EventManager.emit is not a function!', typeof this.eventManager.emit);
      return;
    }

    // Емісія події для keyword detector
    try {
      this.eventManager.emit(Events.START_KEYWORD_DETECTION, {
        keywords: [this.config.keywordForActivation],
        mode: 'conversation'
      });
      console.log('[CONVERSATION] ✅ START_KEYWORD_DETECTION event emitted successfully');
    } catch (error) {
      console.error('[CONVERSATION] ❌ Failed to emit START_KEYWORD_DETECTION:', error);
      this.logger.error('Failed to emit START_KEYWORD_DETECTION', null, error);
    }
  }

  /**
     * Обробка виявлення ключового слова
     */
  handleKeywordDetected(payload) {
    console.log('[CONVERSATION] 📨 Received KEYWORD_DETECTED event:', payload);

    if (!this.state.isInConversation()) {
      console.log('[CONVERSATION] ⚠️ Not in conversation mode, ignoring keyword');
      return;
    }

    const keyword = payload.keyword?.toLowerCase();
    const response = payload.response; // Відповідь від keyword detector
    console.log('[CONVERSATION] 🔍 Checking keyword:', keyword, 'vs expected:', this.config.keywordForActivation);
    console.log('[CONVERSATION] 🗣️ Activation response:', response);

    if (keyword === this.config.keywordForActivation) {
      this.logger.info(`🎯 Keyword "${keyword}" detected in conversation mode`);
      console.log('[CONVERSATION] ✅ Keyword matched! Activating with response...');
      this.onKeywordActivation(response); // Передаємо відповідь
    } else {
      console.log('[CONVERSATION] ❌ Keyword mismatch, ignoring');
    }
  }

  /**
     * Після виявлення "Атлас" - озвучення відповіді та початок запису
     */
  async onKeywordActivation(activationResponse = null) {
    this.logger.info(`🎯 Keyword activation triggered, response: "${activationResponse}"`);

    // Завжди використовуємо відповідь від keyword detector
    // Якщо немає - це помилка (keyword detector має генерувати)
    if (!activationResponse) {
      this.logger.warn('⚠️ No activation response provided by keyword detector - using fallback');
      activationResponse = 'слухаю';
    }

    // Показуємо статус
    this.ui?.showStatus(activationResponse, 'activation');

    // КРИТИЧНО: Додаємо відповідь в чат ПЕРЕД TTS
    this.logger.info(`💬 Adding activation response to chat: "${activationResponse}"`);
    try {
      // Додаємо повідомлення Atlas в чат
      if (window.atlasApp?.chatManager) {
        window.atlasApp.chatManager.addMessage(activationResponse, 'atlas', {
          skipTTS: true // НЕ запускати TTS через chatManager (буде окремо)
        });
      }
    } catch (error) {
      this.logger.error('Failed to add activation response to chat', null, error);
    }

    // КРИТИЧНО: Озвучуємо відповідь ПЕРЕД початком запису
    this.logger.info(`🔊 Playing activation response: "${activationResponse}"`);

    try {
      // Емітуємо подію для TTS (isActivationResponse=true означає що після цього треба запис)
      this.eventManager.emit('TTS_SPEAK_REQUEST', {
        text: activationResponse,
        agent: 'atlas',
        mode: 'conversation',
        priority: 'high',
        isActivationResponse: true // Позначаємо як activation response
      });

      // Після TTS завершення (через TTS_COMPLETED event) автоматично запуститься запис
      // Це обробляється в handleTTSCompleted()

    } catch (error) {
      this.logger.error('Failed to play activation response', null, error);

      // Fallback: якщо TTS failed - одразу запускаємо запис
      this.startConversationRecording();
    }

    // Емісія події для відправки в stage 0 (опціонально)
    this.eventManager.emit('CONVERSATION_KEYWORD_ACTIVATE', {
      keyword: this.config.keywordForActivation,
      response: activationResponse,
      mode: 'conversation',
      stage: 0
    });
  }

  /**
     * Початок запису в conversation режимі
     */
  startConversationRecording() {
    this.logger.info('🎤 Started conversation recording');

    this.ui?.showRecording();
    this.ui?.showStatus('Записую...');

    // Емісія події для початку запису
    // FIXED (11.10.2025 - 22:05): використовуємо ConversationEvents константу замість string literal
    this.eventManager.emit(ConversationEvents.CONVERSATION_RECORDING_START, {
      mode: 'conversation',
      timestamp: Date.now()
    });
  }

  /**
     * Обробка завершення транскрипції
     */
  handleTranscriptionComplete(payload) {
    // WhisperService емітує {result: {text, confidence, ...}, latency, audioSize}
    const text = payload.result?.text || payload.text;
    const confidence = payload.result?.confidence || payload.confidence || 1.0;

    this.logger.info(`📝 Transcription received: "${text}" (confidence: ${confidence}, mode: ${this.state.getCurrentMode()}, conversation: ${this.state.isConversationActive()}, pending: ${this.state.isTranscriptionPending()})`);

    // CRITICAL: Очищуємо silence timeout - користувач говорить!
    this.clearResponseWaitTimer();

    // Quick-send: приймаємо якщо mode=quick-send АБО якщо очікуємо транскрипцію
    if (this.state.getCurrentMode() === ConversationModes.QUICK_SEND || this.state.isTranscriptionPending()) {
      this.logger.info(`📤 Quick-send transcription: "${text}"`);
      this.state.setTranscriptionPending(false);
      this.onQuickSendTranscription(text, { confidence });
    } else if (this.state.getCurrentMode() === ConversationModes.CONVERSATION && this.state.isConversationActive()) {
      this.logger.info(`💬 Conversation transcription: "${text}"`);
      this.onConversationTranscription(text, { confidence });
    } else {
      this.logger.warn(`❌ Transcription ignored - invalid mode or state (mode: ${this.state.getCurrentMode()}, conversation: ${this.state.isConversationActive()})`);
    }
  }

  /**
   * Обробка транскрипції в Quick-send режимі
   */
  onQuickSendTranscription(text) {
    // 🆕 Використовуємо модульну фільтрацію
    const filterResult = filterTranscription(text, {
      confidence: 1.0,
      isConversationMode: false
    });

    if (filterResult.blocked) {
      this.logger.warn(`🚫 Quick-send filtered (${filterResult.reason}): "${text}"`);
      this.deactivateQuickSendMode();
      return;
    }

    // Відправка в чат
    this.sendToChat(text);

    // Деактивація режиму
    this.deactivateQuickSendMode();
  }

  /**
   * Обробка транскрипції в Conversation режимі
   * REFACTORED (11.10.2025): Uses modular filterTranscription
   */
  onConversationTranscription(text, transcriptionData = {}) {
    this.logger.info(`💬 Conversation transcription received: "${text}"`);

    // Отримання confidence з Whisper (якщо доступно)
    const confidence = transcriptionData.confidence || 1.0;

    // 🆕 МОДУЛЬНА ФІЛЬТРАЦІЯ - одна функція замість кількох перевірок
    const filterResult = filterTranscription(text, {
      confidence,
      isConversationMode: true
    });

    if (filterResult.blocked) {
      this.logger.warn(
        `🚫 Conversation filtered (${filterResult.reason}): "${text}" (confidence: ${confidence})`
      );

      // Обробка blocked transcription
      if (filterResult.action === 'return_to_keyword') {
        this.ui?.showTemporaryStatus(
          filterResult.reason === 'background_phrase'
            ? 'Фонова фраза відфільтрована...'
            : 'Не зрозумів, скажіть "Атлас"...',
          'info',
          2000
        );
        this.startListeningForKeyword();
      }

      return; // ❌ БЛОК - НЕ відправляти в chat!
    }

    // ═══════════════════════════════════════════════════════════════
    // КРОК 3: ВИРАЗНА КОМАНДА - ВІДПРАВИТИ В CHAT ✅
    // ═══════════════════════════════════════════════════════════════
    this.logger.info(`✅ Clear command passed filters: "${text}" (confidence: ${confidence}) - sending to Atlas`);

    // Скасування таймауту тиші (користувач говорив!)
    if (this.responseWaitTimer) {
      clearTimeout(this.responseWaitTimer);
      this.responseWaitTimer = null;
      this.logger.debug('🔄 Silence timeout cancelled - user spoke');
    }

    // Скидання флагу очікування через state manager
    this.state.setWaitingForUserResponse(false);
    this.ui?.showIdleMode(); // Скидання всіх класів

    // Додавання в історію розмови через state manager
    // FIXED (11.10.2025 - 22:05): використовуємо state.addToHistory() замість прямого this.conversationHistory.push()
    this.state.addToHistory({
      type: 'user', // StateManager використовує 'type' замість 'role'
      text,
      timestamp: Date.now(),
      confidence
    });

    // ✅ Відправка в чат (ТІЛЬКИ якщо пройшли ВСІ фільтри)
    this.sendToChat(text, { conversationMode: true, confidence });

    // Показуємо що Atlas обробляє запит
    this.ui?.showStatus('Atlas думає...');

    // Цикл продовжиться автоматично після TTS_COMPLETED події
  }

  /**
     * Обробка завершення TTS (Атлас закінчив говорити)
     * ОНОВЛЕНО (11.10.2025 - 20:30): Підтримка activation responses + continuous loop
     */
  handleTTSCompleted(event) {
    const mode = event?.mode || 'chat';
    const isInConversation = event?.isInConversation || false;
    const isActivationResponse = event?.isActivationResponse || false;

    console.log('[CONVERSATION] 🔊 TTS_COMPLETED event received!', {
      isInConversation,
      conversationActive: this.state.isConversationActive(),
      currentMode: this.state.getCurrentMode(),
      eventMode: mode,
      isActivationResponse,
      event
    });

    // Ігноруємо якщо НЕ в conversation mode
    if (!this.state.isInConversation()) {
      this.logger.warn('⚠️ TTS completed but NOT in conversation mode - ignoring');
      return;
    }

    // СПЕЦІАЛЬНА ОБРОБКА: Activation response (після "Атлас")
    // Після озвучення відповіді ("слухаю", "в увазі" тощо) - запускаємо запис
    if (isActivationResponse) {
      this.logger.info('🎙️ Activation response completed - starting conversation recording');
      this.ui?.showIdleMode();

      // Невелика пауза для природності (300ms)
      setTimeout(() => {
        if (this.state.isInConversation()) {
          this.startConversationRecording();
        }
      }, 300);

      return; // Не запускаємо continuous listening після activation response
    }

    // Ігноруємо якщо це task mode - conversation loop тільки для chat!
    if (mode === 'task') {
      this.logger.info('📋 Task mode detected - NOT starting conversation loop');
      return;
    }

    this.logger.info('🔊 Atlas finished speaking (chat mode) - starting continuous listening');

    // Видалення індікатора через UI controller
    this.ui?.showIdleMode();

    // АВТОМАТИЧНИЙ ЦИКЛ (ТІЛЬКИ ДЛЯ CHAT MODE): Запуск continuous listening БЕЗ keyword "Атлас"
    this.startContinuousListening();
  }

  /**
     * Початок continuous listening після відповіді Atlas
     * БЕЗ keyword detection - прямий запис користувача
     */
  startContinuousListening() {
    this.state.setWaitingForUserResponse(true);
    this.ui?.showStatus('Слухаю... (говоріть або мовчіть 5 сек для виходу)');
    this.ui?.showWaitingForResponse();
    this.ui?.updateButtonIcon('🟠'); // Помаранчевий - continuous listening

    this.logger.info('🔄 Starting continuous listening (no keyword needed)');

    // Невелика пауза для природності (500ms)
    setTimeout(() => {
      if (this.state.isWaitingForUserResponse() && this.state.isInConversation()) {
        this.startConversationRecording();
      }
    }, 500);

    // Таймаут для автоматичного виходу при тиші - 5 секунд
    this.responseWaitTimer = setTimeout(() => {
      this.logger.warn('⏱️ User silence timeout (5 sec) - returning to keyword mode');
      this.onUserSilenceTimeout();
    }, 5000);
  }

  /**
     * Таймаут тиші користувача - повернення до keyword mode
     */
  onUserSilenceTimeout() {
    this.state.setWaitingForUserResponse(false);
    this.ui?.showIdleMode();

    this.logger.info('🔄 Returning to keyword detection mode after silence');

    // Повернення до прослуховування ключового слова
    this.startListeningForKeyword();
  }

  /**
     * Застаріла функція - замінена на startContinuousListening
     * @deprecated Використовуйте startContinuousListening()
     */
  startWaitingForUserResponse() {
    // Backward compatibility - redirects to new method
    this.startContinuousListening();
  }

  /**
     * Відправка повідомлення в чат
     */
  sendToChat(text, metadata = {}) {
    this.logger.info(`📨 Sending to chat: "${text}"`);

    // Емісія події для відправки в чат
    // FIXED (11.10.2025 - 22:05): використовуємо ConversationEvents константу
    this.eventManager.emit(ConversationEvents.SEND_CHAT_MESSAGE, {
      text,
      source: 'voice',
      mode: this.state.getCurrentMode(),
      ...metadata
    });
  }

  /**
     * Початок таймера розмови
     */
  startConversationTimer() {
    this.conversationTimer = setTimeout(() => {
      this.logger.info('⏱️ Conversation timeout reached');
      this.deactivateConversationMode();
    }, this.config.conversationTimeout);
  }

  /**
     * Очищення таймера розмови
     */
  clearConversationTimer() {
    if (this.conversationTimer) {
      clearTimeout(this.conversationTimer);
      this.conversationTimer = null;
    }
  }

  /**
     * Очищення таймера очікування відповіді
     */
  clearResponseWaitTimer() {
    if (this.responseWaitTimer) {
      clearTimeout(this.responseWaitTimer);
      this.responseWaitTimer = null;
    }
  }

  /**
     * Отримання поточного режиму
     */
  getCurrentMode() {
    return this.state.getCurrentMode();
  }

  /**
     * Перевірка чи активний conversation режим
     */
  isConversationActive() {
    return this.state.isConversationActive();
  }

  /**
     * Примусова зупинка conversation режиму
     */
  forceStopConversation() {
    this.logger.warn('🛑 Force stopping conversation mode');
    this.deactivateConversationMode();
  }

  /**
   * Скидання UI до початкового стану
   */
  resetUI() {
    this.ui?.showIdleMode();
    this.ui?.hideStatus();
  }

  /**
     * Знищення менеджера
     */
  destroy() {
    // Очищення всіх таймерів
    this.clearConversationTimer();
    this.clearResponseWaitTimer();
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    // Видалення event listeners
    if (this.micButton) {
      this.micButton.removeEventListener('mousedown', this.handleButtonMouseDown);
      this.micButton.removeEventListener('mouseup', this.handleButtonMouseUp);
      this.micButton.removeEventListener('mouseleave', this.handleButtonMouseUp);
      this.micButton.removeEventListener('touchstart', this.handleButtonTouchStart);
      this.micButton.removeEventListener('touchend', this.handleButtonTouchEnd);
      this.micButton.removeEventListener('touchcancel', this.handleButtonTouchEnd);
    }

    // Cleanup модулів
    this.ui?.destroy();
    this.eventHandlers?.unsubscribeFromEvents();
    this.state?.clearHistory();

    this.logger.info('Conversation Mode Manager destroyed');
  }
}

export default ConversationModeManager;
