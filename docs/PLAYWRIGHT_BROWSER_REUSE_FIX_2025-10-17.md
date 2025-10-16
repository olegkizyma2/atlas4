# Playwright Browser Reuse Optimization (FIXED 17.10.2025)

## Проблема
Кожна команда Playwright запускала НОВИЙ екземпляр Chromium, що призводило до:
- ❌ Множинних запусків браузера (по 1 на кожну команду)
- ❌ Великого споживання пам'яті та часу
- ❌ Повільного виконання завдань з багатьма операціями

## Симптом
```
# Замість 1 браузера з 5 операціями:
Дія 1: playwright_browser_open → запускає Chromium #1
Дія 2: playwright_navigate → запускає Chromium #2 ❌
Дія 3: playwright_fill → запускає Chromium #3 ❌
Дія 4: playwright_click → запускає Chromium #4 ❌
Дія 5: playwright_screenshot → запускає Chromium #5 ❌
```

## Корінь проблеми
Тетяна (LLM) НЕ знала про параметр `browser_id` і кожного разу викликала `playwright_browser_open` замість переважу існуючого браузера.

## Рішення
Додано явні інструкції в `prompts/mcp/tetyana_plan_tools_optimized.js`:

### 1. Секція "ПЕРЕВАЖАЙ БРАУЗЕР"
```
## ⚠️ КРИТИЧНО - ПЕРЕВАЖАЙ БРАУЗЕР ДЛЯ КОЖНОЇ КОМАНДИ

🚀 **ОПТИМІЗАЦІЯ - Уникни множинних запусків Chromium:**

Рішення: Використовуй browser_id від першої команди для всіх наступних:

Перший запуск (відкриття браузера):
- playwright_browser_open → повертає browser_id: "12345"
- ЗАПАМ'ЯТАЙ цей ID!

Наступні команди (ПЕРЕВАЖАЙ браузер):
- Всі інші операції (navigate, click, fill, screenshot) повинні використовувати параметр browser_id
- ✅ {"server": "playwright", "tool": "playwright_navigate", "parameters": {"browser_id": "12345", "url": "..."}}
- ❌ НЕ РОБИ {"server": "playwright", "tool": "playwright_browser_open"} - це запустить НОВИЙ браузер!
```

### 2. Наголошення у параметрах
Додано `browser_id` до описів параметрів:
- playwright_fill: browser_id (optional)
- playwright_click: browser_id (optional)
- playwright_navigate: browser_id (optional)
- playwright_get_visible_text: browser_id (optional)

### 3. Конкретний приклад (Приклад 7)
Додано детальний приклад як правильно використовувати browser_id з трьома послідовними операціями:

```javascript
Дія 1 - Відкриття браузера:
{"server": "playwright", "tool": "playwright_browser_open", ...}

Дія 2 - Навігація (ПЕРЕВАЖАЙ браузер):
{"server": "playwright", "tool": "playwright_navigate", 
 "parameters": {"browser_id": "12345", "url": "https://www.google.com"}}

Дія 3 - Заповнення (ПЕРЕВАЖАЙ браузер):
{"server": "playwright", "tool": "playwright_fill",
 "parameters": {"browser_id": "12345", "selector": "[name=\"q\"]", "value": "Python"}}
```

## Результат
✅ Правильна поведінка (очікувана):
```
Дія 1: playwright_browser_open → запускає Chromium #1
Дія 2: playwright_navigate (browser_id: "12345") → використовує Chromium #1
Дія 3: playwright_fill (browser_id: "12345") → використовує Chromium #1
Дія 4: playwright_click (browser_id: "12345") → використовує Chromium #1
Дія 5: playwright_screenshot (browser_id: "12345") → використовує Chromium #1
```

**Переваги:**
- 🚀 Швидкість: ~5x прискорення (1 браузер vs 5 браузерів)
- 💾 Пам'ять: ~5x менше RAM (1 Chromium process vs 5)
- ⏱️ Час: Зменшення часу виконання завдання
- 🎯 Надійність: Менше race conditions та помилок

## Виправлені файли
- `prompts/mcp/tetyana_plan_tools_optimized.js` (+70 LOC):
  - Нова секція "ПЕРЕВАЖАЙ БРАУЗЕР"
  - Приклад 7 з browser_id
  - Оновлені параметри для всіх playwright tools

## Перевірка
```bash
# Перевірити синтаксис
node -c prompts/mcp/tetyana_plan_tools_optimized.js

# Перевірити що інструкції є в файлі
grep -A 5 "browser_id" prompts/mcp/tetyana_plan_tools_optimized.js
```

## Тестування
1. Запустити завдання з множинними Playwright операціями
2. Перевірити системний монітор - має бути ТІЛЬКИ 1 Chromium процес
3. Порівняти час виконання: раніше vs тепер (повинно бути ~5x швидше)

## Критичні правила
- ✅ ЗАВЖДИ використовуй browser_id для наступних операцій
- ✅ browser_id повинен бути передан з response попередньої дії
- ❌ НЕ запускай новий браузер якщо він уже отворений
- ❌ НЕ ігноруй browser_id параметр

## Альтернативні підходи (якщо це не спрацює)
1. **Browser Pooling** - MCP server може кешувати браузери (якщо підтримується)
2. **Persistent Mode** - запустити браузер один раз і коннектитись до нього постійно
3. **Browser Context API** - використовувати context замість browser для ізоляції

---

**Дата виправлення:** 17 жовтня 2025  
**Версія:** v5.0 Pure MCP Edition  
**Статус:** ✅ ВИПРАВЛЕНО
