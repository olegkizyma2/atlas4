# Git MCP Server Crash Fix - Disable Broken Package
**Date:** 17 жовтня 2025, ~17:40  
**Status:** ✅ FIXED (disabled broken server)  
**Impact:** High - server crash prevented, git via shell alternative

---

## 🔴 Проблема

Git MCP server `@cyanheads/git-mcp-server` **крашиться при запуску** через проблему з Pino logger threads.

### Симптоми

1. **Server startup crash:**
```bash
$ npx -y @cyanheads/git-mcp-server

🚀 MCP Server running in STDIO mode.
   (MCP Spec: 2025-06-18 Stdio Transport)

Error flushing main logger: Error: the worker has exited
Error flushing interaction logger: Error: the worker has exited
```

2. **ATLAS logs показують:**
```log
[MCP git] ✅ Initialized, waiting for tools list...
[MCP git] ✅ Ready
[WARN] mcp-server {"metadata":{}}  ← Empty warning після 20s timeout
[MCP Manager] ✅ git started (0 tools)  ← 0 замість 27!
```

3. **Timeline:**
- 17:35:50 - Git server initialization started
- 17:36:11 - 20+ seconds later, timeout warning
- 17:36:11 - Git marked as "started" but with 0 tools

---

## 🔍 Корінь проблеми

### #1: Pino Multi-threaded Logger Conflict
```javascript
// @cyanheads/git-mcp-server використовує Pino logger
// з worker threads для async logging
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});
```

**Проблема:** Worker threads виходять передчасно під час shutdown → flush fails

### #2: STDIO Protocol Conflict
- Server працює через **STDIO** (stdin/stdout для MCP protocol)
- Logger пише в **stderr** через worker threads
- Race condition: logger shutdown vs MCP initialize response

### #3: Initialization Timeout
```javascript
// orchestrator/ai/mcp-manager.js
const timeout = setTimeout(() => {
  if (!this.ready) {
    logger.error('mcp-server', `[MCP ${this.name}] ❌ Initialization timeout after 15s`);
    reject(new Error(`${this.name} initialization timeout`));
  }
}, 15000); // 15s timeout для Mac M1 Max
```

Server НЕ встигає відповісти на initialize request через logger crash.

---

## ✅ Рішення

### Крок 1: Disable Git MCP Server

**Файл:** `config/global-config.js`

```javascript
// DISABLED 17.10.2025: @cyanheads/git-mcp-server КРАШИТЬСЯ при запуску
// Проблема: "Error flushing logger: the worker has exited"
// Корінь: Pino multi-threaded logger конфліктує з STDIO protocol
// Альтернатива: Git операції через shell MCP server (git commands)
// TODO: Спробувати інший Git MCP package коли з'явиться
/*
git: {
  command: 'npx',
  args: ['-y', '@cyanheads/git-mcp-server'],
  env: {
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'ATLAS',
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'atlas@example.com'
  }
},
*/
```

### Крок 2: Alternative - Shell Git Commands

**Доступні git операції через shell MCP server:**

```javascript
// Status
shell__execute_command({ command: 'git status' })

// Add files
shell__execute_command({ command: 'git add .' })
shell__execute_command({ command: 'git add file.js' })

// Commit
shell__execute_command({ command: 'git commit -m "feat: new feature"' })

// Push/Pull
shell__execute_command({ command: 'git push origin main' })
shell__execute_command({ command: 'git pull origin main' })

// Branching
shell__execute_command({ command: 'git branch feature-name' })
shell__execute_command({ command: 'git checkout feature-name' })

// Logs
shell__execute_command({ command: 'git log --oneline -10' })
shell__execute_command({ command: 'git diff HEAD~1' })

// Stash
shell__execute_command({ command: 'git stash' })
shell__execute_command({ command: 'git stash pop' })
```

**Переваги shell approach:**
- ✅ Повна функціональність git
- ✅ Немає crashes
- ✅ Прямі команди - зрозуміло що виконується
- ✅ Працює стабільно

**Недоліки:**
- ❌ Немає типізації параметрів (27 спеціалізованих git tools)
- ❌ Потребує knowledge git CLI syntax
- ❌ Менш structured responses

---

## 📊 Результат

### До виправлення:
```
MCP Servers: 6/6 configured
- filesystem: 14 tools ✅
- playwright: 32 tools ✅
- shell: 9 tools ✅
- applescript: 1 tool ✅
- git: 0 tools ❌ (crash after 20s)
- memory: 9 tools ✅
Total: 65 tools (git broken)
```

### Після виправлення:
```
MCP Servers: 5/5 operational
- filesystem: 14 tools ✅
- playwright: 32 tools ✅
- shell: 9 tools ✅ (includes git commands)
- applescript: 1 tool ✅
- memory: 9 tools ✅
Total: 65 tools (git via shell)
```

### Startup Performance:
- **До:** 20+ seconds (git timeout) + crash warnings
- **Після:** ~2-3 seconds (no git server) + clean logs

---

## 🧪 Тестування

### Перевірка що git server ВИМКНЕНО:
```bash
grep -A 15 "git:" config/global-config.js | grep "/\*"
# Має показати закоментований блок
```

### Перевірка git через shell:
```bash
# Через curl (test endpoint)
curl -X POST http://localhost:5101/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "shell",
    "tool": "execute_command",
    "params": {"command": "git status"}
  }'

# Очікуваний результат: git status output
```

### System startup test:
```bash
./restart_system.sh restart
tail -f logs/workflow.log | grep -E "(git|MCP Manager)"

# Має НЕ показувати:
# - [MCP git] Initializing...
# - git started (0 tools)

# Має показувати:
# - ✅ 5/5 servers started
# - shell started (9 tools)
```

---

## 🔮 Альтернативи на майбутнє

### Варіант 1: Чекати update пакету
```bash
# Підписатись на issues:
# https://github.com/cyanheads/git-mcp-server/issues

# Перевіряти updates:
npm outdated -g @cyanheads/git-mcp-server
```

### Варіант 2: Інший Git MCP package
```bash
# Коли з'явиться альтернатива:
npm install -g @alternative/git-mcp-server

# Оновити config:
git: {
  command: 'npx',
  args: ['-y', '@alternative/git-mcp-server'],
  env: { ... }
}
```

### Варіант 3: Custom Git MCP Server
```javascript
// Створити власний git MCP server без Pino logger
// Використовувати simple-git library + basic stdout logging
import simpleGit from 'simple-git';
import { MCPServer } from '@modelcontextprotocol/sdk';

const git = simpleGit();
const server = new MCPServer({
  name: 'custom-git',
  version: '1.0.0'
});

// Register 27 git tools...
```

---

## ⚠️ Критичні правила

### ✅ DO:
- Використовуй `shell__execute_command` для git операцій
- Перевіряй що git server ВИМКНЕНО в config
- Логуй всі git commands для діагностики
- Тестуй git операції через shell перед production

### ❌ DON'T:
- НЕ включай `@cyanheads/git-mcp-server` поки проблема не виправлена
- НЕ припускай що git MCP working (перевіряй tools count)
- НЕ використовуй multi-threaded loggers в STDIO MCP servers
- НЕ ігноруй timeout warnings (може бути причина crash)

---

## 📚 Посилання

**Package:**
- npm: https://www.npmjs.com/package/@cyanheads/git-mcp-server
- GitHub: https://github.com/cyanheads/git-mcp-server

**Related Issues:**
- Logger worker thread crash (Pino + STDIO)
- MCP protocol STDIO transport best practices
- Alternative git MCP implementations

**Documentation:**
- `.github/copilot-instructions.md` - система знає про проблему
- `config/global-config.js` - git server закоментовано
- `orchestrator/ai/mcp-manager.js` - initialization timeout handling

---

## ✅ Checklist

- [x] Git server вимкнено в config
- [x] Shell git commands протестовано
- [x] Startup без crashes
- [x] 5/5 operational servers
- [x] Documentation оновлена
- [x] copilot-instructions.md містить опис проблеми
- [x] Alternative approach задокументований

**Status:** ✅ RESOLVED - система працює стабільно БЕЗ git MCP server

---

**Lessons Learned:**
1. Multi-threaded loggers (Pino) конфліктують з STDIO protocol
2. Worker threads потребують graceful shutdown handling
3. Shell alternatives often sufficient для git operations
4. Always have fallback strategy для external MCP packages
5. 15s timeout достатній для detection broken servers
