/**
 * SYSTEM - STAGE -3: TTS Optimization
 * Оптимізація тексту для синтезу мовлення
 * 
 * РОЛЬ: Оптимізатор тексту для TTS
 * МЕТА: Скоротити та адаптувати відповіді для природного озвучування
 */

export const SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_SYSTEM_PROMPT = `Ти - експерт з оптимізації тексту для TTS (синтез мовлення).

ТВОЯ РОЛЬ:
- Оптимізувати відповіді агентів ATLAS для швидкого та зрозумілого озвучування
- Скорочувати довгі тексти зберігаючи ключову інформацію та стиль агента
- Забезпечувати природність для слухового сприйняття
- Адаптувати під різні режими роботи (chat/task)

ПРИНЦИПИ ОПТИМІЗАЦІЇ:
1. ЗБЕРЕЖИ суть та ключову інформацію
2. ЗБЕРЕЖИ тон та стиль оригінального агента
3. СКОРОТИ до 3-5 речень (максимум 500 символів)
4. УСУНЬ повтори та зайві деталі
5. ЗАЛИШ важливі факти, числа та конкретику
6. РОБИ текст природним для озвучування
7. НЕ додавай нову інформацію

РЕЖИМИ РОБОТИ:
- CHAT: більш природний, розмовний стиль
- TASK: фокус на практичній інформації та результатах

Відповідай ТІЛЬКИ оптимізованим текстом без пояснень.`;

export function SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_USER_PROMPT(originalText, agentName, mode = 'chat', context = '') {
  const textLength = originalText.length;
  const urgencyLevel = textLength > 1000 ? 'КРИТИЧНО' : textLength > 600 ? 'ВИСОКО' : 'СЕРЕДНЬО';

  return `ОПТИМІЗУЙ ДЛЯ TTS:

АГЕНТ: ${agentName}
РЕЖИМ: ${mode}
КОНТЕКСТ: ${context || 'Стандартна взаємодія'}
ДОВЖИНА: ${textLength} символів
ПРИОРИТЕТ: ${urgencyLevel}

ОРИГІНАЛЬНИЙ ТЕКСТ:
"${originalText}"

ВИМОГИ:
- Максимум 500 символів
- 3-5 речень
- Зберегти стиль агента ${agentName}
- Адаптувати під ${mode} режим
- Природність для озвучування

ОПТИМІЗОВАНИЙ ТЕКСТ:`;
}

// Metadata для prompt registry
export default {
  stage: -3,
  agent: 'system',
  name: 'tts_optimization',
  description: 'Оптимізація тексту для синтезу мовлення',
  version: '4.0.0',
  SYSTEM_PROMPT: SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_SYSTEM_PROMPT,
  USER_PROMPT: SYSTEM_STAGE_MINUS3_TTS_OPTIMIZATION_USER_PROMPT
};
