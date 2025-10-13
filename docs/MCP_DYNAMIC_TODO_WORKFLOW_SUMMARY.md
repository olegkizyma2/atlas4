# 🚀 MCP Dynamic TODO Workflow - Quick Summary

**Створено:** 13 жовтня 2025 - Вечір  
**Статус:** ⏳ IN DESIGN (архітектура готова, імплементація потрібна)

---

## 🎯 КОНЦЕПЦІЯ В ОДНОМУ РЕЧЕННІ

**MCP-First режим** де Atlas створює динамічний TODO list, Тетяна виконує пункт за пунктом через MCP tools, Гриша перевіряє кожен пункт окремо, а Atlas коригує план при проблемах - все з синхронізацією коротких TTS фраз.

---

## 🆚 ПОРІВНЯННЯ: Goose Mode vs MCP Dynamic TODO

| Аспект | Goose Mode (поточний) | MCP Dynamic TODO (новий) |
|--------|----------------------|--------------------------|
| **Workflow** | Stage 1 → 2 → 7 → 8 (all-or-nothing) | TODO loop: Plan → Execute → Verify (per item) |
| **Швидкість** | ⚠️ Повільно (WebSocket) | ✅ Швидко (direct MCP) |
| **Адаптивність** | ❌ Статичний план | ✅ Dynamic TODO adjustment |
| **Прозорість** | ❌ Black box | ✅ Видно кожен пункт |
| **Recovery** | ❌ Restart з початку | ✅ Retry тільки failed item |
| **TTS** | ⚠️ Довгі фрази | ✅ Короткі статуси (100ms-3s) |
| **Debugging** | ❌ Важко знайти помилку | ✅ Точний пункт failing |

---

## 🔄 WORKFLOW ВІЗУАЛІЗАЦІЯ

```
User: "Знайди інфо про Tesla, створи звіт, збережи на Desktop"
    ↓
┌──────────────────────────────────────────────────┐
│ Stage 0.5: Backend Selection → "mcp"             │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ Stage 1-MCP: Atlas TODO Planning                 │
│ TODO:                                            │
│  1. Відкрити браузер tesla.com                   │
│  2. Зібрати інфо Model S                         │
│  3. Форматувати в текст                          │
│  4. Створити файл на Desktop                     │
│  5. Перевірити файл                              │
│ TTS: "План з 5 пунктів" (2s)                     │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ TODO ITEM #1 LOOP                                │
│                                                  │
│ Stage 2.1: Tetyana Plan → "playwright"           │
│   TTS: "Відкриваю браузер" (150ms)               │
│                                                  │
│ Stage 2.2: Tetyana Execute → MCP call            │
│   TTS: "✅ Відкрито" (100ms)                     │
│                                                  │
│ Stage 2.3: Grisha Verify → screenshot check      │
│   TTS: "✅ OK" (100ms)                           │
│                                                  │
│ ✅ Success → Next item                           │
└──────────────────────────────────────────────────┘
    ↓
(Повторити для items 2-5)
    ↓
┌──────────────────────────────────────────────────┐
│ Stage 8-MCP: Final Summary                       │
│ TTS: "Завдання виконано на 100%" (2.5s)         │
└──────────────────────────────────────────────────┘
```

---

## 📋 7 НОВИХ STAGES

1. **Stage 0.5: Backend Selection**
   - Routing: goose vs mcp
   - Keywords: 'створи файл' → mcp, 'проаналізуй' → goose

2. **Stage 1-MCP: Atlas TODO Planning**
   - LLM: port 4000 (НЕ Goose)
   - Output: TodoList (standard 1-3 / extended 4-10 пунктів)
   - TTS: "План з N пунктів" (2s)

3. **Stage 2.1-MCP: Tetyana Plan Tools**
   - Input: TODO item + available MCP tools
   - Output: які tools викликати
   - TTS: "Відкриваю..." (150ms)

4. **Stage 2.2-MCP: Tetyana Execute Tools**
   - Executor: MCP Manager (direct calls)
   - Output: tool results
   - TTS: "✅ Виконано" (100ms)

5. **Stage 2.3-MCP: Grisha Verify Item**
   - Input: item + execution results
   - Output: verified true/false
   - TTS: "✅ OK" / "❌ Fail" (100ms)

6. **Stage 3-MCP: Atlas Adjust TODO**
   - Trigger: verified = false
   - Output: updated TODO item
   - Actions: retry / modify / split / skip
   - TTS: "Коригую..." (1s)

7. **Stage 8-MCP: Final Summary**
   - Input: all completed items
   - Output: summary + success rate
   - TTS: "Завдання виконано на X%" (2.5s)

---

## 🎛️ TTS SYNCHRONIZATION (3 рівні)

### **Quick (100-200ms)**
- "✅ Виконано"
- "❌ Помилка"
- "Перевіряю..."

### **Normal (500-1000ms)**
- "Файл створено на Desktop"
- "Дані зібрано успішно"
- "Браузер відкрито"

### **Detailed (2000-3000ms)**
- "План створено, 5 пунктів, починаю виконання"
- "Завдання виконано на 80%"
- "Всі пункти виконано, звіт готовий"

---

## 📦 НОВІ КОМПОНЕНТИ

### **Створити:**

1. **`orchestrator/workflow/mcp-todo-manager.js`**
   - createTodo(request)
   - executeTodo(todo)
   - executeItemWithRetry(item)
   - planTools(item)
   - executeTools(plan)
   - verifyItem(item)
   - adjustTodoItem(item)

2. **`orchestrator/workflow/tts-sync-manager.js`**
   - speak(phrase, options)
   - processQueue()
   - setCurrentStage(stage)
   - waitForStageCompletion()

3. **Stage Processors:**
   - `stages/backend-selection-processor.js`
   - `stages/atlas-todo-planning-processor.js`
   - `stages/tetyana-plan-tools-processor.js`
   - `stages/tetyana-execute-tools-processor.js`
   - `stages/grisha-verify-item-processor.js`
   - `stages/atlas-adjust-todo-processor.js`
   - `stages/mcp-final-summary-processor.js`

4. **LLM Prompts:**
   - `prompts/atlas/atlas_todo_planning.js`
   - `prompts/tetyana/tetyana_plan_tools.js`
   - `prompts/grisha/grisha_verify_item.js`
   - `prompts/atlas/atlas_adjust_todo.js`
   - `prompts/system/mcp_final_summary.js`

---

## 💾 DATA STRUCTURES

### **TodoItem:**
```typescript
{
  id: number,
  action: string,
  tools_needed: string[],
  mcp_servers: string[],
  success_criteria: string,
  fallback_options: string[],
  dependencies: number[],
  attempt: number,
  max_attempts: number,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  execution_results?: {...},
  verification?: {...},
  tts: {
    start: string,
    success: string,
    failure: string,
    verify: string
  }
}
```

### **TodoList:**
```typescript
{
  id: string,
  request: string,
  mode: 'standard' | 'extended',
  complexity: 1-10,
  items: TodoItem[],
  execution: {
    current_item_index: number,
    completed_items: number,
    failed_items: number,
    total_attempts: number
  },
  results?: {...}
}
```

---

## ✅ КРИТИЧНІ ПРАВИЛА

1. ✅ **TODO items ПОСЛІДОВНІ** - не паралельні
2. ✅ **1 item = 1 дія** - не змішувати
3. ✅ **Dependencies обов'язкові**
4. ✅ **Success criteria чіткі**
5. ✅ **TTS max 5-7 слів** (quick mode)
6. ✅ **Retry max 3 спроби**
7. ✅ **Atlas коригує при failing**
8. ✅ **Grisha перевіряє item** (не все завдання)
9. ✅ **TTS синхронізована** з stage
10. ✅ **Fallback options В TODO**

---

## 📊 IMPLEMENTATION ROADMAP

### **Phase 1: Infrastructure (2-3 дні)**
- [ ] MCPTodoManager class
- [ ] TTSSyncManager class
- [ ] TodoItem/TodoList structures
- [ ] Stage definitions

### **Phase 2: LLM Prompts (1-2 дні)**
- [ ] 5 нових промптів
- [ ] Testing prompt quality

### **Phase 3: Stage Processors (2-3 дні)**
- [ ] 7 нових processors
- [ ] Integration з executor

### **Phase 4: Integration (1-2 дні)**
- [ ] Routing logic
- [ ] TTS sync integration
- [ ] Testing workflow

### **Phase 5: Testing (2-3 дні)**
- [ ] Unit tests
- [ ] E2E tests
- [ ] Performance benchmarks

**Total:** 8-13 днів

---

## 🎯 ПРИКЛАДИ

### **Standard TODO:**
```
Request: "Створи файл hello.txt на Desktop"

TODO:
1. Створити файл → filesystem
2. Перевірити існування → filesystem

Flow:
Atlas → TODO (2 пункти) → TTS: "План з 2 пунктів"
Item #1 → Tetyana create → Grisha verify → TTS: "✅ Файл створено"
Item #2 → Tetyana check → Grisha verify → TTS: "✅ Підтверджено"
Summary → TTS: "Завдання виконано на 100%"
```

### **Extended TODO:**
```
Request: "Знайди ціни Ford Mustang на auto.ria, створи Excel, збережи"

TODO:
1. Відкрити auto.ria → playwright
2. Знайти Mustang → playwright
3. Зібрати ціни → playwright
4. Форматувати таблицю → system
5. Створити Excel → filesystem
6. Перевірити файл → filesystem

Flow: 6 iterations (Plan → Execute → Verify per item)
TTS: короткі фрази кожен крок
```

---

## 📚 ДОКУМЕНТАЦІЯ

- **Повний план:** `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md`
- **AI Backend:** `docs/AI_BACKEND_MODULAR_SYSTEM.md`
- **Config:** `config/global-config.js` → AI_BACKEND_CONFIG
- **Instructions:** `.github/copilot-instructions.md`

---

**ЦЕ РОБИТЬ MCP MODE ШВИДКИМ, АДАПТИВНИМ ТА ПРОЗОРИМ! 🚀**

**Наступний крок:** Почати Phase 1 - Infrastructure (MCPTodoManager + TTSSyncManager)
