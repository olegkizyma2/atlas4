/**
 * RESPONSE SANITIZER
 * Очищає вихідні повідомлення агентів від службових тегів/метаданих
 * і запобігає витоку системних промптів у відповідях користувачу.
 */

// Видаляє службові префікси на кшталт [SYSTEM], [ATLAS], [ГРИША], [ТЕТЯНА]
function stripLeadingTags(text) {
  let out = text;
  const tagPrefix = /^\s*\[(SYSTEM|SYS|PROMPT|INTERNAL|DEBUG|META|MEMORY|SUMMARY|ATLAS|ГРИША|ТЕТЯНА)\]\s*/i;
  // Повторюємо, поки початок рядка містить службовий тег
  while (tagPrefix.test(out)) {
    out = out.replace(tagPrefix, '');
  }
  return out;
}

// Прибирає fenced-блоки з внутрішнім вмістом (```system|prompt|metadata|internal)
function stripFencedBlocks(text) {
  return text.replace(/```\s*(system|prompt|metadata|internal)[\s\S]*?```/gi, '');
}

// Прибирає службові рядки типу "SYSTEM: ...", "СИСТЕМН...: ...", "PROMPT: ..." тощо
function stripServiceLines(text) {
  return text.replace(/^\s*(SYSTEM|СИСТЕМН\w*|PROMPT|ПРОМПТ\w*|INTERNAL|DEBUG|META|МЕМОРІЯ|ПАМ'?ЯТЬ|SUMMARY|ПІДСУМОК)\s*[:：].*$/gim, '');
}

// Глобально прибирає поодинокі вставки тегів [SYSTEM] усередині тексту
function stripInlineTags(text) {
  return text.replace(/\[(SYSTEM|SYS|PROMPT|INTERNAL|DEBUG|META|MEMORY|SUMMARY)\]/gi, '');
}

function collapseWhitespace(text) {
  return text
    .replace(/[\r\t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Якщо відповідь виглядає як чистий JSON-об'єкт (метадані), ховаємо його від користувача
function hideIfPureJson(text) {
  const t = text.trim();
  if (!t) return '';
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      const parsed = JSON.parse(t);
      // Якщо це не рядок і не містить явного поля з людським текстом — вважаємо службовими даними
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Array.isArray(parsed) ? [] : Object.keys(parsed).map(k => k.toLowerCase());
        const textLike = ['text', 'message', 'content'];
        const hasTextLike = keys.some(k => textLike.includes(k));
        return hasTextLike ? text : '';
      }
    } catch (_) {
      // не валідний JSON — лишаємо як є
    }
  }
  return text;
}

export function sanitizeContentForUser(input) {
  if (!input) return '';
  let out = String(input);
  out = stripLeadingTags(out);
  out = stripInlineTags(out);
  out = stripFencedBlocks(out);
  out = stripServiceLines(out);
  out = collapseWhitespace(out);
  out = hideIfPureJson(out);
  return out;
}

// Агентно-орієнтований санитайз: для system приховуємо повністю або службовий JSON
export function sanitizeAgentMessage(agentName, input, stageName = null) {
  // Для режиму вибору залишаємо оригінальний JSON без очищення та без префіксу [SYSTEM]
  if (stageName === 'stage0_mode_selection' || stageName === 'completion') {
    const rawText = String(input || '').trim();
    // Прибираємо [SYSTEM] префікс для чистого JSON
    return rawText.replace(/^\[SYSTEM\]\s*/, '').trim();
  }

  const sanitized = sanitizeContentForUser(input);
  if (agentName === 'system') {
    // Системні повідомлення не повинні потрапляти до користувача
    return '';
  }
  return sanitized;
}

export default {
  sanitizeContentForUser,
  sanitizeAgentMessage
};
