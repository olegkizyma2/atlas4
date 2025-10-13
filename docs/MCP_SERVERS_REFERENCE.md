# MCP Servers Reference - ATLAS System

**Версія:** 1.1.0  
**Дата:** 2025-10-13  
**Конфігурація:** `config/global-config.js` → `AI_BACKEND_CONFIG.providers.mcp.servers`

---

## 📦 Список MCP Серверів

ATLAS використовує **4 MCP сервери** для виконання завдань:

### 1. **Filesystem Server** 🗂️

**Package:** `@modelcontextprotocol/server-filesystem`

**Функції:**
- Створення файлів (`fs.writeFile`)
- Читання файлів (`fs.readFile`)
- Створення директорій (`fs.mkdir`)
- Видалення файлів/директорій (`fs.unlink`, `fs.rmdir`)
- Копіювання та переміщення файлів
- Перевірка існування файлів (`fs.exists`)
- Отримання метаданих файлів (`fs.stat`)

**Дозволені директорії:**
```javascript
ALLOWED_DIRECTORIES: '/Users,/tmp,/Desktop,/Applications'
```

**Команда запуску:**
```bash
npx -y @modelcontextprotocol/server-filesystem
```

**Use Cases:**
- ✅ "Створи файл test.txt на Desktop"
- ✅ "Прочитай вміст файлу ~/Documents/notes.txt"
- ✅ "Видали файл /tmp/cache.json"
- ✅ "Створи директорію ~/Projects/NewApp"

**Обмеження:**
- ❌ Доступ тільки до ALLOWED_DIRECTORIES
- ❌ Не може виконувати системні команди
- ❌ Не має root прав

---

### 2. **Playwright MCP Server** 🌐

**Package:** `@executeautomation/playwright-mcp-server`

**Функції:**
- Відкривання браузера (Chrome, Firefox, Safari)
- Навігація по сайтах (`page.goto`)
- Взаємодія з елементами (click, type, scroll)
- Web scraping (витягування тексту, атрибутів)
- Скріншоти веб-сторінок
- Заповнення форм
- Виконання JavaScript на сторінці
- Очікування на елементи (`waitForSelector`)

**Налаштування:**
```javascript
env: {
  HEADLESS: 'false'  // Браузер відкривається видимим
}
```

**Команда запуску:**
```bash
npx -y @executeautomation/playwright-mcp-server
```

**Use Cases:**
- ✅ "Відкрий браузер і перейди на google.com"
- ✅ "Знайди інформацію про Tesla на Wikipedia"
- ✅ "Зроби скріншот головної сторінки github.com"
- ✅ "Заповни форму на example.com"
- ✅ "Витягни всі заголовки з новинного сайту"

**Обмеження:**
- ⚠️ Потребує графічного середовища (GUI)
- ⚠️ Може бути повільним на складних сайтах
- ⚠️ Не обходить CAPTCHA

---

### 3. **Computer Use (Anthropic)** 🖥️

**Package:** `@anthropic/computer-use`

**Функції:**
- Скріншоти екрану (`screenshot`)
- Емуляція клавіатури (`keyboard.type`, `keyboard.press`)
- Емуляція миші (`mouse.click`, `mouse.move`)
- Desktop automation
- Отримання розміру екрану
- Координати курсора

**Налаштування:**
```javascript
env: {}  // Використовує default settings
```

**Команда запуску:**
```bash
npx -y @anthropic/computer-use
```

**Use Cases:**
- ✅ "Зроби скріншот екрану"
- ✅ "Натисни клавішу Enter"
- ✅ "Переміщай мишу до координат (100, 200)"
- ✅ "Натисни на кнопку на координатах (500, 300)"

**Обмеження:**
- ⚠️ Потребує accessibility permissions на macOS
- ⚠️ Може конфліктувати з іншими desktop automation tools
- ⚠️ Координати залежать від розміру екрану

---

### 4. **VSCode MCP Server** 💻

**Package:** `@modelcontextprotocol/server-vscode`

**Функції:**
- Відкривання файлів у VSCode (`vscode.openFile`)
- Редагування коду (`vscode.editFile`)
- Виконання команд редактора (`vscode.executeCommand`)
- Пошук файлів у workspace (`vscode.findFiles`)
- Навігація по коду (go to definition, references)
- Отримання діагностики (errors, warnings)
- Зміна налаштувань VSCode
- Запуск tasks та debug configurations

**Налаштування:**
```javascript
env: {
  VSCODE_WORKSPACE: process.env.VSCODE_WORKSPACE || process.cwd()
}
```

**Команда запуску:**
```bash
node ./node_modules/@modelcontextprotocol/server-vscode/dist/index.js
```

**Use Cases:**
- ✅ "Відкрий файл server.js в VSCode"
- ✅ "Знайди всі файли з розширенням .test.js"
- ✅ "Покажи помилки в поточному проекті"
- ✅ "Виконай команду 'Format Document'"
- ✅ "Додай breakpoint на лінію 42 в index.js"

**Обмеження:**
- ⚠️ Потребує встановленого VSCode
- ⚠️ Працює тільки з відкритим workspace
- ⚠️ Деякі команди потребують розширень VSCode

---

## 🔧 Встановлення

### Всі 4 сервери одночасно:

```bash
npm install -g @modelcontextprotocol/server-filesystem \
               @executeautomation/playwright-mcp-server \
               @anthropic/computer-use \
               @modelcontextprotocol/server-vscode
```

### Окремо:

```bash
# Filesystem
npm install -g @modelcontextprotocol/server-filesystem

# Playwright
npm install -g @executeautomation/playwright-mcp-server

# Computer Use
npm install -g @anthropic/computer-use

# VSCode
npm install -g @modelcontextprotocol/server-vscode
```

### Перевірка встановлення:

```bash
npm list -g | grep -E "filesystem|playwright|computer-use|server-vscode"

# Очікується 4 пакети:
# ├── @modelcontextprotocol/server-filesystem@x.x.x
# ├── @executeautomation/playwright-mcp-server@x.x.x
# ├── @anthropic/computer-use@x.x.x
# ├── @modelcontextprotocol/server-vscode@x.x.x
```

---

## 🎯 Використання в ATLAS

### Workflow Execution

Коли користувач надсилає запит з MCP keywords:

```
Request: "Створи файл test.txt на Desktop з текстом Hello"
```

**Stage 0.5** - Backend Selection:
```
Keywords matched: "створи файл" (MCP), "desktop" (MCP), "файл" (MCP)
→ Backend: mcp (3 matches)
```

**Stage 2.1-MCP** - Tetyana Plan Tools:
```
LLM reasoning: "Need filesystem server for file creation"
→ Selected MCP: filesystem
→ Command: npx -y @modelcontextprotocol/server-filesystem
```

**Або для редагування коду:**
```
Request: "Відкрий файл server.js в VSCode"
→ Selected MCP: vscode
→ Command: node ./node_modules/@modelcontextprotocol/server-vscode/dist/index.js
→ Action: vscode.openFile('/path/to/server.js')
```

**Stage 2.2-MCP** - Tetyana Execute:
```
Execute: fs.writeFile('/Users/dev/Desktop/test.txt', 'Hello')
→ Result: File created successfully
```

### MCP Manager (orchestrator/ai/mcp-manager.js)

```javascript
// Запуск MCP сервера
const mcpManager = new MCPManager();
await mcpManager.startServer('filesystem');

// Виконання tool
const result = await mcpManager.executeTool('filesystem', 'writeFile', {
  path: '/Users/dev/Desktop/test.txt',
  content: 'Hello ATLAS'
});

// Закриття
await mcpManager.stopServer('filesystem');
```

---

## 📊 Коли використовувати який сервер?

### Filesystem (`@modelcontextprotocol/server-filesystem`)

**Тригери (keywords):**
- "створи файл", "create file"
- "збережи файл", "save file"
- "прочитай файл", "read file"
- "видали файл", "delete file"
- "desktop", "файл", "file", "directory"

**Приклади:**
```
✅ "Створи файл test.txt на Desktop"
✅ "Збережи результат в ~/Documents/report.txt"
✅ "Прочитай вміст config.json"
✅ "Видали старі логи з /tmp"
```

---

### Playwright (`@executeautomation/playwright-mcp-server`)

**Тригери (keywords):**
- "відкрий браузер", "open browser"
- "перейди на сайт", "navigate to"
- "знайди інформацію", "find information"
- "скріншот веб", "screenshot web"
- "scrape", "web", "browser", "сайт"

**Приклади:**
```
✅ "Відкрий браузер і перейди на google.com"
✅ "Знайди інформацію про Tesla на Wikipedia"
✅ "Зроби скріншот головної сторінки github.com"
✅ "Витягни заголовки новин з CNN"
```

---

### Computer Use (`@anthropic/computer-use`)

**Тригери (keywords):**
- "скріншот екрану", "screenshot screen"
- "натисни клавішу", "press key"
- "переміщай мишу", "move mouse"
- "desktop control", "automation"

**Приклади:**
```
✅ "Зроби скріншот екрану"
✅ "Натисни клавішу Enter"
✅ "Клікни на координати (500, 300)"
```

---

### Computer Use (`@anthropic/computer-use`)

**Тригери (keywords):**
- "скріншот екрану", "screenshot screen"
- "натисни клавішу", "press key"
- "переміщай мишу", "move mouse"
- "desktop control", "automation"

**Приклади:**
```
✅ "Зроби скріншот екрану"
✅ "Натисни клавішу Enter"
✅ "Клікни на координати (500, 300)"
```

---

### VSCode (`@modelcontextprotocol/server-vscode`)

**Тригери (keywords):**
- "відкрий файл", "open file"
- "редагувати код", "edit code"
- "vscode", "visual studio code"
- "знайди файл", "find file"
- "показати помилки", "show errors"
- "code editor", "editor"

**Приклади:**
```
✅ "Відкрий файл server.js в VSCode"
✅ "Знайди всі файли .test.js у проекті"
✅ "Покажи помилки в коді"
✅ "Виконай команду Format Document"
✅ "Додай breakpoint на лінію 42"
```

---

## 🐛 Troubleshooting

### Filesystem не працює

**Помилка:** "Permission denied" або "EACCES"

**Рішення:**
1. Перевірити ALLOWED_DIRECTORIES в config:
   ```javascript
   env: {
     ALLOWED_DIRECTORIES: '/Users,/tmp,/Desktop,/Applications'
   }
   ```
2. Додати шлях до дозволених:
   ```bash
   export ALLOWED_DIRECTORIES="/Users,/tmp,/Desktop,/Documents"
   ```
3. Перевірити права доступу:
   ```bash
   ls -la ~/Desktop
   ```

---

### Playwright не відкриває браузер

**Помилка:** "Browser not found" або "Executable not found"

**Рішення:**
1. Встановити браузери Playwright:
   ```bash
   npx playwright install chromium
   npx playwright install firefox
   ```
2. Перевірити HEADLESS setting:
   ```javascript
   env: { HEADLESS: 'false' }  // Видимий браузер
   ```
3. Перевірити що X11/GUI доступний (не headless server)

---

### Computer Use не має прав

**Помилка:** "Accessibility permission denied"

**Рішення на macOS:**
1. System Preferences → Security & Privacy → Accessibility
2. Додати Terminal.app або Node.js до дозволених
3. Перезапустити Terminal

---

### VSCode не запускається

**Помилка:** "VSCode not found" або "Command not found: code"

**Рішення:**
1. Встановити VSCode command line tools:
   - Відкрити VSCode
   - Command Palette (Cmd+Shift+P)
   - "Shell Command: Install 'code' command in PATH"
2. Перевірити VSCODE_WORKSPACE:
   ```bash
   export VSCODE_WORKSPACE="$(pwd)"
   ```
3. Перевірити що VSCode встановлено:
   ```bash
   code --version
   ```

---

## 📚 Додаткові ресурси

**Офіційна документація:**
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Filesystem Server](https://github.com/modelcontextprotocol/server-filesystem)
- [Playwright MCP](https://github.com/executeautomation/playwright-mcp-server)
- [Anthropic Computer Use](https://github.com/anthropics/anthropic-quickstarts)
- [VSCode MCP Server](https://github.com/modelcontextprotocol/server-vscode)

**ATLAS документація:**
- `docs/MCP_TODO_SYSTEM_SETUP_GUIDE.md` - Setup інструкції
- `docs/AI_BACKEND_MODULAR_SYSTEM.md` - Архітектура backends
- `config/global-config.js` - Конфігурація MCP серверів

**Код:**
- `orchestrator/ai/mcp-manager.js` - MCP server lifecycle
- `orchestrator/ai/backends/mcp-backend.js` - MCP backend wrapper
- `orchestrator/workflow/executor-v3.js` - executeMCPWorkflow()

---

**Дата оновлення:** 2025-10-13  
**Версія документа:** 1.1.0 (додано VSCode server)  
**Статус:** Complete Reference ✅
