/**
 * Chat Helpers
 *
 * Допоміжні функції для роботи з чатом
 * Винесено з executor.js для модульності
 */

import { callGooseAgent } from '../../agents/goose-client.js';
import logger from '../../utils/logger.js';

/**
 * Виявлення теми розмови
 * @param {string} userMessage - Повідомлення користувача
 * @param {Object} session - Сесія workflow
 * @returns {Promise<Object|null>}
 */
export async function detectChatTopic(userMessage, session) {
  try {
    const { SYSTEM_CHAT_TOPIC_SYSTEM_PROMPT, SYSTEM_CHAT_TOPIC_USER_PROMPT } =
            await import('../../../prompts/system/chat_topic.js');

    const context = (session.chatThread?.messages || [])
      .slice(-2)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `${SYSTEM_CHAT_TOPIC_SYSTEM_PROMPT}\n\n${SYSTEM_CHAT_TOPIC_USER_PROMPT(userMessage, context)}`;
    const resp = await callGooseAgent(prompt, session.id, { enableTools: false, agent: 'system' });

    return JSON.parse(resp.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim());
  } catch (e) {
    logger.warn('Chat topic detection failed', { error: e.message });
    return null;
  }
}

/**
 * Перевірка чи змінилась тема розмови
 * @param {string} prevTopic - Попередня тема
 * @param {Object} nextTopicObj - Об'єкт з новою темою
 * @returns {boolean}
 */
export function isTopicChanged(prevTopic, nextTopicObj) {
  const nextTopic = (nextTopicObj?.topic || '').toLowerCase().trim();
  const prev = (prevTopic || '').toLowerCase().trim();

  if (!prev) return false;
  if (!nextTopic) return false;
  if (prev === nextTopic) return false;

  // Перевірка перекриття слів (якщо є хоч 50% спільних - вважаємо що тема та ж)
  const overlap = (words) => {
    const prevWords = new Set(prev.split(/\s+/));
    const common = words.filter(w => prevWords.has(w));
    return (common.length / words.length) > 0.5;
  };

  return !overlap(nextTopic.split(/\s+/));
}

/**
 * Резюмування потоку чату
 * @param {Array} messages - Повідомлення для резюмування
 * @returns {Promise<string>}
 */
export async function summarizeChatThread(messages) {
  try {
    const { SYSTEM_CHAT_SUMMARY_SYSTEM_PROMPT, SYSTEM_CHAT_SUMMARY_USER_PROMPT } =
            await import('../../../prompts/system/chat_summary.js');

    const prompt = `${SYSTEM_CHAT_SUMMARY_SYSTEM_PROMPT}\n\n${SYSTEM_CHAT_SUMMARY_USER_PROMPT(messages)}`;
    const summary = await callGooseAgent(prompt, 'summary', { enableTools: false, agent: 'system' });

    return summary || 'No summary';
  } catch (e) {
    logger.warn('Chat summary failed', { error: e.message });
    return 'Summary unavailable';
  }
}

/**
 * Управління контекстом чату з carry-over між темами
 * @param {Object} session - Сесія workflow
 * @param {string} userMessage - Повідомлення користувача
 * @param {Object} response - Відповідь агента
 */
export async function manageChatContext(session, userMessage, response) {
  if (!session.chatThread) {
    session.chatThread = {
      messages: [],
      lastTopic: undefined,
      carryOvers: []
    };
  }

  // Додаємо повідомлення до чату
  session.chatThread.messages.push({ role: 'user', content: userMessage });
  session.chatThread.messages.push({ role: 'assistant', content: response.content, agent: response.agent });

  // Обмежуємо розмір чату (останні 10 повідомлень)
  if (session.chatThread.messages.length > 10) {
    session.chatThread.messages = session.chatThread.messages.slice(-10);
  }

  // Виявляємо тему
  const topicObj = await detectChatTopic(userMessage, session);

  if (topicObj && isTopicChanged(session.chatThread.lastTopic, topicObj)) {
    logger.info(`Topic changed: ${session.chatThread.lastTopic} → ${topicObj.topic}`);

    // Резюмуємо попередню тему і зберігаємо як carry-over
    if (session.chatThread.messages.length > 2) {
      const summary = await summarizeChatThread(session.chatThread.messages.slice(0, -2));
      session.chatThread.carryOvers.push({
        topic: session.chatThread.lastTopic,
        summary,
        timestamp: Date.now()
      });

      // Обмежуємо carry-overs (останні 3)
      if (session.chatThread.carryOvers.length > 3) {
        session.chatThread.carryOvers = session.chatThread.carryOvers.slice(-3);
      }
    }

    // Очищаємо messages для нової теми
    session.chatThread.messages = session.chatThread.messages.slice(-2);
    session.chatThread.lastTopic = topicObj.topic;
  } else if (topicObj) {
    session.chatThread.lastTopic = topicObj.topic;
  }
}

export default {
  detectChatTopic,
  isTopicChanged,
  summarizeChatThread,
  manageChatContext
};
