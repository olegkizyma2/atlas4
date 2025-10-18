# Stage 3.5 - Atlas Replan TODO Processor
**Дата:** 2025-10-18  
**Тип:** Рефакторинг + Новий функціонал  
**Статус:** ✅ ЗАВЕРШЕНО

---

## 🎯 Проблема

В попередній реалізації:
- Логіка replan була розкидана між `executor-v3.js` та `atlas-adjust-todo-processor.js`
- `_analyzeAndReplanTodo()` був private методом в adjust processor
- Немає preprocessing контексту перед викликом LLM
- Важко тестувати окремо
- Порушення Single Responsibility Principle (adjust ≠ replan)

---

## ✅ Рішення

Створено **окремий Stage 3.5-MCP Processor** з:
- Власним processor файлом
- Власним спеціалізованим промптом
- Preprocessing логікою
- Чітким розділенням відповідальностей

---

## 📁 Створені/Оновлені файли

### 1. **`atlas-replan-todo-processor.js`** (NEW)

**Розташування:** `orchestrator/workflow/stages/`

**Функціонал:**
- `execute()` - головний метод Stage 3.5
- `_preprocessContext()` - aggregates data from Grisha + Tetyana
- `_analyzeAndReplan()` - викликає LLM з спеціалізованим промптом
- `_buildReplanUserMessage()` - форматує контекст для LLM
- `_parseReplanResponse()` - парсить JSON відповідь
- `_generateReplanSummary()` - генерує summary

**Preprocessed Context:**
```javascript
{
  // Item info
  item_id, item_action, success_criteria, attempts, max_attempts,
  
  // Original request
  original_request,
  
  // Grisha analysis
  root_cause, recommended_strategy, grisha_confidence, grisha_reason,
  visual_evidence: { observed, matches_criteria, details, screenshot_path },
  suggestions: [...],
  
  // Tetyana execution
  execution_summary: { tools_used, all_successful, stopped_at },
  planned_tools: [...],
  
  // TODO context
  completed_items, remaining_items, total_items, completed_count
}
```

**Dependencies:**
- `mcpManager` - для LLM API
- `logger`

---

### 2. **`atlas_replan_todo.js`** (EXISTS)

**Промпт вже існував**, містить:
- Детальні інструкції для Atlas
- 3 стратегії: `replan_and_continue`, `skip_and_continue`, `abort`
- 6 прикладів різних сценаріїв
- JSON output format

**Приклади:**
1. Web search не працює → розширений пошук з фільтрами
2. Screenshot не критичний → skip
3. Сайт недоступний → abort
4. PowerPoint відсутній → Google Slides
5. API endpoint 404 → перевірити docs
6. MCP tools відсутні → альтернативний формат (CSV замість PPTX)

---

### 3. **`executor-v3.js`** (UPDATED)

**Зміни:**

```javascript
// BEFORE:
const replanResult = await adjustProcessor._analyzeAndReplanTodo(
  item, todo, tetyanaData, grishaData
);

// AFTER:
const replanResult = await replanProcessor.execute({
  failedItem: item,
  todo,
  tetyanaData,
  grishaData,
  session,
  res
});
```

**Імпорти:**
```javascript
import { 
  AtlasReplanTodoProcessor  // NEW
} from './stages/index.js';

const replanProcessor = container.resolve('atlasReplanTodoProcessor');
```

---

### 4. **`stages/index.js`** (UPDATED)

```javascript
import { AtlasReplanTodoProcessor } from './atlas-replan-todo-processor.js';

export {
  AtlasReplanTodoProcessor,  // NEW
  // ...
};

export const MCP_PROCESSORS = {
  // ...
  ATLAS_REPLAN_TODO: AtlasReplanTodoProcessor,  // NEW
};
```

---

### 5. **`service-registry.js`** (UPDATED)

```javascript
import { AtlasReplanTodoProcessor } from '../workflow/stages/index.js';

// Atlas Replan TODO Processor (Stage 3.5-MCP) - NEW 18.10.2025
container.singleton('atlasReplanTodoProcessor', (c) => {
  return new AtlasReplanTodoProcessor({
    mcpManager: c.resolve('mcpManager'),
    logger: c.resolve('logger')
  });
}, {
  dependencies: ['mcpManager', 'logger'],
  metadata: { category: 'processors', priority: 40 }
});
```

**Також:** Додано `mcpManager` до `tetyanaExecuteToolsProcessor` для step-by-step execution.

---

### 6. **`prompts/mcp/index.js`** (UPDATED)

```javascript
import atlasReplanTodo from './atlas_replan_todo.js';

export const MCP_PROMPTS = {
  // ...
  ATLAS_REPLAN_TODO: atlasReplanTodo,  // NEW reference
};
```

---

## 🔄 Workflow оновлений

### Stage 3.5-MCP тепер виглядає так:

```
Max Attempts Reached (3 спроби)
  ↓
Grisha: getDetailedAnalysisForAtlas()
  → root_cause, suggestions, recommended_strategy
  ↓
Preprocessing: _preprocessContext()
  → Aggregate Grisha + Tetyana + TODO context
  ↓
replanProcessor.execute()
  → LLM call з atlas_replan_todo.js prompt
  ↓
Parse JSON response
  ↓
Apply replan:
  - replanned=true → Insert new items
  - replanned=false → Skip or Abort
```

---

## 📊 Переваги нового підходу

### 1. **Separation of Concerns**
```
Stage 3 (Adjust)     → retry/modify в межах attempts
Stage 3.5 (Replan)   → ПОВНА перебудова після max attempts
```

### 2. **Preprocessing**
- Один метод `_preprocessContext()` збирає ВСІ дані
- Форматує для LLM
- Легко розширювати

### 3. **Specialized Prompt**
- Фокус на візуальних доказах від Гріші
- Стратегії для deep replan
- Багато прикладів

### 4. **Testability**
- Можна тестувати окремо від executor
- Mock Grisha/Tetyana data
- Перевіряти preprocessing logic

### 5. **Consistency**
- Всі stages = окремі processors
- Однакова структура `execute(context)`
- DI registration

---

## 🧪 Приклад використання

```javascript
// Після max attempts в executor-v3.js:

// 1. Get Grisha analysis
const grishaAnalysis = await verifyProcessor.getDetailedAnalysisForAtlas(
  item,
  execution
);

// 2. Prepare context
const tetyanaData = {
  plan: planResult.plan,
  execution: execResult.execution,
  tools_used: execResult.execution.results.map(r => r.tool)
};

const grishaData = {
  verified: false,
  reason: grishaAnalysis.reason,
  visual_evidence: grishaAnalysis.visual_evidence,
  suggestions: grishaAnalysis.suggestions,
  failure_analysis: grishaAnalysis.failure_analysis
};

// 3. Call replan processor
const replanResult = await replanProcessor.execute({
  failedItem: item,
  todo,
  tetyanaData,
  grishaData,
  session,
  res
});

// 4. Handle result
if (replanResult.replanned && replanResult.new_items.length > 0) {
  // Insert new items
  todo.items.splice(currentIndex + 1, 0, ...replanResult.new_items);
  item.status = 'replanned';
} else {
  item.status = 'failed';
}
```

---

## 📝 Metadata tracking

**replanResult:**
```javascript
{
  success: true,
  replanned: true/false,
  strategy: "replan_and_continue" | "skip_and_continue" | "abort",
  reasoning: "детальний аналіз...",
  new_items: [...],
  modified_items: [...],
  continue_from_item_id: number,
  summary: "🔍 Аналіз провалу...",
  metadata: {
    itemId: 2,
    root_cause: "timing_issue",
    grisha_confidence: 85,
    suggestions_count: 3,
    new_items_count: 2
  }
}
```

---

## 🎯 Порівняння: До vs Після

### До (старий підхід):
```javascript
// executor-v3.js (line 820)
const replanResult = await adjustProcessor._analyzeAndReplanTodo(
  item, todo, tetyanaData, grishaData
);
// Проблеми:
// - Private method в adjust processor
// - Немає preprocessing
// - Змішана відповідальність (adjust + replan)
```

### Після (новий підхід):
```javascript
// executor-v3.js (line 820)
const replanResult = await replanProcessor.execute({
  failedItem: item,
  todo,
  tetyanaData,
  grishaData,
  session,
  res
});
// Переваги:
// - Окремий processor
// - Preprocessing в _preprocessContext()
// - Чітке розділення відповідальностей
// - Легко тестувати
```

---

## ✅ Checklist виконаних завдань

- [x] Створено `atlas-replan-todo-processor.js`
- [x] Оновлено `executor-v3.js` для використання нового processor
- [x] Оновлено `stages/index.js` для експорту
- [x] Зареєстровано в `service-registry.js` (DI container)
- [x] Додано до `prompts/mcp/index.js`
- [x] Виправлено dependencies для `tetyanaExecuteToolsProcessor`
- [x] Документація створена

---

## 🚀 Наступні кроки (опціонально)

1. **Unit тести** для `atlas-replan-todo-processor.js`
2. **Integration тести** з mock Grisha/Tetyana data
3. **Performance metrics** для preprocessing
4. **Prompt optimization** на основі реальних кейсів

---

**Автор:** Cascade AI  
**Дата:** 2025-10-18T17:05:00+03:00
