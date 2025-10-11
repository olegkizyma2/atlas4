/**
 * @fileoverview Менеджер результатів розпізнавання мови
 * Обробляє та відображає результати Whisper транскрипції з фільтрацією
 */

import { BaseService } from '../core/base-service.js';
import { Events } from '../events/event-manager.js';
import { isBackgroundPhrase, isUserCommand, formatDuration } from '../utils/voice-utils.js';

/**
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Розпізнаний текст
 * @property {'short'|'long'|'keyword'} mode - Режим запису
 * @property {string} language - Мова розпізнавання
 * @property {'success'|'error'|'processing'|'filtered'} status - Статус
 * @property {Date} timestamp - Час запису
 * @property {number} confidence - Впевненість [0-1]
 * @property {number} duration - Тривалість аудіо (мс)
 * @property {boolean} filtered - Чи відфільтрований результат
 * @property {string} [reason] - Причина фільтрації
 */

/**
 * Сервіс для управління результатами розпізнавання мови
 */
export class SpeechResultsService extends BaseService {
  constructor(config = {}) {
    super({
      name: 'SPEECH_RESULTS',
      version: '2.0.0',
      healthCheckInterval: 0, // Відключено для цього сервісу
      ...config
    });

    // DOM елементи
    this.resultsTable = null;
    this.tableBody = null;
    this.clearButton = null;
    this.statsContainer = null;

    // Конфігурація
    this.config = {
      maxResults: config.maxResults || 50,
      autoScroll: config.autoScroll !== false,
      enableFiltering: config.enableFiltering !== false,
      showStats: config.showStats !== false,
      ...config
    };

    // Результати та статистика
    this.results = [];
    this.statistics = {
      total: 0,
      filtered: 0,
      successful: 0,
      failed: 0,
      averageConfidence: 0,
      averageDuration: 0,
      sessionStart: new Date()
    };

    // Callbacks для інтеграції з chat системою
    this.onResultClick = null;
    this.onResultFiltered = null;
  }

  /**
     * Ініціалізація сервісу
     * @returns {Promise<boolean>} - Успішність ініціалізації
     */
  async onInitialize() {
    try {
      // Знаходження DOM елементів
      if (!this.findDOMElements()) {
        this.logger.warn('Results table not found in DOM, service will work in memory-only mode');
      }

      // Налаштування event listeners
      this.setupEventListeners();

      // Підписка на події розпізнавання
      this.subscribeToEvents();

      this.logger.info('Speech results service initialized');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize speech results service', null, error);
      return false;
    }
  }

  /**
     * Знищення сервісу
     * @returns {Promise<void>}
     */
  async onDestroy() {
    this.cleanupEventListeners();
  }

  /**
     * Знаходження DOM елементів
     * @returns {boolean} - Чи знайдено основні елементи
     */
  findDOMElements() {
    // Основна таблиця результатів
    this.resultsTable = document.querySelector('#whisper-results-table');

    if (this.resultsTable) {
      this.tableBody = this.resultsTable.querySelector('tbody');

      if (!this.tableBody) {
        this.logger.warn('Table body not found, creating one');
        this.tableBody = document.createElement('tbody');
        this.resultsTable.appendChild(this.tableBody);
      }
    }

    // Кнопка очищення
    this.clearButton = document.getElementById('clear-whisper-results');

    // Контейнер статистики
    this.statsContainer = document.getElementById('whisper-stats');

    return !!this.resultsTable;
  }

  /**
     * Налаштування event listeners
     */
  setupEventListeners() {
    if (this.clearButton) {
      this.clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAllResults();
      });
    }

    // Делегування кліків по результатах
    if (this.tableBody) {
      this.tableBody.addEventListener('click', (e) => {
        this.handleResultClick(e);
      });
    }
  }

  /**
     * Підписка на події розпізнавання
     */
  subscribeToEvents() {
    // Результати Whisper транскрипції
    this.subscribe(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
      this.handleWhisperResult(event.payload);
    });

    // Результати browser speech recognition
    this.subscribe(Events.SPEECH_RESULT, (event) => {
      this.handleSpeechResult(event.payload);
    });

    // Помилки розпізнавання
    this.subscribe(Events.WHISPER_TRANSCRIPTION_ERROR, (event) => {
      this.handleTranscriptionError(event.payload);
    });

    this.subscribe(Events.SPEECH_ERROR, (event) => {
      this.handleSpeechError(event.payload);
    });
  }

  /**
     * Обробка результату Whisper транскрипції
     * @param {Object} payload - Дані події
     */
  handleWhisperResult(payload) {
    const result = this.createTranscriptionResult({
      text: payload.result.text,
      mode: payload.mode || 'short',
      language: payload.result.language || 'uk',
      status: 'success',
      confidence: payload.result.confidence || 1.0,
      duration: payload.latency || 0,
      audioSize: payload.audioSize
    });

    this.addResult(result);
  }

  /**
     * Обробка результату browser speech recognition
     * @param {Object} payload - Дані події
     */
  handleSpeechResult(payload) {
    const result = this.createTranscriptionResult({
      text: payload.text,
      mode: payload.source === 'keyword_detection' ? 'keyword' : 'short',
      language: 'uk',
      status: 'success',
      confidence: payload.confidence || 0.8,
      duration: 0, // Browser API не надає тривалість
      source: 'browser_speech_api'
    });

    this.addResult(result);
  }

  /**
     * Обробка помилки Whisper транскрипції
     * @param {Object} payload - Дані помилки
     */
  handleTranscriptionError(payload) {
    const result = this.createTranscriptionResult({
      text: `Error: ${payload.error}`,
      mode: 'short',
      language: 'uk',
      status: 'error',
      confidence: 0,
      duration: payload.latency || 0,
      audioSize: payload.audioSize
    });

    this.addResult(result);
  }

  /**
     * Обробка помилки speech recognition
     * @param {Object} payload - Дані помилки
     */
  handleSpeechError(payload) {
    // Ігноруємо no-speech помилки для чистоти інтерфейсу
    if (payload.errorType === 'no-speech') {
      return;
    }

    const result = this.createTranscriptionResult({
      text: `Speech Error: ${payload.errorType}`,
      mode: 'keyword',
      language: 'uk',
      status: 'error',
      confidence: 0,
      duration: 0
    });

    this.addResult(result);
  }

  /**
     * Створення об'єкту результату транскрипції
     * @param {Object} data - Вхідні дані
     * @returns {TranscriptionResult} - Нормалізований результат
     */
  createTranscriptionResult(data) {
    const result = {
      text: data.text || '',
      mode: data.mode || 'short',
      language: data.language || 'uk',
      status: data.status || 'processing',
      timestamp: new Date(),
      confidence: data.confidence || 0,
      duration: data.duration || 0,
      filtered: false,
      reason: null,
      audioSize: data.audioSize || null,
      source: data.source || 'whisper'
    };

    // Фільтрація результатів
    if (this.config.enableFiltering && result.status === 'success') {
      this.applyFiltering(result);
    }

    return result;
  }

  /**
     * Застосування фільтрів до результату
     * @param {TranscriptionResult} result - Результат для фільтрації
     */
  applyFiltering(result) {
    const text = result.text;

    // Перевірка на фонові фрази
    if (isBackgroundPhrase(text)) {
      result.filtered = true;
      result.reason = 'Background phrase detected';
      result.status = 'filtered';
      return;
    }

    // Перевірка занадто коротких результатів з низькою впевненістю
    if (text.length < 3 && result.confidence < 0.7) {
      result.filtered = true;
      result.reason = 'Too short with low confidence';
      result.status = 'filtered';
      return;
    }

    // Перевірка на очевидні помилки розпізнавання
    if (this.isObviousError(text)) {
      result.filtered = true;
      result.reason = 'Obvious recognition error';
      result.status = 'filtered';
      return;
    }

    // Перевірка чи це валідна команда
    if (!isUserCommand(text, result.confidence)) {
      result.filtered = true;
      result.reason = 'Not identified as user command';
      result.status = 'filtered';
    }
  }

  /**
     * Перевірка на очевидні помилки розпізнавання
     * @param {string} text - Текст для перевірки
     * @returns {boolean} - Чи є очевидною помилкою
     */
  isObviousError(text) {
    const errors = [
      // Повторювані символи
      /(.)\1{4,}/,
      // Тільки пробіли/розділові знаки
      /^[\s\.,!?;:-]+$/,
      // Послідовності незрозумілих символів
      /[а-яА-Я]{1}[^а-яА-Я\s]{3,}|[a-zA-Z]{1}[^a-zA-Z\s]{3,}/,
      // Дуже короткі повтори
      /^(.{1,2})\1{3,}$/
    ];

    return errors.some(pattern => pattern.test(text));
  }

  /**
     * Додавання результату до списку
     * @param {TranscriptionResult} result - Результат для додавання
     */
  addResult(result) {
    // Додавання до внутрішнього списку
    this.results.unshift(result); // Нові результати зверху

    // Обмеження розміру списку
    if (this.results.length > this.config.maxResults) {
      this.results = this.results.slice(0, this.config.maxResults);
    }

    // Оновлення статистики
    this.updateStatistics(result);

    // Додавання в DOM
    if (this.tableBody) {
      this.addResultToTable(result);
    }

    // Оновлення статистики в UI
    if (this.config.showStats) {
      this.updateStatsDisplay();
    }

    // Callback для відфільтрованих результатів
    if (result.filtered && this.onResultFiltered) {
      try {
        this.onResultFiltered(result);
      } catch (error) {
        this.logger.warn('Error in result filtered callback', null, error);
      }
    }

    // Емісія події
    this.emit(Events.SPEECH_RESULT_ADDED, {
      result,
      totalResults: this.results.length,
      statistics: this.statistics
    });

    this.logger.debug(`Added result: "${result.text}" (filtered: ${result.filtered})`);
  }

  /**
     * Додавання результату в таблицю DOM
     * @param {TranscriptionResult} result - Результат для відображення
     */
  addResultToTable(result) {
    const row = document.createElement('tr');
    row.className = `result-row status-${result.status}`;
    row.dataset.resultId = Date.now().toString();

    // Форматування часу
    const timeStr = result.timestamp.toLocaleTimeString('uk-UA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Створення контенту рядка
    row.innerHTML = this.createRowHTML(result, timeStr);

    // Додавання обробників подій
    this.setupRowEventHandlers(row, result);

    // Вставка в таблицю (зверху)
    this.tableBody.insertBefore(row, this.tableBody.firstChild);

    // Автоскролл
    if (this.config.autoScroll) {
      this.scrollToResult(row);
    }

    // Обмеження кількості рядків в DOM
    this.limitTableRows();
  }

  /**
     * Створення HTML для рядка результату
     * @param {TranscriptionResult} result - Результат
     * @param {string} timeStr - Відформатований час
     * @returns {string} - HTML рядка
     */
  createRowHTML(result, timeStr) {
    const filteredClass = result.filtered ? 'filtered' : '';
    const clickableClass = result.filtered || result.status === 'error' ? '' : 'clickable';

    const textTitle = result.filtered
      ? `ВІДФІЛЬТРОВАНО: ${result.reason || 'Підозрілий результат'}`
      : result.status === 'error'
        ? 'Помилка розпізнавання'
        : `Клікніть щоб відправити в чат: ${result.text}`;

    const confidencePercent = Math.round(result.confidence * 100);
    const durationStr = result.duration > 0 ? formatDuration(result.duration) : '-';

    return `
            <td class="result-timestamp">${timeStr}</td>
            <td class="result-mode ${result.mode}">${result.mode.toUpperCase()}</td>
            <td class="result-text ${filteredClass} ${clickableClass}" 
                title="${textTitle}" 
                data-text="${result.text}">
                ${this.truncateText(result.text, 50)}
            </td>
            <td class="result-confidence ${this.getConfidenceClass(result.confidence)}">
                ${confidencePercent}%
            </td>
            <td class="result-duration">${durationStr}</td>
            <td class="result-language">${result.language.toUpperCase()}</td>
            <td class="result-status ${result.status}">${result.status.toUpperCase()}</td>
        `;
  }

  /**
     * Налаштування обробників подій для рядка
     * @param {HTMLElement} row - DOM елемент рядка
     * @param {TranscriptionResult} result - Результат
     */
  setupRowEventHandlers(row, result) {
    const textCell = row.querySelector('.result-text');

    if (textCell && !result.filtered && result.status === 'success') {
      textCell.addEventListener('click', () => {
        this.handleResultSelection(result);
      });

      // Hover ефекти
      textCell.addEventListener('mouseenter', () => {
        textCell.style.backgroundColor = 'rgba(0, 255, 136, 0.1)';
      });

      textCell.addEventListener('mouseleave', () => {
        textCell.style.backgroundColor = '';
      });
    } else if (result.filtered) {
      // Різний стиль для відфільтрованих
      textCell.style.color = '#ff6666';
      textCell.style.opacity = '0.7';
      textCell.style.cursor = 'not-allowed';
    }
  }

  /**
     * Обробка вибору результату
     * @param {TranscriptionResult} result - Вибраний результат
     */
  handleResultSelection(result) {
    this.logger.info(`Result selected: "${result.text}"`);

    // Callback для інтеграції з chat системою
    if (this.onResultClick) {
      try {
        this.onResultClick(result.text.trim());
      } catch (error) {
        this.logger.error('Error in result click callback', null, error);
      }
    }

    // Емісія події
    this.emit(Events.SPEECH_RESULT_SELECTED, {
      result,
      text: result.text.trim()
    });
  }

  /**
     * Обробка кліків по таблиці
     * @param {Event} event - Подія кліку
     */
  handleResultClick(event) {
    const textCell = event.target.closest('.result-text.clickable');
    if (!textCell) return;

    const text = textCell.dataset.text;
    if (text && text.trim()) {
      this.handleResultSelection({ text });
    }
  }

  /**
     * Обрізання тексту для відображення
     * @param {string} text - Вихідний текст
     * @param {number} maxLength - Максимальна довжина
     * @returns {string} - Обрізаний текст
     */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
     * Визначення CSS класу для впевненості
     * @param {number} confidence - Впевненість [0-1]
     * @returns {string} - CSS клас
     */
  getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
     * Скролл до результату
     * @param {HTMLElement} row - Рядок результату
     */
  scrollToResult(row) {
    if (this.resultsTable && row) {
      this.resultsTable.scrollTop = 0; // Скролл до верху
    }
  }

  /**
     * Обмеження кількості рядків в таблиці
     */
  limitTableRows() {
    const maxRows = Math.min(this.config.maxResults, 20);

    if (this.tableBody && this.tableBody.children.length > maxRows) {
      // Видалення зайвих рядків знизу
      const rowsToRemove = this.tableBody.children.length - maxRows;

      for (let i = 0; i < rowsToRemove; i++) {
        const lastRow = this.tableBody.lastElementChild;
        if (lastRow) {
          lastRow.remove();
        }
      }
    }
  }

  /**
     * Оновлення статистики
     * @param {TranscriptionResult} result - Новий результат
     */
  updateStatistics(result) {
    const stats = this.statistics;

    stats.total++;

    if (result.filtered) {
      stats.filtered++;
    } else if (result.status === 'success') {
      stats.successful++;

      // Оновлення середньої впевненості
      const totalConfidence = stats.averageConfidence * (stats.successful - 1) + result.confidence;
      stats.averageConfidence = totalConfidence / stats.successful;

      // Оновлення середньої тривалості
      if (result.duration > 0) {
        const totalDuration = stats.averageDuration * (stats.successful - 1) + result.duration;
        stats.averageDuration = totalDuration / stats.successful;
      }
    } else if (result.status === 'error') {
      stats.failed++;
    }
  }

  /**
     * Оновлення відображення статистики
     */
  updateStatsDisplay() {
    if (!this.statsContainer) return;

    const stats = this.statistics;
    const successRate = stats.total > 0 ? (stats.successful / stats.total * 100).toFixed(1) : 0;
    const filterRate = stats.total > 0 ? (stats.filtered / stats.total * 100).toFixed(1) : 0;

    this.statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Всього:</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Успішних:</span>
                    <span class="stat-value success">${stats.successful}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Відфільтровано:</span>
                    <span class="stat-value filtered">${stats.filtered}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Помилок:</span>
                    <span class="stat-value error">${stats.failed}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Успішність:</span>
                    <span class="stat-value">${successRate}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Середня впевненість:</span>
                    <span class="stat-value">${Math.round(stats.averageConfidence * 100)}%</span>
                </div>
            </div>
        `;
  }

  /**
     * Очищення всіх результатів
     */
  clearAllResults() {
    this.logger.info('Clearing all speech results');

    // Очищення внутрішнього списку
    this.results = [];

    // Скидання статистики
    this.statistics = {
      total: 0,
      filtered: 0,
      successful: 0,
      failed: 0,
      averageConfidence: 0,
      averageDuration: 0,
      sessionStart: new Date()
    };

    // Очищення DOM
    if (this.tableBody) {
      this.tableBody.innerHTML = '';
    }

    // Оновлення статистики
    if (this.config.showStats) {
      this.updateStatsDisplay();
    }

    // Емісія події
    this.emit(Events.SPEECH_RESULTS_CLEARED, {
      timestamp: new Date()
    });
  }

  /**
     * Встановлення callback для кліків по результатах
     * @param {Function} callback - Функція callback
     */
  setResultClickCallback(callback) {
    this.onResultClick = callback;
  }

  /**
     * Встановлення callback для відфільтрованих результатів
     * @param {Function} callback - Функція callback
     */
  setResultFilteredCallback(callback) {
    this.onResultFiltered = callback;
  }

  /**
     * Отримання статистики
     * @returns {Object} - Поточна статистика
     */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
     * Отримання всіх результатів
     * @param {Object} [filter] - Фільтр результатів
     * @returns {TranscriptionResult[]} - Масив результатів
     */
  getResults(filter = {}) {
    let results = [...this.results];

    if (filter.status) {
      results = results.filter(r => r.status === filter.status);
    }

    if (filter.mode) {
      results = results.filter(r => r.mode === filter.mode);
    }

    if (filter.filtered !== undefined) {
      results = results.filter(r => r.filtered === filter.filtered);
    }

    return results;
  }

  /**
     * Очищення event listeners
     */
  cleanupEventListeners() {
    if (this.clearButton) {
      this.clearButton.removeEventListener('click', this.clearAllResults);
    }
  }
}

export default SpeechResultsService;
