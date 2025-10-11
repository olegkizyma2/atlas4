#!/usr/bin/env node
/**
 * ATLAS Prompts Quality Analyzer
 * Аналіз якості промптів: відповідність ролям, дублювання логіки, узгодженість
 */

import { WORKFLOW_STAGES } from '../config/workflow-config.js';
import { AGENTS } from '../config/agents-config.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROMPTS_DIR = join(PROJECT_ROOT, 'prompts');

// Очікувані експорти для кожного промпту
const EXPECTED_EXPORTS = ['SYSTEM_PROMPT', 'USER_PROMPT', 'default'];

// Критерії якості
const QUALITY_CHECKS = {
  hasSystemPrompt: (content) => content.includes('SYSTEM_PROMPT'),
  hasUserPrompt: (content) => content.includes('USER_PROMPT'),
  hasMetadata: (content) => content.includes('export default'),
  hasDescription: (content) => content.includes('РОЛЬ:') || content.includes('description'),
  hasVersion: (content) => content.includes('version'),
  isUkrainian: (content) => {
    const ukrainianWords = ['є', 'ті', 'що', 'як', 'для', 'та', 'або'];
    return ukrainianWords.some(word => content.includes(word));
  },
  hasNoHardcoding: (content) => {
    const hardcoded = ['localhost', '5101', '4000', 'http://'];
    return !hardcoded.some(pattern => content.includes(pattern));
  },
  hasProperStructure: (content) => {
    return content.includes('/**') && content.includes('export');
  }
};

async function analyzePromptQuality() {
  console.log('🔍 ATLAS PROMPTS QUALITY ANALYSIS\n');
  console.log('═'.repeat(60));

  const results = {
    total: 0,
    passed: 0,
    warnings: [],
    errors: [],
    duplicates: new Map()
  };

  // Словник для пошуку дублювання логіки
  const logicPatterns = new Map();

  console.log('📋 Analyzing each prompt...\n');

  for (const stage of WORKFLOW_STAGES) {
    const stageFileName = `stage${stage.stage}_${stage.name}.js`;
    const filePath = join(PROMPTS_DIR, stage.agent, stageFileName);

    try {
      const content = await readFile(filePath, 'utf-8');
      results.total++;

      console.log(`\n📄 ${stage.agent}/${stageFileName}`);
      console.log(`   Stage: ${stage.stage} | Agent: ${stage.agent} | Role: ${stage.description}`);

      let stageScore = 0;
      const stageIssues = [];

      // Перевірка якості
      for (const [check, fn] of Object.entries(QUALITY_CHECKS)) {
        if (fn(content)) {
          stageScore++;
        } else {
          stageIssues.push(check);
        }
      }

      // Перевірка відповідності ролі агента
      const agentConfig = AGENTS[stage.agent];
      if (agentConfig) {
        const roleMatch = content.toLowerCase().includes(agentConfig.role.toLowerCase()) ||
                         content.includes(agentConfig.description);
        if (!roleMatch) {
          stageIssues.push('roleAlignment');
          results.warnings.push(`${stageFileName}: Role mismatch with agent config`);
        }
      }

      // Пошук дублювання
      const patterns = content.match(/function\s+\w+|export\s+const\s+\w+/g) || [];
      patterns.forEach(pattern => {
        if (!logicPatterns.has(pattern)) {
          logicPatterns.set(pattern, []);
        }
        logicPatterns.get(pattern).push(stageFileName);
      });

      // Оцінка
      const scorePercent = Math.round((stageScore / Object.keys(QUALITY_CHECKS).length) * 100);
      const status = scorePercent >= 80 ? '✅' : scorePercent >= 60 ? '⚠️' : '❌';

      console.log(`   ${status} Score: ${scorePercent}% (${stageScore}/${Object.keys(QUALITY_CHECKS).length})`);

      if (stageIssues.length > 0) {
        console.log(`   Issues: ${stageIssues.join(', ')}`);
      }

      if (scorePercent >= 80) {
        results.passed++;
      } else {
        results.errors.push(`${stageFileName}: Low quality score (${scorePercent}%)`);
      }

    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
      results.errors.push(`${stageFileName}: Cannot read file`);
    }
  }

  // Пошук дублювання
  console.log('\n\n🔍 DUPLICATE LOGIC CHECK:\n');
  console.log('─'.repeat(60));

  let duplicatesFound = false;
  for (const [pattern, files] of logicPatterns.entries()) {
    if (files.length > 1) {
      console.log(`⚠️  Pattern "${pattern}" found in:`);
      files.forEach(file => console.log(`   - ${file}`));
      duplicatesFound = true;
      results.duplicates.set(pattern, files);
    }
  }

  if (!duplicatesFound) {
    console.log('✅ No significant code duplication detected');
  }

  // Підсумки
  console.log('\n\n📊 QUALITY SUMMARY:\n');
  console.log('═'.repeat(60));
  console.log(`Total prompts analyzed: ${results.total}`);
  console.log(`High quality (≥80%): ${results.passed}`);
  console.log(`Warnings: ${results.warnings.length}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Duplicate patterns: ${results.duplicates.size}`);

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(e => console.log(`   - ${e}`));
  }

  console.log('\n' + '═'.repeat(60));

  // Перевірка узгодженості з workflow
  console.log('\n🔗 WORKFLOW CONSISTENCY CHECK:\n');
  console.log('─'.repeat(60));

  let inconsistencies = 0;
  for (const stage of WORKFLOW_STAGES) {
    const agentConfig = AGENTS[stage.agent];
    if (!agentConfig) {
      console.log(`❌ Stage ${stage.stage}: Unknown agent "${stage.agent}"`);
      inconsistencies++;
    } else {
      console.log(`✅ Stage ${stage.stage}: ${stage.agent} (${agentConfig.role})`);
    }
  }

  if (inconsistencies === 0) {
    console.log('\n✅ All stages are consistent with agent configuration!');
  } else {
    console.log(`\n⚠️  Found ${inconsistencies} inconsistencies`);
  }

  // Фінальний висновок
  console.log('\n' + '═'.repeat(60));
  const qualityPercent = Math.round((results.passed / results.total) * 100);

  if (qualityPercent >= 90 && results.errors.length === 0) {
    console.log('\n✅ EXCELLENT: Prompts are well-structured and consistent!');
    process.exit(0);
  } else if (qualityPercent >= 70) {
    console.log('\n⚠️  GOOD: Some improvements needed');
    process.exit(0);
  } else {
    console.log('\n❌ NEEDS IMPROVEMENT: Significant quality issues detected');
    process.exit(1);
  }
}

analyzePromptQuality().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
