/**
 * Conversation Mode Handler - v4.0
 * Відповідає за управління різними режимами спілкування
 */

import { createLogger } from '../../core/logger.js';
import { eventManager, Events } from '../../events/event-manager.js';

export class ModeHandler {
  constructor(config = {}) {
    this.logger = createLogger('MODE-HANDLER');
    this.config = config;

    // Поточний стан
    this.currentMode = 'idle';
    this.isInConversation = false;
    this.conversationActive = false;
    this.waitingForUserResponse = false;

    // Історія розмови
    this.conversationHistory = [];

    // Таймери
    this.conversationTimer = null;
    this.responseWaitTimer = null;
  }

  /**
     * Активація Quick-send режиму
     */
  async activateQuickSendMode() {
    if (this.isInConversation) {
      this.logger.warn('Cannot activate quick-send during conversation');
      return false;
    }

    this.currentMode = 'quick-send';
    this.logger.info('🎤 Quick-send mode activated');

    // Емісія події для початку запису
    eventManager.emit('CONVERSATION_MODE_QUICK_SEND_START', {
      mode: 'quick-send',
      timestamp: Date.now()
    });

    // Автоматична зупинка через максимальний час
    setTimeout(() => {
      if (this.currentMode === 'quick-send') {
        this.logger.info('Quick-send timeout reached');
        this.deactivateQuickSendMode();
      }
    }, this.config.quickSendMaxDuration);

    return true;
  }

  /**
     * Деактивація Quick-send режиму
     */
  deactivateQuickSendMode() {
    if (this.currentMode !== 'quick-send') return;

    this.logger.info('📤 Quick-send mode deactivated');
    this.currentMode = 'idle';

    // Емісія події для зупинки запису
    eventManager.emit('CONVERSATION_MODE_QUICK_SEND_END', {
      mode: 'idle',
      timestamp: Date.now()
    });
  }

  /**
     * Активація Conversation режиму
     */
  async activateConversationMode() {
    this.currentMode = 'conversation';
    this.isInConversation = true;
    this.conversationActive = true;

    this.logger.info('💬 Conversation mode activated');

    // Емісія події
    eventManager.emit('CONVERSATION_MODE_ACTIVATED', {
      mode: 'conversation',
      timestamp: Date.now()
    });

    // Початок прослуховування для ключового слова
    this.startListeningForKeyword();

    // Таймаут розмови
    this.startConversationTimer();

    return true;
  }

  /**
     * Деактивація Conversation режиму
     */
  deactivateConversationMode() {
    if (!this.isInConversation) return;

    this.logger.info('💬 Conversation mode deactivated');

    this.currentMode = 'idle';
    this.isInConversation = false;
    this.conversationActive = false;
    this.waitingForUserResponse = false;

    // Очищення таймерів
    this.clearAllTimers();

    // Емісія події
    eventManager.emit('CONVERSATION_MODE_DEACTIVATED', {
      mode: 'idle',
      timestamp: Date.now(),
      conversationDuration: this.getConversationDuration()
    });

    // Збереження історії
    this.saveConversationHistory();
  }

  /**
     * Початок прослуховування ключового слова
     */
  startListeningForKeyword() {
    this.logger.debug('Started listening for keyword in conversation mode');

    eventManager.emit('START_KEYWORD_DETECTION', {
      keywords: [this.config.keywordForActivation],
      mode: 'conversation'
    });
  }

  /**
     * Запуск таймера розмови
     */
  startConversationTimer() {
    this.conversationTimer = setTimeout(() => {
      this.logger.info('Conversation timeout reached');
      this.deactivateConversationMode();
    }, this.config.conversationTimeout);
  }

  /**
     * Обробка виявлення ключового слова
     */
  handleKeywordDetected(payload) {
    if (!this.isInConversation || !this.conversationActive) {
      return;
    }

    const keyword = payload.keyword;
    this.logger.info(`🎯 Keyword detected in conversation: ${keyword}`);

    // Початок запису після виявлення ключового слова
    this.startConversationRecording();

    // Емісія спеціальної події для conversation keyword
    eventManager.emit('CONVERSATION_KEYWORD_ACTIVATE', {
      keyword,
      mode: 'conversation',
      timestamp: Date.now()
    });
  }

  /**
     * Початок запису в conversation режимі
     */
  startConversationRecording() {
    this.logger.info('🎤 Starting conversation recording');

    this.waitingForUserResponse = false;

    eventManager.emit('CONVERSATION_RECORDING_START', {
      mode: 'conversation',
      timestamp: Date.now()
    });
  }

  /**
     * Обробка завершення транскрипції
     */
  handleTranscriptionComplete(payload) {
    const text = payload?.text?.trim();

    if (!text) {
      this.logger.debug('Empty transcription result');
      return;
    }

    if (this.currentMode === 'quick-send') {
      this.handleQuickSendResult(text, payload);
    } else if (this.currentMode === 'conversation') {
      this.handleConversationResult(text, payload);
    }
  }

  /**
     * Обробка результату Quick-send
     */
  handleQuickSendResult(text, payload) {
    this.logger.info(`📤 Quick-send result: "${text}"`);

    // Відправка в чат
    eventManager.emit('SEND_CHAT_MESSAGE', {
      text,
      mode: 'quick-send',
      confidence: payload.confidence,
      timestamp: Date.now()
    });

    // Деактивація режиму
    this.deactivateQuickSendMode();
  }

  /**
     * Обробка результату Conversation
     */
  handleConversationResult(text, payload) {
    this.logger.info(`💬 Conversation result: "${text}"`);

    // Додавання до історії
    this.conversationHistory.push({
      type: 'user',
      text,
      timestamp: Date.now(),
      confidence: payload.confidence
    });

    // Відправка в чат
    eventManager.emit('SEND_CHAT_MESSAGE', {
      text,
      mode: 'conversation',
      conversationMode: true,
      confidence: payload.confidence,
      timestamp: Date.now()
    });

    // Очікування відповіді системи
    this.startWaitingForResponse();
  }

  /**
     * Початок очікування відповіді системи
     */
  startWaitingForResponse() {
    this.waitingForUserResponse = true;
    this.logger.debug('Waiting for system response in conversation mode');

    // Таймаут очікування відповіді
    this.responseWaitTimer = setTimeout(() => {
      this.logger.warn('Response wait timeout in conversation mode');
      this.waitingForUserResponse = false;
    }, 30000); // 30 секунд очікування
  }

  /**
     * Обробка початку TTS
     */
  handleTTSStarted(event) {
    if (this.isInConversation) {
      this.logger.debug('TTS started during conversation');

      // Додавання до історії
      this.conversationHistory.push({
        type: 'system',
        text: event.text,
        agent: event.agent,
        timestamp: Date.now()
      });
    }
  }

  /**
     * Обробка завершення TTS
     */
  handleTTSCompleted(event) {
    if (this.isInConversation && this.waitingForUserResponse) {
      this.logger.debug('TTS completed, ready for next user input');

      // Очищення таймера очікування
      if (this.responseWaitTimer) {
        clearTimeout(this.responseWaitTimer);
        this.responseWaitTimer = null;
      }

      this.waitingForUserResponse = false;

      // Повернення до прослуховування ключового слова
      this.startListeningForKeyword();
    }
  }

  /**
     * Очищення всіх таймерів
     */
  clearAllTimers() {
    if (this.conversationTimer) {
      clearTimeout(this.conversationTimer);
      this.conversationTimer = null;
    }

    if (this.responseWaitTimer) {
      clearTimeout(this.responseWaitTimer);
      this.responseWaitTimer = null;
    }
  }

  /**
     * Отримання тривалості розмови
     */
  getConversationDuration() {
    if (this.conversationHistory.length === 0) return 0;

    const firstMessage = this.conversationHistory[0];
    const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];

    return lastMessage.timestamp - firstMessage.timestamp;
  }

  /**
     * Збереження історії розмови
     */
  saveConversationHistory() {
    if (this.conversationHistory.length === 0) return;

    const conversationData = {
      startTime: this.conversationHistory[0].timestamp,
      endTime: Date.now(),
      duration: this.getConversationDuration(),
      messages: [...this.conversationHistory]
    };

    // Збереження в localStorage
    const conversations = JSON.parse(localStorage.getItem('atlas_conversations') || '[]');
    conversations.push(conversationData);

    // Обмеження до останніх 10 розмов
    if (conversations.length > 10) {
      conversations.splice(0, conversations.length - 10);
    }

    localStorage.setItem('atlas_conversations', JSON.stringify(conversations));

    this.logger.info(`Conversation saved: ${this.conversationHistory.length} messages, ${Math.round(conversationData.duration / 1000)}s duration`);

    // Очищення поточної історії
    this.conversationHistory = [];
  }

  /**
     * Отримання поточного режиму
     */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
     * Перевірка чи активний conversation режим
     */
  isConversationActive() {
    return this.isInConversation && this.conversationActive;
  }

  /**
     * Отримання історії розмови
     */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
     * Отримання статистики режимів
     */
  getModeStatistics() {
    const conversations = JSON.parse(localStorage.getItem('atlas_conversations') || '[]');

    return {
      currentMode: this.currentMode,
      isInConversation: this.isInConversation,
      currentConversationLength: this.conversationHistory.length,
      totalConversations: conversations.length,
      averageConversationDuration: conversations.length > 0
        ? conversations.reduce((sum, conv) => sum + conv.duration, 0) / conversations.length / 1000
        : 0
    };
  }
}
