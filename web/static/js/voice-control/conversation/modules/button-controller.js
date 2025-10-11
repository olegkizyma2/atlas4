/**
 * Conversation Button Controller - v4.0
 * Відповідає за обробку взаємодії з кнопкою мікрофона
 */

import { createLogger } from '../../core/logger.js';

export class ButtonController {
  constructor(config = {}, uiManager) {
    this.logger = createLogger('BUTTON-CONTROLLER');
    this.config = config;
    this.uiManager = uiManager;

    // DOM елементи
    this.micButton = null;

    // Стан натискання
    this.longPressTimer = null;
    this.pressStartTime = null;
    this.isPressed = false;

    // Callbacks
    this.onQuickPress = null;
    this.onLongPress = null;

    // Bind methods
    this.handleButtonMouseDown = this.handleButtonMouseDown.bind(this);
    this.handleButtonMouseUp = this.handleButtonMouseUp.bind(this);
    this.handleButtonTouchStart = this.handleButtonTouchStart.bind(this);
    this.handleButtonTouchEnd = this.handleButtonTouchEnd.bind(this);
    this.handleButtonMouseLeave = this.handleButtonMouseLeave.bind(this);
    this.handleButtonTouchCancel = this.handleButtonTouchCancel.bind(this);
  }

  /**
     * Ініціалізація контролера кнопок
     */
  async initialize() {
    this.logger.info('Initializing Button Controller...');

    // Знаходження кнопки мікрофона
    this.micButton = document.getElementById('microphone-btn');
    if (!this.micButton) {
      this.logger.error('Microphone button not found!');
      return false;
    }

    // Налаштування event listeners
    this.setupEventListeners();

    this.logger.info('✅ Button Controller initialized');
    return true;
  }

  /**
     * Налаштування event listeners
     */
  setupEventListeners() {
    // Mouse events
    this.micButton.addEventListener('mousedown', this.handleButtonMouseDown);
    this.micButton.addEventListener('mouseup', this.handleButtonMouseUp);
    this.micButton.addEventListener('mouseleave', this.handleButtonMouseLeave);

    // Touch events
    this.micButton.addEventListener('touchstart', this.handleButtonTouchStart, { passive: true });
    this.micButton.addEventListener('touchend', this.handleButtonTouchEnd);
    this.micButton.addEventListener('touchcancel', this.handleButtonTouchCancel);

    // Запобігання context menu на тривале натискання
    this.micButton.addEventListener('contextmenu', (e) => e.preventDefault());

    this.logger.debug('Event listeners attached to microphone button');
  }

  /**
     * Початок натискання кнопки (mouse)
     */
  handleButtonMouseDown(event) {
    event.preventDefault();
    this.startPress();
  }

  /**
     * Кінець натискання кнопки (mouse)
     */
  handleButtonMouseUp(event) {
    if (event) event.preventDefault();
    this.endPress();
  }

  /**
     * Покидання кнопки мишкою
     */
  handleButtonMouseLeave(event) {
    if (this.isPressed) {
      this.endPress();
    }
  }

  /**
     * Початок натискання кнопки (touch)
     */
  handleButtonTouchStart(event) {
    // Запобігання також mouse events
    event.preventDefault();
    this.startPress();
  }

  /**
     * Кінець натискання кнопки (touch)
     */
  handleButtonTouchEnd(event) {
    if (event) event.preventDefault();
    this.endPress();
  }

  /**
     * Скасування touch
     */
  handleButtonTouchCancel(event) {
    if (event) event.preventDefault();
    this.endPress();
  }

  /**
     * Початок натискання
     */
  startPress() {
    if (this.isPressed) return;

    this.isPressed = true;
    this.pressStartTime = Date.now();

    this.logger.debug('Button press started');

    // Візуальний feedback
    this.uiManager?.showPressState();

    // Запуск таймера для тривалого натискання
    this.longPressTimer = setTimeout(() => {
      this.logger.info('🎙️ Long press detected');
      this.triggerLongPress();
    }, this.config.longPressDuration);
  }

  /**
     * Кінець натискання
     */
  endPress() {
    if (!this.isPressed) return;

    const pressDuration = Date.now() - (this.pressStartTime || Date.now());
    this.isPressed = false;

    this.logger.debug(`Button press ended, duration: ${pressDuration}ms`);

    // Видалення візуального feedback
    this.uiManager?.hidePressState();

    // Якщо таймер ще не спрацював - це короткий клік
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;

      if (pressDuration < this.config.longPressDuration) {
        this.logger.info('📤 Quick press detected');
        this.triggerQuickPress();
      }
    }
    // Інакше довгий клік вже оброблений
  }

  /**
     * Тригер короткого натискання
     */
  triggerQuickPress() {
    if (this.onQuickPress) {
      this.onQuickPress();
    }
  }

  /**
     * Тригер тривалого натискання
     */
  triggerLongPress() {
    // Очищення таймера
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.onLongPress) {
      this.onLongPress();
    }
  }

  /**
     * Встановлення callback для короткого натискання
     */
  setQuickPressCallback(callback) {
    this.onQuickPress = callback;
  }

  /**
     * Встановлення callback для тривалого натискання
     */
  setLongPressCallback(callback) {
    this.onLongPress = callback;
  }

  /**
     * Відключення кнопки
     */
  disable() {
    if (this.micButton) {
      this.micButton.disabled = true;
      this.micButton.style.opacity = '0.5';
    }
  }

  /**
     * Увімкнення кнопки
     */
  enable() {
    if (this.micButton) {
      this.micButton.disabled = false;
      this.micButton.style.opacity = '1';
    }
  }

  /**
     * Перевірка чи кнопка натиснута
     */
  isButtonPressed() {
    return this.isPressed;
  }

  /**
     * Примусове скидання стану
     */
  reset() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.isPressed = false;
    this.pressStartTime = null;

    this.uiManager?.hidePressState();
  }

  /**
     * Отримання статистики кнопки
     */
  getStatistics() {
    return {
      isPressed: this.isPressed,
      pressDuration: this.pressStartTime ? Date.now() - this.pressStartTime : 0,
      hasLongPressTimer: !!this.longPressTimer,
      isEnabled: this.micButton ? !this.micButton.disabled : false
    };
  }

  /**
     * Очищення
     */
  cleanup() {
    this.reset();
  }

  /**
     * Знищення контролера
     */
  destroy() {
    this.cleanup();

    // Видалення event listeners
    if (this.micButton) {
      this.micButton.removeEventListener('mousedown', this.handleButtonMouseDown);
      this.micButton.removeEventListener('mouseup', this.handleButtonMouseUp);
      this.micButton.removeEventListener('mouseleave', this.handleButtonMouseLeave);
      this.micButton.removeEventListener('touchstart', this.handleButtonTouchStart);
      this.micButton.removeEventListener('touchend', this.handleButtonTouchEnd);
      this.micButton.removeEventListener('touchcancel', this.handleButtonTouchCancel);
    }

    this.micButton = null;
    this.onQuickPress = null;
    this.onLongPress = null;
  }
}
