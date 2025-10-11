/**
 * Prompt Loader
 *
 * Динамічне завантаження промптів для різних етапів workflow
 * Винесено з executor.js для модульності
 */

import logger from '../../utils/logger.js';

/**
 * Завантаження промптів для конкретного етапу
 * @param {number} stage - Номер етапу
 * @param {string} agent - Назва агента
 * @param {string} name - Назва етапу
 * @param {string} userMessage - Повідомлення користувача
 * @param {Object} session - Сесія workflow
 * @returns {Promise<{systemPrompt: string, userPrompt: string}|null>}
 */
export async function loadStagePrompts(stage, agent, name, userMessage, session) {
  try {
    let systemPrompt, userPrompt;

    switch (stage) {
      case -3: // TTS Optimization
        return await loadTTSOptimizationPrompts(session, userMessage, name);

      case 0:
        if (agent === 'system') {
          return await loadModeSelectionPrompts(userMessage);
        }
        if (agent === 'atlas') {
          return await loadAtlasChatPrompts(userMessage, session);
        }
        break;

      case 1: // Atlas initial_processing
        return await loadAtlasStage1Prompts(userMessage);

      case 2: // Tetyana execution
        return await loadTetyanaStage2Prompts(userMessage, session);

      case 3: // Atlas clarification
        return await loadAtlasStage3Prompts(userMessage, session);

      case 4: // Tetyana retry_execution
        return await loadTetyanaStage4Prompts(userMessage, session);

      case 5: // Grisha diagnosis
        return await loadGrishaStage5Prompts(userMessage, session);

      case 6: // Atlas task_adjustment
        return await loadAtlasStage6Prompts(userMessage, session);

      case 7: // Grisha verification
        return await loadGrishaStage7Prompts(userMessage, session);

      case 8: // System completion
        return {
          systemPrompt: 'System completion stage',
          userPrompt: 'Workflow completed'
        };

      case 9: // Atlas retry_cycle
        return await loadAtlasStage9Prompts(userMessage, session);

      default:
        return null;
    }

    return { systemPrompt, userPrompt };
  } catch (error) {
    logger.error(`Failed to load prompts for stage ${stage}`, { error: error.message });
    return null;
  }
}

/**
 * TTS Optimization (Stage -3)
 */
async function loadTTSOptimizationPrompts(session, userMessage, name) {
  const ttsStage = await import('../../../prompts/system/stage_minus3_tts_optimization.js');
  const lastResponse = session.history.slice(-1)[0];
  const originalText = lastResponse ? lastResponse.content : userMessage;
  const sourceAgent = lastResponse ? lastResponse.agent : 'unknown';
  const mode = session?.modeSelection?.mode || 'chat';

  return {
    systemPrompt: ttsStage.SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_SYSTEM_PROMPT,
    userPrompt: ttsStage.SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_USER_PROMPT(
      originalText,
      sourceAgent,
      mode,
      name
    )
  };
}

/**
 * Mode Selection (Stage 0 - System)
 */
async function loadModeSelectionPrompts(userMessage) {
  const sys0 = await import('../../../prompts/system/stage0_mode_selection.js');
  return {
    systemPrompt: sys0.SYSTEM_STAGE0_SYSTEM_PROMPT,
    userPrompt: sys0.SYSTEM_STAGE0_USER_PROMPT(userMessage)
  };
}

/**
 * Atlas Chat (Stage 0 - Atlas)
 */
async function loadAtlasChatPrompts(userMessage, session) {
  const a0 = await import('../../../prompts/atlas/stage0_chat.js');

  // Контекст останніх 3 повідомлень чату (очищений формат)
  const ctx = (session.chatThread?.messages || [])
    .slice(-3)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Перенесення контексту з історії (якщо є)
  const carry = (session.chatThread?.carryOvers || [])
    .slice(-1)
    .map(c => `ПОПЕРЕДНІЙ ПІДСУМОК (інша тема: ${c.topic || '—'}): ${c.summary}`)
    .join('\n');

  // Створюємо enriched контекст замість додавання до userMessage
  let contextPart = '';
  if (ctx) contextPart += `\n\nКОНТЕКСТ ПОПЕРЕДНЬОЇ БЕСІДИ:\n${ctx}`;
  if (carry) contextPart += `\n\nІСТОРІЯ (короткий підсумок попередньої теми):\n${carry}`;

  return {
    systemPrompt: a0.ATLAS_STAGE0_CHAT_SYSTEM_PROMPT,
    userPrompt: a0.ATLAS_STAGE0_CHAT_USER_PROMPT(userMessage + contextPart, session)
  };
}

/**
 * Atlas Initial Processing (Stage 1)
 */
async function loadAtlasStage1Prompts(userMessage) {
  const atlasStage1 = await import('../../../prompts/atlas/stage1_initial_processing.js');
  return {
    systemPrompt: atlasStage1.ATLAS_STAGE1_SYSTEM_PROMPT,
    userPrompt: atlasStage1.ATLAS_STAGE1_USER_PROMPT(userMessage, '')
  };
}

/**
 * Tetyana Execution (Stage 2)
 */
async function loadTetyanaStage2Prompts(userMessage, session) {
  const tetyanaStage2 = await import('../../../prompts/tetyana/stage2_execution.js');

  // Остання відповідь Atlas як завдання
  const lastAtlasResponse = session.history.filter(r => r.agent === 'atlas').pop();
  const atlasTask = lastAtlasResponse ? lastAtlasResponse.content : userMessage;

  return {
    systemPrompt: tetyanaStage2.TETYANA_STAGE2_SYSTEM_PROMPT,
    userPrompt: tetyanaStage2.TETYANA_STAGE2_USER_PROMPT(atlasTask, userMessage)
  };
}

/**
 * Atlas Clarification (Stage 3)
 */
async function loadAtlasStage3Prompts(userMessage, session) {
  const atlasStage3 = await import('../../../prompts/atlas/stage3_clarification.js');

  const lastTetyanaResponse = session.history.filter(r => r.agent === 'tetyana').pop();
  const tetyanaResponse = lastTetyanaResponse ? lastTetyanaResponse.content : '';
  const originalTask = session.history.filter(r => r.agent === 'atlas')[0]?.content || '';

  return {
    systemPrompt: atlasStage3.ATLAS_STAGE3_SYSTEM_PROMPT,
    userPrompt: atlasStage3.ATLAS_STAGE3_USER_PROMPT(tetyanaResponse, originalTask, userMessage)
  };
}

/**
 * Tetyana Retry (Stage 4)
 */
async function loadTetyanaStage4Prompts(userMessage, session) {
  const tetyanaStage4 = await import('../../../prompts/tetyana/stage4_retry.js');

  const lastAtlasGuidance = session.history.filter(r => r.agent === 'atlas').pop()?.content || '';
  const originalTask = session.history.filter(r => r.agent === 'atlas')[0]?.content || userMessage;
  const previousAttempt = session.history.filter(r => r.agent === 'tetyana').pop()?.content || '';

  return {
    systemPrompt: tetyanaStage4.TETYANA_STAGE4_SYSTEM_PROMPT,
    userPrompt: tetyanaStage4.TETYANA_STAGE4_USER_PROMPT(lastAtlasGuidance, originalTask, previousAttempt)
  };
}

/**
 * Grisha Diagnosis (Stage 5)
 */
async function loadGrishaStage5Prompts(userMessage, session) {
  const grishaStage5 = await import('../../../prompts/grisha/stage5_diagnosis.js');

  const atlasAttempts = session.history
    .filter(r => r.agent === 'atlas')
    .map(r => r.content)
    .join('\n\n');

  const tetyanaAttempts = session.history
    .filter(r => r.agent === 'tetyana')
    .map(r => r.content)
    .join('\n\n');

  return {
    systemPrompt: grishaStage5.GRISHA_STAGE5_SYSTEM_PROMPT,
    userPrompt: grishaStage5.GRISHA_STAGE5_USER_PROMPT(userMessage, atlasAttempts, tetyanaAttempts)
  };
}

/**
 * Atlas Task Adjustment (Stage 6)
 */
async function loadAtlasStage6Prompts(userMessage, session) {
  const atlasStage6 = await import('../../../prompts/atlas/stage6_task_adjustment.js');

  const grishaDiagnosis = session.history.filter(r => r.agent === 'grisha').pop()?.content || '';
  const allPreviousAttempts = session.history
    .filter(r => r.agent === 'tetyana')
    .map(r => r.content)
    .join('\n\n');

  return {
    systemPrompt: atlasStage6.ATLAS_STAGE6_SYSTEM_PROMPT,
    userPrompt: atlasStage6.ATLAS_STAGE6_USER_PROMPT(userMessage, grishaDiagnosis, allPreviousAttempts)
  };
}

/**
 * Grisha Verification (Stage 7)
 */
async function loadGrishaStage7Prompts(userMessage, session) {
  const grishaStage7 = await import('../../../prompts/grisha/stage7_verification.js');

  // Get LAST (most recent) execution result from Tetyana
  const executionResults = session.history.filter(r => r.agent === 'tetyana').pop()?.content || '';

  // Get LAST (most recent) expected outcome from Atlas, not first!
  const expectedOutcome = session.history.filter(r => r.agent === 'atlas').pop()?.content || userMessage;

  return {
    systemPrompt: grishaStage7.GRISHA_STAGE7_SYSTEM_PROMPT,
    userPrompt: grishaStage7.GRISHA_STAGE7_USER_PROMPT(userMessage, executionResults, expectedOutcome)
  };
}

/**
 * Atlas Retry Cycle (Stage 9)
 */
async function loadAtlasStage9Prompts(userMessage, session) {
  const atlasStage9 = await import('../../../prompts/atlas/stage9_retry_cycle.js');

  const grishaVerificationReport = session.history.filter(r => r.agent === 'grisha').pop()?.content || '';
  const allPreviousAttempts = session.history
    .filter(r => r.agent === 'tetyana')
    .map(r => r.content)
    .join('\n\n');

  return {
    systemPrompt: atlasStage9.ATLAS_STAGE9_SYSTEM_PROMPT,
    userPrompt: atlasStage9.ATLAS_STAGE9_USER_PROMPT(userMessage, grishaVerificationReport, allPreviousAttempts)
  };
}

export default loadStagePrompts;
