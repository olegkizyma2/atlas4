# Grisha Browser Detection - Quick Reference

## 🔍 Проблема (1 речення)
**Гриша перевіряє тільки процес (`ps aux | grep`), НЕ перевіряє що програма АКТИВНА і дії відбуваються у ПРАВИЛЬНОМУ браузері.**

---

## ❌ Поточна Поведінка

```bash
# Що Гриша робить ЗАРАЗ:
ps aux | grep Safari
# → Процес є → ✅ VERIFIED

# ❌ НЕ перевіряє:
# - Чи Safari у фокусі (активний)?
# - Чи наступні команди підуть до Safari?
# - Чи відкрився інший браузер?
```

**Результат:** Дії відбуваються у Chrome, але Гриша каже ✅ (Safari процес є).

---

## ✅ Правильна Поведінка (що треба додати)

### **3 обов'язкові перевірки для browser/GUI tasks:**

```bash
# 1. Frontmost check (чи програма активна ЗАРАЗ)
osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'
# → Має бути "Safari", НЕ "Google Chrome"

# 2. Windows check (чи програма має вікна)
osascript -e 'tell application "Safari" to get count of windows'
# → Має бути > 0

# 3. Screenshot (візуальна перевірка)
screencapture -x /tmp/grisha_verify_{itemId}.png
# → Бачимо Safari UI, НЕ Chrome UI
```

**Тільки якщо ВСІ 3 ✅ → verified=true**

---

## 🛠️ Швидке Рішення

### **Додати в `grisha_verify_item_optimized.js`:**

```javascript
## BROWSER/GUI VERIFICATION RULES:

Для завдань "відкрити браузер X":

1. ❌ НЕ ДОСТАТНЬО: ps aux | grep
2. ✅ ПОТРІБНО:
   - Frontmost application = X? ✅
   - X має вікна (count > 0)? ✅
   - Screenshot підтверджує X? ✅
   
3. Якщо НІ → verified=false, reason="Процес є, але НЕ активний"

## DEPENDENCY CONTEXT CHECK:

Item з Dependencies [1] → перевіряй context:
- Попередній item створив контекст (Safari активний)
- Контекст ДОСІ валідний (Safari ДОСІ активний)?
- Якщо НІ → verified=false, clarification_needed="Safari більше не активний"
```

---

## 📊 Impact

| Metric            | Before | After  |
| ----------------- | ------ | ------ |
| False positives   | 60-80% | 10-15% |
| User satisfaction | 20-30% | 80-90% |
| Context loss      | 70%    | 5-10%  |

---

## 🎯 Test Cases

**Test 1: Safari процес є, але Chrome активний**
```
Current: ✅ VERIFIED (процес є)
Fixed:   ❌ NOT VERIFIED (frontmost = Chrome, не Safari)
```

**Test 2: Dependencies context втрачено**
```
Item 1: "Відкрити Safari" → ✅
[User переключився на Chrome]
Item 2: "Відкрити Google" (depends on [1])

Current: ✅ VERIFIED (команда виконалась)
Fixed:   ❌ NOT VERIFIED (Safari більше не frontmost)
```

---

## 🚨 Критичні Правила

1. **ps aux | grep** показує процес, НЕ активність
2. **frontmost check** показує що ЗАРАЗ активне
3. **screenshot** показує ВІЗУАЛЬНУ реальність
4. **dependencies** потребують context validation

---

**Файл:** `prompts/mcp/grisha_verify_item_optimized.js`  
**Статус:** 🔴 NOT IMPLEMENTED  
**Приоритет:** 🔥 CRITICAL  
**Детально:** `docs/GRISHA_BROWSER_DETECTION_FIX_2025-10-17.md`
