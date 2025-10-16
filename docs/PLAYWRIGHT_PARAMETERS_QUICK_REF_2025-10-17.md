# Playwright Parameter Quick Reference - 17.10.2025

## ✅ ПРАВИЛЬНІ ПАРАМЕТРИ

### playwright_fill
```javascript
✅ CORRECT:
{
  "server": "playwright",
  "tool": "playwright_fill",
  "parameters": {
    "selector": "[name='q']",
    "value": "Хатіко фільм"  // ✅ value
  }
}

❌ WRONG (але auto-corrected):
{
  "parameters": {
    "selector": "[name='q']",
    "text": "Хатіко фільм"      // ❌ text → auto-corrected to value
    "input": "Хатіко фільм"    // ❌ input → auto-corrected to value
    "content": "Хатіко фільм"  // ❌ content → auto-corrected to value
  }
}
```

### playwright_click
```javascript
✅ CORRECT:
{
  "server": "playwright",
  "tool": "playwright_click",
  "parameters": {
    "selector": "button[type='submit']"  // ✅ selector only
  }
}

❌ WRONG (але auto-corrected):
{
  "parameters": {
    "element": "button"   // ❌ element → auto-corrected to selector
    "target": "button"    // ❌ target → auto-corrected to selector
  }
}
```

### playwright_navigate
```javascript
✅ CORRECT:
{
  "server": "playwright",
  "tool": "playwright_navigate",
  "parameters": {
    "url": "https://www.google.com"  // ✅ url
  }
}

❌ WRONG (але auto-corrected):
{
  "parameters": {
    "link": "https://google.com"     // ❌ link → auto-corrected to url
    "address": "https://google.com"  // ❌ address → auto-corrected to url
  }
}
```

### playwright_get_visible_text
```javascript
✅ CORRECT:
{
  "server": "playwright",
  "tool": "playwright_get_visible_text",
  "parameters": {
    "selector": ".search-results"  // ✅ selector
  }
}

❌ WRONG (але auto-corrected):
{
  "parameters": {
    "element": ".results"  // ❌ element → auto-corrected to selector
  }
}
```

### playwright_screenshot
```javascript
✅ CORRECT:
{
  "server": "playwright",
  "tool": "playwright_screenshot",
  "parameters": {
    "path": "/tmp/screenshot.png"  // ✅ path
  }
}
```

---

## 🔧 AUTO-CORRECTION RULES

**Location:** `orchestrator/workflow/mcp-todo-manager.js` (executeTools method)

**Corrected mappings:**
1. `text` → `value` (playwright_fill)
2. `input` → `value` (playwright_fill)
3. `content` → `value` (playwright_fill)
4. `element` → `selector` (playwright_click, playwright_get_visible_text)
5. `target` → `selector` (playwright_click)
6. `link` → `url` (playwright_navigate)
7. `address` → `url` (playwright_navigate)

**Warning logs when corrected:**
```
⚠️ Auto-corrected playwright_fill: 'text' → 'value' (value="Хатіко")
```

---

## 📋 DEBUGGING CHECKLIST

**When Playwright command fails:**

1. **Check logs for auto-correction:**
   ```bash
   grep "Auto-corrected" logs/orchestrator.log
   ```

2. **Check actual parameters sent:**
   ```bash
   grep "\[TOOL-PARAMS\]" logs/orchestrator.log | tail -5
   ```

3. **Check result structure:**
   ```bash
   grep "\[TOOL-RESULT\]" logs/orchestrator.log | tail -5
   ```

4. **Common issues:**
   - ❌ Selector not found → check CSS selector validity
   - ❌ Element not visible → check page load state
   - ❌ Wrong parameter name → auto-correction logs show warning
   - ❌ Missing parameter → error thrown

---

## 🎯 BEST PRACTICES

### For LLM Prompts:
- ✅ Always include Playwright examples in system prompts
- ✅ Explicitly specify parameter names (value, selector, url)
- ✅ Add warnings about common mistakes

### For Debugging:
- ✅ Enable debug logging: `LOG_LEVEL=debug`
- ✅ Check [TOOL-PARAMS] before execution
- ✅ Check [TOOL-RESULT] after execution
- ✅ Monitor auto-correction warnings

### For Development:
- ✅ Trust auto-correction but monitor frequency
- ✅ Update prompts if corrections too frequent
- ✅ Add validation layer for critical operations
- ✅ Log all parameter transformations

---

## 🔗 RELATED FILES

- **Prompt with examples:** `prompts/mcp/tetyana_plan_tools_optimized.js`
- **Auto-correction logic:** `orchestrator/workflow/mcp-todo-manager.js` (lines ~1015-1075)
- **Diagnostic logging:** `orchestrator/workflow/mcp-todo-manager.js` (lines ~1076-1090)
- **Full documentation:** `docs/PLAYWRIGHT_PARAMETER_FIX_2025-10-17.md`
- **Root cause analysis:** `docs/GRISHA_FALSE_POSITIVES_ROOT_CAUSE_2025-10-17.md`

---

**Last Updated:** 17.10.2025 ~02:00  
**Status:** ✅ IMPLEMENTED (auto-correction + logging)
