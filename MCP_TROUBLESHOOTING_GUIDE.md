# MCP JSON Parsing Fix - Troubleshooting Guide

**DATE:** 13 жовтня 2025 - пізня ніч ~23:58  
**STATUS:** 🔧 AWAITING LOGS

---

## 🚨 Current Issue

The diagnostic script shows **NO logs** from your MCP test, which means:

1. **Orchestrator not running** OR
2. **Logs not being written** OR  
3. **Request never reached orchestrator**

---

## 📋 Step-by-Step Troubleshooting

### Step 1: Check Orchestrator Status

```bash
cd ~/Documents/GitHub/atlas4
./check-orchestrator.sh
```

This will show:
- ✅ Is orchestrator process running?
- ✅ Is health endpoint responding?
- ✅ Are logs being written?
- ✅ Can it handle a simple request?

### Step 2: Start/Restart Orchestrator (if needed)

```bash
./restart_system.sh restart
```

Wait 10-15 seconds for all services to start.

### Step 3: Verify It's Running

```bash
# Check health
curl http://localhost:5101/health

# Should return: {"status":"ok","service":"orchestrator"}
```

### Step 4: Run MCP Test Again

```bash
./test-mcp-json-fix.sh
```

### Step 5: Extract Actual Logs

```bash
./extract-mcp-diagnostic.sh
```

---

## 🔍 What to Look For

### In `check-orchestrator.sh` output:

**Good Signs:**
```
✅ Running (PID: 12345)
✅ Responding: {"status":"ok"}
✅ orchestrator.log found
✅ Request logged successfully
```

**Bad Signs:**
```
❌ NOT RUNNING
❌ Not responding
❌ orchestrator.log NOT FOUND
❌ Request NOT in logs
```

### If Orchestrator NOT Running:

```bash
# Check what's using port 5101
lsof -ti:5101

# Kill conflicting process if needed
lsof -ti:5101 | xargs kill

# Start system
./restart_system.sh start
```

### If Logs NOT Being Written:

Check logger configuration in `orchestrator/utils/logger.js`:

```bash
grep -A 10 "createLogger" orchestrator/utils/logger.js
```

Should write to `logs/orchestrator.log`.

---

## 🎯 Expected Flow

### Correct Sequence:

1. **Start orchestrator** → `./restart_system.sh start`
2. **Verify running** → `curl localhost:5101/health` → ✅ OK
3. **Run MCP test** → `./test-mcp-json-fix.sh`
4. **Check logs** → `./extract-mcp-diagnostic.sh`
5. **See actual errors** → Share output

### Current Issue:

1. Start orchestrator → ✅ (seems to work based on test)
2. Verify running → ✅ (test shows it responds)
3. Run MCP test → ✅ (returns response)
4. Check logs → ❌ **EMPTY** (no MCP workflow logs!)
5. See actual errors → ❌ **Can't diagnose without logs**

---

## 🐛 Possible Causes

### Cause #1: Logs in Different Location

Orchestrator might be writing logs elsewhere:

```bash
# Find all orchestrator.log files
find ~/Documents/GitHub/atlas4 -name "orchestrator.log" 2>/dev/null

# Find recently modified log files
find ~/Documents/GitHub/atlas4/logs -type f -mmin -10 2>/dev/null
```

### Cause #2: Logger Not Initialized

Check if logger is actually writing:

```bash
# Watch logs in real-time
tail -f ~/Documents/GitHub/atlas4/logs/orchestrator.log
```

Then in another terminal:
```bash
# Send test request
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "sessionId": "debug"}'
```

You should see logs appear immediately.

### Cause #3: Console Logging Only

Orchestrator might be logging to console, not file:

```bash
# Check if orchestrator was started with --console-log flag
ps aux | grep orchestrator
```

---

## 📊 What We Need to See

To fix the MCP infinite loop, we need these logs:

```
[SYSTEM] tetyana-plan-tools: [STAGE-2.1-MCP] Available MCP servers: ...
[SYSTEM] tetyana-plan-tools: [STAGE-2.1-MCP] Calling mcpTodoManager.planTools()...
[TODO] Planning tools for item 1
[TODO] Raw LLM response (first 200 chars): ...
[TODO] Planned X tool calls for item 1
   OR
[TODO] Failed to plan tools for item 1: [ERROR MESSAGE HERE]
```

The **ERROR MESSAGE** will tell us what's actually failing.

---

## 🔧 Quick Fixes

### Fix #1: Restart Everything

```bash
./restart_system.sh stop
sleep 5
./restart_system.sh start
sleep 15
./check-orchestrator.sh
```

### Fix #2: Force Log Directory Creation

```bash
mkdir -p ~/Documents/GitHub/atlas4/logs
touch ~/Documents/GitHub/atlas4/logs/orchestrator.log
chmod 666 ~/Documents/GitHub/atlas4/logs/orchestrator.log
```

### Fix #3: Check Logger Config

```bash
# Open logger config
cat orchestrator/utils/logger.js | grep -A 20 "transports:"
```

Should have:
```javascript
new winston.transports.File({
    filename: 'logs/orchestrator.log',
    // ...
})
```

---

## 📤 What to Share

Run these commands and share the full output:

```bash
# 1. Orchestrator status
./check-orchestrator.sh

# 2. If orchestrator is running, run MCP test
./test-mcp-json-fix.sh

# 3. Extract diagnostic logs
./extract-mcp-diagnostic.sh

# 4. Show last 100 lines of actual log
tail -100 ~/Documents/GitHub/atlas4/logs/orchestrator.log | grep -E "MCP|TODO|Stage|ERROR"
```

---

## 🎯 Next Actions

**IF** orchestrator is running and logs are being written:
→ Share `extract-mcp-diagnostic.sh` output
→ We'll identify the real error
→ Apply the correct fix

**IF** orchestrator is NOT running or logs are empty:
→ Share `check-orchestrator.sh` output  
→ We'll fix the orchestrator/logging issue first
→ Then debug MCP workflow

---

**Current status:** Waiting for orchestrator diagnostics from your Mac! 🔍
