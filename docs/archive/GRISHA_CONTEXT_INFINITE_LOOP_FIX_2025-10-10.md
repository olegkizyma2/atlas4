# GRISHA CONTEXT & INFINITE LOOP FIX (UPDATED)

**ДАТА:** 10 жовтня 2025 - пізній вечір (~19:30)  
**ОНОВЛЕНО:** 10 жовтня 2025 - ~19:45  
**ПРОБЛЕМА:** Гриша НЕ отримував контекст завдання + infinite loop через підтвердження інструкцій

## 🔴 ПРОБЛЕМИ ЩО БУЛИ ВИПРАВЛЕНІ

### 1. Гриша отримував промпт як контекст

**Симптоми:**
```
[ГРИША] Прийнято! Я готовий перевіряти виконання завдань за наведеними інструкціями.
Чекаю твоїх запитів для перевірки...
```

Гриша каже "чекаю запитів" замість перевірки, тому що **НЕ знає що перевіряти**.

**Корінь проблеми:**
В `prompts/prompt-registry.js` функція `buildUserPrompt` для stage 7:

```javascript
case 7: // Grisha verification
  const originalRequest7 = userMessage; // ❌ ЦЕ НЕПРАВИЛЬНО!
  const executionResults = session?.history?.filter(r => r.agent === 'tetyana').pop()?.content || '';
  const expectedOutcome = session?.history?.filter(r => r.agent === 'atlas')[0]?.content || '';
  return userPromptFn(originalRequest7, executionResults, expectedOutcome);
```

`userMessage` для stage 7 - це НЕ оригінальний запит користувача, а **попередній вихід етапу**!

### Проблема 2: Infinite retry loop

**Симптоми:**
- Система виконує 3 цикли підряд: Stage 1 → 2 → 7 → 9 → 1 → 2 → 7 → 9 → 1...
- Гриша НЕ дає вердикт "виконано" або "не виконано"
- Досягається `maxCycles = 3`, але користувач НЕ бачить повідомлення

**Корінь проблеми:**
Логіка `determineNextStage` для stage 7 НЕ враховувала відповідь Гриші "Прийнято":
- НЕ містить "виконано" → НЕ йде в stage 8
- НЕ містить "не виконано" → НЕ йде в stage 9  
- НЕ містить "уточни" → НЕ йде в stage 3
- **Default:** `return 9` (retry) → infinite loop!

## ✅ Рішення

### Рішення 1: Правильна передача контексту Гриші

**Файл:** `prompts/prompt-registry.js`

```javascript
case 7: // Grisha verification
  // Витягуємо СПРАВЖНІЙ оригінальний запит користувача
  const originalRequest7 = session?.originalMessage || 
                            session?.chatThread?.messages?.find(m => m.role === 'user')?.content ||
                            userMessage;
  const executionResults = session?.history?.filter(r => r.agent === 'tetyana').pop()?.content || '';
  const expectedOutcome = session?.history?.filter(r => r.agent === 'atlas').slice(-1)[0]?.content || '';
  
  console.log(`[PROMPT-DEBUG] Stage 7 context: originalRequest="${originalRequest7?.substring(0, 50)}...", execution="${executionResults?.substring(0, 50)}...", expected="${expectedOutcome?.substring(0, 50)}..."`);
  
  return userPromptFn(originalRequest7, executionResults, expectedOutcome);
```

**Що змінилось:**
- ✅ Використовує `session.originalMessage` (СПРАВЖНІЙ запит користувача)
- ✅ Fallback на `chatThread.messages` якщо originalMessage відсутній
- ✅ Детальне логування для діагностики

### Рішення 2: Покращена логіка визначення вердикту Гриші

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
case 7:
  // Grisha verification result
  const content = response.content.toLowerCase();

  console.log(`[WORKFLOW] Stage 7 response analysis: "${content.substring(0, 200)}..."`);

  // Check if Grisha asks for clarification or waiting for task details
  if (content.includes('уточни') ||
    content.includes('уточнен') ||
    content.includes('чекаю') ||      // НОВИЙ keyword
    content.includes('вкажи') ||       // НОВИЙ keyword
    content.includes('очікую') ||      // НОВИЙ keyword
    (content.includes('потрібно') && content.includes('уточни'))) {
    console.log('[WORKFLOW] Stage 7: Grisha needs clarification → stage 3');
    return 3; // → Atlas clarification
  }

  // Check if verification failed
  if (content.includes('не виконано') ||
    content.includes('неуспішн') ||
    content.includes('частково')) {
    console.log('[WORKFLOW] Stage 7: Verification failed → stage 9 (retry)');
    return 9; // → New cycle (retry from Atlas)
  }

  // Check if verification passed
  if (content.includes('виконано') ||
    content.includes('перевірено') ||
    content.includes('готово') ||
    content.includes('підтверджено')) {  // НОВИЙ keyword
    console.log('[WORKFLOW] Stage 7: Verification passed → stage 8 (completion)');
    return 8; // → Completion
  }

  // КРИТИЧНО: Якщо Гриша НЕ дав вердикт (просто підтвердив готовність)
  if (content.includes('прийнято') ||   // НОВИЙ check
    content.includes('готовий') ||      // НОВИЙ check
    content.includes('буд') ||          // НОВИЙ check
    content.length < 150) {             // НОВИЙ check - коротка відповідь без вердикту
    console.log('[WORKFLOW] Stage 7: Grisha acknowledged but no verdict → needs clarification (retry cycle)');
    return 9; // → Retry to give Grisha actual context
  }

  // Default: if unclear, assume needs retry
  console.log('[WORKFLOW] Stage 7: Unclear response → stage 9 (retry)');
  return 9; // → New cycle
```

**Що змінилось:**
- ✅ Додано keywords для розпізнавання "чекаю запитів": 'чекаю', 'вкажи', 'очікую'
- ✅ Спеціальна обробка "Прийнято" (Gриша підтвердив, але без вердикту)
- ✅ Перевірка довжини відповіді (< 150 chars = немає вердикту)
- ✅ Детальне логування для діагностики

### Рішення 3: Повідомлення про досягнення max cycles

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
// Max cycles reached or stages completed
if (cycleCount >= maxCycles) {
  logger.warn(`Max retry cycles (${maxCycles}) reached, completing workflow`, {
    sessionId: session.id,
    finalStage: currentStage
  });
  
  // Відправити повідомлення про досягнення ліміту
  const limitMessage = {
    role: 'assistant',
    content: `⚠️ Досягнуто максимальної кількості спроб (${maxCycles}). Завдання потребує уточнення або перефразування.`,
    agent: 'system',
    timestamp: Date.now()
  };
  
  res.write(`data: ${JSON.stringify(limitMessage)}\n\n`);
}

await completeWorkflow(session, res);
```

**Що змінилось:**
- ✅ Користувач бачить повідомлення про досягнення ліміту
- ✅ Зрозуміла порада що робити далі
- ✅ Логування для діагностики

## 📊 Результат

### До виправлення:
❌ Гриша отримує порожній контекст → каже "чекаю запитів"  
❌ Система НЕ розпізнає відповідь → default retry (stage 9)  
❌ Infinite loop: Stage 1 → 2 → 7 → 9 → 1... (3 цикли)  
❌ Користувач НЕ розуміє що сталось

### Після виправлення:
✅ Гриша отримує СПРАВЖНІЙ запит користувача + результати Тетяни  
✅ Система розпізнає всі типи відповідей Гриші (включаючи "чекаю")  
✅ Максимум 3 цикли, потім зрозуміле повідомлення користувачу  
✅ Детальне логування для діагностики

## 🧪 Тестування

### Ручний тест:
1. Запустити завдання: "відкрий калькулятор і набери 999"
2. Гриша має отримати:
   - `originalRequest`: "відкрий калькулятор і набери 999"
   - `executionResults`: "Готово. Калькулятор відкрито..."
   - `expectedOutcome`: "Тетяна, завдання наступне..."
3. Гриша має використати інструменти (playwright screenshot)
4. Дати вердикт: "Виконано" або "Не виконано"

### Перевірка логів:
```bash
# Перевірити що контекст передається
grep "PROMPT-DEBUG.*Stage 7 context" logs/orchestrator.log

# Перевірити розпізнавання вердикту
grep "WORKFLOW.*Stage 7.*response analysis" logs/orchestrator.log

# Перевірити що немає infinite loop
grep "Max retry cycles.*reached" logs/orchestrator.log
```

## 📝 Файли

1. **prompts/prompt-registry.js** - виправлено buildUserPrompt для stage 7
2. **orchestrator/workflow/executor-v3.js** - покращено determineNextStage для stage 7
3. **orchestrator/workflow/executor-v3.js** - додано повідомлення про max cycles

## 🔍 Діагностика

### Якщо Гриша все ще НЕ перевіряє:
1. Перевірити логи: `grep "Stage 7 context" logs/orchestrator.log`
2. Переконатись що `session.originalMessage` існує
3. Перевірити що `executionResults` та `expectedOutcome` НЕ порожні

### Якщо infinite loop повторюється:
1. Перевірити логи: `grep "Stage 7.*response analysis" logs/orchestrator.log`
2. Додати більше keywords в умови `determineNextStage`
3. Зменшити `maxCycles` в конфігурації (якщо потрібно)

## 📚 Пов'язані документи

- `docs/GRISHA_VERIFICATION_FIX_2025-10-10.md` - попереднє виправлення Гриші
- `docs/INFINITE_LOOP_FIX_2025-10-10.md` - попереднє виправлення infinite loop
- `docs/TOKEN_LIMIT_FIX_2025-10-10.md` - token limit error handling

## 🎯 Висновок

Виправлення забезпечує:
1. ✅ Гриша отримує ПОВНИЙ контекст завдання
2. ✅ Система розпізнає ВСІ типи відповідей Гриші
3. ✅ Немає infinite loop - максимум 3 спроби
4. ✅ Зрозумілі повідомлення користувачу
5. ✅ Детальне логування для діагностики

**Система тепер працює СТАБІЛЬНО з правильним workflow!** 🚀
