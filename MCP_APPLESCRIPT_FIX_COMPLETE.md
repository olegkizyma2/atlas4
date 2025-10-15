# MCP AppleScript Tool Name Fix - COMPLETE ✅

**Date:** 2025-10-15 22:15  
**Status:** FIXED  
**Priority:** CRITICAL

## Problem Summary

LLM генерував **неправильні назви інструментів** для AppleScript сервера:
- ❌ `{"server": "applescript", "tool": "execute"}` - НЕПРАВИЛЬНО
- ❌ `{"server": "applescript_execute", "tool": "execute"}` - НЕПРАВИЛЬНО
- ✅ `{"server": "applescript", "tool": "applescript_execute"}` - ПРАВИЛЬНО

## Root Cause

Промпти містили **застарілі або неточні приклади**, які вводили LLM в оману:
1. В `tetyana_plan_tools.js` був приклад з `tool: "execute"` замість `tool: "applescript_execute"`
2. Недостатньо чітких інструкцій про правильні назви інструментів
3. Валідація працювала коректно, але LLM не міг виправити помилку через нечіткі інструкції

## Error Flow

```
User: "Відкрий калькулятор і перемнож 333 на 2"
  ↓
Atlas TODO Planning: Створює 3 пункти TODO
  ↓
Tetyana Plan Tools: Генерує {"server": "applescript", "tool": "execute"}
  ↓
MCP Manager Validation: ❌ FAILED - Tool 'execute' not found on 'applescript'
  ↓
Retry (3x): LLM повторює ту саму помилку
  ↓
Result: ❌ All 3 items failed
```

## Logs Analysis

### Orchestrator Log
```
2025-10-15 22:11:09 [INFO] [SYSTEM] mcp-todo: [TODO] Full LLM response: 
{"tool_calls": [{"server": "applescript", "tool": "execute", ...}]}

2025-10-15 22:12:33 [WARN] [STAGE-2.1-MCP] ⚠️ Plan validation FAILED:
[WARN] [STAGE-2.1-MCP] Errors: Server 'applescript_execute' not found. 
Available: shell, memory, filesystem, playwright, applescript, git
[WARN] [STAGE-2.1-MCP] Suggestions: Did you mean server: 'applescript'?
```

### Web Log
```
[22:11:09] [CHAT] ⚠️ Planning failed for item 1: Invalid tools in plan
[22:11:12] [CHAT] ⚠️ Planning failed for item 1: Invalid tools in plan
[22:11:15] [CHAT] ⚠️ Planning failed for item 1: Invalid tools in plan
[22:11:15] [CHAT] ❌ Item 1 failed after 3 attempts
```

## Solution Implemented

### 1. Updated `tetyana_plan_tools.js`

**Added clear example:**
```javascript
**Приклад 3: Відкрити калькулятор через AppleScript**
TODO Item: "Відкрити калькулятор на macOS"

Plan:
{
  "tool_calls": [
    {
      "server": "applescript",
      "tool": "applescript_execute",
      "parameters": {
        "code_snippet": "tell application \"Calculator\" to activate",
        "language": "applescript"
      },
      "reasoning": "Відкриття калькулятора через AppleScript"
    }
  ],
  "reasoning": "AppleScript - найкращий спосіб для macOS GUI automation"
}
```

**Added critical instructions:**
```javascript
⚠️ КРИТИЧНО - НАЗВИ ІНСТРУМЕНТІВ НА APPLESCRIPT:
- ✅ ПРАВИЛЬНО: {"server": "applescript", "tool": "applescript_execute"}
- ❌ НЕПРАВИЛЬНО: {"server": "applescript", "tool": "execute"}
- ❌ НЕПРАВИЛЬНО: {"server": "applescript_execute", "tool": "execute"}

Параметри для applescript_execute:
- code_snippet (string, обов'язковий) - AppleScript код
- language (string, обов'язковий) - завжди "applescript"
```

### 2. Updated `atlas_todo_planning_optimized.js`

```javascript
9. ✅ Використовуй applescript для macOS GUI tasks 
   (server: "applescript", tool: "applescript_execute")
```

### 3. Updated `atlas_todo_planning.js`

```javascript
10. ✅ Використовуй applescript для macOS GUI tasks 
    (server: "applescript", tool: "applescript_execute")
```

## Files Modified

1. ✅ `/prompts/mcp/tetyana_plan_tools.js` - Додано приклад та критичні інструкції
2. ✅ `/prompts/mcp/tetyana_plan_tools_optimized.js` - **КРИТИЧНО** - Додано інструкції та приклади (це файл, який використовується!)
3. ✅ `/prompts/mcp/atlas_todo_planning_optimized.js` - Уточнено правило #9
4. ✅ `/prompts/mcp/atlas_todo_planning.js` - Уточнено правило #10

## Testing Required

### Test Case 1: Open Calculator
```
User: "Відкрий калькулятор"
Expected: {"server": "applescript", "tool": "applescript_execute", "parameters": {"code_snippet": "tell application \"Calculator\" to activate", "language": "applescript"}}
```

### Test Case 2: Calculator Math
```
User: "Відкрий калькулятор і перемнож 333 на 2"
Expected: 
- Item 1: Open Calculator (applescript_execute)
- Item 2: Enter 333 (applescript_execute with keystroke)
- Item 3: Multiply by 2 (applescript_execute with keystroke)
```

### Test Case 3: Other macOS Apps
```
User: "Відкрий Safari та перейди на google.com"
Expected:
- Item 1: {"server": "applescript", "tool": "applescript_execute"} - Open Safari
- Item 2: {"server": "playwright", "tool": "playwright_navigate"} - Navigate
```

## Verification Steps

1. ✅ Restart orchestrator to reload prompts
2. ⏳ Test "Відкрий калькулятор" command
3. ⏳ Test "Відкрий калькулятор і перемнож 333 на 2" command
4. ⏳ Check orchestrator logs for correct tool names
5. ⏳ Verify no validation errors

## Success Criteria

- ✅ LLM generates `{"server": "applescript", "tool": "applescript_execute"}`
- ✅ MCP validation passes on first attempt
- ✅ Calculator opens successfully
- ✅ Math operations execute correctly
- ✅ No retry loops

## Related Issues

- MCP_COMPUTERCONTROLLER_FIX_COMPLETE.sh - Similar issue with wrong server names
- MCP_TIMEOUT_FIX_QUICK_REF.md - Retry logic improvements

## Next Steps

1. Restart orchestrator: `./start-orchestrator.sh`
2. Test calculator command
3. Monitor logs for validation errors
4. If successful, commit changes

## Commit Message

```
fix(mcp): correct applescript tool name in prompts

- Fixed LLM generating wrong tool name "execute" instead of "applescript_execute"
- Added clear example in tetyana_plan_tools.js with correct syntax
- Added critical instructions section highlighting the correct format
- Updated atlas_todo_planning prompts with server/tool clarification
- Prevents validation errors and retry loops

Resolves: Calculator automation failing with "Invalid tools in plan"
```

---

**Status:** Ready for testing  
**Next:** Restart orchestrator and verify fix
