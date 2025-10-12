/**
 * @fileoverview Фільтри для conversation mode
 * Перевірка транскрипцій перед відправкою в chat
 *
 * @version 4.0.0
 * @date 2025-10-11
 */

import { isBackgroundPhrase, shouldReturnToKeywordMode } from '../utils/voice-utils.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('CONVERSATION_FILTER');

/**
 * Результат фільтрації
 * @typedef {Object} FilterResult
 * @property {boolean} blocked - Чи заблоковано текст
 * @property {string} reason - Причина блокування
 * @property {string} action - Рекомендована дія
 */

/**
 * Типи блокування
 * @enum {string}
 */
export const BlockReason = {
    BACKGROUND_PHRASE: 'background_phrase',
    UNCLEAR_PHRASE: 'unclear_phrase',
    LOW_CONFIDENCE: 'low_confidence',
    EMPTY_TEXT: 'empty_text',
    PASSED: 'passed'
};

/**
 * Рекомендовані дії після фільтрації
 * @enum {string}
 */
export const FilterAction = {
    RETURN_TO_KEYWORD: 'return_to_keyword',
    CONTINUE_LISTENING: 'continue_listening',
    SEND_TO_CHAT: 'send_to_chat'
};

/**
 * Головний фільтр для conversation transcription
 * Перевіряє текст через каскад фільтрів
 *
 * @param {string} text - Розпізнаний текст
 * @param {Object} options - Опції фільтрації
 * @param {number} [options.confidence=1.0] - Впевненість розпізнавання
 * @param {boolean} [options.isConversationMode=true] - Чи активний conversation mode
 * @returns {FilterResult} Результат фільтрації
 */
export function filterTranscription(text, options = {}) {
    const { confidence = 1.0, isConversationMode = true } = options;

    // ═══════════════════════════════════════════════════════════════
    // ФІЛЬТР 1: Порожній текст
    // ═══════════════════════════════════════════════════════════════
    if (!text || !text.trim()) {
        logger.warn('❌ Empty text filtered');
        return {
            blocked: true,
            reason: BlockReason.EMPTY_TEXT,
            action: FilterAction.RETURN_TO_KEYWORD
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ФІЛЬТР 2: Фонові фрази (YouTube endings, credits)
    // ⚠️ ТІЛЬКИ для Conversation Mode! Quick-send - user initiated!
    // ═══════════════════════════════════════════════════════════════
    if (isConversationMode && isBackgroundPhrase(text)) {
        logger.warn(`🎬 Background phrase filtered: "${text}"`);
        return {
            blocked: true,
            reason: BlockReason.BACKGROUND_PHRASE,
            action: FilterAction.RETURN_TO_KEYWORD
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ФІЛЬТР 3: Невиразні фрази ("хм", "е", тощо)
    // ⚠️ ТІЛЬКИ для Conversation Mode! Quick-send - user initiated!
    // ═══════════════════════════════════════════════════════════════
    if (isConversationMode && shouldReturnToKeywordMode(text, confidence)) {
        logger.warn(`❓ Unclear phrase filtered: "${text}" (confidence: ${confidence})`);
        return {
            blocked: true,
            reason: BlockReason.UNCLEAR_PHRASE,
            action: FilterAction.RETURN_TO_KEYWORD
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ ПРОЙШОВ ВСІ ФІЛЬТРИ - можна відправляти
    // ═══════════════════════════════════════════════════════════════
    logger.info(`✅ Transcription passed filters: "${text}" (confidence: ${confidence})`);
    return {
        blocked: false,
        reason: BlockReason.PASSED,
        action: FilterAction.SEND_TO_CHAT
    };
}

/**
 * Швидка перевірка чи текст пройде фільтри
 * @param {string} text - Текст для перевірки
 * @param {number} [confidence=1.0] - Впевненість
 * @returns {boolean} - true якщо пройде, false якщо заблокується
 */
export function willPassFilters(text, confidence = 1.0) {
    const result = filterTranscription(text, { confidence });
    return !result.blocked;
}

/**
 * Отримати повідомлення для користувача на основі результату фільтрації
 * @param {FilterResult} filterResult - Результат фільтрації
 * @returns {string} Повідомлення для UI
 */
export function getFilterMessage(filterResult) {
    switch (filterResult.reason) {
        case BlockReason.BACKGROUND_PHRASE:
            return 'Фонова фраза проігнорована';

        case BlockReason.UNCLEAR_PHRASE:
            return 'Не зрозумів, скажіть "Атлас" для продовження...';

        case BlockReason.LOW_CONFIDENCE:
            return 'Погана якість звуку, спробуйте ще раз';

        case BlockReason.EMPTY_TEXT:
            return 'Нічого не розпізнано';

        default:
            return '';
    }
}
