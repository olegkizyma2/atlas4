/**
 * Button State Manager
 *
 * Управління станами кнопки мікрофону з валідацією переходів
 * Винесено з microphone-button-service.js для модульності
 */

/**
 * @typedef {'idle'|'listening'|'recording'|'processing'|'error'|'disabled'} MicrophoneState
 */

export class ButtonStateManager {
  constructor(config = {}) {
    this.logger = config.logger;
    this.onStateChange = config.onStateChange;
    this.currentState = 'idle';
    this.stateHistory = [];
  }

  /**
     * Ініціалізація менеджера станів
     */
  initialize() {
    this.currentState = 'idle';
    this.stateHistory = [];
  }

  /**
     * Встановлення стану
     * @param {MicrophoneState} newState - Новий стан
     * @param {string} reason - Причина зміни
     */
  setState(newState, reason = '') {
    const oldState = this.currentState;

    if (oldState === newState) {
      return; // Стан не змінився
    }

    // Валідація переходу станів
    if (!this.isValidTransition(oldState, newState)) {
      this.logger?.warn(`Invalid state transition: ${oldState} -> ${newState}`);
      return;
    }

    // Збереження в історії
    this.stateHistory.push({
      from: oldState,
      to: newState,
      reason,
      timestamp: new Date()
    });

    // Обмеження історії
    if (this.stateHistory.length > 20) {
      this.stateHistory = this.stateHistory.slice(-20);
    }

    // Зміна стану
    this.currentState = newState;

    // Виклик callback
    this.onStateChange?.(oldState, newState, reason);

    this.logger?.debug(`State: ${oldState} -> ${newState} (${reason})`);
  }

  /**
     * Перевірка валідності переходу станів
     * @param {MicrophoneState} from - Початковий стан
     * @param {MicrophoneState} to - Цільовий стан
     * @returns {boolean} - Чи валідний перехід
     */
  isValidTransition(from, to) {
    const transitions = {
      idle: ['listening', 'recording', 'disabled', 'error'], // +recording for direct conversation mode
      listening: ['recording', 'idle', 'processing', 'error'], // +processing for quick transcription
      recording: ['processing', 'idle', 'error'],
      processing: ['idle', 'error'],
      error: ['idle', 'disabled'],
      disabled: ['idle', 'error']
    };

    return transitions[from]?.includes(to) || to === 'error';
  }

  /**
     * Отримання поточного стану
     * @returns {MicrophoneState} - Поточний стан
     */
  getCurrentState() {
    return this.currentState;
  }

  /**
     * Отримання історії станів
     * @returns {Array} - Історія переходів
     */
  getStateHistory() {
    return [...this.stateHistory];
  }
}

export default ButtonStateManager;
