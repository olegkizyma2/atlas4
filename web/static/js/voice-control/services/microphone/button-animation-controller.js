/**
 * Button Animation Controller
 *
 * Контроль анімацій кнопки мікрофону
 * Винесено з microphone-button-service.js для модульності
 */

/**
 * @typedef {'idle'|'listening'|'recording'|'processing'|'error'|'disabled'} MicrophoneState
 */

export class ButtonAnimationController {
  constructor(config = {}) {
    this.button = config.button;
    this.statusIndicator = config.statusIndicator;
    this.recordingIndicator = config.recordingIndicator;
    this.logger = config.logger;

    this.animationFrame = null;
    this.currentLevel = 0;
    this.targetLevel = 0;
  }

  /**
     * Ініціалізація контролера анімацій
     */
  initialize() {
    // Додавання CSS класів для анімацій
    if (this.button) {
      this.button.classList.add('microphone-button-animated');
    }
  }

  /**
     * Оновлення стану анімацій
     * @param {MicrophoneState} newState - Новий стан
     * @param {MicrophoneState} oldState - Попередній стан
     */
  updateState(newState, oldState) {
    // Видалення старих класів стану
    if (this.button) {
      this.button.classList.remove(`anim-${oldState}`);
      this.button.classList.add(`anim-${newState}`);
    }

    // Керування індикаторами
    this.updateIndicators(newState);

    // Спеціальні анімації
    this.handleSpecialAnimations(newState, oldState);
  }

  /**
     * Оновлення індикаторів
     * @param {MicrophoneState} state - Поточний стан
     */
  updateIndicators(state) {
    if (this.statusIndicator) {
      this.statusIndicator.className = `mic-status-indicator status-${state}`;
    }

    if (this.recordingIndicator) {
      const isRecording = ['listening', 'recording'].includes(state);
      this.recordingIndicator.style.display = isRecording ? 'block' : 'none';

      if (isRecording) {
        this.recordingIndicator.classList.add('pulse-animation');
      } else {
        this.recordingIndicator.classList.remove('pulse-animation');
      }
    }
  }

  /**
     * Спеціальні анімації для переходів
     * @param {MicrophoneState} newState - Новий стан
     * @param {MicrophoneState} oldState - Попередній стан
     */
  handleSpecialAnimations(newState, oldState) {
    // Анімація початку запису
    if (oldState === 'idle' && newState === 'listening') {
      this.triggerPulseAnimation();
    }

    // Анімація помилки
    if (newState === 'error') {
      this.triggerErrorAnimation();
    }

    // Анімація успішного завершення
    if (oldState === 'processing' && newState === 'idle') {
      this.triggerSuccessAnimation();
    }
  }

  /**
     * Оновлення рівня звуку
     * @param {number} level - Рівень звуку [0-1]
     */
  updateAudioLevel(level) {
    this.targetLevel = Math.max(0, Math.min(1, level));

    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(() => {
        this.animateAudioLevel();
      });
    }
  }

  /**
     * Анімація рівня звуку
     */
  animateAudioLevel() {
    const smoothing = 0.1;
    this.currentLevel += (this.targetLevel - this.currentLevel) * smoothing;

    // Оновлення візуального індикатора
    if (this.button && this.currentLevel > 0.01) {
      const scale = 1 + (this.currentLevel * 0.2);
      this.button.style.transform = `scale(${scale})`;
      this.button.style.boxShadow = `0 0 ${this.currentLevel * 20}px rgba(0, 255, 136, 0.5)`;
    } else {
      this.button.style.transform = '';
      this.button.style.boxShadow = '';
    }

    this.animationFrame = null;

    // Продовження анімації якщо є активність
    if (Math.abs(this.targetLevel - this.currentLevel) > 0.01) {
      this.animationFrame = requestAnimationFrame(() => {
        this.animateAudioLevel();
      });
    }
  }

  /**
     * Тригер pulse анімації
     */
  triggerPulseAnimation() {
    if (this.button) {
      this.button.classList.add('pulse-once');
      setTimeout(() => {
        this.button.classList.remove('pulse-once');
      }, 600);
    }
  }

  /**
     * Тригер анімації помилки
     */
  triggerErrorAnimation() {
    if (this.button) {
      this.button.classList.add('shake-animation');
      setTimeout(() => {
        this.button.classList.remove('shake-animation');
      }, 500);
    }
  }

  /**
     * Тригер анімації успіху
     */
  triggerSuccessAnimation() {
    if (this.button) {
      this.button.classList.add('success-flash');
      setTimeout(() => {
        this.button.classList.remove('success-flash');
      }, 300);
    }
  }

  /**
     * Cleanup
     */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.button) {
      this.button.style.transform = '';
      this.button.style.boxShadow = '';
    }
  }
}

export default ButtonAnimationController;
