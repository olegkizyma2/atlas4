# 🔧 Як Тетяна та Гриша отримують і використовують MCP інструменти

## 📋 Огляд процесу

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATLAS MCP Tool System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  6 MCP SERVERS → 92+ TOOLS (всього доступно)                   │
│  ├─ shell (9 tools) - команди, скрінші                         │
│  ├─ filesystem (14 tools) - читання/запис файлів               │
│  ├─ playwright (32 tools) - веб браузер, скріншоти              │
│  ├─ applescript (1 tool) - GUI automation                       │
│  ├─ git (27 tools) - версійний контроль                         │
│  └─ memory (9 tools) - збереження даних                         │
│                                                                 │
│  ↓                                                              │
│                                                                 │
│  ЭТАП 1: MCP Manager запускає сервери                           │
│  ↓                                                              │
│  ЭТАП 2: Тетяна ПЛАНУЄ які інструменти потрібні                 │
│  ↓                                                              │
│  ЭТАП 3: Тетяна ВИКОНУЄ інструменти                             │
│  ↓                                                              │
│  ЭТАП 4: Гриша ПЛАНУЄ верифікацію                               │
│  ↓                                                              │
│  ЭТАП 5: Гриша ВИКОНУЄ верифікацію                              │
│  ↓                                                              │
│  ЭТАП 6: Гриша АНАЛІЗУЄ результати                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 ЕТАП 1: MCP Manager запускає сервери

**Файл:** `/orchestrator/ai/mcp-manager.js`

```javascript
class MCPManager {
    constructor() {
        this.servers = new Map();  // { 'shell': MCPServer, 'filesystem': MCPServer, ... }
    }
    
    async initialize() {
        // Запустити кожен MCP server
        // 1. shell → npx super-shell-mcp
        // 2. filesystem → npx @modelcontextprotocol/server-filesystem
        // 3. playwright → npx @executeautomation/playwright-mcp-server
        // 4. applescript → npx @peakmojo/applescript-mcp
        // 5. git → npx @cyanheads/git-mcp-server
        // 6. memory → npx @modelcontextprotocol/server-memory
        
        // Кожен server має список TOOLS
        // Приклад: shell server має 9 tools:
        //   - execute_command
        //   - get_platform_info
        //   - get_whitelist
        //   - add_to_whitelist
        //   - approve_command
        //   - deny_command
        //   - etc.
    }
    
    getAvailableTools() {
        // Повертає УСІХ 92+ tools з усіх 6 servers
        // Структура: { tool, server, description, inputSchema, ... }
        const allTools = [];
        
        for (const server of this.servers.values()) {
            for (const tool of server.tools) {
                allTools.push({
                    ...tool,
                    server: server.name  // Додати назву сервера!
                });
            }
        }
        
        return allTools;  // 92 tools
    }
    
    getToolsSummary(filterServers = null) {
        // Повертає КОМПАКТНИЙ опис:
        // "- shell (9 tools): execute_command, get_platform_info, ..."
        // "- filesystem (14 tools): read_file, write_file, ..."
    }
    
    executeTool(serverName, toolName, parameters) {
        // ВИКОНАТИ MCP tool
        // 1. Знайти server за назвою
        // 2. Викликати tool з параметрами
        // 3. Повернути результат
    }
}
```

---

## 🎯 ЕТАП 2: Тетяна ПЛАНУЄ інструменти

**Файл:** `/orchestrator/workflow/mcp-todo-manager.js` (метод `planTools()`)

```javascript
async planTools(item, todo, options = {}) {
    // КРОК 1: Отримати список доступних інструментів
    
    // Три способи:
    // 1️⃣ BEST: Pre-filtered servers (від Stage 2.0 selection)
    if (options.selectedServers?.length > 0) {
        // Тільки 2-3 сервери (наприклад: shell + playwright)
        const availableTools = this.mcpManager.getToolsFromServers(['shell', 'playwright']);
        // Результат: ~40 tools замість 92 (56% економія)
    }
    
    // 2️⃣ GOOD: Pre-generated summary
    else if (options.toolsSummary) {
        // Use provided summary
    }
    
    // 3️⃣ FALLBACK: ALL servers (не рекомендується)
    else {
        const toolsSummary = this.mcpManager.getToolsSummary();
        // Результат: 92 tools (повільно, велике повідомлення)
    }
    
    // КРОК 2: Передати Тетяні через промпт
    
    const { MCP_PROMPTS } = await import('../../prompts/mcp/index.js');
    const planPrompt = MCP_PROMPTS.TETYANA_PLAN_TOOLS;  // Промпт для Тетяни
    
    // Замінити {{AVAILABLE_TOOLS}} в промпті на реальний список
    let systemPrompt = planPrompt.systemPrompt;
    if (systemPrompt.includes('{{AVAILABLE_TOOLS}}')) {
        systemPrompt = systemPrompt.replace('{{AVAILABLE_TOOLS}}', toolsSummary);
    }
    
    // КРОК 3: Передати завдання LLM (Тетяна через гарячу лінію 4000)
    
    const apiResponse = await axios.post('http://localhost:4000/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',  // Швидка модель для планування
        messages: [
            { role: 'system', content: systemPrompt },  // ← Промпт з інструментами!
            { role: 'user', content: userMessage }
        ],
        temperature: 0.3,  // Точність
        max_tokens: 2000
    });
    
    // КРОК 4: Тетяна повертає план
    
    const response = apiResponse.data.choices[0].message.content;
    const plan = this._parseToolPlan(response);
    
    // Результат: JSON з tool_calls
    // {
    //   "tool_calls": [
    //     {
    //       "server": "playwright",
    //       "tool": "screenshot",
    //       "parameters": { "path": "/tmp/calc.png" }
    //     },
    //     {
    //       "server": "shell",
    //       "tool": "execute_command",
    //       "parameters": { "command": "open -a Calculator" }
    //     }
    //   ]
    // }
}
```

### 🧠 Тетяна видає план

**Промпт у файлі:** `/prompts/mcp/tetyana_plan_tools_optimized.js`

```javascript
// TETYANA_PLAN_TOOLS промпт
const SYSTEM_PROMPT = `
Ти Тетяна - виконавець завдань. Ти можеш використовувати MCP інструменти для виконання завдань.

Доступні MCP інструменти:
{{AVAILABLE_TOOLS}}  ← Замінюється реальним списком!

ПРИКЛАДИ:
1. Відкрити браузер:
   [{"server": "playwright", "tool": "browser_launch", "parameters": {}}]

2. Зробити скріншот:
   [{"server": "playwright", "tool": "screenshot", "parameters": {"path": "/tmp/screen.png"}}]

3. Виконати shell команду:
   [{"server": "shell", "tool": "execute_command", "parameters": {"command": "ls -la"}}]

4. Записати файл:
   [{"server": "filesystem", "tool": "write_file", "parameters": {"path": "/tmp/file.txt", "content": "text"}}]

Обери мінімальний набір інструментів для виконання завдання.
`;

// Користувач передає завдання
const USER_PROMPT = `
TODO Item: Відкрити браузер і перейти на google.com
Success Criteria: Браузер повинен показати сторінку пошуку Google
Suggested Tools: playwright browser_launch, navigate

Доступні інструменти: ...

Поверни ТІЛЬКИ JSON з tool_calls array.
`;

// Тетяна повертає:
// {
//   "tool_calls": [
//     {"server": "playwright", "tool": "browser_launch", "parameters": {}},
//     {"server": "playwright", "tool": "navigate", "parameters": {"url": "https://google.com"}}
//   ]
// }
```

---

## 🎯 ЕТАП 3: Тетяна ВИКОНУЄ інструменти

**Файл:** `/orchestrator/workflow/mcp-todo-manager.js` (метод `executeTools()`)

```javascript
async executeTools(plan, item) {
    // plan містить tool_calls від Тетяни
    // [
    //   { "server": "playwright", "tool": "browser_launch", "parameters": {} },
    //   { "server": "playwright", "tool": "navigate", "parameters": {"url": "..."} }
    // ]
    
    const results = [];
    let allSuccessful = true;
    
    // Виконати кожен tool поспіль
    for (const toolCall of plan.tool_calls) {
        try {
            console.log(`[TODO] Calling ${toolCall.tool} on ${toolCall.server}`);
            
            // ВИКОНАТИ TOOL через MCP Manager!
            const result = await this.mcpManager.executeTool(
                toolCall.server,      // "playwright"
                toolCall.tool,        // "browser_launch"
                toolCall.parameters   // {}
            );
            
            // Зберегти результат
            results.push({
                tool: toolCall.tool,
                server: toolCall.server,
                success: true,
                result  // Результат виконання
            });
            
        } catch (error) {
            // Якщо помилка - також записати
            results.push({
                tool: toolCall.tool,
                server: toolCall.server,
                success: false,
                error: error.message
            });
            
            allSuccessful = false;
        }
    }
    
    // Повернути результати виконання
    return {
        results,
        all_successful: allSuccessful
    };
    
    // Структура результатів:
    // {
    //   "results": [
    //     {
    //       "tool": "browser_launch",
    //       "server": "playwright",
    //       "success": true,
    //       "result": { "browserId": "12345" }
    //     },
    //     {
    //       "tool": "navigate",
    //       "server": "playwright", 
    //       "success": true,
    //       "result": { "url": "https://google.com", "title": "Google" }
    //     }
    //   ],
    //   "all_successful": true
    // }
}
```

---

## 🎯 ЕТАП 4: Гриша ПЛАНУЄ верифікацію

**Файл:** `/orchestrator/workflow/mcp-todo-manager.js` (метод `_planVerificationTools()`)

```javascript
async _planVerificationTools(item, execution, options = {}) {
    // execution - результати виконання від Тетяни
    
    // КРОК 1: Отримати tools для верифікації (ж як Тетяна)
    
    let toolsSummary;
    if (options.selectedServers?.length > 0) {
        // Pre-selected servers
        toolsSummary = this.mcpManager.getDetailedToolsSummary(options.selectedServers);
    } else {
        toolsSummary = this.mcpManager.getToolsSummary();
    }
    
    // КРОК 2: Передати завдання верифікації Грише (через LLM)
    
    const planPrompt = `
Ти Гриша - верифікатор. Визнач які MCP інструменти потрібні для перевірки виконання.

⚠️ ОБОВ'ЯЗКОВО: ЗАВЖДИ включай screenshot для візуальної перевірки!

TODO Item: ${item.action}
Success Criteria: ${item.success_criteria}
Tetyana's Execution Results: ${JSON.stringify(execution.results)}

Доступні інструменти:
${toolsSummary}

Обери МІНІМАЛЬНИЙ набір для перевірки. Screenshot ОБОВ'ЯЗКОВИЙ.
`;
    
    const apiResponse = await axios.post('http://localhost:4000/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [
            { role: 'system', content: '...' },
            { role: 'user', content: planPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
    });
    
    // КРОК 3: Гриша повертає план верифікації
    
    const response = apiResponse.data.choices[0].message.content;
    const plan = this._parseToolPlan(response);
    
    // Результат: JSON з verification tool_calls
    // {
    //   "tool_calls": [
    //     {"server": "shell", "tool": "execute_command", "parameters": {"command": "screencapture /tmp/verify.png"}},
    //     {"server": "shell", "tool": "execute_command", "parameters": {"command": "cat ~/Desktop/result.txt"}}
    //   ]
    // }
}
```

### 🧠 Гриша видає план верифікації

**Промпт (inline у функції):**

```javascript
// Гриша обирає інструменти для перевірки

// ПРИКЛАДИ:
// 1. Для браузера:
//    [{"server": "shell", "tool": "execute_command", "parameters": {"command": "screencapture -x /tmp/verify.png"}}]

// 2. Для файлу на Desktop:
//    [{"server": "shell", "tool": "execute_command", "parameters": {"command": "cat ~/Desktop/file.txt"}}]

// 3. Для файлу в /tmp:
//    [{"server": "filesystem", "tool": "read_file", "parameters": {"path": "/tmp/file.txt"}}]

// Гриша завжди обирає screenshot перший!
```

---

## 🎯 ЕТАП 5: Гриша ВИКОНУЄ верифікацію

**Файл:** `/orchestrator/workflow/mcp-todo-manager.js` (метод `_executeVerificationTools()`)

```javascript
async _executeVerificationTools(plan, item) {
    // plan - верифікаційні tool_calls від Гріши
    
    const results = [];
    let allSuccessful = true;
    
    // Виконати кожен verification tool
    for (const toolCall of plan.tool_calls) {
        try {
            console.log(`[TODO] 🔧 Grisha calling ${toolCall.tool} on ${toolCall.server}`);
            
            // ВИКОНАТИ TOOL!
            const result = await this.mcpManager.executeTool(
                toolCall.server,
                toolCall.tool,
                toolCall.parameters || {}
            );
            
            // Зберегти результат верифікації
            results.push({
                tool: toolCall.tool,
                server: toolCall.server,
                success: true,
                result  // ← Це РЕАЛЬНІ дані перевірки (скріншот, вміст файлу, і т.д.)!
            });
            
        } catch (error) {
            results.push({
                tool: toolCall.tool,
                server: toolCall.server,
                success: false,
                error: error.message
            });
            
            allSuccessful = false;
        }
    }
    
    // Повернути результати верифікації
    return { results, all_successful: allSuccessful };
}
```

---

## 🎯 ЕТАП 6: Гриша АНАЛІЗУЄ результати

**Файл:** `/orchestrator/workflow/mcp-todo-manager.js` (метод `_analyzeVerificationResults()`)

```javascript
async _analyzeVerificationResults(item, execution, verificationResults) {
    // verificationResults - результати від verification tools!
    // Це РЕАЛЬНІ дані:
    // - screenshot.png (вміст файлу)
    // - ~/Desktop/file.txt (вміст файлу)
    // - Результат команди shell
    
    // КРОК 1: Безпечна перевірка структури
    
    if (!verificationResults?.results || !Array.isArray(verificationResults.results)) {
        return {
            verified: false,  // ✅ CRITICAL FIX!
            reason: 'Unable to verify - no verification data'
        };
    }
    
    // КРОК 2: Витягнути дані з верифікації
    
    const screenshotResult = verificationResults.results.find(r => r.tool === 'screenshot');
    const fileContentResult = verificationResults.results.find(r => r.tool === 'execute_command');
    
    // screenshotResult.result.path = "/tmp/verify.png"
    // fileContentResult.result.stdout = "333 × 333 = 333,333,333"  ← РЕАЛЬНІ ДАНІ!
    
    // КРОК 3: Передати ЛЛМ для аналізу
    
    let analysisPrompt = `
Verify that the action was executed correctly.

Item: ${item.action}
Success Criteria: ${item.success_criteria}

Verification Evidence:
${JSON.stringify(verificationResults.results, null, 2)}
`;
    
    const apiResponse = await axios.post('http://localhost:4000/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [
            { role: 'system', content: MCP_PROMPTS.GRISHA_VERIFY_ITEM.systemPrompt },
            { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.1,  // Максимальна точність!
        max_tokens: 1000
    });
    
    // КРОК 4: Гриша аналізує РЕАЛЬНІ дані!
    
    const response = apiResponse.data.choices[0].message.content;
    const verification = this._parseVerification(response);
    
    // Результат: TRUE/FALSE на основі РЕАЛЬНИХ результатів
    return verification;
    // {
    //   "verified": false,
    //   "reason": "Screenshot shows: 333×333=333,333,333, expected: 333×2=666",
    //   "evidence": "File content matches verification criteria"
    // }
}
```

---

## 📊 Практичний приклад: Калькулятор

### Завдання:
> Відкрити калькулятор і обчислити 333 × 2 = 666

---

### 🎯 ЕТАП 2: Тетяна ПЛАНУЄ

**Input:**
```
Available tools: shell (9), filesystem (14), playwright (32), applescript (1)
Item: Відкрити калькулятор та обчислити 333 × 2 = 666
```

**Tetyana LLM call:**
```
System: Ти Тетяна. Обери инструменты з доступних...
User: Завдання - відкрити Calculator...
```

**Tetyana's plan:**
```json
{
  "tool_calls": [
    {
      "server": "applescript",
      "tool": "applescript_execute",
      "parameters": {
        "code_snippet": "tell application \"Calculator\" to activate"
      }
    },
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "open -a Calculator && sleep 1 && screencapture -x /tmp/calc_step1.png"
      }
    }
  ]
}
```

---

### 🎯 ЕТАП 3: Тетяна ВИКОНУЄ

**Execution:**
```
1. applescript_execute on applescript
   ✅ SUCCESS: Calculator opened
   Result: { status: "Application started" }

2. execute_command on shell  
   ✅ SUCCESS: Screenshot taken
   Result: { stdout: "Screenshot saved to /tmp/calc_step1.png", stderr: "" }
```

**Execution results:**
```json
{
  "results": [
    {
      "tool": "applescript_execute",
      "server": "applescript",
      "success": true,
      "result": { "status": "Application started" }
    },
    {
      "tool": "execute_command",
      "server": "shell",
      "success": true,
      "result": { "stdout": "Screenshot saved", "stderr": "" }
    }
  ],
  "all_successful": true
}
```

---

### 🎯 ЕТАП 4: Гриша ПЛАНУЄ верифікацію

**Input:**
```
Available tools: shell (9), filesystem (14), playwright (32), applescript (1)
Tetyana's results: [...]
Item: Відкрити калькулятор та обчислити 333 × 2 = 666
```

**Grisha LLM call:**
```
System: Ти Гриша. Обери інструменти для ПЕРЕВІРКИ...
User: Заверши чи було завдання виконано... Screenshot ОБОВ'ЯЗКОВИЙ!
```

**Grisha's verification plan:**
```json
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -x /tmp/verify_calc.png"
      }
    },
    {
      "server": "shell", 
      "tool": "execute_command",
      "parameters": {
        "command": "open -a Calculator && osascript -e 'activate application \"Calculator\"' && sleep 0.5"
      }
    }
  ]
}
```

---

### 🎯 ЕТАП 5: Гриша ВИКОНУЄ верифікацію

**Verification execution:**
```
1. execute_command: screencapture
   ✅ SUCCESS: /tmp/verify_calc.png (файл з бінарними даними скріншота)
   
2. execute_command: activate Calculator
   ✅ SUCCESS: Calculator activated
```

**Verification results:**
```json
{
  "results": [
    {
      "tool": "execute_command",
      "server": "shell",
      "success": true,
      "result": {
        "stdout": "",
        "stderr": "",
        "path": "/tmp/verify_calc.png",
        "image_data": "..." ← БІНАРНІ ДАНІ СКРІНШОТА!
      }
    },
    {
      "tool": "execute_command",
      "server": "shell",
      "success": true,
      "result": { "stdout": "Activation successful" }
    }
  ]
}
```

---

### 🎯 ЕТАП 6: Гриша АНАЛІЗУЄ результати

**LLM Analysis:**
```
System: Ти Гриша. Аналізуй дані верифікації...
User: 
  Item: Відкрити калькулятор та обчислити 333 × 2 = 666
  Success Criteria: Result = 666
  Verification data: [screenshot, activation results]
  Screenshot content: Shows "333 × 333 = 333,333,333" ← ❌ НЕПРАВИЛЬНО!
```

**Grisha's final decision:**
```json
{
  "verified": false,
  "reason": "Screenshot shows 333×333=333,333,333, but expected 333×2=666",
  "evidence": "Visual verification failed - wrong calculation displayed",
  "confidence": 0.95
}
```

---

## 🔑 Ключові концепції

### 1. **МCP Manager** - центральна точка
- Запускає 6 MCP servers
- Управляє lifecycle
- Має метод `executeTool(server, tool, params)`

### 2. **Tools List** - динамічно генерується
- `getAvailableTools()` - всі 92 tools
- `getToolsSummary()` - компактний опис
- `getToolsFromServers(['shell', 'playwright'])` - фільтр по серверам

### 3. **Tetyana Planning** - LLM обирає інструменти
- Отримує список tools через промпт
- Видає JSON з tool_calls
- Реальний інтелект - вибір інструментів

### 4. **Tetyana Execution** - MCP Manager виконує
- Проходить через tool_calls
- Викликає `executeTool()` для кожного
- Зберігає результати

### 5. **Grisha Planning** - LLM планує верифікацію
- Видає інші tool_calls для перевірки
- ЗАВЖДИ включає screenshot
- Обирає мінімальний набір

### 6. **Grisha Execution** - MCP Manager виконує верифікацію
- Ті ж вибути tool_calls
- Отримує РЕАЛЬНІ дані (скріншот, вміст файлу)
- Повертає верифікаційні результати

### 7. **Grisha Analysis** - LLM аналізує РЕАЛЬНІ дані
- Отримує верифікаційні результати
- КРИТИЧНО: Читає вміст скріншота!
- Видає true/false з причиною

---

## ⚠️ Критичні моменти

1. **Tools передаються як текст** в промптах (через {{AVAILABLE_TOOLS}})
2. **LLM обирає інструменти** - це основний інтелект системи
3. **Execution результати РЕАЛЬНІ** - це не фіктивні дані
4. **Grisha аналізує скріншот вміст** - не просто факт виконання
5. **Graceful fallback НЕДОСТАТНЬО** - треба ПЕРЕВІРЯТИ дані! (це то ми щойно виправили!)

---

## 📈 Метрики

| Параметр | Значення |
|----------|----------|
| MCP Servers | 6 |
| Total Tools | 92+ |
| Planning Tools | 2-3 servers (30-40 tools) |
| Verification Tools | 2-3 servers (30-40 tools) |
| Execution Tools | Кошик від LLM обрання |
| API Calls | 6 (план + виконання + верифікація план + виконання + аналіз) |
| Overhead | ~5-10 сек на item |

---

**Дата:** 16 жовтня 2025
**Статус:** Система ВИПРАВЛЕНА та готова до тестування!
