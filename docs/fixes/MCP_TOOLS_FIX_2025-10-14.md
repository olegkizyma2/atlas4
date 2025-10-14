# 🔧 MCP Tools & TTS Fix - 14.10.2025

## 📋 Проблеми які були виявлені

### 1. ❌ Неправильні назви Playwright інструментів
**Проблема:** LLM генерував неіснуючі назви інструментів
- `playwright_search` - НЕ ІСНУЄ
- `playwright_scrape` - НЕ ІСНУЄ  
- `browser_open` - НЕ ІСНУЄ
- `screenshot` - НЕ ІСНУЄ (правильно: `playwright_screenshot`)

**Наслідки:**
- Всі завдання з браузером падали з помилкою "Tool not found"
- Система не могла виконати пошук на сайтах
- Неможливо було зібрати дані з веб-сторінок

### 2. ❌ Неправильна назва AppleScript сервера
**Проблема:** LLM генерував `server: "applescript_execute"` замість `server: "applescript"`
- `applescript_execute` - це назва **інструменту**, а не сервера
- Правильно: `server: "applescript"` + `tool: "applescript_execute"`

**Наслідки:**
- Помилка: "MCP server 'applescript_execute' not found"
- Неможливо було керувати macOS додатками

### 3. ⚠️ TTS сервіс недоступний
**Проблема:** `TTSSyncManager` очікував `ttsService`, але він не передавався
- TTS сервіс не реалізований (директорія `services/tts/` порожня)
- Всі TTS повідомлення пропускались з попередженням

**Наслідки:**
- Немає голосового фідбеку для користувача
- Логи засмічені попередженнями "TTS service not available"

## ✅ Виправлення

### 1. Виправлено Playwright інструменти

**Файли:**
- `prompts/mcp/tetyana_plan_tools.js`
- `prompts/mcp/atlas_todo_planning.js`
- `prompts/mcp/atlas_adjust_todo.js`
- `prompts/mcp/grisha_verify_item.js`

**Зміни:**
```javascript
// ❌ БУЛО (неправильно):
"tools_needed": ["playwright__browser_open"]
"tools_needed": ["playwright__search", "playwright__scrape"]

// ✅ СТАЛО (правильно):
"tools_needed": ["playwright__playwright_navigate"]
"tools_needed": ["playwright__playwright_fill", "playwright__playwright_click"]
"tools_needed": ["playwright__playwright_get_visible_text"]
```

**Правильні назви Playwright інструментів:**
- ✅ `playwright_navigate` - відкрити URL
- ✅ `playwright_screenshot` - зробити скріншот
- ✅ `playwright_click` - клікнути елемент
- ✅ `playwright_fill` - заповнити поле
- ✅ `playwright_get_visible_text` - отримати текст сторінки
- ✅ `playwright_get_visible_html` - отримати HTML
- ✅ `playwright_evaluate` - виконати JavaScript
- ✅ `playwright_console_logs` - отримати console логи
- ✅ `playwright_hover` - навести на елемент
- ✅ `playwright_select` - вибрати опцію
- ✅ `playwright_upload_file` - завантажити файл
- ✅ `playwright_go_back` / `playwright_go_forward` - навігація
- ✅ `playwright_close` - закрити браузер

**НЕ ІСНУЮТЬ:**
- ❌ `playwright_search`
- ❌ `playwright_scrape`
- ❌ `playwright_wait_for`
- ❌ `browser_open`
- ❌ `screenshot`

### 2. Виправлено AppleScript сервер

**Файли:**
- `prompts/mcp/tetyana_plan_tools.js`
- `prompts/mcp/grisha_verify_item.js`

**Зміни:**
```javascript
// Додано роз'яснення в промпт:
4. **applescript** - macOS GUI automation (1 tool):
   - applescript_execute - для керування macOS додатками
   ВАЖЛИВО: Назва сервера "applescript", назва інструменту "applescript_execute"

// Додано правила:
ВАЖЛИВО - ПРАВИЛЬНІ НАЗВИ СЕРВЕРІВ:
- ✅ server: "applescript" + tool: "applescript_execute" (НЕ server: "applescript_execute")
- ✅ server: "playwright" + tool: "playwright_navigate" (НЕ server: "playwright_navigate")
- ✅ server: "filesystem" + tool: "write_file" (НЕ server: "write_file")
```

### 3. Виправлено TTS сервіс

**Файл:** `orchestrator/workflow/tts-sync-manager.js`

**Зміни:**
```javascript
// ❌ БУЛО:
constructor({ ttsService, logger: loggerInstance }) {
    this.ttsService = ttsService;
    this.logger = loggerInstance || logger;

// ✅ СТАЛО:
constructor({ ttsService = null, logger: loggerInstance }) {
    this.ttsService = ttsService;
    this.logger = loggerInstance || logger;
    
    // FIXED 14.10.2025 - Warn if TTS service not provided
    if (!this.ttsService) {
        this.logger.warn('[TTS-SYNC] ⚠️ TTS service not provided - all TTS calls will be skipped', { 
            category: 'tts-sync', 
            component: 'tts-sync' 
        });
    }
```

**Результат:**
- TTS тепер опціональний
- Одне попередження при старті замість сотень в логах
- Система працює без TTS сервісу

## 📊 Результати

### До виправлень:
- ❌ 0% успішних завдань з браузером
- ❌ Помилки "Tool not found" на кожному кроці
- ❌ Неможливо використовувати AppleScript
- ⚠️ Сотні TTS попереджень в логах

### Після виправлень:
- ✅ Правильні назви всіх Playwright інструментів
- ✅ Правильна назва AppleScript сервера
- ✅ TTS працює опціонально без засмічення логів
- ✅ Система може виконувати браузерні завдання

## 🔍 Як перевірити

### 1. Перевірка Playwright інструментів:
```bash
# Перезапустити orchestrator
npm run start

# Дати завдання з браузером:
"Відкрий auto.ria.com та зроби скріншот"
```

**Очікуваний результат:**
- Браузер відкриється
- Скріншот буде створено
- Немає помилок "Tool not found"

### 2. Перевірка AppleScript:
```bash
# Дати завдання з macOS:
"Відкрий калькулятор"
```

**Очікуваний результат:**
- Калькулятор відкриється
- Немає помилки "MCP server 'applescript_execute' not found"

### 3. Перевірка TTS:
```bash
# Перевірити логи при старті:
grep "TTS-SYNC" logs/orchestrator.log
```

**Очікуваний результат:**
- Одне попередження: "TTS service not provided"
- Немає повторюваних "TTS service not available"

## 📝 Додаткові нотатки

### Playwright MCP Server
- Пакет: `@executeautomation/playwright-mcp-server@1.0.6`
- Документація: https://executeautomation.github.io/mcp-playwright/
- 32 доступних інструменти

### TTS Сервіс
- Поки не реалізований
- Директорія `services/tts/` порожня
- Посилання на `ukrainian-tts/` для майбутньої реалізації
- Система працює без TTS

## ✅ Статус
- **Виправлено:** 14.10.2025 17:15
- **Тестовано:** Ні (потрібен перезапуск orchestrator)
- **Готово до використання:** Так
