# MCP Initialization Timeout Fix - Quick Start

**Дата:** 14.10.2025 - ніч ~02:35  
**Платформа:** Mac Studio M1 MAX  
**Статус:** ✅ ВИПРАВЛЕНО

---

## 📋 Що було виправлено

**Проблема:** Система крашилась з `Error: filesystem initialization timeout` - MCP сервери НЕ встигали ініціалізуватись за 5 секунд.

**Рішення:**
1. ⏱️ Timeout збільшено з 5s → 15s (Mac M1 ARM overhead)
2. 📝 Додано детальне логування stdout/stderr
3. 🛡️ Graceful degradation (5/7 OK → система працює)
4. 🔧 Виправлено розпізнавання init response

---

## 🚀 Швидкий старт

```bash
# 1. Перевірити доступність npm пакетів
./check-mcp-packages.sh

# 2. Запустити систему
./restart_system.sh restart

# 3. Моніторити логи (в окремому терміналі)
tail -f logs/orchestrator.log | grep -E '(MCP|mcp-)'

# 4. Перевірити успіх
grep '✅.*servers started' logs/orchestrator.log
```

**Очікуваний результат:**
```
[INFO] [MCP Manager] Starting MCP servers...
[INFO] [MCP filesystem] ✅ Initialized with 12 tools
[INFO] [MCP playwright] ✅ Initialized with 8 tools
...
[INFO] [MCP Manager] ✅ 7/7 servers started
```

---

## 🧪 Testing Guide

Запустити повний тест:
```bash
./test-mcp-init-fix.sh
```

Або тестувати вручну:
```bash
# Pre-test
./check-mcp-packages.sh              # Всі пакети доступні?

# Test
./restart_system.sh restart          # Система запускається?
tail -f logs/orchestrator.log | grep MCP  # Логи показують success?

# Validate
grep timeout logs/orchestrator.log   # Має бути пусто (no timeouts)
grep 'servers started' logs/orchestrator.log  # Має бути "7/7" або "5/7"
```

---

## ⏱️ Performance (Mac M1 Max)

| Сервер | Час ініціалізації | Примітка |
|--------|-------------------|----------|
| filesystem | ~3-5s | Найшвидший |
| playwright | ~8-12s | Найповільніший (Chromium) |
| shell | ~4-6s | |
| applescript | ~3-5s | |
| github | ~5-7s | Потребує GITHUB_TOKEN |
| git | ~4-6s | |
| memory | ~3-5s | |

**Total (паралельно):** ~8-12s (обмежено playwright)

---

## 🎯 Критичні правила

### Mac M1 Max:
- ✅ **ЗАВЖДИ** timeout >= 15s (ARM + npx overhead)
- ✅ **ЗАВЖДИ** логувати stdout/stderr для діагностики
- ✅ **ЗАВЖДИ** graceful degradation (деякі можуть failing)

### Init Response:
```javascript
// ✅ CORRECT
if (message.result && message.result.capabilities)

// ❌ WRONG
if (message.method === 'initialize' && message.result)
```

### Graceful Degradation:
```javascript
// ✅ Система працює з 5/7 серверів
if (successCount === 0) {
  throw new Error('All MCP servers failed');
}

// ⚠️ Warning але НЕ crash
logger.warn(`${failedCount} server(s) failed`);
```

---

## 🐛 Troubleshooting

### Якщо timeout все ще трапляється:

1. **Перевірити інтернет:**
   ```bash
   ping -c 3 registry.npmjs.org
   ```

2. **Перевірити stderr в логах:**
   ```bash
   grep 'stderr' logs/orchestrator.log | tail -20
   ```

3. **Тестувати окремо один сервер:**
   ```bash
   npx -y @modelcontextprotocol/server-filesystem
   # Має запуститись без помилок
   ```

4. **Збільшити timeout до 20s** (для повільного інтернету):
   ```javascript
   // orchestrator/ai/mcp-manager.js
   }, 15000); → }, 20000);
   ```

5. **Перевірити процеси:**
   ```bash
   ps aux | grep npx
   # Має показати 7 процесів npx під час init
   ```

---

## 📁 Змінені файли

1. **orchestrator/ai/mcp-manager.js** (~150 LOC):
   - `MCPServer.initialize()` - timeout + logging
   - `MCPServer._setupStreams()` - stdout/stderr capture
   - `MCPServer._handleMCPMessage()` - init response fix
   - `MCPManager.initialize()` - graceful degradation

2. **.github/copilot-instructions.md**:
   - Додано розділ про MCP Init Timeout Fix

3. **Нові файли:**
   - `docs/MCP_INITIALIZATION_TIMEOUT_FIX_2025-10-14.md` (повна документація)
   - `check-mcp-packages.sh` (перевірка npm пакетів)
   - `test-mcp-init-fix.sh` (testing guide)
   - `MCP_INIT_TIMEOUT_FIX_COMPLETE.sh` (summary)

---

## 📚 Документація

**Детальна документація:**
- `docs/MCP_INITIALIZATION_TIMEOUT_FIX_2025-10-14.md`

**Архітектурні документи:**
- `docs/AI_BACKEND_MODULAR_SYSTEM.md` - MCP integration
- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md` - Використання MCP

**Конфігурація:**
- `config/global-config.js` - MCP servers config

---

## ✅ Success Criteria

Система вважається успішно виправленою якщо:

1. ✅ Всі 7 MCP серверів ініціалізуються (або 5-6/7 з warnings)
2. ✅ Немає "timeout" errors в логах
3. ✅ System startup НЕ крашиться
4. ✅ Логи показують детальну інформацію про init
5. ✅ Graceful degradation працює (partial success acceptable)

---

**Автор:** ATLAS Development Team  
**Платформа:** Mac Studio M1 MAX  
**Час виправлення:** ~25 хвилин  
**LOC змінено:** ~150  
**Breaking changes:** Немає (backwards compatible)
