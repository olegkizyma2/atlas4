/**
 * @fileoverview Централізована система логування для voice-control модулів
 * Забезпечує консистентне логування з підтримкою рівнів та категорій
 */

/**
 * @typedef {Object} LogEntry
 * @property {Date} timestamp - Час події
 * @property {'debug'|'info'|'warn'|'error'} level - Рівень логування
 * @property {string} category - Категорія (e.g., 'VOICE_CONTROL', 'WHISPER')
 * @property {string} message - Повідомлення
 * @property {*} [data] - Додаткові дані
 * @property {Error} [error] - Помилка (якщо є)
 */

/**
 * Рівні логування у порядку важливості
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Кольори для консолі (браузер)
 */
const CONSOLE_COLORS = {
  debug: '#6c757d',
  info: '#17a2b8',
  warn: '#ffc107',
  error: '#dc3545',
  category: '#28a745'
};

export class VoiceControlLogger {
  constructor() {
    this.entries = [];
    this.maxEntries = 1000;
    this.level = 'info';
    this.enabled = true;
    this.listeners = new Set();

    // Метрики
    this.metrics = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      total: 0
    };
  }

  /**
     * Встановлення рівня логування
     * @param {'debug'|'info'|'warn'|'error'} level - Рівень логування
     */
  setLevel(level) {
    if (level in LOG_LEVELS) {
      this.level = level;
    }
  }

  /**
     * Увімкнути/вимкнути логування
     * @param {boolean} enabled - Чи увімкнено логування
     */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
     * Встановлення максимальної кількості записів
     * @param {number} max - Максимальна кількість
     */
  setMaxEntries(max) {
    this.maxEntries = max;
    this._trimEntries();
  }

  /**
     * Додавання слухача для log подій
     * @param {Function} listener - Функція-слухач
     */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
     * Видалення слухача
     * @param {Function} listener - Функція-слухач
     */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
     * Внутрішній метод логування
     * @param {'debug'|'info'|'warn'|'error'} level - Рівень
     * @param {string} category - Категорія
     * @param {string} message - Повідомлення
     * @param {*} [data] - Додаткові дані
     * @param {Error} [error] - Помилка
     */
  _log(level, category, message, data, error) {
    if (!this.enabled) return;

    // Перевірка рівня
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const entry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      error
    };

    // Додавання до внутрішнього лога
    this.entries.push(entry);
    this._trimEntries();

    // Оновлення метрик
    this.metrics[level]++;
    this.metrics.total++;

    // Вивід в консоль браузера
    this._logToConsole(entry);

    // Повідомлення слухачів
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Logger listener error:', err);
      }
    });
  }

  /**
     * Вивід в консоль з кольорами та форматуванням
     * @param {LogEntry} entry - Запис лога
     */
  _logToConsole(entry) {
    const time = entry.timestamp.toLocaleTimeString('uk-UA');
    const categoryColor = CONSOLE_COLORS.category;
    const levelColor = CONSOLE_COLORS[entry.level];

    const prefix = `%c[${time}] %c[${entry.category}] %c[${entry.level.toUpperCase()}]`;
    const styles = [
      'color: #6c757d',
      `color: ${categoryColor}; font-weight: bold`,
      `color: ${levelColor}; font-weight: bold`
    ];

    const args = [prefix, ...styles, entry.message];

    // Додаємо дані якщо є
    if (entry.data !== undefined) {
      args.push('\nData:', entry.data);
    }

    // Додаємо помилку якщо є
    if (entry.error) {
      args.push('\nError:', entry.error);
    }

    // Вибираємо метод консолі
    const consoleMethod = entry.level === 'error' ? 'error' :
      entry.level === 'warn' ? 'warn' :
        'log';

    console[consoleMethod](...args);
  }

  /**
     * Обрізання старих записів
     */
  _trimEntries() {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
     * Отримання всіх записів
     * @param {Object} [filters] - Фільтри
     * @param {string} [filters.category] - Фільтр по категорії
     * @param {string} [filters.level] - Фільтр по рівню
     * @param {Date} [filters.since] - Записи після дати
     * @returns {LogEntry[]} - Відфільтровані записи
     */
  getEntries(filters = {}) {
    let entries = [...this.entries];

    if (filters.category) {
      entries = entries.filter(e => e.category === filters.category);
    }

    if (filters.level) {
      const minLevel = LOG_LEVELS[filters.level];
      entries = entries.filter(e => LOG_LEVELS[e.level] >= minLevel);
    }

    if (filters.since) {
      entries = entries.filter(e => e.timestamp >= filters.since);
    }

    return entries;
  }

  /**
     * Очищення всіх записів
     */
  clear() {
    this.entries = [];
    this.metrics = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      total: 0
    };
  }

  /**
     * Отримання метрик
     */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
     * Експорт логів у форматі JSON
     * @param {Object} [filters] - Фільтри (аналогічно getEntries)
     * @returns {string} - JSON рядок
     */
  exportLogs(filters) {
    const entries = this.getEntries(filters);
    return JSON.stringify({
      exported: new Date().toISOString(),
      count: entries.length,
      entries: entries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined
      }))
    }, null, 2);
  }
}

/**
 * Клас для створення категоризованих логерів
 */
export class CategoryLogger {
  constructor(category) {
    this.category = category;
  }

  category(subCategory) {
    const nextCategory = subCategory ? `${this.category}:${subCategory}` : this.category;
    return new CategoryLogger(nextCategory);
  }

  debug(message, data, error) {
    globalLogger._log('debug', this.category, message, data, error);
  }

  info(message, data, error) {
    globalLogger._log('info', this.category, message, data, error);
  }

  warn(message, data, error) {
    globalLogger._log('warn', this.category, message, data, error);
  }

  error(message, data, error) {
    globalLogger._log('error', this.category, message, data, error);
  }

  /**
     * Логування помилки з автоматичним парсингом Error об'єкта
     * @param {string} message - Повідомлення
     * @param {Error} error - Помилка
     * @param {*} [data] - Додаткові дані
     */
  logError(message, error, data) {
    this.error(message, data, error);
  }

  /**
     * Логування з вимірюванням часу виконання
     * @param {string} operation - Назва операції
     * @param {Function} fn - Функція для виконання
     * @returns {*} - Результат функції
     */
  async time(operation, fn) {
    const start = performance.now();
    this.debug(`Starting ${operation}`);

    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.debug(`Completed ${operation} in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`Failed ${operation} after ${duration}ms`, null, error);
      throw error;
    }
  }
}

// Глобальний інстанс логера
const globalLogger = new VoiceControlLogger();

// Початкова конфігурація з змінних середовища або localStorage
try {
  const savedLevel = localStorage.getItem('voiceControlLogLevel');
  if (savedLevel && savedLevel in LOG_LEVELS) {
    globalLogger.setLevel(savedLevel);
  }
} catch (e) {
  // Ігноруємо помилки доступу до localStorage
}

/**
 * Фабрика для створення категоризованих логерів
 * @param {string} category - Категорія логера
 * @returns {CategoryLogger} - Логер для категорії
 */
export function createLogger(category) {
  return new CategoryLogger(category);
}

/**
 * Глобальний логер (для налаштувань)
 */
export const logger = {
  constructor: CategoryLogger,
  category: (name) => createLogger(name),
  setLevel: (level) => globalLogger.setLevel(level),
  setEnabled: (enabled) => globalLogger.setEnabled(enabled),
  setMaxEntries: (max) => globalLogger.setMaxEntries(max),
  addListener: (listener) => globalLogger.addListener(listener),
  removeListener: (listener) => globalLogger.removeListener(listener),
  getEntries: (filters) => globalLogger.getEntries(filters),
  clear: () => globalLogger.clear(),
  getMetrics: () => globalLogger.getMetrics(),
  exportLogs: (filters) => globalLogger.exportLogs(filters)
};

// Експорт для зручності
export default logger;
