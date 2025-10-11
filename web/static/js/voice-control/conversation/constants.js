/**
 * @fileoverview Константи для Conversation Mode
 * Централізовані налаштування та magic numbers
 *
 * @version 4.0.0
 * @date 2025-10-11
 */

/**
 * Режими роботи мікрофона
 * @enum {string}
 */
export const ConversationModes = {
    IDLE: 'idle',
    QUICK_SEND: 'quick-send',
    CONVERSATION: 'conversation'
};

/**
 * Таймаути для різних операцій (мілісекунди)
 * @enum {number}
 */
export const Timeouts = {
    // Тривалість довгого натискання для активації conversation mode
    LONG_PRESS: 2000,

    // Максимальна тривалість quick-send запису
    QUICK_SEND_MAX: 30000,

    // Загальний таймаут conversation mode
    CONVERSATION_TOTAL: 120000,

    // Пауза перед початком continuous listening після TTS
    CONTINUOUS_LISTENING_DELAY: 500,

    // Таймаут тиші користувача (повернення до keyword mode)
    USER_SILENCE: 5000,

    // Пауза для природності між фразами
    NATURAL_PAUSE: 500
};

/**
 * CSS класи для UI індикації
 * @enum {string}
 */
export const UIClasses = {
    PRESSING: 'pressing',
    RECORDING: 'recording',
    WAITING_RESPONSE: 'waiting-response',
    CONTINUOUS_LISTENING: 'continuous-listening',
    ATLAS_SPEAKING: 'atlas-speaking',
    CONVERSATION_ACTIVE: 'conversation-active',
    // Режими роботи (візуальна індикація)
    MODE_IDLE: 'mode-idle',
    MODE_QUICK_SEND: 'mode-quick-send',
    MODE_CONVERSATION: 'mode-conversation',
    // Додаткові стани
    PROCESSING: 'processing',
    SPEAKING: 'speaking'
};

/**
 * Події системи
 * @enum {string}
 */
export const ConversationEvents = {
    // Вихідні події (emit)
    START_KEYWORD_DETECTION: 'START_KEYWORD_DETECTION',
    STOP_KEYWORD_DETECTION: 'STOP_KEYWORD_DETECTION',
    CONVERSATION_MODE_ACTIVATED: 'CONVERSATION_MODE_ACTIVATED',
    CONVERSATION_MODE_DEACTIVATED: 'CONVERSATION_MODE_DEACTIVATED',
    CONVERSATION_MODE_QUICK_SEND_START: 'CONVERSATION_MODE_QUICK_SEND_START',
    CONVERSATION_MODE_QUICK_SEND_END: 'CONVERSATION_MODE_QUICK_SEND_END',
    CONVERSATION_RECORDING_START: 'CONVERSATION_RECORDING_START',
    SEND_CHAT_MESSAGE: 'SEND_CHAT_MESSAGE',

    // Вхідні події (listen)
    WHISPER_TRANSCRIPTION_COMPLETED: 'WHISPER_TRANSCRIPTION_COMPLETED',
    KEYWORD_DETECTED: 'KEYWORD_DETECTED',
    TTS_STARTED: 'TTS_STARTED',
    TTS_COMPLETED: 'TTS_COMPLETED'
};

/**
 * Повідомлення для користувача
 * @enum {string}
 */
export const StatusMessages = {
    KEYWORD_LISTENING: 'Слухаю ключове слово...',
    RECORDING: 'Записую...',
    PROCESSING: 'Обробляю...',
    ATLAS_THINKING: 'Atlas думає...',
    ATLAS_RESPONDING: 'відповідає...',
    CONTINUOUS_LISTENING: 'Слухаю... (говоріть або мовчіть 5 сек для виходу)',
    UNCLEAR_PHRASE: 'Не зрозумів, скажіть "Атлас" для продовження...',
    CONVERSATION_ACTIVE: 'Режим розмови активний',
    CONVERSATION_HINT: 'Говоріть після сигналу...',
    QUICK_SEND_RECORDING: 'Записую... (відпустіть для завершення)',
    QUICK_SEND_ACTIVE: 'Режим швидкого запису',
    TIMEOUT: 'Час очікування вичерпано',
    WAITING_RESPONSE: 'Очікую вашої відповіді...',
    SPEAKING: 'Atlas відповідає...'
};

/**
 * Налаштування за замовчуванням
 */
export const DefaultConfig = {
    longPressDuration: Timeouts.LONG_PRESS,
    quickSendMaxDuration: Timeouts.QUICK_SEND_MAX,
    conversationTimeout: Timeouts.CONVERSATION_TOTAL,
    keywordForActivation: 'атлас',
    continuousListeningDelay: Timeouts.CONTINUOUS_LISTENING_DELAY,
    silenceTimeout: Timeouts.USER_SILENCE
};
