# MCP AppleScript Fix - Quick Reference

## Problem
❌ LLM генерував `{"server": "applescript", "tool": "execute"}`  
✅ Має бути `{"server": "applescript", "tool": "applescript_execute"}`

## Solution
Оновлено 3 промпти з чіткими інструкціями та прикладами

## Files Changed
- `prompts/mcp/tetyana_plan_tools.js` ✅
- `prompts/mcp/tetyana_plan_tools_optimized.js` ✅ **КРИТИЧНО - ЦЕЙ ВИКОРИСТОВУЄТЬСЯ!**
- `prompts/mcp/atlas_todo_planning_optimized.js` ✅
- `prompts/mcp/atlas_todo_planning.js` ✅

## Test Command
```
User: "Відкрий калькулятор і перемнож 333 на 2"
```

## Expected Result
```json
{
  "server": "applescript",
  "tool": "applescript_execute",
  "parameters": {
    "code_snippet": "tell application \"Calculator\" to activate",
    "language": "applescript"
  }
}
```

## Restart Required
```bash
./start-orchestrator.sh
```

## Verify
Check logs for: `✅ Planned 1 tool call(s)` без validation errors
