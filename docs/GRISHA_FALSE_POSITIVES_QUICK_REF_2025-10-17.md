# Grisha False Positives - Quick Reference

## 🔴 Problem
**Items 2-5 didn't execute**, but **Grisha verified all as ✅**.  
**Root Cause:** Tool executes without exception ≠ Task actually completed.

---

## 🎯 Core Issues

### 1. **MCP Returns Result != Success**
```javascript
// What happens now:
playwright_click({ selector: ".non-existent" })
    ↓
MCP Playwright: No exception thrown
    ↓
System: success: true ✅
    ↓
Reality: Nothing clicked (element doesn't exist)
```

### 2. **Missing Metrics** (FIXED 17.10.2025)
```diff
// Was:
Successful calls: 0
Failed calls: 0
Success: ✅

// Now:
+ Successful calls: 1
+ Failed calls: 0
Success: ✅
```

### 3. **Grisha Checks Metadata, Not Reality**
```
Grisha verification:
1. Takes screenshot ✅
2. Analyzes metadata: "tool succeeded"
3. Returns: ✅ VERIFIED
                ↓
Missing: Validate WHAT'S in screenshot!
```

---

## 🔧 Fixes Needed

### Priority 1: Validate Playwright Results
```javascript
// Add to executeTools():
if (toolCall.server === 'playwright') {
    // Check result indicates actual success
    // Examples:
    // - click: verify element was found
    // - fill: verify input has value
    // - navigate: verify URL changed
}
```

### Priority 2: Enhanced Grisha Prompt
```
Current: "Verify using tools"
Needed:  "ALWAYS screenshot + describe WHAT YOU SEE + compare to criteria"
```

### Priority 3: Log Playwright Responses
```javascript
// Debug what Playwright actually returns
logger.debug('PLAYWRIGHT-RESULT', {
    tool: toolCall.tool,
    result: result,
    type: typeof result,
    keys: Object.keys(result)
});
```

---

## 📊 Impact

| Metric          | Before    | After (Expected) |
| --------------- | --------- | ---------------- |
| False Positives | 75% (3/4) | <10%             |
| User Success    | 0%        | 70-80%           |
| Debug Time      | High      | Low              |

---

## ✅ Completed
- [x] Add successful_calls/failed_calls counting (17.10.2025)

## ⏳ Next Steps
1. Log Playwright response structures
2. Implement validation layer
3. Update Grisha prompt
4. Re-test with original request

---

## 📁 Key Files
- `orchestrator/workflow/mcp-todo-manager.js:991-1070` (executeTools)
- `orchestrator/ai/mcp-manager.js:254-290` (MCP call)
- `prompts/mcp/grisha_verify_item_optimized.js` (verification prompt)

---

**Full Details:** `docs/GRISHA_FALSE_POSITIVES_ROOT_CAUSE_2025-10-17.md`
