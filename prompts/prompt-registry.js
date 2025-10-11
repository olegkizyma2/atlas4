/**
 * ATLAS PROMPT REGISTRY
 * Централізований реєстр промптів з автоматичною синхронізацією з workflow
 * Переміщено в /prompts/ для централізації
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = __dirname; // Поточна директорія /prompts

// Простий logger для промптів
const logger = {
  system: (tag, msg, data) => console.log(`[PROMPTS:${tag}] ${msg}`, data || ''),
  debug: (msg, data) => console.log(`[PROMPTS:DEBUG] ${msg}`, data || ''),
  info: (msg, data) => console.log(`[PROMPTS:INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[PROMPTS:WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[PROMPTS:ERROR] ${msg}`, data || '')
};

class PromptRegistry {
  constructor() {
    this.prompts = new Map();
    this.cache = new Map();
    this.validated = false;
    this.loadStartTime = null;
  }

  /**
     * Ініціалізація реєстру з завантаженням всіх промптів
     */
  async initialize() {
    this.loadStartTime = Date.now();
    console.log('🚀 [PROMPT-REGISTRY] Starting initialization...');
    logger.system('prompt-registry', 'Initializing prompt registry...');

    try {
      await this.loadAllPrompts();
      await this.validateRegistry();
      this.validated = true;

      const loadTime = Date.now() - this.loadStartTime;
      console.log(`✅ [PROMPT-REGISTRY] Initialized successfully in ${loadTime}ms`);
      console.log(`📋 [PROMPT-REGISTRY] Loaded ${this.prompts.size} prompts, cache: ${this.cache.size}`);
      logger.system('prompt-registry', `Initialized successfully in ${loadTime}ms`, {
        promptsLoaded: this.prompts.size,
        cachePrepared: this.cache.size
      });
    } catch (error) {
      console.error('❌ [PROMPT-REGISTRY] Initialization failed:', error.message);
      logger.error('Failed to initialize prompt registry', { error: error.message });
      throw error;
    }
  }

  /**
     * Завантаження всіх промптів з файлової системи
     */
  async loadAllPrompts() {
    const agents = ['atlas', 'tetyana', 'grisha', 'system', 'voice'];
    console.log('📂 [PROMPT-REGISTRY] Loading prompts for agents:', agents);

    for (const agent of agents) {
      const agentDir = join(PROMPTS_DIR, agent);
      console.log(`🔍 [PROMPT-REGISTRY] Checking agent directory: ${agentDir}`);

      try {
        const files = await readdir(agentDir);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        console.log(`📄 [PROMPT-REGISTRY] Found ${jsFiles.length} JS files for ${agent}:`, jsFiles);

        for (const file of jsFiles) {
          const filePath = join(agentDir, file);
          const promptKey = this.generatePromptKey(agent, file);

          try {
            // Динамічний імпорт промпту
            const module = await import(`file://${filePath}`);
            this.prompts.set(promptKey, {
              agent,
              file,
              filePath,
              module,
              loadedAt: Date.now()
            });

            logger.debug(`Loaded prompt: ${promptKey}`);
          } catch (error) {
            logger.warn(`Failed to load prompt ${promptKey}`, { error: error.message });
          }
        }
      } catch (error) {
        logger.warn(`Failed to read agent directory: ${agent}`, { error: error.message });
      }
    }
  }

  /**
     * Генерація ключа для промпту
     */
  generatePromptKey(agent, filename) {
    // Конвертуємо filename в stage info
    const nameWithoutExt = filename.replace('.js', '');

    // Парсимо номер етапу з назви файлу
    const stageMatch = nameWithoutExt.match(/stage(\d+|_minus\d+|0)/);
    if (stageMatch) {
      const stageStr = stageMatch[1];
      const stage = stageStr.startsWith('_minus') ?
        parseInt(stageStr.replace('_minus', '-')) :
        parseInt(stageStr);

      return `${agent}:${stage}:${nameWithoutExt}`;
    }

    // Для файлів без номера етапу
    return `${agent}:special:${nameWithoutExt}`;
  }

  /**
     * Отримання промпту за параметрами workflow
     */
  async getPrompt(stage, agent, name, context = {}) {
    const cacheKey = `${agent}:${stage}:${name}`;

    // Перевіряємо кеш
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Шукаємо відповідний промпт
    const promptKey = this.findPromptKey(stage, agent, name);
    if (!promptKey) {
      throw new Error(`Prompt not found for stage ${stage}, agent ${agent}, name ${name}`);
    }

    const promptData = this.prompts.get(promptKey);
    if (!promptData) {
      throw new Error(`Prompt data not found for key: ${promptKey}`);
    }

    // Будуємо промпт з контекстом
    const prompt = await this.buildPrompt(promptData, context);

    // Кешуємо результат
    this.cache.set(cacheKey, prompt);

    return prompt;
  }

  /**
     * Пошук ключа промпту за параметрами
     */
  findPromptKey(stage, agent, name) {
    console.log(`[PROMPT-DEBUG] Looking for: stage=${stage}, agent=${agent}, name=${name}`);

    // Спочатку точний пошук за назвою
    const exactKey = `${agent}:${stage}:${name}`;
    console.log(`[PROMPT-DEBUG] Trying exact key: ${exactKey}`);
    if (this.prompts.has(exactKey)) {
      console.log(`[PROMPT-DEBUG] Found exact match: ${exactKey}`);
      return exactKey;
    }

    // Пошук з врахуванням мінусових етапів
    if (stage < 0) {
      const minusKey = `${agent}:${stage}:stage_minus${Math.abs(stage)}_${name}`;
      if (this.prompts.has(minusKey)) {
        return minusKey;
      }
    }

    // Пошук за шаблоном
    for (const [key, data] of this.prompts.entries()) {
      const [keyAgent, keyStage, keyName] = key.split(':');
      if (keyAgent === agent && parseInt(keyStage) === stage) {
        return key;
      }
    }

    console.log(`[PROMPT-DEBUG] All loaded prompts:`);
    for (const [key, data] of this.prompts.entries()) {
      console.log(`[PROMPT-DEBUG] - ${key} (${data.agent}/${data.file})`);
    }

    return null;
  }

  /**
     * Побудова промпту з контекстом
     */
  async buildPrompt(promptData, context) {
    const { module } = promptData;
    const { userMessage, session, agent: agentName } = context;

    // Отримуємо системний промпт
    const systemPromptKey = this.findSystemPromptKey(module);
    const systemPrompt = module[systemPromptKey];

    if (!systemPrompt) {
      throw new Error(`System prompt not found in module: ${promptData.file}`);
    }

    // Отримуємо user prompt функцію
    const userPromptKey = this.findUserPromptKey(module);
    const userPromptFn = module[userPromptKey];

    if (!userPromptFn || typeof userPromptFn !== 'function') {
      throw new Error(`User prompt function not found in module: ${promptData.file}`);
    }

    // Будуємо user prompt з контекстом
    const userPrompt = this.buildUserPrompt(userPromptFn, userMessage, session, agentName);

    return {
      systemPrompt,
      userPrompt,
      metadata: {
        agent: promptData.agent,
        stage: this.extractStageFromFile(promptData.file),
        file: promptData.file,
        loadedAt: promptData.loadedAt
      }
    };
  }

  /**
     * Пошук ключа системного промпту в модулі
     */
  findSystemPromptKey(module) {
    const keys = Object.keys(module);
    return keys.find(key => key.includes('SYSTEM_PROMPT')) ||
      keys.find(key => key.includes('_SYSTEM_')) ||
      'systemPrompt';
  }

  /**
     * Пошук ключа user промпту в модулі
     */
  findUserPromptKey(module) {
    const keys = Object.keys(module);
    return keys.find(key => key.includes('USER_PROMPT')) ||
      keys.find(key => key.includes('_USER_')) ||
      'userPrompt';
  }

  /**
     * Побудова user prompt з контекстом сесії
     */
  buildUserPrompt(userPromptFn, userMessage, session, agentName) {
    try {
      // Для різних етапів різна логіка побудови контексту
      const stage = this.extractStageFromSession(session);

      switch (stage) {
        case 0:
          return userPromptFn(userMessage, session);

        case 2: // Tetyana execution
          const lastAtlasResponse = session?.history?.filter(r => r.agent === 'atlas').pop();
          const atlasTask = lastAtlasResponse ? lastAtlasResponse.content : userMessage;
          return userPromptFn(atlasTask, userMessage);

        case 3: // Atlas clarification
          const lastTetyanaResponse = session?.history?.filter(r => r.agent === 'tetyana').pop();
          const tetyanaResponse = lastTetyanaResponse ? lastTetyanaResponse.content : '';
          const originalTask = session?.history?.filter(r => r.agent === 'atlas')[0]?.content || '';
          return userPromptFn(tetyanaResponse, originalTask, userMessage);

        case 4: // Tetyana retry with Atlas guidance
          const lastAtlasGuidance = session?.history?.filter(r => r.agent === 'atlas').pop();
          const atlasGuidance = lastAtlasGuidance ? lastAtlasGuidance.content : '';
          const originalTask4 = session?.history?.filter(r => r.agent === 'atlas')[0]?.content || '';
          const previousAttempt = session?.history?.filter(r => r.agent === 'tetyana')[0]?.content || '';
          return userPromptFn(atlasGuidance, originalTask4, previousAttempt);

        case 5: // Grisha diagnosis
          const atlasAttempts = session?.history?.filter(r => r.agent === 'atlas').map(r => r.content).join('\n\n') || '';
          const tetyanaAttempts = session?.history?.filter(r => r.agent === 'tetyana').map(r => r.content).join('\n\n') || '';
          return userPromptFn(userMessage, atlasAttempts, tetyanaAttempts);

        case 7: // Grisha verification
          // Витягуємо СПРАВЖНІЙ оригінальний запит користувача
          const originalRequest7 = session?.originalMessage ||
            session?.chatThread?.messages?.find(m => m.role === 'user')?.content ||
            userMessage;
          const executionResults = session?.history?.filter(r => r.agent === 'tetyana').pop()?.content || '';
          const expectedOutcome = session?.history?.filter(r => r.agent === 'atlas').slice(-1)[0]?.content || '';

          console.log(`[PROMPT-DEBUG] Stage 7 context: originalRequest="${originalRequest7?.substring(0, 50)}...", execution="${executionResults?.substring(0, 50)}...", expected="${expectedOutcome?.substring(0, 50)}..."`);

          return userPromptFn(originalRequest7, executionResults, expectedOutcome);

        default:
          // Загальна логіка для інших етапів
          return userPromptFn(userMessage);
      }
    } catch (error) {
      logger.warn('Failed to build user prompt with context, using simple version', {
        error: error.message,
        agentName,
        stage
      });
      return userPromptFn(userMessage);
    }
  }

  /**
     * Извлечение номера этапа из сессии
     */
  extractStageFromSession(session) {
    return session?.currentStage || 0;
  }

  /**
     * Извлечение номера этапа из имени файла
     */
  extractStageFromFile(filename) {
    const match = filename.match(/stage(\d+|_minus\d+)/);
    if (match) {
      const stageStr = match[1];
      return stageStr.startsWith('_minus') ?
        parseInt(stageStr.replace('_minus', '-')) :
        parseInt(stageStr);
    }
    return null;
  }

  /**
     * Валідація реєстру промптів
     */
  async validateRegistry() {
    const errors = [];

    // Перевіряємо наявність основних промптів
    const requiredPrompts = [
      { stage: 0, agent: 'system', name: 'mode_selection' },
      { stage: 0, agent: 'atlas', name: 'chat' },
      { stage: 1, agent: 'atlas', name: 'initial_processing' },
      { stage: 2, agent: 'tetyana', name: 'execution' },
      { stage: 3, agent: 'atlas', name: 'clarification' },
      { stage: 4, agent: 'tetyana', name: 'retry' },
      { stage: 5, agent: 'grisha', name: 'diagnosis' },
      { stage: 7, agent: 'grisha', name: 'verification' }
    ];

    for (const required of requiredPrompts) {
      const key = this.findPromptKey(required.stage, required.agent, required.name);
      if (!key) {
        errors.push(`Missing required prompt: stage ${required.stage}, agent ${required.agent}, name ${required.name}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Prompt registry validation found issues', { errors });
    } else {
      logger.info('Prompt registry validation passed');
    }

    return errors;
  }

  /**
     * Отримання статистики реєстру
     */
  getStats() {
    const stats = {
      total: this.prompts.size,
      cached: this.cache.size,
      validated: this.validated,
      loadTime: this.loadStartTime ? Date.now() - this.loadStartTime : 0,
      agents: {}
    };

    // Статистика по агентам
    for (const [key, data] of this.prompts.entries()) {
      if (!stats.agents[data.agent]) {
        stats.agents[data.agent] = 0;
      }
      stats.agents[data.agent]++;
    }

    return stats;
  }

  /**
     * Очищення кешу
     */
  clearCache() {
    this.cache.clear();
    logger.debug('Prompt registry cache cleared');
  }

  /**
     * Перезавантаження промпту (для development)
     */
  async reloadPrompt(agent, filename) {
    const promptKey = this.generatePromptKey(agent, filename);
    const filePath = join(PROMPTS_DIR, agent, filename);

    try {
      // Видаляємо з кешу модулів Node.js
      delete require.cache[filePath];

      // Перезавантажуємо модуль
      const module = await import(`file://${filePath}?t=${Date.now()}`);

      this.prompts.set(promptKey, {
        agent,
        file: filename,
        filePath,
        module,
        loadedAt: Date.now()
      });

      // Очищуємо пов'язані записи в кеші
      for (const cacheKey of this.cache.keys()) {
        if (cacheKey.startsWith(agent)) {
          this.cache.delete(cacheKey);
        }
      }

      logger.info(`Reloaded prompt: ${promptKey}`);
      return true;
    } catch (error) {
      logger.error(`Failed to reload prompt: ${promptKey}`, { error: error.message });
      return false;
    }
  }
}

// Експортуємо singleton instance
const promptRegistry = new PromptRegistry();
export default promptRegistry;
