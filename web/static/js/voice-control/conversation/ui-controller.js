/**
 * @fileoverview UI Controller для Conversation Mode
 * Управління візуальними індикаторами та DOM updates
 *
 * @version 4.0.0
 * @date 2025-10-11
 */

import { UIClasses, StatusMessages, ConversationModes } from './constants.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('CONVERSATION_UI');

/**
 * @typedef {Object} UIControllerConfig
 * @property {HTMLElement} micButton - Кнопка мікрофона
 * @property {HTMLElement} [statusElement] - Елемент статусу (створюється автоматично якщо немає)
 * @property {boolean} [autoCreateStatus=true] - Чи створювати status element автоматично
 */

/**
 * UI Controller для візуальних індикаторів Conversation Mode
 */
export class ConversationUIController {
  /**
     * @param {UIControllerConfig} config
     */
  constructor(config = {}) {
    this.micButton = config.micButton;
    this.statusElement = config.statusElement || null;
    this.autoCreateStatus = config.autoCreateStatus !== false;

    // Поточний режим для UI
    this.currentUIMode = ConversationModes.IDLE;

    // Animation timeouts
    this.animationTimeouts = [];

    logger.info('🔧 ConversationUIController initialized', {
      hasMicButton: !!this.micButton,
      hasStatusElement: !!this.statusElement,
      autoCreate: this.autoCreateStatus
    });
  }

  // ==================== INITIALIZATION ====================

  /**
     * Ініціалізація UI компонентів
     */
  initialize() {
    if (!this.micButton) {
      logger.error('❌ Microphone button not provided');
      return false;
    }

    // Створити status element якщо потрібно
    if (!this.statusElement && this.autoCreateStatus) {
      this.createStatusIndicator();
    }

    logger.info('✅ UI Controller initialized');
    return true;
  }

  /**
     * Створення візуального індикатора статусу
     */
  createStatusIndicator() {
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'conversation-status';
    this.statusElement.className = 'conversation-status hidden';
    this.statusElement.innerHTML = `
      <div class="status-content">
        <div class="status-icon"></div>
        <div class="status-text">Готовий</div>
      </div>
    `;

    // Додати до body
    document.body.appendChild(this.statusElement);

    logger.debug('📍 Status indicator created');
  }

  // ==================== MODE UPDATES ====================

  /**
     * Оновити UI для режиму Idle
     */
  showIdleMode() {
    this.currentUIMode = ConversationModes.IDLE;

    // Очистити всі класи режимів
    this.clearModeClasses();
    
    // Додати клас режиму idle
    this.micButton?.classList.add(UIClasses.MODE_IDLE);

    // Сховати статус
    this.hideStatus();

    logger.debug('🎨 UI updated: IDLE mode');
  }

  /**
     * Оновити UI для Quick-Send режиму
     */
  showQuickSendMode() {
    this.currentUIMode = ConversationModes.QUICK_SEND;

    this.clearModeClasses();
    this.micButton?.classList.add(UIClasses.MODE_QUICK_SEND);
    this.micButton?.classList.add(UIClasses.RECORDING);

    this.showStatus(StatusMessages.QUICK_SEND_RECORDING, 'quick-send');

    logger.debug('🎨 UI updated: QUICK_SEND mode');
  }

  /**
     * Оновити UI для Conversation режиму
     */
  showConversationMode() {
    this.currentUIMode = ConversationModes.CONVERSATION;

    this.clearModeClasses();
    this.micButton?.classList.add(UIClasses.MODE_CONVERSATION);
    this.micButton?.classList.add(UIClasses.CONVERSATION);

    this.showStatus(StatusMessages.CONVERSATION_ACTIVE, 'conversation');

    logger.debug('🎨 UI updated: CONVERSATION mode');
  }

  // ==================== BUTTON STATES ====================

  /**
     * Показати що кнопка натиснута
     */
  showButtonPressed() {
    this.micButton?.classList.add(UIClasses.PRESSING);
  }

  /**
     * Показати що кнопка відпущена
     */
  showButtonReleased() {
    this.micButton?.classList.remove(UIClasses.PRESSING);
  }

  /**
     * Показати що йде запис
     */
  showRecording() {
    this.micButton?.classList.add(UIClasses.RECORDING);
    this.addPulseAnimation();
  }

  /**
     * Сховати індикатор запису
     */
  hideRecording() {
    this.micButton?.classList.remove(UIClasses.RECORDING);
    this.removePulseAnimation();
  }

  /**
     * Показати що очікуємо відповідь
     */
  showWaitingForResponse() {
    this.micButton?.classList.add(UIClasses.WAITING_RESPONSE);
    this.showStatus(StatusMessages.WAITING_RESPONSE, 'waiting');
  }

  /**
     * Сховати індикатор очікування
     */
  hideWaitingForResponse() {
    this.micButton?.classList.remove(UIClasses.WAITING_RESPONSE);
  }

  /**
     * Показати що система думає (processing)
     */
  showProcessing() {
    this.micButton?.classList.add(UIClasses.PROCESSING);
    this.showStatus(StatusMessages.PROCESSING, 'processing');
  }

  /**
     * Сховати індикатор processing
     */
  hideProcessing() {
    this.micButton?.classList.remove(UIClasses.PROCESSING);
  }

  /**
     * Показати що слухаємо ключове слово
     */
  showListeningForKeyword() {
    this.showStatus(StatusMessages.KEYWORD_LISTENING, 'keyword-listening');
    this.addBreathingAnimation();
  }

  /**
     * Показати що говоримо (TTS активний)
     */
  showSpeaking() {
    this.micButton?.classList.add(UIClasses.SPEAKING);
    this.showStatus(StatusMessages.SPEAKING, 'speaking');
  }

  /**
     * Сховати індикатор говоріння
     */
  hideSpeaking() {
    this.micButton?.classList.remove(UIClasses.SPEAKING);
  }

  // ==================== STATUS MESSAGES ====================

  /**
     * Показати статусне повідомлення
     * @param {string} message - Текст повідомлення
     * @param {string} [type='info'] - Тип (info/recording/conversation/waiting/error)
     */
  showStatus(message, type = 'info') {
    if (!this.statusElement) return;

    // Оновити текст
    const textElement = this.statusElement.querySelector('.status-text');
    if (textElement) {
      textElement.textContent = message;
    }

    // Оновити тип
    this.statusElement.className = `conversation-status ${type}`;

    // Показати з анімацією
    requestAnimationFrame(() => {
      this.statusElement?.classList.remove('hidden');
      this.statusElement?.classList.add('visible');
    });

    logger.debug(`💬 Status: ${message} (${type})`);
  }

  /**
     * Сховати статус
     */
  hideStatus() {
    if (!this.statusElement) return;

    this.statusElement.classList.remove('visible');
    this.statusElement.classList.add('hidden');
  }

  /**
     * Показати тимчасове повідомлення (auto-hide після timeout)
     * @param {string} message - Текст
     * @param {string} type - Тип
     * @param {number} duration - Тривалість (мс)
     */
  showTemporaryStatus(message, type = 'info', duration = 3000) {
    this.showStatus(message, type);

    const timeout = setTimeout(() => {
      this.hideStatus();
    }, duration);

    this.animationTimeouts.push(timeout);
  }

  /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст помилки
     */
  showError(message) {
    this.showTemporaryStatus(message, 'error', 5000);
    this.flashButton('error');
  }

  // ==================== ANIMATIONS ====================

  /**
     * Додати pulse анімацію до кнопки
     */
  addPulseAnimation() {
    this.micButton?.classList.add('pulse-animation');
  }

  /**
     * Видалити pulse анімацію
     */
  removePulseAnimation() {
    this.micButton?.classList.remove('pulse-animation');
  }

  /**
     * Додати breathing анімацію (для keyword listening)
     */
  addBreathingAnimation() {
    this.micButton?.classList.add('breathing-animation');
  }

  /**
     * Видалити breathing анімацію
     */
  removeBreathingAnimation() {
    this.micButton?.classList.remove('breathing-animation');
  }

  /**
     * Flash ефект на кнопці
     * @param {string} type - Тип флешу (success/error/info)
     */
  flashButton(type = 'success') {
    if (!this.micButton) return;

    const flashClass = `flash-${type}`;
    this.micButton.classList.add(flashClass);

    const timeout = setTimeout(() => {
      this.micButton?.classList.remove(flashClass);
    }, 500);

    this.animationTimeouts.push(timeout);
  }

  /**
     * Очистити всі класи режимів
     * @private
     */
  clearModeClasses() {
    if (!this.micButton) return;

    Object.values(UIClasses).forEach(className => {
      this.micButton?.classList.remove(className);
    });
  }

  // ==================== CONVERSATION FLOW UI ====================

  /**
     * Показати що conversation mode активований
     */
  showConversationActivated() {
    this.showConversationMode();
    this.flashButton('success');
    this.showStatus(StatusMessages.CONVERSATION_ACTIVE, 'conversation');
  }

  /**
     * Показати що слухаємо користувача в conversation
     */
  showConversationListening() {
    this.showRecording();
    this.showStatus(StatusMessages.CONVERSATION_LISTENING, 'recording');
  }

  /**
     * Показати що чекаємо на ключове слово "Атлас"
     */
  showConversationWaitingForKeyword() {
    this.hideRecording();
    this.showListeningForKeyword();
  }

  /**
     * Показати що conversation завершено
     */
  showConversationEnded(reason = 'completed') {
    this.clearModeClasses();
    this.hideStatus();

    if (reason === 'timeout') {
      this.showTemporaryStatus(StatusMessages.TIMEOUT, 'info', 3000);
    } else if (reason === 'error') {
      this.showError('Помилка розмови');
    }

    this.flashButton('info');
  }

  // ==================== HELPERS ====================

  /**
     * Отримати поточний UI режим
     * @returns {string}
     */
  getCurrentUIMode() {
    return this.currentUIMode;
  }

  /**
     * Чи показано статус
     * @returns {boolean}
     */
  isStatusVisible() {
    return this.statusElement?.classList.contains('visible') || false;
  }

  /**
     * Оновити кнопку мікрофона (якщо вона змінилась в DOM)
     * @param {HTMLElement} newButton
     */
  updateMicButton(newButton) {
    this.micButton = newButton;
    logger.debug('🔄 Microphone button updated');
  }

  // ==================== CLEANUP ====================

  /**
     * Очистити всі timeouts та анімації
     */
  clearAnimations() {
    this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.animationTimeouts = [];

    this.removePulseAnimation();
    this.removeBreathingAnimation();
  }

  /**
     * Повний cleanup UI
     */
  cleanup() {
    logger.info('🧹 Cleaning up UI controller...');

    this.clearAnimations();
    this.clearModeClasses();
    this.hideStatus();

    // Видалити створений status element
    if (this.statusElement && this.autoCreateStatus) {
      this.statusElement.remove();
      this.statusElement = null;
    }

    logger.info('✅ UI controller cleaned up');
  }

  /**
     * Reset до початкового стану
     */
  reset() {
    this.clearAnimations();
    this.showIdleMode();
    logger.debug('🔄 UI reset to initial state');
  }
}

/**
 * Helper: створити UI controller з конфігурацією
 * @param {UIControllerConfig} config
 * @returns {ConversationUIController}
 */
export function createUIController(config = {}) {
  return new ConversationUIController(config);
}
