# Аналіз проблеми з перебудовою TODO
**Дата:** 2025-10-18  
**Проблема:** Після провалу TODO items Atlas не перебудовує план правильно

---

## 📊 Аналіз логів з веб-інтерфейсу

### Послідовність подій:

```
16:26:15 [USER] "на робочому столі надай мені у вигляді призентаціїному..."
16:26:30 [SYSTEM] План створено: 5 пунктів

1. ✅ Відкрити браузер на auto.ria.com → ВИКОНАНО (16:26:44)
2. ❌ Знайти BYD Song Plus → ПРОВАЛЕНО після 3 спроб (16:29:42)
   - Спроба 1: візуально не підтверджено (16:27:20)
   - Спроба 2: візуально не підтверджено (16:28:29) 
   - Спроба 3: візуально не підтверджено (16:29:39)
   - Помилка: "Max attempts reached"

3. ❌ Зібрати ціни на 10 автомобілів → ПРОВАЛЕНО після 3 спроб (16:33:22)
   - Спроба 1-3: візуально не підтверджено
   - Помилка: "Max attempts reached"

4. ⚠️ Створити файл презентації → ПОМИЛКА планування (16:33:26)
   - "План містить невалідні інструменти"

5. ⚠️ Додати дані до презентації → ПОМИЛКА планування (16:33:36)
   - "Не вдалося спланувати інструменти"

РЕЗУЛЬТАТ: 1/5 пунктів виконано (20% успіху)
```

---

## 🔍 Виявлені проблеми

### Проблема 1: Гріша провалює перевірку через візуальну невідповідність

**Симптом:**
```
16:27:20 ❌ Візуально не підтверджено: "Знайти BYD Song Plus через пошук"
Причина: The screenshot does not display search results specifically for BYD Song Plus
Деталі: The listings visible include Honda and Volkswagen, but BYD Song Plus is not present
```

**Діагноз:**
- Браузер відкрив сторінку пошуку
- Тетяна виконала fill + click
- АЛЕ результати не завантажились або неправильний пошук
- Гріша бачить інші машини (Honda, Volkswagen) на скріні

**Причина:** Тетяна виконує tools ЗАНАДТО ШВИДКО без чекання завантаження

---

### Проблема 2: Atlas НЕ перебудовує TODO після провалів

**Код:** `executor-v3.js:729-731`
```javascript
// Stage 3: Adjust TODO (if attempts remain)
if (attempt < item.max_attempts) {
  const adjustment = await this.adjustTodoItem(item, verification, attempt);
```

**Проблема:** 
- `adjustTodoItem()` викликається ТІЛЬКИ якщо `attempt < max_attempts`
- Коли досягнуто max_attempts (3) → Atlas НЕ аналізує причину провалу
- TODO просто йде до наступного пункту БЕЗ перебудови

**Очікувана поведінка:**
```javascript
// Після MAX attempts - викликати повний аналіз
if (attempt >= item.max_attempts && !verification.verified) {
  // FULL ANALYSIS with Grisha's screen + Tetyana's execution
  const replanResult = await this._analyzeAndReplanTodo(item, todo, tetyanaData, grishaData);
  
  if (replanResult.replanned) {
    // Rebuild TODO with new approach
  }
}
```

---

### Проблема 3: Тетяна планує БАГАТО tools ОДРАЗУ

**Поточна логіка:**
1. Тетяна планує ВСІ tools для item (5-10 інструментів)
2. Виконує їх ВСІ підряд
3. Гріша перевіряє результат в КІНЦІ

**Проблема:**
- Якщо 3-й tool провалився → всі наступні теж провалюються
- Немає проміжної перевірки
- Важко зрозуміти де саме провал

**Рішення: Поступове виконання (Step-by-Step)**
```javascript
// НОВИЙ ПІДХІД: Execute tools in small batches
for (let tool of plan.tool_calls) {
  // 1. Execute single tool
  const result = await executeOneTool(tool);
  
  // 2. Quick verification (optional screenshot)
  const quickCheck = await quickVerify(tool, result);
  
  // 3. If failed - stop and adjust
  if (!quickCheck.success) {
    return { needsAdjustment: true, failedAt: tool };
  }
}
```

---

### Проблема 4: Server Selection обирає тільки 1 сервер

**Приклад з логів:**
```
Пункт 4: "Створити файл презентації BYD_Song_Plus_2025.pptx"
→ Server Selection обрав: [filesystem]
→ Тетяна спробувала: filesystem__write_file
→ ПОМИЛКА: filesystem не може створювати PPTX файли
```

**Діагноз:**
- `stage2_0_server_selection.js` має правило: "Якщо сумніваєшся між 1 і 2 → обирай 1"
- Для PPTX потрібно: shell (створення через python-pptx) + filesystem (збереження)
- АЛЕ система обрала тільки filesystem

**Рішення:**
```javascript
// В stage2_0_server_selection.js:
### ДВА СЕРВЕРИ (коли ПОТРІБНО):
- **Презентація/Excel** → shell (python script) + filesystem (save)
- **Web + зберегти файл** → playwright + filesystem
- **Команда + файл** → shell + filesystem
```

---

### Проблема 5: Відсутній повний аналіз після провалу

**Що відбувається зараз:**
```javascript
// mcp-todo-manager.js:729
if (attempt < item.max_attempts) {
  const adjustment = await this.adjustTodoItem(item, verification, attempt);
  // Atlas каже: "retry", "modify", "skip"
}
// Якщо attempt >= max_attempts → НІЧОГО НЕ РОБИТЬСЯ
```

**Що має бути:**
```javascript
if (!verification.verified) {
  // 1. Зібрати ВСІ дані
  const fullContext = {
    tetyana: { plan, execution, tools_used },
    grisha: { screenshot, visual_evidence, reason, confidence }
  };
  
  // 2. Atlas аналізує ГЛИБОКО
  const analysis = await atlas.deepAnalysis(fullContext);
  
  // 3. Приймає рішення:
  if (analysis.canBeFixed) {
    // Replan with new approach
    const newPlan = await atlas.replan(item, analysis);
  } else {
    // Skip this item, explain why
    const skipReason = analysis.impossibleBecause;
  }
}
```

---

## 🎯 Рішення та виправлення

### Fix 1: Поступове виконання інструментів Тетяною

**Файл:** `tetyana-execute-tools-processor.js`

**Додати новий режим:** `step_by_step_execution`

```javascript
async execute(context) {
  const { plan, currentItem } = context;
  
  // NEW: Detect if item needs step-by-step execution
  const needsStepByStep = this._shouldExecuteStepByStep(plan, currentItem);
  
  if (needsStepByStep) {
    return await this._executeStepByStep(plan, currentItem);
  } else {
    return await this._executeBatch(plan, currentItem);
  }
}

async _executeStepByStep(plan, item) {
  const results = [];
  
  for (let i = 0; i < plan.tool_calls.length; i++) {
    const tool = plan.tool_calls[i];
    
    // Execute ONE tool
    const result = await this._executeOneTool(tool);
    results.push(result);
    
    // Quick screenshot check
    if (tool.server === 'playwright' || tool.needsVerification) {
      const screenshot = await this.visualCapture.captureScreenshot(`tool_${i}`);
      
      // Optional: Quick AI check "does this look right?"
      const quickCheck = await this._quickVisualCheck(screenshot, tool.reasoning);
      
      if (!quickCheck.looksGood) {
        // Stop here, return partial results
        return {
          success: false,
          results,
          failedAt: i,
          reason: quickCheck.reason,
          needsAdjustment: true
        };
      }
    }
    
    // Wait between tools (especially for web)
    if (tool.server === 'playwright') {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  return { success: true, results };
}

_shouldExecuteStepByStep(plan, item) {
  // Execute step-by-step if:
  // - More than 3 playwright tools
  // - Item has "search", "scrape", "collect" in action
  // - Previous attempt failed
  
  const playwrightTools = plan.tool_calls.filter(t => t.server === 'playwright').length;
  if (playwrightTools > 3) return true;
  
  const actionLower = item.action.toLowerCase();
  if (actionLower.includes('знайди') || actionLower.includes('зібрати')) return true;
  
  if (item.attempt > 1) return true;
  
  return false;
}
```

---

### Fix 2: Atlas повний аналіз після max attempts

**Файл:** `executor-v3.js`

**Додати після line 751:**

```javascript
// AFTER max attempts reached - DEEP ANALYSIS
if (attempt >= maxAttempts && !verification.verified) {
  logger.workflow('stage', 'atlas', `Stage 3.5-MCP: Deep analysis after ${maxAttempts} attempts`, {
    sessionId: session.id
  });
  
  // Prepare data for Atlas
  const tetyanaData = {
    plan: planResult.plan,
    execution: execResult.execution,
    tools_used: execResult.execution.results.map(r => r.tool)
  };
  
  const grishaData = {
    verified: false,
    reason: verifyResult.verification.reason,
    visual_evidence: verifyResult.verification.visual_evidence,
    screenshot_path: verifyResult.verification.screenshot_path,
    confidence: verifyResult.metadata.confidence
  };
  
  // Atlas analyzes deeply
  const replanResult = await adjustProcessor._analyzeAndReplanTodo(
    item,
    todo,
    tetyanaData,
    grishaData
  );
  
  // Apply replan if needed
  if (replanResult.replanned && replanResult.new_items) {
    logger.info(`Atlas replanned: ${replanResult.new_items.length} new items`, {
      sessionId: session.id
    });
    
    // Insert new items into TODO
    const currentIndex = todo.items.indexOf(item);
    todo.items.splice(currentIndex + 1, 0, ...replanResult.new_items);
    
    // Mark current item as adjusted
    item.status = 'replanned';
    item.replan_reason = replanResult.reasoning;
    
    break; // Exit retry loop, continue with new plan
  }
}
```

---

### Fix 3: Server Selection обирає 2 сервери коли потрібно

**Файл:** `stage2_0_server_selection.js`

**Оновити правила (line 71-73):**

```javascript
### ДВА СЕРВЕРИ (15% випадків, НЕ 5%):
- **Web + зберегти файл** → playwright, filesystem
- **Web + запам'ятати** → playwright, memory
- **Команда + файл** → shell, filesystem
- **Презентація/Excel** → shell, filesystem (python script для створення)
- **Складна обробка даних** → fetch, filesystem
- **GUI + перевірка** → applescript, shell
- **Git + файли** → git, filesystem

### ПРЕЗЕНТАЦІЇ ТА ОФІСНІ ФАЙЛИ:
**Ключові слова:** презентація, PPTX, PowerPoint, Excel, XLSX, Word, DOCX
**Підхід:** 
1. shell → виконати Python script (python-pptx, openpyxl)
2. filesystem → прочитати дані / зберегти результат
**Сервери:** ["shell", "filesystem"]

**Приклад:**
TODO: "Створи презентацію з даними про ціни"
→ selected_servers: ["shell", "filesystem"]
→ reasoning: "shell для python-pptx створення PPTX, filesystem для читання даних про ціни"
```

**Оновити правило вибору (line 177-179):**

```javascript
⚠️ **КРИТИЧНО:**
- Обирай МІНІМУМ серверів (1-2, НЕ більше)
- Якщо ОЧЕВИДНО потрібно 2 → обирай 2 (не 1)  // CHANGED
- Confidence < 0.7 → обирай безпечний варіант
```

---

### Fix 4: Грішин аналіз для Atlas replan

**Файл:** `grisha-verify-item-processor.js`

**Додати метод `getDetailedAnalysisForAtlas()`:**

```javascript
/**
 * Get detailed analysis for Atlas replanning
 * Includes all context: screenshot, visual evidence, suggestions
 */
async getDetailedAnalysisForAtlas(item, execution) {
  const verification = await this.execute({ currentItem: item, execution });
  
  return {
    verified: verification.verified,
    confidence: verification.confidence,
    reason: verification.verification.reason,
    
    // Visual evidence
    visual_evidence: {
      observed: verification.verification.visual_evidence.observed,
      matches_criteria: verification.verification.visual_evidence.matches_criteria,
      details: verification.verification.visual_evidence.details
    },
    
    // Screenshot
    screenshot_path: verification.verification.screenshot_path,
    screenshot_hash: verification.verification.screenshot_hash,
    
    // Suggestions for Atlas
    suggestions: this._generateAtlasSuggestions(verification, item),
    
    // What went wrong
    failure_analysis: this._analyzeFailure(verification, execution, item)
  };
}

_generateAtlasSuggestions(verification, item) {
  const suggestions = [];
  
  // Analyze why verification failed
  const reason = verification.verification.reason.toLowerCase();
  
  if (reason.includes('не завантажилось') || reason.includes('loading')) {
    suggestions.push('Add explicit wait for page load before scraping');
    suggestions.push('Increase timeout for navigation');
  }
  
  if (reason.includes('не знайдено') || reason.includes('not found')) {
    suggestions.push('Use different search strategy');
    suggestions.push('Check if search query is correct');
    suggestions.push('Try alternative selectors');
  }
  
  if (reason.includes('невірний') || reason.includes('invalid')) {
    suggestions.push('Fix tool parameters');
    suggestions.push('Use correct path/URL/selector');
  }
  
  return suggestions;
}

_analyzeFailure(verification, execution, item) {
  return {
    stage: 'verification',
    what_failed: verification.verified ? null : 'Visual verification did not match success criteria',
    execution_succeeded: execution.all_successful || false,
    visual_mismatch: !verification.verification.visual_evidence.matches_criteria,
    
    // Root cause analysis
    likely_cause: this._determineLikelyCause(verification, execution),
    
    // Recommendation
    recommended_strategy: this._recommendStrategy(verification, execution, item)
  };
}

_determineLikelyCause(verification, execution) {
  if (!execution.all_successful) {
    return 'tool_execution_failed';
  }
  
  if (verification.confidence < 50) {
    return 'unclear_state';
  }
  
  const reason = verification.verification.reason.toLowerCase();
  if (reason.includes('timeout') || reason.includes('loading')) {
    return 'timing_issue';
  }
  
  if (reason.includes('не знайдено') || reason.includes('відсутній')) {
    return 'wrong_approach';
  }
  
  return 'unknown';
}

_recommendStrategy(verification, execution, item) {
  const cause = this._determineLikelyCause(verification, execution);
  
  switch (cause) {
    case 'timing_issue':
      return 'retry_with_delays';
    case 'wrong_approach':
      return 'replan_with_different_tools';
    case 'tool_execution_failed':
      return 'fix_tool_parameters';
    default:
      return 'modify_or_split';
  }
}
```

---

## 📝 Порядок впровадження

### Крок 1: Step-by-step execution (HIGH PRIORITY)
1. Додати `_executeStepByStep()` в `tetyana-execute-tools-processor.js`
2. Додати `_shouldExecuteStepByStep()` логіку
3. Додати проміжні screenshot checks

### Крок 2: Full analysis after max attempts (HIGH PRIORITY)
1. Оновити `executor-v3.js` line 751+
2. Викликати `_analyzeAndReplanTodo()` після max attempts
3. Застосувати replan result до TODO list

### Крок 3: Enhanced Grisha analysis (HIGH PRIORITY)
1. Додати `getDetailedAnalysisForAtlas()` в `grisha-verify-item-processor.js`
2. Додати `_generateAtlasSuggestions()`
3. Додати `_analyzeFailure()`

### Крок 4: Better Server Selection (MEDIUM PRIORITY)
1. Оновити rules в `stage2_0_server_selection.js`
2. Додати категорію для презентацій/Excel
3. Змінити "якщо сумніваєшся → 1" на "якщо очевидно потрібно 2 → 2"

### Крок 5: Testing (CRITICAL)
1. Тест кейс: BYD Song Plus презентація (як в логах)
2. Тест кейс: Web scraping з багатьма кроками
3. Тест кейс: Файлові операції + презентація

---

## 🎯 Очікувані результати

### До виправлень:
```
✅ 1/5 items completed (20%)
❌ 2 items failed (max attempts)
⚠️ 2 items invalid tools
```

### Після виправлень:
```
✅ 4/5 items completed (80%+)
🔄 1 item replanned → success
📊 Step-by-step execution prevents early failures
🧠 Atlas learns from Grisha's visual analysis
```

---

## 📌 Ключові принципи

1. **Поступовість:** Виконувати tools по 1-2, не всі одразу
2. **Аналіз:** Після провалу - повний аналіз з Грішею
3. **Адаптація:** Atlas перебудовує план на основі візуальних доказів
4. **Точність:** Server Selection обирає 2 сервери коли потрібно
5. **Feedback loop:** Тетяна → виконання → Гріша → аналіз → Atlas → replan

---

**Автор:** Cascade AI  
**Дата:** 2025-10-18T16:50:00+03:00
