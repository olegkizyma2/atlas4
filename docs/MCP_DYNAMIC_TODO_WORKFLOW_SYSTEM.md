# 🎯 MCP Dynamic TODO Workflow System - Архітектурний план

**Дата:** 13 жовтня 2025 - Вечір  
**Автор:** Atlas System  
**Версія:** 1.0.0

---

## 🎯 КОНЦЕПЦІЯ

**MCP-First Workflow** з динамічним TODO управлінням:
- ✅ **Atlas** створює TODO (стандартне або розширене)
- ✅ **Тетяна** виконує пункт за пунктом з MCP tools
- ✅ **Гриша** перевіряє кожен пункт окремо
- ✅ **Синхронізація TTS** - короткі фрази для швидкого темпу
- ✅ **Динамічна адаптація** - Atlas коригує TODO при проблемах

---

## 📊 АРХІТЕКТУРА MCP MODE

### **Поточна (Goose Mode):**
```
User Request
    ↓
Stage 0: Mode Selection → "task"
    ↓
Stage 1: Atlas → Full task analysis (Goose)
    ↓
Stage 2: Tetyana → Full execution (Goose + MCP extensions)
    ↓
Stage 7: Grisha → Full verification (Goose + MCP extensions)
    ↓
Stage 8: Completion
```

### **Нова (MCP Dynamic TODO Mode):**
```
User Request
    ↓
Stage 0: Mode Selection → "task"
    ↓
Stage 0.5: Backend Selection → "mcp" (new)
    ↓
Stage 1: Atlas → TODO Planning (port 4000 LLM)
    ├─ Аналіз складності
    ├─ Вибір режиму: standard | extended
    └─ Створення динамічного TODO list
    ↓
┌─────────────────────────────────────────┐
│  TODO EXECUTION LOOP (per item)         │
│                                         │
│  Stage 2.1: Tetyana Plan Tools          │
│    ├─ Аналіз TODO пункту                │
│    ├─ Підбір MCP tools                  │
│    └─ Execution plan                    │
│    ↓                                    │
│  Stage 2.2: Tetyana Execute             │
│    ├─ MCP tool execution                │
│    ├─ Результат збереження              │
│    └─ TTS: короткий status              │
│    ↓                                    │
│  Stage 2.3: Grisha Verify Item          │
│    ├─ Перевірка ТІЛЬКИ цього пункту     │
│    ├─ MCP tools для validation          │
│    └─ TTS: ✅ OK / ❌ Fail              │
│    ↓                                    │
│  ┌─ Success? ─┐                         │
│  │   Yes  │ No│                         │
│  │    ↓   │  ↓│                         │
│  │  Next  │ Stage 3: Atlas Adjust TODO  │
│  │  Item  │  └─ Корекція пункту         │
│  └────────┴────┘                        │
└─────────────────────────────────────────┘
    ↓
Stage 8: Final Summary (port 4000 LLM)
    ├─ Всі пункти виконано
    ├─ Загальний результат
    └─ TTS: фінальний report
```

---

## 🆕 НОВІ STAGE DEFINITIONS

### **Stage 0.5: Backend Selection (NEW)**
```javascript
{
  stage: 0.5,
  name: 'backend_selection',
  agent: 'system',
  description: 'Вибір AI backend на основі request',
  
  conditions: {
    enter: 'stage === 0 && mode === "task"',
    
    routing: {
      // Якщо простий запит → Goose (як зараз)
      goose: [
        'без файлів', 'аналіз', 'пояснення', 
        'короткий запит', 'одна дія'
      ],
      
      // Якщо складний запит → MCP Dynamic TODO
      mcp: [
        'створи', 'збережи', 'automation',
        'багато кроків', 'файли', 'браузер',
        'декілька дій', 'workflow'
      ]
    }
  },
  
  output: {
    backend: 'goose' | 'mcp',
    reasoning: 'чому обрано цей backend'
  }
}
```

### **Stage 1-MCP: Atlas TODO Planning (NEW)**
```javascript
{
  stage: 1,
  variant: 'mcp',
  name: 'atlas_todo_planning',
  agent: 'atlas',
  llm: 'port_4000',  // НЕ Goose
  
  systemPrompt: `
Ти - Atlas, стратег та координатор.

ЗАВДАННЯ:
Проаналізуй запит користувача та створи динамічний TODO list.

РІВНІ СКЛАДНОСТІ:
1. STANDARD TODO (1-3 пункти, прості операції)
   - Приклад: "Створи файл test.txt на Desktop"
   - TODO: [створити файл, перевірити існування]

2. EXTENDED TODO (4-10 пунктів, складний workflow)
   - Приклад: "Знайди інфо про Tesla, створи звіт, збережи на Desktop"
   - TODO: [
       web scrape tesla.com,
       extract key info,
       format as report,
       save to file,
       verify file exists
     ]

DYNAMIC TODO RULES:
- Кожен пункт = 1 конкретна дія
- Пункти послідовні (не паралельні)
- Кожен пункт має чіткий критерій успіху
- Можливість корекції при failing

ФОРМАТ ВІДПОВІДІ:
{
  "mode": "standard" | "extended",
  "complexity": 1-10,
  "todo": [
    {
      "id": 1,
      "action": "Опис дії",
      "tools_needed": ["filesystem", "playwright"],
      "success_criteria": "Чіткий критерій",
      "fallback_options": ["альтернативний підхід"]
    }
  ],
  "tts_phrase": "Короткий статус для озвучки"
}
`,
  
  output: {
    mode: 'standard' | 'extended',
    todo: Array<TodoItem>,
    tts_phrase: string
  }
}
```

### **Stage 2.1-MCP: Tetyana Plan Tools (NEW)**
```javascript
{
  stage: 2.1,
  variant: 'mcp',
  name: 'tetyana_plan_tools',
  agent: 'tetyana',
  llm: 'port_4000',
  
  input: {
    currentTodoItem: TodoItem,
    availableMCPTools: Array<MCPTool>,
    previousResults: Array<Result>
  },
  
  systemPrompt: `
Ти - Тетяна, виконавець.

ПОТОЧНИЙ TODO ПУНКТ:
{{currentTodoItem}}

ДОСТУПНІ MCP TOOLS:
{{availableMCPTools}}

ЗАВДАННЯ:
Визнач які MCP tools потрібні для виконання ЦЕ конкретного пункту.

ФОРМАТ ВІДПОВІДІ:
{
  "tools": [
    {
      "name": "filesystem__createFile",
      "parameters": { "path": "...", "content": "..." },
      "reasoning": "чому цей tool"
    }
  ],
  "execution_plan": "Опис як виконати",
  "tts_phrase": "Починаю створення файлу"
}
`,
  
  output: {
    tools: Array<ToolCall>,
    execution_plan: string,
    tts_phrase: string
  }
}
```

### **Stage 2.2-MCP: Tetyana Execute Tools (NEW)**
```javascript
{
  stage: 2.2,
  variant: 'mcp',
  name: 'tetyana_execute_tools',
  agent: 'tetyana',
  executor: 'mcp_manager',  // Direct MCP execution
  
  input: {
    toolCalls: Array<ToolCall>,
    todoItem: TodoItem
  },
  
  process: async (input) => {
    const results = [];
    
    for (const toolCall of input.toolCalls) {
      // Виконати через MCP Manager
      const result = await mcpManager.executeTool(
        toolCall.name,
        toolCall.parameters
      );
      
      results.push(result);
      
      // TTS після кожного tool (короткий статус)
      await ttsManager.speak(`✅ ${toolCall.name} виконано`, {
        priority: 'high',
        mode: 'quick'
      });
    }
    
    return results;
  },
  
  output: {
    results: Array<ToolResult>,
    success: boolean,
    tts_phrase: "Пункт виконано" | "Помилка при виконанні"
  }
}
```

### **Stage 2.3-MCP: Grisha Verify Item (NEW)**
```javascript
{
  stage: 2.3,
  variant: 'mcp',
  name: 'grisha_verify_item',
  agent: 'grisha',
  llm: 'port_4000',
  
  input: {
    todoItem: TodoItem,
    executionResults: Array<ToolResult>,
    successCriteria: string
  },
  
  systemPrompt: `
Ти - Гриша, верифікатор.

TODO ПУНКТ:
{{todoItem}}

РЕЗУЛЬТАТИ ВИКОНАННЯ:
{{executionResults}}

КРИТЕРІЙ УСПІХУ:
{{successCriteria}}

ЗАВДАННЯ:
Перевір ТІЛЬКИ ЦЕЙ ПУНКТ (не все завдання).

ДОСТУПНІ MCP TOOLS ДЛЯ ПЕРЕВІРКИ:
- filesystem__readFile - прочитати файл
- playwright__screenshot - скріншот браузера
- computercontroller - перевірити desktop

ФОРМАТ ВІДПОВІДІ:
{
  "verified": true | false,
  "issues": ["список проблем якщо є"],
  "evidence": "Докази перевірки (що побачив)",
  "suggestion": "Як виправити якщо failed",
  "tts_phrase": "✅ Файл створено" | "❌ Файл не знайдено"
}
`,
  
  output: {
    verified: boolean,
    issues: Array<string>,
    evidence: string,
    suggestion: string,
    tts_phrase: string
  }
}
```

### **Stage 3-MCP: Atlas Adjust TODO (NEW)**
```javascript
{
  stage: 3,
  variant: 'mcp',
  name: 'atlas_adjust_todo',
  agent: 'atlas',
  llm: 'port_4000',
  
  trigger: 'stage 2.3 → verified = false',
  
  input: {
    originalTodoItem: TodoItem,
    failureReason: string,
    grishaSuggestion: string,
    attemptNumber: number
  },
  
  systemPrompt: `
Ти - Atlas, адаптивний стратег.

ПРОБЛЕМА:
TODO пункт "{{originalTodoItem}}" НЕ виконано.

ПРИЧИНА ПАДІННЯ:
{{failureReason}}

ПРОПОЗИЦІЯ ГРИШІ:
{{grishaSuggestion}}

СПРОБА: {{attemptNumber}} / 3

ЗАВДАННЯ:
Скоригуй цей пункт TODO або запропонуй альтернативний підхід.

ВАРІАНТИ:
1. Змінити параметри tools
2. Використати інші MCP tools
3. Розбити на під-пункти
4. Skip якщо неможливо (після 3 спроб)

ФОРМАТ ВІДПОВІДІ:
{
  "action": "retry" | "modify" | "split" | "skip",
  "updated_todo_item": TodoItem,
  "reasoning": "Чому цей підхід",
  "tts_phrase": "Коригую підхід..."
}
`,
  
  output: {
    action: 'retry' | 'modify' | 'split' | 'skip',
    updated_todo_item: TodoItem | null,
    reasoning: string,
    tts_phrase: string
  }
}
```

### **Stage 8-MCP: Final Summary (NEW)**
```javascript
{
  stage: 8,
  variant: 'mcp',
  name: 'mcp_final_summary',
  agent: 'system',
  llm: 'port_4000',
  
  input: {
    originalRequest: string,
    todoList: Array<TodoItem>,
    completedItems: Array<CompletedItem>,
    failedItems: Array<FailedItem>
  },
  
  systemPrompt: `
Згенеруй фінальний звіт про виконання завдання.

ОРИГІНАЛЬНИЙ ЗАПИТ:
{{originalRequest}}

ПЛАН (TODO):
{{todoList}}

ВИКОНАНО:
{{completedItems}}

НЕ ВИКОНАНО:
{{failedItems}}

ФОРМАТ:
{
  "summary": "Короткий підсумок",
  "success_rate": "8/10 пунктів",
  "key_results": ["що зроблено"],
  "issues": ["що не вдалося"],
  "tts_phrase": "Завдання виконано на 80%"
}
`,
  
  output: {
    summary: string,
    success_rate: string,
    key_results: Array<string>,
    issues: Array<string>,
    tts_phrase: string
  }
}
```

---

## 🔄 WORKFLOW EXECUTION FLOW

### **Example: "Знайди інфо про Tesla Model S та створи звіт на Desktop"**

```
┌─────────────────────────────────────────────────────────┐
│ Stage 0: Mode Selection → "task"                        │
│ Stage 0.5: Backend Selection → "mcp" (складне завдання) │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 1-MCP: Atlas TODO Planning                        │
│                                                         │
│ TODO List (Extended Mode):                             │
│ 1. [playwright] Відкрити tesla.com/models              │
│ 2. [playwright] Зібрати інфо про Model S               │
│ 3. [system] Форматувати дані в текст                   │
│ 4. [filesystem] Створити звіт tesla_report.txt         │
│ 5. [filesystem] Перевірити файл на Desktop             │
│                                                         │
│ TTS: "План створено, 5 пунктів, починаю виконання"     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ TODO ITEM #1: Відкрити tesla.com/models                │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.1: Tetyana Plan Tools                           │
│ → tools: [playwright__browser_open]                     │
│ → TTS: "Відкриваю браузер"                              │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.2: Tetyana Execute                              │
│ → MCP: playwright__browser_open(url="tesla.com")        │
│ → Result: ✅ Browser opened                             │
│ → TTS: "✅ Браузер відкрито"                            │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.3: Grisha Verify                                │
│ → MCP: playwright__screenshot()                         │
│ → Check: Screenshot показує tesla.com                   │
│ → Result: ✅ Verified                                   │
│ → TTS: "✅ Підтверджено"                                │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ TODO ITEM #2: Зібрати інфо про Model S                  │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.1: Tetyana Plan Tools                           │
│ → tools: [playwright__extract_text, playwright__click]  │
│ → TTS: "Збираю дані"                                    │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.2: Tetyana Execute                              │
│ → MCP: playwright__click(selector="Model S")            │
│ → MCP: playwright__extract_text(selector=".specs")      │
│ → Result: ✅ Data extracted                             │
│ → TTS: "✅ Дані зібрано"                                │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 2.3: Grisha Verify                                │
│ → Check: extractedText містить "Model S", "specs"       │
│ → Result: ✅ Verified                                   │
│ → TTS: "✅ Дані валідні"                                │
└─────────────────────────────────────────────────────────┘
    ↓
... (пункти 3, 4, 5 аналогічно) ...
    ↓
┌─────────────────────────────────────────────────────────┐
│ Stage 8-MCP: Final Summary                              │
│                                                         │
│ Summary: "Створено звіт про Tesla Model S на Desktop"  │
│ Success: 5/5 пунктів                                   │
│ TTS: "Завдання виконано повністю"                       │
└─────────────────────────────────────────────────────────┘
```

### **Example with Failure & Adjustment:**

```
TODO ITEM #4: Створити файл tesla_report.txt
    ↓
Stage 2.2: Tetyana Execute
→ MCP: filesystem__createFile("/Desktop/tesla_report.txt")
→ Result: ❌ Error: Permission denied
→ TTS: "❌ Помилка доступу"
    ↓
Stage 2.3: Grisha Verify
→ Result: ❌ Not verified
→ Suggestion: "Спробувати ~/Desktop замість /Desktop"
→ TTS: "❌ Файл не створено"
    ↓
Stage 3-MCP: Atlas Adjust TODO
→ Action: "modify"
→ Updated path: "~/Desktop/tesla_report.txt"
→ TTS: "Коригую шлях..."
    ↓
Stage 2.1: Tetyana Plan Tools (RETRY)
→ tools: [filesystem__createFile] з новим path
→ TTS: "Повторна спроба"
    ↓
Stage 2.2: Tetyana Execute (RETRY)
→ MCP: filesystem__createFile("~/Desktop/tesla_report.txt")
→ Result: ✅ File created
→ TTS: "✅ Файл створено"
    ↓
Stage 2.3: Grisha Verify
→ MCP: filesystem__readFile("~/Desktop/tesla_report.txt")
→ Result: ✅ Verified
→ TTS: "✅ Файл існує"
```

---

## 🎛️ TTS SYNCHRONIZATION STRATEGY

### **Проблема:**
MCP workflow швидший за Goose → TTS фрази мають бути короткими для утримання темпу.

### **Рішення: 3-рівнева TTS система**

#### **1. Quick Status (100-200ms TTS)**
```javascript
// Після кожного tool execution
tts.speak("✅ Виконано", { 
  mode: 'quick',
  priority: 'high',
  maxDuration: 200  // ms
});

// Приклади:
"Відкриваю..."      // ~150ms
"✅ Готово"         // ~100ms
"❌ Помилка"        // ~100ms
"Перевіряю..."     // ~150ms
```

#### **2. Item Status (500-1000ms TTS)**
```javascript
// Після завершення TODO пункту
tts.speak("Файл створено на Desktop", {
  mode: 'normal',
  priority: 'medium',
  maxDuration: 1000
});

// Приклади:
"Браузер відкрито"           // ~800ms
"Дані зібрано успішно"       // ~900ms
"Файл створено на Desktop"   // ~1000ms
```

#### **3. Stage Summary (2000-3000ms TTS)**
```javascript
// Після завершення всього TODO або stage
tts.speak("План створено, 5 пунктів, починаю виконання", {
  mode: 'detailed',
  priority: 'low',
  maxDuration: 3000
});

// Приклади:
"План створено, 5 пунктів"              // ~2000ms
"Завдання виконано на 80%"              // ~2500ms
"Всі пункти виконано, звіт готовий"    // ~3000ms
```

### **TTS Queue Management:**

```javascript
class TTSSyncManager {
  constructor() {
    this.queue = [];
    this.currentStage = null;
    this.isExecuting = false;
  }

  /**
   * Додати TTS фразу з синхронізацією
   */
  async speak(phrase, options = {}) {
    const ttsItem = {
      phrase,
      mode: options.mode || 'normal',
      priority: options.priority || 'medium',
      maxDuration: options.maxDuration || 1000,
      stage: this.currentStage
    };

    // Quick phrases - пропустити якщо вже є в черзі
    if (options.mode === 'quick' && this.queue.length > 2) {
      logger.debug('TTS', 'Skipping quick phrase (queue full)');
      return;
    }

    // Додати в чергу
    this.queue.push(ttsItem);

    // Запустити обробку
    if (!this.isExecuting) {
      await this.processQueue();
    }
  }

  /**
   * Обробити чергу TTS
   */
  async processQueue() {
    this.isExecuting = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      // Чекати поки попередній stage завершиться
      if (item.stage !== this.currentStage) {
        await this.waitForStageCompletion();
      }

      // Озвучити
      await ttsService.speak(item.phrase, {
        timeout: item.maxDuration
      });

      // Короткі паузи між фразами
      if (item.mode === 'quick') {
        await sleep(50);  // 50ms pause
      } else if (item.mode === 'normal') {
        await sleep(200); // 200ms pause
      }
    }

    this.isExecuting = false;
  }

  /**
   * Чекати завершення stage перед наступною TTS
   */
  async waitForStageCompletion() {
    // Якщо stage змінився - дочекатись завершення виконання
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!stageProcessor.isExecuting) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Встановити поточний stage
   */
  setCurrentStage(stage) {
    this.currentStage = stage;
  }
}
```

---

## 📋 TODO DATA STRUCTURE

### **TodoItem Interface:**

```typescript
interface TodoItem {
  id: number;
  action: string;                    // "Створити файл на Desktop"
  tools_needed: string[];            // ["filesystem"]
  mcp_servers: string[];             // ["filesystem"]
  parameters: Record<string, any>;   // Попередньо заповнені параметри
  success_criteria: string;          // "Файл існує на Desktop"
  fallback_options: string[];        // ["Спробувати ~/Desktop", "Створити в /tmp"]
  dependencies: number[];            // [1, 2] - залежить від пунктів 1 і 2
  attempt: number;                   // Номер спроби (1-3)
  max_attempts: number;              // 3
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  // Execution results
  execution_results?: {
    tool_calls: ToolCall[];
    results: ToolResult[];
    started_at: Date;
    completed_at: Date;
    duration_ms: number;
  };
  
  // Verification results
  verification?: {
    verified: boolean;
    issues: string[];
    evidence: string;
    verified_at: Date;
  };
  
  // TTS phrases
  tts: {
    start: string;      // "Відкриваю браузер"
    success: string;    // "✅ Браузер відкрито"
    failure: string;    // "❌ Помилка відкриття"
    verify: string;     // "Перевіряю..."
  };
}
```

### **TodoList Interface:**

```typescript
interface TodoList {
  id: string;                        // UUID
  request: string;                   // Original user request
  mode: 'standard' | 'extended';
  complexity: number;                // 1-10
  items: TodoItem[];
  
  // Metadata
  created_at: Date;
  created_by: 'atlas';
  version: number;                   // Кількість коригувань
  
  // Execution tracking
  execution: {
    started_at?: Date;
    completed_at?: Date;
    current_item_index: number;
    completed_items: number;
    failed_items: number;
    skipped_items: number;
    total_attempts: number;
  };
  
  // Results
  results?: {
    summary: string;
    success_rate: string;            // "8/10"
    key_results: string[];
    issues: string[];
    total_duration_ms: number;
  };
}
```

---

## 🔧 IMPLEMENTATION COMPONENTS

### **1. MCPTodoManager (NEW)**
```javascript
// orchestrator/workflow/mcp-todo-manager.js

class MCPTodoManager {
  constructor(mcpManager, llmClient, ttsManager) {
    this.mcpManager = mcpManager;
    this.llm = llmClient;
    this.tts = ttsManager;
    this.currentTodo = null;
  }

  /**
   * Створити TODO через Atlas
   */
  async createTodo(request, context) {
    // Stage 1-MCP: Atlas TODO Planning
    const response = await this.llm.generate({
      systemPrompt: ATLAS_TODO_PLANNING_PROMPT,
      userPrompt: request,
      context
    });

    const todoData = JSON.parse(response);
    
    this.currentTodo = {
      id: uuid(),
      request,
      ...todoData,
      execution: {
        current_item_index: 0,
        completed_items: 0,
        failed_items: 0,
        skipped_items: 0,
        total_attempts: 0
      }
    };

    // TTS: короткий статус
    await this.tts.speak(todoData.tts_phrase, { mode: 'detailed' });

    return this.currentTodo;
  }

  /**
   * Виконати TODO list (item by item)
   */
  async executeTodo(todo) {
    for (let i = 0; i < todo.items.length; i++) {
      const item = todo.items[i];
      
      // Перевірити dependencies
      if (!this.checkDependencies(item, todo)) {
        item.status = 'skipped';
        await this.tts.speak(`⏭️ Пропущено пункт ${i + 1}`, { mode: 'quick' });
        continue;
      }

      // Виконати пункт (з retry loop)
      const success = await this.executeItemWithRetry(item, todo);

      if (success) {
        todo.execution.completed_items++;
        item.status = 'completed';
      } else {
        todo.execution.failed_items++;
        item.status = 'failed';
      }

      todo.execution.current_item_index = i + 1;
    }

    // Фінальний summary
    return await this.generateSummary(todo);
  }

  /**
   * Виконати один TODO item з retry
   */
  async executeItemWithRetry(item, todo) {
    for (let attempt = 1; attempt <= item.max_attempts; attempt++) {
      item.attempt = attempt;
      item.status = 'in_progress';

      // Stage 2.1: Tetyana Plan Tools
      const plan = await this.planTools(item);
      await this.tts.speak(plan.tts_phrase, { mode: 'quick' });

      // Stage 2.2: Tetyana Execute Tools
      const execution = await this.executeTools(plan, item);
      await this.tts.speak(execution.tts_phrase, { mode: 'normal' });

      // Stage 2.3: Grisha Verify
      const verification = await this.verifyItem(item, execution);
      await this.tts.speak(verification.tts_phrase, { mode: 'normal' });

      if (verification.verified) {
        return true; // Success!
      }

      // Якщо failed і є спроби - Stage 3: Atlas Adjust
      if (attempt < item.max_attempts) {
        const adjustment = await this.adjustTodoItem(item, verification, attempt);
        await this.tts.speak(adjustment.tts_phrase, { mode: 'normal' });

        // Оновити item на основі adjustment
        if (adjustment.action === 'modify') {
          Object.assign(item, adjustment.updated_todo_item);
        } else if (adjustment.action === 'skip') {
          return false; // Skip this item
        }
      }

      todo.execution.total_attempts++;
    }

    return false; // Failed after all attempts
  }

  /**
   * Stage 2.1: Plan tools для item
   */
  async planTools(item) {
    const availableTools = this.mcpManager.getAvailableTools();

    const response = await this.llm.generate({
      systemPrompt: TETYANA_PLAN_TOOLS_PROMPT,
      userPrompt: JSON.stringify({
        currentTodoItem: item,
        availableMCPTools: availableTools
      })
    });

    return JSON.parse(response);
  }

  /**
   * Stage 2.2: Execute tools
   */
  async executeTools(plan, item) {
    const startTime = Date.now();
    const results = [];

    for (const toolCall of plan.tools) {
      try {
        const result = await this.mcpManager.executeTool(
          toolCall.name,
          toolCall.parameters
        );

        results.push({ tool: toolCall.name, success: true, result });
        
        // Quick TTS після кожного tool
        await this.tts.speak(`✅ ${toolCall.name}`, { mode: 'quick' });

      } catch (error) {
        results.push({ tool: toolCall.name, success: false, error: error.message });
        await this.tts.speak(`❌ Помилка`, { mode: 'quick' });
      }
    }

    const duration = Date.now() - startTime;

    item.execution_results = {
      tool_calls: plan.tools,
      results,
      started_at: new Date(startTime),
      completed_at: new Date(),
      duration_ms: duration
    };

    const allSuccess = results.every(r => r.success);
    
    return {
      results,
      success: allSuccess,
      tts_phrase: allSuccess ? item.tts.success : item.tts.failure
    };
  }

  /**
   * Stage 2.3: Verify item
   */
  async verifyItem(item, execution) {
    const response = await this.llm.generate({
      systemPrompt: GRISHA_VERIFY_ITEM_PROMPT,
      userPrompt: JSON.stringify({
        todoItem: item,
        executionResults: execution.results,
        successCriteria: item.success_criteria
      })
    });

    const verification = JSON.parse(response);

    item.verification = {
      ...verification,
      verified_at: new Date()
    };

    return verification;
  }

  /**
   * Stage 3: Atlas adjust TODO item
   */
  async adjustTodoItem(item, verification, attemptNumber) {
    const response = await this.llm.generate({
      systemPrompt: ATLAS_ADJUST_TODO_PROMPT,
      userPrompt: JSON.stringify({
        originalTodoItem: item,
        failureReason: verification.issues.join(', '),
        grishaSuggestion: verification.suggestion,
        attemptNumber
      })
    });

    return JSON.parse(response);
  }

  /**
   * Check dependencies
   */
  checkDependencies(item, todo) {
    if (!item.dependencies || item.dependencies.length === 0) {
      return true;
    }

    for (const depId of item.dependencies) {
      const depItem = todo.items.find(i => i.id === depId);
      if (!depItem || depItem.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate final summary
   */
  async generateSummary(todo) {
    const response = await this.llm.generate({
      systemPrompt: MCP_FINAL_SUMMARY_PROMPT,
      userPrompt: JSON.stringify({
        originalRequest: todo.request,
        todoList: todo.items,
        completedItems: todo.items.filter(i => i.status === 'completed'),
        failedItems: todo.items.filter(i => i.status === 'failed')
      })
    });

    const summary = JSON.parse(response);

    todo.results = {
      ...summary,
      total_duration_ms: todo.items.reduce((sum, item) => 
        sum + (item.execution_results?.duration_ms || 0), 0
      )
    };

    todo.execution.completed_at = new Date();

    // Final TTS
    await this.tts.speak(summary.tts_phrase, { mode: 'detailed' });

    return todo;
  }
}
```

---

## 🎯 INTEGRATION PLAN

### **Phase 1: Infrastructure (2-3 дні)**
- [ ] Створити MCPTodoManager
- [ ] Створити TodoItem/TodoList data structures
- [ ] Створити TTSSyncManager для синхронізації
- [ ] Додати stage definitions для MCP mode

### **Phase 2: LLM Prompts (1-2 дні)**
- [ ] ATLAS_TODO_PLANNING_PROMPT
- [ ] TETYANA_PLAN_TOOLS_PROMPT
- [ ] GRISHA_VERIFY_ITEM_PROMPT
- [ ] ATLAS_ADJUST_TODO_PROMPT
- [ ] MCP_FINAL_SUMMARY_PROMPT

### **Phase 3: Stage Processors (2-3 дні)**
- [ ] Stage 0.5: Backend Selection
- [ ] Stage 1-MCP: Atlas TODO Planning
- [ ] Stage 2.1-MCP: Tetyana Plan Tools
- [ ] Stage 2.2-MCP: Tetyana Execute Tools
- [ ] Stage 2.3-MCP: Grisha Verify Item
- [ ] Stage 3-MCP: Atlas Adjust TODO
- [ ] Stage 8-MCP: Final Summary

### **Phase 4: Integration (1-2 дні)**
- [ ] Інтегрувати в executor-v3.js
- [ ] Routing logic (Goose vs MCP mode)
- [ ] TTS synchronization
- [ ] Testing workflow

### **Phase 5: Testing & Optimization (2-3 дні)**
- [ ] Unit tests для MCPTodoManager
- [ ] E2E tests для full workflow
- [ ] Performance benchmarks
- [ ] TTS timing optimization

**Total:** ~8-13 днів розробки

---

## ✅ ПЕРЕВАГИ MCP DYNAMIC TODO SYSTEM

| Аспект | Goose Mode | MCP Dynamic TODO |
|--------|-----------|------------------|
| **Швидкість** | ⚠️ Повільно (WebSocket) | ✅ Швидко (direct MCP) |
| **Гранулярність** | ❌ Все завдання | ✅ Item-by-item |
| **Адаптивність** | ❌ Статичний план | ✅ Dynamic adjustment |
| **TTS Sync** | ⚠️ Довгі фрази | ✅ Короткі статуси |
| **Debugging** | ❌ Важко знайти помилку | ✅ Точний пункт |
| **Recovery** | ❌ Restart з початку | ✅ Retry тільки failed item |
| **Transparency** | ⚠️ Black box | ✅ Прозорий TODO |
| **User Control** | ❌ Неможливо втрутитись | ✅ Видно прогрес |

---

## 🚀 ПРИКЛАДИ ВИКОРИСТАННЯ

### **Example 1: Простий запит (Standard TODO)**

**Запит:** "Створи файл hello.txt на Desktop з текстом Hello World"

**TODO (Standard):**
```json
{
  "mode": "standard",
  "complexity": 2,
  "items": [
    {
      "id": 1,
      "action": "Створити файл hello.txt на Desktop",
      "tools_needed": ["filesystem"],
      "success_criteria": "Файл існує на ~/Desktop/hello.txt",
      "tts": {
        "start": "Створюю файл",
        "success": "✅ Файл створено",
        "failure": "❌ Помилка створення"
      }
    },
    {
      "id": 2,
      "action": "Перевірити вміст файлу",
      "tools_needed": ["filesystem"],
      "success_criteria": "Файл містить текст 'Hello World'",
      "dependencies": [1],
      "tts": {
        "start": "Перевіряю",
        "success": "✅ Вміст правильний",
        "failure": "❌ Вміст неправильний"
      }
    }
  ]
}
```

**Execution Flow:**
```
1. Atlas створює TODO (2 пункти) → TTS: "План з 2 пунктів"
2. Item #1: Tetyana створює файл → TTS: "✅ Файл створено"
3. Item #1: Grisha перевіряє існування → TTS: "✅ Підтверджено"
4. Item #2: Tetyana перевіряє вміст → TTS: "✅ Вміст правильний"
5. Item #2: Grisha валідує → TTS: "✅ Все OK"
6. Summary → TTS: "Завдання виконано на 100%"
```

### **Example 2: Складний запит (Extended TODO)**

**Запит:** "Знайди інформацію про ціни на Ford Mustang 2024 на auto.ria.com, створи порівняльну таблицю та збережи як Excel файл на Desktop"

**TODO (Extended):**
```json
{
  "mode": "extended",
  "complexity": 8,
  "items": [
    {
      "id": 1,
      "action": "Відкрити auto.ria.com",
      "tools_needed": ["playwright"],
      "tts": { "start": "Відкриваю сайт", "success": "✅ Сайт відкрито" }
    },
    {
      "id": 2,
      "action": "Знайти Ford Mustang 2024",
      "tools_needed": ["playwright"],
      "dependencies": [1],
      "tts": { "start": "Шукаю Mustang", "success": "✅ Знайдено" }
    },
    {
      "id": 3,
      "action": "Зібрати ціни з результатів пошуку",
      "tools_needed": ["playwright"],
      "dependencies": [2],
      "tts": { "start": "Збираю ціни", "success": "✅ Дані зібрано" }
    },
    {
      "id": 4,
      "action": "Форматувати дані в таблицю",
      "tools_needed": ["system"],
      "dependencies": [3],
      "tts": { "start": "Форматую", "success": "✅ Таблиця готова" }
    },
    {
      "id": 5,
      "action": "Створити Excel файл",
      "tools_needed": ["filesystem"],
      "dependencies": [4],
      "tts": { "start": "Створюю Excel", "success": "✅ Файл створено" }
    },
    {
      "id": 6,
      "action": "Перевірити файл на Desktop",
      "tools_needed": ["filesystem"],
      "dependencies": [5],
      "tts": { "start": "Перевіряю", "success": "✅ Файл на місці" }
    }
  ]
}
```

---

## 🎯 КРИТИЧНІ ПРАВИЛА MCP TODO SYSTEM

1. ✅ **TODO items ПОСЛІДОВНІ** - виконуються по черзі (не паралельно)
2. ✅ **Кожен item = 1 конкретна дія** - не змішувати кілька дій
3. ✅ **Dependencies ОБОВ'ЯЗКОВІ** - якщо пункт залежить від іншого
4. ✅ **Success criteria ЧІТКІ** - "Файл існує", НЕ "Файл має бути"
5. ✅ **TTS phrases КОРОТКІ** - max 5-7 слів для quick mode
6. ✅ **Retry max 3 спроби** - потім skip або fail
7. ✅ **Atlas коригує TODO** - тільки при failing, НЕ при success
8. ✅ **Grisha перевіряє ITEM** - не все завдання, тільки поточний пункт
9. ✅ **TTS синхронізована** - чекати завершення stage перед наступною TTS
10. ✅ **Fallback options В TODO** - Atlas має бачити альтернативи

---

**ЦЕ РОБИТЬ MCP MODE ШВИДКИМ, АДАПТИВНИМ ТА ПРОЗОРИМ! 🚀**
