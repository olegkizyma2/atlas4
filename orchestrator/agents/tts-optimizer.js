/**
 * TTS OPTIMIZER AGENT (стаже -3)
 * Системний агент для оптимізації відповідей агентів для TTS озвучки
 *
 * Роль: Скорочення та оптимізація тексту для швидкої озвучки
 * Приоритет: Виконується після кожної відповіді агента перед TTS
 */

import logger from '../utils/logger.js';
import { TTS_CONFIG } from '../../config/global-config.js';

class TTSOptimizer {
  constructor() {
    this.name = 'tts-optimizer';
    this.signature = '[TTS-OPT]';

    // Завантажуємо конфігурацію з нової структури
    this.config = TTS_CONFIG.optimization || {
      enabled: true,
      sentences: { maxSentences: 5, minSentences: 3 },
      length: { maxLength: 500, minLength: 20 },
      fallback: { onError: true, preserveAgentTone: true },
      debug: { enabled: false }
    };

    // Ініціалізуємо властивості з правильної структури
    this.maxSentences = this.config.sentences?.maxSentences || 5;
    this.minSentences = this.config.sentences?.minSentences || 3;

    // Новий функціонал для кастомного ліміту
    this.customCharacterLimit = null; // Кастомний ліміт користувача
  }

  /**
   * Оптимізує текст відповіді агента для TTS
   * @param {string} originalText - Оригінальний текст відповіді
   * @param {string} agentName - Ім'я агента, який створив відповідь
   * @param {Object} options - Додаткові опції
   * @returns {string} - Оптимізований текст для TTS
   */
  async optimizeForTTS(originalText, agentName, options = {}) {
    try {
      // Перевірка чи увімкнена оптимізація
      if (!this.config.enabled) {
        if (this.config.debugMode) {
          logger.info(`${this.signature} Оптимізація відключена у конфігурації`);
        }
        return originalText;
      }

      // КРИТИЧНО ВАЖЛИВА ПЕРЕВІРКА: оптимізація тільки для task mode
      const mode = options.mode || 'chat';
      const chatModeOptimizationEnabled = this.config.modes?.chat?.enabled || false;

      if (mode === 'chat' && !chatModeOptimizationEnabled) {
        if (this.config.debug?.enabled) {
          logger.info(`${this.signature} ПРОПУСКАЄМО оптимізацію для chat режиму (заборонено в конфігурації)`);
        }
        return originalText;
      }

      if (mode === 'task') {
        const taskModeOptimizationEnabled = this.config.modes?.task?.enabled !== false; // За замовчуванням увімкнено
        if (!taskModeOptimizationEnabled) {
          if (this.config.debug?.enabled) {
            logger.info(`${this.signature} Оптимізація відключена для task режиму в конфігурації`);
          }
          return originalText;
        }
      }

      if (this.config.debug?.enabled) {
        logger.info(`${this.signature} ✅ РОЗПОЧИНАЄМО оптимізацію для агента: ${agentName} (режим: ${mode})`);
      }

      // Перевірка кастомного ліміту користувача
      const activeCharacterLimit = this._getActiveCharacterLimit();

      // Перевірка чи потрібне скорочення на основі кастомного або стандартного ліміту
      if (!this._needsOptimizationByLength(originalText, activeCharacterLimit)) {
        if (this.config.debugMode) {
          logger.info(`${this.signature} Текст в межах ліміту (${originalText.length}/${activeCharacterLimit} символів)`);
        }

        // Все ж перевіряємо кількість речень
        if (this.isTextShortEnough(originalText)) {
          return originalText;
        }
      }

      // Розбиваємо на речення
      const sentences = this.splitIntoSentences(originalText);

      // Якщо речень менше максимуму і в межах ліміту символів, повертаємо як є
      if (sentences.length <= this.maxSentences && !this._needsOptimizationByLength(originalText, activeCharacterLimit)) {
        return originalText;
      }

      // Оптимізуємо текст з урахуванням кастомного ліміту
      const optimized = await this.intelligentSummarize(sentences, agentName, {
        ...options,
        characterLimit: activeCharacterLimit
      });

      logger.info(`${this.signature} Текст оптимізовано: ${originalText.length} -> ${optimized.length} символів`);

      return optimized;

    } catch (error) {
      logger.error(`${this.signature} Помилка оптимізації TTS:`, error);
      // У випадку помилки повертаємо перші 3 речення
      return this.getFallbackText(originalText);
    }
  }

  /**
   * Перевіряє чи текст достатньо короткий
   */
  isTextShortEnough(text) {
    const sentences = this.splitIntoSentences(text);
    return sentences.length <= this.maxSentences &&
           text.length <= this.config.maxLength &&
           text.length >= this.config.minLength;
  }

  /**
   * Розбиває текст на речення
   */
  splitIntoSentences(text) {
    if (!text || typeof text !== 'string') return [];

    // Очищаємо від markdown та HTML тегів
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Жирний текст
      .replace(/\*(.*?)\*/g, '$1')     // Курсив
      .replace(/<[^>]*>/g, '')         // HTML теги
      .replace(/```[\s\S]*?```/g, '')  // Блоки коду
      .replace(/`([^`]*)`/g, '$1');    // Інлайн код

    // Розбиваємо на речення більш розумно
    const sentences = cleanText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5) // Фільтруємо занадто короткі фрагменти
      .map(s => {
        // Додаємо крапку тільки якщо речення не закінчується на розділовий знак
        if (!/[.!?]$/.test(s)) {
          return s + '.';
        }
        return s;
      });

    return sentences.filter(s => s.length > 5); // Повторно фільтруємо після додавання крапок
  }

  /**
   * Інтелектуальне скорочення тексту
   */
  async intelligentSummarize(sentences, agentName, options = {}) {
    try {
      // СПРОБУЄМО LLM ТІЛЬКИ ЯКЩО ДОСТУПНИЙ
      const fallbackLLMAvailable = await this.checkFallbackLLMAvailability();

      if (fallbackLLMAvailable) {
        // Імпортуємо промпт для скорочення
        const { default: TTSPrompt } = await import('../../prompts/system/tts_optimization.js');

        // Формуємо промпт
        const prompt = TTSPrompt.generatePrompt(sentences.join(' '), agentName, {
          maxSentences: this.maxSentences,
          minSentences: this.minSentences,
          ...options
        });

        // Викликаємо LLM для оптимізації (використовуємо fallback LLM)
        const { default: fallbackLLM } = await import('../ai/fallback-llm.js');
        const result = await fallbackLLM.chatCompletion([
          { role: 'user', content: prompt }
        ], {
          temperature: 0.3, // Низька температура для стабільності
          max_tokens: 200,
          timeout: 10000,
          ...options
        });

        if (result && result.choices && result.choices[0] && result.choices[0].message) {
          // Очищаємо результат
          const optimized = this.cleanOptimizedText(result.choices[0].message.content);

          // Валідуємо результат
          if (this.validateOptimizedText(optimized)) {
            logger.info(`${this.signature} ✅ LLM оптимізація успішна: ${sentences.join(' ').length} -> ${optimized.length} символів`);
            return optimized;
          } else {
            throw new Error('Невалідний результат LLM оптимізації');
          }
        } else {
          throw new Error('Некоректна відповідь від LLM');
        }
      } else {
        logger.info(`${this.signature} 🔄 LLM недоступний, використовую розумний fallback`);
        throw new Error('LLM недоступний');
      }

    } catch (error) {
      logger.warn(`${this.signature} Помилка LLM оптимізації (${error.message}), використовую розумний fallback`);
      return this.getSmartFallbackText(sentences.join(' '));
    }
  }

  /**
   * Очищає оптимізований текст
   */
  cleanOptimizedText(text) {
    return text
      .trim()
      .replace(/^["']|["']$/g, '') // Прибираємо лапки на початку/кінці
      .replace(/\n+/g, ' ')        // Замінюємо переноси рядків на пробіли
      .replace(/\s+/g, ' ')        // Нормалізуємо пробіли
      .replace(/\s+\./g, '.')      // Прибираємо пробіли перед крапками
      .replace(/\s+,/g, ',')       // Прибираємо пробіли перед комами
      .replace(/\s+!/g, '!')       // Прибираємо пробіли перед знаками оклику
      .replace(/\s+\?/g, '?')      // Прибираємо пробіли перед знаками питання
      .trim();
  }

  /**
   * Валідує оптимізований текст
   */
  validateOptimizedText(text) {
    const sentences = this.splitIntoSentences(text);
    return sentences.length >= this.minSentences &&
           sentences.length <= this.maxSentences &&
           text.length >= this.config.minLength &&
           text.length <= this.config.maxLength;
  }

  /**
   * Fallback метод - повертає перші N речень або скорочує довгий текст
   */
  getFallbackText(originalText) {
    return this.getSmartFallbackText(originalText);
  }

  /**
   * РОЗУМНИЙ FALLBACK - кращий алгоритм без LLM
   */
  getSmartFallbackText(originalText) {
    const sentences = this.splitIntoSentences(originalText);

    if (sentences.length === 0) {
      return originalText.substring(0, 200) + '...';
    }

    const activeLimit = this._getActiveCharacterLimit();
    let result = '';
    let sentenceCount = 0;

    // Стратегія: додаємо речення поки не досягнемо ліміту символів або максимуму речень
    for (const sentence of sentences) {
      const testResult = result ? result + ' ' + sentence : sentence;

      // Перевіряємо чи додавання цього речення не перевищить ліміти
      if (testResult.length <= activeLimit && sentenceCount < this.maxSentences) {
        result = testResult;
        sentenceCount++;
      } else {
        break;
      }
    }

    // Якщо результат все ще пустий або дуже короткий
    if (!result || result.length < 50) {
      result = sentences[0] || originalText.substring(0, activeLimit);
    }

    // Остаточна перевірка ліміту
    if (result.length > activeLimit) {
      result = result.substring(0, activeLimit - 3) + '...';
    }

    // Переконуємося що результат закінчується правильно
    if (!/[.!?]$/.test(result.trim()) && !result.endsWith('...')) {
      result = result.trim() + '.';
    }

    // Очищуємо результат
    result = this.cleanOptimizedText(result);

    logger.info(`${this.signature} 🎯 Розумний fallback: ${originalText.length} -> ${result.length} символів (${sentenceCount} речень)`);

    return result;
  }

  /**
   * Перевіряє доступність fallback LLM
   */
  async checkFallbackLLMAvailability() {
    try {
      const response = await fetch('http://localhost:4000/v1/models', {
        method: 'GET',
        timeout: 3000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Визначає активний ліміт символів (кастомний або з конфігурації)
   */
  _getActiveCharacterLimit() {
    // Пріоритет: кастомний ліміт користувача > глобальна конфігурація > стандартний
    if (this.customCharacterLimit && this.customCharacterLimit > 0) {
      return this.customCharacterLimit;
    }

    if (this.config.characterLimit?.maxCharacters) {
      return this.config.characterLimit.maxCharacters;
    }

    // Fallback до стандартного значення з конфігурації або 800
    return this.config.maxLength || 800;
  }

  /**
   * Перевіряє чи потрібна оптимізація на основі довжини тексту
   */
  _needsOptimizationByLength(text, characterLimit) {
    const textLength = text.length;

    // Якщо текст перевищує ліміт - потрібна оптимізація
    if (textLength > characterLimit) {
      return true;
    }

    // Якщо є поріг попередження і текст його перевищує
    const warningThreshold = this.config.characterLimit?.warningThreshold || characterLimit * 0.8;
    if (textLength > warningThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Встановлює кастомний ліміт символів для користувача
   */
  setUserCharacterLimit(limit) {
    if (typeof limit === 'number' && limit > 0) {
      this.customCharacterLimit = limit;
      logger.info(`${this.signature} Встановлено кастомний ліміт користувача: ${limit} символів`);
      return true;
    } else {
      logger.warn(`${this.signature} Невалідний ліміт символів: ${limit}`);
      return false;
    }
  }

  /**
   * Скидає кастомний ліміт символів до значення за замовчуванням
   */
  resetUserCharacterLimit() {
    const previousLimit = this.customCharacterLimit;
    this.customCharacterLimit = null;
    logger.info(`${this.signature} Скинуто кастомний ліміт користувача (було: ${previousLimit})`);
  }

  /**
   * Отримує поточний активний ліміт символів
   */
  getCurrentCharacterLimit() {
    return this._getActiveCharacterLimit();
  }

  /**
   * Статистика роботи оптимізатора
   */
  getStats() {
    return {
      name: this.name,
      signature: this.signature,
      maxSentences: this.maxSentences,
      minSentences: this.minSentences,
      characterLimit: {
        current: this._getActiveCharacterLimit(),
        custom: this.customCharacterLimit,
        default: this.config.characterLimit?.maxCharacters || this.config.maxLength || 800,
        isCustomSet: this.customCharacterLimit !== null
      },
      status: 'active'
    };
  }
}

export default new TTSOptimizer();
