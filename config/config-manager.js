/**
 * CONFIG MANAGER - Система синхронізації конфігурацій
 *
 * Автоматично синхронізує локальні конфігурації з глобальною
 * Забезпечує узгодженість налаштувань у всьому workflow
 */

import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Імпорт глобальної конфігурації
import GlobalConfig from './global-config.js';

// Імпорт промптів (CommonJS через динамічний імпорт)
let promptsModule = null;
try {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  promptsModule = require('../prompts/index.js');
} catch (error) {
  console.warn('Не вдалося завантажити промпти:', error.message);
}

/**
 * Менеджер конфігурацій
 */
export class ConfigManager {
  constructor() {
    this.globalConfig = GlobalConfig;
    this.projectRoot = resolve(__dirname, '..');
    this.configHash = null;
    this.syncTargets = new Map();

    // Ініціалізуємо цілі синхронізації
    this.initSyncTargets();
  }

  /**
     * Ініціалізація цілей синхронізації
     */
  initSyncTargets() {
    // Основні модулі системи
    this.addSyncTarget('frontend-web', {
      path: 'web/static/js/shared-config.js',
      type: 'es6-module',
      exports: ['AGENTS', 'USER_CONFIG', 'API_ENDPOINTS', 'TTS_CONFIG', 'VOICE_CONFIG', 'CHAT_CONFIG', 'WORKFLOW_STAGES'],
      template: 'frontend-template'
    });

    this.addSyncTarget('orchestrator', {
      path: 'orchestrator/config.js',
      type: 'es6-module',
      exports: ['AGENTS', 'WORKFLOW_STAGES', 'WORKFLOW_CONFIG', 'API_ENDPOINTS', 'NETWORK_CONFIG'],
      template: 'orchestrator-template'
    });

    this.addSyncTarget('voice-control', {
      path: 'web/static/js/voice-control/config.js',
      type: 'es6-module',
      exports: ['VOICE_CONFIG', 'TTS_CONFIG', 'API_ENDPOINTS'],
      template: 'voice-template'
    });

    this.addSyncTarget('core-config', {
      path: 'web/static/js/core/config.js',
      type: 'es6-module',
      exports: ['AGENTS', 'USER_CONFIG', 'API_ENDPOINTS', 'TTS_CONFIG', 'VOICE_CONFIG', 'CHAT_CONFIG', 'WORKFLOW_STAGES'],
      template: 'core-template'
    });

    this.addSyncTarget('legacy-shared', {
      path: 'shared-config.js',
      type: 'es6-module',
      exports: ['AGENTS', 'WORKFLOW_STAGES', 'WORKFLOW_CONFIG', 'API_ENDPOINTS', 'TTS_CONFIG', 'VOICE_CONFIG', 'CHAT_CONFIG'],
      template: 'legacy-template'
    });

    this.addSyncTarget('voice-control-core', {
      path: 'web/static/js/voice-control/core/config.js',
      type: 'es6-module',
      exports: ['VOICE_CONFIG', 'TTS_CONFIG', 'API_ENDPOINTS', 'AUDIO_CONFIG'],
      template: 'voice-core-template'
    });
  }

  /**
     * Додати ціль синхронізації
     */
  addSyncTarget(name, config) {
    this.syncTargets.set(name, {
      ...config,
      fullPath: join(this.projectRoot, config.path),
      lastSync: null,
      checksum: null
    });
  }

  /**
     * Обчислити хеш конфігурації
     */
  calculateConfigHash() {
    const configString = JSON.stringify(this.globalConfig, null, 2);
    return createHash('md5').update(configString).digest('hex');
  }

  /**
     * Перевірити чи потрібна синхронізація
     */
  needsSync() {
    const currentHash = this.calculateConfigHash();
    if (this.configHash !== currentHash) {
      this.configHash = currentHash;
      return true;
    }
    return false;
  }

  /**
     * Отримати дані з промптів
     */
  getPromptData(namespace, promptName) {
    if (!promptsModule) return null;
    try {
      const promptModule = promptsModule[namespace]?.[promptName];
      return promptModule || null;
    } catch (error) {
      console.warn(`Помилка отримання промпту ${namespace}/${promptName}:`, error);
      return null;
    }
  }

  /**
     * Отримати статусні повідомлення з промптів
     */
  getStatusMessagesFromPrompts() {
    const statusPrompts = this.getPromptData('voice', 'status_messages');
    return statusPrompts?.statusMessages || {};
  }

  /**
     * Отримати відповіді активації з промптів
     */
  getActivationResponsesFromPrompts() {
    const activationPrompts = this.getPromptData('voice', 'activation_responses');
    return activationPrompts?.responses || [];
  }

  /**
     * Отримати описи агентів з промптів
     */
  getAgentDescriptionsFromPrompts() {
    const agentPrompts = this.getPromptData('system', 'agent_descriptions');
    return agentPrompts?.agents || {};
  }

  /**
     * Отримати описи workflow з промптів
     */
  getWorkflowStagesFromPrompts() {
    const workflowPrompts = this.getPromptData('system', 'workflow_stages');
    return workflowPrompts?.stages || [];
  }

  /**
     * Синхронізувати всі конфігурації
     */
  async syncAll() {
    console.log('🔄 Починаємо синхронізацію всіх конфігурацій...');

    const results = {
      success: [],
      errors: [],
      skipped: []
    };

    for (const [name, target] of this.syncTargets) {
      try {
        console.log(`   Синхронізуємо: ${name}...`);
        await this.syncTarget(name, target);
        results.success.push(name);
        console.log(`   ✅ ${name} синхронізовано`);
      } catch (error) {
        console.error(`   ❌ Помилка синхронізації ${name}:`, error.message);
        results.errors.push({ name, error: error.message });
      }
    }

    // Звіт
    console.log(`\n📊 Результат синхронізації:`);
    console.log(`   ✅ Успішно: ${results.success.length}`);
    console.log(`   ❌ Помилки: ${results.errors.length}`);
    console.log(`   ⏭️ Пропущено: ${results.skipped.length}`);

    if (results.errors.length > 0) {
      console.log(`\n🔍 Деталі помилок:`);
      results.errors.forEach(err => {
        console.log(`   - ${err.name}: ${err.error}`);
      });
    }

    return results;
  }

  /**
     * Синхронізувати конкретну ціль
     */
  async syncTarget(name, target) {
    // Створюємо директорію якщо не існує
    const dir = dirname(target.fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Генеруємо контент на основі шаблону
    const content = this.generateConfigContent(target);

    // Обчислюємо чексуму
    const checksum = createHash('md5').update(content).digest('hex');

    // Перевіряємо чи потрібне оновлення
    if (target.checksum === checksum && existsSync(target.fullPath)) {
      console.log(`   ⏭️ ${name} не потребує оновлення`);
      return;
    }

    // Записуємо файл
    await fs.writeFile(target.fullPath, content, 'utf8');

    // Оновлюємо метадані
    target.checksum = checksum;
    target.lastSync = new Date().toISOString();
  }

  /**
     * Генерувати контент конфігурації на основі шаблону
     */
  generateConfigContent(target) {
    const templates = {
      'frontend-template': this.generateFrontendTemplate.bind(this),
      'orchestrator-template': this.generateOrchestratorTemplate.bind(this),
      'voice-template': this.generateVoiceTemplate.bind(this),
      'voice-core-template': this.generateVoiceCoreTemplate.bind(this),
      'core-template': this.generateCoreTemplate.bind(this),
      'legacy-template': this.generateLegacyTemplate.bind(this)
    };

    const generator = templates[target.template];
    if (!generator) {
      throw new Error(`Невідомий шаблон: ${target.template}`);
    }

    return generator(target);
  }

  /**
     * Шаблон для frontend конфігурації
     */
  generateFrontendTemplate(target) {
    const exports = this.getExportedConfigs(target.exports);
    const timestamp = new Date().toISOString();
    const GC = this.globalConfig;
    const exportDecls = exports.map(exp => `export const ${exp} = ${JSON.stringify(GC[exp], null, 4)};`).join('\n\n');
    const version = (GC.SYSTEM_INFO && GC.SYSTEM_INFO.version) || 'unknown';

    return `/**
 * FRONTEND CONFIGURATION (browser-safe)
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: ${timestamp}
 * 
 * ⚠️ НЕ РЕДАГУЙТЕ ЦЕЙ ФАЙЛ ВРУЧНУ!
 * Всі зміни будуть перезаписані при наступній синхронізації.
 * Для змін використовуйте config/global-config.js
 *
 * Примітка: цей файл не імпортує Node-модулі і безпечний для браузера
 */

${exportDecls}

// Utility функції (самодостатні)
export function getAgentByName(name) {
    if (!name) return null;
    const key = String(name).toLowerCase();
    return (AGENTS && AGENTS[key]) || null;
}

export function getWorkflowStage(stageNumber) {
    if (!Array.isArray(WORKFLOW_STAGES)) return null;
    return WORKFLOW_STAGES.find(stage => stage.stage === stageNumber) || null;
}

export function getApiUrl(service, endpoint = '') {
    const baseUrl = API_ENDPOINTS && API_ENDPOINTS[service];
    if (!baseUrl) throw new Error(\`Невідомий сервіс: \${service}\`);
    return endpoint ? \`${'${'}baseUrl${'}'}${'${'}endpoint${'}'}\` : baseUrl;
}

export function generateShortStatus(agent, stage, action) {
    const statusMessages = {
        atlas: {
            stage1_initial_processing: "Atlas аналізує запит та готує завдання",
            stage0_chat: "Atlas відповідає в режимі спілкування",
            stage3_clarification: "Atlas надає уточнення",
            stage6_task_adjustment: "Atlas коригує завдання",
            stage9_retry_cycle: "Atlas координує новий цикл"
        },
        tetyana: {
            stage2_execution: "Тетяна виконує завдання",
            stage4_retry: "Тетяна повторює з уточненнями"
        },
        grisha: {
            stage5_diagnosis: "Гриша діагностує проблеми",
            stage7_verification: "Гриша перевіряє результати"
        },
        system: {
            stage0_mode_selection: "Система визначає тип запиту",
            stage8_completion: "Системне завершення"
        }
    };
    return (statusMessages[agent]?.[stage]) || \`${'${'}agent${'}'} виконує ${'${'}stage${'}'}\`;
}

// Мета-інформація
export const CONFIG_META = {
    source: 'global-config.js',
    synced: '${timestamp}',
    version: ${JSON.stringify(version)}
};

export default {
${exports.map(exp => `    ${exp}`).join(',\n')},
    getAgentByName,
    getWorkflowStage,
    getApiUrl,
    generateShortStatus,
    CONFIG_META
};`;
  }

  /**
     * Шаблон для orchestrator конфігурації
     */
  generateOrchestratorTemplate(target) {
    const exports = this.getExportedConfigs(target.exports);
    const timestamp = new Date().toISOString();

    return `/**
 * ORCHESTRATOR CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: ${timestamp}
 */

import GlobalConfig from '../config/global-config.js';

// Експортуємо серверні конфігурації
${exports.map(exp => `export const ${exp} = GlobalConfig.${exp};`).join('\n')}

// Серверні utility функції
export const getAgentConfig = GlobalConfig.getAgentConfig;
export const getWorkflowStage = GlobalConfig.getWorkflowStage;
export const getApiUrl = GlobalConfig.getApiUrl;
export const isServiceEnabled = GlobalConfig.isServiceEnabled;
export const getWebSocketUrl = GlobalConfig.getWebSocketUrl;
export const validateConfig = GlobalConfig.validateConfig;

// Налаштування середовища
export const ENV_CONFIG = GlobalConfig.ENV_CONFIG;
export const SECURITY_CONFIG = GlobalConfig.SECURITY_CONFIG;

export default GlobalConfig;`;
  }

  /**
     * Шаблон для voice control конфігурації
     */
  generateVoiceTemplate(target) {
    const timestamp = new Date().toISOString();
    const GC = this.globalConfig;
    const voiceConfig = GC.VOICE_CONFIG || {};
    const VOICE_CONFIG_OBJ = {
      ...voiceConfig,
      ACTIVATION_KEYWORD: (voiceConfig.activation?.keywords?.[0]) || 'атлас',
      SPEECH_RECOGNITION: voiceConfig.recognition,
      WHISPER_CONFIG: voiceConfig.whisper,
      STOP_KEYWORDS: voiceConfig.stopCommands,
      BUTTON_STATES: {
        IDLE: 'idle',
        GREEN_MODE: 'green_mode',
        BLUE_MODE: 'blue_mode',
        PROCESSING: 'processing'
      },
      BUTTON_ICONS: {
        IDLE: '🎤',
        GREEN_MODE: '🟢',
        BLUE_MODE: '🔵',
        PROCESSING: '⏳'
      },
      POST_CHAT_CONFIG: voiceConfig.postChat,
      POST_CHAT: voiceConfig.postChat,
      BACKGROUND_PHRASE_FILTER: voiceConfig.backgroundFilter
    };

    return `/**
 * VOICE CONTROL CONFIGURATION (browser-safe)
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: ${timestamp}
 */

export const VOICE_CONFIG = ${JSON.stringify(VOICE_CONFIG_OBJ, null, 4)};

// TTS конфігурація
export const TTS_CONFIG = ${JSON.stringify(GC.TTS_CONFIG || {}, null, 4)};

// API endpoints
export const API_ENDPOINTS = ${JSON.stringify(GC.API_ENDPOINTS || {}, null, 4)};

// Utility функції для голосового управління
export function isBackgroundPhrase(text) {
    if (!text || typeof text !== 'string') return true;
    
    const config = VOICE_CONFIG.BACKGROUND_PHRASE_FILTER;
    if (!config.enabled) return false;
    
    const cleanText = text.toLowerCase().trim();
    
    if (cleanText.length < config.minPhraseLength) return true;
    
    for (const ignoredPhrase of config.ignoredPhrases) {
        if (cleanText.includes(ignoredPhrase.toLowerCase())) {
            return true;
        }
    }
    
    if (cleanText.length <= config.maxBackgroundLength) {
        const commonBackgroundWords = [
            'так', 'ні', 'добре', 'гаразд', 'окей', 'ок', 'угу', 'ага',
            'хм', 'ем', 'ну', 'от', 'це', 'то', 'а', 'і', 'або', 'але',
            'дякую', 'спасибі', 'будь ласка', 'вибачте', 'пробачте'
        ];
        
        const words = cleanText.split(/\\s+/).filter(w => w.length > 0);
        if (words.length <= 2 && words.every(word => commonBackgroundWords.includes(word))) {
            return true;
        }
    }
    
    return false;
}

export function isUserCommand(text, confidence = 1.0) {
    if (isBackgroundPhrase(text)) return false;
    
    const config = VOICE_CONFIG.BACKGROUND_PHRASE_FILTER;
    
    if (confidence < config.commandConfidenceThreshold && text.length < 20) {
        return false;
    }
    
    const commandIndicators = [
        'що', 'як', 'де', 'коли', 'чому', 'хто', 'скільки', 'який', 'яка', 'яке', 'які',
        'зроби', 'створи', 'напиши', 'покажи', 'знайди', 'відкрий', 'закрий', 'запусти',
        'допоможи', 'поясни', 'розкажи', 'скажи', 'можеш', 'хочу', 'потрібно', 'треба'
    ];
    
    const lowerText = text.toLowerCase();
    const hasCommandIndicator = commandIndicators.some(indicator => lowerText.includes(indicator));
    
    if (hasCommandIndicator) return true;
    if (text.length > 30) return true;
    
    return confidence >= config.commandConfidenceThreshold;
}

export default VOICE_CONFIG;`;
  }

  /**
     * Шаблон для voice-control/core/config.js
     */
  generateVoiceCoreTemplate(target) {
    const timestamp = new Date().toISOString();
    const GC = this.globalConfig;

    // Створюємо розширену конфігурацію для voice core
    const VOICE_CONFIG_EXTENDED = {
      ...GC.VOICE_CONFIG,
      recognition: {
        ...GC.VOICE_CONFIG?.recognition,
        errorHandling: {
          maxConsecutiveNoSpeech: 3,
          maxNetworkErrors: 10,
          networkBackoffBase: 2000,
          networkBackoffMax: 60000,
          networkExtendedCooldownAfter: 3,
          extendedCooldownDuration: 30000
        }
      }
    };

    const AUDIO_CONFIG_EXTENDED = {
      constraints: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      },
      recording: {
        maxDuration: 30000,
        silenceTimeout: 2000,
        volumeThreshold: 0.01
      }
    };

    return `/**
 * VOICE CONTROL CORE CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: ${timestamp}
 * 
 * ⚠️ НЕ РЕДАГУЙТЕ ЦЕЙ ФАЙЛ ВРУЧНУ!
 * Всі зміни будуть перезаписані при наступній синхронізації.
 * Для змін використовуйте config/global-config.js
 */

// Експорт розширених конфігурацій для voice control core
export const VOICE_CONFIG = ${JSON.stringify(VOICE_CONFIG_EXTENDED, null, 4)};

export const TTS_CONFIG = ${JSON.stringify(GC.TTS_CONFIG || {}, null, 4)};

export const API_ENDPOINTS = ${JSON.stringify(GC.API_ENDPOINTS || {}, null, 4)};

export const AUDIO_CONFIG = ${JSON.stringify(AUDIO_CONFIG_EXTENDED, null, 4)};

// Utility функції
export function createAudioConstraints(config = AUDIO_CONFIG) {
    return {
        audio: {
            ...config.constraints.audio,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };
}

export function getVoiceErrorConfig() {
    return VOICE_CONFIG.recognition?.errorHandling || {};
}

export default VOICE_CONFIG;
`;
  }

  /**
     * Шаблон для core конфігурації
     */
  generateCoreTemplate(target) {
    const exports = this.getExportedConfigs(target.exports);
    const timestamp = new Date().toISOString();
    const GC = this.globalConfig;
    const exportDecls = exports.map(exp => `export const ${exp} = ${JSON.stringify(GC[exp], null, 4)};`).join('\n\n');

    return `/**
 * CORE CONFIGURATION (browser-safe)
 * 🔄 Автоматично згенеровано Config Manager  
 * 📅 Останнє оновлення: ${timestamp}
 */

${exportDecls}

// Utility функції
export function getAgentByName(name) {
    if (!name) return null;
    const key = String(name).toLowerCase();
    return (AGENTS && AGENTS[key]) || null;
}

export function getWorkflowStage(stageNumber) {
    if (!Array.isArray(WORKFLOW_STAGES)) return null;
    return WORKFLOW_STAGES.find(stage => stage.stage === stageNumber) || null;
}

export function getApiUrl(service, endpoint = '') {
    const baseUrl = API_ENDPOINTS && API_ENDPOINTS[service];
    if (!baseUrl) throw new Error(\`Невідомий сервіс: \${service}\`);
    return endpoint ? \`${'${'}baseUrl${'}'}${'${'}endpoint${'}'}\` : baseUrl;
}

export function generateShortStatus(agent, stage, action) {
    const statusMessages = {
        atlas: {
            stage1_initial_processing: "Atlas аналізує запит та готує завдання",
            stage0_chat: "Atlas відповідає в режимі спілкування",
            stage3_clarification: "Atlas надає уточнення",
            stage6_task_adjustment: "Atlas коригує завдання",
            stage9_retry_cycle: "Atlas координує новий цикл"
        },
        tetyana: {
            stage2_execution: "Тетяна виконує завдання",
            stage4_retry: "Тетяна повторює з уточненнями"
        },
        grisha: {
            stage5_diagnosis: "Гриша діагностує проблеми",
            stage7_verification: "Гриша перевіряє результати"
        },
        system: {
            stage0_mode_selection: "Система визначає тип запиту",
            stage8_completion: "Системне завершення"
        }
    };
    return (statusMessages[agent]?.[stage]) || \`${'${'}agent${'}'} виконує ${'${'}stage${'}'}\`;
}

export default {
${exports.map(exp => `    ${exp}`).join(',\n')},
    getAgentByName,
    getWorkflowStage,
    getApiUrl,
    generateShortStatus
};`;
  }

  /**
     * Шаблон для legacy конфігурації
     */
  generateLegacyTemplate(target) {
    const exports = this.getExportedConfigs(target.exports);
    const timestamp = new Date().toISOString();

    return `/**
 * LEGACY SHARED CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: ${timestamp}
 * 
 * ⚠️ Цей файл підтримується для зворотної сумісності
 * Рекомендується використовувати config/global-config.js
 */

// Імпорт з глобальної конфігурації
import GlobalConfig from './config/global-config.js';

// Експорт для зворотної сумісності
${exports.map(exp => `export const ${exp} = GlobalConfig.${exp};`).join('\n')}

// Utility функції
export function getAgentByName(name) {
    return GlobalConfig.getAgentConfig(name);
}

export function getWorkflowStage(stageNumber) {
    return GlobalConfig.getWorkflowStage(stageNumber);
}

export function getApiUrl(service, endpoint = '') {
    return GlobalConfig.getApiUrl(service, endpoint);
}

export function generateShortStatus(agent, stage, action) {
    return GlobalConfig.generateShortStatus(agent, stage, action);
}

// Експорт за замовчуванням
export default GlobalConfig;`;
  }

  /**
     * Отримати конфігурації для експорту
     */
  getExportedConfigs(exportList) {
    return exportList.filter(exp => this.globalConfig[exp]);
  }

  /**
     * Створити backup поточних конфігурацій
     */
  async createBackup() {
    const backupDir = join(this.projectRoot, 'config', 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `backup-${timestamp}`);

    // Створюємо директорію backup
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    mkdirSync(backupPath, { recursive: true });

    console.log(`📦 Створюємо backup конфігурацій у: ${backupPath}`);

    // Копіюємо всі існуючі конфігурації
    for (const [name, target] of this.syncTargets) {
      if (existsSync(target.fullPath)) {
        const content = readFileSync(target.fullPath, 'utf8');
        const backupFile = join(backupPath, `${name}.js`);
        writeFileSync(backupFile, content);
        console.log(`   📄 ${name}.js збережено`);
      }
    }

    // Зберігаємо метадані backup
    const metadata = {
      timestamp: new Date().toISOString(),
      targets: Array.from(this.syncTargets.keys()),
      globalConfigHash: this.calculateConfigHash()
    };

    writeFileSync(join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    return backupPath;
  }

  /**
     * Відновити конфігурації з backup
     */
  async restoreFromBackup(backupPath) {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup не знайдено: ${backupPath}`);
    }

    const metadataPath = join(backupPath, 'metadata.json');
    if (!existsSync(metadataPath)) {
      throw new Error('Метадані backup не знайдено');
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    console.log(`🔄 Відновлюємо конфігурації з backup від ${metadata.timestamp}`);

    for (const targetName of metadata.targets) {
      const backupFile = join(backupPath, `${targetName}.js`);
      const target = this.syncTargets.get(targetName);

      if (existsSync(backupFile) && target) {
        const content = readFileSync(backupFile, 'utf8');

        // Створюємо директорію якщо потрібно
        const dir = dirname(target.fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(target.fullPath, content);
        console.log(`   ✅ ${targetName} відновлено`);
      }
    }
  }

  /**
     * Очистити застарілі backup
     */
  async cleanupBackups(keepCount = 10) {
    const backupDir = join(this.projectRoot, 'config', 'backups');
    if (!existsSync(backupDir)) return;

    const backups = (await fs.readdir(backupDir))
      .filter(name => name.startsWith('backup-'))
      .sort()
      .reverse();

    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount);
      for (const backup of toDelete) {
        const backupPath = join(backupDir, backup);
        await fs.rm(backupPath, { recursive: true, force: true });
        console.log(`🗑️ Видалено застарілий backup: ${backup}`);
      }
    }
  }

  /**
     * Показати статус синхронізації
     */
  getStatus() {
    const status = {
      globalConfig: {
        hash: this.calculateConfigHash(),
        needsSync: this.needsSync()
      },
      targets: {}
    };

    for (const [name, target] of this.syncTargets) {
      status.targets[name] = {
        path: target.path,
        exists: existsSync(target.fullPath),
        lastSync: target.lastSync,
        checksum: target.checksum
      };
    }

    return status;
  }
}

// Створюємо екземпляр менеджера
const configManager = new ConfigManager();

// Експортуємо функції для використання
export const syncAllConfigs = () => configManager.syncAll();
export const syncConfig = (name) => configManager.syncTarget(name, configManager.syncTargets.get(name));
export const createConfigBackup = () => configManager.createBackup();
export const restoreConfigBackup = (path) => configManager.restoreFromBackup(path);
export const getConfigStatus = () => configManager.getStatus();
export const validateGlobalConfig = () => configManager.globalConfig.validateConfig();

// Експорт менеджера за замовчуванням
export default configManager;
