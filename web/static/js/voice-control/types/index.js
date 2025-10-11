/**
 * @fileoverview TypeScript-style type definitions using JSDoc
 * Централізоване визначення типів для системи голосового управління
 */

/**
 * @typedef {Object} VoiceConfig
 * @property {boolean} enabled - Чи увімкнено голосове управління
 * @property {ActivationConfig} activation - Конфігурація активації
 * @property {RecognitionConfig} recognition - Конфігурація розпізнавання
 * @property {RecordingConfig} recording - Конфігурація запису
 * @property {WhisperConfig} whisper - Конфігурація Whisper API
 * @property {BackgroundFilterConfig} backgroundFilter - Фільтр фонових фраз
 * @property {PostChatConfig} postChat - Конфігурація пост-чат аналізу
 * @property {string[]} stopCommands - Список команд для зупинки
 */

/**
 * @typedef {Object} ActivationConfig
 * @property {string[]} keywords - Ключові слова для активації
 * @property {number} confidence - Поріг впевненості [0-1]
 * @property {string} language - Мова розпізнавання (e.g., 'uk-UA')
 * @property {number} timeout - Таймаут активації (мс)
 */

/**
 * @typedef {Object} RecognitionConfig
 * @property {string} language - Мова розпізнавання
 * @property {boolean} continuous - Безперервне розпізнавання
 * @property {boolean} interimResults - Проміжні результати
 * @property {number} maxAlternatives - Максимум альтернатив
 * @property {number} confidenceThreshold - Поріг впевненості
 * @property {ErrorHandlingConfig} errorHandling - Обробка помилок
 */

/**
 * @typedef {Object} ErrorHandlingConfig
 * @property {number} maxConsecutiveNoSpeech - Максимум послідовних 'no-speech' помилок
 * @property {number} maxNetworkErrors - Максимум мережевих помилок
 * @property {number} networkBackoffBase - Базова затримка при мережевих помилках (мс)
 * @property {number} networkBackoffMax - Максимальна затримка (мс)
 * @property {number} networkExtendedCooldownAfter - Після скількох помилок застосувати розширений кулдаун
 * @property {number} networkExtendedCooldownMultiplier - Множник розширеного кулдауну
 * @property {number} networkExtendedCooldownMax - Максимум розширеного кулдауну (мс)
 */

/**
 * @typedef {Object} RecordingConfig
 * @property {number} keywordMaxMs - Максимум запису після ключового слова (мс)
 * @property {number} shortClickMaxMs - Максимум запису короткого кліку (мс)
 * @property {number} silenceThresholdMs - Поріг тиші для зупинки (мс)
 * @property {number} maxDuration - Максимальна тривалість запису (мс)
 */

/**
 * @typedef {Object} WhisperConfig
 * @property {string} model - Модель Whisper
 * @property {string} language - Мова (ISO код)
 * @property {string} response_format - Формат відповіді
 * @property {number} temperature - Температура [0-1]
 * @property {string} apiUrl - URL API Whisper
 */

/**
 * @typedef {Object} BackgroundFilterConfig
 * @property {boolean} enabled - Чи увімкнено фільтр
 * @property {number} minPhraseLength - Мінімальна довжина фрази (символів)
 * @property {number} maxBackgroundLength - Максимальна довжина фонової фрази
 * @property {number} confidenceThreshold - Поріг впевненості команди
 * @property {string[]} ignoredPhrases - Список фраз для ігнорування
 */

/**
 * @typedef {Object} PostChatConfig
 * @property {boolean} enabled - Чи увімкнено пост-чат аналіз
 * @property {number} windowMs - Вікно аналізу (мс)
 * @property {number} analysisInterval - Інтервал аналізу (мс)
 * @property {number} confidenceThreshold - Поріг впевненості
 * @property {number} vadThreshold - Поріг виявлення голосу
 * @property {number} minSpeechDuration - Мінімальна тривалість мовлення (мс)
 * @property {number} minSilenceMs - Мінімальна тиша (мс)
 */

/**
 * @typedef {Object} ButtonState
 * @property {'idle'|'green_mode'|'blue_mode'|'processing'} state - Стан кнопки
 * @property {string} icon - Іконка стану
 * @property {string} text - Текст стану
 * @property {boolean} disabled - Чи заблокована кнопка
 */

/**
 * @typedef {Object} SpeechRecognitionResult
 * @property {string} text - Розпізнаний текст
 * @property {number} confidence - Впевненість [0-1]
 * @property {boolean} isFinal - Чи фінальний результат
 * @property {Date} timestamp - Час розпізнавання
 * @property {'keyword'|'short-click'|'long-hold'} source - Джерело розпізнавання
 * @property {boolean} filtered - Чи відфільтрований результат
 * @property {string} [reason] - Причина фільтрації
 */

/**
 * @typedef {Object} WhisperTranscriptionResult
 * @property {string} text - Транскрибований текст
 * @property {string} language - Виявлена мова
 * @property {number} duration - Тривалість аудіо (сек)
 * @property {Array<{text: string, start: number, end: number}>} [segments] - Сегменти
 */

/**
 * @typedef {Object} AudioAnalysisResult
 * @property {boolean} speechDetected - Чи виявлено мовлення
 * @property {number} volume - Рівень гучності [0-1]
 * @property {number} confidence - Впевненість виявлення [0-1]
 * @property {number} snr - Співвідношення сигнал/шум
 * @property {Date} timestamp - Час аналізу
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {'no-speech'|'network'|'permission-denied'|'service-not-allowed'|'unknown'} type - Тип помилки
 * @property {string} message - Повідомлення про помилку
 * @property {Date} timestamp - Час помилки
 * @property {number} count - Кількість послідовних помилок цього типу
 * @property {Object} [details] - Додаткові деталі
 */

/**
 * @typedef {Object} ServiceHealth
 * @property {boolean} available - Чи доступний сервіс
 * @property {number} latency - Затримка відповіді (мс)
 * @property {Date} lastCheck - Час останньої перевірки
 * @property {string} [version] - Версія сервісу
 * @property {ErrorInfo} [lastError] - Остання помилка
 */

/**
 * @typedef {Object} VoiceControlMetrics
 * @property {number} recognitionAttempts - Кількість спроб розпізнавання
 * @property {number} successfulRecognitions - Успішні розпізнавання
 * @property {number} filteredResults - Відфільтровані результати
 * @property {number} keywordDetections - Виявлення ключових слів
 * @property {Object<string, number>} errorCounts - Лічильники помилок по типах
 * @property {number} averageConfidence - Середня впевненість розпізнавання
 * @property {Date} sessionStart - Початок сесії
 */

/**
 * @typedef {Object} EventSubscription
 * @property {string} id - Унікальний ідентифікатор підписки
 * @property {string} eventType - Тип події
 * @property {Function} handler - Обробник події
 * @property {Object} [options] - Опції підписки
 */

// Експорт типів для JSDoc
export const Types = {
  // Placeholder для експорту типів
};
