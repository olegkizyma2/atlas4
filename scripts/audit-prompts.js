#!/usr/bin/env node
/**
 * ATLAS Prompts and Stages Audit Tool
 * Перевірка відповідності промптів та стейджів у workflow конфігурації
 */

import { WORKFLOW_STAGES } from '../config/workflow-config.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROMPTS_DIR = join(PROJECT_ROOT, 'prompts');

async function auditPrompts() {
  console.log('🔍 ATLAS PROMPTS & STAGES AUDIT\n');
  console.log('═'.repeat(60));

  // Збираємо всі етапи з конфігу
  const configStages = new Map();
  for (const stage of WORKFLOW_STAGES) {
    const key = `${stage.agent}:stage${stage.stage}_${stage.name}`;
    configStages.set(key, stage);
  }

  console.log(`📋 Total stages in workflow-config: ${WORKFLOW_STAGES.length}`);

  // Збираємо всі файли промптів
  const agents = ['atlas', 'tetyana', 'grisha', 'system'];
  const foundPrompts = new Map();

  for (const agent of agents) {
    const agentDir = join(PROMPTS_DIR, agent);
    try {
      const files = await readdir(agentDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && f.startsWith('stage'));

      for (const file of jsFiles) {
        const key = `${agent}:${file.replace('.js', '')}`;
        foundPrompts.set(key, { agent, file });
      }
    } catch (e) {
      // Агент може не мати промптів
    }
  }

  console.log(`📄 Total prompt files found: ${foundPrompts.size}`);
  console.log('═'.repeat(60) + '\n');

  // Перевірка відповідності
  const missing = [];
  const extra = [];
  const matched = [];

  // Перевірка чи всі етапи мають промпти
  for (const stage of WORKFLOW_STAGES) {
    const stageName = `stage${stage.stage}_${stage.name}`;
    const key = `${stage.agent}:${stageName}`;

    if (foundPrompts.has(key)) {
      matched.push({ stage: stage.stage, agent: stage.agent, name: stage.name });
    } else {
      missing.push({
        stage: stage.stage,
        agent: stage.agent,
        name: stage.name,
        expected: `${stageName}.js`,
        description: stage.description
      });
    }
  }

  // Перевірка чи немає зайвих промптів
  for (const [key, prompt] of foundPrompts.entries()) {
    const found = WORKFLOW_STAGES.some(stage => {
      const stageName = `stage${stage.stage}_${stage.name}`;
      return key === `${stage.agent}:${stageName}`;
    });

    if (!found) {
      extra.push(prompt);
    }
  }

  // Виведення результатів
  console.log('📊 SUMMARY');
  console.log('─'.repeat(60));
  console.log(`✅ Matched stages with prompts: ${matched.length}`);
  console.log(`❌ Missing prompt files: ${missing.length}`);
  console.log(`⚠️  Extra prompt files (not in config): ${extra.length}`);
  console.log('');

  if (missing.length > 0) {
    console.log('❌ MISSING PROMPTS (defined in config but no file):');
    console.log('─'.repeat(60));
    missing.forEach(m => {
      console.log(`  Stage ${m.stage.toString().padStart(2)} | ${m.agent.padEnd(12)} | ${m.expected}`);
      console.log(`           ${m.description}`);
    });
    console.log('');
  }

  if (extra.length > 0) {
    console.log('⚠️  EXTRA PROMPTS (file exists but not in config):');
    console.log('─'.repeat(60));
    extra.forEach(e => {
      console.log(`  ${e.agent.padEnd(12)} | ${e.file}`);
    });
    console.log('');
  }

  console.log('📋 ALL STAGES STATUS:');
  console.log('─'.repeat(60));
  WORKFLOW_STAGES.forEach(stage => {
    const stageName = `stage${stage.stage}_${stage.name}`;
    const key = `${stage.agent}:${stageName}`;
    const status = foundPrompts.has(key) ? '✅' : '❌';
    const required = stage.required ? '[REQ]' : '[OPT]';
    console.log(`${status} ${required} Stage ${stage.stage.toString().padStart(2)} | ${stage.agent.padEnd(12)} | ${stage.name}`);
  });

  console.log('\n' + '═'.repeat(60));

  // Повертаємо код помилки тільки якщо є критичні проблеми (відсутні ОБОВ'ЯЗКОВІ промпти)
  const missingRequired = missing.filter(m => {
    const stage = WORKFLOW_STAGES.find(s => s.stage === m.stage && s.agent === m.agent);
    return stage && stage.required;
  });

  if (missingRequired.length > 0) {
    console.log('\n❌ ERROR: Required prompts are missing!');
    missingRequired.forEach(m => console.log(`   - Stage ${m.stage}: ${m.expected}`));
    process.exit(1);
  } else {
    console.log('\n✅ All required prompts are present!');
    if (extra.length > 0) {
      console.log(`⚠️  Note: ${extra.length} extra prompt files detected (non-critical)`);
    }
    process.exit(0);
  }
}

auditPrompts().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
