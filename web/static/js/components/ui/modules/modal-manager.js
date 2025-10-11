/**
 * Modal Manager
 *
 * Система модальних вікон
 * Винесено з atlas-advanced-ui.js для модульності
 */

export class ModalManager {
  constructor(config = {}) {
    this.enableAnimations = config.enableAnimations !== false;
    this.closeOnEscape = config.closeOnEscape !== false;
    this.closeOnBackdrop = config.closeOnBackdrop !== false;

    this.currentModal = null;

    this.init();
  }

  /**
     * Ініціалізація
     */
  init() {
    // Event listener для Escape
    if (this.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      });
    }

    // Event listener для кліків на backdrop
    if (this.closeOnBackdrop) {
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
          this.close();
        }
      });
    }

    // Автоматичні обробники кнопок закриття
    document.addEventListener('click', (e) => {
      if (e.target.matches('.modal-close, [data-modal-close]')) {
        this.close();
      }
    });
  }

  /**
     * Відкрити modal
     */
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`Modal with id "${modalId}" not found`);
      return;
    }

    // Закрити поточний modal якщо є
    if (this.currentModal) {
      this.close();
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
    this.currentModal = modal;

    // Створити backdrop якщо немає
    this.createBackdrop();

    // Анімація появи
    if (this.enableAnimations) {
      modal.style.transform = 'scale(0.8) translateY(-20px)';
      modal.style.opacity = '0';

      requestAnimationFrame(() => {
        modal.style.transition = 'all 0.3s ease';
        modal.style.transform = 'scale(1) translateY(0)';
        modal.style.opacity = '1';
      });
    }

    // Фокус на першому input
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  /**
     * Закрити поточний modal
     */
  close() {
    if (!this.currentModal) return;

    const modal = this.currentModal;

    if (this.enableAnimations) {
      modal.style.transform = 'scale(0.8) translateY(-20px)';
      modal.style.opacity = '0';

      setTimeout(() => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        this.removeBackdrop();
        this.currentModal = null;
      }, 300);
    } else {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
      this.removeBackdrop();
      this.currentModal = null;
    }
  }

  /**
     * Створити backdrop
     */
  createBackdrop() {
    let backdrop = document.querySelector('.modal-backdrop');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }

    backdrop.classList.add('active');

    if (this.enableAnimations) {
      backdrop.style.opacity = '0';
      requestAnimationFrame(() => {
        backdrop.style.transition = 'opacity 0.3s ease';
        backdrop.style.opacity = '1';
      });
    }
  }

  /**
     * Видалити backdrop
     */
  removeBackdrop() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) return;

    if (this.enableAnimations) {
      backdrop.style.opacity = '0';
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }, 300);
    } else {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }
  }

  /**
     * Створити і відкрити modal з контентом
     */
  create(options = {}) {
    const {
      id = `modal-${Date.now()}`,
      title = '',
      content = '',
      buttons = [],
      size = 'medium',
      onClose = null
    } = options;

    // Створити modal елемент
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = `modal modal-${size}`;

    let buttonsHTML = '';
    if (buttons.length > 0) {
      buttonsHTML = '<div class="modal-footer">';
      buttons.forEach(btn => {
        buttonsHTML += `<button class="${btn.className || 'btn'}" data-action="${btn.action || ''}">${btn.text}</button>`;
      });
      buttonsHTML += '</div>';
    }

    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">${content}</div>
                ${buttonsHTML}
            </div>
        `;

    document.body.appendChild(modal);

    // Обробники кнопок
    if (buttons.length > 0) {
      modal.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.getAttribute('data-action');
          const buttonConfig = buttons.find(b => b.action === action);
          if (buttonConfig && buttonConfig.handler) {
            buttonConfig.handler();
          }
          if (buttonConfig && buttonConfig.closeOnClick !== false) {
            this.close();
          }
        });
      });
    }

    // Відкрити modal
    this.open(id);

    return modal;
  }

  /**
     * Confirm dialog
     */
  confirm(message, onConfirm, onCancel) {
    return this.create({
      title: 'Підтвердження',
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'Скасувати',
          className: 'btn btn-secondary',
          action: 'cancel',
          handler: onCancel
        },
        {
          text: 'Підтвердити',
          className: 'btn btn-primary',
          action: 'confirm',
          handler: onConfirm
        }
      ]
    });
  }

  /**
     * Alert dialog
     */
  alert(message, onClose) {
    return this.create({
      title: 'Повідомлення',
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'OK',
          className: 'btn btn-primary',
          action: 'ok',
          handler: onClose
        }
      ]
    });
  }

  /**
     * Знищення менеджера
     */
  destroy() {
    this.close();
  }
}

export default ModalManager;
