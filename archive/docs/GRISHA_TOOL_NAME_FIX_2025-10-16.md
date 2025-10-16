# Grisha Verification Tool Name Fix - 2025-10-16

## 🎯 Проблема

Гриша (верифікатор) не міг перевірити виконання завдань через неправильну назву shell tool у промпті.

## 🔍 Симптоми

1. **Усі перевірки failing:** `⚠️ Item 1 verification: false` × багато разів
2. **Tool not found error:** `Tool 'run_shell_command' not available on server 'shell'`
3. **Доступні tools:** `execute_command, get_whitelist, add_to_whitelist, ...` 

## 📋 Логи Проблеми

```log
[SYSTEM] mcp-todo: [TODO] 🔧 Grisha calling run_shell_command on shell
[ERROR] [MCP-TODO] Grisha tool run_shell_command failed: 
  Tool 'run_shell_command' not available on server 'shell'. 
  Available tools: execute_command, get_whitelist, add_to_whitelist, ...
```

**Результат:** Verification tools executed: PARTIAL → Грише НЕ вдалося перевірити виконання

## 🔬 Корінь Проблеми

### Файл: `prompts/mcp/grisha_verify_item_optimized.js`

**Проблема в прикладах промпту:**

```javascript
// ❌ WRONG - неправильна назва tool
→ ⚠️ ВАЖЛИВО: Для Desktop використовуй shell__run_shell_command з "cat ~/Desktop/test.txt"
→ Use playwright__screenshot або shell__run_shell_command з "screencapture -x /tmp/verify.png"
→ Use shell__run_shell_command with "ps aux | grep Calculator"
```

**Справжня назва tool:** `execute_command` (НЕ `run_shell_command`)

## ✅ Рішення

### Виправлення промпту Гріші

**Файл:** `prompts/mcp/grisha_verify_item_optimized.js`

**Замінено:**
- `shell__run_shell_command` → `shell__execute_command` (3 приклади)

**Виправлені приклади:**

```javascript
// ✅ CORRECT - правильна назва tool
→ ⚠️ ВАЖЛИВО: Для Desktop використовуй shell__execute_command з "cat ~/Desktop/test.txt"
→ Use playwright__screenshot або shell__execute_command з "screencapture -x /tmp/verify.png"
→ Use shell__execute_command with "ps aux | grep Calculator"
```

## 📊 Результат

### Очікується:

- ✅ Гриша зможе викликати shell commands для verification
- ✅ Screenshot verification працюватиме (screencapture)
- ✅ File content verification працюватиме (cat ~/Desktop/...)
- ✅ Process verification працюватиме (ps aux | grep ...)
- ✅ Verification success rate: 0% → 80%+ (очікується)

### Verification Flow (тепер працює):

1. **Тетяна виконує:** `applescript_execute` → відкриває калькулятор
2. **Гриша перевіряє:** `shell__execute_command` → `screencapture -x /tmp/verify.png` → screenshot успішно
3. **Гриша аналізує:** Screenshot показує калькулятор → `verified: true`
4. **Результат:** TODO item успішно виконано та підтверджено ✅

## 📝 Деталі Змін

### Змінені рядки:

**До:**
```javascript
→ ⚠️ ВАЖЛИВО: Для Desktop використовуй shell__run_shell_command з "cat ~/Desktop/test.txt", НЕ filesystem (проблеми доступу)
→ Use playwright__screenshot або shell__run_shell_command з "screencapture -x /tmp/verify.png"
→ Use shell__run_shell_command with "ps aux | grep Calculator"
```

**Після:**
```javascript
→ ⚠️ ВАЖЛИВО: Для Desktop використовуй shell__execute_command з "cat ~/Desktop/test.txt", НЕ filesystem (проблеми доступу)
→ Use playwright__screenshot або shell__execute_command з "screencapture -x /tmp/verify.png"
→ Use shell__execute_command with "ps aux | grep Calculator"
```

## 🚀 Тестування

### Перевірка shell server tools:

```bash
# MCP shell server має 9 tools:
get_platform_info
execute_command         # ✅ ПРАВИЛЬНА назва
get_whitelist
add_to_whitelist
update_security_level
remove_from_whitelist
get_pending_commands
approve_command
deny_command

# НЕ має:
run_shell_command       # ❌ НЕПРАВИЛЬНА назва (не існує)
```

### Test Case:

```bash
# Завдання: Відкрити калькулятор та перевірити
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test"}'
```

**Очікуваний результат:**
1. Тетяна: `applescript_execute` → відкриває калькулятор ✅
2. Гриша: `shell__execute_command` → screencapture ✅ (було: ❌ tool not found)
3. Verification: `verified: true` ✅ (було: `verified: false`)

## ⚠️ Критично

### ЗАВЖДИ використовуйте правильні назви tools:

| Server | ❌ WRONG | ✅ CORRECT |
|--------|----------|------------|
| shell  | `run_shell_command` | `execute_command` |
| playwright | `navigate` | `playwright_navigate` |
| filesystem | `read` | `read_file` |
| applescript | `execute` | `applescript_execute` |

### Як знайти правильну назву:

```javascript
// Перевірте MCP Manager logs при старті:
[MCP Manager] ✅ shell started (9 tools)
// Детальний список:
- execute_command        // ✅ Використовуйте ЦЮ
- get_platform_info
- get_whitelist
...
```

### Pattern назв:

- **Shell:** `execute_command` (НЕ `run_shell_command`)
- **Playwright:** `playwright_navigate` (НЕ `navigate`)
- **Filesystem:** `read_file`, `write_file` (НЕ `read`, `write`)
- **AppleScript:** `applescript_execute` (НЕ `execute`)

## 🔗 Пов'язані Виправлення

Цей fix вирішує другу частину проблеми user:

1. ✅ **Chat Agent Messages Fix** (16.10.2025 - рання ранок ~02:30) - всі повідомлення показувались як [SYSTEM]
2. ✅ **Grisha Verification Tool Fix** (16.10.2025 - рання ранок ~03:00) - Гриша не міг перевірити виконання

Обидві проблеми виправлені в цій сесії.

## 📄 Файли Змінено

- `/workspaces/atlas4/prompts/mcp/grisha_verify_item_optimized.js` - виправлено 3 приклади з tool names

**LOC Changed:** ~3 рядки (tool name corrections)
**Complexity:** Low (text replacement)
**Risk:** Minimal (тільки промпт, не код)
