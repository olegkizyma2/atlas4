/**
 * @fileoverview Event Handlers для Conversation Mode
 * Обробка подій від різних компонентів системи
 *
 * @version 4.0.0
 * @date 2025-10-11
 */

import { createLogger } from '../core/logger.js';
import { Events } from '../events/event-manager.js';
import { ConversationEvents } from './constants.js';

const logger = createLogger('CONVERSATION_EVENTS');

/**
 * @typedef {Object} EventHandlerConfig
 * @property {Object} eventManager - Event manager instance
 * @property {Object} stateManager - State manager instance
 * @property {Function} onQuickSend - Callback для quick-send режиму
 * @property {Function} onConversationStart - Callback для старту розмови
 * @property {Function} onConversationEnd - Callback для завершення розмови
 * @property {Function} onTranscription - Callback для транскрипції
 * @property {Function} onTTSComplete - Callback для завершення TTS
 */

/**
 * Менеджер обробників подій для Conversation Mode
 */
export class ConversationEventHandlers {
  /**
     * @param {EventHandlerConfig} config
     */
  constructor(config = {}) {
    this.eventManager = config.eventManager;
    this.stateManager = config.stateManager;

    // Callbacks
    this.callbacks = {
      onQuickSend: config.onQuickSend || (() => { }),
      onConversationStart: config.onConversationStart || (() => { }),
      onConversationEnd: config.onConversationEnd || (() => { }),
      onTranscription: config.onTranscription || (() => { }),
      onTTSComplete: config.onTTSComplete || (() => { }),
      onKeywordDetected: config.onKeywordDetected || (() => { }),
      onError: config.onError || ((error) => logger.error('Event error:', error))
    };

    // Зберігаємо unsubscribe функції
    this.subscriptions = [];

    logger.info('🔧 ConversationEventHandlers initialized');
  }

  // ==================== SUBSCRIPTION ====================

  /**
     * Підписатись на всі необхідні події
     */
  subscribeToEvents() {
    if (!this.eventManager) {
      logger.error('❌ EventManager not provided, cannot subscribe to events');
      return;
    }

    logger.info('📡 Subscribing to conversation events...');

    // Quick-send mode events
    this.subscribe(
      ConversationEvents.CONVERSATION_MODE_QUICK_SEND_START,
      this.handleQuickSendStart.bind(this)
    );

    // Conversation mode events
    this.subscribe(
      ConversationEvents.CONVERSATION_MODE_ACTIVATED,
      this.handleConversationActivated.bind(this)
    );

    this.subscribe(
      ConversationEvents.CONVERSATION_MODE_DEACTIVATED,
      this.handleConversationDeactivated.bind(this)
    );

    this.subscribe(
      ConversationEvents.CONVERSATION_RECORDING_START,
      this.handleConversationRecordingStart.bind(this)
    );

    // Keyword detection
    this.subscribe(
      ConversationEvents.KEYWORD_DETECTED,
      this.handleKeywordDetected.bind(this)
    );

    // Transcription events
    this.subscribe(
      Events.WHISPER_TRANSCRIPTION_COMPLETED,
      this.handleTranscriptionCompleted.bind(this)
    );

    // TTS events (FIXED: використовуємо правильні константи)
    this.subscribe(
      Events.TTS_STARTED,  // було TTS_PLAYBACK_STARTED (НЕ існує!)
      this.handleTTSStarted.bind(this)
    );

    this.subscribe(
      Events.TTS_COMPLETED,  // 'tts.completed' - КРИТИЧНО: той самий event що емітить app-refactored.js!
      this.handleTTSCompleted.bind(this)
    );

    this.subscribe(
      Events.TTS_ERROR,  // було TTS_PLAYBACK_ERROR (НЕ існує!)
      this.handleTTSError.bind(this)
    );

    // Recording events
    this.subscribe(
      Events.RECORDING_STARTED,
      this.handleRecordingStarted.bind(this)
    );

    this.subscribe(
      Events.RECORDING_STOPPED,
      this.handleRecordingStopped.bind(this)
    );

    logger.info(`✅ Subscribed to ${this.subscriptions.length} events`);
  }

  /**
     * Відписатись від всіх подій
     */
  unsubscribeFromEvents() {
    logger.info(`📡 Unsubscribing from ${this.subscriptions.length} events...`);

    this.subscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('Error unsubscribing:', error);
      }
    });

    this.subscriptions = [];
    logger.info('✅ Unsubscribed from all events');
  }

  /**
     * Helper для підписки з автоматичним збереженням unsubscribe
     * @private
     */
  subscribe(eventName, handler) {
    try {
      const unsubscribe = this.eventManager.on(eventName, handler);
      this.subscriptions.push(unsubscribe);
      logger.debug(`📌 Subscribed to: ${eventName}`);
    } catch (error) {
      logger.error(`Failed to subscribe to ${eventName}:`, error);
    }
  }

  // ==================== EVENT HANDLERS ====================

  /**
     * Обробка старту Quick-Send режиму
     */
  handleQuickSendStart(payload) {
    logger.info('🚀 Quick-Send mode started', payload);

    try {
      this.callbacks.onQuickSend(payload);
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка активації Conversation mode
     */
  handleConversationActivated(payload) {
    logger.info('🎙️ Conversation mode activated', payload);

    try {
      this.callbacks.onConversationStart(payload);
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка деактивації Conversation mode
     */
  handleConversationDeactivated(payload) {
    logger.info('🛑 Conversation mode deactivated', payload);

    try {
      this.callbacks.onConversationEnd(payload);
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка старту запису в Conversation mode
     */
  handleConversationRecordingStart(payload) {
    logger.debug('🔴 Conversation recording started', payload);

    // Оновлюємо state через callback
    try {
      if (this.stateManager) {
        this.stateManager.setWaitingForUserResponse(true);
      }
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка детекції ключового слова
     */
  handleKeywordDetected(payload) {
    logger.info('🔑 Keyword detected:', payload?.keyword || 'N/A');

    try {
      this.callbacks.onKeywordDetected(payload);
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка завершення транскрипції
     */
  handleTranscriptionCompleted(payload) {
    logger.debug('📝 Transcription completed:', {
      hasText: !!payload?.text,
      hasResult: !!payload?.result,
      confidence: payload?.confidence || payload?.result?.confidence || 'N/A'
    });

    try {
      // Витягуємо текст з різних можливих структур
      const text = payload?.result?.text || payload?.text;
      const confidence = payload?.result?.confidence || payload?.confidence || 1.0;

      if (!text) {
        logger.warn('⚠️ Transcription completed but no text found');
        return;
      }

      // Оновлюємо state
      if (this.stateManager) {
        this.stateManager.setTranscriptionPending(false);
        this.stateManager.addToHistory({
          type: 'user',
          text,
          confidence,
          timestamp: Date.now()
        });
      }

      // Викликаємо callback з нормалізованими даними
      this.callbacks.onTranscription({
        text,
        confidence,
        originalPayload: payload
      });
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка старту TTS
     */
  handleTTSStarted(payload) {
    logger.debug('🔊 TTS playback started:', {
      hasText: !!payload?.text,
      length: payload?.text?.length || 0
    });

    try {
      if (this.stateManager && payload?.text) {
        this.stateManager.addToHistory({
          type: 'assistant',
          text: payload.text,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка завершення TTS
     */
  handleTTSCompleted(payload) {
    logger.info('✅ TTS playback completed', {
      mode: this.stateManager?.getCurrentMode() || 'unknown',
      isInConversation: this.stateManager?.isInConversation() || false,
      payloadKeys: payload ? Object.keys(payload) : [],
      payload
    });

    try {
      // FIXED (12.10.2025 - 17:15): Передаємо весь payload в callback
      this.callbacks.onTTSComplete(payload);
    } catch (error) {
      logger.error('Error in TTS complete callback:', error);
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка помилки TTS
     */
  handleTTSError(payload) {
    logger.error('❌ TTS playback error:', payload);

    try {
      // При помилці TTS можливо потрібно повернутись в keyword mode
      this.callbacks.onError(new Error('TTS playback failed'));
    } catch (error) {
      logger.error('Error in TTS error handler:', error);
    }
  }

  /**
     * Обробка старту запису
     */
  handleRecordingStarted(payload) {
    logger.debug('🔴 Recording started', payload);

    try {
      if (this.stateManager) {
        this.stateManager.setTranscriptionPending(true);
      }
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
     * Обробка зупинки запису
     */
  handleRecordingStopped(payload) {
    logger.debug('⏹️ Recording stopped', payload);

    // State буде оновлено в handleTranscriptionCompleted
  }

  // ==================== EMIT HELPERS ====================

  /**
     * Emit події в систему
     */
  emit(eventName, payload = {}) {
    if (!this.eventManager) {
      logger.warn(`Cannot emit ${eventName}: EventManager not available`);
      return;
    }

    try {
      this.eventManager.emit(eventName, payload);
      logger.debug(`📤 Emitted: ${eventName}`, payload);
    } catch (error) {
      logger.error(`Failed to emit ${eventName}:`, error);
      this.callbacks.onError(error);
    }
  }

  /**
     * Emit старт Quick-Send режиму
     */
  emitQuickSendStart() {
    this.emit(ConversationEvents.CONVERSATION_MODE_QUICK_SEND_START, {
      timestamp: Date.now()
    });
  }

  /**
     * Emit активацію Conversation mode
     */
  emitConversationActivated() {
    this.emit(ConversationEvents.CONVERSATION_MODE_ACTIVATED, {
      timestamp: Date.now()
    });
  }

  /**
     * Emit деактивацію Conversation mode
     */
  emitConversationDeactivated(reason = 'user_action') {
    this.emit(ConversationEvents.CONVERSATION_MODE_DEACTIVATED, {
      reason,
      timestamp: Date.now(),
      duration: this.stateManager?.getConversationDuration() || 0
    });
  }

  /**
     * Emit старт keyword detection
     */
  emitStartKeywordDetection() {
    this.emit(ConversationEvents.START_KEYWORD_DETECTION, {
      timestamp: Date.now()
    });
  }

  /**
     * Emit зупинку keyword detection
     */
  emitStopKeywordDetection() {
    this.emit(ConversationEvents.STOP_KEYWORD_DETECTION, {
      timestamp: Date.now()
    });
  }

  /**
     * Emit старт conversation recording
     */
  emitConversationRecordingStart() {
    this.emit(ConversationEvents.CONVERSATION_RECORDING_START, {
      timestamp: Date.now()
    });
  }

  /**
     * Emit відправку в chat
     */
  emitSendToChat(text, confidence = 1.0) {
    this.emit(Events.SEND_CHAT_MESSAGE, {
      text,
      confidence,
      source: 'conversation_mode',
      timestamp: Date.now()
    });
  }

  // ==================== CLEANUP ====================

  /**
     * Очистити всі ресурси
     */
  cleanup() {
    logger.info('🧹 Cleaning up event handlers...');
    this.unsubscribeFromEvents();
    this.callbacks = {};
    logger.info('✅ Event handlers cleaned up');
  }
}

/**
 * Helper: створити event handlers з конфігурацією
 * @param {EventHandlerConfig} config
 * @returns {ConversationEventHandlers}
 */
export function createEventHandlers(config = {}) {
  return new ConversationEventHandlers(config);
}
