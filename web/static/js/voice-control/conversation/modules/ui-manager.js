/**
 * Conversation UI Manager - v4.0
 * Відповідає за візуальне представлення режимів спілкування
 */

import { createLogger } from '../../core/logger.js';

export class ConversationUIManager {
  constructor(config = {}) {
    this.logger = createLogger('CONVERSATION-UI');
    this.config = config;

    // DOM елементи
    this.micButton = null;
    this.statusElement = null;
    this.notificationElement = null;

    // Таймери для UI
    this.notificationTimer = null;
  }

  /**
     * Ініціалізація UI компонентів
     */
  async initialize() {
    this.logger.info('Initializing Conversation UI Manager...');

    // Знаходження кнопки мікрофона
    this.micButton = document.getElementById('microphone-btn');
    if (!this.micButton) {
      this.logger.error('Microphone button not found!');
      return false;
    }

    // Створення UI елементів
    this.createStatusIndicator();
    this.createNotificationElement();
    this.injectStyles();

    this.logger.info('✅ Conversation UI Manager initialized');
    return true;
  }

  /**
     * Створення індикатора статусу
     */
  createStatusIndicator() {
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'conversation-mode-status';
    this.statusElement.className = 'conversation-mode-status hidden';
    this.statusElement.innerHTML = `
            <div class="status-content">
                <div class="status-icon">💬</div>
                <div class="status-text">Режим розмови</div>
                <div class="status-hint">Говоріть після сигналу...</div>
            </div>
        `;
    document.body.appendChild(this.statusElement);
  }

  /**
     * Створення елемента для сповіщень
     */
  createNotificationElement() {
    this.notificationElement = document.createElement('div');
    this.notificationElement.id = 'conversation-notification';
    this.notificationElement.className = 'conversation-notification hidden';
    document.body.appendChild(this.notificationElement);
  }

  /**
     * Впровадження стилів
     */
  injectStyles() {
    if (document.getElementById('conversation-ui-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'conversation-ui-styles';
    styles.textContent = `
            .conversation-mode-status {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 15, 30, 0.95);
                border: 2px solid #00ffff;
                border-radius: 15px;
                padding: 20px;
                z-index: 10000;
                text-align: center;
                color: #00ffff;
                font-family: 'Courier New', monospace;
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
            }
            
            .conversation-mode-status.hidden {
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -50%) scale(0.8);
            }
            
            .status-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .status-icon {
                font-size: 2em;
                animation: pulse 1.5s infinite;
            }
            
            .status-text {
                font-size: 1.2em;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .status-hint {
                font-size: 0.9em;
                opacity: 0.8;
            }
            
            .conversation-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 15, 30, 0.9);
                border: 1px solid #00ffff;
                border-radius: 8px;
                padding: 15px 20px;
                color: #00ffff;
                font-family: 'Courier New', monospace;
                z-index: 9999;
                max-width: 300px;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
                transition: all 0.3s ease;
            }
            
            .conversation-notification.hidden {
                opacity: 0;
                transform: translateX(100%);
                pointer-events: none;
            }
            
            .conversation-notification.quick-send {
                border-color: #ffaa00;
                color: #ffaa00;
                box-shadow: 0 0 20px rgba(255, 170, 0, 0.2);
            }
            
            .conversation-notification.conversation {
                border-color: #00ff7f;
                color: #00ff7f;
                box-shadow: 0 0 20px rgba(0, 255, 127, 0.2);
            }
            
            .conversation-notification.listening {
                border-color: #ff4444;
                color: #ff4444;
                box-shadow: 0 0 20px rgba(255, 68, 68, 0.2);
            }
            
            #microphone-btn.pressing {
                transform: scale(0.95);
                box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.3);
            }
            
            #microphone-btn.recording {
                animation: recording-pulse 1s infinite;
            }
            
            #microphone-btn.quick-send {
                border-color: #ffaa00;
                box-shadow: 0 0 20px rgba(255, 170, 0, 0.4);
            }
            
            #microphone-btn.conversation-mode {
                border-color: #00ff7f;
                box-shadow: 0 0 25px rgba(0, 255, 127, 0.5);
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes recording-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        `;
    document.head.appendChild(styles);
  }

  /**
     * Показ індикатора режиму
     */
  showModeNotification(text, type = 'info', duration = 3000) {
    if (!this.notificationElement) return;

    this.notificationElement.textContent = text;
    this.notificationElement.className = `conversation-notification ${type}`;

    // Автоматичне приховування
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    if (duration > 0) {
      this.notificationTimer = setTimeout(() => {
        this.hideModeNotification();
      }, duration);
    }
  }

  /**
     * Приховування сповіщення
     */
  hideModeNotification() {
    if (this.notificationElement) {
      this.notificationElement.classList.add('hidden');
    }

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  /**
     * Показ статусу conversation режиму
     */
  showConversationStatus(text, hint = 'Говоріть після сигналу...') {
    if (!this.statusElement) return;

    const statusText = this.statusElement.querySelector('.status-text');
    const statusHint = this.statusElement.querySelector('.status-hint');

    if (statusText) statusText.textContent = text;
    if (statusHint) statusHint.textContent = hint;

    this.statusElement.classList.remove('hidden');
  }

  /**
     * Приховування статусу conversation режиму
     */
  hideConversationStatus() {
    if (this.statusElement) {
      this.statusElement.classList.add('hidden');
    }
  }

  /**
     * Показ стану запису
     */
  showRecordingState(mode = 'recording') {
    if (!this.micButton) return;

    this.micButton.classList.add('recording');

    if (mode === 'quick-send') {
      this.micButton.classList.add('quick-send');
      this.showModeNotification('Запис...', 'quick-send', 0);
    } else if (mode === 'conversation') {
      this.showModeNotification('Слухаю...', 'listening', 0);
    }
  }

  /**
     * Приховування стану запису
     */
  hideRecordingState() {
    if (!this.micButton) return;

    this.micButton.classList.remove('recording', 'quick-send', 'conversation-mode');
    this.hideModeNotification();
  }

  /**
     * Показ режиму Quick-send
     */
  showQuickSendMode() {
    this.logger.debug('Showing quick-send mode UI');
    if (this.micButton) {
      this.micButton.classList.remove('conversation-mode', 'idle');
      this.micButton.classList.add('active', 'quick-send', 'recording');
      this.micButton.setAttribute('title', '🔴 Запис... Клік для зупинки');
      // Змінюємо текст кнопки
      const btnText = this.micButton.querySelector('.btn-text');
      if (btnText) btnText.textContent = '🔴';
    }
    this.showModeNotification('🎤 Запис...', 'quick-send', 0);
  }

  /**
   * Показ режиму Conversation
   */
  showConversationMode() {
    this.logger.debug('Showing conversation mode UI');
    if (this.micButton) {
      this.micButton.classList.remove('quick-send', 'idle');
      this.micButton.classList.add('active', 'conversation-mode');
      this.micButton.setAttribute('title', '🔵 Режим розмови активний. Клік для виходу');
      // Змінюємо текст кнопки
      const btnText = this.micButton.querySelector('.btn-text');
      if (btnText) btnText.textContent = '🔵';
    }
    this.showModeNotification('💬 Режим розмови', 'conversation', 5000);
    this.showConversationStatus('Режим розмови активовано!', 'Скажіть "атлас" для продовження');
  }

  /**
   * Показ режиму Idle (очікування)
   */
  showIdleMode() {
    this.logger.debug('Showing idle mode UI');
    if (this.micButton) {
      this.micButton.classList.remove('active', 'quick-send', 'conversation-mode', 'pressing', 'recording');
      this.micButton.classList.add('idle');
      this.micButton.setAttribute('title', '⚫ Клік — запис. Утримання 2 сек — режим розмови');
      // Повертаємо стандартний текст кнопки
      const btnText = this.micButton.querySelector('.btn-text');
      if (btnText) btnText.textContent = '🎤';
    }
    this.hideConversationStatus();
    this.hideModeNotification();
  }

  /**
     * Показ стану conversation режиму
     */
  showConversationModeState() {
    if (!this.micButton) return;

    this.micButton.classList.add('conversation-mode');
    this.showConversationStatus('Режим розмови активовано!');
    this.showModeNotification('Режим розмови активний', 'conversation', 5000);
  }

  /**
     * Приховування стану conversation режиму
     */
  hideConversationModeState() {
    if (!this.micButton) return;

    this.micButton.classList.remove('conversation-mode');
    this.hideConversationStatus();
    this.showModeNotification('Режим розмови завершено', 'info', 3000);
  }

  /**
     * Показ стану очікування відповіді
     */
  showWaitingState() {
    this.showModeNotification('Очікування відповіді...', 'conversation', 0);
    this.showConversationStatus('Обробка запиту...', 'Зачекайте відповіді системи');
  }

  /**
     * Показ стану прослуховування ключового слова
     */
  showListeningForKeywordState() {
    this.showConversationStatus('Режим розмови', 'Скажіть "атлас" для продовження');
  }

  /**
     * Показ стану натискання кнопки
     */
  showButtonPressed() {
    this.logger.debug('Showing button pressed state');
    if (this.micButton) {
      this.micButton.classList.add('pressing');
      // Показуємо що утримується для conversation
      const btnText = this.micButton.querySelector('.btn-text');
      if (btnText) btnText.textContent = '⏳';
    }
  }

  /**
     * Приховування візуального feedback для натискання
     */
  hidePressState() {
    if (this.micButton) {
      this.micButton.classList.remove('pressing');
    }
  }

  /**
     * Програвання звуку активації (якщо потрібно)
     */
  playActivationSound() {
    try {
      // Створення простого звукового сигналу
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      this.logger.debug('Could not play activation sound', error);
    }
  }

  /**
     * Отримання стану UI
     */
  getUIState() {
    return {
      statusVisible: this.statusElement && !this.statusElement.classList.contains('hidden'),
      notificationVisible: this.notificationElement && !this.notificationElement.classList.contains('hidden'),
      micButtonClasses: this.micButton ? Array.from(this.micButton.classList) : [],
      hasNotificationTimer: !!this.notificationTimer
    };
  }

  /**
     * Очищення UI
     */
  cleanup() {
    this.hideModeNotification();
    this.hideConversationStatus();
    this.hideRecordingState();

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  /**
     * Знищення UI компонентів
     */
  destroy() {
    this.cleanup();

    // Видалення створених елементів
    if (this.statusElement && this.statusElement.parentNode) {
      this.statusElement.parentNode.removeChild(this.statusElement);
    }

    if (this.notificationElement && this.notificationElement.parentNode) {
      this.notificationElement.parentNode.removeChild(this.notificationElement);
    }

    // Видалення стилів
    const styles = document.getElementById('conversation-ui-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    this.micButton = null;
    this.statusElement = null;
    this.notificationElement = null;
  }
}
