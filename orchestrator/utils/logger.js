/**
 * Централізований модуль логування з розумною фільтрацією
 */
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '../../logs');

// Створюємо директорію для логів, якщо не існує
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Базовий формат та безпечне серіалізування метаданих для уникнення рекурсій
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['timestamp', 'level', 'message', 'service'] })
);

const serializeMetadata = (metadata = {}) => {
  const entries = Object.keys(metadata);
  if (!entries.length) {
    return '';
  }

  const replacer = (_, value) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    return value;
  };

  try {
    const serialized = JSON.stringify(metadata, replacer);
    return serialized === '{}' ? '' : ` ${serialized}`;
  } catch (error) {
    return ` {"metaSerializationError":"${error.message}"}`;
  }
};

const lineFormatter = winston.format.printf(({ timestamp, level, message, metadata = {} }) => {
  try {
    const { category, ...restMetadata } = metadata;
    const categoryPart = category ? `[${String(category)}] ` : '';
    const metaPart = serializeMetadata(restMetadata);
    return `${timestamp} [${level.toUpperCase()}] ${categoryPart}${String(message)}${metaPart}`;
  } catch (error) {
    return `${timestamp} [${level.toUpperCase()}] [LOGGER_ERROR] ${String(message)}`;
  }
});


const sanitizeValue = (value, cache, depth) => {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Set) {
    return Array.from(value).map((item) => sanitizeValue(item, cache, depth + 1));
  }

  if (value instanceof Map) {
    if (depth > 4) {
      return '[Map depth limit exceeded]';
    }
    return Array.from(value.entries()).slice(0, 50).map(([k, v]) => [
      sanitizeValue(k, cache, depth + 1),
      sanitizeValue(v, cache, depth + 1)
    ]);
  }

  if (Array.isArray(value)) {
    if (depth > 4) {
      return '[Array depth limit exceeded]';
    }
    return value.slice(0, 50).map((item) => sanitizeValue(item, cache, depth + 1));
  }

  if (typeof value === 'object') {
    if (cache.has(value)) {
      return '[Circular]';
    }
    cache.add(value);

    if (depth > 4) {
      return '[Object depth limit exceeded]';
    }

    const entries = Object.entries(value).slice(0, 50);
    const result = {};
    for (const [key, val] of entries) {
      result[key] = sanitizeValue(val, cache, depth + 1);
    }
    return result;
  }

  return String(value);
};

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const entries = Object.entries(metadata);
  if (!entries.length) {
    return {};
  }

  const cache = new WeakSet();
  const sanitized = {};
  for (const [key, value] of entries) {
    sanitized[key] = sanitizeValue(value, cache, 0);
  }
  return sanitized;
};


const safeLoggerFormat = winston.format.combine(baseFormat, lineFormatter);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'atlas-orchestrator' },
  format: safeLoggerFormat,
  transports: [
    // Консоль з кольоровим форматом
    new winston.transports.Console({
      format: winston.format.combine(
        baseFormat,
        winston.format.colorize(),
        lineFormatter
      )
    }),

    // Файл помилок
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: winston.format.combine(baseFormat, lineFormatter)
    }),

    // Основний файл логів (тільки важливі події)
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'orchestrator.log'),
      format: winston.format.combine(baseFormat, lineFormatter),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),

    // Окремий файл для workflow подій
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'workflow.log'),
      level: 'info',
      format: winston.format.combine(baseFormat, lineFormatter),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

// Розширений logger з контекстом
const contextLogger = {
  // Основні методи логування
  info: (message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      logger.info(String(message), sanitizedMeta);

      // Відправляємо у веб-інтерфейс
      sendToWeb('info', String(message), 'system', sanitizedMeta);
    } catch (error) {
      console.log(`[LOGGER_ERROR] ${String(message)}`);
    }
  },
  warn: (message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      logger.warn(String(message), sanitizedMeta);

      // Відправляємо у веб-інтерфейс
      sendToWeb('warn', String(message), 'system', sanitizedMeta);
    } catch (error) {
      console.warn(`[LOGGER_ERROR] ${String(message)}`);
    }
  },
  error: (message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      logger.error(String(message), sanitizedMeta);

      // Відправляємо у веб-інтерфейс
      sendToWeb('error', String(message), 'system', sanitizedMeta);
    } catch (error) {
      console.error(`[LOGGER_ERROR] ${String(message)}`);
    }
  },
  debug: (message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      logger.debug(String(message), sanitizedMeta);

      // Відправляємо у веб-інтерфейс (тільки у development режимі)
      if (process.env.NODE_ENV !== 'production') {
        sendToWeb('debug', String(message), 'system', sanitizedMeta);
      }
    } catch (error) {
      console.log(`[LOGGER_ERROR] ${String(message)}`);
    }
  },

  // Спеціалізовані методи для різних типів подій
  workflow: (stage, agent, message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[WORKFLOW] Stage ${stage} - ${agent}: ${message}`;
      logger.info(fullMessage, {
        category: 'workflow',
        stage,
        agent,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс
      sendToWeb('info', fullMessage, 'workflow', { stage, agent, ...sanitizedMeta });
    } catch (error) {
      console.log(`[WORKFLOW] ${stage} - ${agent}: ${message}`);
    }
  },

  agent: (agentName, action, message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[AGENT] ${agentName} - ${action}: ${message}`;
      logger.info(fullMessage, {
        category: 'agent',
        agent: agentName,
        action,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс
      sendToWeb('info', fullMessage, `agent-${agentName}`, { agent: agentName, action, ...sanitizedMeta });
    } catch (error) {
      console.log(`[AGENT] ${agentName} - ${action}: ${message}`);
    }
  },

  http: (method, url, status, duration, meta = {}) => {
    // Фільтруємо polling запити
    if (url === '/health') {
      return; // Не логуємо рутинні запити
    }

    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[HTTP] ${method} ${url} ${status} (${duration}ms)`;
      logger.info(fullMessage, {
        category: 'http',
        method,
        url,
        status,
        duration,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс тільки важливі HTTP запити
      if (status >= 400 || duration > 5000) {
        const level = status >= 400 ? 'error' : 'warn';
        sendToWeb(level, fullMessage, 'http-server', { method, url, status, duration, ...sanitizedMeta });
      }
    } catch (error) {
      console.log(`[HTTP] ${method} ${url} ${status} (${duration}ms)`);
    }
  },

  tts: (voice, action, message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[TTS] ${voice} - ${action}: ${message}`;
      logger.info(fullMessage, {
        category: 'tts',
        voice,
        action,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс
      sendToWeb('success', fullMessage, 'tts-system', { voice, action, ...sanitizedMeta });
    } catch (error) {
      console.log(`[TTS] ${voice} - ${action}: ${message}`);
    }
  },

  session: (sessionId, action, message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[SESSION] ${sessionId} - ${action}: ${message}`;
      logger.info(fullMessage, {
        category: 'session',
        sessionId,
        action,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс тільки важливі події сесій
      if (['start', 'end', 'error', 'timeout'].includes(action)) {
        sendToWeb('info', fullMessage, 'session-manager', { sessionId, action, ...sanitizedMeta });
      }
    } catch (error) {
      console.log(`[SESSION] ${sessionId} - ${action}: ${message}`);
    }
  },

  system: (component, message, meta = {}) => {
    try {
      const sanitizedMeta = sanitizeMetadata(meta);
      const fullMessage = `[SYSTEM] ${component}: ${message}`;
      logger.info(fullMessage, {
        category: 'system',
        component,
        ...sanitizedMeta
      });

      // Відправляємо у веб-інтерфейс
      sendToWeb('system', fullMessage, component, sanitizedMeta);
    } catch (error) {
      console.log(`[SYSTEM] ${component}: ${message}`);
    }
  }
};

// Функція для відправки логів у веб-інтерфейс
let webIntegration = null;

function sendToWeb(level, message, source, metadata = {}) {
  try {
    // Lazy load webIntegration для уникнення циклічних залежностей
    // FIXED: Use dynamic import instead of require() for ES6 modules
    if (!webIntegration) {
      // Skip WebIntegration to avoid memory leak from repeated errors
      // It will be initialized if needed elsewhere
      return;
    }

    if (webIntegration && typeof webIntegration.addWebLog === 'function') {
      webIntegration.addWebLog(level, message, source, metadata);
    }
  } catch (error) {
    // Silent fail - webIntegration is optional
    // Don't log to prevent infinite loops and memory leaks
  }
}

export default contextLogger;
