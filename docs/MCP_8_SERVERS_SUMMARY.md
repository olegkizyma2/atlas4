# 8 MCP Servers - Quick Reference

**Дата:** 2025-10-13  
**Версія:** 2.0.0

---

## 📦 Повний список (8 серверів)

| # | Назва | Package | Функції |
|---|-------|---------|---------|
| 1 | **Filesystem** | `@modelcontextprotocol/server-filesystem` | Файли та директорії |
| 2 | **Playwright** | `@executeautomation/playwright-mcp-server` | Браузер, scraping, скріншоти |
| 3 | **VSCode** | `@modelcontextprotocol/server-vscode` | Редагування коду |
| 4 | **Super Shell** | `super-shell-mcp` | Terminal (npm, brew, git CLI) |
| 5 | **AppleScript** | `@mseep/applescript-mcp` | macOS застосунки |
| 6 | **GitHub** | `@wipiano/github-mcp-lightweight` | Issues, PRs |
| 7 | **Git** | `@cyanheads/git-mcp-server` | Git операції |
| 8 | **Memory** | `@modelcontextprotocol/server-memory` | Тривала пам'ять |

---

## 🚀 Швидке встановлення

```bash
# Всі 8 одночасно
npm install -g @modelcontextprotocol/server-filesystem \
               @executeautomation/playwright-mcp-server \
               @modelcontextprotocol/server-vscode \
               super-shell-mcp \
               @mseep/applescript-mcp \
               @wipiano/github-mcp-lightweight \
               @cyanheads/git-mcp-server \
               @modelcontextprotocol/server-memory
```

---

## 🎯 Use Cases

### 1️⃣ Filesystem
- ✅ "Створи файл test.txt на Desktop"
- ✅ "Прочитай ~/Documents/notes.txt"
- ✅ "Видали /tmp/cache.json"

### 2️⃣ Playwright
- ✅ "Відкрий браузер та перейди на google.com"
- ✅ "Зроби скріншот сторінки"
- ✅ "Scrape заголовки з сайту"

### 3️⃣ VSCode
- ✅ "Відкрий файл server.js в VSCode"
- ✅ "Знайди всі .test.js файли"
- ✅ "Покажи помилки в проекті"

### 4️⃣ Super Shell
- ✅ "Виконай npm install express"
- ✅ "Встанови через brew install wget"
- ✅ "Запусти git status"

### 5️⃣ AppleScript
- ✅ "Відкрий Safari"
- ✅ "Активуй Chrome і відкрий нову вкладку"
- ✅ "Відкрий папку Documents в Finder"

### 6️⃣ GitHub
- ✅ "Покажи всі відкриті issues в repo"
- ✅ "Знайди PRs з label 'bug'"
- ✅ "Список PR на review"

### 7️⃣ Git
- ✅ "Зроби commit 'Fix bug'"
- ✅ "Push на origin"
- ✅ "Створи гілку feature/new-ui"
- ✅ "Merge develop в main"

### 8️⃣ Memory
- ✅ "Запам'ятай що я працюю над ATLAS"
- ✅ "Що ти пам'ятаєш про мої preference?"
- ✅ "Збережи контекст останньої розмови"

---

## 🔑 Keywords для роутингу

**Файли:** `створи файл`, `file`, `directory`, `папка`  
**Браузер:** `відкрий браузер`, `screenshot`, `scrape`  
**VSCode:** `vscode`, `code editor`, `відкрий файл`  
**Terminal:** `виконай команду`, `npm`, `brew`, `install`  
**macOS:** `відкрий програму`, `launch`, `applescript`, `finder`  
**GitHub:** `github issue`, `pull request`, `pr`, `create issue`  
**Git:** `git commit`, `push`, `pull`, `branch`, `merge`  
**Memory:** `запам'ятай`, `remember`, `що ти пам'ятаєш`

---

## ✅ Перевірка встановлення

```bash
npm list -g | grep -E "filesystem|playwright|vscode|super-shell|applescript|github-mcp-lightweight|git-mcp-server|server-memory"
```

**Очікується 8 пакетів!**

---

## 🔗 Детальна документація

- **Setup Guide:** `docs/MCP_TODO_SYSTEM_SETUP_GUIDE.md` (v1.3.0)
- **Reference:** `docs/MCP_SERVERS_REFERENCE.md` (v2.0.0)
- **Config:** `config/global-config.js` → `AI_BACKEND_CONFIG.providers.mcp.servers`

---

**Статус:** ✅ 8/8 серверів готові до використання
