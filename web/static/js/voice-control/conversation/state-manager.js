/**
 * @fileoverview State Manager для Conversation Mode
 * Централізоване управління станом режимів розмови
 *
 * @version 4.0.0
 * @date 2025-10-11
 */

import { ConversationModes } from './constants.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('CONVERSATION_STATE');

/**
 * @typedef {Object} ConversationState
 * @property {string} currentMode - Поточний режим (idle/quick-send/conversation)
 * @property {boolean} isInConversation - Чи активна розмова
 * @property {boolean} conversationActive - Чи conversation mode активний
 * @property {boolean} waitingForUserResponse - Чи очікуємо відповідь користувача
 * @property {boolean} transcriptionPending - Чи очікуємо транскрипцію
 * @property {number} conversationStartTime - Час початку розмови
 * @property {Array<Object>} conversationHistory - Історія розмови
 */

/**
 * Менеджер стану Conversation Mode
 */
export class ConversationStateManager {
  /**
       * @param {Object} config - Конфігурація
       * @param {number} config.conversationTimeout - Таймаут розмови (мс)
       */
  constructor(config = {}) {
    this.config = {
      conversationTimeout: config.conversationTimeout || 120000, // 2 хвилини
      maxHistorySize: config.maxHistorySize || 20 // Максимум записів в історії
    };

    // Початковий стан
    this.state = {
      currentMode: ConversationModes.IDLE,
      isInConversation: false,
      conversationActive: false,
      waitingForUserResponse: false,
      transcriptionPending: false,
      conversationStartTime: null,
      conversationHistory: []
    };

    // Listeners для зміни стану
    this.stateChangeListeners = new Set();

    logger.info('🔧 ConversationStateManager initialized');
  }

  // ==================== GETTERS ====================

  /**
       * Отримати поточний режим
       * @returns {string}
       */
  getCurrentMode() {
    return this.state.currentMode;
  }

  /**
       * Чи активна розмова
       * @returns {boolean}
       */
  isInConversation() {
    return this.state.isInConversation;
  }

  /**
       * Чи conversation mode активний
       * @returns {boolean}
       */
  isConversationActive() {
    return this.state.conversationActive;
  }

  /**
       * Чи очікуємо відповідь користувача
       * @returns {boolean}
       */
  isWaitingForUserResponse() {
    return this.state.waitingForUserResponse;
  }

  /**
       * Чи очікуємо транскрипцію
       * @returns {boolean}
       */
  isTranscriptionPending() {
    return this.state.transcriptionPending;
  }

  /**
       * Отримати повний стан
       * @returns {ConversationState}
       */
  getState() {
    return { ...this.state };
  }

  /**
       * Отримати історію розмови
       * @returns {Array<Object>}
       */
  getConversationHistory() {
    return [...this.state.conversationHistory];
  }

  /**
       * Тривалість поточної розмови (мс)
       * @returns {number|null}
       */
  getConversationDuration() {
    if (!this.state.conversationStartTime) return null;
    return Date.now() - this.state.conversationStartTime;
  }

  // ==================== STATE TRANSITIONS ====================

  /**
       * Перехід в режим Quick-Send
       */
  enterQuickSendMode() {
    const oldMode = this.state.currentMode;
    this.state.currentMode = ConversationModes.QUICK_SEND;
    this.state.transcriptionPending = true;

    logger.info(`🔄 Mode transition: ${oldMode} → QUICK_SEND`);
    this.notifyStateChange('modeChanged', { oldMode, newMode: ConversationModes.QUICK_SEND });
  }

  /**
       * Перехід в Conversation Mode
       */
  enterConversationMode() {
    const oldMode = this.state.currentMode;
    this.state.currentMode = ConversationModes.CONVERSATION;
    this.state.isInConversation = true;
    this.state.conversationActive = true;
    this.state.conversationStartTime = Date.now();

    logger.info(`🔄 Mode transition: ${oldMode} → CONVERSATION`, {
      startTime: new Date(this.state.conversationStartTime).toISOString()
    });

    this.notifyStateChange('modeChanged', {
      oldMode,
      newMode: ConversationModes.CONVERSATION,
      startTime: this.state.conversationStartTime
    });
  }

  /**
       * Вихід з Conversation Mode
       */
  exitConversationMode() {
    const duration = this.getConversationDuration();
    const historySize = this.state.conversationHistory.length;

    this.state.currentMode = ConversationModes.IDLE;
    this.state.isInConversation = false;
    this.state.conversationActive = false;
    this.state.waitingForUserResponse = false;
    this.state.transcriptionPending = false;
    this.state.conversationStartTime = null;

    logger.info('🔄 Exiting CONVERSATION mode', {
      duration: duration ? `${(duration / 1000).toFixed(1)}s` : 'N/A',
      historySize
    });

    this.notifyStateChange('conversationEnded', { duration, historySize });
  }

  /**
       * Повернення в режим Idle
       */
  returnToIdle() {
    const oldMode = this.state.currentMode;

    this.state.currentMode = ConversationModes.IDLE;
    this.state.isInConversation = false;
    this.state.conversationActive = false;
    this.state.waitingForUserResponse = false;
    this.state.transcriptionPending = false;

    if (oldMode !== ConversationModes.IDLE) {
      logger.info(`🔄 Mode transition: ${oldMode} → IDLE`);
      this.notifyStateChange('modeChanged', { oldMode, newMode: ConversationModes.IDLE });
    }
  }

  // ==================== STATE FLAGS ====================

  /**
       * Встановити флаг очікування відповіді користувача
       * @param {boolean} waiting
       */
  setWaitingForUserResponse(waiting) {
    const oldValue = this.state.waitingForUserResponse;
    this.state.waitingForUserResponse = waiting;

    if (oldValue !== waiting) {
      logger.debug(`⏳ Waiting for user response: ${waiting}`);
      this.notifyStateChange('waitingChanged', { waiting });
    }
  }

  /**
       * Встановити флаг очікування транскрипції
       * @param {boolean} pending
       */
  setTranscriptionPending(pending) {
    const oldValue = this.state.transcriptionPending;
    this.state.transcriptionPending = pending;

    if (oldValue !== pending) {
      logger.debug(`📝 Transcription pending: ${pending}`);
      this.notifyStateChange('transcriptionPendingChanged', { pending });
    }
  }

  /**
       * Встановити conversation active flag
       * @param {boolean} active
       */
  setConversationActive(active) {
    const oldValue = this.state.conversationActive;
    this.state.conversationActive = active;

    if (oldValue !== active) {
      logger.debug(`💬 Conversation active: ${active}`);
      this.notifyStateChange('conversationActiveChanged', { active });
    }
  }

  // ==================== HISTORY MANAGEMENT ====================

  /**
       * Додати запис в історію розмови
       * @param {Object} entry - Запис історії
       * @param {string} entry.type - Тип (user/assistant/system)
       * @param {string} entry.text - Текст
       * @param {number} [entry.timestamp] - Час (автоматично якщо не вказано)
       */
  addToHistory(entry) {
    const record = {
      timestamp: entry.timestamp || Date.now(),
      type: entry.type,
      text: entry.text,
      confidence: entry.confidence,
      metadata: entry.metadata || {}
    };

    this.state.conversationHistory.push(record);

    // Обмеження розміру історії
    if (this.state.conversationHistory.length > this.config.maxHistorySize) {
      const removed = this.state.conversationHistory.shift();
      logger.debug('📚 History trimmed, removed oldest entry:', removed.type);
    }

    logger.debug(`📝 Added to history: ${entry.type} (total: ${this.state.conversationHistory.length})`);
    this.notifyStateChange('historyUpdated', { entry: record });
  }

  /**
       * Очистити історію розмови
       */
  clearHistory() {
    const oldSize = this.state.conversationHistory.length;
    this.state.conversationHistory = [];

    logger.info(`🗑️ History cleared (${oldSize} entries removed)`);
    this.notifyStateChange('historyCleared', { oldSize });
  }

  /**
       * Отримати останні N записів історії
       * @param {number} count - Кількість записів
       * @returns {Array<Object>}
       */
  getRecentHistory(count = 5) {
    return this.state.conversationHistory.slice(-count);
  }

  // ==================== VALIDATION ====================

  /**
       * Перевірити чи не вийшов таймаут розмови
       * @returns {boolean} true якщо таймаут вийшов
       */
  isConversationTimedOut() {
    const duration = this.getConversationDuration();
    if (!duration) return false;

    const timedOut = duration > this.config.conversationTimeout;
    if (timedOut) {
      logger.warn(`⏱️ Conversation timeout exceeded: ${(duration / 1000).toFixed(1)}s`);
    }

    return timedOut;
  }

  /**
       * Чи можна почати нову розмову
       * @returns {boolean}
       */
  canStartConversation() {
    return this.state.currentMode === ConversationModes.IDLE &&
            !this.state.isInConversation &&
            !this.state.conversationActive;
  }

  /**
       * Чи можна відправити quick-send
       * @returns {boolean}
       */
  canStartQuickSend() {
    return this.state.currentMode === ConversationModes.IDLE &&
            !this.state.isInConversation;
  }

  // ==================== LISTENERS ====================

  /**
       * Підписатись на зміни стану
       * @param {Function} callback - Функція-обробник (eventType, data) => void
       */
  onStateChange(callback) {
    this.stateChangeListeners.add(callback);
    return () => this.stateChangeListeners.delete(callback); // Unsubscribe function
  }

  /**
       * Повідомити listeners про зміну стану
       * @private
       * @param {string} eventType - Тип події
       * @param {Object} data - Дані події
       */
  notifyStateChange(eventType, data) {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        logger.error('Error in state change listener:', error);
      }
    });
  }

  // ==================== DEBUGGING ====================

  /**
       * Отримати стан для логування
       * @returns {Object}
       */
  getDebugInfo() {
    return {
      mode: this.state.currentMode,
      flags: {
        inConversation: this.state.isInConversation,
        conversationActive: this.state.conversationActive,
        waitingForUser: this.state.waitingForUserResponse,
        transcriptionPending: this.state.transcriptionPending
      },
      conversation: {
        startTime: this.state.conversationStartTime,
        duration: this.getConversationDuration(),
        historySize: this.state.conversationHistory.length
      },
      validation: {
        timedOut: this.isConversationTimedOut(),
        canStartConversation: this.canStartConversation(),
        canStartQuickSend: this.canStartQuickSend()
      }
    };
  }

  /**
       * Скинути весь стан (для тестування)
       */
  reset() {
    this.state = {
      currentMode: ConversationModes.IDLE,
      isInConversation: false,
      conversationActive: false,
      waitingForUserResponse: false,
      transcriptionPending: false,
      conversationStartTime: null,
      conversationHistory: []
    };

    logger.warn('🔄 State reset to defaults');
    this.notifyStateChange('reset', {});
  }
}

/**
 * Helper: створити state manager з конфігурацією
 * @param {Object} config - Конфігурація
 * @returns {ConversationStateManager}
 */
export function createStateManager(config = {}) {
  return new ConversationStateManager(config);
}
