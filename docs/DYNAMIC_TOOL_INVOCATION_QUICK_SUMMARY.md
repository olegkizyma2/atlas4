# Как работает динамический вызов инструментов - Quick Reference

## TL;DR: ДА, инструменты вызываются ПОСТОЯННО И ДИНАМИЧЕСКИ

Для каждого TODO item:
1. **LLM планирует** какие инструменты нужны (Stage 2.1)
2. **MCP Manager вызывает** их (Stage 2.2)
3. **LLM проверяет** результаты (Stage 2.3)
4. **Если failed** → retry с новым планом (Loop to Stage 2.1)

## 🔄 Цикл для каждого item

```
┌──────────────────────────┐
│ Item: "Открыть браузер"  │
└──────────┬───────────────┘
           ↓
┌──────────────────────────────────────────┐
│ Stage 2.1: LLM планирует tools           │
│ → axios.post('localhost:4000/...')       │
│ → LLM читает: TETYANA_PLAN_TOOLS prompt  │
│ → LLM читает: "Используй browser_id..."  │
│ → LLM генерирует JSON план               │
│                                          │
│ Plan JSON:                               │
│ {                                        │
│   "tool_calls": [{                       │
│     "server": "playwright",              │
│     "tool": "playwright_browser_open"    │
│   }]                                     │
│ }                                        │
└──────────┬───────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ Stage 2.2: MCP Manager вызывает tools    │
│ → mcpManager.executeTool(...) ВОЗ РАЗА   │
│ → Реальный вызов инструмента             │
│ → Результат: {success: true, output: ...}│
└──────────┬───────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ Stage 2.3: LLM проверяет результаты      │
│ → axios.post('localhost:4000/...')       │
│ → LLM читает: GRISHA_VERIFY_ITEM prompt  │
│ → LLM анализирует execution.results      │
│ → LLM смотрит скриншот                   │
│ → LLM генерирует: {verified: true}       │
└──────────┬───────────────────────────────┘
           ↓
        Успех ✅
        Далее Item 2
```

## 📍 Где в коде

```javascript
// Stage 2.1: Planning
orchestrator/workflow/mcp-todo-manager.js:636
async planTools(item, todo) {
  const apiResponse = await axios.post('http://localhost:4000/...', {
    messages: [
      {role: 'system', content: TETYANA_PLAN_TOOLS},  // ← Contains browser_id instructions!
      {role: 'user', content: `Item: ${item.action}\nAvailable: ${toolsSummary}`}
    ]
  });
  return JSON.parse(apiResponse.data.choices[0].message.content);
}

// Stage 2.2: Execution
orchestrator/workflow/mcp-todo-manager.js:991
async executeTools(plan, item) {
  const results = [];
  for (const toolCall of plan.tool_calls) {
    // ЗДЕСЬ РЕАЛЬНО ВЫЗЫВАЮТСЯ ИНСТРУМЕНТЫ!
    const result = await this.mcpManager.executeTool(
      toolCall.server,      // "playwright"
      toolCall.tool,        // "playwright_navigate"
      toolCall.parameters   // {browser_id: "12345", url: "..."}
    );
    results.push(result);
  }
  return {results};
}

// Stage 2.3: Verification
orchestrator/workflow/mcp-todo-manager.js:1500
async verifyItem(item, execution) {
  const apiResponse = await axios.post('http://localhost:4000/...', {
    messages: [
      {role: 'system', content: GRISHA_VERIFY_ITEM},
      {role: 'user', content: `Results: ${JSON.stringify(execution.results)}`}
    ]
  });
  return JSON.parse(apiResponse.data.choices[0].message.content);
}
```

## ✅ Пример: Real-world flow

**Задача:** "Открыть Google и найти Python"

### STEP 1: TODO Creation (Stage 1 - Atlas)
```
LLM (Atlas) анализирует запрос
↓
Генерирует список items:
[
  {id: 1, action: "Открыть браузер"},
  {id: 2, action: "Перейти на google.com"},
  {id: 3, action: "Ввести 'Python' в поиск"},
  {id: 4, action: "Нажать Enter"}
]
```

### STEP 2: Execute Item 1 (Для каждого item - loop):

**Stage 2.1 - Planning:**
```
Запрос к LLM:
- Item: "Открыть браузер"
- Available tools: [playwright_browser_open, playwright_navigate, ...]

LLM ответит (JSON):
{
  "tool_calls": [
    {"server": "playwright", "tool": "playwright_browser_open", 
     "parameters": {"browser": "chromium"}}
  ]
}
```

**Stage 2.2 - Execution:**
```
MCP Manager вызывает:
→ playwright_browser_open({browser: "chromium"})
← Response: {browser_id: "12345", success: true}

execution.results = [{
  tool: "playwright_browser_open",
  success: true,
  browser_id: "12345"
}]
```

**Stage 2.3 - Verification:**
```
Запрос к LLM (Grisha):
- Success criteria: "Браузер открыт"
- Execution results: [{tool: "playwright_browser_open", success: true}]
- Screenshot: /tmp/verify.png (показывает открытый браузер)

LLM ответит (JSON):
{
  "verified": true,
  "reason": "Браузер chromium открыт, process running",
  "evidence": {"screenshot": "видны элементы браузера"}
}
```

### STEP 3: Execute Item 2 (Автоматическое переиспользование browser_id!)

**Stage 2.1 - Planning:**
```
Запрос к LLM:
- Item: "Перейти на google.com"
- Available tools: [playwright_browser_open, playwright_navigate, ...]

LLM ответит (JSON):
{
  "tool_calls": [
    {"server": "playwright", "tool": "playwright_navigate",
     "parameters": {
       "browser_id": "12345",  ← АВТОМАТИЧЕСКИ передается!
       "url": "https://www.google.com"
     }}
  ]
}
```

**Stage 2.2 - Execution:**
```
MCP Manager вызывает:
→ playwright_navigate({browser_id: "12345", url: "https://www.google.com"})
← Response: {success: true, url: "google.com"}

execution.results = [{
  tool: "playwright_navigate",
  success: true,
  url: "google.com"
}]
```

### STEP 4: Items 3, 4 (Продолжение loop)
- Тот же цикл для каждого item
- browser_id автоматически используется для Items 3, 4
- 1 браузер для всего задания!

## 🎯 Почему это динамично?

| Аспект              | До (hardcoded)                 | После (dynamic)                     |
| ------------------- | ------------------------------ | ----------------------------------- |
| **Инструменты**     | Фиксированный список           | LLM выбирает для каждого item       |
| **Параметры**       | Hardcode значения              | LLM генерирует для конкретного item |
| **browser_id**      | Забываю передавать             | Автоматически в prompt!             |
| **Retry**           | Если failed - crash            | LLM может изменить план и retry     |
| **Масштабирование** | 10 items = 10 hardcode функций | Один loop для N items               |

## 🚀 Итог

✅ **Инструменты вызываются динамически**
- LLM планирует их для каждого item
- MCP Manager вызывает их в реальности
- Gريша проверяет результаты
- Автоматический retry при failure

✅ **browser_id работает автоматически**
- Конструкция в prompt (`prompts/mcp/tetyana_plan_tools_optimized.js`)
- LLM узнает о browser_id
- LLM сам передает его между инструментами
- 1 браузер для целого задания

✅ **Масштабируется**
- 1 item или 100 items - одинаковый алгоритм
- Работает с любыми инструментами (не только Playwright)
- Работает с любыми командами (не только web)

---
**Source:** `prompts/mcp/tetyana_plan_tools_optimized.js` (Stage 2.1)  
**Execution:** `orchestrator/workflow/mcp-todo-manager.js` (Stages 2.1-2.3)
