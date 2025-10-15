# MCP AppleScript Tool Name Fix v2 - COMPLETE ✅

**Date:** 2025-10-15 22:25  
**Status:** FIXED & RESTARTED  
**Priority:** CRITICAL

## Problem Summary

LLM **продовжував генерувати** неправильні назви інструментів після першого виправлення:
- ❌ `{"server": "applescript", "tool": "execute"}` - НЕПРАВИЛЬНО
- ✅ `{"server": "applescript", "tool": "applescript_execute"}` - ПРАВИЛЬНО

## Root Cause Discovery

Перше виправлення було **неповним**:
1. ✅ Виправлено `tetyana_plan_tools.js`
2. ❌ **НЕ виправлено** `tetyana_plan_tools_optimized.js` - **ЦЕЙ ФАЙЛ ВИКОРИСТОВУЄТЬСЯ!**

Система використовує **оптимізовані промпти** (з `index.js`):
```javascript
import tetyanaPlanTools from './tetyana_plan_tools_optimized.js';  // OPTIMIZED 15.10.2025
```

## Solution v2

### Виправлено `tetyana_plan_tools_optimized.js`

**Додано критичну секцію:**
```
⚠️ КРИТИЧНО - ПРАВИЛЬНІ НАЗВИ ІНСТРУМЕНТІВ:

**AppleScript сервер:**
- ✅ ПРАВИЛЬНО: server="applescript" + tool="applescript_execute"
- ❌ НЕПРАВИЛЬНО: server="applescript" + tool="execute"
- ❌ НЕПРАВИЛЬНО: server="applescript_execute" + tool="execute"

**Обов'язкові параметри для applescript_execute:**
- code_snippet (string) - AppleScript код
- language (string) - завжди "applescript"

**Приклад 1 - Відкрити калькулятор:**
{
  "server": "applescript",
  "tool": "applescript_execute",
  "parameters": {
    "code_snippet": "tell application \"Calculator\" to activate",
    "language": "applescript"
  },
  "reasoning": "Відкриття калькулятора через AppleScript"
}

**Приклад 2 - Ввести текст через клавіатуру:**
{
  "server": "applescript",
  "tool": "applescript_execute",
  "parameters": {
    "code_snippet": "tell application \"System Events\"\n  keystroke \"333\"\n  keystroke \"*\"\n  keystroke \"2\"\n  keystroke return\nend tell",
    "language": "applescript"
  },
  "reasoning": "Введення математичного виразу через клавіатуру"
}
```

## Files Modified (Complete List)

1. ✅ `/prompts/mcp/tetyana_plan_tools.js` - Додано приклад та критичні інструкції
2. ✅ `/prompts/mcp/tetyana_plan_tools_optimized.js` - **КРИТИЧНО** - Додано інструкції та приклади
3. ✅ `/prompts/mcp/atlas_todo_planning_optimized.js` - Уточнено правило #9
4. ✅ `/prompts/mcp/atlas_todo_planning.js` - Уточнено правило #10

## System Restarted

```
✅ ATLAS System Started Successfully!

Orchestrator:        ● RUNNING (PID: 37675, Port: 5101)
Frontend:            ● RUNNING (PID: 37680, Port: 5001)
Recovery Bridge:     ● RUNNING (PID: 37685, Port: 5102)
```

## Testing Required

### Test Case: Calculator Math
```
User: "Відкрий калькулятор і перемнож 333 на 2"
```

**Expected LLM Response:**
```json
{
  "tool_calls": [
    {
      "server": "applescript",
      "tool": "applescript_execute",
      "parameters": {
        "code_snippet": "tell application \"Calculator\" to activate",
        "language": "applescript"
      }
    }
  ]
}
```

**Expected in Logs:**
- ✅ `[TODO] Parsed plan: {"server": "applescript", "tool": "applescript_execute"}`
- ✅ `[STAGE-2.1-MCP] ✅ Planned 1 tool call(s)`
- ❌ NO validation errors
- ❌ NO retry loops

## Verification Checklist

- [x] Identified correct prompt file (`tetyana_plan_tools_optimized.js`)
- [x] Added critical instructions section
- [x] Added 2 working examples
- [x] Fixed all 4 prompt files
- [x] System restarted successfully
- [ ] Test calculator command
- [ ] Verify logs show correct tool names
- [ ] Confirm no validation errors

## Key Learnings

1. **Always check which prompt is actually used** - система може використовувати оптимізовані версії
2. **Check imports in index.js** - це показує, які файли завантажуються
3. **Restart required** - промпти завантажуються при старті оркестратора
4. **Examples are critical** - LLM краще вчиться з прикладів, ніж з інструкцій

## Next Steps

1. ✅ System restarted
2. ⏳ Test "Відкрий калькулятор і перемнож 333 на 2"
3. ⏳ Check orchestrator logs
4. ⏳ Verify no validation errors
5. ⏳ If successful, commit changes

## Commit Message

```
fix(mcp): correct applescript tool name in OPTIMIZED prompts

CRITICAL FIX: Previous fix only updated non-optimized prompts.
System uses tetyana_plan_tools_optimized.js which was not updated.

Changes:
- Added critical instructions to tetyana_plan_tools_optimized.js
- Added 2 working examples with correct tool name
- Updated all 4 prompt files for consistency
- System restarted to load new prompts

Resolves: LLM generating "execute" instead of "applescript_execute"
```

---

**Status:** Ready for testing  
**Next:** Test calculator command and verify logs
