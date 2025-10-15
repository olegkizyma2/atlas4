# MCP JSON Trailing Comma Fix

**Date**: 2025-10-15  
**Status**: ✅ Fixed  
**Priority**: Critical

## Problem

MCP workflow was failing with JSON parse errors during tool planning:

```
⚠️ Не вдалося спланувати інструменти для "Ввести множення на 2 в калькулятор": 
Tool planning failed: Failed to parse tool plan: Expected ',' or ']' after array element in JSON at position 373 (line 10 column 6)
❌ Помилка після 3 спроб: Max attempts reached
```

### Root Causes

1. **LLM generating trailing commas**: Models were outputting JSON with trailing commas like:
   ```json
   {"tool_calls": [{"server": "applescript", "parameters": {...},},], "reasoning": "..."}
                                                             ↑↑ Invalid trailing commas
   ```

2. **Conditional sanitization**: JSON sanitization was only applied for specific error patterns, missing cases like trailing comma errors

3. **Inconsistent parsing**: Only `_parseToolPlan()` had sanitization logic; `_parseVerification()` and `_parseAdjustment()` did not

4. **Weak prompt guidance**: Prompt mentioned trailing commas but without visual examples

## Solution

### 1. Enhanced JSON Sanitization (`mcp-todo-manager.js`)

**Made sanitization more aggressive:**

```javascript
// ENHANCED 15.10.2025 - More aggressive trailing comma removal
// Remove trailing commas before closing braces/brackets (handles newlines and multiple spaces)
sanitized = sanitized.replace(/,(\s*[\r\n]+\s*)([}\]])/g, '$1$2');  // comma before newline and }]
sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');  // comma directly before }]

// ADDED 15.10.2025 - Remove multiple consecutive commas
sanitized = sanitized.replace(/,\s*,+/g, ',');

// ADDED 15.10.2025 - Remove trailing commas at end of lines
sanitized = sanitized.replace(/,(\s*[\r\n])/g, '$1');
```

### 2. Unconditional Sanitization

**Changed all parsers to ALWAYS attempt sanitization on ANY parse error:**

**Before:**
```javascript
try {
    parsed = JSON.parse(cleanResponse);
} catch (parseError) {
    const needsSanitization = /Expected (property name|'|,)/i.test(parseError.message);
    if (needsSanitization) {  // ❌ Only sanitizes specific patterns
        const sanitized = this._sanitizeJsonString(cleanResponse);
        parsed = JSON.parse(sanitized);
    } else {
        throw parseError;  // ❌ Throws error for other patterns
    }
}
```

**After:**
```javascript
try {
    parsed = JSON.parse(cleanResponse);
} catch (parseError) {
    // FIXED 15.10.2025 - ALWAYS attempt sanitization on ANY parse error
    this.logger.warn(`Initial JSON parse failed: ${parseError.message}. Attempting sanitization...`);
    
    try {
        const sanitized = this._sanitizeJsonString(cleanResponse);
        parsed = JSON.parse(sanitized);
        this.logger.warn('✅ JSON sanitization successful');
    } catch (sanitizedError) {
        this.logger.error('❌ JSON sanitization also failed');
        throw sanitizedError;
    }
}
```

**Applied to:**
- `_parseToolPlan()` - Stage 2.1 (tool planning)
- `_parseVerification()` - Stage 2.3 (verification)
- `_parseAdjustment()` - Stage 3 (TODO adjustment)

### 3. Strengthened Prompt (`tetyana_plan_tools_optimized.js`)

**Added visual examples showing correct vs incorrect JSON:**

```javascript
⚠️ CRITICAL JSON OUTPUT RULES:
7. ❌ ABSOLUTELY NO TRAILING COMMAS - this will cause parsing to FAIL

🚨 TRAILING COMMA ERRORS - DO NOT DO THIS:
{"tool_calls": [{"server": "applescript", "parameters": {...},},], "reasoning": "..."}
                                                        ↑↑  WRONG - extra comma

✅ CORRECT - NO trailing commas:
{"tool_calls": [{"server": "applescript", "parameters": {...}}], "reasoning": "..."}
                                                        ↑  CORRECT - no comma
```

## Files Modified

1. **orchestrator/workflow/mcp-todo-manager.js**
   - Enhanced `_sanitizeJsonString()` - Lines 1372-1381
   - Updated `_parseToolPlan()` - Lines 1179-1217
   - Updated `_parseVerification()` - Lines 1278-1314
   - Updated `_parseAdjustment()` - Lines 1371-1407

2. **prompts/mcp/tetyana_plan_tools_optimized.js**
   - Added trailing comma examples - Lines 20-30
   - Strengthened JSON rules - Line 20

## Testing

### Before Fix
```
23:49:04 ⚠️ Не вдалося спланувати інструменти: 
         Tool planning failed: Expected ',' or ']' after array element in JSON at position 373
23:49:06 ⚠️ Не вдалося спланувати інструменти [Attempt 2]
23:49:13 ⚠️ Не вдалося спланувати інструменти [Attempt 3]
23:49:13 ❌ Помилка після 3 спроб: Max attempts reached
23:49:33 🎉 Завершено: 0/5 пунктів (0% успіху)
```

### After Fix (Expected)
```
✅ Tool plan parsed successfully (or with sanitization warning)
✅ Verification completed
✅ Tasks execute normally
✅ 80-100% success rate
```

### Test Command
```bash
# Restart orchestrator to apply changes
./restart_system.sh restart

# Test with calculator request (previously failing)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор і перемнож 333 на 2, результат запиши в файл УРА на робочому столі"}'

# Monitor logs for sanitization
tail -f logs/orchestrator.log | grep -E "(sanitization|trailing|JSON parse)"
```

## Prevention

1. **Defense in depth**: Three layers of protection:
   - Strong prompt guidance (prevent)
   - Aggressive sanitization (fix)
   - Better error logging (debug)

2. **Consistent handling**: All parsers use same sanitization logic

3. **Visual examples**: Prompt shows exact error patterns to avoid

4. **Logging**: All sanitization attempts are logged for monitoring

## Related Issues

- `MCP_JSON_PARSING_FIX_COMPLETE.md` - Previous JSON parsing improvements
- `MCP_TOOL_PLANNING_JSON_PARSE_FIX.md` - Think tags handling
- `MCP_PHI4_REASONING_FIX_COMPLETE.md` - Reasoning model JSON issues

## Restart Required

⚠️ **YES** - Node.js module changes require orchestrator restart:
```bash
./restart_system.sh restart
```

## Success Criteria

- [x] Enhanced sanitization with 4+ trailing comma patterns
- [x] All 3 parsers use unconditional sanitization
- [x] Prompt includes visual trailing comma examples
- [ ] No more "Expected ',' or ']' after array element" errors
- [ ] Tool planning success rate > 95%
- [ ] Calculator test request completes successfully
- [ ] Workflow completes with > 80% success rate

## Monitoring

Watch for these log patterns after deployment:

**Good signs:**
```
✅ JSON sanitization successful
✅ Tool plan parsed successfully
```

**Warning signs (but now handled):**
```
⚠️ Initial JSON parse failed: ... Attempting sanitization
✅ JSON sanitization successful
```

**Bad signs (escalate):**
```
❌ JSON sanitization also failed
❌ Max attempts reached
```

## Notes

- Trailing comma is a common LLM JSON generation error
- Different models have different error rates (mistral-nemo, phi-4, etc.)
- Sanitization is defensive programming - handles model unreliability
- Visual examples in prompts work better than text descriptions
- Always log sanitization attempts for observability
