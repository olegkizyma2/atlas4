/**
 * ATLAS Components Index - v4.0
 *
 * Централізований індекс всіх модернізованих компонентів
 * фронтенд системи ATLAS з підтримкою ES6 модулів
 */

// Система логування
export { AnimatedLoggingSystem } from './logging/animated-logging.js';

// 3D модель - GLB Living System v4.0
export { AtlasGLBLivingSystem } from './model3d/atlas-glb-living-system.js';

// TTS і аудіо візуалізація
export { AtlasTTSVisualization } from './tts/atlas-tts-visualization.js';

// Розширений UI контролер
export { AtlasAdvancedUI } from './ui/atlas-advanced-ui.js';

/**
 * Заводська функція для створення повної системи ATLAS UI
 * @param {Object} options - Опції конфігурації
 * @returns {Promise<AtlasAdvancedUI>} Ініціалізована система UI
 */
export async function createAtlasUI(options = {}) {
  const { AtlasAdvancedUI } = await import('./ui/atlas-advanced-ui.js');

  const ui = new AtlasAdvancedUI({
    theme: 'dark-cyber',
    enableAnimations: true,
    enableTTSVisualization: true,
    enable3DController: true,
    loggingEnabled: true,
    enableKeyboardShortcuts: true,
    enableTooltips: true,
    ...options
  });

  // Чекаємо ініціалізацію
  if (!ui.state.isInitialized) {
    await new Promise(resolve => {
      ui.on('ui-initialized', resolve);
    });
  }

  return ui;
}

/**
 * Допоміжні утиліти для роботи з компонентами
 */
export const AtlasUtils = {
  /**
     * Перевіряє підтримку Web Audio API
     * @returns {boolean}
     */
  supportsWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  /**
     * Перевіряє підтримку WebGL для 3D моделей
     * @returns {boolean}
     */
  supportsWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  },

  /**
     * Визначає тип пристрою
     * @returns {string} 'mobile' | 'tablet' | 'desktop'
     */
  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  },

  /**
     * Форматує час для логів
     * @param {Date} date - Дата для форматування
     * @returns {string} Відформатований час
     */
  formatTime(date = new Date()) {
    return date.toLocaleTimeString('uk-UA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  },

  /**
     * Створює унікальний ID
     * @param {string} prefix - Префікс для ID
     * @returns {string} Унікальний ID
     */
  generateId(prefix = 'atlas') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  },

  /**
     * Перевіряє чи елемент видимий на екрані
     * @param {HTMLElement} element - Елемент для перевірки
     * @returns {boolean}
     */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
     * Створює CSS анімацію програмно
     * @param {string} name - Назва анімації
     * @param {Object} keyframes - Ключові кадри
     * @param {string} duration - Тривалість
     */
  createCSSAnimation(name, keyframes, duration = '1s') {
    const styleSheet = document.styleSheets[0];
    const keyframeRule = `@keyframes ${name} { ${keyframes} }`;
    styleSheet.insertRule(keyframeRule, styleSheet.cssRules.length);
  },

  /**
     * Плавно прокручує до елемента
     * @param {HTMLElement} element - Цільовий елемент
     * @param {Object} options - Опції прокрутки
     */
  scrollToElement(element, options = {}) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      ...options
    });
  },

  /**
     * Дебаунс функція для оптимізації викликів
     * @param {Function} func - Функція для дебаунса
     * @param {number} wait - Затримка в мілісекундах
     * @returns {Function} Дебаунсована функція
     */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
     * Тротл функція для обмеження частоти викликів
     * @param {Function} func - Функція для тротлінгу
     * @param {number} limit - Ліміт в мілісекундах
     * @returns {Function} Тротлована функція
     */
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

/**
 * Константи для використання в компонентах
 */
export const AtlasConstants = {
  // Теми
  THEMES: {
    DARK_CYBER: 'dark-cyber',
    LIGHT_TECH: 'light-tech',
    NEO_GREEN: 'neo-green'
  },

  // Рівні логування
  LOG_LEVELS: {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    DEBUG: 'debug',
    SYSTEM: 'system',
    SUCCESS: 'success'
  },

  // Події системи
  EVENTS: {
    UI_INITIALIZED: 'ui-initialized',
    THEME_CHANGED: 'theme-changed',
    MESSAGE_SENT: 'message-sent',
    MESSAGE_RECEIVED: 'message-received',
    TTS_STARTED: 'tts-started',
    TTS_ENDED: 'tts-ended',
    MODEL_INTERACTION: 'model-interaction',
    USER_ACTIVITY: 'user-activity'
  },

  // Типи пристроїв
  DEVICE_TYPES: {
    MOBILE: 'mobile',
    TABLET: 'tablet',
    DESKTOP: 'desktop'
  },

  // Стани анімацій 3D моделі
  ANIMATION_STATES: {
    IDLE: 'idle',
    SPEAKING: 'speaking',
    LISTENING: 'listening',
    THINKING: 'thinking',
    EXCITED: 'excited',
    CALM: 'calm'
  },

  // Емоції для 3D моделі
  EMOTIONS: {
    NEUTRAL: 'neutral',
    HAPPY: 'happy',
    THINKING: 'thinking',
    LISTENING: 'listening',
    SPEAKING: 'speaking',
    ERROR: 'error',
    STARTUP: 'startup'
  }
};

/**
 * Типи для JSDoc (допоміжні)
 */

/**
 * @typedef {Object} AtlasUIConfig
 * @property {string} theme - Назва теми
 * @property {boolean} enableAnimations - Увімкнути анімації
 * @property {boolean} enableTTSVisualization - Увімкнути TTS візуалізацію
 * @property {boolean} enable3DController - Увімкнути 3D контролер
 * @property {boolean} loggingEnabled - Увімкнути логування
 * @property {boolean} enableKeyboardShortcuts - Увімкнути клавіатурні скорочення
 * @property {boolean} enableTooltips - Увімкнути підказки
 */

/**
 * @typedef {Object} ComponentState
 * @property {boolean} isInitialized - Чи ініціалізований компонент
 * @property {string} currentTheme - Поточна тема
 * @property {string} deviceType - Тип пристрою
 * @property {Map} components - Карта компонентів
 */

export default {
  createAtlasUI,
  AtlasUtils,
  AtlasConstants
};
