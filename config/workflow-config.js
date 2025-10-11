/**
 * ATLAS WORKFLOW CONFIGURATION
 * Конфігурація етапів і логіки workflow системи ATLAS
 *
 * Версія: 4.0.0
 * Автор: Atlas System
 * Дата створення: 2025-10-09
 */

// === WORKFLOW ЕТАПИ ===
export const WORKFLOW_STAGES = [
  {
    stage: -3,
    agent: 'system',
    name: 'tts_optimization',
    description: 'Оптимізація відповіді для TTS озвучки',
    required: false,
    condition: 'agent_response_for_tts',
    maxRetries: 2,
    timeout: 15000,
    expectedStates: ['optimized', 'fallback_used', 'no_optimization_needed']
  },
  {
    stage: -2,
    agent: 'system',
    name: 'post_chat_analysis',
    description: 'Пост-чат аналіз звернення користувача',
    required: false,
    condition: 'atlas_chat_completed',
    maxRetries: 0,
    timeout: 5000,
    expectedStates: ['continue_chat', 'ignore', 'clarify']
  },
  {
    stage: 0,
    agent: 'system',
    name: 'mode_selection',
    description: 'Класифікація: чат або завдання',
    required: true,
    maxRetries: 0,
    timeout: 10000,
    expectedStates: ['chat', 'task']
  },
  {
    stage: 0,
    agent: 'atlas',
    name: 'stage0_chat',
    description: 'Atlas в режимі спілкування через API 4000',
    required: false,
    condition: 'system_selected_chat',
    maxRetries: 0,
    timeout: 30000,
    expectedStates: ['chat_response']
  },
  {
    stage: 1,
    agent: 'atlas',
    name: 'initial_processing',
    description: 'Формалізація та структурування завдання',
    required: true,
    condition: 'system_selected_task',
    maxRetries: 1,
    timeout: 45000,
    expectedStates: ['task_processed', 'needs_clarification']
  },
  {
    stage: 2,
    agent: 'tetyana',
    name: 'execution',
    description: 'Виконання сформалізованого завдання',
    required: true,
    maxRetries: 2,
    timeout: 180000, // Збільшено до 3 хвилин для складних завдань типу зміни заставок
    expectedStates: ['completed', 'incomplete', 'blocked']
  },
  {
    stage: 3,
    agent: 'atlas',
    name: 'clarification',
    description: 'Надання уточнень для Тетяни',
    required: false,
    // REMOVED condition - логіка переходу в determineNextStage() (executor-v3.js case 2)
    maxRetries: 1,
    timeout: 30000,
    expectedStates: ['clarified', 'not_clarified']
  },
  {
    stage: 4,
    agent: 'tetyana',
    name: 'retry',
    description: 'Повторне виконання з уточненнями',
    required: false,
    // REMOVED condition - автоматичний перехід після stage 3
    maxRetries: 2,
    timeout: 90000,
    expectedStates: ['completed', 'incomplete', 'blocked']
  },
  {
    stage: 5,
    agent: 'grisha',
    name: 'diagnosis',
    description: 'Діагностика причин блокування',
    required: false,
    condition: 'tetyana_still_blocked',
    maxRetries: 1,
    timeout: 45000,
    expectedStates: ['problem_identified', 'cannot_identify']
  },
  {
    stage: 6,
    agent: 'atlas',
    name: 'task_adjustment',
    description: 'Корекція завдання на основі діагностики',
    required: false,
    condition: 'grisha_provided_diagnosis',
    maxRetries: 1,
    timeout: 30000,
    expectedStates: ['adjusted_task', 'not_adjusted']
  },
  {
    stage: 7,
    agent: 'grisha',
    name: 'verification',
    description: 'Перевірка правильності виконання',
    required: true,
    maxRetries: 1,
    timeout: 60000,
    expectedStates: ['verification_passed', 'verification_failed', 'verification_blocked']
  },
  {
    stage: 8,
    agent: 'system',
    name: 'completion',
    description: 'Системне завершення workflow',
    required: true,
    maxRetries: 0,
    timeout: 10000,
    expectedStates: ['success', 'failed', 'timeout_exceeded']
  },
  {
    stage: 9,
    agent: 'atlas',
    name: 'retry_cycle',
    description: 'Ініціація нового циклу виконання',
    required: false,
    condition: 'should_retry_cycle',
    maxRetries: 2,
    timeout: 30000,
    expectedStates: ['new_strategy', 'retry_limit_reached', 'user_update', 'auto_fix']
  }
];

// === WORKFLOW УМОВИ ===
export const WORKFLOW_CONDITIONS = {
  // Умови переходу між етапами
  'agent_response_for_tts': (context) => {
    return context.enableTTS && context.agentResponse && context.agentResponse.length > 100;
  },

  'atlas_chat_completed': (context) => {
    return context.currentStage === 0 && context.currentAgent === 'atlas' && context.stageCompleted;
  },

  'system_selected_chat': (context) => {
    return context.mode === 'chat';
  },

  'system_selected_task': (context) => {
    return context.mode === 'task';
  },

  'tetyana_needs_clarification': (context) => {
    return context.stageResult?.state === 'needs_clarification' ||
      context.stageResult?.state === 'incomplete';
  },

  'atlas_provided_clarification': (context) => {
    return context.previousStage === 3 && context.stageResult?.state === 'clarified';
  },

  'tetyana_still_blocked': (context) => {
    return context.stageResult?.state === 'blocked' ||
      (context.currentStage === 4 && context.stageResult?.state === 'incomplete');
  },

  'grisha_provided_diagnosis': (context) => {
    return context.previousStage === 5 && context.stageResult?.state === 'problem_identified';
  },

  'should_retry_cycle': (context) => {
    return context.currentStage === 8 &&
      context.stageResult?.state === 'failed' &&
      context.retryCount < 3;
  }
};

// === WORKFLOW КОНФІГУРАЦІЯ ===
export const WORKFLOW_CONFIG = {
  // Загальні налаштування
  general: {
    maxRetries: 3,
    defaultTimeout: 60000,
    enableLogging: true,
    enableMetrics: true,
    autoAdvance: true
  },

  // Налаштування retry логіки
  retry: {
    maxGlobalRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000
  },

  // Налаштування таймаутів
  timeouts: {
    stageTimeout: 300000,      // 5 хвилин на етап
    workflowTimeout: 1800000,  // 30 хвилин на весь workflow
    agentTimeout: 60000        // 1 хвилина на агента
  },

  // Режими роботи
  modes: {
    chat: {
      enableTTS: true,
      enableOptimization: false,
      skipSystemStages: ['completion'],
      maxChatRounds: 10
    },
    task: {
      enableTTS: true,
      enableOptimization: true,
      requireVerification: true,
      enableRetries: true
    },
    debug: {
      enableTTS: false,
      enableLogging: true,
      enableMetrics: true,
      pauseBetweenStages: true
    }
  }
};

// === УТИЛІТИ ДЛЯ РОБОТИ З WORKFLOW ===

/**
 * Отримання етапу за номером
 */
export function getWorkflowStage(stageNumber) {
  return WORKFLOW_STAGES.find(stage => stage.stage === stageNumber);
}

/**
 * Отримання наступного етапу
 */
export function getNextStage(currentStage, context = {}) {
  const currentIndex = WORKFLOW_STAGES.findIndex(stage => stage.stage === currentStage);
  if (currentIndex === -1) return null;

  // Шукаємо наступний доступний етап
  for (let i = currentIndex + 1; i < WORKFLOW_STAGES.length; i++) {
    const stage = WORKFLOW_STAGES[i];

    // Перевіряємо умову для етапу
    if (stage.condition && WORKFLOW_CONDITIONS[stage.condition]) {
      if (WORKFLOW_CONDITIONS[stage.condition](context)) {
        return stage;
      }
    } else if (!stage.condition) {
      return stage;
    }
  }

  return null;
}

/**
 * Перевірка умови етапу
 */
export function checkStageCondition(stageName, context) {
  const stage = WORKFLOW_STAGES.find(s => s.name === stageName);
  if (!stage || !stage.condition) return true;

  const conditionFn = WORKFLOW_CONDITIONS[stage.condition];
  return conditionFn ? conditionFn(context) : false;
}

/**
 * Валідація етапу
 */
export function validateStage(stageData) {
  const requiredFields = ['stage', 'agent', 'name', 'description'];
  return requiredFields.every(field => stageData[field] !== undefined);
}

/**
 * Отримання етапів для агента
 */
export function getStagesForAgent(agentName) {
  return WORKFLOW_STAGES.filter(stage => stage.agent === agentName);
}

// Експорт за замовчуванням
export default {
  WORKFLOW_STAGES,
  WORKFLOW_CONDITIONS,
  WORKFLOW_CONFIG,
  getWorkflowStage,
  getNextStage,
  checkStageCondition,
  validateStage,
  getStagesForAgent
};
