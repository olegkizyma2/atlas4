# MCP JSON Parsing Fix - Diagnostic Update

**DATE:** 13 жовтня 2025 - пізня ніч ~23:55  
**STATUS:** 🔍 INVESTIGATING - Need more logs

---

## 🔍 Current Findings

### What We Know:
1. ✅ Stage 2.1 runs 3 times per item (infinite loop confirmed)
2. ✅ **NO parse errors** in logs (parsing is working!)
3. ✅ Stage 2.2 never executes (stuck in planning)
4. ✅ 0% success rate (all items fail)

### What This Means:
The markdown cleaning fix **IS working** (no parse errors), but there's **ANOTHER error** causing the retry loop.

---

## 🐛 Root Cause (Updated)

The retry happens in `orchestrator/workflow/executor-v3.js`:

```javascript
// Lines 293-299
if (!planResult.success) {
    logger.warn(`Tool planning failed for item ${item.id}: ${planResult.error}`, {
      sessionId: session.id
    });
    attempt++;
    continue;  // <--- RETRY LOOP
}
```

### Call Chain:
```
executor-v3.js (executeMCPWorkflow)
  → TetyanaПlanToolsProcessor.execute()
    → MCPTodoManager.planTools()
      → axios.post() → LLM
        → _parseToolPlan() ✅ WORKS (no parse errors)
          → Return plan { tool_calls: [...], reasoning: '...' }
            → ??? SOMETHING FAILS HERE ???
              → Stage processor returns { success: false }
                → Executor retries (attempt++)
```

---

## 🔧 Possible Issues

### 1. Empty tool_calls Array
The LLM might be returning `{ tool_calls: [], reasoning: '...' }` which parses successfully but has no tools.

**Fixed in latest update:**
```javascript
// orchestrator/workflow/mcp-todo-manager.js (~line 360)
if (!plan.tool_calls || plan.tool_calls.length === 0) {
    this.logger.warn('mcp-todo', `[TODO] Warning: No tool calls in plan!`);
    throw new Error('No tool calls generated - plan is empty');
}
```

### 2. Invalid Tool Validation
The stage processor validates the plan against available tools. If tools don't match, it might fail silently.

### 3. axios.post() Failure
The API call to `http://localhost:4000/v1/chat/completions` might be failing (timeout, connection refused, etc).

### 4. LLM Response Format
The LLM might be returning JSON but with wrong structure (no `tool_calls` key, wrong format, etc).

---

## 📋 Next Steps - What to Check on Mac

### 1. Check Orchestrator Logs (CRITICAL)
```bash
tail -f ~/Documents/GitHub/atlas4/logs/orchestrator.log | grep -A 10 "Failed to plan tools"
```

Look for the **ACTUAL error message** that's causing the retry.

### 2. Check Raw LLM Response
The diagnostic logging now includes:
```
[TODO] Raw LLM response (first 200 chars): ...
```

Look for this in logs to see what the LLM is actually returning.

### 3. Check if Port 4000 API is Running
```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "test"}],
    "temperature": 0.2,
    "max_tokens": 100
  }'
```

Should return JSON with a completion.

### 4. Check for Empty Tool Calls
```bash
grep "No tool calls generated" ~/Documents/GitHub/atlas4/logs/orchestrator.log
```

If this appears, the LLM is returning empty `tool_calls` array.

### 5. Check Stage Processor Error
```bash
grep "Tool planning failed for item" ~/Documents/GitHub/atlas4/logs/orchestrator.log | tail -5
```

This will show the actual error from the stage processor.

---

## 🔧 Files Updated (Latest)

1. ✅ `orchestrator/workflow/mcp-todo-manager.js`
   - Added markdown cleaning in 3 parsing methods
   - Added diagnostic logging for raw LLM responses
   - Added validation for empty tool_calls array
   - Added error stack logging

2. ✅ `orchestrator/workflow/stages/tetyana-plan-tools-processor.js`
   - Added diagnostic logging before/after planTools() call
   - Shows what plan is returned (first 300 chars)

---

## 🎯 Expected Next Actions

Once you provide the **actual error message** from the logs, we can:

1. If "No tool calls generated" → Fix the **prompt** or **LLM model**
2. If "axios ECONNREFUSED" → Fix the **API server** connection
3. If "Tool XXX not found" → Fix the **tool validation** logic
4. If parsing error → Apply more **cleaning patterns**

---

**AWAITING: Actual error logs from orchestrator.log** 🔍
