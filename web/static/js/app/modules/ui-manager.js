/**
 * ATLAS UI Manager - v4.0
 * Відповідає за налаштування та управління користувацьким інтерфейсом
 */

import { logger } from '../core/logger.js';

export class UIManager {
  constructor(managers) {
    this.logger = new logger.constructor('UI-MANAGER');
    this.managers = managers;
  }

  setupUI() {
    this.logger.info('🎨 Setting up UI components...');

    // Налаштовуємо таби
    this.setupTabs();

    // Налаштовуємо контроли TTS
    this.setupTTSControls();

    // Налаштовуємо голосові контроли
    this.setupVoiceControls();

    // Налаштовуємо клавіатурні скорочення
    this.setupKeyboardShortcuts();

    this.logger.info('✅ UI setup complete');
  }

  setupTabs() {
    const tabChat = document.getElementById('tab-chat');
    const tabLogs = document.getElementById('tab-logs');
    const chatContent = document.getElementById('chat-content');
    const logsContent = document.getElementById('logs-content');

    if (tabChat && chatContent) {
      tabChat.addEventListener('click', () => {
        this.switchTab('chat');
      });
    }

    if (tabLogs && logsContent) {
      tabLogs.addEventListener('click', () => {
        this.switchTab('logs');
      });
    }

    // За замовчуванням показуємо чат
    this.switchTab('chat');
  }

  switchTab(tab) {
    const tabs = ['chat', 'logs'];

    tabs.forEach(t => {
      const tabElement = document.getElementById(`tab-${t}`);
      const contentElement = document.getElementById(`${t}-content`);

      if (tabElement && contentElement) {
        if (t === tab) {
          tabElement.classList.add('active');
          contentElement.style.display = 'block';
        } else {
          tabElement.classList.remove('active');
          contentElement.style.display = 'none';
        }
      }
    });

    this.logger.debug(`Switched to ${tab} tab`);
  }

  setupTTSControls() {
    // Кнопка увімкнення/вимкнення TTS
    const ttsToggle = document.getElementById('tts-toggle');
    if (ttsToggle && this.managers.chat) {
      const getCurrentTTSState = () => {
        const ttsManager = this.managers.chat?.ttsManager;

        if (!ttsManager) {
          return false;
        }

        try {
          if (typeof ttsManager.isEnabled === 'function') {
            return ttsManager.isEnabled();
          }

          return Boolean(ttsManager.isEnabled);
        } catch (error) {
          this.logger.debug('Unable to determine TTS state:', error?.message || error);
          return false;
        }
      };

      const updateIcon = () => {
        const isEnabled = getCurrentTTSState();
        const span = ttsToggle.querySelector('.btn-text') || ttsToggle;
        span.textContent = isEnabled ? '🔊' : '🔇';
        ttsToggle.title = isEnabled ? 'Натисніть щоб вимкнути озвучення TTS' : 'Натисніть щоб увімкнути озвучення TTS';
      };

      ttsToggle.addEventListener('click', () => {
        const isEnabled = getCurrentTTSState();
        if (isEnabled) {
          this.managers.chat.disableTTS();
        } else {
          this.managers.chat.enableTTS();
        }
        updateIcon();
      });

      // Встановлюємо початковий стан
      updateIcon();
    }

    // Перемикач режиму TTS
    const ttsModeToggle = document.getElementById('tts-mode-toggle');
    if (ttsModeToggle && this.managers.chat) {
      ttsModeToggle.addEventListener('click', () => {
        const currentMode = this.managers.chat.getTTSMode();
        const newMode = currentMode === 'quick' ? 'standard' : 'quick';
        this.managers.chat.setTTSMode(newMode);

        ttsModeToggle.textContent = newMode === 'quick' ?
          '⚡ Швидкий режим' : '🎵 Стандартний режим';

        this.logger.info(`TTS mode changed to: ${newMode}`);
      });

      // Встановлюємо початковий стан
      const currentMode = this.managers.chat.getTTSMode();
      ttsModeToggle.textContent = currentMode === 'quick' ?
        '⚡ Швидкий режим' : '🎵 Стандартний режим';
    }
  }

  setupVoiceControls() {
    // Голосовий перемикач видалено як дубль
    this.logger.debug('Voice controls disabled (replaced by TTS toggle)');
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter - відправити повідомлення
      if (e.ctrlKey && e.key === 'Enter') {
        if (this.managers.chat) {
          this.managers.chat.sendMessage();
        }
      }

      // Ctrl+L - очистити чат
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (this.managers.chat) {
          this.managers.chat.clearChat();
        }
      }

      // Ctrl+E - експорт історії
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (this.managers.chat) {
          this.managers.chat.exportChatHistory();
        }
      }

      // Ctrl+1/2 - перемикання табів
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        this.switchTab('chat');
      }
      if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        this.switchTab('logs');
      }
    });
  }

  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Створюємо простий toast notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            background-color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

    document.body.appendChild(notification);

    // Анімація появи
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Автоматичне приховування
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);

    // Клік для закриття
    notification.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }
}
