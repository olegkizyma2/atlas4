/**
 * Tooltip Manager
 *
 * Система підказок для елементів інтерфейсу
 * Винесено з atlas-advanced-ui.js для модульності
 */

export class TooltipManager {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.enableAnimations = config.enableAnimations !== false;
    this.delay = config.delay || 300;

    this.currentTooltip = null;
    this.showTimeout = null;

    if (this.enabled) {
      this.init();
    }
  }

  /**
     * Ініціалізація event listeners
     */
  init() {
    document.addEventListener('mouseenter', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const element = target.closest('[title], [data-tooltip]');
      if (element) {
        this.scheduleShow(element);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const element = target.closest('[title], [data-tooltip]');
      if (element) {
        this.hide();
      }
    }, true);

    // Приховати tooltip при scroll
    document.addEventListener('scroll', () => {
      this.hide();
    }, true);
  }

  /**
     * Запланувати показ tooltip з затримкою
     */
  scheduleShow(element) {
    // Скасувати попередній таймер
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    this.showTimeout = setTimeout(() => {
      this.show(element);
    }, this.delay);
  }

  /**
     * Показати tooltip
     */
  show(element) {
    const text = element.getAttribute('data-tooltip') || element.getAttribute('title');
    if (!text) return;

    // Тимчасово видаляємо title щоб не показувати дефолтний tooltip
    if (element.hasAttribute('title')) {
      element.setAttribute('data-original-title', element.getAttribute('title'));
      element.removeAttribute('title');
    }

    const tooltip = this.create(text);
    this.position(tooltip, element);
  }

  /**
     * Створення tooltip елемента
     */
  create(text) {
    // Видалити існуючий tooltip
    this.hide();

    const tooltip = document.createElement('div');
    tooltip.className = 'atlas-tooltip';
    tooltip.textContent = text;

    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;

    return tooltip;
  }

  /**
     * Позиціонування tooltip
     */
  position(tooltip, element) {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Перевірка чи tooltip не виходить за межі екрану
    if (top < 0) {
      // Показати знизу
      top = rect.bottom + 8;
      tooltip.classList.add('tooltip-bottom');
    }

    if (left < 0) {
      left = 8;
    } else if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Анімація появи
    if (this.enableAnimations) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'scale(0.8)';

      requestAnimationFrame(() => {
        tooltip.style.transition = 'all 0.2s ease';
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'scale(1)';
      });
    }
  }

  /**
     * Приховати tooltip
     */
  hide() {
    // Скасувати scheduled show
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    if (this.currentTooltip) {
      if (this.enableAnimations) {
        this.currentTooltip.style.opacity = '0';
        this.currentTooltip.style.transform = 'scale(0.8)';

        setTimeout(() => {
          if (this.currentTooltip && this.currentTooltip.parentNode) {
            this.currentTooltip.parentNode.removeChild(this.currentTooltip);
          }
          this.currentTooltip = null;
        }, 200);
      } else {
        if (this.currentTooltip.parentNode) {
          this.currentTooltip.parentNode.removeChild(this.currentTooltip);
        }
        this.currentTooltip = null;
      }
    }

    // Відновити оригінальні title атрибути
    document.querySelectorAll('[data-original-title]').forEach(el => {
      el.setAttribute('title', el.getAttribute('data-original-title'));
      el.removeAttribute('data-original-title');
    });
  }

  /**
     * Показати tooltip в конкретній позиції
     */
  showAt(text, x, y) {
    const tooltip = this.create(text);

    tooltip.style.top = `${y}px`;
    tooltip.style.left = `${x}px`;

    if (this.enableAnimations) {
      tooltip.style.opacity = '0';
      requestAnimationFrame(() => {
        tooltip.style.transition = 'opacity 0.2s ease';
        tooltip.style.opacity = '1';
      });
    }
  }

  /**
     * Увімкнути/вимкнути tooltips
     */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.hide();
    }
  }

  /**
     * Знищення менеджера
     */
  destroy() {
    this.hide();
  }
}

export default TooltipManager;
