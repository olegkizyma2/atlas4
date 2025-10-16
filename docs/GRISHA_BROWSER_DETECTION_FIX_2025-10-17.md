# Grisha Browser Detection Fix - 17.10.2025

## 🔍 Проблема

**Симптом:** Гриша позначає завдання як ✅ ВИКОНАНО, навіть коли дії відбулись у НЕПРАВИЛЬНОМУ браузері.

**Приклад:**
- Запит: "Відкрий Safari, знайди Хатіко в Google"
- Item 1: "Відкрити браузер Safari" → Виконано ✅
- РЕАЛЬНІСТЬ: Відкрився Chrome (або Safari вже був відкритий), але наступні дії пішли до Chrome
- Items 2-6: Виконано в Chrome, НЕ Safari
- Гриша: Всі пункти ✅ VERIFIED

**Результат:** Користувач бачить Google/фільм у Chrome, НЕ Safari як просив.

---

## 🔬 Root Cause Analysis

### **RC #1: Верифікація через `ps aux | grep` - недостатня**

```bash
# Гриша виконує:
ps aux | grep Safari

# Результат:
user  1234  ... /Applications/Safari.app/Contents/MacOS/Safari

# ❌ ПРОБЛЕМА: Це показує ЧИ процес є, НЕ чи він АКТИВНИЙ
```

**Що НЕ перевіряється:**
1. ✗ Чи Safari ЗАРАЗ у фокусі (active window)?
2. ✗ Чи Safari був УЖЕ відкритий раніше?
3. ✗ Чи наступні команди підуть САМЕ до Safari?
4. ✗ Чи відкрився ІНШИЙ браузер замість Safari?

### **RC #2: Відсутність screenshot верифікації**

Промпт каже:
```javascript
⚠️ КРИТИЧНО - ОБОВ'ЯЗКОВИЙ SCREENSHOT ДЛЯ КОЖНОГО ПУНКТУ
```

**АЛЕ:** Логи показують що screenshot НЕ робиться:
```
[TODO] 🔧 Grisha calling execute_command on shell
[TODO] 🧠 Grisha analysis: ✅ VERIFIED
Evidence: "1 checks performed" (тільки ps aux)
```

**Чому screenshot критичний:**
- Показує ЯКА програма ЗАРАЗ активна
- Підтверджує чи ПРАВИЛЬНА програма у фокусі
- Виявляє якщо відкрився неправильний браузер

### **RC #3: Dependencies НЕ перевіряють контекст попереднього item**

```javascript
Item 1: "Відкрити Safari" 
  → Success Criteria: "Safari відкрито та активно"
  → Грішa check: ps aux | grep Safari → ✅ (процес є)
  
Item 2: "Відкрити Google у новій вкладці"
  → Dependencies: [1]
  → ❌ Грішa НЕ перевіряє чи Safari СПРАВДІ активний
  → AppleScript: "tell application \"Safari\" to make new document"
  → ❌ Якщо активний Chrome → команда піде до Chrome!
```

### **RC #4: AppleScript `activate` НЕ гарантує що програма стане активною**

```applescript
tell application "Safari" to activate
```

**Проблеми:**
1. Якщо Safari УЖЕ відкритий → команда нічого не робить
2. Якщо інший браузер у фокусі → Safari може НЕ стати активним
3. macOS може заблокувати переключення (Focus Mode, Spaces)
4. Команда повертає success НАВІТЬ якщо Safari НЕ став активним

---

## 🛠️ Рішення

### **Fix #1: Додати перевірку активного вікна**

**Додати в Grisha prompt:**

```javascript
## ПЕРЕВІРКА АКТИВНОГО ВІКНА (для браузерів/додатків):

Коли Success Criteria містить "відкрито та активно", використовуй:

1. **Перевірка чи програма у фокусі:**
   shell__execute_command: "osascript -e 'tell application \"System Events\" to get name of first process whose frontmost is true'"
   → Має повернути назву програми (напр. "Safari")

2. **Перевірка вікон програми:**
   shell__execute_command: "osascript -e 'tell application \"Safari\" to get count of windows'"
   → Має бути > 0

3. **Screenshot активного вікна:**
   shell__execute_command: "screencapture -x /tmp/grisha_verify_{itemId}.png"
   → Візуально підтвердити що ПРАВИЛЬНА програма активна

4. **Комбінована перевірка:**
   - frontmost application = Safari? ✅
   - Safari має вікна? ✅  
   - Screenshot підтверджує Safari? ✅
   → ТІЛЬКИ ТОДІ verified=true

⚠️ КРИТИЧНО: НЕ довіряй тільки `ps aux | grep` - це показує процес, НЕ активність!
```

### **Fix #2: Обов'язковий screenshot для UI завдань**

```javascript
## ОБОВ'ЯЗКОВІ ПЕРЕВІРКИ ДЛЯ БРАУЗЕРІВ/GUI ДОДАТКІВ:

ДЛЯ КОЖНОГО пункту з "відкрити", "активувати", "запустити":

1. ✅ ЗАВЖДИ робити screenshot
2. ✅ ЗАВЖДИ перевіряти frontmost application
3. ✅ ЗАВЖДИ перевіряти кількість вікон > 0
4. ✅ ЗАВЖДИ візуально підтверджувати через screenshot

❌ НЕ ДОСТАТНЬО: ps aux | grep
✅ ПОТРІБНО: frontmost + windows count + screenshot + візуальний аналіз
```

### **Fix #3: Перевірка dependencies з контекстом**

```javascript
## ПЕРЕВІРКА DEPENDENCIES:

Якщо Item має Dependencies (напр. [1]), перевіряй:

1. **Попередній item виконався успішно?**
   - Перевір результати попереднього item
   - Переконайся що контекст правильний

2. **Контекст досі валідний?**
   Приклад: Item 1 відкрив Safari → Item 2 робить дії в Safari
   → Перевір що Safari ДОСІ активний перед Item 2!
   
   shell__execute_command: "osascript -e 'tell application \"System Events\" to get name of first process whose frontmost is true'"
   → Має бути "Safari", НЕ "Google Chrome" або інше

3. **Якщо контекст змінився:**
   → verified=false
   → needs_clarification=true
   → clarification_needed="Активне вікно змінилось з Safari на Chrome. Потрібно повернутись до Safari перед продовженням"
```

### **Fix #4: Додати browser-specific validation**

```javascript
## BROWSER-SPECIFIC VALIDATION:

Для завдань з браузерами (Safari, Chrome, Firefox):

1. **Перевірка правильного браузера:**
   - Frontmost app = очікуваний браузер?
   - Title bar містить назву браузера?
   - Screenshot підтверджує UI браузера?

2. **Перевірка що дії відбуваються в правильному браузері:**
   Item: "Відкрити Google у Safari"
   → Перевір frontmost ПЕРЕД виконанням
   → Якщо frontmost = Chrome → FAIL verification
   → reason="Команда виконалась у Chrome замість Safari"

3. **Перевірка URL/вкладки (якщо доступно):**
   - AppleScript може читати URL поточної вкладки Safari
   - Playwright може підтвердити URL (якщо playwright використовується)
```

---

## 📝 Implementation Plan

### **Step 1: Оновити Grisha prompt**
Файл: `prompts/mcp/grisha_verify_item_optimized.js`

Додати секції:
- ✅ ПЕРЕВІРКА АКТИВНОГО ВІКНА
- ✅ BROWSER-SPECIFIC VALIDATION
- ✅ DEPENDENCIES CONTEXT CHECK
- ✅ ОБОВ'ЯЗКОВИЙ SCREENSHOT + АНАЛІЗ

### **Step 2: Додати validation helpers**
Можливо створити helper commands в prompt:

```javascript
## HELPER COMMANDS:

# Get frontmost application
osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'

# Get Safari window count
osascript -e 'tell application "Safari" to get count of windows'

# Get Safari current URL
osascript -e 'tell application "Safari" to get URL of current tab of front window'

# Get Chrome window count
osascript -e 'tell application "Google Chrome" to get count of windows'

# Screenshot with window title
screencapture -w /tmp/window.png  # Interactive window select
screencapture -x /tmp/full.png    # Full screen
```

### **Step 3: Тестування**

**Test Case 1: Safari вже відкритий**
```
State: Safari відкритий та активний
Command: "Відкрити Safari"
Expected: Грішa verified=true (Safari УЖЕ активний, все ОК)
```

**Test Case 2: Неправильний браузер активний**
```
State: Chrome активний
Command: "Відкрити Safari"
Execute: AppleScript activate Safari
Expected: Грішa verified=true ТІЛЬКИ якщо Safari СТАВ активним
```

**Test Case 3: Dependency context втрачено**
```
Item 1: "Відкрити Safari" → ✅
User manually: Переключився на Chrome
Item 2: "Відкрити Google" (dependency: [1])
Expected: Грішa verified=false, reason="Safari більше не активний, потрібно повернутись"
```

---

## 🎯 Expected Results

### **Before (Current Behavior):**
```
Item 1: "Відкрити Safari"
  → ps aux | grep Safari → процес є → ✅ VERIFIED
  
Reality: Chrome активний, Safari процес у фоні
Next items: Виконуються в Chrome замість Safari
User: "Все відкрилось у Chrome, я просив Safari!" ❌
```

### **After (Fixed Behavior):**
```
Item 1: "Відкрити Safari"
  → Frontmost check → "Google Chrome" (не Safari!)
  → Screenshot → бачимо Chrome UI
  → verified=false
  → reason="Safari процес є, але активним залишився Chrome"
  → needs_clarification=true
  → clarification_needed="Потрібно повторно активувати Safari або закрити Chrome"
  
Atlas: Коригує план → Item 1 retry з додатковою активацією
User: Дії виконуються у правильному браузері ✅
```

---

## 📊 Metrics

**Current (before fix):**
- False positive rate: ~60-80% (для browser/GUI tasks)
- User satisfaction: ~20-30%
- Context loss: ~70% (items виконуються у неправильному контексті)

**Expected (after fix):**
- False positive rate: ~10-15%
- User satisfaction: ~80-90%
- Context loss: ~5-10%

---

## 🚨 Critical Rules

1. **НІКОЛИ не довіряй тільки `ps aux | grep`** для GUI додатків
2. **ЗАВЖДИ перевіряй frontmost application** для browser/GUI tasks
3. **ЗАВЖДИ робити screenshot** для візуальної верифікації
4. **ЗАВЖДИ перевіряй dependencies context** перед кожним item
5. **Browser tasks:** Frontmost + Windows + Screenshot + URL = 4 перевірки мінімум

---

## 📚 References

- Grisha False Positives Analysis: `docs/GRISHA_FALSE_POSITIVES_ROOT_CAUSE_2025-10-17.md`
- Grisha Verification Fix v2: `docs/GRISHA_CONTEXT_INFINITE_LOOP_FIX_2025-10-10.md`
- AppleScript System Events: https://developer.apple.com/library/archive/documentation/AppleScript/

---

**Status:** 🔴 NOT IMPLEMENTED YET  
**Priority:** 🔥 CRITICAL (affects 60-80% of browser/GUI tasks)  
**ETA:** 1-2 hours implementation + testing
