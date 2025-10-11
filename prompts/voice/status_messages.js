/**
 * STATUS MESSAGES FOR AGENTS
 * Повідомлення про статус виконання для різних агентів та етапів
 *
 * @author Atlas System
 * @version: '4.0.0'
 * @date 2025-10-08
 */

module.exports = {
  name: 'agent_status_messages',
  description: 'Статусні повідомлення для агентів системи ATLAS',
  version: '4.0.0',
  author: 'Atlas System',

  /**
     * Генерує коротке статусне повідомлення
     */
  generateShortStatus: (agent, stage, action) => {
    const messages = module.exports.statusMessages;
    return (messages[agent]?.[stage]) || `${agent} виконує ${stage}`;
  },

  /**
     * Статусні повідомлення по агентах та етапах
     */
  statusMessages: {
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
  },

  /**
     * Детальні описи етапів workflow
     */
  stageDescriptions: {
    stage_minus2_post_chat_analysis: 'Пост-чат аналіз звернення користувача',
    stage0_mode_selection: 'Класифікація: чат або завдання',
    stage0_chat: 'Atlas в режимі спілкування',
    stage1_initial_processing: 'Формалізація та структурування завдання',
    stage2_execution: 'Виконання сформалізованого завдання',
    stage3_clarification: 'Надання уточнень для Тетяни',
    stage4_retry: 'Повторне виконання з уточненнями',
    stage5_diagnosis: 'Діагностика причин блокування',
    stage6_task_adjustment: 'Корекція завдання на основі діагностики',
    stage7_verification: 'Перевірка правильності виконання',
    stage8_completion: 'Системне завершення workflow',
    stage9_retry_cycle: 'Ініціація нового циклу виконання',
    stage_minus3_tts_optimization: 'Оптимізація відповіді для TTS озвучки'
  },

  /**
     * Повідомлення помилок та проблем
     */
  errorMessages: {
    timeout: 'Перевищено час очікування відповіді',
    blocked: 'Виконання заблоковано через технічні проблеми',
    retry_limit: 'Досягнуто максимальну кількість спроб',
    validation_failed: 'Результат не пройшов валідацію',
    network_error: 'Помилка мережевого з\'єднання'
  }
};
