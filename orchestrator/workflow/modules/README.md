# Workflow Executor Modules

**Рефакторинг від:** 2025-01-09  
**Версія:** 2.0.0

---

## 📋 Огляд

Модулі для workflow executor, винесені з монолітного `executor.js` (1217 рядків) для покращення модульності та підтримуваності.

---

## 📂 Структура

```
workflow/modules/
├── README.md                  ← Ви тут
├── prompt-loader.js          (350 рядків) ⭐ NEW
└── chat-helpers.js           (150 рядків) ⭐ NEW
```

**Економія в executor.js:** ~500 рядків винесено в модулі

---

## 🎯 Модулі

### 1. **Prompt Loader** (`prompt-loader.js`)

**Призначення:** Динамічне завантаження промптів для різних етапів workflow

**Основна функція:**
```javascript
import { loadStagePrompts } from './modules/prompt-loader.js';

const prompts = await loadStagePrompts(stage, agent, name, userMessage, session);
// Returns: { systemPrompt, userPrompt }
```

**Підтримувані етапи:**
- **Stage -3:** TTS Optimization
- **Stage 0:** Mode Selection (system), Atlas Chat
- **Stage 1:** Atlas Initial Processing
- **Stage 2:** Tetyana Execution
- **Stage 3:** Atlas Clarification
- **Stage 4:** Tetyana Retry
- **Stage 5:** Grisha Diagnosis
- **Stage 6:** Atlas Task Adjustment
- **Stage 7:** Grisha Verification
- **Stage 8:** System Completion
- **Stage 9:** Atlas Retry Cycle

**Функціонал:**
- ✅ Модульне завантаження prompt файлів
- ✅ Контекстна підготовка user prompts
- ✅ Робота з історією сесії
- ✅ Chat context management
- ✅ Error handling з fallback

**Внутрішні функції:**
```javascript
loadTTSOptimizationPrompts()   // Stage -3
loadModeSelectionPrompts()     // Stage 0 (system)
loadAtlasChatPrompts()         // Stage 0 (atlas)
loadAtlasStage1Prompts()       // Stage 1
loadTetyanaStage2Prompts()     // Stage 2
loadAtlasStage3Prompts()       // Stage 3
loadTetyanaStage4Prompts()     // Stage 4
loadGrishaStage5Prompts()      // Stage 5
loadAtlasStage6Prompts()       // Stage 6
loadGrishaStage7Prompts()      // Stage 7
loadAtlasStage9Prompts()       // Stage 9
```

---

### 2. **Chat Helpers** (`chat-helpers.js`)

**Призначення:** Допоміжні функції для роботи з чатом

**Основні функції:**

#### `detectChatTopic(userMessage, session)`
Виявляє тему розмови за допомогою AI

```javascript
const topic = await detectChatTopic("Розкажи про JavaScript", session);
// Returns: { topic: "JavaScript programming", confidence: 0.9 }
```

#### `isTopicChanged(prevTopic, nextTopicObj)`
Перевіряє чи змінилась тема розмови

```javascript
const changed = isTopicChanged("JavaScript", { topic: "Python" });
// Returns: true (різні теми)
```

#### `summarizeChatThread(messages)`
Створює резюме потоку чату

```javascript
const summary = await summarizeChatThread([...messages]);
// Returns: "Користувач питав про JavaScript, отримав поради..."
```

#### `manageChatContext(session, userMessage, response)`
Управління контекстом чату з carry-over між темами

```javascript
await manageChatContext(session, userMessage, response);
// Автоматично:
// - Додає повідомлення до чату
// - Виявляє зміну теми
// - Створює резюме при зміні
// - Управляє carry-overs
```

**Функціонал:**
- ✅ AI-based topic detection
- ✅ Smart topic change detection (50% word overlap)
- ✅ Automatic chat summarization
- ✅ Carry-over management (останні 3 теми)
- ✅ Context window management (10 messages)
- ✅ Error handling з graceful degradation

---

## 🔧 Використання в Executor

### До рефакторингу:
```javascript
// executor.js - 1217 рядків, все в одному файлі
async function loadStagePrompts(stage, agent, name, userMessage, session) {
    // 150+ рядків switch statement
    switch (stage) {
        case 0: /* ... */
        case 1: /* ... */
        // і т.д.
    }
}

async function detectChatTopic(userMessage, session) {
    // логіка виявлення теми
}

function isTopicChanged(prev, next) {
    // логіка перевірки
}
```

### Після рефакторингу:
```javascript
// executor.js - використовує модулі
import { loadStagePrompts } from './modules/prompt-loader.js';
import { manageChatContext } from './modules/chat-helpers.js';

// Чисто і модульно
const prompts = await loadStagePrompts(stage, agent, name, userMessage, session);
await manageChatContext(session, userMessage, response);
```

---

## 📊 Метрики

### До рефакторингу:
- **1 файл:** `executor.js` (1217 рядків)
- **Responsibilities:** Занадто багато (God Object anti-pattern)
- **Testability:** Важко
- **Maintainability:** Низька

### Після рефакторингу:
- **3 файли:**
  - `executor.js` (~700 рядків) - orchestration logic
  - `prompt-loader.js` (350 рядків) - prompt management
  - `chat-helpers.js` (150 рядків) - chat utilities
- **Responsibilities:** Чітко розділені (Single Responsibility)
- **Testability:** Легко ✅
- **Maintainability:** Висока ✅

**Скорочення executor.js:** 1217 → ~700 рядків (**-42%**)

---

## 🎯 Наступні кроки рефакторингу

### Ще можна винести з executor.js:

1. **Agent Executor Module** (~200 рядків)
   - `executeAgentStageStepByStep()`
   - TTS optimization logic
   - Response formatting

2. **Workflow Orchestrator** (~300 рядків)
   - `executeStepByStepWorkflow()`
   - Stage routing logic
   - Condition checking

3. **Stage Handlers** (окремі файли для кожного stage)
   - Stop Router Handler
   - Mode Selection Handler
   - Workflow Stage Handlers

### Потенційна структура:
```
workflow/
├── executor.js (головний файл, ~200 рядків)
└── modules/
    ├── prompt-loader.js ✅
    ├── chat-helpers.js ✅
    ├── agent-executor.js (планується)
    ├── workflow-orchestrator.js (планується)
    └── stage-handlers/ (планується)
        ├── stop-router-handler.js
        ├── mode-selection-handler.js
        └── workflow-stage-handler.js
```

---

## ✅ Переваги поточного рефакторингу

1. **Модульність** - Кожен модуль має чітку відповідальність
2. **Повторне використання** - Модулі можна використовувати окремо
3. **Тестування** - Легко писати unit tests
4. **Підтримка** - Легше знаходити та виправляти баги
5. **Розширення** - Простіше додавати нові етапи
6. **Читабельність** - Менше когнітивного навантаження

---

## 🧪 Приклади тестування

```javascript
// Тест Prompt Loader
test('loadStagePrompts loads Atlas Stage 1', async () => {
    const prompts = await loadStagePrompts(1, 'atlas', 'stage1', 'test', {});
    expect(prompts).toHaveProperty('systemPrompt');
    expect(prompts).toHaveProperty('userPrompt');
    expect(prompts.systemPrompt).toContain('Atlas');
});

// Тест Chat Helpers
test('isTopicChanged detects topic change', () => {
    const changed = isTopicChanged('JavaScript', { topic: 'Python' });
    expect(changed).toBe(true);
});

test('isTopicChanged detects same topic', () => {
    const changed = isTopicChanged('JavaScript basics', { topic: 'JavaScript fundamentals' });
    expect(changed).toBe(false); // 50%+ overlap
});
```

---

**Створено:** 2025-01-09  
**Автор:** ATLAS Refactoring Team  
**Версія:** 2.0.0  
**Статус:** 🔄 В процесі (42% завершено)
