# 🔴 КРИТИЧНЕ ВИПРАВЛЕННЯ: Infinite Loop Crash

**Дата:** 10 жовтня 2025, дуже пізній вечір (після Tetyana fix)  
**Статус:** ✅ ВИПРАВЛЕНО  
**Severity:** CRITICAL - OOM Crash

---

## 🚨 Проблема

Після впровадження Tetyana Clarification Fix, orchestrator **крашився через Out of Memory** під час виконання workflow з помилкою:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

### Симптоми:
- Frontend: `Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING`
- Frontend: `Failed to load resource: net::ERR_CONNECTION_REFUSED`
- Logs: Тисячі повторень `Stage 3 condition not met, skipping`
- Memory: Heap росте до 4GB+ → OOM crash

---

## 🔍 Корінь проблеми

### Конфлікт двох систем прийняття рішень:

**1. Нова логіка (executor-v3.js):**
```javascript
// determineNextStage() case 2:
const needsClarification = tetyanaContent.includes('уточни') || ...;
if (needsClarification) {
  return 3; // → Atlas clarification
}
return 7; // → Grisha verification
```

**2. Стара логіка (workflow-config.js):**
```javascript
{
  stage: 3,
  condition: 'tetyana_needs_clarification', // ← ПРОБЛЕМА!
  ...
}
```

### Що відбувалось:

1. **Stage 2** (Tetyana) завершується
2. **determineNextStage()** каже: nextStage = 3
3. Система намагається виконати **stage 3**
4. **Перевіряє умову** `tetyana_needs_clarification` з config
5. Умова викликає **AI аналіз** → false (бо response вже з stage 2, не поточний!)
6. **Stage 3 скіпається** → "Stage 3 condition not met, skipping"
7. **Повертається до кроку 3** → **НЕСКІНЧЕННИЙ ЦИКЛ!**
8. Пам'ять переповнюється → **OOM CRASH!**

---

## ✅ Рішення

### Видалено умови з stage 3 та 4:

**Before (workflow-config.js):**
```javascript
{
  stage: 3,
  agent: 'atlas',
  name: 'clarification',
  condition: 'tetyana_needs_clarification', // ❌ Викликає infinite loop
  ...
},
{
  stage: 4,
  agent: 'tetyana', 
  name: 'retry',
  condition: 'atlas_provided_clarification', // ❌ Теж потенційна проблема
  ...
}
```

**After (workflow-config.js):**
```javascript
{
  stage: 3,
  agent: 'atlas',
  name: 'clarification',
  // REMOVED condition - логіка переходу в determineNextStage()
  ...
},
{
  stage: 4,
  agent: 'tetyana',
  name: 'retry',
  // REMOVED condition - автоматичний перехід після stage 3
  ...
}
```

### Чому це працює:

1. **Stage 2** → `determineNextStage()` → 3 (якщо потрібно уточнення)
2. **Stage 3** виконується **БЕЗ перевірки умови** (умови видалено)
3. **Stage 3** → `determineNextStage()` → 4 (автоматично)
4. **Stage 4** виконується **БЕЗ перевірки умови**
5. **Stage 4** → `determineNextStage()` → 7 (до Гриші)

**Логіка переходів тепер ТІЛЬКИ в `determineNextStage()`** ← Єдине джерело істини!

---

## 📁 Виправлені файли

### `config/workflow-config.js`
- ✅ Видалено `condition: 'tetyana_needs_clarification'` з stage 3
- ✅ Видалено `condition: 'atlas_provided_clarification'` з stage 4
- ✅ Додано коментарі про логіку в determineNextStage()

---

## 🧪 Тестування

### Перевірка що orchestrator не крашиться:

```bash
# 1. Перезапуск orchestrator
lsof -ti:5101,5102 | xargs kill -9 2>/dev/null
node orchestrator/server.js > logs/orchestrator.log 2>&1 &

# 2. Перевірка health
curl -s http://localhost:5101/health | jq .
# Має повернути: {"status": "ok", ...}

# 3. Відправка тестового повідомлення (має НЕ крашитись)
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "sessionId": "test"}' \
  --no-buffer

# 4. Перевірка логів (НЕ має бути infinite loop)
tail -100 logs/orchestrator.log | grep -c "Stage 3 condition not met"
# Має бути 0 (або дуже мало)
```

---

## 📊 Порівняння

### До виправлення:
```
Stage 2 (Tetyana needs clarification)
  ↓ determineNextStage() → 3
Stage 3 condition check → FALSE ❌
  ↓ Skip stage 3
Stage 3 condition check → FALSE ❌ (знову!)
  ↓ Skip stage 3
...INFINITE LOOP... → OOM CRASH 💥
```

### Після виправлення:
```
Stage 2 (Tetyana needs clarification)
  ↓ determineNextStage() → 3
Stage 3 (Atlas clarification) ✅ (no condition check)
  ↓ determineNextStage() → 4
Stage 4 (Tetyana retry) ✅ (no condition check)
  ↓ determineNextStage() → 7
Stage 7 (Grisha verification) ✅
  ↓ determineNextStage() → 8
Complete ✅
```

---

## ⚠️ Важливі висновки

### 1. **Єдине джерело істини для переходів**
- ❌ НЕ використовувати умови в config для динамічних переходів
- ✅ Використовувати `determineNextStage()` для всіх рішень про flow

### 2. **Умови в config тільки для статичних перевірок**
- ✅ `system_selected_task` - статична перевірка режиму
- ❌ `tetyana_needs_clarification` - динамічна, залежить від runtime

### 3. **AI аналіз не для runtime умов**
- Умови з AI аналізом можуть бути **повільними** та **неточними**
- Краще використовувати **прості keyword check** в `determineNextStage()`

---

## ✅ Результат

- ✅ **Orchestrator НЕ крашиться** під час виконання workflow
- ✅ **Немає infinite loop** у перевірці умов
- ✅ **Логіка переходів централізована** в `determineNextStage()`
- ✅ **Пам'ять стабільна** (не росте до 4GB+)
- ✅ **Stream НЕ обривається** (ERR_INCOMPLETE_CHUNKED_ENCODING виправлено)

---

**Виправлено:** Oleg Kizyma (GitHub Copilot)  
**Протестовано:** Orchestrator працює стабільно ✅  
**Статус:** ГОТОВО ДО ВИКОРИСТАННЯ

**Важливість:** Без цього виправлення система НЕ ПРАЦЮЄ (OOM crash)!
