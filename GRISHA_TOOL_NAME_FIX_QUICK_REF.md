# Grisha Verification Tool Name Fix - Quick Reference

**Дата:** 16.10.2025 - Рання ранок ~03:00  
**Статус:** ✅ ВИПРАВЛЕНО

## 🎯 Проблема

Гриша НЕ міг перевірити виконання → `verification: false` × всі спроби

## 🔍 Корінь

Промпт Гріші містив **неправильну назву shell tool:**

```javascript
// ❌ WRONG
shell__run_shell_command

// ✅ CORRECT
shell__execute_command
```

## ✅ Рішення

**Файл:** `prompts/mcp/grisha_verify_item_optimized.js`

**Змінено:** 3 приклади в промпті

```diff
- shell__run_shell_command
+ shell__execute_command
```

## 📊 Результат

| Було | Стало |
|------|-------|
| `Tool 'run_shell_command' not available` | Гриша викликає `execute_command` успішно |
| `Verification tools executed: PARTIAL` | `Verification tools executed: SUCCESS` |
| `verified: false` × всі спроби | `verified: true` ✅ |
| Verification success: 0% | Verification success: 80%+ (очікується) |

## 🧪 Verification Flow (тепер працює)

```mermaid
Тетяна → applescript_execute (відкриває калькулятор)
   ↓
Гриша → shell__execute_command (screencapture для screenshot)
   ↓
Гриша → аналізує screenshot → verified: true ✅
```

## ⚠️ Критично

### MCP Shell Server Tools (правильні назви):

```javascript
✅ execute_command        // Використовуйте ЦЮ
✅ get_platform_info
✅ get_whitelist
✅ add_to_whitelist
✅ approve_command
✅ deny_command
❌ run_shell_command      // НЕ існує!
```

### Pattern Перевірки

```bash
# В логах при старті:
[MCP Manager] ✅ shell started (9 tools)
Available tools: execute_command, get_platform_info, ...

# ЗАВЖДИ перевіряйте доступні tools перед використанням!
```

## 🔗 Пов'язані Виправлення

Частина комплексного fix для MCP workflow:

1. ✅ **Chat Agent Messages** (02:30) - всі показувались як [SYSTEM]
2. ✅ **Grisha Tool Names** (03:00) - неправильна назва tool → verification failing

Обидва fix застосовано в цій сесії.

## 📝 Testing

```bash
# Test: Відкрити калькулятор та перевірити
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test"}'

# Очікується:
# 1. Тетяна відкриває → ✅
# 2. Гриша робить screenshot → ✅ (було: ❌ tool not found)
# 3. Verification: true ✅ (було: false)
```

---

**Детально:** `GRISHA_TOOL_NAME_FIX_2025-10-16.md`
