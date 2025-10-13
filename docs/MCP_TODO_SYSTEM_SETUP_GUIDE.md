# MCP TODO WORKFLOW SYSTEM - Installation & Testing Guide

**Версія:** 1.3.0  
**Дата:** 2025-10-13  
**Автор:** ATLAS System

---

## 📋 Огляд

Цей гайд описує встановлення та тестування **MCP Dynamic TODO Workflow System** в чистому режимі (без Goose hybrid).

**Встановлено 8 MCP серверів:**
1. ✅ **filesystem** - Файли та директорії
2. ✅ **playwright** - Браузер + скріншоти
3. ✅ **vscode** - VSCode редагування коду
4. ✅ **super-shell** - Terminal команди (npm, brew, git)
5. ✅ **applescript** - macOS автоматизація (запуск програм)
6. ✅ **github-lightweight** - GitHub API (issues, PRs)
7. ✅ **git-mcp** - Git операції (commit, push, merge)
8. ✅ **memory** - Тривала пам'ять AI

---

## 🚀 Швидке встановлення

### Опція 1: Автоматичний скрипт (Рекомендовано)

```bash
# Запустити інсталятор
./scripts/setup-mcp-todo-system.sh

# Під час установки вибрати:
# 1) mcp - Тільки MCP (чистий динамічний TODO)
# 2) goose - Тільки Goose Desktop  
# 3) hybrid - Автовибір

# Для чистого MCP виберіть: 1
```

**Що робить скрипт:**
1. ✅ Перевіряє Node.js
2. ✅ Встановлює 8 MCP npm packages (filesystem, playwright, vscode, super-shell, applescript, github-lightweight, git-mcp, memory)
3. ✅ Налаштовує `.env` з `AI_BACKEND_MODE=mcp`
4. ✅ Встановлює orchestrator залежності
5. ✅ Створює директорії для логів

---

## 📦 Ручне встановлення (Альтернатива)

### Крок 1: Встановлення MCP серверів

**Всі 8 MCP сервери з config/global-config.js:**

```bash
# 1. Filesystem - робота з файлами та директоріями
npm install -g @modelcontextprotocol/server-filesystem

# 2. Playwright - автоматизація браузера + скріншоти
npm install -g @executeautomation/playwright-mcp-server

# 3. VSCode - відкриття та редагування файлів
npm install -g @modelcontextprotocol/server-vscode

# 4. Super Shell - виконання Terminal команд
npm install -g super-shell-mcp

# 5. AppleScript - macOS автоматизація (запуск програм)
npm install -g @mseep/applescript-mcp

# 6. GitHub Lightweight - GitHub API (issues, pull requests)
npm install -g @wipiano/github-mcp-lightweight

# 7. Git MCP - Git операції (commit, push, pull, merge)
npm install -g @cyanheads/git-mcp-server

# 8. Memory - тривала пам'ять AI між сесіями
npm install -g @modelcontextprotocol/server-memory
```

**Перевірка встановлення:**
```bash
npm list -g | grep -E "server-filesystem|playwright-mcp-server|server-vscode|super-shell-mcp|applescript-mcp|github-mcp-lightweight|git-mcp-server|server-memory"
```

**Що робить кожен сервер:**

| # | MCP Server | Package | Функціональність |
|---|------------|---------|------------------|
| 1 | **filesystem** | `@modelcontextprotocol/server-filesystem` | Читання/запис файлів, створення директорій |
| 2 | **playwright** | `@executeautomation/playwright-mcp-server` | Браузер, scraping, скріншоти веб-сторінок |
| 3 | **vscode** | `@modelcontextprotocol/server-vscode` | Відкривати/редагувати файли в VSCode |
| 4 | **shell** | `super-shell-mcp` | Terminal команди (npm, brew, git CLI) |
| 5 | **applescript** | `@mseep/applescript-mcp` | macOS автоматизація, запуск програм |
| 6 | **github** | `@wipiano/github-mcp-lightweight` | GitHub issues, pull requests, repos |
| 7 | **git** | `@cyanheads/git-mcp-server` | Git commit, push, pull, merge, branch |
| 8 | **memory** | `@modelcontextprotocol/server-memory` | Тривала пам'ять AI між сесіями |

**Дозволені директорії (filesystem):**
- `/Users` - домашня директорія користувача
- `/tmp` - тимчасові файли
- `/Desktop` - робочий стіл
- `/Applications` - застосунки

**Налаштування:**
- `playwright` - HEADLESS: false (браузер видимий)
- `shell` - SHELL: /bin/zsh (macOS default)
- `github` - GITHUB_TOKEN: ваш токен (опціонально для приватних repos)
- `git` - GIT_AUTHOR_NAME/EMAIL (опціонально)

### Крок 2: Налаштування .env

```bash
# Відредагувати .env в корені проекту
echo "AI_BACKEND_MODE=mcp" >> .env
echo "AI_BACKEND_PRIMARY=mcp" >> .env
```

**Доступні режими:**
- `mcp` - Тільки MCP (чистий Dynamic TODO) ⭐
- `goose` - Тільки Goose Desktop
- `hybrid` - Автоматичний вибір (Goose для складних, MCP для швидких)

### Крок 3: Встановлення залежностей

```bash
cd orchestrator
npm install
cd ..
```

---

## ✅ Перевірка встановлення

```bash
# Перевірити MCP packages
npm list -g | grep -E "filesystem|playwright|computer-use|server-vscode"

# Очікуваний вивід (4 сервери):
# ├── @modelcontextprotocol/server-filesystem@x.x.x
# ├── @executeautomation/playwright-mcp-server@x.x.x
# ├── @anthropic/computer-use@x.x.x
# ├── @modelcontextprotocol/server-vscode@x.x.x

# 2. Перевірити .env
grep AI_BACKEND .env

# Очікуваний вивід:
# AI_BACKEND_MODE=mcp
# AI_BACKEND_PRIMARY=mcp

# 3. Перевірити orchestrator node_modules
ls orchestrator/node_modules | head -10
```

---

## 🎯 Запуск системи в MCP режимі

### Крок 1: Запустити всі сервіси

```bash
./restart_system.sh start

# Перевірити статус
./restart_system.sh status

# Очікується:
# Frontend:         ● RUNNING (port 5001)
# Orchestrator:     ● RUNNING (port 5101)
# TTS Service:      ● RUNNING (port 3001)
# Whisper Service:  ● RUNNING (port 3002)
# LLM API:          ● RUNNING (port 4000) ⚠️ КРИТИЧНО!
```

**⚠️ ВАЖЛИВО:** Для MCP режиму **обов'язково** має працювати LLM API на порту 4000:
- Atlas використовує LLM для TODO Planning (Stage 1-MCP)
- Tetyana використовує LLM для Plan Tools (Stage 2.1-MCP)
- Grisha використовує LLM для Verify Item (Stage 2.3-MCP)

**🔧 MCP Сервери що використовуються:**
1. **filesystem** - створення/читання файлів (npx @modelcontextprotocol/server-filesystem)
2. **playwright** - браузер automation (npx @executeautomation/playwright-mcp-server)
3. **computercontroller** - скріншоти/desktop (npx @anthropic/computer-use)
4. **vscode** - редагування коду в VSCode (node @modelcontextprotocol/server-vscode)

### Крок 2: Перевірити логи

```bash
# Моніторинг orchestrator
tail -f logs/orchestrator.log | grep -E "MCP|TODO|Backend"

# Має бути:
# Backend selected: mcp
# Routing to MCP Dynamic TODO Workflow
# Stage 1-MCP: Atlas TODO Planning
```

---

## 🧪 Тестування MCP режиму

### Автоматичні тести

```bash
# Запустити швидкі тести
./tests/quick-start-testing.sh

# Або тільки unit тести
npm test

# Очікується:
# Test Suites: 2 passed
# Tests: 39 passed (CircuitBreaker + ExponentialBackoff)
```

### Manual Testing - Scenario 1 (MCP Simple Task)

**Запит:**
```
Створи файл test.txt на Desktop з текстом Hello ATLAS
```

**Очікуваний workflow:**
1. **Stage 0.5** - Backend Selection → `mcp` (3 MCP keywords)
2. **Stage 1-MCP** - Atlas TODO Planning → 3-5 пунктів
3. **Stage 2.1-MCP** - Tetyana Plan Tools → `filesystem`
4. **Stage 2.2-MCP** - Tetyana Execute → MCP filesystem execution
5. **Stage 2.3-MCP** - Grisha Verify → file created?
6. **Stage 8-MCP** - Final Summary → success

**Перевірка результату:**
```bash
ls -la ~/Desktop/test.txt
cat ~/Desktop/test.txt

# Очікується:
# -rw-r--r--  1 user  staff  12 Oct 13 18:21 test.txt
# Hello ATLAS
```

**Логи (має бути):**
```
[SYSTEM] backend-selection: MCP keyword matched: "створи файл"
Backend selected: mcp
Routing to MCP Dynamic TODO Workflow
Stage 1-MCP: Atlas TODO Planning
Stage 2.1-MCP: Tetyana Plan Tools
Stage 2.2-MCP: Tetyana Execute Tools
Stage 2.3-MCP: Grisha Verify Item
Stage 8-MCP: Final Summary
```

**Логи (НЕ має бути):**
```
❌ Using AgentStageProcessor for stage 1: initial_processing
❌ Calling Goose agent for atlas
❌ Goose WebSocket connection
```

---

## 🔍 Діагностика MCP режиму

### Перевірка 1: Backend Selection

```bash
# Запустити завдання і перевірити backend
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt", "sessionId": "test123"}' \
  2>&1 | grep -E "Backend|MCP"

# Має бути:
# Backend selected: mcp
# Routing to MCP Dynamic TODO Workflow
```

### Перевірка 2: MCP Stage Processors

```bash
# Перевірити що MCP stages зареєстровано
grep "Registered.*MCP stage processors" logs/orchestrator.log

# Має бути:
# [SYSTEM] startup: [DI] Registered 7 MCP stage processors
```

### Перевірка 3: TODO Manager

```bash
# Перевірити MCPTodoManager ініціалізацію
grep "MCPTodoManager" logs/orchestrator.log

# Має бути:
# [SYSTEM] startup: [DI] MCPTodoManager initialized
```

### Перевірка 4: LLM API доступність

```bash
# Перевірити port 4000
curl -s http://localhost:4000/v1/models | head -10

# Має повернути JSON з моделями
# Якщо помилка → LLM API не працює → MCP режим НЕ працюватиме!
```

---

## 🐛 Типові проблеми та рішення

### Проблема 1: "Backend selection error: telemetry.emit is not a function"

**Причина:** Telemetry module не має методу `emit()`  
**Рішення:** ✅ Виправлено в `orchestrator/utils/telemetry.js` (додано метод `emit()`)

```bash
# Перевірити виправлення
grep "emit(eventName" orchestrator/utils/telemetry.js

# Має бути:
# emit(eventName, data = {}) {
```

### Проблема 2: "API execution failed" - Port 4000 недоступний

**Причина:** LLM API сервер не запущено  
**Рішення:** Запустити API server на порту 4000

```bash
# Перевірити чи працює
lsof -i :4000

# Якщо пусто → запустити API server
# (команда залежить від вашого LLM setup)
```

### Проблема 3: MCP packages не знайдено

**Причина:** Глобальні npm packages не встановлено  
**Рішення:**

```bash
# Встановити ВСІ 8 MCP серверів
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @executeautomation/playwright-mcp-server
npm install -g @modelcontextprotocol/server-vscode
npm install -g super-shell-mcp
npm install -g @mseep/applescript-mcp
npm install -g @wipiano/github-mcp-lightweight
npm install -g @cyanheads/git-mcp-server
npm install -g @modelcontextprotocol/server-memory

# Перевірити
npm list -g | grep -E "filesystem|playwright|vscode|super-shell|applescript|github-mcp-lightweight|git-mcp-server|server-memory"

# Має показати 8 пакетів
```

### Проблема 4: Система використовує Goose замість MCP

**Причина:** `.env` має `AI_BACKEND_MODE=hybrid` або `goose`  
**Рішення:**

```bash
# Виправити .env
echo "AI_BACKEND_MODE=mcp" > .env.tmp
grep -v "AI_BACKEND_MODE" .env >> .env.tmp
mv .env.tmp .env

# Перезапустити
./restart_system.sh restart
```

### Проблема 5: "Stage 1: initial_processing" замість "Stage 1-MCP"

**Причина:** Backend routing не спрацював, система пішла в Goose mode  
**Діагностика:**

```bash
# Перевірити Backend Selection логи
grep "Backend selected" logs/orchestrator.log | tail -5

# Має бути: Backend selected: mcp
# Якщо: Backend selected: goose → keywords не спрацювали
```

**Рішення:** Перевірити MCP keywords в запиті (має містити: "створи", "відкрий", "збережи", "файл", "desktop", etc.)

---

## 📊 Метрики успішності

### MCP режим працює правильно, якщо:

✅ Backend Selection завжди обирає `mcp` для file/browser tasks  
✅ Логи містять "Stage 1-MCP", "Stage 2.1-MCP", "Stage 2.2-MCP", "Stage 2.3-MCP"  
✅ Логи НЕ містять "Calling Goose agent" або "Goose WebSocket"  
✅ TODO items виконуються через MCP filesystem/playwright  
✅ Час відповіді < 5 секунд (швидше ніж Goose)  
✅ Пам'ять < 500 MB (менше ніж Goose з WebSocket)  

### Порівняння: MCP vs Goose

| Метрика | MCP Mode | Goose Mode |
|---------|----------|------------|
| Час відповіді | ~3-5s | ~10-15s |
| Пам'ять | ~200-400 MB | ~600-800 MB |
| Overhead | Мінімальний (stdio) | WebSocket session |
| Complexity | Item-by-item | All-or-nothing |
| Recovery | Retry failed item | Retry whole task |

---

## 🎓 Поглиблене тестування

### Scenario 2: Multi-Item Workflow (⭐⭐)

**Запит:**
```
Знайди інформацію про Tesla, створи звіт і збережи на Desktop
```

**Очікуваний TODO (5 items):**
1. Open browser
2. Navigate to Tesla website
3. Scrape data
4. Format as report
5. Save to Desktop

**Час виконання:** ~15-25 секунд

### Scenario 3: Error & Fallback (⭐⭐⭐)

**Setup:**
```bash
# Вимкнути MCP filesystem (симуляція помилки)
# Kill process або видалити npm package тимчасово
```

**Запит:**
```
Створи файл test.txt на Desktop
```

**Очікується:**
- MCP filesystem fails
- 3 retries з exponential backoff (1s → 2s → 4s)
- Automatic fallback to Goose Desktop
- Task completed через Goose

---

## 📚 Додаткові ресурси

**Документація:**
- `docs/AI_BACKEND_MODULAR_SYSTEM.md` - Архітектура системи
- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md` - TODO workflow дизайн
- `docs/PHASE_5_TESTING_PLAN.md` - План тестування
- `docs/MANUAL_TESTING_INSTRUCTIONS.md` - Мануал тести (4 scenarios)

**Тести:**
- `tests/unit/circuit-breaker.test.js` - Circuit Breaker pattern (17 tests)
- `tests/unit/exponential-backoff.test.js` - Exponential backoff (22 tests)
- `tests/quick-start-testing.sh` - Автоматичний test runner
- `tests/test-mcp-workflow.sh` - Детальний workflow testing

**Конфігурація:**
- `config/global-config.js` - AI_BACKEND_CONFIG
- `.env` - AI_BACKEND_MODE, AI_BACKEND_PRIMARY
- `orchestrator/workflow/executor-v3.js` - executeMCPWorkflow()

---

## 💡 Best Practices

### 1. Завжди перевіряйте mode перед тестуванням

```bash
grep AI_BACKEND .env
# Має бути: AI_BACKEND_MODE=mcp
```

### 2. Моніторте логи в реальному часі

```bash
tail -f logs/orchestrator.log | grep -E "MCP|Backend|Stage"
```

### 3. Використовуйте MCP для швидких операцій

- ✅ File operations (create, read, write, delete)
- ✅ Desktop interactions (click, type, screenshot)
- ✅ Browser automation (open, navigate, scrape)

### 4. Використовуйте Goose для складних завдань

- ✅ Аналіз коду
- ✅ Порівняння файлів
- ✅ Пошук інформації в інтернеті
- ✅ Multi-step reasoning

### 5. Hybrid mode для продакшн

```bash
export AI_BACKEND_MODE=hybrid

# Система автоматично вибере:
# - MCP для "створи файл", "відкрий браузер"
# - Goose для "проаналізуй", "порівняй", "знайди інформацію"
```

---

## ✅ Checklist для успішного setup

- [ ] Node.js встановлено (v16+)
- [ ] **8 MCP packages встановлено глобально:**
  - [ ] @modelcontextprotocol/server-filesystem
  - [ ] @executeautomation/playwright-mcp-server
  - [ ] @modelcontextprotocol/server-vscode
  - [ ] super-shell-mcp
  - [ ] @mseep/applescript-mcp
  - [ ] @wipiano/github-mcp-lightweight
  - [ ] @cyanheads/git-mcp-server
  - [ ] @modelcontextprotocol/server-memory
- [ ] **4 MCP npm packages** встановлено глобально:
  - [ ] `@modelcontextprotocol/server-filesystem` (файли)
  - [ ] `@executeautomation/playwright-mcp-server` (браузер)
  - [ ] `@anthropic/computer-use` (скріншоти/desktop)
  - [ ] `@modelcontextprotocol/server-vscode` (code editor)
- [ ] `.env` налаштовано з `AI_BACKEND_MODE=mcp`
- [ ] Orchestrator залежності встановлено (`npm install`)
- [ ] Всі сервіси запущено (`./restart_system.sh start`)
- [ ] LLM API працює на порту 4000 ⚠️ **КРИТИЧНО**
- [ ] Unit тести пройдені (39/39)
- [ ] Scenario 1 виконано успішно (файл створено)
- [ ] Логи містять "Backend selected: mcp"
- [ ] Логи містять "Stage 1-MCP", "Stage 2.1-MCP", etc.

---

**Дата оновлення:** 2025-10-13  
**Версія документа:** 1.2.0 (додано vscode server)  
**Статус:** Production Ready ✅
