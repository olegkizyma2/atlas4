# Как работает динамический вызов инструментов в MCP (17.10.2025)

## 📊 Полный цикл выполнения

```
┌─────────────────────────────────────────────────────────────────────┐
│ ПОЛЬЗОВАТЕЛЬ: "Отправь письмо другу и сделай скриншот"             │
└────────────────┬────────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ATLAS (Stage 1): Parse request + Create TODO list                  │
│ TODO: [                                                              │
│   {id: 1, action: "Открыть email приложение"},                    │
│   {id: 2, action: "Написать письмо"},                             │
│   {id: 3, action: "Отправить письмо"},                            │
│   {id: 4, action: "Сделать скриншот"}                             │
│ ]                                                                    │
└────────────────┬────────────────────────────────────────────────────┘
                 ↓
        ╔════════════════════════════════════════════════╗
        ║ FOR EACH TODO ITEM (executeItemWithRetry):    ║
        ║ Item 1 → Item 2 → Item 3 → Item 4            ║
        ╚────────────────┬───────────────────────────────╝
                         ↓
    ┌──────────────────────────────────────────────────────┐
    │ Item 1: "Открыть email приложение"                 │
    └──────────────┬───────────────────────────────────────┘
                   ↓
    ╔══════════════════════════════════════════════════════╗
    ║ STAGE 2.0: MCP Server Selection (ДИНАМИЧЕСКИЙ)      ║
    ║                                                      ║
    ║ ЗАПРОС К LLM: "Какой сервер нужен для email app?" ║
    ║ LLM ОТВЕТИТ: "applescript" (для macOS GUI)         ║
    ║ ФИЛЬТР: Только 1 инструмент (applescript_execute)  ║
    ╚──────────────┬───────────────────────────────────────╝
                   ↓
    ╔══════════════════════════════════════════════════════╗
    ║ STAGE 2.1: Plan Tools (ДИНАМИЧЕСКИЙ - Tetyana)      ║
    ║                                                      ║
    ║ ЗАПРОС К LLM:                                       ║
    ║ "Какие инструменты нужны чтобы открыть Mail app?"  ║
    ║                                                      ║
    ║ ДОСТУПНЫЕ ИНСТРУМЕНТЫ:                              ║
    ║ - applescript_execute (GUI automation)              ║
    ║ - playwright_browser_open (web automation)          ║
    ║ - filesystem_read/write (file operations)           ║
    ║                                                      ║
    ║ LLM ОТВЕТИТ (JSON):                                 ║
    ║ {                                                    ║
    ║   "tool_calls": [{                                  ║
    ║     "server": "applescript",                        ║
    ║     "tool": "applescript_execute",                  ║
    ║     "parameters": {                                 ║
    ║       "script": "activate application Mail"         ║
    ║     }                                                ║
    ║   }]                                                 ║
    ║ }                                                    ║
    ╚──────────────┬───────────────────────────────────────╝
                   ↓
    ╔══════════════════════════════════════════════════════╗
    ║ STAGE 2.1.5: Screenshot & Adjust (Tetyana)         ║
    ║                                                      ║
    ║ ДИНАМИЧЕСКИЙ ПРОЦЕСС:                              ║
    ║ 1. Сделать скриншот текущего экрана                ║
    ║ 2. Показать LLM скриншот                            ║
    ║ 3. LLM анализирует: "Mail уже открыта? Нужны ли  │
    ║    корректировки?"                                  ║
    ║ 4. LLM может изменить план на лету                 ║
    ╚──────────────┬───────────────────────────────────────╝
                   ↓
    ╔══════════════════════════════════════════════════════╗
    ║ STAGE 2.2: Execute Tools (Tetyana)                  ║
    ║                                                      ║
    ║ ВЫЗОВ MCP ИНСТРУМЕНТА:                              ║
    ║ MCP Manager → applescript server →                  ║
    ║ applescript_execute {                               ║
    ║   script: "activate application Mail"              ║
    ║ }                                                    ║
    ║                                                      ║
    ║ РЕЗУЛЬТАТ:                                          ║
    ║ {                                                    ║
    ║   success: true,                                    ║
    ║   output: "Mail application activated"              ║
    ║ }                                                    ║
    ╚──────────────┬───────────────────────────────────────╝
                   ↓
    ╔══════════════════════════════════════════════════════╗
    ║ STAGE 2.3: Verify (Grisha)                          ║
    ║                                                      ║
    ║ ДИНАМИЧЕСКИЙ ПРОЦЕСС:                              ║
    ║ 1. Взять execution_results                          ║
    ║ 2. Сделать скриншот                                 ║
    ║ 3. Показать LLM скриншот + execution results       ║
    ║ 4. LLM анализирует: "Mail открыта? Успешно?"       ║
    ║ 5. LLM генерирует JSON: {verified: true/false}     ║
    ╚──────────────┬───────────────────────────────────────╝
                   ↓
    ┌──────────────────────────────────────────────────────┐
    │ Item 2: "Написать письмо"                           │
    │ (Повторить тот же цикл, но с другим планом)        │
    └──────────────┬───────────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────────────────────────┐
    │ Item 3: "Отправить письмо"                          │
    │ (Повторить тот же цикл)                            │
    └──────────────┬───────────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────────────────────────┐
    │ Item 4: "Сделать скриншот"                          │
    │ (Повторить тот же цикл)                            │
    └──────────────┬───────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ATLAS (Stage 8): Generate Final Summary                             │
│ "Письмо отправлено. Скриншот: /tmp/screenshot.png"                │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Динамический процесс вызова инструментов

### Как это работает ПОСТОЯННО И ДИНАМИЧЕСКИ:

```javascript
// orchestrator/workflow/mcp-todo-manager.js:487-595

async executeItemWithRetry(item, todo) {
  for (let attempt = 1; attempt <= item.max_attempts; attempt++) {
    try {
      // STAGE 2.0: Server Selection (ДИНАМИЧЕСКИЙ)
      const serverSelection = await this._selectMCPServers(item, todo);
      // ↓
      // LLM анализирует: какой сервер нужен для ЭТОГО item?
      // Фильтрует 92+ инструмента до 1-5 нужных

      // STAGE 2.1: Plan Tools (ДИНАМИЧЕСКИЙ)
      const plan = await this.planTools(item, todo, {selectedServers});
      // ↓
      // LLM анализирует item.action и доступные tools
      // Генерирует JSON с конкретными вызовами инструментов

      // STAGE 2.1.5: Screenshot & Adjust (ДИНАМИЧЕСКИЙ)
      const screenshotResult = await this.screenshotAndAdjust(plan, item);
      // ↓
      // LLM смотрит на скриншот и может изменить план

      // STAGE 2.2: Execute Tools (ДЕЙСТВИТЕЛЬНЫЙ вызов)
      const execution = await this.executeTools(finalPlan, item);
      // ↓
      // Здесь РЕАЛЬНО вызываются инструменты из плана
      // Каждый tool_call из JSON выполняется через MCP Manager

      // STAGE 2.3: Verify (ДИНАМИЧЕСКИЙ)
      const verification = await this.verifyItem(item, execution);
      // ↓
      // LLM анализирует результаты и скриншот
      // Определяет: удалось ли выполнить item?

      // Если verified=true → переход к item 2
      // Если verified=false → retry (попытка 2,3...)
    }
  }
}
```

## 🎯 Где именно вызываются инструменты?

### STAGE 2.1: Planning (generateплан)
- **Где:** `orchestrator/workflow/mcp-todo-manager.js:636-800`
- **Кто:** LLM (gpt-4o-mini на port 4000)
- **Что делает:**
  ```javascript
  const apiResponse = await axios.post('http://localhost:4000/v1/chat/completions', {
    model: 'openai/gpt-4o-mini',
    messages: [{
      role: 'system',
      content: TETYANA_PLAN_TOOLS.systemPrompt  // ← Именно сюда подставляется browser_id инструкция!
    }, {
      role: 'user',
      content: `Available tools:\n${toolsSummary}\n\nItem: ${item.action}`
    }]
  });
  
  // LLM ОТВЕТИТ JSON ТИПА:
  // {
  //   "tool_calls": [
  //     {"server": "playwright", "tool": "playwright_browser_open", ...},
  //     {"server": "playwright", "tool": "playwright_navigate", "parameters": {"browser_id": "12345", ...}}
  //   ]
  // }
  ```

### STAGE 2.2: Execution (ДЕЙСТВИТЕЛЬНЫЙ вызов)
- **Где:** `orchestrator/workflow/mcp-todo-manager.js:991-1080`
- **Кто:** MCP Manager
- **Что делает:**
  ```javascript
  async executeTools(plan, item) {
    const results = [];
    
    for (const toolCall of plan.tool_calls) {
      try {
        // ЗДЕСЬ ВЫЗЫВАЕТСЯ РЕАЛЬНЫЙ ИНСТРУМЕНТ!
        const result = await this.mcpManager.executeTool(
          toolCall.server,      // "playwright"
          toolCall.tool,        // "playwright_navigate"
          toolCall.parameters   // {"browser_id": "12345", "url": "..."}
        );
        
        results.push({...result, success: true});
      } catch (error) {
        results.push({...toolCall, success: false, error});
      }
    }
    
    return {results, ...};
  }
  ```

### STAGE 2.3: Verification (анализ результатов)
- **Где:** `orchestrator/workflow/mcp-todo-manager.js:1500-1700`
- **Кто:** LLM (gpt-4o-mini)
- **Что делает:**
  ```javascript
  const verification = await axios.post('http://localhost:4000/v1/chat/completions', {
    messages: [{
      role: 'system',
      content: GRISHA_VERIFY_ITEM.systemPrompt  // ← Инструкции Гриши
    }, {
      role: 'user',
      content: `Execution Results:\n${JSON.stringify(execution.results)}\n\nScreenshot: /tmp/...`
    }]
  });
  
  // LLM ОТВЕТИТ JSON:
  // {
  //   "verified": true/false,
  //   "reason": "...",
  //   "evidence": {...}
  // }
  ```

## 📝 Как это работает ДИНАМИЧЕСКИ для каждого item:

| Item           | Тип         | Плани Инструмент                        | Параметры                           | Проверка               |
| -------------- | ----------- | --------------------------------------- | ----------------------------------- | ---------------------- |
| 1: Open email  | Applescript | applescript_execute                     | script: "activate application Mail" | Скриншот Mail открыта  |
| 2: Write email | Keyboard    | keyboard_type, playwright_click         | text, selector + browser_id         | Скриншот текст там     |
| 3: Send email  | Mouse       | mouse_click, applescript_execute        | x,y координаты + script             | Скриншот кнопка нажата |
| 4: Screenshot  | Screenshot  | shell_execute или playwright_screenshot | path: "/tmp/..."                    | Файл существует        |

## 🚀 Оптимизация: browser_id работает ДИНАМИЧЕСКИ

**Правильный паттерн в Stage 2.1:**
```javascript
// Item: "Открыть Google и поискать Python"
// Доступные инструменты: [playwright tools]
// Tetyana план (из LLM):
{
  "tool_calls": [
    {"server": "playwright", "tool": "playwright_browser_open", "parameters": {...}},
    {"server": "playwright", "tool": "playwright_navigate", 
     "parameters": {"browser_id": "12345", "url": "google.com"}},  ← browser_id!
    {"server": "playwright", "tool": "playwright_fill",
     "parameters": {"browser_id": "12345", "selector": "[name='q']", "value": "Python"}}  ← browser_id!
  ]
}
```

**Затем в Stage 2.2 эти инструменты вызываются по очереди через MCP Manager:**
1. playwright_browser_open → запускает браузер, возвращает browser_id
2. playwright_navigate → использует browser_id (тот же браузер!)
3. playwright_fill → использует browser_id (тот же браузер!)

## ✅ Итог

**ДА, инструменты вызываются ПОСТОЯННО И ДИНАМИЧЕСКИ:**
- ✅ Для каждого TODO item свой план инструментов
- ✅ LLM генерирует JSON с нужными инструментами
- ✅ MCP Manager вызывает их по очереди
- ✅ browser_id передается автоматически между инструментами
- ✅ Gриша проверяет результаты
- ✅ Если failed → retry с новым планом или корректировкой

**Без hardcode:**
- ❌ Инструменты НЕ жестко запрограммированы
- ✅ LLM выбирает их на основе item.action
- ✅ Фильтрация через Stage 2.0 (server selection)
- ✅ Optimization через browser_id в Stage 2.1

---
**Файл:** `prompts/mcp/tetyana_plan_tools_optimized.js` (с инструкциями о browser_id)
**Execution:** `orchestrator/workflow/mcp-todo-manager.js`
**Дата:** 17 октября 2025
