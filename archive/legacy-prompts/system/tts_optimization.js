/**
 * TTS OPTIMIZATION PROMPT
 *
 * Промпт для системного агента стаже -3, який скорочує відповіді агентів для TTS
 * Метою є зменшення затримок на озвучку шляхом створення коротких, інформативних резюме
 */

export const TTS_OPTIMIZATION_PROMPT = {

  /**
   * Генерує промпт для скорочення тексту для TTS
   */
  generatePrompt(originalText, agentName, options = {}) {
    const {
      maxSentences = 4,
      minSentences = 2,
      targetLength = 300,
      maxCharacters = 800,
      context = '',
      mode = 'task'
    } = options;

    const textLength = originalText.length;
    const urgencyLevel = textLength > maxCharacters * 1.5 ? 'КРИТИЧНО' :
      textLength > maxCharacters ? 'ВИСОКО' : 'СЕРЕДНЬО';

    return `Ти - експерт з оптимізації тексту для TTS озвучки агента ${agentName}.

ЗАВДАННЯ: Скороти відповідь до ${targetLength} символів (${minSentences}-${maxSentences} речень) зберігши суть та стиль агента.

ВИХІДНИЙ ТЕКСТ (${textLength} символів):
"${originalText}"

РІВЕНЬ ПРИОРИТЕТУ СКОРОЧЕННЯ: ${urgencyLevel}

ПРАВИЛА ОПТИМІЗАЦІЇ:
1. ОБОВ'ЯЗКОВО збережи ключову інформацію та основний зміст
2. Збережи характерний тон та стиль агента ${agentName}
3. Використай РІВНО ${minSentences}-${maxSentences} повних, природних речень
4. Прибери повтори, вступні фрази та зайві деталі
5. Залиш важливі числа, факти та конкретику
6. НЕ додавай нову інформацію або інтерпретації
7. Роби текст придатним для природного озвучення
8. Уникай складних конструкцій та довгих переліків

КОНТЕКСТ ВЗАЄМОДІЇ: ${context || 'Стандартна робоча сесія'}
РЕЖИМ: ${mode}

РЕЗУЛЬТАТ (тільки оптимізований текст без лапок):`;
  },

  /**
   * Промпт для екстреного скорочення при перевищенні жорсткого ліміту
   */
  generateEmergencyPrompt(text, agentName, hardLimit) {
    return `ЕКСТРЕНЕ СКОРОЧЕННЯ для TTS!

Агент ${agentName} створив текст ${text.length} символів, що перевищує жорсткий ліміт ${hardLimit}.

ТЕКСТ:
"${text}"

Створи УЛЬТРАКОРОТКЕ резюме до 150 символів (1-2 речення) зберігши:
- Основну думку
- Тон агента ${agentName}
- Практичну цінність

РЕЗУЛЬТАТ:`;
  },

  /**
   * Промпт для інтелектуального скорочення з контекстом
   */
  generateContextualPrompt(originalText, agentName, conversationContext, options = {}) {
    const { targetLength = 300, maxSentences = 4 } = options;

    return `Ти - спеціаліст з адаптації тексту для голосової взаємодії.

КОНТЕКСТ РОЗМОВИ:
${conversationContext}

ВІДПОВІДЬ АГЕНТА ${agentName.toUpperCase()} (${originalText.length} символів):
"${originalText}"

МЕТА: Адаптувати для TTS озвучки до ${targetLength} символів (до ${maxSentences} речень).

ПРИНЦИПИ АДАПТАЦІЇ:
1. Збережи СУТНІСТЬ відповіді агента
2. Адаптуй під контекст розмови
3. Зроби природним для слухового сприйняття
4. Збережи емоційний відтінок агента
5. Усунь надмірну деталізацію
6. Залиш практично корисну інформацію

АДАПТОВАНИЙ ТЕКСТ:`;
  },

  /**
   * Промпт для fallback скорочення (простий алгоритм)
   */
  generateSimpleFallback(sentences, agentName, targetSentences = 3) {
    return `Вибери ${targetSentences} найінформативніших речення з тексту агента ${agentName}:

РЕЧЕННЯ:
${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Критерії відбору:
- Найбільш інформативні
- Зберігають логіку агента
- Природні для озвучення

РЕЗУЛЬТАТ (тільки вибрані речення):`;
  },

  /**
   * Промпт для валідації якості скорочення
   */
  generateValidationPrompt(originalText, optimizedText, agentName) {
    const compressionRatio = (optimizedText.length / originalText.length * 100).toFixed(1);

    return `Оціни якість оптимізації тексту для TTS:

ОРИГІНАЛ (${originalText.length} символів):
"${originalText}"

ОПТИМІЗОВАНО (${optimizedText.length} символів, стиснення ${compressionRatio}%):
"${optimizedText}"

АГЕНТ: ${agentName}

КРИТЕРІЇ ОЦІНКИ:
1. Збережена основна інформація (1-5)
2. Збережений стиль агента (1-5)  
3. Придатність для TTS (1-5)
4. Логічність та зв'язність (1-5)

Дай оцінки та загальний висновок ТАК/НІ для використання:`;
  },

  /**
   * Промпт для адаптації під конкретного користувача
   */
  generateUserAdaptedPrompt(originalText, agentName, userPreferences = {}) {
    const {
      preferredLength = 'medium',
      technicalLevel = 'standard',
      emotionalTone = 'balanced',
      urgency = 'normal'
    } = userPreferences;

    return `Адаптуй відповідь агента ${agentName} під преференції користувача для TTS.

ВІДПОВІДЬ АГЕНТА:
"${originalText}"

ПРЕФЕРЕНЦІЇ КОРИСТУВАЧА:
- Довжина: ${preferredLength} (short/medium/detailed)
- Технічний рівень: ${technicalLevel} (basic/standard/advanced)
- Емоційний тон: ${emotionalTone} (calm/balanced/energetic)
- Терміновість: ${urgency} (low/normal/urgent)

АДАПТОВАНА ВІДПОВІДЬ:`;
  }
};

/**
 * Експорт за замовчуванням
 */
export default TTS_OPTIMIZATION_PROMPT;
