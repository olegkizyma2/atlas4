#!/usr/bin/env node

/**
 * TEST CONFIG - Тестування централізованої системи конфігурацій
 */

import { join, resolve, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Кольори для консолі
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, details = '') {
  const symbol = status ? '✅' : '❌';
  const color = status ? 'green' : 'red';
  log(color, `${symbol} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function runTests() {
  log('blue', '🧪 Тестування централізованої системи конфігурацій ATLAS\n');

  const tests = [];
  let passed = 0;
  let failed = 0;

  // Тест 1: Перевірка існування глобальної конфігурації
  try {
    const globalConfigPath = join(__dirname, 'global-config.js');
    const exists = existsSync(globalConfigPath);
    tests.push(['Глобальна конфігурація існує', exists]);
    if (exists) passed++; else failed++;
  } catch (error) {
    tests.push(['Глобальна конфігурація існує', false, error.message]);
    failed++;
  }

  // Тест 2: Імпорт глобальної конфігурації
  try {
    const { default: GlobalConfig } = await import('./global-config.js');
    const hasAgents = GlobalConfig.AGENTS && Object.keys(GlobalConfig.AGENTS).length > 0;
    tests.push(['Імпорт глобальної конфігурації', hasAgents]);
    if (hasAgents) passed++; else failed++;
  } catch (error) {
    tests.push(['Імпорт глобальної конфігурації', false, error.message]);
    failed++;
  }

  // Тест 3: Перевірка config manager
  try {
    const ConfigManager = await import('./config-manager.js');
    const hasExports = ConfigManager.default && typeof ConfigManager.syncAllConfigs === 'function';
    tests.push(['Config Manager імпорт', hasExports]);
    if (hasExports) passed++; else failed++;
  } catch (error) {
    tests.push(['Config Manager імпорт', false, error.message]);
    failed++;
  }

  // Тест 4: Валідація глобальної конфігурації
  try {
    const { validateGlobalConfig } = await import('./config-manager.js');
    validateGlobalConfig();
    tests.push(['Валідація глобальної конфігурації', true]);
    passed++;
  } catch (error) {
    tests.push(['Валідація глобальної конфігурації', false, error.message]);
    failed++;
  }

  // Тест 5: Перевірка структури конфігурації
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    const requiredSections = ['AGENTS', 'WORKFLOW_STAGES', 'API_ENDPOINTS', 'TTS_CONFIG', 'VOICE_CONFIG'];
    const missingSections = requiredSections.filter(section => !GlobalConfig[section]);

    const structureValid = missingSections.length === 0;
    const details = structureValid ? 'Всі розділи присутні' : `Відсутні: ${missingSections.join(', ')}`;

    tests.push(['Структура конфігурації', structureValid, details]);
    if (structureValid) passed++; else failed++;
  } catch (error) {
    tests.push(['Структура конфігурації', false, error.message]);
    failed++;
  }

  // Тест 6: Перевірка агентів
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    const requiredAgents = ['atlas', 'tetyana', 'grisha', 'system'];
    const existingAgents = Object.keys(GlobalConfig.AGENTS || {});
    const missingAgents = requiredAgents.filter(agent => !existingAgents.includes(agent));

    const agentsValid = missingAgents.length === 0;
    const details = agentsValid ? `Знайдено ${existingAgents.length} агентів` : `Відсутні: ${missingAgents.join(', ')}`;

    tests.push(['Конфігурація агентів', agentsValid, details]);
    if (agentsValid) passed++; else failed++;
  } catch (error) {
    tests.push(['Конфігурація агентів', false, error.message]);
    failed++;
  }

  // Тест 7: Перевірка workflow етапів
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    const stages = GlobalConfig.WORKFLOW_STAGES || [];
    const hasStages = stages.length > 0;
    const allHaveAgents = stages.every(stage => stage.agent && stage.name);

    const stagesValid = hasStages && allHaveAgents;
    const details = `Знайдено ${stages.length} етапів`;

    tests.push(['Workflow етапи', stagesValid, details]);
    if (stagesValid) passed++; else failed++;
  } catch (error) {
    tests.push(['Workflow етапи', false, error.message]);
    failed++;
  }

  // Тест 8: Перевірка API endpoints
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    const endpoints = GlobalConfig.API_ENDPOINTS || {};
    const requiredServices = ['orchestrator', 'frontend', 'tts'];
    const missingServices = requiredServices.filter(service => !endpoints[service]);

    const endpointsValid = missingServices.length === 0;
    const details = endpointsValid ? `Знайдено ${Object.keys(endpoints).length} сервісів` : `Відсутні: ${missingServices.join(', ')}`;

    tests.push(['API Endpoints', endpointsValid, details]);
    if (endpointsValid) passed++; else failed++;
  } catch (error) {
    tests.push(['API Endpoints', false, error.message]);
    failed++;
  }

  // Тест 9: Перевірка utility функцій
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    const requiredFunctions = ['getAgentConfig', 'getWorkflowStage', 'getApiUrl'];
    const existingFunctions = requiredFunctions.filter(func => typeof GlobalConfig[func] === 'function');

    const functionsValid = existingFunctions.length === requiredFunctions.length;
    const details = `${existingFunctions.length}/${requiredFunctions.length} функцій доступно`;

    tests.push(['Utility функції', functionsValid, details]);
    if (functionsValid) passed++; else failed++;
  } catch (error) {
    tests.push(['Utility функції', false, error.message]);
    failed++;
  }

  // Тест 10: Тестування функціональності
  try {
    const { default: GlobalConfig } = await import('./global-config.js');

    // Тестуємо getAgentConfig
    const atlasAgent = GlobalConfig.getAgentConfig('atlas');
    const atlasValid = atlasAgent && atlasAgent.name === 'Атлас';

    // Тестуємо що invalid агент повертає null (без помилки)
    let invalidAgentHandled = false;
    try {
      const invalidAgent = GlobalConfig.getAgentConfig('invalid');
      // Якщо функція повертає null/undefined замість помилки
      invalidAgentHandled = !invalidAgent;
    } catch (error) {
      // Якщо функція кидає помилку для invalid агента - це теж правильна поведінка
      invalidAgentHandled = error.message.includes('not found');
    }

    // Тестуємо getWorkflowStage
    const stage1 = GlobalConfig.getWorkflowStage(1);
    const stageValid = stage1 && stage1.stage === 1;

    // Тестуємо що invalid stage повертає null
    let invalidStageHandled = false;
    try {
      const invalidStage = GlobalConfig.getWorkflowStage(999);
      invalidStageHandled = !invalidStage;
    } catch (error) {
      // Якщо кидає помилку - теж правильно
      invalidStageHandled = error.message.includes('not found');
    }

    // Тестуємо getApiUrl
    const orchestratorUrl = GlobalConfig.getApiUrl('orchestrator');
    const urlValid = orchestratorUrl && orchestratorUrl.includes('localhost');

    const functionalityValid = atlasValid && invalidAgentHandled && stageValid && invalidStageHandled && urlValid;

    const details = `Atlas: ${atlasValid}, InvalidAgent: ${invalidAgentHandled}, Stage: ${stageValid}, InvalidStage: ${invalidStageHandled}, URL: ${urlValid}`;

    tests.push(['Функціональність utility', functionalityValid, details]);
    if (functionalityValid) passed++; else failed++;
  } catch (error) {
    tests.push(['Функціональність utility', false, error.message]);
    failed++;
  }

  // Виведення результатів
  log('bold', '\n📊 Результати тестування:');
  tests.forEach(([name, status, details]) => {
    logTest(name, status, details);
  });

  // Підсумок
  console.log('\n' + '='.repeat(50));
  log('bold', `📈 Підсумок: ${passed} ✅ / ${failed} ❌ (Всього: ${tests.length})`);

  if (failed === 0) {
    log('green', '🎉 Всі тести пройшли успішно!');
    log('cyan', '📋 Система конфігурацій готова до використання');
    return true;
  } else {
    log('red', '💥 Деякі тести не пройшли');
    log('yellow', '🔧 Перевірте помилки вище та виправте їх');
    return false;
  }
}

// Додатковий тест синхронізації
async function testSync() {
  log('blue', '\n🔄 Тестування синхронізації...');

  try {
    const { getConfigStatus } = await import('./config-manager.js');
    const status = getConfigStatus();

    console.log('Статус цілей:');
    for (const [name, target] of Object.entries(status.targets)) {
      const exists = target.exists ? '✅' : '❌';
      console.log(`   ${exists} ${name} (${target.path})`);
    }

    return true;
  } catch (error) {
    log('red', `❌ Помилка тестування синхронізації: ${error.message}`);
    return false;
  }
}

// Основна функція
async function main() {
  const basicTestsPassed = await runTests();

  if (basicTestsPassed) {
    await testSync();
  }

  const exitCode = basicTestsPassed ? 0 : 1;
  process.exit(exitCode);
}

// Запуск при прямому виклику
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log('red', `💥 Критична помилка: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

export default { runTests, testSync };
