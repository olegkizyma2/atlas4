# Screenshot & Adjustment Feature - Quick Reference

**Version:** 4.2.0 | **Date:** 16.10.2025 | **Stage:** 2.1.5-MCP

## 🎯 Що змінилось?

**БУЛО:**
```
Stage 2.1: Plan Tools → Stage 2.2: Execute Tools
```

**СТАЛО:**
```
Stage 2.1: Plan Tools 
  ↓
🆕 Stage 2.1.5: Screenshot + Adjust (NEW!)
  ↓
Stage 2.2: Execute Tools (maybe adjusted plan)
```

## 📸 Що робить Stage 2.1.5?

1. **Робить скріншот** (playwright або shell)
2. **Аналізує** - чи відповідає plan реальності
3. **Коригує** план якщо потрібно
4. **Або залишає** план як є

## ✅ Коли корегує?

- 🔴 Програма вже відкрита
- 🔴 UI елементи інші
- 🔴 Деякі кроки зайві
- 🔴 Швидший шлях існує

## 🎤 TTS Feedback

- "Скрін готовий" - корекція НЕ потрібна (100ms)
- "Коригую план" - корекція потрібна (200ms)

## 📄 Файли

- `prompts/mcp/tetyana_screenshot_and_adjust.js` - новий промпт
- `orchestrator/workflow/mcp-todo-manager.js` - 3 нові методи:
  - `screenshotAndAdjust(plan, item)`
  - `_takeShellScreenshot(itemId)`
  - `_parseScreenshotAdjustment(response)`

## 🔧 Приклад використання

```javascript
// У executeItemWithRetry:
const plan = await this.planTools(item, todo, {...});

// 🆕 NEW STEP:
const screenshotResult = await this.screenshotAndAdjust(plan, item);
const finalPlan = screenshotResult.plan;  // Maybe adjusted!

const execution = await this.executeTools(finalPlan, item);
```

## 📊 Output JSON

```json
{
  "screenshot_taken": true,
  "screenshot_analysis": "short description",
  "needs_adjustment": true/false,
  "adjustment_reason": "...",      // if needs_adjustment=true
  "adjusted_plan": {...},          // if needs_adjustment=true
  "tts_phrase": "..."
}
```

## ⚡ Performance

- **Overhead:** ~1.5-2.5 sec per item
- **Benefit:** Менше помилок → швидше overall
- **Net:** Позитивний impact

## 🛡️ Error Handling

```javascript
// Screenshot failed? → Continue with original plan
// JSON parse failed? → Continue with original plan
// SYSTEM NEVER BLOCKS!
```

## 🧪 Test Examples

**Example 1: Skip unnecessary step**
```
Plan: [Open Calculator, Type 5+5]
Screenshot: Calculator already open
Adjusted: [Type 5+5]  // Skip "Open"
```

**Example 2: No adjustment needed**
```
Plan: [Open VSCode, Create file]
Screenshot: Clean desktop
Adjusted: None (plan is correct)
```

## 🎓 Critical Rules

1. ✅ ЗАВЖДИ screenshot перед execute
2. ✅ Playwright preferred (shell fallback)
3. ✅ JSON-only output (no markdown!)
4. ✅ Graceful degradation при помилках
5. ✅ Коригувати ТІЛЬКИ якщо потрібно

---

**Status:** ✅ READY | **Agent:** Tetyana | **Temperature:** 0.2
