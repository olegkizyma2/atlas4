# MCP Computercontroller Fix - Quick Reference

**Дата:** 14.10.2025 ~11:50  
**Проблема:** Плутанина між Goose extensions та MCP servers

---

## ❌ Проблема

**computercontroller** згадувався в MCP промптах як доступний server, але це **Goose extension**.

## ✅ Рішення

### Виправлено промпти:

1. **tetyana_plan_tools.js** - computercontroller → shell/memory
2. **grisha_verify_item.js** - computercontroller → shell/memory  
3. **atlas_todo_planning.js** - оновлено список MCP servers
4. **stage7_verification.js** - додано уточнення про Goose

### Правильна архітектура:

**Goose Extensions** (ТІЛЬКИ через Goose):
- developer
- playwright
- **computercontroller** ← GUI automation, screenshots

**MCP Servers** (прямі):
- filesystem
- playwright
- **shell** ← системні операції замість computercontroller
- memory
- git, github, applescript

### Таблиця заміни:

| Операція        | Goose                             | MCP                     |
| --------------- | --------------------------------- | ----------------------- |
| Screenshot      | computercontroller.screen_capture | playwright.screenshot   |
| GUI automation  | computercontroller                | shell.run_applescript   |
| System commands | developer.shell                   | shell.run_shell_command |

---

## 🔒 Правила

1. **computercontroller** - ТІЛЬКИ Goose extension
2. **MCP prompts** → filesystem, playwright, shell, memory
3. **Goose prompts** → developer, playwright, computercontroller
4. **НЕ змішувати** Goose extensions та MCP servers в одному режимі

**Детально:** `docs/MCP_COMPUTERCONTROLLER_CONFUSION_FIX_2025-10-14.md`
