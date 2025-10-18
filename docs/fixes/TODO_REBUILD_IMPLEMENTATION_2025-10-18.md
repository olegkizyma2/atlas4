# Імплементація виправлень TODO Rebuild System
**Дата:** 2025-10-18  
**Статус:** ✅ ЗАВЕРШЕНО

---

## 📊 Огляд проблеми

### Початкова ситуація (з логів):
```
Запит: "створи презентацію з даними про BYD Song Plus"

Результат: 1/5 items completed (20% успіху)
- Item 1: ✅ Відкрити браузер
- Item 2: ❌ Знайти BYD Song Plus (3 спроби, візуально не підтверджено)
- Item 3: ❌ Зібрати ціни (3 спроби, візуально не підтверджено)
- Item 4: ⚠️ Створити PPTX файл (невалідні інструменти)
- Item 5: ⚠️ Додати дані (помилка планування)
```

### Виявлені проблеми:
1. ❌ Тетяна виконує ВСІ tools одразу без проміжних перевірок
2. ❌ Atlas НЕ викликає replan після max attempts
3. ❌ Гріша не надає детальний аналіз для Atlas
4. ❌ Server Selection обирає 1 сервер замість 2 для PPTX
5. ❌ Відсутня перебудова TODO після провалів

---

## ✅ Імплементовані виправлення

### Fix 1: Step-by-Step Execution (Тетяна)

**Файл:** `orchestrator/workflow/stages/tetyana-execute-tools-processor.js`

**Зміни:**
- Додано метод `_shouldExecuteStepByStep()` з 4 правилами активації
- Додано метод `_executeStepByStep()` для послідовного виконання
- Додано метод `_executeOneTool()` для виконання 1 інструменту
- Додано метод `_getDelayBetweenTools()` для затримок між tools

**Правила активації step-by-step:**
```javascript
1. playwrightTools > 3 → step-by-step
2. action contains "знайди", "зібрати", "search" → step-by-step
3. attempt > 1 (retry) → step-by-step
4. uniqueServers > 2 → step-by-step
```

**Затримки між tools:**
```javascript
playwright_navigate/fill/click → 2000ms
інші playwright tools → 1000ms
filesystem/shell → 200ms
default → 500ms
```

**Переваги:**
- ✅ Зупинка на першій помилці (не виконуємо наступні tools)
- ✅ Проміжні затримки для завантаження сторінок
- ✅ Легше діагностувати де саме провал
- ✅ Metadata містить `stopped_at_index` для аналізу

---

### Fix 2: Enhanced Server Selection

**Файл:** `prompts/mcp/stage2_0_server_selection.js`

**Зміни:**
- Додано категорію **"7. ОФІСНІ ДОКУМЕНТИ"**
- Змінено відсоток "ДВА СЕРВЕРИ" з 5% на 15%
- Додано приклад 6 для презентацій PPTX
- Оновлено правила вибору

**Нова категорія:**
```javascript
### 7. ОФІСНІ ДОКУМЕНТИ (PPTX, XLSX, DOCX)
Ключові слова: презентація, pptx, powerpoint, excel, xlsx, word, docx, слайд
Підхід: Python scripts через shell + filesystem для даних
Сервери: shell, filesystem
Reasoning: Python libraries (python-pptx, openpyxl, python-docx) через shell для створення
```

**Оновлені правила:**
```javascript
- Якщо ОЧЕВИДНО потрібно 2 → обирай 2 (офісні документи, web+save)
- Якщо сумніваєшся → обирай безпечний варіант
- Confidence < 0.7 → вибір має бути консервативним
```

**Приклад:**
```javascript
TODO: "Створи презентацію BYD_Song_Plus_2025.pptx з даними про ціни"
→ selected_servers: ["shell", "filesystem"]
→ reasoning: "shell для python-pptx створення PPTX, filesystem для читання даних"
→ confidence: 0.92
```

---

### Fix 3: Detailed Grisha Analysis for Atlas

**Файл:** `orchestrator/workflow/stages/grisha-verify-item-processor.js`

**Зміни:**
- Додано метод `getDetailedAnalysisForAtlas()` - основний метод
- Додано метод `_generateAtlasSuggestions()` - генерація порад
- Додано метод `_analyzeFailure()` - аналіз причини провалу
- Додано метод `_determineLikelyCause()` - визначення root cause
- Додано метод `_recommendStrategy()` - рекомендація стратегії

**Структура аналізу:**
```javascript
{
  verified: false,
  confidence: 45,
  reason: "Не знайдено BYD Song Plus на сторінці",
  
  visual_evidence: {
    observed: "Honda, Volkswagen listings visible",
    matches_criteria: false,
    details: "Search results don't match BYD Song Plus"
  },
  
  screenshot_path: "/path/to/screenshot.png",
  
  suggestions: [
    "Verify search query correctness",
    "Use alternative search strategy",
    "Try different CSS selectors"
  ],
  
  failure_analysis: {
    stage: "verification",
    what_failed: "Visual verification did not match success criteria",
    execution_succeeded: true,
    visual_mismatch: true,
    likely_cause: "wrong_approach",  // timing_issue, tool_execution_failed, wrong_parameters, etc.
    recommended_strategy: "replan_with_different_tools"
  }
}
```

**Визначення причин (likely_cause):**
- `timing_issue` - не завантажилось, timeout
- `wrong_approach` - не знайдено, відсутній
- `tool_execution_failed` - інструменти провалились
- `wrong_parameters` - невірні параметри
- `unrealistic_criteria` - критерії не відповідають
- `unclear_state` - confidence < 50

**Рекомендовані стратегії:**
```javascript
timing_issue → retry_with_delays
wrong_approach → replan_with_different_tools
tool_execution_failed → fix_tool_parameters
wrong_parameters → modify_parameters
unrealistic_criteria → adjust_success_criteria
unclear_state → split_into_smaller_items
```

---

### Fix 4: Deep Analysis After Max Attempts

**Файл:** `orchestrator/workflow/executor-v3.js`

**Зміни:**
- Додано Stage 3.5-MCP після max attempts (line 783-904)
- Виклик `verifyProcessor.getDetailedAnalysisForAtlas()`
- Виклик `adjustProcessor._analyzeAndReplanTodo()`
- Вставка нових items у TODO list
- Нові event types для frontend

**Логіка:**
```javascript
// ПІСЛЯ MAX ATTEMPTS (3 спроби)
if (item.status !== 'completed' && item.status !== 'skipped') {
  
  // 1. Гріша надає детальний аналіз
  const grishaAnalysis = await verifyProcessor.getDetailedAnalysisForAtlas(item, execution);
  
  // 2. Підготовка даних для Atlas
  const tetyanaData = { plan, execution, tools_used };
  const grishaData = { 
    verified: false, 
    reason, 
    visual_evidence, 
    suggestions, 
    failure_analysis 
  };
  
  // 3. Atlas аналізує і приймає рішення
  const replanResult = await adjustProcessor._analyzeAndReplanTodo(
    item, 
    todo, 
    tetyanaData, 
    grishaData
  );
  
  // 4. Якщо replanned → вставка нових items
  if (replanResult.replanned && replanResult.new_items.length > 0) {
    todo.items.splice(currentIndex + 1, 0, ...replanResult.new_items);
    item.status = 'replanned';
    
    // Send 'mcp_item_replanned' event
  } else {
    item.status = 'failed';
    
    // Send 'mcp_item_failed' event
  }
}
```

**Нові event types:**
- `mcp_item_replanned` - Atlas перебудував план
- `mcp_item_failed` - провал без replan

---

## 🎯 Очікувані результати

### До виправлень:
```
✅ 1/5 items (20%)
❌ 2 items failed (max attempts without replan)
⚠️ 2 items invalid tools (wrong server selection)
```

### Після виправлень:
```
✅ 4-5/5 items (80-100%)
🔄 1 item replanned → new approach → success
📊 Step-by-step execution prevents early cascading failures
🧠 Atlas learns from Grisha's detailed visual analysis
🎯 Server Selection correctly chooses 2 servers for PPTX
```

---

## 📝 Порядок виконання workflow (оновлений)

### Стандартний flow:
```
Stage 1: Atlas планує TODO (5 items)
  ↓
For each item:
  Stage 2.0: System обирає MCP сервери (playwright, filesystem)
  Stage 2.1: Тетяна планує tools (5-7 tool calls)
  Stage 2.2: Тетяна виконує tools
    → Якщо step-by-step: виконує по 1, зупиняється на помилці
    → Якщо batch: виконує всі одразу
  Stage 2.3: Гріша перевіряє візуально (screenshot + AI vision)
    ↓
  Якщо verified:
    ✅ Item completed, next item
    ↓
  Якщо НЕ verified && attempt < max_attempts:
    Stage 3: Atlas коригує item (retry/modify/split/skip)
    → Retry attempt
    ↓
  Якщо НЕ verified && attempt >= max_attempts:
    🔍 Stage 3.5 (NEW): Deep Analysis
      1. Гріша: детальний аналіз (root cause, suggestions)
      2. Atlas: replan на основі візуальних доказів
      3. Вставка нових items АБО провал
  ↓
Stage 8: Final Summary
```

---

## 🔧 Технічні деталі

### Metadata tracking:

**tetyana-execute-tools-processor.js:**
```javascript
metadata: {
  executionMode: 'step_by_step',  // або 'batch'
  stoppedAt: 3,  // індекс інструменту де зупинилось
  toolCount: 7,
  successfulCalls: 3,
  failedCalls: 1
}
```

**grisha-verify-item-processor.js:**
```javascript
analysis: {
  failure_analysis: {
    likely_cause: 'timing_issue',
    recommended_strategy: 'retry_with_delays'
  },
  suggestions: ['Add wait_for_load_state', 'Increase timeout']
}
```

**executor-v3.js:**
```javascript
replanResult: {
  replanned: true,
  strategy: 'replan_and_continue',
  new_items: [
    { id: 6, action: "Чекати завантаження сторінки 3 секунди" },
    { id: 7, action: "Знайти BYD Song Plus через альтернативний селектор" }
  ],
  reasoning: "Візуальна перевірка показала що сторінка не встигла завантажитись..."
}
```

---

## 🧪 Тестування

### Test Case 1: BYD Song Plus презентація (з логів)
```javascript
Request: "створи презентацію з даними про BYD Song Plus"

Expected flow:
1. Item 1: Відкрити браузер → ✅
2. Item 2: Знайти BYD (step-by-step execution)
   - Tool 1: navigate → success, wait 2s
   - Tool 2: fill search → success, wait 2s
   - Tool 3: click search → success, wait 2s
   - Grisha verifies → ❌ не завантажилось
3. Stage 3.5: Deep Analysis
   - Grisha: likely_cause = 'timing_issue'
   - Atlas: replan with "Add wait 3s" item
4. Item 2-new: Чекати завантаження → ✅
5. Item 3: Зібрати дані → ✅
6. Item 4: Створити PPTX (server selection = [shell, filesystem]) → ✅
7. Item 5: Додати дані → ✅

Result: 7/7 items completed (100%)
```

### Test Case 2: Multi-step web scraping
```javascript
Request: "зібери інформацію про топ-10 новин з techcrunch.com"

Expected:
- Step-by-step triggered (action contains "зібери")
- playwright tools виконуються по черзі з затримками
- Grisha перевіряє після кожного navigate
- При провалі Atlas replan з альтернативними селекторами
```

---

## 📚 Документація змін

### Оновлені файли:
1. ✅ `orchestrator/workflow/stages/tetyana-execute-tools-processor.js` (v4.1.0)
2. ✅ `prompts/mcp/stage2_0_server_selection.js` (updated 2025-10-18)
3. ✅ `orchestrator/workflow/stages/grisha-verify-item-processor.js` (new methods)
4. ✅ `orchestrator/workflow/executor-v3.js` (Stage 3.5-MCP added)

### Нові методи:
- `TetyanaExecuteToolsProcessor._shouldExecuteStepByStep()`
- `TetyanaExecuteToolsProcessor._executeStepByStep()`
- `TetyanaExecuteToolsProcessor._executeOneTool()`
- `TetyanaExecuteToolsProcessor._getDelayBetweenTools()`
- `GrishaVerifyItemProcessor.getDetailedAnalysisForAtlas()`
- `GrishaVerifyItemProcessor._generateAtlasSuggestions()`
- `GrishaVerifyItemProcessor._analyzeFailure()`
- `GrishaVerifyItemProcessor._determineLikelyCause()`
- `GrishaVerifyItemProcessor._recommendStrategy()`

### Нові event types:
- `mcp_item_replanned` - TODO item був перебудований Atlas
- `mcp_item_failed` - TODO item провалився після max attempts

---

## 🎓 Ключові принципи

### 1. Поступовість
Виконувати tools по 1, не всі одразу. Зупинятись на першій помилці.

### 2. Аналіз
Після провалу - повний аналіз з Грішею (візуальні докази, причини, поради).

### 3. Адаптація
Atlas перебудовує план на основі візуальних доказів, а не здогадок.

### 4. Точність
Server Selection обирає 2 сервери коли це очевидно потрібно (офісні документи).

### 5. Feedback Loop
```
Тетяна (виконання) 
  → Гріша (візуальна перевірка) 
    → Atlas (глибокий аналіз) 
      → Replan (нові items)
        → Продовження workflow
```

---

## ✅ Статус виконання

- [x] Fix 1: Step-by-Step Execution
- [x] Fix 2: Enhanced Server Selection
- [x] Fix 3: Detailed Grisha Analysis
- [x] Fix 4: Deep Analysis After Max Attempts
- [x] Документація змін
- [x] Приклади та test cases

**Дата завершення:** 2025-10-18  
**Автор:** Cascade AI  
**Версія:** 1.0.0
