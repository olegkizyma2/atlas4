# MCP Servers Setup - Quick Reference

## 🎯 TL;DR
**ATLAS v5.0 Pure MCP Edition** встановлює 6 MCP серверів (92 tools) через npm.

## 📦 6 MCP Servers (MUST HAVE)

### 1. Filesystem (14 tools)
```bash
npm install -g @modelcontextprotocol/server-filesystem
```
**Функції:** read_file, write_file, create_directory, list_directory, move_file, delete_file, search_files

### 2. Playwright (32 tools)
```bash
npm install -g @executeautomation/playwright-mcp-server
```
**Функції:** browser_open, browser_navigate, screenshot, click, fill, evaluate, scrape

### 3. Super Shell (9 tools)
```bash
npm install -g super-shell-mcp
```
**Функції:** execute_command, get_platform_info, add_to_whitelist, approve_command

### 4. AppleScript (1 tool)
```bash
npm install -g @peakmojo/applescript-mcp
```
**Функції:** execute_applescript (macOS GUI automation)

### 5. Git (27 tools)
```bash
npm install -g @cyanheads/git-mcp-server
```
**Функції:** git_add, git_commit, git_push, git_pull, git_branch, git_checkout, git_merge, git_status, git_diff, git_log

### 6. Memory (9 tools)
```bash
npm install -g @modelcontextprotocol/server-memory
```
**Функції:** store_memory, retrieve_memory, list_memories, delete_memory, update_memory, search_memories

## ✅ Перевірка встановлення

```bash
# Швидка перевірка всіх 6 серверів
npm list -g --depth=0 | grep -E "filesystem|playwright|super-shell|applescript|git-mcp|memory"

# Має показати:
# @modelcontextprotocol/server-filesystem@...
# @executeautomation/playwright-mcp-server@...
# super-shell-mcp@...
# @peakmojo/applescript-mcp@...
# @cyanheads/git-mcp-server@...
# @modelcontextprotocol/server-memory@...
```

## 🧪 Автоматичне тестування

```bash
# Запустити тест (ЗАВЖДИ після setup)
./test-setup-mcp.sh

# Очікуваний результат:
# ✅ Node.js: v22.19.0
# ✅ npm: 10.9.3
# ✅ 6/6 MCP servers встановлено
# ✅ .env налаштовано (AI_BACKEND_MODE=mcp)
# ✅ Goose видалено
```

## ❌ НЕ встановлювати (DEPRECATED)

```bash
# ❌ Застарілі Goose-era MCP пакети
@anthropic/computer-use              # Replaced by applescript-mcp
@modelcontextprotocol/server-github  # Broken SDK compatibility (v0.1.1)
@wipiano/github-mcp-lightweight      # SDK version mismatch

# ❌ Goose Desktop (deprecated в v5.0)
brew tap block/goose                 # Tap недоступний
brew install goose                   # НЕ потрібен
pipx install goose-ai                # Dependency hell
```

## 🔧 Setup Script Locations

### setup-macos.sh
**Функція:** `install_mcp_servers()` (КРОК 7)
- Встановлює 6 серверів через npm install -g
- Перевіряє Node.js >= 18.0.0
- Логує прогрес для кожного пакету
- ~60 LOC

### scripts/setup-mcp-todo-system.sh
**Режим:** Тільки "mcp" (goose/hybrid видалено)
- Запитує AI_BACKEND_MODE (default: mcp)
- Створює .env з MCP конфігурацією
- ~195 LOC (було 215)

## 📊 Статистика

| Метрика           | Значення |
| ----------------- | -------- |
| Всього серверів   | 6        |
| Всього tools      | 92       |
| Filesystem tools  | 14       |
| Playwright tools  | 32       |
| Shell tools       | 9        |
| AppleScript tools | 1        |
| Git tools         | 27       |
| Memory tools      | 9        |

## 🚀 Швидкий старт

```bash
# 1. Встановити всі 6 серверів
npm install -g \
  @modelcontextprotocol/server-filesystem \
  @executeautomation/playwright-mcp-server \
  super-shell-mcp \
  @peakmojo/applescript-mcp \
  @cyanheads/git-mcp-server \
  @modelcontextprotocol/server-memory

# 2. Перевірити встановлення
./test-setup-mcp.sh

# 3. Запустити ATLAS
./restart_system.sh start

# 4. Перевірити логи MCP Manager
tail -f logs/orchestrator.log | grep "MCP"
```

## 🔍 Діагностика проблем

### Помилка: "MCP server not found"
```bash
# Перевірте що пакет встановлено глобально
npm list -g <package-name>

# Якщо НЕ встановлено - встановіть
npm install -g <package-name>
```

### Помилка: "Tool 'X' not available"
```bash
# Перевірте логи orchestrator
grep "MCP.*started.*tools" logs/orchestrator.log

# Має показати:
# [MCP filesystem] ✅ Initialized with 14 tools
# [MCP playwright] ✅ Initialized with 32 tools
# ... (всі 6 серверів)
```

### Помилка: "npm install -g permission denied"
```bash
# Використайте sudo (macOS)
sudo npm install -g <package-name>

# Або налаштуйте npm prefix (рекомендовано)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## 📝 Environment Variables

```bash
# .env конфігурація (створюється автоматично)
AI_BACKEND_MODE=mcp              # Pure MCP mode (default)
AI_BACKEND_PRIMARY=mcp           # Primary backend
AI_BACKEND_FALLBACK=none         # No fallback (strict mode)

# ❌ Deprecated variables (НЕ використовувати)
AI_BACKEND_MODE=goose            # Removed in v5.0
AI_BACKEND_MODE=hybrid           # Removed in v5.0
```

## 🎯 Критичні правила

1. **ЗАВЖДИ 6 серверів** - не більше, не менше
2. **Глобальна установка** - npm install -g (НЕ локально)
3. **Тестування обов'язкове** - запустіть test-setup-mcp.sh
4. **НЕ використовувати Goose** - deprecated в v5.0
5. **Версія Node.js >= 18.0.0** - перевірте перед установкою

## 📚 Детальна документація

- **Повний звіт:** `docs/SETUP_SCRIPTS_CLEANUP_2025-10-16.md`
- **Тест скрипт:** `test-setup-mcp.sh`
- **Setup скрипт:** `setup-macos.sh`
- **MCP TODO скрипт:** `scripts/setup-mcp-todo-system.sh`

---

**Версія:** ATLAS v5.0 Pure MCP Edition  
**Дата:** 16 жовтня 2025 р.  
**Автор:** GitHub Copilot
