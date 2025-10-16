# Grisha Static Screenshot Enhancement

**Дата:** 17 жовтня 2025  
**Версія:** 4.0.2  
**Компонент:** Grisha Verification System  
**Статус:** ✅ IMPLEMENTED

---

## 📋 ОГЛЯД

Покращено систему верифікації Гриші - тепер використовує **ТІЛЬКИ СТАТИЧНІ інструменти** для screenshot замість динамічних MCP tools.

---

## ❌ ПРОБЛЕМА

### До виправлення:
Гриша міг використовувати `playwright__screenshot` для верифікації, що:
- **Динамічно впливає** на стан браузера
- **Може змінювати** UI елементи
- **НЕ гарантує** чистої перевірки реального стану

### Запит користувача:
> "Потрібно робити скрін на кожному етапі... скріншот має робитися статичним інструментом, як варіант apple script... щоб мати завжди живі реальні інструменти"

---

## ✅ РІШЕННЯ

### 1. Статичний інструмент для screenshot

Гриша тепер використовує **macOS `screencapture`** через `shell__execute_command`:

```bash
# Весь екран
screencapture -x /tmp/grisha_verify_ITEMID.png

# Окрема програма (калькулятор)
screencapture -l$(osascript -e 'tell application "Calculator" to id of window 1') /tmp/calc.png

# Головний дисплей
screencapture -xm /tmp/main_screen.png

# З курсором
screencapture -C /tmp/desktop.png
```

### 2. Заборона динамічних інструментів

**Промпт Гриші тепер містить:**

```javascript
4. **⚠️ КРИТИЧНО - ОБОВ'ЯЗКОВИЙ SCREENSHOT ДЛЯ КОЖНОГО ПУНКТУ:**
   - ЗАВЖДИ використовуй screenshot для візуальної перевірки
   - **ТІЛЬКИ СТАТИЧНИЙ ІНСТРУМЕНТ:** shell__execute_command з "screencapture -x /tmp/grisha_verify_{itemId}.png"
   - ❌ НЕ ВИКОРИСТОВУЙ playwright__screenshot (динамічний, може впливати на стан системи)
   - ✅ ВИКОРИСТОВУЙ тільки shell screencapture (статичний, не змінює стан)
```

### 3. Детальні інструкції для різних типів скріншотів

Промпт містить 4 варіанти screencapture з описом коли використовувати:

1. **Весь екран** - для загальної перевірки (файли на Desktop, тощо)
2. **Окрема програма** - для перевірки результату в конкретній програмі (Calculator, браузер)
3. **Головний дисплей** - якщо є кілька моніторів
4. **З курсором** - якщо важливо де вказує користувач

### 4. Приклади використання

**Файл на Desktop:**
```javascript
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -x /tmp/verify_desktop.png"
      }
    }
  ]
}
```

**Калькулятор результат:**
```javascript
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -l$(osascript -e 'tell application \"Calculator\" to id of window 1') /tmp/calc_result.png"
      }
    }
  ]
}
```

---

## 📊 ПЕРЕВАГИ

### 1. ✅ Статичність
- **Не змінює** стан системи
- **Пасивний** інструмент
- **Гарантує** реальний стан

### 2. ✅ Гнучкість
- **4 режими** screencapture
- **Захоплення окремих вікон** через AppleScript
- **Контроль над дисплеями**

### 3. ✅ Надійність
- **Нативний macOS** інструмент
- **Швидкий** (без запуску браузера)
- **Працює завжди** (не залежить від Playwright)

### 4. ✅ Інші tools доступні
- Гриша може використовувати **ВСІ інші MCP tools**:
  - `filesystem__read_file` - перевірка вмісту файлів
  - `shell__execute_command` - системні перевірки (ps, cat, ls)
  - `git__status` - перевірка git стану
  - `memory__retrieve` - перевірка збережених даних
- **Тільки screenshot** статичний, решта - динамічні

---

## 🔍 ПРИКЛАДИ ВЕРИФІКАЦІЇ

### Приклад 1: Файл створено на Desktop

**Success Criteria:** "Файл test.txt створено на Desktop"

**Execution Results:**
```json
[{"tool": "write_file", "success": true, "path": "~/Desktop/test.txt"}]
```

**Verification:**
```json
{
  "verified": true,
  "reason": "Screenshot підтверджує наявність файлу на Desktop",
  "evidence": {
    "tool_used": "shell_screencapture",
    "command": "screencapture -x /tmp/verify_desktop.png",
    "visual_confirmed": true
  },
  "from_execution_results": false
}
```

### Приклад 2: Калькулятор показує результат 666

**Success Criteria:** "Калькулятор показує результат 666"

**Execution Results:**
```json
[{"tool": "applescript_execute", "success": true}]
```

**Verification:**
```json
{
  "verified": true,
  "reason": "Screenshot вікна калькулятора показує правильний результат",
  "evidence": {
    "tool_used": "shell_screencapture",
    "command": "screencapture -l$(osascript -e 'tell application \"Calculator\" to id of window 1') /tmp/calc_result.png",
    "target": "Calculator window",
    "visual_match": true
  },
  "from_execution_results": false,
  "tts_phrase": "Підтверджено"
}
```

### Приклад 3: Браузер на google.com

**Success Criteria:** "Браузер відкрито на google.com"

**Execution Results:**
```json
[{"tool": "playwright_navigate", "success": true, "url": "https://google.com"}]
```

**Verification:**
```json
{
  "verified": true,
  "reason": "Screenshot показує браузер на google.com",
  "evidence": {
    "tool_used": "shell_screencapture",
    "command": "screencapture -x /tmp/verify_browser.png",
    "visual_confirmed": true
  },
  "from_execution_results": false
}
```

---

## 📝 ВИПРАВЛЕНІ ФАЙЛИ

### `/Users/dev/Documents/GitHub/atlas4/prompts/mcp/grisha_verify_item_optimized.js`

**Зміни:**
1. ✅ Додано секцію "СТАТИЧНІ ІНСТРУМЕНТИ ДЛЯ SCREENSHOT" (~45 LOC)
2. ✅ Оновлено правило #4 - тільки `shell__execute_command` з screencapture
3. ✅ Оновлено Приклади 4, 5 - використання screencapture замість playwright
4. ✅ Оновлено "ПРОЦЕС ВЕРИФІКАЦІЇ" - явна заборона playwright для screenshot
5. ✅ Додано 4 варіанти screencapture з описом
6. ✅ Додано приклади для різних завдань

**LOC зміни:** +60 LOC (189 → 249 LOC)

---

## 🎯 КРИТИЧНІ ПРАВИЛА

### ДЛЯ ГРИШІ:

1. ✅ **Screenshot ОБОВ'ЯЗКОВИЙ** для кожного пункту верифікації
2. ✅ **Використовувати ТІЛЬКИ** `shell__execute_command` з `screencapture`
3. ❌ **НЕ використовувати** `playwright__screenshot` (динамічний інструмент)
4. ✅ **Обирати правильний варіант** screencapture залежно від завдання:
   - Файл на Desktop → весь екран
   - Результат в програмі → вікно програми
   - Загальний стан → головний дисплей
5. ✅ **Всі інші MCP tools** (filesystem, git, memory) можна використовувати без обмежень

### ДЛЯ ТЕТЯНИ:

- Тетяна **може використовувати** `playwright__screenshot` для виконання завдань
- Тетяна **використовує динамічні tools** для автоматизації
- Різниця: Тетяна виконує, Гриша перевіряє

---

## 🔄 WORKFLOW

```
Atlas створює TODO
  ↓
Тетяна планує tools (Stage 2.1)
  ↓
Тетяна робить screenshot ПЕРЕД виконанням (Stage 2.1.5)
  ↓ (може коригувати план на основі screenshot)
Тетяна виконує tools (Stage 2.2) - МОЖЕ використовувати playwright__screenshot
  ↓
Гриша верифікує (Stage 2.3) - ЗАВЖДИ використовує shell screencapture (СТАТИЧНИЙ)
  ↓ (аналізує screenshot + execution results)
verified=true → наступний item
verified=false → Atlas коригує (Stage 3)
```

---

## 🧪 ТЕСТУВАННЯ

### Сценарій 1: Файл на Desktop
```bash
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Створи файл test.txt на Desktop з текстом Hello ATLAS",
    "sessionId": "test"
  }'
```

**Очікувана перевірка Гриші:**
- Screenshot всього екрану (`screencapture -x /tmp/verify_desktop.png`)
- Аналіз: файл видно на Desktop
- `verified=true`

### Сценарій 2: Калькулятор результат
```bash
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Відкрий калькулятор та обчисли 22×30.27",
    "sessionId": "test"
  }'
```

**Очікувана перевірка Гриші:**
- Screenshot вікна калькулятора (`screencapture -l$(osascript...)`)
- Аналіз: результат правильний
- `verified=true`

---

## 📚 ДЕТАЛЬНА ДОКУМЕНТАЦІЯ

### screencapture синтаксис:

```bash
screencapture [options] file

Options:
  -x            Без звуку
  -m            Тільки головний дисплей
  -C            Включити курсор
  -l <windowid> Конкретне вікно
  -T <seconds>  Затримка перед захопленням
```

### AppleScript для window ID:

```applescript
tell application "Calculator" to id of window 1
```

Повертає ID вікна для використання з `-l` option.

---

## 🎓 НАВЧАННЯ LLM

**Промпт тепер навчає Гришу:**

1. **Розрізняти** статичні vs динамічні інструменти
2. **Вибирати** правильний варіант screencapture
3. **Комбінувати** screenshot з іншими MCP tools (cat, ps, read_file)
4. **Аналізувати** візуальні докази
5. **Формувати** JSON з доказами

**Ключові фрази в промпті:**
- "ТІЛЬКИ СТАТИЧНИЙ ІНСТРУМЕНТ"
- "НЕ ВИКОРИСТОВУЙ playwright__screenshot"
- "screencapture - пасивний, статичний інструмент"
- "Всі інші MCP tools Гриша може використовувати"

---

## ✅ РЕЗУЛЬТАТ

### Що досягнуто:

1. ✅ **Гриша використовує статичний screencapture** замість динамічного playwright
2. ✅ **Детальні інструкції** для 4 варіантів screencapture
3. ✅ **Приклади** для різних типів завдань
4. ✅ **Чітка заборона** playwright__screenshot для верифікації
5. ✅ **Збережено доступ** до всіх інших MCP tools

### Переваги:

- 🎯 **Точність:** Реальний стан системи без впливу
- ⚡ **Швидкість:** Нативний macOS інструмент
- 🔒 **Надійність:** Завжди працює, не залежить від браузера
- 🎨 **Гнучкість:** 4 варіанти для різних сценаріїв
- 🛠️ **Інші tools:** Гриша може використовувати решту MCP tools

---

## 🔮 МАЙБУТНІ ПОКРАЩЕННЯ

### Потенційні розширення:

1. **Video recording** - screencapture може робити відео (future)
2. **OCR analysis** - автоматичне розпізнавання тексту на screenshot
3. **Visual diff** - порівняння screenshot before/after
4. **Window detection** - автоматичне визначення ID вікна

### Альтернативні статичні інструменти:

- `osascript` - для GUI automation (вже доступно через applescript MCP)
- `defaults` - для перевірки системних налаштувань
- `mdfind` - для пошуку файлів (Spotlight)

---

## 📖 RELATED DOCUMENTATION

- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md` - Загальна архітектура MCP workflow
- `docs/GRISHA_VERIFICATION_CRASH_FIX_2025-10-16.md` - Попередні виправлення Гриші
- `docs/SCREENSHOT_AND_ADJUSTMENT_FEATURE_2025-10-16.md` - Тетяна screenshot before execution
- `prompts/mcp/grisha_verify_item_optimized.js` - Промпт з новими інструкціями

---

**BOTTOM LINE:** Гриша тепер використовує **ТІЛЬКИ статичний screencapture** для верифікації, що гарантує чисту перевірку реального стану системи без динамічного впливу. Всі інші MCP tools залишаються доступними.
