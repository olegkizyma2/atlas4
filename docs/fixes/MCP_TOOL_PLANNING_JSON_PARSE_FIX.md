# MCP Tool Planning JSON Parse Fix

**Date**: 2025-10-14  
**Status**: ✅ Fixed  
**Priority**: Critical

## Problem

MCP tool planning was failing with JSON parse errors:
```
Failed to parse tool plan: Unexpected token '<', "<think>Use"... is not valid JSON
```

### Root Causes

1. **Unclosed thinking tags**: LLM (mistral-nemo) was outputting `<think>` tags without closing them
2. **Infinite loops**: Model got stuck repeating "I'll produce answer in Ukrainian"
3. **No JSON output**: Response contained only thinking/meta-commentary, no actual JSON
4. **Weak parser**: Parser only handled closed `</think>` tags, not unclosed ones

### Log Evidence

From `logs/orchestrator.log`:
```
21:16:46 [TODO] Full LLM response: <think>User message: "Визнач які інструменти потрібні..." 
[endless repetition of "I'll produce answer in Ukrainian"]
[NO JSON ANYWHERE]
```

## Solution

### 1. Aggressive JSON Parser (mcp-todo-manager.js)

Updated three parser methods to handle malformed responses:

#### Changes to `_parseToolPlan()`:
```javascript
// OLD: Only handled closed </think> tags
.replace(/<think>[\s\S]*?<\/think>/gi, '')

// NEW: Handles unclosed tags + aggressive JSON extraction
.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')  // Remove unclosed tags

// NEW: Extract JSON by finding first { to last }
const firstBrace = cleanResponse.indexOf('{');
const lastBrace = cleanResponse.lastIndexOf('}');
if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
}
```

**Applied to**:
- `_parseToolPlan()` (Stage 2.1 - tool planning)
- `_parseVerification()` (Stage 2.3 - verification)
- `_parseAdjustment()` (Stage 3 - TODO adjustment)

### 2. Stronger Prompt Instructions (tetyana_plan_tools.js)

Added explicit JSON-only directive at the beginning:

```javascript
export const SYSTEM_PROMPT = `You are a JSON-only API. You must respond ONLY with valid JSON. No explanations, no thinking tags, no preamble.

Ти Тетяна - технічний експерт з виконання завдань через MCP інструменти.
// ... rest of prompt
```

Added new instructions in "КРИТИЧНО ВАЖЛИВО" section:
- ❌ НЕ використовуй <think> або інші теги для міркувань
- ❌ НЕ повторюй інструкції або метадані  
- ✅ Почни свою відповідь БЕЗПОСЕРЕДНЬО з символу '{'

## Files Modified

1. **orchestrator/workflow/mcp-todo-manager.js**
   - `_parseToolPlan()` - Lines 1029-1075
   - `_parseVerification()` - Lines 1078-1128
   - `_parseAdjustment()` - Lines 1131-1163

2. **prompts/mcp/tetyana_plan_tools.js**
   - Added JSON-only directive at line 9
   - Enhanced instructions at lines 234-237

## Testing

### Before Fix
```
❌ Tool planning failed: Unexpected token '<', "<think>Use"... is not valid JSON
❌ Max attempts reached (3/3)
❌ Task execution blocked
```

### After Fix (Expected)
```
✅ LLM outputs JSON directly or with minimal thinking
✅ Parser extracts JSON even if LLM adds preamble
✅ Tool planning succeeds
✅ MCP workflow continues
```

### Test Command
```bash
# Start orchestrator
./restart_system.sh restart

# Test with Ukrainian request that previously failed
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "на робочому столі створи файл test.txt"}'

# Check logs
tail -f logs/orchestrator.log | grep "Tool planning"
```

## Prevention

1. **Parser resilience**: All parsers now handle:
   - Unclosed XML/HTML tags
   - Text before/after JSON
   - Missing JSON (clear error)

2. **Prompt clarity**: Strong "JSON-only" directive at start
3. **Model selection**: Consider switching to models with better instruction-following if issues persist

## Related Issues

- Similar to `MCP_JSON_PARSING_FIX_COMPLETE.md` but more severe
- Related to model behavior with Ukrainian prompts
- May need model tuning or temperature adjustment

## Restart Required

⚠️ **YES** - Changes to Node.js modules require orchestrator restart:
```bash
./restart_system.sh restart
```

## Success Criteria

- [ ] No more "Unexpected token '<'" errors in logs
- [ ] Tool planning success rate > 90%
- [ ] Requests complete without "Max attempts reached"
- [ ] Ukrainian language requests work correctly

## Notes

- The issue appears specific to mistral-nemo with Ukrainian prompts
- Model may need further tuning or replacement if problems persist
- Consider monitoring for other stages having similar issues
- The "aggressive extraction" approach is defensive but necessary for model stability
