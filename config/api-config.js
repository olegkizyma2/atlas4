/**
 * ATLAS API CONFIGURATION
 * Мережеві налаштування, API endpoints та сервіси системи ATLAS
 *
 * Версія: 4.0.0
 * Автор: Atlas System
 * Дата створення: 2025-10-09
 */

// === МЕРЕЖЕВІ НАЛАШТУВАННЯ ===
export const NETWORK_CONFIG = {
  // Основні сервіси
  services: {
    orchestrator: {
      host: 'localhost',
      port: 5101,
      protocol: 'http',
      endpoint: '/api/chat/stream',
      timeout: 60000,
      retries: 3
    },
    frontend: {
      host: 'localhost',
      port: 5001,
      protocol: 'http',
      staticPath: '/web/static',
      timeout: 30000
    },
    tts: {
      host: 'localhost',
      port: 3001,
      protocol: 'http',
      endpoint: '/tts',
      timeout: 30000,
      retries: 4
    },
    whisper: {
      host: 'localhost',
      port: 3002,
      protocol: 'http',
      endpoint: '/transcribe',
      timeout: 30000,
      retries: 3
    },
    goose: {
      host: 'localhost',
      port: 3000,
      protocol: 'http',
      endpoint: '/api/chat',
      wsEndpoint: '/ws',
      timeout: 30000,
      retries: 2
    },
    recovery: {
      host: 'localhost',
      port: 5102,
      protocol: 'http',
      endpoint: '/health',
      timeout: 15000
    }
  },

  // WebSocket конфігурація
  websocket: {
    pingInterval: 30000,
    pongTimeout: 5000,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000
  },

  // HTTP конфігурація
  http: {
    maxConnections: 100,
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
    requestTimeout: 120000
  }
};

// === API ENDPOINTS (автоматичне генерування) ===
export const API_ENDPOINTS = Object.entries(NETWORK_CONFIG.services).reduce((acc, [name, config]) => {
  acc[name] = `${config.protocol}://${config.host}:${config.port}`;
  return acc;
}, {});

// === TTS КОНФІГУРАЦІЯ ===
export const TTS_CONFIG = {
  enabled: process.env.ENABLE_TTS !== 'false',
  mode: process.env.TTS_MODE || 'real', // 'real' | 'mock'

  // Голоси - Атлас завжди використовує mykyta
  defaultVoice: 'mykyta',
  supportedVoices: ['mykyta', 'dmytro', 'tetiana', 'oleksa', 'lada'],
  fallbackVoices: ['mykyta', 'dmytro', 'oleksa', 'lada', 'tetiana'],

  // Налаштування якості
  quality: {
    sampleRate: 22050,
    bitRate: 128,
    format: 'mp3',
    speed: 1.0,
    pitch: 0,
    volume: 1.0
  },

  // Тайм-аути та повтори
  maxRetries: 4,
  retryDelay: 1000,
  timeout: 30000,

  // НОВІ НАЛАШТУВАННЯ ДЛЯ БЕЗПЕРЕРВНОГО ОЗВУЧЕННЯ
  chunking: {
    enabled: true,
    maxChunkSize: 500,        // Максимальний розмір частини в символах
    minChunkSize: 100,        // Мінімальний розмір частини
    sentenceSplit: true,      // Розділяти по реченнях
    overlap: 20,              // Перекриття між частинами в символах
    preserveWords: true,      // Не розділяти слова
    continuousPlayback: true  // Безперервне відтворення частин
  },

  // Черга озвучення
  queue: {
    enabled: true,
    maxQueueSize: 50,         // Максимум елементів у черзі
    parallelProcessing: 3,    // Одночасно обробляти 3 частини
    autoStart: true,          // Автоматично починати обробку
    priorityByAgent: {        // Пріоритет по агентах
      'atlas': 1,
      'tetyana': 2,
      'grisha': 3,
      'system': 4
    }
  },

  // Режими роботи
  modes: {
    quick: {
      quality: 'medium',
      timeout: 15000,
      cache: true,
      chunking: { maxChunkSize: 300 }
    },
    standard: {
      quality: 'high',
      timeout: 30000,
      cache: true,
      chunking: { maxChunkSize: 500 }
    },
    premium: {
      quality: 'highest',
      timeout: 60000,
      cache: false
    }
  },

  // Кешування
  cache: {
    enabled: true,
    maxSize: '500MB',
    ttl: 86400000, // 24 години
    path: './cache/tts'
  },

  // TTS Оптимізація (стаже -3) - автоматичне скорочення довгих текстів
  optimization: {
    enabled: true,

    // Налаштування ліміту символів (кастомно налаштовуються користувачем)
    characterLimit: {
      enabled: true,
      maxCharacters: 800,        // Максимум символів перед скороченням (користувач може змінити)
      warningThreshold: 600,     // Попередження про довгий текст
      hardLimit: 1500,           // Жорсткий ліміт - обрізання навіть без LLM
      customUserLimit: null      // Кастомне значення користувача (якщо встановлено)
    },

    // Налаштування речень
    sentences: {
      maxSentences: 5,
      minSentences: 3,
      preferredSentences: 4      // Оптимальна кількість речень для TTS
    },

    // Загальні налаштування довжини
    length: {
      maxLength: 500,            // Цільова максимальна довжина після скорочення
      minLength: 20,             // Мінімальна довжина (менше = помилка)
      targetLength: 300          // Цільова довжина для оптимізації
    },

    // Поведінка при помилках
    fallback: {
      onError: true,             // Використовувати fallback при помилках LLM
      preserveAgentTone: true,   // Зберігати тон агента
      simpleMode: false          // Простий режим (тільки обрізання без LLM)
    },

    // Налаштування для різних режимів
    modes: {
      chat: {
        enabled: false,         // В chat режимі скорочення ВІДКЛЮЧЕНО
        maxCharacters: 1200     // Але якщо увімкнути - ліміт більший
      },
      task: {
        enabled: true,          // В task режимі завжди увімкнено
        maxCharacters: 800,     // Стандартний ліміт
        aggressive: false       // Агресивне скорочення
      }
    },

    // Дебаг та моніторинг
    debug: {
      enabled: true,
      logOriginalLength: true,
      logOptimizedLength: true,
      logTimeTaken: true
    }
  }
};

// === ГОЛОСОВЕ УПРАВЛІННЯ ===
export const VOICE_CONFIG = {
  enabled: true,

  // Ключові слова активації
  activation: {
    keywords: [
      // === ОСНОВНІ ВАРІАНТИ ===
      'атлас',
      'atlas',

      // === УКРАЇНСЬКІ ФОНЕТИЧНІ ВАРІАЦІЇ ===
      'атлаз', 'атлус', 'атлес', 'атлос', 'атляс',
      'отлас', 'отлаз', 'отлус', 'адлас', 'адлаз',
      'атлась', 'атласе', 'атласо', 'атлаша',

      // === АНГЛІЙСЬКІ ВАРІАЦІЇ ===
      'atlus', 'atlass', 'atlaz', 'atlos',
      'adlas', 'adlus', 'atlash', 'atlase',

      // === ФОНЕТИЧНІ СХОЖІ ЗВУЧАННЯ ===
      'ітлас', 'ітлус', 'етлас', 'етлус',
      'атлаас', 'атлаш', 'атлач',

      // === З НАГОЛОСАМИ ===
      'а́тлас', 'атла́с',

      // === СКОРОЧЕННЯ ===
      'тлас', 'тлус', 'тлаз',

      // === З ПРЕФІКСАМИ/УВАГОЮ ===
      'ей атлас', 'гей атлас', 'слухай', 'слухай атлас',
      'слухай', 'слухай атлас', 'гей', 'ей',

      // === ПОВНЕ ІМ'Я ===
      'олег миколайович',
      'олеже миколайовичу'
    ],
    confidence: 0.5,  // Знижено з 0.7 для кращого розпізнавання
    language: 'uk-UA',
    timeout: 15000
  },

  // Стоп-команди
  stopCommands: [
    'стоп', 'зупинись', 'зупини', 'пауза', 'почекай', 'підожди', 'замри',
    'зачекай', 'стій', 'припини', 'halt', 'freeze', 'wait', 'stop',
    'enough', 'досить', 'перервись', 'cancel', 'відміна', 'скасувати'
  ],

  // Налаштування розпізнавання
  recognition: {
    language: 'uk-UA',
    continuous: true,
    interimResults: true,
    maxAlternatives: 3,
    confidenceThreshold: 0.5
  },

  // Вікна запису
  recording: {
    keywordMaxMs: 15000,
    shortClickMaxMs: 15000,
    silenceThresholdMs: 3000,
    maxDuration: 60000
  },

  // Whisper конфігурація
  whisper: {
    model: 'whisper-1',
    language: 'uk',
    response_format: 'json',
    temperature: 0.2,
    apiUrl: process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions'
  },

  // Фільтрація фонових фраз
  backgroundFilter: {
    enabled: true,
    minPhraseLength: 5,
    maxBackgroundLength: 50,
    confidenceThreshold: 0.6,
    // РОЗШИРЕНО (PR #3): 17 фраз для фільтрації фонових відео
    ignoredPhrases: [
      'дякую за перегляд', 'дякую за увагу', 'субтитрувальниця',
      'оля шор', 'дякую!', 'будь ласка', 'до побачення',
      'підписуйтесь', 'ставте лайки', 'коментуйте',
      // Нові додані фрази (PR #3):
      'до зустрічі', 'підписуйся на канал', 'ставте лайк',
      'лайкніть', 'до наступного відео', 'вказуйте коментарях',
      'пишіть коментарях'
    ]
  },

  // Пост-чат аналіз
  postChat: {
    enabled: true,
    windowMs: 8000,
    analysisInterval: 100,
    confidenceThreshold: 0.7,
    vadThreshold: 0.01,
    minSpeechDuration: 500,
    minSilenceMs: 3000
  }
};

// === УТИЛІТИ ДЛЯ РОБОТИ З API ===

/**
 * Отримання URL для сервісу
 */
export function getApiUrl(serviceName, endpoint = '') {
  const service = NETWORK_CONFIG.services[serviceName];
  if (!service) {
    throw new Error(`Service "${serviceName}" not found in configuration`);
  }

  const baseUrl = `${service.protocol}://${service.host}:${service.port}`;
  if (endpoint) {
    return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }
  return baseUrl;
}

/**
 * Отримання конфігурації сервісу
 */
export function getServiceConfig(serviceName) {
  const service = NETWORK_CONFIG.services[serviceName];
  if (!service) {
    throw new Error(`Service "${serviceName}" not found in configuration`);
  }
  return { ...service };
}

/**
 * Перевірка доступності сервісу
 */
export async function checkServiceHealth(serviceName) {
  const service = NETWORK_CONFIG.services[serviceName];
  if (!service) return false;

  try {
    const url = getApiUrl(serviceName, service.endpoint || '/health');
    const response = await fetch(url, {
      method: 'GET',
      timeout: service.timeout || 5000
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Генерування конфігурації для клієнта
 */
export function generateClientConfig() {
  return {
    api: API_ENDPOINTS,
    websocket: NETWORK_CONFIG.websocket,
    tts: {
      enabled: TTS_CONFIG.enabled,
      supportedVoices: TTS_CONFIG.supportedVoices,
      defaultVoice: TTS_CONFIG.defaultVoice
    },
    voice: {
      enabled: VOICE_CONFIG.enabled,
      activation: VOICE_CONFIG.activation,
      stopCommands: VOICE_CONFIG.stopCommands
    }
  };
}

// Експорт за замовчуванням
export default {
  NETWORK_CONFIG,
  API_ENDPOINTS,
  TTS_CONFIG,
  VOICE_CONFIG,
  getApiUrl,
  getServiceConfig,
  checkServiceHealth,
  generateClientConfig
};
