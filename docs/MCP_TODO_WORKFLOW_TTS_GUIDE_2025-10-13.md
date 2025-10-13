# MCP Dynamic TODO Workflow - TTS озвучення та виправлення (13.10.2025 ~23:30)

## 🎯 Огляд workflow

MCP Dynamic TODO Workflow - це **item-by-item execution** система, де:
- **Atlas** створює TODO список (1-3 або 4-10 пунктів)
- **Тетяна** планує tools і виконує КОЖЕН пункт окремо
- **Гріша** перевіряє КОЖЕН виконаний пункт
- **Atlas** коригує TODO при помилках (до 3 спроб)

---

## 🔄 Workflow схема

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 0.5: Backend Selection (System)                       │
│ Визначає: mcp vs goose                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 1-MCP: Atlas TODO Planning                            │
│ - Аналізує запит                                            │
│ - Створює TODO (standard 1-3 / extended 4-10)              │
│ - Визначає complexity (1-10)                                │
│ 🔊 TTS: "План з X пунктів, починаю виконання" (2.5s)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │   ЦИКЛ ДЛЯ КОЖНОГО TODO ITEM         │
        └──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2.1-MCP: Тетяна Plan Tools                            │
│ - Аналізує item action                                      │
│ - Підбирає MCP tools (filesystem/playwright/etc)           │
│ - Готує parameters для виклику                              │
│ 🔊 TTS: "Відкриваю..." / "Створюю..." (150ms)              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2.2-MCP: Тетяна Execute Tools                         │
│ - Викликає MCP tools через MCP Manager                      │
│ - Збирає результати виконання                               │
│ 🔊 TTS: "Створено" / "Відкрито" / "Готово" (100-800ms)     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2.3-MCP: Гріша Verify Item                            │
│ - Перевіряє ТІЛЬКИ поточний item                            │
│ - Використовує success_criteria з TODO                      │
│ - Використовує tools для фактичної перевірки                │
│ 🔊 TTS: "Підтверджено" / "Не підтверджено" (800ms)         │
└─────────────────────────────────────────────────────────────┘
                           ↓
                     ┌──────────┐
                     │ OK?      │
                     └──────────┘
                    /            \
                  ТАК           НІ
                   ↓             ↓
         Наступний item    Stage 3-MCP
                           Atlas Adjust
                           (до 3 спроб)
                                ↓
                           Retry item
                                ↓
        └────────── ПОВТОР ЦИКЛУ ──────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 8-MCP: Final Summary (System)                         │
│ - Генерує фінальний звіт                                    │
│ - Success rate: X% (completed/failed/skipped)               │
│ 🔊 TTS: "Завдання виконано на X%" (2-3s)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔊 TTS озвучення в workflow

### Atlas (Stage 1-MCP)
- **Початок:** "План з 3 пунктів, починаю виконання" (2.5s)
- **Режими:** standard (1-3) / extended (4-10)
- **Complexity:** 1-10 визначає режим

### Тетяна (Stages 2.1, 2.2)

#### Stage 2.1 - Plan Tools (150ms - quick)
```javascript
// Генерується в _generatePlanTTS()
"Відкриваю..."     // Якщо action.includes('відкр')
"Створюю..."       // Якщо action.includes('створ')
"Зберігаю..."      // Якщо action.includes('збер')
"Шукаю..."         // Інші дії
```

#### Stage 2.2 - Execute Tools (100-800ms)
```javascript
// Генерується в _generateExecutionTTS()
"Створено"         // створ* + success
"Відкрито"         // відкр* + success
"Збережено"        // збер* + success
"Знайдено"         // знайд* + success
"Готово"           // Інші + success
"Виконано частково" // Часткова успішність
```

### Гріша (Stage 2.3)
- **Success:** "✅ Підтверджено" (800ms)
- **Failure:** "❌ Не підтверджено" (800ms)

### System (Stage 8)
- **Final:** "Завдання виконано на 100%" (2-3s)
- **Partial:** "Виконано частково: 67%" (2-3s)
- **Failed:** "Не вдалося виконати завдання" (2s)

---

## 🐛 Виправлені помилки (13.10.2025 ~23:30)

### 1. ❌ `action: undefined` в TODO items

**Проблема:**
```
[STAGE-1-MCP]      1. undefined
[STAGE-1-MCP]      2. undefined
[STAGE-1-MCP]      3. undefined
```

**Причина:**
LLM НЕ отримував **детальний промпт з JSON schema** і прикладами. Використовувався мінімальний:
```javascript
content: 'You are Atlas, a planning AI. Create a TODO list in JSON format.'
```

**Виправлення:**
```javascript
// orchestrator/workflow/mcp-todo-manager.js - createTodo()

// БУЛО (WRONG):
const prompt = this._buildTodoCreationPrompt(request, context);
messages: [
    { role: 'system', content: 'You are Atlas...' }, // Мінімальний промпт
    { role: 'user', content: prompt }
]

// СТАЛО (CORRECT):
const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
const todoPrompt = MCP_PROMPTS.ATLAS_TODO_PLANNING;

const userMessage = todoPrompt.userPrompt
    .replace('{{request}}', request)
    .replace('{{context}}', JSON.stringify(context, null, 2));

messages: [
    {
        role: 'system',
        content: todoPrompt.systemPrompt // ПОВНИЙ промпт з schema + приклади!
    },
    {
        role: 'user',
        content: userMessage
    }
]
```

**Результат:**
✅ LLM тепер отримує **213 рядків детального промпту** з:
- JSON schema структури TodoItem
- Правилами створення TODO
- Прикладами Standard (3 items) та Extended (6 items) mode
- Чіткими критеріями вибору режиму

---

### 2. ❌ `workflowStart is not defined`

**Проблема:**
```
Backend selection error: workflowStart is not defined
Stage execution failed (stage=1, agent=atlas): content.replace is not a function
```

**Причина:**
Змінна `workflowStart` використовувалась в `executeTaskWorkflow()`, але НЕ була визначена:
```javascript
async function executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig) {
  let currentStage = session.currentStage || 1;
  // ... later ...
  duration: Date.now() - workflowStart // ❌ workflowStart не існує!
}
```

**Виправлення:**
```javascript
// orchestrator/workflow/executor-v3.js - executeTaskWorkflow()

async function executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig) {
  const workflowStart = Date.now(); // ✅ FIXED 13.10.2025
  let currentStage = session.currentStage || 1;
  const maxCycles = workflowConfig.maxCycles || 3;
  let cycleCount = 0;
  // ...
}
```

**Результат:**
✅ Workflow тепер коректно відстежує тривалість виконання

---

### 3. ❌ `content.replace is not a function`

**Проблема:**
```
Stage execution failed (stage=1, agent=atlas): content.replace is not a function
```

**Причина:**
`extractModeFromResponse(content)` очікував **стрінгу**, але отримував **об'єкт**:
```javascript
function extractModeFromResponse(content) {
  const cleanContent = content.replace(/^\[SYSTEM\]\s*/, '').trim(); // ❌ content = {}
}
```

**Виправлення:**
```javascript
// orchestrator/workflow/executor-v3.js - extractModeFromResponse()

function extractModeFromResponse(content) {
  try {
    // ✅ FIXED 13.10.2025 - Handle content as object or string
    let contentStr = content;
    if (typeof content === 'object' && content !== null) {
      contentStr = JSON.stringify(content);
    }
    
    const cleanContent = contentStr.replace(/^\[SYSTEM\]\s*/, '').trim();
    const json = JSON.parse(cleanContent);
    return json.mode === 'chat' ? 'chat' : 'task';
  } catch (error) {
    // Fallback parsing
    const text = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
    if (text.includes('"mode":"chat"') || text.includes('mode: chat')) {
      return 'chat';
    }
    return 'task'; // Default to task
  }
}
```

**Результат:**
✅ Функція тепер обробляє **обидва типи** - string і object

---

## 📊 Очікувані результати після виправлень

### До виправлення:
```
[TODO] Created standard TODO with 3 items (complexity: 5/10)
[STAGE-1-MCP]      1. undefined  ❌
[STAGE-1-MCP]      2. undefined  ❌
[STAGE-1-MCP]      3. undefined  ❌
Backend selection error: workflowStart is not defined  ❌
Stage execution failed: content.replace is not a function  ❌
```

### Після виправлення:
```
[TODO] Created standard TODO with 3 items (complexity: 5/10)
[STAGE-1-MCP]      1. Відкрити калькулятор через Spotlight  ✅
[STAGE-1-MCP]      2. Ввести формулу для результату 666 (22×30.27)  ✅
[STAGE-1-MCP]      3. Зробити скріншот результату та зберегти на Desktop  ✅
[STAGE-2.1-MCP] 🛠️ Planning tools... (Тетяна)
[STAGE-2.2-MCP] ⚙️ Executing tools... (Тетяна)
[STAGE-2.3-MCP] ✓ Verification... (Гріша)
[STAGE-8-MCP] 📊 Final summary... (System)
Success rate: 100%  ✅
```

---

## 🔍 Тестування

### 1. Перевірка TODO створення:
```bash
# Відправити запит через orchestrator
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Відкрий калькулятор і перемнож там дві цифри таким чином щоб в результаті вибило 666 і потім збережи скрін результату на робочому столі",
    "sessionId": "test_todo"
  }'

# Очікуваний результат в логах:
tail -f logs/orchestrator.log | grep -E "TODO|action"
# [TODO] Created standard TODO with 3 items
# [STAGE-1-MCP]      1. Відкрити калькулятор...  ✅
# [STAGE-1-MCP]      2. Ввести формулу...  ✅
# [STAGE-1-MCP]      3. Зробити скріншот...  ✅
```

### 2. Перевірка TTS озвучення:
```bash
# Моніторинг TTS подій
tail -f logs/orchestrator.log | grep -E "TTS|speak|phrase"

# Очікуваний результат:
# [TODO] TTS: "План з 3 пунктів, починаю виконання" (2.5s)
# [STAGE-2.1] TTS: "Відкриваю..." (150ms)
# [STAGE-2.2] TTS: "Відкрито" (800ms)
# [STAGE-2.3] TTS: "Підтверджено" (800ms)
# ... (для кожного item) ...
# [STAGE-8] TTS: "Завдання виконано на 100%" (2.5s)
```

### 3. Перевірка workflow без помилок:
```bash
# Перевірити що немає undefined та errors
tail -100 logs/orchestrator.log | grep -E "undefined|workflowStart|content.replace"
# Має бути ПУСТО (no errors)  ✅
```

---

## 📋 Критичні правила

### ✅ TODO Items створення:
1. **ЗАВЖДИ** використовуйте ПОВНИЙ промпт з `MCP_PROMPTS.ATLAS_TODO_PLANNING`
2. **НІКОЛИ** НЕ використовуйте мінімальні system prompts без schema
3. **Complexity** визначає режим: 1-4 → standard, 5-10 → extended
4. **Action** починається з дієслова: "Відкрити", "Створити", "Зберегти"
5. **Success criteria** чіткі та перевірні

### ✅ Workflow execution:
1. **Item-by-item** - НЕ всі items одночасно
2. **Dependencies** ТІЛЬКИ backward (item 3 → [1,2], НЕ [4+])
3. **Retry** max 3 спроби на кожен item
4. **Verification** Гріша перевіряє КОЖЕН item окремо

### ✅ TTS синхронізація:
1. **Quick** (100-200ms) - "Готово", "Помилка"
2. **Normal** (500-1000ms) - "Створено файл", "Дані зібрано"
3. **Detailed** (2-3s) - "План з 5 пунктів, починаю виконання"
4. **Темп** - короткі фрази для швидкого циклу

---

## 📄 Виправлені файли

1. **orchestrator/workflow/mcp-todo-manager.js**
   - Виправлено `createTodo()` - тепер використовує ПОВНИЙ промпт
   - Lines: ~85-115

2. **orchestrator/workflow/executor-v3.js**
   - Виправлено `executeTaskWorkflow()` - додано `workflowStart` визначення
   - Виправлено `extractModeFromResponse()` - type-safe обробка content
   - Lines: ~902, ~141-158

---

## 🎓 Додаткова інформація

**Документація:**
- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md` - Повний архітектурний опис
- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SUMMARY.md` - Короткий summary
- `prompts/mcp/atlas_todo_planning.js` - Промпт з JSON schema

**Тестування:**
```bash
./test-mcp-workflow.sh  # Повний тест MCP workflow
```

**Детальні логи:**
```bash
tail -f logs/orchestrator.log | grep -E "MCP|TODO|Stage"
```

---

**READY FOR TESTING** ✅
