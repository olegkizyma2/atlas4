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

// === VISION MODELS CONFIGURATION (UPDATED 17.10.2025) ===
// Vision AI моделі для Grishy verification system
// PRIORITY: Ollama local (free!) → OpenRouter API (paid fallback)
// Cost comparison: Ollama ($0) > Phi-3.5 ($0.0001/img) > Llama-11b ($0.0002/img) vs GPT-4 ($0.01/img)!
export const VISION_CONFIG = {
  // Tier 0: LOCAL OLLAMA (FREE - RECOMMENDED!) - NEW 17.10.2025
  // Запущено на localhost:11434, модель: llama3.2-vision
  // Speed: 2-5s (залежно від GPU), Accuracy: 94%, Cost: $0!
  local: {
    model: 'llama3.2-vision',
    provider: 'ollama',
    cost: 0,                // FREE!
    speed: '2-5s',          // Залежно від процесу, але прийнятно
    rateLimitPerMin: null,  // Немає ліміту (локальний)
    use_cases: ['any_task', 'frequent_verifications', 'budget_critical'],
    endpoint: 'http://localhost:11434',
    isLocal: true
  },

  // Tier 1: Fast & cheap (для простих перевірок коли Ollama недоступна)
  fast: {
    model: 'meta/llama-3.2-11b-vision-instruct',
    provider: 'openrouter',
    cost: 0.0002,           // Per image
    speed: '0.8-1.2s',
    rateLimitPerMin: 6,
    use_cases: ['browser_open', 'file_exists', 'app_active', 'window_visible'],
    endpoint: 'http://localhost:4000/v1/chat/completions',
    isLocal: false
  },

  // Tier 2: Standard (для середніх UI завдань)
  standard: {
    model: 'meta/llama-3.2-90b-vision-instruct',
    provider: 'openrouter',
    cost: 0.0003,           // Per image
    speed: '1.5-2.5s',
    rateLimitPerMin: 3,
    use_cases: ['text_match', 'ui_validation', 'form_filled', 'button_state'],
    endpoint: 'http://localhost:4000/v1/chat/completions',
    isLocal: false
  },

  // Tier 3: Fastest & cheapest (OpenRouter)
  cheapest: {
    model: 'microsoft/phi-3.5-vision-instruct',
    provider: 'openrouter',
    cost: 0.0001,           // Per image
    speed: '1-1.5s',
    rateLimitPerMin: 12,
    use_cases: ['simple_check', 'presence_check', 'quick_verify'],
    endpoint: 'http://localhost:4000/v1/chat/completions',
    isLocal: false
  },

  // Default configuration
  get default() {
    // Try local Ollama first, fallback to cloud
    return this.isOllamaAvailable() ? this.local : this.fast;
  },

  // API configuration
  api: {
    primaryEndpoint: 'http://localhost:4000/v1/chat/completions',
    ollamaEndpoint: 'http://localhost:11434',
    timeout: 60000,         // 60s timeout for vision analysis
    temperature: 0.2,       // Low for accuracy
    maxTokens: 1000,
    ollamaModel: process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision'
  },

  // Check if Ollama is available
  async isOllamaAvailable() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', { timeout: 2000 });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Adaptive selection based on task complexity (prefers local)
  async selectModel(complexity) {
    // complexity: 1-10 scale
    const isOllamaUp = await this.isOllamaAvailable();

    if (isOllamaUp) {
      return this.local;  // ALWAYS prefer free local model
    }

    // Fallback to OpenRouter if Ollama unavailable
    if (complexity <= 3) return this.cheapest;    // Simplest & fastest
    if (complexity <= 6) return this.fast;        // Recommended default
    return this.standard;                         // More powerful for complex UI
  },

  // Cost estimation
  estimateCost(model, screenshotCount = 1) {
    const modelConfig = Object.values(this).find(cfg => cfg.model === model);
    if (!modelConfig) return 0;
    return modelConfig.cost * screenshotCount;
  }
};

// === AI MODELS CONFIGURATION ===
// Конфігурація моделей для різних стадій (система використовує LLM API)
// v5.0: Підтримка fallback endpoint для remote access
// UPDATED 16.10.2025: Оптимальні моделі за rate limit + температури за типом завдання
export const AI_MODEL_CONFIG = {
  // API endpoint для system stages (підтримує fallback)
  get apiEndpoint() {
    const primary = process.env.LLM_API_ENDPOINT || 'http://localhost:4000/v1/chat/completions';
    const fallback = process.env.LLM_API_FALLBACK_ENDPOINT;
    const useFallback = process.env.LLM_API_USE_FALLBACK === 'true';

    return {
      primary,
      fallback: fallback || null,
      useFallback,
      timeout: parseInt(process.env.LLM_API_TIMEOUT || '60000', 10)
    };
  },

  // Моделі для різних типів завдань
  models: {
    // Класифікація та швидкі рішення
    // T=0.05 для максимальної точності (бінарна класифікація)
    // ministral-3b: 45 req/min (найбільш доступна)
    classification: {
      get model() { return process.env.AI_MODEL_CLASSIFICATION || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.AI_TEMP_CLASSIFICATION || '0.05'); },
      max_tokens: 50,
      description: 'Бінарна класифікація - максимальна точність'
    },

    // Чат та розмова
    // T=0.7 для природності та креативності
    // cohere/cohere-command-r-plus-08-2024: Швидка та надійна Cohere модель
    chat: {
      get model() { return process.env.AI_MODEL_CHAT || 'cohere/cohere-command-r-plus-08-2024'; },
      get temperature() { return parseFloat(process.env.AI_TEMP_CHAT || '0.7'); },
      max_tokens: 500,
      description: 'Природні розмови - креативність'
    },

    // Аналіз та контекст
    // T=0.2 для точного аналізу з мінімальною варіативністю
    // gpt-4o-mini: 35 req/min (балансує якість та швидкість)
    analysis: {
      get model() { return process.env.AI_MODEL_ANALYSIS || 'openai/gpt-4o-mini'; },
      get temperature() { return parseFloat(process.env.AI_TEMP_ANALYSIS || '0.2'); },
      max_tokens: 1000,
      description: 'Аналіз та контекст - точність'
    },

    // TTS оптимізація
    // T=0.15 для стабільного результату (важливо щоб озвучка звучала однаково)
    // ministral-3b: 45 req/min
    tts_optimization: {
      get model() { return process.env.AI_MODEL_TTS_OPT || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.AI_TEMP_TTS_OPT || '0.15'); },
      max_tokens: 300,
      description: 'Оптимізація для TTS - стабільність'
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
// UPDATED 16.10.2025: Оптимальні моделі за rate limit + точні температури для кожного типу завдання
// Температури:
//   - 0.05: Бінарна класифікація (максимальна точність)
//   - 0.1: JSON output (мінімальна варіативність)
//   - 0.15-0.2: Аналіз та верифікація (точність + креатив)
//   - 0.3: Планування (баланс точності та креативу)
//   - 0.5: Резюме користувачу (природність)
//   - 0.7: Чат (креативність)
// Детально: docs/MCP_MODEL_SELECTION_GUIDE.md
// v5.0: Підтримка fallback API endpoint
export const MCP_MODEL_CONFIG = {
  // API endpoint (підтримує fallback)
  get apiEndpoint() {
    const primary = process.env.LLM_API_ENDPOINT || 'http://localhost:4000/v1/chat/completions';
    const fallback = process.env.LLM_API_FALLBACK_ENDPOINT;
    const useFallback = process.env.LLM_API_USE_FALLBACK === 'true';

    return {
      primary,
      fallback: fallback || null,
      useFallback,
      timeout: parseInt(process.env.LLM_API_TIMEOUT || '60000', 10)
    };
  },

  // Моделі для кожного MCP stage (читаємо з ENV для гнучкості)
  stages: {
    // Stage 0: Mode Selection (task vs chat)
    // T=0.05 для максимальної точності (бінарна класифікація)
    // ministral-3b: 45 req/min (найбільш доступна)
    mode_selection: {
      get model() { return process.env.MCP_MODEL_MODE_SELECTION || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_MODE_SELECTION || '0.05'); },
      max_tokens: 50,
      description: 'Бінарна класифікація task vs chat - максимальна точність (45 req/min)'
    },

    // Stage 0.5: Backend Selection (deprecated - now MCP-only)
    // T=0.05 для точної класифікації
    // ministral-3b: 45 req/min
    backend_selection: {
      get model() { return process.env.MCP_MODEL_BACKEND_SELECTION || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_BACKEND_SELECTION || '0.05'); },
      max_tokens: 50,
      description: 'Keyword routing - точність (45 req/min, deprecated)'
    },

    // Stage 1-MCP: Atlas TODO Planning
    // T=0.3 для балансу планування (точність + креатив для генерації ідей)
    // xai/grok-3: Потужна модель для планування
    todo_planning: {
      get model() { return process.env.MCP_MODEL_TODO_PLANNING || 'xai/grok-3'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_TODO_PLANNING || '0.3'); },
      max_tokens: 4000,
      description: 'Atlas TODO Planning - баланс точності та креативу (xai/grok-3)'
    },

    // Stage 2.1-MCP: Tetyana Plan Tools
    // T=0.1 для ЧИСТОГО JSON output без варіацій (критично важливо!)
    // openai/gpt-4o: Чистий JSON, надійна структура
    plan_tools: {
      get model() { return process.env.MCP_MODEL_PLAN_TOOLS || 'openai/gpt-4o'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_PLAN_TOOLS || '0.1'); },
      max_tokens: 2500,
      description: 'Tetyana Plan Tools - чистий JSON без markdown (openai/gpt-4o)'
    },

    // Stage 2.3-MCP: Grisha Verify Item
    // T=0.15 для точної верифікації з мінімальною варіативністю
    // openai/gpt-4o-mini: Швидка верифікація, точна, 90 req/min (FIXED 17.10.2025)
    verify_item: {
      get model() { return process.env.MCP_MODEL_VERIFY_ITEM || 'openai/gpt-4o-mini'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_VERIFY_ITEM || '0.15'); },
      max_tokens: 800,
      description: 'Grisha Verify Item - швидка верифікація з JSON output (90 req/min, ~0.3ms latency)'
    },

    // Stage 3-MCP: Atlas Adjust TODO
    // T=0.2 для точного аналізу та корекції з великим контекстом
    // gpt-4o-mini: 35 req/min (якість + 128K контекст вже не потрібен)
    adjust_todo: {
      get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'openai/gpt-4o-mini'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_ADJUST_TODO || '0.2'); },
      max_tokens: 1500,
      description: 'Atlas Adjust TODO - точна корекція з аналізом (35 req/min)'
    },

    // Stage 8-MCP: Final Summary
    // T=0.5 для природного резюме користувачу (баланс точності та креативності)
    // ministral-3b: 45 req/min (швидкість для фінальної відповіді)
    final_summary: {
      get model() { return process.env.MCP_MODEL_FINAL_SUMMARY || 'mistral-ai/ministral-3b'; },
      get temperature() { return parseFloat(process.env.MCP_TEMP_FINAL_SUMMARY || '0.5'); },
      max_tokens: 600,
      description: 'Final Summary для користувача - природність (45 req/min)'
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

        // DISABLED 17.10.2025: @cyanheads/git-mcp-server КРАШИТЬСЯ при запуску
        // Проблема: "Error flushing logger: the worker has exited"
        // Корінь: Pino multi-threaded logger конфліктує з STDIO protocol
        // Альтернатива: Git операції через shell MCP server (git commands)
        // TODO: Спробувати інший Git MCP package коли з'явиться
        /*
        git: {
          command: 'npx',
          args: ['-y', '@cyanheads/git-mcp-server'],
          env: {
            GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'ATLAS',
            GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'atlas@example.com'
          }
        },
        */

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
