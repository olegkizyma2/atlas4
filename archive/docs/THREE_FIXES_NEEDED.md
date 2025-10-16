# Three Fixes Needed - Summary

**Date:** 2025-10-15 22:50  
**Status:** IDENTIFIED  

## 1. ✅ FIXED: Summary Display Bug

### Problem
```
🎉 [object Object]
```

### Cause
Frontend отримує об'єкт summary, але виводить його як `[object Object]`

### Solution
**File:** `web/static/js/modules/chat-manager.js`

```javascript
handleMCPWorkflowComplete(data) {
  if (data.summary) {
    const summary = typeof data.summary === 'string'
      ? data.summary
      : `Завершено: ${data.summary.completed || 0}/${data.summary.total || 0} пунктів успішно`;
    this.addMessage(`🎉 ${summary}`, 'system');
  }
}
```

**Status:** ✅ FIXED (потрібен перезапуск frontend)

---

## 2. ⏳ TODO: Missing TTS for Tetyana and Grisha

### Problem
Не чути голоси Тетяни та Гріші під час виконання завдань

### Cause
Оптимізовані промпти **НЕ містять tts_phrase** в output format:
- `tetyana_plan_tools_optimized.js` - немає tts_phrase
- `grisha_verify_item_optimized.js` - немає tts_phrase

### Solution Needed

#### A. Додати tts_phrase в OUTPUT FORMAT

**tetyana_plan_tools_optimized.js:**
```javascript
OUTPUT FORMAT (JSON only):
{
  "tool_calls": [...],
  "reasoning": "...",
  "tts_phrase": "Готово, використовую X інструментів"  // ADD THIS
}
```

**grisha_verify_item_optimized.js:**
```javascript
OUTPUT FORMAT (JSON only):
{
  "verified": boolean,
  "reason": "...",
  "evidence": {...},
  "from_execution_results": boolean,
  "tts_phrase": "Перевірено успішно" або "Потрібна додаткова перевірка"  // ADD THIS
}
```

#### B. Додати приклади з tts_phrase

**Приклад для Тетяни:**
```javascript
{
  "tool_calls": [{...}],
  "reasoning": "...",
  "tts_phrase": "Відкриваю калькулятор"
}
```

**Приклад для Гріші:**
```javascript
{
  "verified": true,
  "reason": "...",
  "tts_phrase": "Підтверджено"
}
```

**Status:** ⏳ TODO

---

## 3. ⏳ TODO: Mandatory Screenshot Verification for Results

### Problem
Гріша довіряє AppleScript keystroke, але **НЕ перевіряє візуально результат обчислення**

### Current Behavior
```
Item 1: Відкрити калькулятор → ✅ Verified (AppleScript)
Item 2: Ввести 333 → ✅ Verified (AppleScript keystroke)
Item 3: Ввести * 2 → ✅ Verified (AppleScript keystroke)
```

**Проблема:** Немає перевірки, що калькулятор показує **666**

### Solution Needed

#### A. Розділити Success Criteria

**Замість:**
```
1. Відкрити калькулятор
2. Ввести 333
3. Ввести * 2
```

**Зробити:**
```
1. Відкрити калькулятор
2. Ввести 333 * 2
3. Перевірити що результат = 666 (screenshot)
```

#### B. Додати обов'язковий screenshot для результатів

**В `atlas_todo_planning_optimized.js`:**

```javascript
ПРАВИЛА для МАТЕМАТИЧНИХ ОПЕРАЦІЙ:
1. Останній пункт ЗАВЖДИ = перевірка результату через screenshot
2. Success criteria: "Калькулятор показує результат X"
3. Tools needed: ["playwright__screenshot"] або ["shell__screencapture"]
4. MCP servers: ["playwright"] або ["shell"]

ПРИКЛАД:
Request: "Перемнож 333 на 2 в калькуляторі"
TODO:
1. Відкрити калькулятор
2. Ввести 333 * 2 та натиснути Enter
3. Перевірити що калькулятор показує 666 (screenshot)  // ОБОВ'ЯЗКОВО
```

#### C. Оновити Гришу для screenshot verification

**В `grisha_verify_item_optimized.js`:**

```javascript
СПЕЦІАЛЬНЕ ПРАВИЛО для РЕЗУЛЬТАТІВ ОБЧИСЛЕНЬ:
- Якщо Success Criteria містить "показує результат" або "відображає"
- ОБОВ'ЯЗКОВО використай screenshot для візуальної перевірки
- НЕ довіряй тільки execution results
- verified=true ТІЛЬКИ якщо screenshot підтверджує результат
```

**Status:** ⏳ TODO

---

## Priority Order

1. **HIGH:** Fix #2 (TTS for agents) - користувач не чує feedback
2. **MEDIUM:** Fix #3 (Screenshot verification) - важливо для точності
3. **LOW:** Fix #1 (Summary display) - вже виправлено, потрібен тільки перезапуск

## Implementation Plan

### Step 1: Add TTS phrases to prompts
- [ ] Update `tetyana_plan_tools_optimized.js`
- [ ] Update `grisha_verify_item_optimized.js`
- [ ] Add examples with tts_phrase
- [ ] Test TTS works

### Step 2: Add screenshot verification
- [ ] Update `atlas_todo_planning_optimized.js` with math rules
- [ ] Update `grisha_verify_item_optimized.js` with screenshot rule
- [ ] Add examples for result verification
- [ ] Test calculator with screenshot

### Step 3: Restart and test
- [ ] Restart system
- [ ] Test: "Відкрий калькулятор і перемнож 333 на 2"
- [ ] Verify: TTS works for all agents
- [ ] Verify: Screenshot taken for result
- [ ] Verify: Summary displays correctly

---

**Next:** Implement Fix #2 (TTS phrases)
