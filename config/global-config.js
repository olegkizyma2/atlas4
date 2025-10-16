/**
 * ATLAS GLOBAL CONFIGURATION SYSTEM
 *
 * Централізована система управління конфігураціями для всього ATLAS workflow
 * Всі сервіси та компоненти мають використовувати цю конфігурацію
 *
 * Версія: 4.0.0
 * Автор: Atlas System
 * Дата створення: 2025-10-09 (Рефакторинг)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Імпорт модульних конфігурацій
import { AGENTS, getAgentConfig, getAgentsByRole, getAgentsByPriority, hasAgent, validateAgentConfig } from './agents-config.js';
import { WORKFLOW_STAGES, WORKFLOW_CONDITIONS, WORKFLOW_CONFIG, getWorkflowStage, getNextStage, checkStageCondition, validateStage, getStagesForAgent } from './workflow-config.js';
import { NETWORK_CONFIG, API_ENDPOINTS, TTS_CONFIG, VOICE_CONFIG, getApiUrl, getServiceConfig, checkServiceHealth, generateClientConfig } from './api-config.js';
import promptRegistry from '../prompts/prompt-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === СИСТЕМНІ НАЛАШТУВАННЯ ===
export const SYSTEM_INFO = {
  version: '4.0.0',
  name: 'ATLAS WORKFLOW SYSTEM',
  description: 'Багатоагентна система з голосовим управлінням та TTS',
  build: process.env.BUILD_NUMBER || 'dev',
  environment: process.env.NODE_ENV || 'development',
  configVersion: '2025-10-10'
};

// === КОРИСТУВАЧ ===
export const USER_CONFIG = {
  name: 'Олег Миколайович',
  title: 'Творець',
  role: 'creator_admin',
  formal_address: 'Олег Миколайович',
  casual_address: 'творче',
  description: 'Творець системи ATLAS, божественний наставник',
  permissions: ['all'],
  preferences: {
    formal_communication: true,
    detailed_responses: true,
    technical_depth: 'advanced'
  }
};

// === AI MODELS CONFIGURATION ===
// Конфігурація моделей для різних стадій (система використовує LLM API на порту 4000)
export const AI_MODEL_CONFIG = {
  // API endpoint для system stages
  apiEndpoint: 'http://localhost:4000/v1/chat/completions',

  // Моделі для різних типів завдань (ТІЛЬКИ доступні через localhost:4000!)
  models: {
    // Класифікація та швидкі рішення
    // PATTERN-BASED: Clear action patterns with examples
    // OPTIMIZED 14.10.2025 - ministral-3b замість gpt-4o-mini (45 req/min vs 35 req/min)
    classification: {
      model: 'mistral-ai/ministral-3b',
      temperature: 0.1,  // Нижча T для точної класифікації
      max_tokens: 50,
      description: 'ministral-3b для швидкої класифікації (45 req/min)'
    },

    // Чат та розмова
    // OPTIMIZED 14.10.2025 - ministral-3b замість gpt-4o-mini
    chat: {
      model: 'mistral-ai/ministral-3b',
      temperature: 0.7,
      max_tokens: 500,
      description: 'ministral-3b для природних розмов (45 req/min)'
    },

    // Аналіз та reasoning
    analysis: {
      model: 'openai/o1-mini',  // FIXED 14.10.2025 - o1-mini для reasoning (доступний!)
      temperature: 0.3,
      max_tokens: 1000,
      description: 'OpenAI o1-mini для якісного аналізу та reasoning'
    },

    // TTS оптимізація
    tts_optimization: {
      model: 'mistral-ai/ministral-3b',
      temperature: 0.2,
      max_tokens: 300,
      description: 'ministral-3b для оптимізації тексту для озвучки (45 req/min)'
    }
  },

  // Відповідність стадій до моделей
  stageModels: {
    'stage0_mode_selection': 'classification',
    'stage0_chat': 'chat',
    'stage-2_post_chat_analysis': 'analysis',
    'stage-3_tts_optimization': 'tts_optimization'
  },

  // Fallback модель якщо не знайдено специфічну
  defaultModel: 'classification'
};

// === MCP MODELS CONFIGURATION (NEW 14.10.2025) ===
// Окрема конфігурація моделей для кожного MCP стейджу з ENV підтримкою
// Детально: docs/MCP_MODEL_SELECTION_GUIDE.md
export const MCP_MODEL_CONFIG = {
  // API endpoint
  apiEndpoint: 'http://localhost:4000/v1/chat/completions',

  // Моделі для кожного MCP stage (читаємо з ENV для гнучкості)
  stages: {
    // Stage 0: Mode Selection (task vs chat)
    mode_selection: {
      get model() { return process.env.MCP_MODEL_MODE_SELECTION || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_MODE_SELECTION || '0.1'); },
      max_tokens: 50,
      description: 'Бінарна класифікація - швидка легка модель (45 req/min)'
    },

    // Stage 0.5: Backend Selection (deprecated - now MCP-only)
    backend_selection: {
      get model() { return process.env.MCP_MODEL_BACKEND_SELECTION || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_BACKEND_SELECTION || '0.1'); },
      max_tokens: 50,
      description: 'Keyword-based routing - швидко (45 req/min)'
    },

    // Stage 1-MCP: Atlas TODO Planning
    todo_planning: {
      get model() { return process.env.MCP_MODEL_TODO_PLANNING || 'mistral-ai/mistral-small-2503'; },  // OPTIMIZED 14.10.2025 - mistral-small для швидкості (40 req/min)
      get temperature() { return parseFloat(process.env.MCP_TEMP_TODO_PLANNING || '0.3'); },
      max_tokens: 4000,  // FIXED 14.10.2025 - Збільшено з 2000 до 4000 для складних запитів з багатьма пунктами
      description: 'Critical planning - mistral-small для балансу швидкості та якості'
    },

    // Stage 2.1-MCP: Tetyana Plan Tools
    // OPTIMIZED 15.10.2025 - mistral-small-2503 для ЧИСТОГО JSON без markdown (40 req/min)
    // FIXED 16.10.2025 - Збільшено max_tokens з 1200 до 2500 для складних багатокрокових планів
    // Причина зміни: phi-4 та nemo генерували ```json wrappers, mistral-small - чистий JSON
    plan_tools: {
      get model() { return process.env.MCP_MODEL_PLAN_TOOLS || 'mistral-ai/mistral-small-2503'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_PLAN_TOOLS || '0.15'); },  // Нижче для точності
      max_tokens: 2500,  // FIXED 16.10.2025 - Збільшено з 1200 для складних планів (було обрізання JSON)
      description: 'Tool matching - mistral-small для ЧИСТОГО JSON output (40 req/min)'
    },

    // Stage 2.3-MCP: Grisha Verify Item
    // OPTIMIZED 15.10.2025 - mistral-small-2503 для ЧИСТОГО JSON без markdown (40 req/min)
    verify_item: {
      get model() { return process.env.MCP_MODEL_VERIFY_ITEM || 'mistral-ai/mistral-small-2503'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_VERIFY_ITEM || '0.15'); },  // Нижче для точності
      max_tokens: 500,  // Збільшено для детальної верифікації
      description: 'Верифікація з ЧИСТИМ JSON output (40 req/min)'
    },

    // Stage 3-MCP: Atlas Adjust TODO
    // FIXED 14.10.2025 - mistral-nemo для великого context (128K)
    adjust_todo: {
      get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'mistral-ai/mistral-nemo'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_ADJUST_TODO || '0.3'); },
      max_tokens: 1000,
      description: 'Корекція TODO з повним контекстом (128K context)'
    },

    // Stage 8-MCP: Final Summary
    final_summary: {
      get model() { return process.env.MCP_MODEL_FINAL_SUMMARY || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_FINAL_SUMMARY || '0.5'); },
      max_tokens: 500,
      description: 'User-facing summary - природна мова (45 req/min)'
    }
  },

  // Helper: Отримати конфігурацію для stage
  getStageConfig(stageName) {
    return this.stages[stageName] || this.stages.plan_tools; // Fallback на mid-tier model
  }
};

// === AI BACKEND CONFIGURATION (NEW 13.10.2025) ===
// MCP Dynamic TODO System Configuration
// SIMPLIFIED: MCP-only, no Goose fallback
export const AI_BACKEND_CONFIG = {
  // Always MCP mode
  mode: 'mcp',
  
  // No fallback - pure MCP
  primary: 'mcp',
  fallback: null,
  disableFallback: true,

  // Retry налаштування для MCP
  retry: {
    maxAttempts: 3,
    timeoutMs: 30000,
    exponentialBackoff: true
  },

  // MCP Provider конфігурація
  providers: {
    // Прямі MCP сервери
    mcp: {
      enabled: true,
      type: 'direct',

      // Direct MCP server connections
      servers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {
            ALLOWED_DIRECTORIES: '/Users,/tmp,/Desktop,/Applications'
          }
        },

        playwright: {
          command: 'npx',
          args: ['-y', '@executeautomation/playwright-mcp-server'],
          env: {
            HEADLESS: 'true'
          }
        },

        shell: {
          command: 'npx',
          args: ['-y', 'super-shell-mcp'],
          env: {
            SHELL: process.env.SHELL || '/bin/zsh'
          }
        },

        applescript: {
          command: 'npx',
          args: ['-y', '@peakmojo/applescript-mcp'],
          env: {}
        },

        // DISABLED: GitHub MCP server - зависає при ініціалізації
        // TODO: Try alternative package when available
        /*
        github: {
          command: 'npx',
          args: ['-y', '@wipiano/github-mcp-lightweight'],
          env: {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
          }
        },
        */

        // NOTE 14.10.2025: @cyanheads/git-mcp-server часто не повертає tools list (timeout)
        // Сервер ініціалізується успішно, але tools/list request не відповідає вчасно
        // Це не критично - git операції можна виконувати через shell MCP server
        git: {
          command: 'npx',
          args: ['-y', '@cyanheads/git-mcp-server'],
          env: {
            GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'ATLAS',
            GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'atlas@example.com'
          }
        },

        memory: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: {}
        }
      },

      // LLM для MCP mode (використовується для reasoning)
      llm: {
        provider: 'openai',
        apiEndpoint: 'http://localhost:4000/v1/chat/completions',
        model: 'mistral-ai/ministral-3b',  // OPTIMIZED 14.10.2025
        temperature: 0.3
      },

      // Коли використовувати MCP
      useFor: [
        'file_operations',      // filesystem
        'browser_automation',   // playwright
        'screenshots',          // playwright
        'web_scraping',         // playwright
        'terminal_commands',    // shell
        'macos_automation',     // applescript
        'github_api',           // github
        'git_operations',       // git
        'memory_storage'        // memory
      ]
    }
  },

  // MCP keyword detection (for routing optimization)
  routing: {
    // Якщо prompt містить ці ключові слова → підказка що це MCP завдання
    mcpKeywords: [
      // Файли
      'створи файл', 'create file', 'save file',
      'файл', 'file', 'directory', 'папка',

      // Браузер
      'відкрий браузер', 'open browser',
      'скріншот', 'screenshot',
      'web scraping', 'scrape',

      // Terminal
      'виконай команду', 'run command', 'terminal',
      'npm', 'brew', 'git clone', 'install',

      // macOS
      'відкрий програму', 'open app', 'launch',
      'applescript', 'finder', 'safari', 'chrome',

      // GitHub
      'github issue', 'pull request', 'pr',
      'create issue', 'list issues',

      // Git
      'git commit', 'git push', 'git pull',
      'branch', 'merge', 'checkout',

      // Memory
      'запамʼятай', 'remember', 'save context',
      'що ти пам\'ятаєш', 'recall'
    ]
  }
};

/**
 * Отримати конфігурацію моделі для конкретної стадії
 * @param {string} stageName - Назва стадії (напр. 'stage0_mode_selection')
 * @returns {object} Конфігурація моделі
 */
export function getModelForStage(stageName) {
  const modelType = AI_MODEL_CONFIG.stageModels[stageName] || AI_MODEL_CONFIG.defaultModel;
  const modelConfig = AI_MODEL_CONFIG.models[modelType];

  if (!modelConfig) {
    throw new Error(`Model configuration not found for type: ${modelType}`);
  }

  return {
    endpoint: AI_MODEL_CONFIG.apiEndpoint,
    ...modelConfig
  };
}

/**
 * Отримати список доступних моделей за типом
 * @param {string} type - Тип моделі (classification, chat, analysis, tts_optimization)
 * @returns {object} Конфігурація моделі
 */
export function getModelByType(type) {
  return AI_MODEL_CONFIG.models[type];
}

// === ЕКСПОРТ МОДУЛЬНИХ КОНФІГУРАЦІЙ ===
// Агенти
export { AGENTS, getAgentConfig, getAgentsByRole, getAgentsByPriority, hasAgent, validateAgentConfig };

// Workflow
export { WORKFLOW_STAGES, WORKFLOW_CONDITIONS, WORKFLOW_CONFIG, getWorkflowStage, getNextStage, checkStageCondition, validateStage, getStagesForAgent };

// API та мережа
export { NETWORK_CONFIG, API_ENDPOINTS, TTS_CONFIG, VOICE_CONFIG, getApiUrl, getServiceConfig, checkServiceHealth, generateClientConfig };

// === ДОДАТКОВІ КОНФІГУРАЦІЇ ===

// Чат конфігурація
export const CHAT_CONFIG = {
  maxMessages: 100,
  messageRetention: 24 * 60 * 60 * 1000, // 24 години

  autoScroll: true,
  showTimestamps: true,
  showAgentColors: true,

  typing: {
    showIndicator: true,
    simulateDelay: true,
    charactersPerSecond: 50
  },

  persistence: {
    enabled: true,
    storageKey: 'atlas_chat_history',
    maxStorageSize: '10MB'
  }
};

// Безпека
export const SECURITY_CONFIG = {
  cors: {
    origin: ['http://localhost:5001', 'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 100, // максимум 100 запитів на window
    message: 'Занадто багато запитів, спробуйте пізніше'
  },

  headers: {
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block'
  }
};

// === ФУНКЦІЇ КОНФІГУРАЦІЇ ===

/**
 * Сгенерувати короткий статус для UI
 */
export function generateShortStatus(agent, stage, action) {
  const statusMessages = {
    atlas: {
      stage1_initial_processing: 'Atlas аналізує запит та готує завдання',
      stage0_chat: 'Atlas відповідає в режимі спілкування',
      stage3_clarification: 'Atlas надає уточнення',
      stage6_task_adjustment: 'Atlas коригує завдання',
      stage9_retry_cycle: 'Atlas координує новий цикл'
    },
    tetyana: {
      stage2_execution: 'Тетяна виконує завдання',
      stage4_retry: 'Тетяна повторює з уточненнями'
    },
    grisha: {
      stage5_diagnosis: 'Гриша діагностує проблеми',
      stage7_verification: 'Гриша перевіряє результати'
    },
    system: {
      stage0_mode_selection: 'Система визначає тип запиту',
      stage8_completion: 'Системне завершення'
    }
  };

  return statusMessages[agent]?.[stage] || `${agent} виконує ${stage}`;
}

/**
 * Перевірити доступність сервісу
 */
export function isServiceEnabled(serviceName) {
  const service = NETWORK_CONFIG.services[serviceName];
  return service && service.port && service.host;
}

/**
 * Отримати повну URL для WebSocket з'єднання
 */
export function getWebSocketUrl(service) {
  const config = NETWORK_CONFIG.services[service];
  if (!config || !config.wsEndpoint) {
    throw new Error(`WebSocket не налаштовано для сервісу: ${service}`);
  }

  const protocol = config.protocol === 'https' ? 'wss' : 'ws';
  return `${protocol}://${config.host}:${config.port}${config.wsEndpoint}`;
}

/**
 * Отримання промпту для етапу workflow
 */
export async function getStagePrompt(stage, agent, name, context = {}) {
  try {
    if (!promptRegistry.validated) {
      await promptRegistry.initialize();
    }
    return await promptRegistry.getPrompt(stage, agent, name, context);
  } catch (error) {
    console.error(`Failed to get stage prompt for ${agent}:${stage}:${name}`, error);
    throw error;
  }
}

/**
 * Валідація конфігурації при запуску
 */
export function validateConfig() {
  const errors = [];

  // Перевіряємо обов'язкові сервіси
  const requiredServices = ['orchestrator', 'frontend', 'tts'];
  for (const service of requiredServices) {
    if (!NETWORK_CONFIG.services[service]) {
      errors.push(`Відсутня конфігурація для сервісу: ${service}`);
    }
  }

  // Перевіряємо агентів
  const requiredAgents = ['atlas', 'tetyana', 'grisha'];
  for (const agent of requiredAgents) {
    if (!AGENTS[agent]) {
      errors.push(`Відсутня конфігурація для агента: ${agent}`);
    }
  }

  // Перевіряємо workflow етапи
  if (WORKFLOW_STAGES.length === 0) {
    errors.push('Не знайдено жодного етапу workflow');
  }

  if (errors.length > 0) {
    throw new Error(`Помилки конфігурації:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Експорт налаштувань середовища
 */
export const ENV_CONFIG = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Фічі
  features: {
    tts: process.env.ENABLE_TTS !== 'false',
    voice: process.env.ENABLE_VOICE !== 'false',
    simulation: process.env.ENABLE_SIMULATION === 'true',
    logging: process.env.ENABLE_LOGGING !== 'false',
    monitoring: process.env.ENABLE_MONITORING !== 'false'
  },

  // Зовнішні сервіси
  external: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    githubToken: process.env.GITHUB_TOKEN
  }
};

// Автоматична валідація при імпорті (тільки у production)
if (ENV_CONFIG.isProduction) {
  try {
    validateConfig();
    console.log('✅ Глобальна конфігурація успішно завантажена та валідована');
  } catch (error) {
    console.error('❌ Помилка валідації конфігурації:', error.message);
    process.exit(1);
  }
}

// Quick access константи
export const MCP_SERVERS = AI_BACKEND_CONFIG.providers.mcp.servers;

// Експорт всього як об'єкт за замовчуванням
export default {
  SYSTEM_INFO,
  USER_CONFIG,
  CHAT_CONFIG,
  SECURITY_CONFIG,
  ENV_CONFIG,
  AI_MODEL_CONFIG,
  AI_BACKEND_CONFIG,  // NEW: Модульна система backends
  MCP_SERVERS,        // Quick access до MCP серверів

  // Модульні конфігурації
  AGENTS,
  WORKFLOW_STAGES,
  WORKFLOW_CONDITIONS,
  WORKFLOW_CONFIG,
  NETWORK_CONFIG,
  API_ENDPOINTS,
  TTS_CONFIG,
  VOICE_CONFIG,

  // Функції з модулів
  getAgentConfig,
  getAgentsByRole,
  getAgentsByPriority,
  hasAgent,
  validateAgentConfig,
  getWorkflowStage,
  getNextStage,
  checkStageCondition,
  validateStage,
  getStagesForAgent,
  getApiUrl,
  getServiceConfig,
  checkServiceHealth,
  generateClientConfig,
  getStagePrompt,

  // Локальні функції
  generateShortStatus,
  isServiceEnabled,
  getWebSocketUrl,
  validateConfig
};
