# АНАЛІЗ ПРОБЛЕМИ КОНТЕКСТУ ТА ПАМ'ЯТІ В ATLAS v4.0

**Дата аналізу:** 10 жовтня 2025  
**Статус:** КРИТИЧНА ПРОБЛЕМА - система не тримає контекст, відповідає шаблонно  
**Аналітик:** GitHub Copilot + Олег Миколайович

---

## 1. ВИЯВЛЕНІ ПРОБЛЕМИ

### 1.1 Симптоми (з реального чату)
```
03:03:28 [USER]: як в тебе діла і розумієш чи ти хто з тобою переписується?
03:03:32 [ATLAS]: Вітаю! Я — Атлас, цифрове втілення інтелекту...

03:04:02 [USER]: Можливо аніктдот тоді.
03:04:06 [ATLAS]: Вітаю, я Атлас, цифрове втілення інтелекту...
```

**Проблема:** Система відповідає ІДЕНТИЧНИМ шаблоном незалежно від контексту розмови.

---

## 2. КОРІНЬ ПРОБЛЕМИ: АРХІТЕКТУРНИЙ АНАЛІЗ

### 2.1 Проблема #1: Надмірна кількість fallback механізмів

**Локації fallback коду:**
- `orchestrator/workflow/executor-v3.js` - `fallbackChatResponse()` (5+ викликів)
- `orchestrator/ai/fallback-llm.js` - локальний LLM fallback
- `orchestrator/ai/state-analyzer.js` - `localFallbackAnalysis()`
- `orchestrator/errors/error-handler.js` - fallback agent handling
- `orchestrator/agents/goose-client.js` - НЕ має fallback (правильно!)

**Наслідки:**
- При найменшій проблемі система переходить на fallback
- Fallback не має доступу до контексту сесії
- Fallback генерує шаблонні відповіді з промптів

### 2.2 Проблема #2: Контекст не передається між етапами

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
// Поточна реалізація:
const stageResponse = await executeConfiguredStage(stageConfig, userMessage, session, res);

// session.history є, але НЕ використовується в промптах!
// Кожен етап бачить ТІЛЬКИ userMessage, не історію
```

**Виявлена проблема:**
- Сесія `session.history` заповнюється
- Але історія НЕ передається в промпти агентів
- Кожен виклик агента починається "з нуля"

### 2.3 Проблема #3: Множинна система конфігурацій

**Наявні системи:**
1. `config/global-config.js` - централізована (ПРАВИЛЬНА)
2. `orchestrator/config.js` - локальна конфігурація (ДУБЛІКАТ)
3. `shared-config.js` (root) - застарілий файл
4. `web/static/js/shared-config.js` - frontend config
5. `config/api-config.js`, `agents-config.js`, `workflow-config.js` - модульні

**Проблеми:**
- Різні частини системи використовують різні конфіги
- Немає гарантії синхронізації
- Складно відстежити звідки береться конкретне налаштування

### 2.4 Проблема #4: Stage-based workflow не враховує chat mode

**Файл:** `config/workflow-config.js`

```javascript
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
}
```

**Проблема:**
- Stage 0 викликається для КОЖНОГО повідомлення
- Немає "conversation continuation" логіки
- Попередній контекст не враховується

---

## 3. ДЕТАЛЬНА ДІАГНОСТИКА WORKFLOW

### 3.1 Поточний workflow для chat mode

```
[USER MESSAGE] 
    ↓
[Stage 0: Mode Selection - SYSTEM]
    → Визначає: chat або task
    ↓
[Stage 0: Chat - ATLAS через Goose]
    → Отримує ТІЛЬКИ userMessage
    → НЕ отримує session.history
    → Відповідає з промпту без контексту
    ↓
[Response надсилається користувачу]
```

**Відсутня логіка:**
- Перевірка чи це ПЕРШЕ повідомлення чи продовження
- Передача історії попередніх повідомлень
- Збереження стану розмови між викликами

### 3.2 Як МАЄ працювати chat mode

```
[USER MESSAGE]
    ↓
[Перевірка: чи є session.history?]
    → Якщо EMPTY: це нова розмова
    → Якщо NOT EMPTY: продовження розмови
    ↓
[Підготовка контексту]
    → Збір останніх N повідомлень з session.history
    → Форматування в messages array
    ↓
[Atlas через Goose + ПОВНИЙ КОНТЕКСТ]
    → messages: [історія + нове повідомлення]
    → Контекстуальна відповідь
    ↓
[Збереження в session.history]
    ↓
[Response користувачу]
```

---

## 4. GOOSE CLIENT - ЄДИНА ПРАВИЛЬНА РЕАЛІЗАЦІЯ

**Файл:** `orchestrator/agents/goose-client.js`

```javascript
// ✅ ПРАВИЛЬНО - НЕ має fallback
export async function callGooseAgent(prompt, baseSessionId, options = {}) {
  try {
    const result = await callGooseWebSocket(gooseBaseUrl, truncatedMessage, sessionId);
    
    if (result && result.trim().length > 0) {
      return result;
    }
    
    // Якщо Goose не відповів - це помилка, не fallback
    console.error('[GOOSE] Did not provide response - NO FALLBACK');
    return null;
  } catch (error) {
    console.error(`[GOOSE] Call failed: ${error.message} - NO FALLBACK`);
    return null;
  }
}
```

**Переваги цього підходу:**
- Не маскує реальні проблеми
- Повертає `null` при помилці (можна обробити вище)
- Не генерує фейкові відповіді

---

## 5. PROMPTS СИСТЕМА - ЯК МАЄ ПРАЦЮВАТИ

### 5.1 Поточна структура промптів

```
prompts/
├── atlas/
│   ├── role_base.mjs          # Базова роль
│   ├── chat_mode.mjs          # Режим чату
│   └── task_mode.mjs          # Режим завдань
├── tetyana/
├── grisha/
└── system/
    └── state_analysis_prompts.mjs  # Містить FALLBACK_ANALYSIS_RULES
```

### 5.2 Проблема з промптами

**Файл:** `prompts/system/state_analysis_prompts.mjs`

```javascript
export const FALLBACK_ANALYSIS_RULES = {
  // Ці правила використовуються коли AI недоступний
  // НО вони НЕ мають контексту сесії!
}
```

**Виявлена проблема:**
- Fallback правила жорстко закодовані
- Не мають доступу до `session.history`
- Генерують загальні відповіді

### 5.3 Як має працювати система промптів

```javascript
// ❌ ПОТОЧНА РЕАЛІЗАЦІЯ
const prompt = CHAT_PROMPTS.base; // Статичний промпт
const response = await callGooseAgent(prompt, sessionId);

// ✅ ПРАВИЛЬНА РЕАЛІЗАЦІЯ
const contextMessages = buildContextFromHistory(session.history, {
  maxMessages: 10,
  includeSystem: true
});

const fullPrompt = {
  system: CHAT_PROMPTS.system_role,
  messages: [
    ...contextMessages,
    { role: 'user', content: userMessage }
  ]
};

const response = await callGooseAgent(fullPrompt, sessionId);
```

---

## 6. КРИТИЧНІ ВИПРАВЛЕННЯ (ПРІОРИТЕТИ)

### 🔴 ПРІОРИТЕТ 1: Видалити всі fallback механізми

**Файли для модифікації:**
1. `orchestrator/workflow/executor-v3.js`
   - Видалити `fallbackChatResponse()`
   - Видалити всі виклики fallback
   
2. `orchestrator/ai/fallback-llm.js`
   - ❓ Залишити ТІЛЬКИ для stage -3 (TTS optimization)
   - Видалити з основного workflow
   
3. `orchestrator/ai/state-analyzer.js`
   - Видалити `localFallbackAnalysis()`
   - При помилці - throw exception, не fallback

### 🔴 ПРІОРИТЕТ 2: Впровадити передачу контексту

**Зміни в `orchestrator/workflow/stages/agent-stage-processor.js`:**

```javascript
async execute(userMessage, session, res, options = {}) {
  // Будуємо контекст з історії
  const contextMessages = this.buildContextMessages(session);
  
  // Передаємо в Goose
  const response = await callGooseAgent({
    messages: contextMessages,
    newMessage: userMessage
  }, session.id, { agent: this.agent });
}

buildContextMessages(session) {
  const messages = [];
  
  // Додаємо системний промпт
  messages.push({
    role: 'system',
    content: this.getSystemPrompt()
  });
  
  // Додаємо останні N повідомлень з історії
  const recentHistory = session.history.slice(-10); // Останні 10
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }
  
  return messages;
}
```

### 🟡 ПРІОРИТЕТ 3: Уніфікувати систему конфігурацій

**План дій:**
1. Залишити ТІЛЬКИ `config/global-config.js` як єдине джерело
2. Видалити `orchestrator/config.js` (дублікат)
3. Видалити `shared-config.js` (застарілий)
4. Синхронізувати frontend через `config/sync-configs.js`

### 🟡 ПРІОРИТЕТ 4: Виправити chat mode workflow

**Зміни в `config/workflow-config.js`:**

```javascript
{
  stage: 0,
  agent: 'atlas',
  name: 'stage0_chat_continuation',
  description: 'Atlas в режимі ПРОДОВЖЕННЯ розмови',
  required: false,
  condition: 'system_selected_chat_and_has_history',
  contextMode: 'full_history', // НОВИЙ ПАРАМЕТР
  maxRetries: 0,
  timeout: 30000,
  expectedStates: ['chat_response']
}
```

---

## 7. ТЕСТОВИЙ ПЛАН

### 7.1 Тест #1: Базове утримання контексту

```
[USER] Привіт, мене звати Петро
[ATLAS] Привіт, Петро! Радий познайомитися...

[USER] Як мене звати?
[ATLAS] Вас звати Петро. // ✅ Пам'ятає контекст
```

### 7.2 Тест #2: Багатокрокова розмова

```
[USER] Розкажи про себе
[ATLAS] Я — Атлас, ваш цифровий помічник...

[USER] А що ти можеш робити?
[ATLAS] Як я вже згадував, я можу... // ✅ Посилається на попереднє

[USER] Розкажи анекдот
[ATLAS] Звісно! Ось анекдот: ... // ✅ НЕ повторює привітання
```

### 7.3 Тест #3: Без fallback

```javascript
// Симуляція помилки Goose
await callGooseAgent(prompt, sessionId); // → throws error

// Очікувана поведінка:
// ❌ НЕ повертати fallback відповідь
// ✅ Повідомити користувача про помилку
// ✅ Запропонувати спробувати пізніше
```

---

## 8. АРХІТЕКТУРА "СТАЖЕ" СИСТЕМИ

### 8.1 Що таке "стаже"?

**Визначення:** Stage-based workflow система де кожен етап (stage) має:
- Чітко визначену роль
- Вхідні та вихідні умови
- Зв'язок з конкретним агентом
- Промпт з `prompts/` директорії

### 8.2 Правильна робота зі стажами

```javascript
// ❌ НЕПРАВИЛЬНО - стаж з fallback
async function executeStage(stage, input) {
  try {
    const result = await callAgent(stage.agent, input);
    return result;
  } catch (error) {
    // Fallback маскує проблему
    return generateFallbackResponse();
  }
}

// ✅ ПРАВИЛЬНО - стаж без fallback
async function executeStage(stage, input, session) {
  const prompt = await promptRegistry.get(stage.agent, stage.name);
  const context = buildContext(session);
  
  const result = await callAgent(stage.agent, {
    prompt,
    context,
    input
  });
  
  if (!result) {
    throw new StageExecutionError(
      `Stage ${stage.name} failed - no response from ${stage.agent}`
    );
  }
  
  return result;
}
```

---

## 9. ЖИВІ ПРОМПТИ - СИСТЕМА БЕЗ ХАРДКОДУ

### 9.1 Поточна проблема

```javascript
// ❌ Промпт захардкоджений в коді
const fallbackResponse = {
  agent: 'atlas',
  content: 'Вітаю! Я — Атлас, цифрове втілення інтелекту...',
  ...
};
```

### 9.2 Правильний підхід - живі промпти

```javascript
// ✅ Промпт з файлової системи
const prompt = await promptRegistry.get('atlas', 'chat_greeting');

// ✅ Промпт з контекстом
const renderedPrompt = await promptRegistry.render('atlas', 'chat_mode', {
  userName: session.user?.name || 'користувач',
  conversationHistory: session.history,
  currentTopic: session.meta?.topic
});
```

**Переваги:**
- Промпти можна міняти без зміни коду
- Версіонування промптів
- A/B тестування різних промптів
- Легке оновлення personality агентів

---

## 10. ПЛАН РЕФАКТОРИНГУ

### Фаза 1: Діагностика та очищення (1-2 години)
- ✅ Створити цей документ аналізу
- ⏳ Видалити fallback з `executor-v3.js`
- ⏳ Видалити fallback з `state-analyzer.js`
- ⏳ Перевірити де ще використовується fallback

### Фаза 2: Впровадження контексту (2-3 години)
- ⏳ Модифікувати `agent-stage-processor.js`
- ⏳ Додати `buildContextMessages()` метод
- ⏳ Оновити виклики `callGooseAgent()`
- ⏳ Тестувати передачу історії

### Фаза 3: Уніфікація конфігурацій (1 година)
- ⏳ Видалити дубльовані config файли
- ⏳ Переконатися що всі модулі використовують `global-config.js`
- ⏳ Оновити документацію

### Фаза 4: Виправлення chat workflow (1-2 години)
- ⏳ Додати умову для продовження розмови
- ⏳ Реалізувати розрізнення "нова розмова" vs "продовження"
- ⏳ Тестувати багатокрокові діалоги

### Фаза 5: Інтеграційне тестування (1 година)
- ⏳ Запустити систему
- ⏳ Пройти всі тести з розділу 7
- ⏳ Перевірити логи на наявність fallback викликів
- ⏳ Валідувати що контекст передається

---

## 11. ОЧІКУВАНІ РЕЗУЛЬТАТИ

### До рефакторингу (поточний стан):
```
[USER] Привіт
[ATLAS] Вітаю! Я — Атлас...

[USER] Як справи?
[ATLAS] Вітаю! Я — Атлас... // ❌ Повторює привітання
```

### Після рефакторингу (очікуваний стан):
```
[USER] Привіт
[ATLAS] Привіт! Радий вас бачити. Як я можу допомогти?

[USER] Як справи?
[ATLAS] У мене все чудово, дякую за запитання! А у вас як?

[USER] Розкажи анекдот
[ATLAS] З радістю! Ось добрий анекдот про програмістів...
```

---

## 12. МЕТРИКИ УСПІХУ

1. **Контекст утримується:** >= 95% випадків у багатокрокових діалогах
2. **Fallback викликів:** 0 в chat mode
3. **Час відповіді:** < 3 секунди для chat mode
4. **Релевантність відповідей:** Якісна оцінка покращилась

---

## 13. РИЗИКИ ТА MITIGATION

### Ризик #1: Goose не підтримує conversation history
**Mitigation:** Передавати історію як частину промпту

### Ризик #2: Надто довгий контекст перевищує ліміти
**Mitigation:** Обмеження до останніх 10 повідомлень + smart truncation

### Ризик #3: Порушення існуючого task workflow
**Mitigation:** Зміни ТІЛЬКИ в chat mode, task mode залишається незмінним

---

## ВИСНОВОК

Система має **архітектурні проблеми** з контекстом та надмірною кількістю fallback механізмів. Рішення полягає в:

1. **Видаленні всіх fallback** (крім критичних випадків)
2. **Впровадженні передачі контексту** через `session.history`
3. **Уніфікації конфігурацій** до єдиного `global-config.js`
4. **Виправленні chat workflow** для підтримки продовження розмов

Наступний крок: **покроковий рефакторинг** з тестуванням після кожного етапу.
