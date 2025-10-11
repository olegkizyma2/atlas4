# Grisha Vision Tools Fix - 10.10.2025 (22:30)

## 🔴 Проблема

**Симптом:** Гриша НЕ з'являвся в чаті після перевірки завдань, користувач бачив тільки "✅ Завдання виконано" без вердикту Гриші.

**Корінь проблеми:**

### 1. Crash через недоступні Vision Tools
Гриша намагався використати `developer__screen_capture` для перевірки калькулятора:

```log
[GOOSE] Tool request: developer__screen_capture
[GOOSE] Tool developer__screen_capture is not available in current extensions configuration
[GOOSE] Error: missing required Copilot-Vision-Request header for vision requests (status 400)
[GOOSE] Did not provide response - NO FALLBACK
```

**Чому це відбувалось:**
- Промпт Гриші в розділі "ЯК ПЕРЕВІРЯТИ" рекомендував `playwright.browser_take_screenshot` для калькулятора
- Goose Desktop НЕ має Copilot Vision API (потрібен спеціальний header)
- Vision tools (screen_capture, screenshot) НЕДОСТУПНІ в поточній конфігурації
- При спробі використання → crash → порожня відповідь

### 2. Silent Auto-Approval
Коли Гриша крашив, система автоматично підтверджувала завдання **БЕЗ повідомлення користувачу**:

```javascript
// Було (executor-v3.js):
if (currentStage === 7) {
  logger.warn(`Grisha verification failed - auto-approving task completion`);
  
  const autoApprovalResponse = {
    content: '✅ Завдання виконано',
    agent: 'system',
    stage: 8,
    metadata: { autoApproved: true }
  };
  
  res.write(`data: ${JSON.stringify({ type: 'agent_message', data: autoApprovalResponse })}\n\n`);
  // НЕ відправлялось повідомлення про помилку Гриші!
}
```

**Результат:** Користувач бачив тільки "✅ Завдання виконано", НЕ знав що Гриша крашнув і перевірка НЕ відбулась.

## ✅ Рішення

### 1. Оновлено промпт Гриші - видалено Vision Tools

**Файл:** `prompts/grisha/stage7_verification.js`

**Було:**
```javascript
ЯК ПЕРЕВІРЯТИ (КОНКРЕТНІ ДІЇ):
1. Завдання про браузер/YouTube → playwright.browser_take_screenshot (ОСНОВНИЙ СПОСІБ)
2. Завдання про файли → developer.shell "cat filename" або "ls -la"
3. Завдання про процеси → developer.shell "ps aux | grep process"
4. Завдання про калькулятор → developer.list_windows (знайди вікно), за потреби playwright.browser_take_screenshot
```

**Стало:**
```javascript
ЯК ПЕРЕВІРЯТИ (КОНКРЕТНІ ДІЇ):
1. Завдання про файли → developer.shell "cat filename" або "ls -la"
2. Завдання про процеси → developer.shell "ps aux | grep process"
3. Завдання про вікна/програми → developer.list_windows (перевір чи відкрито програму)
4. Завдання про браузер → developer.shell "pgrep -fl 'Chrome|Firefox|Safari'" (перевір процес)

⚠️ ВАЖЛИВО: Vision/screenshot tools НЕДОСТУПНІ в цій конфігурації!
ПЕРЕВІРЯЙ через: list_windows (програми), shell commands (файли/процеси), computercontroller (GUI стан)
```

**Оновлено приклад:**
```javascript
ПРИКЛАД ПРАВИЛЬНОЇ РОБОТИ:
→ Використовую developer.list_windows для перевірки калькулятора...
→ Результат: знайдено вікно "Calculator" у списку активних програм
→ Вердикт: Завдання виконано. Калькулятор відкрито та активний. Перевірено list_windows.
```

**Додано заборону в USER_PROMPT:**
```javascript
⚠️ ЗАБОРОНЕНО: developer__screen_capture, playwright screenshot - вони КРАШАТЬ систему!
```

### 2. Додано повідомлення про помилку Гриші

**Файл:** `orchestrator/workflow/executor-v3.js`

**Тепер при краші Гриші:**
1. ✅ Відправляється **повідомлення від Гриші** про помилку
2. ✅ Потім відправляється auto-approval з поясненням
3. ✅ Користувач **бачить** що Гриша не зміг перевірити

```javascript
if (currentStage === 7) {
  logger.warn(`Grisha verification failed - auto-approving task completion`);

  // НОВИЙ КОД: Inform user about verification error
  const errorNotification = {
    role: 'assistant',
    content: '⚠️ Гриша не зміг перевірити виконання через технічну помилку. Автоматично підтверджую завершення на основі звіту Тетяни.',
    agent: 'grisha',
    stage: 7,
    timestamp: Date.now(),
    metadata: {
      verificationFailed: true,
      error: stageError.message
    }
  };

  if (res.writable && !res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type: 'agent_message', data: errorNotification })}\n\n`);
  }

  session.history.push(errorNotification);

  // Потім auto-approval...
}
```

## 📊 Результат

### До виправлення:
1. ❌ Гриша крашив через `developer__screen_capture`
2. ❌ Користувач НЕ бачив повідомлення від Гриші
3. ❌ Тільки "✅ Завдання виконано" без пояснень
4. ❌ Незрозуміло чому немає перевірки

### Після виправлення:
1. ✅ Гриша використовує ДОСТУПНІ інструменти (list_windows, shell, computercontroller)
2. ✅ При помилці користувач бачить повідомлення від Гриші: "⚠️ Гриша не зміг перевірити виконання через технічну помилку..."
3. ✅ Зрозуміло що перевірка не відбулась через технічну проблему
4. ✅ Auto-approval обгрунтований ("на основі звіту Тетяни")

## 🧪 Тестування

### Перевірка доступних інструментів:
```bash
# Гриша тепер має використовувати:
- developer.list_windows          # Для перевірки відкритих програм
- developer.shell "ls -la"        # Для файлів
- developer.shell "ps aux | grep" # Для процесів
- computercontroller              # Для GUI стану

# НЕ використовує (КРАШАТЬ):
- developer__screen_capture       # ❌ Немає Vision API
- playwright.browser_take_screenshot # ❌ Те саме
```

### Очікувана поведінка при краші:
```
[USER] Відкрий калькулятор і набер 666

[ATLAS] Тетяна, завдання наступне: ...

[ТЕТЯНА] Готово. Калькулятор відкрито...

[ГРИША] ⚠️ Гриша не зміг перевірити виконання через технічну помилку. 
        Автоматично підтверджую завершення на основі звіту Тетяни.

[SYSTEM] ✅ Завдання виконано
```

## 📝 Виправлені файли

1. **`prompts/grisha/stage7_verification.js`**
   - Видалено всі посилання на Vision/screenshot tools
   - Оновлено "ЯК ПЕРЕВІРЯТИ" з доступними інструментами
   - Додано категоричну заборону screenshot tools в USER_PROMPT
   - Оновлено приклади використання

2. **`orchestrator/workflow/executor-v3.js`**
   - Додано повідомлення про помилку перевірки від Гриші
   - Зберігається в session.history
   - Відправляється в SSE stream перед auto-approval

## 🔍 Діагностика

### Перевірка що Гриша використовує правильні інструменти:
```bash
grep "Tool request:" logs/orchestrator.log | grep -E "grisha|stage 7"

# Правильно: list_windows, shell
# Неправильно: screen_capture, screenshot
```

### Перевірка повідомлень про помилку:
```bash
grep "не зміг перевірити виконання" logs/orchestrator.log

# Має з'являтися при краші Гриші
```

## 🎯 Висновок

**Проблема:** Гриша крашив через недоступні Vision tools, користувач НЕ бачив помилки.

**Рішення:**
1. ✅ Видалено Vision tools з промптів Гриші
2. ✅ Додано доступні альтернативи (list_windows, shell commands)
3. ✅ Додано інформативне повідомлення при краші
4. ✅ Користувач тепер розуміє що перевірка не відбулась

**Результат:** Прозорість workflow + менше крашів через правильні інструменти.
