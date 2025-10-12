/**
 * @fileoverview Утиліти для роботи з голосовим управлінням
 * Допоміжні функції, фільтри та валідатори
 */

import { VOICE_CONFIG } from '../core/config.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('VOICE_UTILS');

/**
 * Перевірка чи є фраза фоновою (потрібно ігнорувати)
 * @param {string} text - Текст для перевірки
 * @param {Object} [config] - Конфігурація фільтра
 * @returns {boolean} - Чи є фраза фоновою
 */
export function isBackgroundPhrase(text, config = VOICE_CONFIG.backgroundFilter) {
  if (!text || typeof text !== 'string') {
    return true;
  }

  if (!config.enabled) {
    return false;
  }

  const cleanText = text.toLowerCase().trim();

  // Занадто коротка фраза
  if (cleanText.length < config.minPhraseLength) {
    return true;
  }

  // ✅ ФІКС (12.10.2025 - 16:25): Розширено фільтрацію фонових фраз
  // Проблема: "Дякую", "Добре", "Так" з YouTube проходили фільтр
  // Рішення: Додано YouTube endings + короткі фонові фрази
  
  // ФІЛЬТР 1: YouTube/video endings та credits
  const youtubeEndings = [
    'дякую за перегляд',
    'дякую за увагу',
    'підписуйся на канал',
    'ставте лайк',
    'субтитрувальниця',
    'оля шор',
    'субтитр',
    'автор проєкту',
    'кінець',
    'the end',
    'ending',
    'credits',
    'аплодирують',
    'до зустрічі',
    'до побачення',
    'коментуйте',
    'підписуйтесь'
  ];

  for (const ending of youtubeEndings) {
    if (cleanText.includes(ending)) {
      logger.debug(`🎬 YouTube ending detected: "${text}" (contains: "${ending}")`);
      return true;
    }
  }

  // Перевірка на ігноровані фрази
  for (const ignoredPhrase of config.ignoredPhrases) {
    if (cleanText.includes(ignoredPhrase.toLowerCase())) {
      logger.debug(`Background phrase detected: "${text}" (contains: "${ignoredPhrase}")`);
      return true;
    }
  }

  // Коротка фраза з поширеними словами
  if (cleanText.length <= config.maxBackgroundLength) {
    const commonWords = [
      'так', 'ні', 'добре', 'гаразд', 'окей', 'ок', 'угу', 'ага',
      'хм', 'ем', 'ну', 'от', 'це', 'то', 'а', 'і', 'або', 'але',
      'дякую', 'спасибі', 'будь ласка', 'вибачте', 'пробачте',
      'да', 'нет', 'хорошо', 'yes', 'no', 'okay'
    ];

    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 2 && words.every(word => commonWords.includes(word))) {
      logger.debug(`Background phrase detected: "${text}" (common words only)`);
      return true;
    }
  }

  return false;
}

/**
 * Перевірка чи є текст командою користувача
 * @param {string} text - Текст для перевірки
 * @param {number} [confidence=1.0] - Впевненість розпізнавання [0-1]
 * @param {Object} [config] - Конфігурація фільтра
 * @returns {boolean} - Чи є текст командою
 */
export function isUserCommand(text, confidence = 1.0, config = VOICE_CONFIG.backgroundFilter) {
  if (isBackgroundPhrase(text, config)) {
    return false;
  }

  // Низька впевненість для короткого тексту
  if (confidence < config.confidenceThreshold && text.length < 20) {
    logger.debug(`Low confidence command rejected: "${text}" (confidence: ${confidence})`);
    return false;
  }

  // Індикатори команд
  const commandIndicators = [
    // Питальні слова
    'що', 'як', 'де', 'коли', 'чому', 'хто', 'скільки', 'який', 'яка', 'яке', 'які',
    'what', 'how', 'where', 'when', 'why', 'who', 'which',
    // Дієслова команд
    'зроби', 'створи', 'напиши', 'покажи', 'знайди', 'відкрий', 'закрий', 'запусти',
    'do', 'make', 'create', 'write', 'show', 'find', 'open', 'close', 'run',
    // Допоміжні фрази
    'допоможи', 'поясни', 'розкажи', 'скажи', 'можеш', 'хочу', 'потрібно', 'треба',
    'help', 'explain', 'tell', 'say', 'can', 'want', 'need'
  ];

  const lowerText = text.toLowerCase();
  const hasCommandIndicator = commandIndicators.some(indicator =>
    lowerText.includes(indicator));

  if (hasCommandIndicator) {
    logger.debug(`Command indicator found: "${text}"`);
    return true;
  }

  // Довгий текст ймовірно команда
  if (text.length > 30) {
    logger.debug(`Long text treated as command: "${text}"`);
    return true;
  }

  // Висока впевненість
  const isCommand = confidence >= config.confidenceThreshold;
  if (isCommand) {
    logger.debug(`High confidence command: "${text}" (confidence: ${confidence})`);
  }

  return isCommand;
}

/**
 * Перевірка чи є текст стоп-командою
 * @param {string} text - Текст для перевірки
 * @param {string[]} [stopCommands] - Список стоп-команд
 * @returns {boolean} - Чи є текст стоп-командою
 */
export function isStopCommand(text, stopCommands = VOICE_CONFIG.stopCommands) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase().trim();

  return stopCommands.some(stopCmd =>
    lowerText.includes(stopCmd.toLowerCase()));
}

/**
 * Перевірка чи містить текст ключове слово активації
 * @param {string} text - Текст для перевірки
 * @param {string[]} [keywords] - Ключові слова
 * @returns {boolean} - Чи містить ключове слово
 */
export function containsActivationKeyword(text, keywords = VOICE_CONFIG.activation.keywords) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const normalizedText = normalizeText(text);
  logger.debug(`[KEYWORD] 🔍 Checking text: "${text}"`);

  // Перевірка на точне співпадіння з keywords
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      logger.info(`[KEYWORD] ✅ Exact match found: "${keyword}" in "${text}"`);
      return true;
    }
  }

  // Fuzzy matching для варіацій "атлас" - ВИПРАВЛЕНО (11.10.2025 - 21:05)
  // ВИДАЛЕНО НЕБЕЗПЕЧНІ КОРОТКІ ВАРІАЦІЇ: 'лас', 'ласс', 'тлас', 'тлус', 'тлаз'
  // Причина: "будь ласка" розпізнавалось як "атлас"
  const atlasVariations = [
    // Українські варіації (мінімум 5 символів)
    'атлас', 'атлаз', 'атлус', 'атлес', 'атлос', 'атляс',
    'отлас', 'отлаз', 'отлус', 'адлас', 'адлаз',
    'атлась', 'атласе', 'атласо', 'атлаша',
    // Англійські варіації (мінімум 5 символів)
    'atlas', 'atlus', 'atlass', 'atlaz', 'atlos',
    'adlas', 'adlus', 'atlash', 'atlase',
    // Фонетичні варіації (мінімум 5 символів)
    'ітлас', 'ітлус', 'етлас', 'етлус',
    'атлаас', 'атлаш', 'атлач'
  ];

  for (const variation of atlasVariations) {
    const normalizedVariation = normalizeText(variation);
    if (normalizedText.includes(normalizedVariation)) {
      logger.info(`[KEYWORD] ✅ Fuzzy match found: "${variation}" in "${text}"`);
      return true;
    }
  }

  logger.debug(`[KEYWORD] ❌ No keyword match in: "${text}"`);
  return false;
}

/**
 * Нормалізація тексту для порівняння
 * @param {string} text - Текст для нормалізації
 * @returns {string} - Нормалізований текст
 */
export function normalizeText(text) {
  return text.toLowerCase()
    .replace(/['".,!?;:()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Витяг чистого тексту команди (видалення ключових слів активації)
 * @param {string} text - Повний текст
 * @param {string[]} [keywords] - Ключові слова для видалення
 * @returns {string} - Очищений текст команди
 */
export function extractCommand(text, keywords = VOICE_CONFIG.activation.keywords) {
  if (!text) return '';

  let cleanText = text.trim();

  // Видаляємо ключові слова активації з початку
  for (const keyword of keywords) {
    const regex = new RegExp(`^\\s*${keyword}\\s*,?\\s*`, 'i');
    cleanText = cleanText.replace(regex, '').trim();
  }

  return cleanText;
}

/**
 * Корекція варіацій слова "Атлас" у розпізнаному тексті
 * Виправляє поширені похибки розпізнавання Whisper
 * ADDED (12.10.2025): Frontend-шар корекції для покращення точності
 *
 * @param {string} text - Розпізнаний текст
 * @returns {string} - Текст з виправленим "Атлас"
 */
export function correctAtlasWord(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Словник корекції "Атлас" (66+ варіантів)
  const atlasCorrections = {
    // Українські варіанти
    'атлаз': 'Атлас', 'атлус': 'Атлас', 'атлес': 'Атлас', 'артлас': 'Атлас',
    'атлось': 'Атлас', 'атланс': 'Атлас', 'адлас': 'Атлас', 'отлас': 'Атлас',
    'етлас': 'Атлас', 'атлась': 'Атлас', 'атласе': 'Атлас', 'атласо': 'Атлас',
    'атляс': 'Атлас', 'атлаша': 'Атлас', 'ітлас': 'Атлас', 'ітлус': 'Атлас',
    'атлаас': 'Атлас', 'атлаш': 'Атлас', 'атлач': 'Атлас', 'тлас': 'Атлас',
    'тлус': 'Атлас', 'тлаз': 'Атлас',

    // Англійські варіанти
    'atlas': 'Атлас', 'atlass': 'Атлас', 'atlus': 'Атлас', 'adlas': 'Атлас',
    'atles': 'Атлас', 'atlantis': 'Атлас', 'atlaz': 'Атлас', 'atlos': 'Атлас',
    'adlus': 'Атлас', 'atlash': 'Атлас', 'atlase': 'Атлас',

    // Розділені варіанти
    'а т л а с': 'Атлас', 'а-т-л-а-с': 'Атлас', 'атл ас': 'Атлас',
    'ат лас': 'Атлас', 'атла с': 'Атлас',

    // З акцентами
    'а́тлас': 'Атлас', 'атла́с': 'Атлас'
  };

  let correctedText = text;

  // Пошук та заміна кожного варіанта
  for (const [incorrect, correct] of Object.entries(atlasCorrections)) {
    // Word boundary regex для точного співпадіння слів
    const pattern = new RegExp(`\\b${incorrect}\\b`, 'gi');
    correctedText = correctedText.replace(pattern, correct);
  }

  // Додаткові регулярні вирази для складних випадків
  const additionalPatterns = [
    // Варіації з префіксами "ат-"
    { pattern: /\b(ат[тл][ао]?[лзс]{1,2})\b/gi, replacement: 'Атлас' },
    // Розділені пробілами/дефісами (а-т-л-а-с, а т л а с)
    { pattern: /\b(а[\s-]?т[\s-]?л[\s-]?а[\s-]?с)\b/gi, replacement: 'Атлас' },
    // Варіації з "от-", "ет-", "ад-"
    { pattern: /\b([оеа][тд]л[ауо][зс])\b/gi, replacement: 'Атлас' }
  ];

  for (const { pattern, replacement } of additionalPatterns) {
    correctedText = correctedText.replace(pattern, replacement);
  }

  // Логування якщо була корекція
  if (correctedText !== text) {
    logger.info(`[ATLAS_CORRECTION] ✅ Corrected: "${text}" → "${correctedText}"`);
  }

  return correctedText;
}

/**
 * Перевірка чи потрібно повертатись до keyword mode
 * Використовується в conversation mode для визначення невиразних фраз
 *
 * @param {string} text - Розпізнаний текст
 * @param {number} [confidence=1.0] - Впевненість Whisper [0-1]
 * @param {Object} [_options] - Додаткові опції (reserved for future use)
 * @returns {boolean} - true = повернутись до keyword mode, false = відправити в chat
 *
 * @example
 * shouldReturnToKeywordMode("хм", 0.5) // true - невиразна фраза
 * shouldReturnToKeywordMode("відкрий калькулятор", 0.95) // false - чітка команда
 */
export function shouldReturnToKeywordMode(text, confidence = 1.0, _options = {}) {
  if (!text || typeof text !== 'string') {
    logger.debug('[KEYWORD_CHECK] Empty text - return to keyword mode');
    return true;
  }

  const cleanText = text.trim();
  const textLower = cleanText.toLowerCase();

  // 1. ДУЖЕ КОРОТКА ФРАЗА (1-3 символи) = невиразна
  if (cleanText.length <= 3) {
    logger.debug(`[KEYWORD_CHECK] Too short (${cleanText.length} chars): "${text}" - return to keyword mode`);
    return true;
  }

  // 2. НИЗЬКА ВПЕВНЕНІСТЬ + КОРОТКА (< 10 символів)
  if (confidence < 0.6 && cleanText.length < 10) {
    logger.debug(`[KEYWORD_CHECK] Low confidence (${confidence}) + short text: "${text}" - return to keyword mode`);
    return true;
  }

  // 3. ФОНОВІ ФРАЗИ (через isBackgroundPhrase)
  if (isBackgroundPhrase(text)) {
    logger.debug(`[KEYWORD_CHECK] Background phrase: "${text}" - return to keyword mode`);
    return true;
  }

  // 4. ТІЛЬКИ ВИГУКИ / КОРОТКІ СЛОВА
  const meaninglessWords = [
    'хм', 'ем', 'е', 'м', 'ну', 'от', 'це', 'то', 'а', 'і', 'та',
    'угу', 'ага', 'так', 'ні', 'ок', 'окей',
    'um', 'uh', 'eh', 'mm', 'hmm', 'er', 'ah'
  ];

  const words = textLower.split(/\s+/).filter(w => w.length > 0);

  // Якщо ВСІ слова meaningless = невиразна фраза
  if (words.length > 0 && words.every(word => meaninglessWords.includes(word))) {
    logger.debug(`[KEYWORD_CHECK] Only meaningless words: "${text}" - return to keyword mode`);
    return true;
  }

  // 5. ПЕРЕВІРКА НА НАЯВНІСТЬ СМИСЛОВИХ ІНДИКАТОРІВ
  const meaningfulIndicators = [
    // Питальні слова
    'що', 'як', 'де', 'коли', 'чому', 'хто', 'скільки', 'який',
    'what', 'how', 'where', 'when', 'why', 'who', 'which',
    // Дієслова
    'зроби', 'створи', 'покажи', 'знайди', 'відкрий', 'закрий', 'запусти',
    'розкажи', 'поясни', 'допоможи', 'скажи', 'напиши',
    'do', 'make', 'show', 'find', 'open', 'close', 'run', 'tell', 'help',
    // Іменники/контекст
    'калькулятор', 'файл', 'програма', 'додаток', 'сайт', 'браузер',
    'calculator', 'file', 'program', 'app', 'website', 'browser'
  ];

  const hasMeaningfulContent = meaningfulIndicators.some(indicator =>
    textLower.includes(indicator)
  );

  if (hasMeaningfulContent) {
    logger.info(`[KEYWORD_CHECK] ✅ Meaningful content found: "${text}" - send to chat`);
    return false; // Відправити в chat
  }

  // 6. ДОВГИЙ ТЕКСТ (>15 символів) з СЕРЕДНЬОЮ впевненістю (>0.5)
  if (cleanText.length > 15 && confidence > 0.5) {
    logger.info(`[KEYWORD_CHECK] ✅ Long text with decent confidence: "${text}" (${confidence}) - send to chat`);
    return false; // Відправити в chat
  }

  // 7. ЗА ЗАМОВЧУВАННЯМ: коротка незрозуміла фраза = повернутись до keyword
  logger.debug(`[KEYWORD_CHECK] Unclear phrase: "${text}" (confidence: ${confidence}) - return to keyword mode`);
  return true;
}

/**
 * Валідація конфігурації мікрофона
 * @param {Object} constraints - MediaStreamConstraints
 * @returns {boolean} - Чи валідна конфігурація
 */
export function validateAudioConstraints(constraints) {
  if (!constraints || typeof constraints !== 'object') {
    return false;
  }

  const audio = constraints.audio;
  if (!audio || typeof audio !== 'object') {
    return false;
  }

  // Перевірка обов'язкових параметрів
  const required = ['sampleRate', 'channelCount'];
  return required.every(param => param in audio);
}

/**
 * Створення оптимальних constraint'ів для аудіо запису
 * @param {Object} [overrides] - Перевизначення параметрів
 * @returns {MediaStreamConstraints} - Налаштування для getUserMedia
 */
export function createAudioConstraints(overrides = {}) {
  return {
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...overrides
    },
    video: false
  };
}

/**
 * Перевірка підтримки Web API в браузері
 * @returns {Object} - Статус підтримки різних API
 */
export function checkBrowserSupport() {
  const support = {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    mediaRecorder: !!(window.MediaRecorder),
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    fetch: !!(window.fetch)
  };

  support.voiceControl = support.getUserMedia &&
    support.speechRecognition &&
    support.mediaRecorder &&
    support.audioContext;

  logger.debug('Browser support check:', support);
  return support;
}

/**
 * Обчислення якості аудіо сигналу
 * @param {Float32Array} audioData - Аудіо дані
 * @returns {Object} - Метрики якості
 */
export function analyzeAudioQuality(audioData) {
  if (!audioData || audioData.length === 0) {
    return { rms: 0, peak: 0, snr: 0, quality: 'poor' };
  }

  // RMS (Root Mean Square) - середня потужність
  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < audioData.length; i++) {
    const sample = audioData[i];
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const rms = Math.sqrt(sumSquares / audioData.length);

  // Оцінка SNR (приблизна)
  const noiseFloor = 0.01; // Припустимий рівень шуму
  const snr = rms > 0 ? 20 * Math.log10(rms / noiseFloor) : 0;

  // Визначення якості
  let quality = 'poor';
  if (snr > 20) quality = 'excellent';
  else if (snr > 15) quality = 'good';
  else if (snr > 10) quality = 'fair';

  return {
    rms: Math.round(rms * 1000) / 1000,
    peak: Math.round(peak * 1000) / 1000,
    snr: Math.round(snr * 10) / 10,
    quality
  };
}

/**
 * Throttle функція (обмеження частоти викликів)
 * @param {Function} func - Функція для throttle
 * @param {number} limit - Мінімальний інтервал між викликами
 * @returns {Function} - Throttled функція
 */
export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce функція (відкладений виклик)
 * @param {Function} func - Функція для debounce
 * @param {number} delay - Затримка в мілісекундах
 * @returns {Function} - Debounced функція
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Форматування тривалості у зручному вигляді
 * @param {number} milliseconds - Тривалість в мілісекундах
 * @returns {string} - Відформатована тривалість
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}мс`;
  }

  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}с`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}хв ${remainingSeconds}с` : `${minutes}хв`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}год ${remainingMinutes}хв`;
}

/**
 * Генерація унікального ідентифікатора
 * @param {string} [prefix=''] - Префікс для ID
 * @returns {string} - Унікальний ідентифікатор
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Безпечний парсинг JSON з fallback
 * @param {string} jsonString - JSON рядок
 * @param {*} [fallback=null] - Значення за замовчуванням
 * @returns {*} - Розпарсений об'єкт або fallback
 */
export function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('Failed to parse JSON', { jsonString, error: error.message });
    return fallback;
  }
}

/**
 * Створення відкладеного Promise
 * @param {number} ms - Затримка в мілісекундах
 * @param {*} [value] - Значення для resolve
 * @returns {Promise} - Promise що resolve через затримку
 */
export function delay(ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

/**
 * Retry wrapper з експоненційним backoff
 * @param {Function} operation - Операція для повторення
 * @param {Object} [options] - Опції retry
 * @param {number} [options.maxRetries=3] - Максимальна кількість спроб
 * @param {number} [options.initialDelay=1000] - Початкова затримка
 * @param {number} [options.maxDelay=30000] - Максимальна затримка
 * @param {Function} [options.shouldRetry] - Функція перевірки чи потрібно retry
 * @returns {Promise} - Результат операції
 */
export async function retry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        break;
      }

      const delayTime = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      logger.debug(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delayTime}ms`);
      await delay(delayTime);
    }
  }

  throw lastError;
}

export default {
  isBackgroundPhrase,
  isUserCommand,
  isStopCommand,
  containsActivationKeyword,
  normalizeText,
  extractCommand,
  validateAudioConstraints,
  createAudioConstraints,
  checkBrowserSupport,
  analyzeAudioQuality,
  throttle,
  debounce,
  formatDuration,
  generateId,
  safeJsonParse,
  delay,
  retry
};
