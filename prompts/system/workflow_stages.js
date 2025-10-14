/**
 * WORKFLOW STAGE DEFINITIONS
 * Визначення етапів workflow та логіки переходів
 *
 * @author Atlas System
 * @version: '4.0.0'
 * @date 2025-10-08
 */

const workflowStages = {
  name: 'workflow_stages',
  description: 'Визначення всіх етапів workflow системи ATLAS',
  version: '4.0.0',
  author: 'Atlas System',

  /**
     * Отримати опис етапу
     */
  getStageDescription: (stageName) => {
    const stage = workflowStages.stages.find(s => s.name === stageName);
    return stage?.description || 'Опис етапу не знайдено';
  },

  /**
     * Отримати етап за номером
     */
  getStageByNumber: (stageNumber) => {
    return workflowStages.stages.find(s => s.stage === stageNumber);
  },

  /**
     * Отримати очікувані стани етапу
     */
  getExpectedStates: (stageName) => {
    const stage = workflowStages.stages.find(s => s.name === stageName);
    return stage?.expectedStates || [];
  },

  /**
     * Визначення всіх етапів workflow
     */
  stages: [
    {
      stage: -2,
      agent: 'system',
      name: 'stage_minus2_post_chat_analysis',
      description: 'Пост-чат аналіз звернення користувача',
      detailedDescription: 'Аналіз повідомлень користувача після завершення чату для визначення потреби в додаткових діях',
      required: false,
      condition: 'atlas_chat_completed',
      maxRetries: 0,
      timeout: 5000,
      expectedStates: ['continue_chat', 'ignore', 'clarify']
    },
    {
      stage: 0,
      agent: 'system',
      name: 'stage0_mode_selection',
      description: 'Класифікація: чат або завдання',
      detailedDescription: 'Системний аналіз запиту користувача для визначення чи це звичайне спілкування чи конкретне завдання',
      required: true,
      maxRetries: 0,
      timeout: 10000,
      expectedStates: ['chat', 'task']
    },
    {
      stage: 0,
      agent: 'atlas',
      name: 'stage0_chat',
      description: 'Atlas в режимі спілкування',
      detailedDescription: 'Atlas відповідає на запити користувача в режимі вільного спілкування без виконання конкретних завдань',
      required: false,
      condition: 'system_selected_chat',
      maxRetries: 0,
      timeout: 30000,
      expectedStates: ['chat_response']
    },
    {
      stage: 1,
      agent: 'atlas',
      name: 'initial_process',
      description: 'Формалізація та структурування завдання',
      detailedDescription: 'Atlas аналізує запит користувача та структурує його у вигляді чіткого завдання для виконання',
      required: false,
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
      detailedDescription: 'Тетяна виконує конкретні дії для досягнення поставленої мети, використовуючи доступні інструменти',
      required: true,
      maxRetries: 2,
      timeout: 180000,
      expectedStates: ['completed', 'incomplete', 'blocked']
    },
    {
      stage: 3,
      agent: 'atlas',
      name: 'clarification',
      description: 'Надання уточнень для Тетяни',
      detailedDescription: 'Atlas надає додаткові уточнення та деталізацію завдання, якщо Тетяна потребує більше інформації',
      required: false,
      condition: 'tetyana_needs_clarification',
      maxRetries: 1,
      timeout: 30000,
      expectedStates: ['clarified', 'not_clarified']
    },
    {
      stage: 4,
      agent: 'tetyana',
      name: 'retry',
      description: 'Повторне виконання з уточненнями',
      detailedDescription: 'Тетяна повторно виконує завдання з урахуванням отриманих від Atlas уточнень',
      required: false,
      condition: 'atlas_provided_clarification',
      maxRetries: 2,
      timeout: 90000,
      expectedStates: ['completed', 'incomplete', 'blocked']
    },
    {
      stage: 5,
      agent: 'grisha',
      name: 'diagnosis',
      description: 'Діагностика причин блокування',
      detailedDescription: 'Гриша аналізує причини неможливості виконання завдання та пропонує шляхи вирішення',
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
      detailedDescription: 'Atlas коригує формулювання завдання на основі діагностики Гриші для усунення блокувань',
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
      detailedDescription: 'Гриша перевіряє якість та правильність виконаного завдання, валідує результати',
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
      detailedDescription: 'Фінальне системне завершення циклу виконання з узагальненням результатів',
      required: true,
      condition: 'should_complete_workflow',
      maxRetries: 0,
      timeout: 10000,
      expectedStates: ['success', 'failed', 'timeout_exceeded']
    },
    {
      stage: 9,
      agent: 'atlas',
      name: 'retry_cycle',
      description: 'Ініціація нового циклу виконання',
      detailedDescription: 'Atlas ініціює новий цикл виконання з новою стратегією при неуспішному завершенні',
      required: false,
      condition: 'should_retry_cycle',
      maxRetries: 2,
      timeout: 30000,
      expectedStates: ['new_strategy', 'retry_limit_reached', 'user_update', 'auto_fix']
    },
    {
      stage: -3,
      agent: 'tts-optimizer',
      name: 'stage_minus3_tts_optimization',
      description: 'Оптимізація відповіді для TTS озвучки',
      detailedDescription: 'Спеціалізована обробка тексту для покращення якості голосового синтезу',
      required: false,
      condition: 'agent_response_for_tts',
      maxRetries: 2,
      timeout: 15000,
      expectedStates: ['optimized', 'fallback_used', 'no_optimization_needed']
    }
  ],

  /**
     * Умови переходів між етапами
     */
  transitionConditions: {
    atlas_chat_completed: 'Atlas завершив відповідь в чат режимі',
    system_selected_chat: 'Система визначила запит як чат',
    system_selected_task: 'Система визначила запит як завдання',
    tetyana_needs_clarification: 'Тетяна потребує уточнень',
    atlas_provided_clarification: 'Atlas надав уточнення',
    tetyana_still_blocked: 'Тетяна все ще заблокована',
    grisha_provided_diagnosis: 'Гриша надав діагностику',
    should_complete_workflow: 'Слід завершити workflow',
    should_retry_cycle: 'Слід розпочати новий цикл',
    agent_response_for_tts: 'Відповідь агента потребує TTS оптимізації'
  }
};

// ES6 export
export default workflowStages;