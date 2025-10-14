# MCP Computercontroller Confusion Fix

**Дата:** 14 жовтня 2025 р. ~11:50  
**Проблема:** MCP сервери та Goose extensions плутались в промптах

---

## 🔍 Проблема

**Симптом:**
- Промпти для MCP Dynamic TODO згадували `computercontroller` як MCP server
- `computercontroller` - це **Goose extension**, а НЕ MCP server
- LLM міг рекомендувати неіснуючі tools → падіння workflow

**Корінь проблеми:**
1. **Goose extensions** (в `global-config.js`): developer, playwright, **computercontroller**
2. **MCP servers** (в `global-config.js`): filesystem, playwright, shell, applescript, github, git, memory
3. **Промпти MCP** містили `computercontroller` як доступний MCP server → ПОМИЛКА!

**Наслідки:**
- Тетяна могла планувати tools з `computercontroller` server (НЕ існує в MCP)
- Гриша міг використовувати `computercontroller` tools (НЕ доступні в MCP mode)
- Падіння `executeTool()` з помилкою "Server 'computercontroller' not found"

---

## ✅ Рішення

### 1. Виправлено промпт Тетяни (`tetyana_plan_tools.js`)

**Було:**
```javascript
3. **computercontroller** - Системні операції:
   - mouse_control, keyboard_input, screen_capture
```

**Стало:**
```javascript
3. **shell** - Shell команди та системні операції:
   - run_shell_command, run_applescript
   - execute_script, check_output
   - system_commands (через shell)

4. **memory** - Робота з пам'яттю:
   - store_memory, retrieve_memory
```

**Правило:**
```javascript
// Було
2. ✅ **Правильний сервер** - filesystem для файлів, playwright для web, computercontroller для system

// Стало
2. ✅ **Правильний сервер** - filesystem для файлів, playwright для web, shell для системних операцій
```

### 2. Виправлено промпт Гріші MCP (`grisha_verify_item.js`)

**Було:**
```javascript
3. **computercontroller** - Системні перевірки:
   - screen_capture (скріншот екрану)
   - list_windows (активні програми)
```

**Стало:**
```javascript
3. **shell** - Системні перевірки:
   - run_shell_command (виконати команду для перевірки)
   - run_applescript (AppleScript для macOS перевірок)

4. **memory** - Перевірка збережених даних:
   - retrieve_memory (отримати збережені дані)
```

### 3. Виправлено промпт Atlas TODO (`atlas_todo_planning.js`)

**Було:**
```javascript
7. ✅ MCP servers: filesystem, playwright, computercontroller
```

**Стало:**
```javascript
7. ✅ MCP servers: filesystem, playwright, shell, memory
```

### 4. Оновлено Goose промпт Гріші (`stage7_verification.js`)

**Додано уточнення:**
```javascript
5. Завдання про GUI → computercontroller.screen_capture (Goose extension, доступний ТІЛЬКИ через Goose)

⚠️ ВАЖЛИВО: Vision/screenshot tools ДОСТУПНІ ТІЛЬКИ в Goose режимі!
ПЕРЕВІРЯЙ через: list_windows (програми), shell commands (файли/процеси), computercontroller (GUI стан в Goose)
```

---

## 📊 Виправлені файли

1. ✅ `prompts/mcp/tetyana_plan_tools.js` - видалено computercontroller, додано shell/memory
2. ✅ `prompts/mcp/grisha_verify_item.js` - видалено computercontroller, додано shell/memory
3. ✅ `prompts/mcp/atlas_todo_planning.js` - оновлено список MCP servers
4. ✅ `prompts/grisha/stage7_verification.js` - додано уточнення про Goose extensions
5. ✅ `orchestrator/workflow/stages/tetyana-plan-tools-processor.js` - default tools вже виправлено (14.10.2025 ~03:15)

**Залишились незмінені:**
- `orchestrator/agents/goose-client.js` - згадування computercontroller ПРАВИЛЬНЕ (Goose extensions)
- `config/global-config.js` - extensions: ['developer', 'playwright', 'computercontroller'] ПРАВИЛЬНЕ (для Goose)

---

## 🎯 Результат

### Тепер правильна архітектура:

**Goose Mode (через Goose Desktop):**
- ✅ Extensions: developer, playwright, **computercontroller**
- ✅ computercontroller доступний через Goose WebSocket
- ✅ Можна робити screen_capture, GUI operations

**MCP Dynamic TODO Mode (прямі MCP сервери):**
- ✅ Servers: filesystem, playwright, **shell**, memory, git, github, applescript
- ✅ computercontroller **НЕ доступний** (це Goose extension)
- ✅ Замість computercontroller → shell (run_shell_command, run_applescript)

### Таблиця співставлення:

| Операція        | Goose Mode                        | MCP Mode                         |
| --------------- | --------------------------------- | -------------------------------- |
| Файли           | developer.shell                   | filesystem.write_file            |
| Web             | playwright                        | playwright (той самий)           |
| Screenshot      | computercontroller.screen_capture | playwright.screenshot (web only) |
| GUI automation  | computercontroller                | shell.run_applescript (macOS)    |
| System commands | developer.shell                   | shell.run_shell_command          |

---

## 🔒 Критичні правила

1. **computercontroller** - ТІЛЬКИ Goose extension, НЕ MCP server
2. **MCP prompts** мають згадувати ТІЛЬКИ MCP servers: filesystem, playwright, shell, memory, git, github, applescript
3. **Goose prompts** можуть згадувати Goose extensions: developer, playwright, computercontroller
4. **Default tools** в `tetyana-plan-tools-processor.js` мають відповідати реальним MCP servers

---

## ✅ Тестування

```bash
# Перевірити що система використовує правильні servers
grep -r "computercontroller" prompts/mcp/
# Має показати 0 результатів в MCP промптах

# Перевірити що Goose промпти не змінились
grep -r "computercontroller" orchestrator/agents/goose-client.js
# Має показувати використання для Goose (правильно)

# Тест MCP workflow
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test"}'

# Має використовувати:
# - shell.run_applescript для відкриття калькулятора
# - НЕ має згадувати computercontroller
```

---

## 📝 Наступні кроки

1. ✅ Промпти виправлено - computercontroller тільки для Goose
2. ✅ Default tools виправлено - shell замість computercontroller
3. ⏳ Тестування MCP workflow з реальними servers
4. ⏳ Документація різниці Goose vs MCP режимів

**Статус:** ✅ ВИПРАВЛЕНО - computercontroller confusion розв'язана!
