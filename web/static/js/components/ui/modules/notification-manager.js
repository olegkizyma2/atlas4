/**
 * Notification Manager
 *
 * Система сповіщень для користувача
 * Винесено з atlas-advanced-ui.js для модульності
 */

export class NotificationManager {
  constructor(config = {}) {
    this.enableAnimations = config.enableAnimations !== false;
    this.defaultDuration = config.defaultDuration || 5000;
    this.maxNotifications = config.maxNotifications || 5;

    this.container = null;
    this.notifications = [];

    this.init();
  }

  /**
     * Ініціалізація
     */
  init() {
    this.container = this.createContainer();
  }

  /**
     * Створення контейнера для сповіщень
     */
  createContainer() {
    let container = document.getElementById('notification-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    return container;
  }

  /**
     * Показати сповіщення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип: info, success, warning, error
     * @param {number} duration - Тривалість в мс (0 = нескінченно)
     */
  show(message, type = 'info', duration = this.defaultDuration) {
    // Обмеження кількості сповіщень
    if (this.notifications.length >= this.maxNotifications) {
      this.removeOldest();
    }

    const notification = this.createNotification(message, type, duration);
    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Анімація появи
    if (this.enableAnimations) {
      this.animateIn(notification);
    }

    // Автоматичне видалення
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }

    return notification;
  }

  /**
     * Швидкі методи для різних типів
     */
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  /**
     * Створення DOM елемента сповіщення
     */
  createNotification(message, type, duration) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icon = this.getIcon(type);
    notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">×</button>
        `;

    // Обробник кнопки закриття
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.remove(notification);
    });

    return notification;
  }

  /**
     * Отримання іконки для типу
     */
  getIcon(type) {
    const icons = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    };

    return icons[type] || icons['info'];
  }

  /**
     * Анімація появи
     */
  animateIn(notification) {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';

    requestAnimationFrame(() => {
      notification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
  }

  /**
     * Анімація зникнення
     */
  animateOut(notification, callback) {
    if (this.enableAnimations) {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';

      setTimeout(callback, 300);
    } else {
      callback();
    }
  }

  /**
     * Видалення сповіщення
     */
  remove(notification) {
    this.animateOut(notification, () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }

      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    });
  }

  /**
     * Видалення найстарішого сповіщення
     */
  removeOldest() {
    if (this.notifications.length > 0) {
      this.remove(this.notifications[0]);
    }
  }

  /**
     * Очищення всіх сповіщень
     */
  clearAll() {
    this.notifications.forEach(notification => {
      this.remove(notification);
    });
  }

  /**
     * Знищення менеджера
     */
  destroy() {
    this.clearAll();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export default NotificationManager;
