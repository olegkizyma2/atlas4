/**
 * WORKFLOW CONDITIONS
 * Умови переходу між етапами workflow
 */

import { analyzeAgentResponse } from '../ai/state-analyzer.js';

export const WORKFLOW_CONDITIONS = {
  async system_selected_chat(data) {
    // Очікуємо результат класифікації у session.modeSelection
    const session = data?.session;
    const lastSystem = session?.history?.filter(r => r.agent === 'system').pop();
    let mode = session?.modeSelection?.mode;
    if (!mode && lastSystem?.meta?.modeSelection) {
      mode = lastSystem.meta.modeSelection.mode;
    }
    return mode === 'chat';
  },

  async system_selected_task(data) {
    const session = data?.session;
    const lastSystem = session?.history?.filter(r => r.agent === 'system').pop();
    let mode = session?.modeSelection?.mode;
    if (!mode && lastSystem?.meta?.modeSelection) {
      mode = lastSystem.meta.modeSelection.mode;
    }

    // Додаткове логування для налагодження
    console.log(`[WORKFLOW CONDITIONS] system_selected_task check:`, {
      sessionMode: session?.modeSelection?.mode,
      lastSystemMeta: lastSystem?.meta?.modeSelection,
      finalMode: mode,
      result: mode === 'task'
    });

    return mode === 'task';
  },

  async atlas_chat_completed(data) {
    // Перевіряємо чи Atlas щойно завершив відповідь в режимі чату
    const session = data?.session;
    // Відповіді можуть мати stage як рядок 'stage0_chat' або число 0 — врахуємо обидва випадки
    const lastAtlasResponse = session?.history?.filter(r => {
      if (r.agent !== 'atlas') return false;
      if (typeof r.stage === 'string') return r.stage.includes('stage0_chat');
      if (typeof r.stage === 'number') return r.stage === 0;
      return false;
    }).pop();

    // Умова спрацьовує якщо остання відповідь Atlas була в chat режимі та TTS завершено
    return lastAtlasResponse &&
               session?.modeSelection?.mode === 'chat' &&
               !session?.ttsActive; // TTS має завершитися перед аналізом
  },
  async tetyana_needs_clarification(data) {
    if (!data?.response?.content || data.response.agent !== 'tetyana') return false;
    const aiAnalysis = await analyzeAgentResponse('tetyana', data.response.content, 'execution');
    console.log(`[WORKFLOW] Tetyana clarification check: ${aiAnalysis.predicted_state} (confidence: ${aiAnalysis.confidence})`);
    return aiAnalysis.predicted_state === 'needs_clarification' && aiAnalysis.confidence > 0.6;
  },

  async atlas_provided_clarification(data) {
    if (!data?.response?.content || data.response.agent !== 'atlas') return false;

    // Чистий AI аналіз без хардкордів - довіряємо інтелекту системи
    const aiAnalysis = await analyzeAgentResponse('atlas', data.response.content, 'clarification');
    const result = aiAnalysis.predicted_state === 'clarified' && aiAnalysis.confidence > 0.6;
    console.log(`[WORKFLOW] Atlas clarification check (AI): ${result} (confidence: ${aiAnalysis.confidence})`);
    return result;
  },

  async tetyana_still_blocked(data) {
    if (!data?.response?.content || data.response.agent !== 'tetyana') return false;
    const aiAnalysis = await analyzeAgentResponse('tetyana', data.response.content, 'block_detection');
    return aiAnalysis.predicted_state === 'blocked' && aiAnalysis.confidence > 0.7;
  },

  async grisha_provided_diagnosis(data) {
    if (!data?.response?.content || data.response.agent !== 'grisha') return false;
    // Гриша завжди надає діагностику якщо його викликали
    return data.response.content.length > 50; // Мінімальна довжина відповіді
  },

  async tetyana_completed_task(data) {
    if (!data?.response?.content || data.response.agent !== 'tetyana') return false;
    const aiAnalysis = await analyzeAgentResponse('tetyana', data.response.content, 'task_completion');
    console.log(`[WORKFLOW] Tetyana completion check: ${aiAnalysis.predicted_state} (confidence: ${aiAnalysis.confidence})`);
    return aiAnalysis.predicted_state === 'completed' && aiAnalysis.confidence > 0.7;
  },

  async verification_failed(data) {
    if (!data?.response?.content || data.response.agent !== 'grisha') return false;
    const aiAnalysis = await analyzeAgentResponse('grisha', data.response.content, 'verification_check');
    console.log(`[WORKFLOW] Grisha verification check: ${aiAnalysis.predicted_state} (confidence: ${aiAnalysis.confidence})`);
    return aiAnalysis.predicted_state === 'verification_failed' && aiAnalysis.confidence > 0.6;
  },

  async should_complete_workflow(data) {
    // Завершуємо workflow якщо верифікація пройшла або досягнуто ліміт циклів
    const session = data?.session;
    if (!session) return false;

    const lastGrishaResponse = session.history?.filter(r => r.agent === 'grisha').pop();
    if (lastGrishaResponse) {
      const verificationFailed = await this.verification_failed({ response: lastGrishaResponse, session });
      if (!verificationFailed) return true; // Верифікація пройшла
    }

    // Або досягнуто максимум циклів
    return (session.retryCycle || 0) >= 3;
  },

  async should_retry_cycle(data) {
    const session = data?.session;
    if (!session) return false;

    // Перевіряємо чи не досягнуто ліміт циклів
    const currentCycle = session.retryCycle || 0;
    if (currentCycle >= 2) return false; // Максимум 3 цикли (0, 1, 2)

    // Чистий AI аналіз - довіряємо інтелекту системи без хардкордів
    const lastGrishaResponse = session.history?.filter(r => r.agent === 'grisha').pop();
    if (lastGrishaResponse) {
      const verificationFailed = await this.verification_failed({ response: lastGrishaResponse, session });
      console.log(`[WORKFLOW] Should retry cycle (AI): ${verificationFailed} (cycle: ${currentCycle})`);
      return verificationFailed;
    }

    return false;
  }
};

/**
 * Клас для перевірки умов workflow
 */
class WorkflowConditions {
  static async checkCondition(conditionName, session) {
    if (!WORKFLOW_CONDITIONS[conditionName]) {
      console.warn(`[WORKFLOW CONDITIONS] Unknown condition: ${conditionName}`);
      return false;
    }

    try {
      return await WORKFLOW_CONDITIONS[conditionName]({ session });
    } catch (error) {
      console.error(`[WORKFLOW CONDITIONS] Error checking condition ${conditionName}:`, error);
      return false;
    }
  }
}

export default WorkflowConditions;
