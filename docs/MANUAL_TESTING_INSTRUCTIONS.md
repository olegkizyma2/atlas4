# 📋 MANUAL TESTING INSTRUCTIONS - MCP Dynamic TODO Workflow

**Created:** 13 жовтня 2025 - рання ніч ~05:45  
**Purpose:** Детальні інструкції для ручного тестування системи  
**Who:** Developer/QA тестер  

---

## 🎯 OVERVIEW

Цей документ містить покрокові інструкції для ручного тестування MCP Dynamic TODO Workflow System. Кожен сценарій має чіткі кроки, очікувані результати та команди для моніторингу.

---

## 🚀 PREPARATION

### 1. Start All Services

```bash
cd /workspaces/atlas4
./restart_system.sh start
./restart_system.sh status
```

**Verify all services are green:**
- ✅ Flask Frontend (port 5001)
- ✅ Orchestrator API (port 5101)
- ✅ TTS Service (port 3001)
- ✅ Whisper Service (port 3002)
- ✅ Goose Desktop (port 3000)

### 2. Open Monitoring Terminals

```bash
# Terminal 1: Orchestrator logs
tail -f logs/orchestrator.log | grep -E "MCP|TODO|Stage|Item|Circuit"

# Terminal 2: Full logs (optional)
tail -f logs/orchestrator.log

# Terminal 3: Test commands
# (keep this free for running tests)
```

### 3. Open Browser

```bash
# Open main interface
http://localhost:5001

# Open DevTools
# Right-click → Inspect → Console + Network tabs
```

---

## 📝 TEST SCENARIOS

### SCENARIO 1: Simple File Creation ⭐ (BASIC)

**Objective:** Test basic MCP workflow with single TODO item

**Request:**
```
Створи файл test.txt на Desktop з текстом Hello ATLAS
```

**Expected Flow:**

```
1. Backend Selection (Stage 0.5)
   └─ Keywords detected: "створи" → MCP mode selected
   └─ Log: [BACKEND] Selected mode: mcp

2. Atlas Planning (Stage 1-MCP)
   └─ Generates TODO with 1-2 items:
      • Create file with content
      • (optional) Verify file exists
   └─ Log: [TODO] Generated plan with X items

3. Tetyana Plan Tools (Stage 2.1-MCP)
   └─ Selects: developer__shell or filesystem MCP
   └─ Log: [TETYANA] Selected tools: [developer__shell]

4. Tetyana Execute (Stage 2.2-MCP)
   └─ Executes: echo "Hello ATLAS" > ~/Desktop/test.txt
   └─ Log: [EXECUTE] Running command: echo...

5. Grisha Verify (Stage 2.3-MCP)
   └─ Checks: File exists, content correct
   └─ Log: [VERIFY] Item #1 - SUCCESS

6. Final Summary (Stage 8-MCP)
   └─ Sends: "✅ Завдання виконано: файл створено"
   └─ Log: [SUMMARY] Workflow completed successfully
```

**How to Test:**

1. **Send request** via web chat interface
2. **Watch Terminal 1** for stage progression
3. **Check Desktop** for test.txt file
4. **Verify file content:** `cat ~/Desktop/test.txt`
5. **Check browser** for success message

**Expected Output in Terminal:**

```
[BACKEND] Analyzing request...
[BACKEND] Selected mode: mcp (keywords: створи)
[TODO] Atlas planning phase started
[TODO] Generated plan with 2 items
[TETYANA] Planning tools for Item #1...
[TETYANA] Selected: developer__shell
[EXECUTE] Item #1/2: Create file
[EXECUTE] Command: echo "Hello ATLAS" > ~/Desktop/test.txt
[EXECUTE] ✅ Success
[VERIFY] Grisha verifying Item #1...
[VERIFY] File exists: /Users/oleg/Desktop/test.txt
[VERIFY] Content correct: "Hello ATLAS"
[VERIFY] ✅ Item #1 verified
[SUMMARY] All items completed (2/2)
[SUMMARY] Workflow SUCCESS in 3.2s
```

**Success Criteria:**

- ✅ File created on Desktop
- ✅ Content matches "Hello ATLAS"
- ✅ No errors in logs
- ✅ Frontend shows success message
- ✅ TTS plays completion sound (if enabled)

**Common Issues:**

- **File not created:** Check permissions on Desktop
- **Wrong content:** Check command execution logs
- **Timeout:** Check MCP server is running

---

### SCENARIO 2: Multi-Item Workflow ⭐⭐ (INTERMEDIATE)

**Objective:** Test sequential item execution with dependencies

**Request:**
```
Знайди інфо про Tesla, створи звіт, збережи на Desktop
```

**Expected Flow:**

```
1. Backend Selection → MCP mode (keywords: знайди, створи, збережи)

2. Atlas Planning → TODO з 5 пунктів:
   Item #1: Open browser
   Item #2: Navigate to Tesla website
   Item #3: Scrape data (name, models, info)
   Item #4: Format as Markdown report
   Item #5: Save to Desktop as tesla_report.md

3. Item-by-item execution:
   
   ┌─ Item #1: Open browser
   │  ├─ Tetyana Plan → playwright__browser_open
   │  ├─ Tetyana Execute → Open Chromium
   │  ├─ Grisha Verify → Browser window open
   │  └─ TTS: "✅ Браузер відкрито" (150ms)
   
   ┌─ Item #2: Navigate to Tesla
   │  ├─ Tetyana Plan → playwright__goto
   │  ├─ Tetyana Execute → Navigate to tesla.com
   │  ├─ Grisha Verify → Page loaded successfully
   │  └─ TTS: "✅ Перейшли на сайт" (150ms)
   
   ┌─ Item #3: Scrape data
   │  ├─ Tetyana Plan → playwright__scrape
   │  ├─ Tetyana Execute → Extract text content
   │  ├─ Grisha Verify → Data collected
   │  └─ TTS: "✅ Дані зібрано" (100ms)
   
   ┌─ Item #4: Format report
   │  ├─ Tetyana Plan → developer__shell (processing)
   │  ├─ Tetyana Execute → Create Markdown
   │  ├─ Grisha Verify → Valid Markdown
   │  └─ TTS: "✅ Звіт відформатовано" (150ms)
   
   └─ Item #5: Save to Desktop
      ├─ Tetyana Plan → filesystem__write
      ├─ Tetyana Execute → Write tesla_report.md
      ├─ Grisha Verify → File exists, size > 0
      └─ TTS: "✅ Збережено на Desktop" (200ms)

4. Final Summary
   └─ TTS: "Завдання виконано на 100%" (2.5s)
```

**How to Test:**

1. **Send request** via chat
2. **Watch Terminal 1** for item progression
3. **Monitor browser** (Playwright opens Chromium)
4. **Listen to TTS** phrases (quick, sequential)
5. **Check Desktop** for tesla_report.md
6. **Read report** content

**Expected Output in Terminal:**

```
[TODO] Generated plan with 5 items
[PROGRESS] Starting Item #1/5: Open browser
[TETYANA] Tools: [playwright__browser_open]
[EXECUTE] ✅ Browser opened
[VERIFY] ✅ Item #1 verified
[TTS] Quick phrase: "Браузер відкрито" (150ms)

[PROGRESS] Starting Item #2/5: Navigate to Tesla
[TETYANA] Tools: [playwright__goto]
[EXECUTE] ✅ Navigation complete
[VERIFY] ✅ Item #2 verified
[TTS] Quick phrase: "Перейшли на сайт" (150ms)

... (items 3-5) ...

[SUMMARY] All 5 items completed
[SUMMARY] Total time: 12.8s
[TTS] Detailed phrase: "Завдання виконано на 100%" (2.5s)
```

**Success Criteria:**

- ✅ All 5 items executed sequentially
- ✅ Browser opens and navigates
- ✅ Data scraped successfully
- ✅ Report file created on Desktop
- ✅ Report contains Tesla information
- ✅ TTS phrases synchronized with items
- ✅ Total time < 30 seconds

**Common Issues:**

- **Browser crash:** Check Playwright installation
- **Scraping fails:** Website blocking, use alternative
- **File not saved:** Check write permissions

---

### SCENARIO 3: Error & Automatic Fallback ⭐⭐⭐ (ADVANCED)

**Objective:** Test error handling and automatic Goose fallback

**Setup:**
```bash
# Kill MCP filesystem server to simulate failure
pkill -f "mcp-server-filesystem"

# Or simulate network issue
# sudo iptables -A OUTPUT -p tcp --dport 3000 -j DROP
```

**Request:**
```
Створи файл error_test.txt на Desktop з текстом Test Fallback
```

**Expected Flow:**

```
1. Backend Selection → MCP mode

2. Atlas Planning → TODO generated

3. Tetyana Execute → MCP call FAILS
   └─ Error: Connection refused (MCP server down)
   └─ Log: [ERROR] MCP execution failed: ECONNREFUSED

4. Retry #1 (after 1s backoff)
   └─ Still failing
   └─ Log: [RETRY] Attempt 2/3...

5. Retry #2 (after 2s backoff)
   └─ Still failing
   └─ Log: [RETRY] Attempt 3/3...

6. Permanent Failure Detected
   └─ Log: [ERROR] Item #1 permanently failed after 3 attempts

7. Automatic Fallback to Goose
   └─ Log: [FALLBACK] MCP failed, switching to Goose backend
   └─ SSE Event: workflow_fallback
   └─ Frontend notification: "Переключаюсь на резервний режим..."

8. Goose Execution
   └─ Goose Desktop completes task successfully
   └─ File created via Goose tools

9. Final Summary
   └─ "⚠️ Завдання виконано через резервний режим"
```

**How to Test:**

1. **Kill MCP server** (see Setup above)
2. **Send request** via chat
3. **Watch errors** in Terminal 1
4. **Monitor fallback** trigger
5. **Verify file** created by Goose
6. **Restart MCP** server
7. **Test again** to verify recovery

**Expected Output in Terminal:**

```
[BACKEND] Selected mode: mcp
[TODO] Generated plan
[EXECUTE] Attempting MCP execution...
[ERROR] MCP execution failed: Connection refused
[RETRY] Exponential backoff: 1000ms
[EXECUTE] Retry attempt 2/3...
[ERROR] Still failing
[RETRY] Exponential backoff: 2000ms
[EXECUTE] Retry attempt 3/3...
[ERROR] Permanent failure detected
[FALLBACK] Triggering automatic fallback to Goose
[FALLBACK] SSE event sent to frontend
[GOOSE] Executing via Goose Desktop...
[GOOSE] ✅ Success
[SUMMARY] ⚠️ Completed via fallback mode
```

**Success Criteria:**

- ✅ MCP failures detected (3 attempts)
- ✅ Exponential backoff applied (1s, 2s, 4s)
- ✅ Automatic fallback triggered
- ✅ Frontend notification shown
- ✅ Goose completes task successfully
- ✅ File created despite MCP failure
- ✅ System continues working (no crash)

**Common Issues:**

- **No fallback:** Check executeMCPWorkflow try-catch
- **Goose also fails:** Check Goose Desktop running
- **Infinite loop:** Check max_attempts respected

---

### SCENARIO 4: Circuit Breaker Behavior ⭐⭐⭐⭐ (EXPERT)

**Objective:** Test circuit breaker pattern under repeated failures

**Setup:**
```bash
# Keep MCP server down (from Scenario 3)
pkill -f "mcp-server"
```

**Request Sequence:**
```
Request #1: "Створи файл cb_test1.txt"
Request #2: "Створи файл cb_test2.txt"
Request #3: "Створи файл cb_test3.txt"
Request #4: "Створи файл cb_test4.txt" ← Circuit should be OPEN
```

**Expected Flow:**

```
┌─ Request #1
│  ├─ MCP attempt → FAIL × 3
│  ├─ Circuit: CLOSED (failures = 1)
│  └─ Fallback to Goose → Success

┌─ Request #2
│  ├─ MCP attempt → FAIL × 3
│  ├─ Circuit: CLOSED (failures = 2)
│  └─ Fallback to Goose → Success

┌─ Request #3
│  ├─ MCP attempt → FAIL × 3
│  ├─ Circuit: TRIPS! (failures = 3) → OPEN
│  ├─ Log: [Circuit Breaker] OPEN - cooldown 60s
│  └─ Fallback to Goose → Success

└─ Request #4
   ├─ Circuit: OPEN → Skip MCP attempt!
   ├─ Log: [Circuit Breaker] OPEN - direct Goose routing
   └─ Goose execution → Success (faster, no retries)

... Wait 60 seconds ...

┌─ Request #5 (after cooldown)
   ├─ Circuit: HALF_OPEN → Test MCP
   ├─ MCP attempt → Still failing → OPEN again
   └─ Fallback to Goose

... Restart MCP server ...

┌─ Request #6 (after restart + cooldown)
   ├─ Circuit: HALF_OPEN → Test MCP
   ├─ MCP attempt → SUCCESS! → CLOSED
   └─ Resume normal MCP operation
```

**How to Test:**

1. **Ensure MCP down** (from Scenario 3)
2. **Send Request #1** → Watch failures
3. **Send Request #2** → Count failures
4. **Send Request #3** → Circuit TRIPS!
5. **Send Request #4** → Direct Goose (fast)
6. **Wait 60 seconds**
7. **Send Request #5** → Test MCP (still down)
8. **Restart MCP:** `npm install -g @modelcontextprotocol/server-filesystem`
9. **Wait 60 seconds**
10. **Send Request #6** → MCP works! Circuit CLOSED

**Expected Output in Terminal:**

```
# Request #1
[Circuit Breaker] State: CLOSED (failures: 0)
[MCP] Attempting execution...
[ERROR] × 3 failures
[Circuit Breaker] recordFailure() → failures: 1
[FALLBACK] Goose execution

# Request #2
[Circuit Breaker] State: CLOSED (failures: 1)
[MCP] Attempting execution...
[ERROR] × 3 failures
[Circuit Breaker] recordFailure() → failures: 2
[FALLBACK] Goose execution

# Request #3
[Circuit Breaker] State: CLOSED (failures: 2)
[MCP] Attempting execution...
[ERROR] × 3 failures
[Circuit Breaker] recordFailure() → failures: 3
[Circuit Breaker] THRESHOLD REACHED → OPEN
[Circuit Breaker] Cooldown until: 2025-10-13T05:50:00Z
[FALLBACK] Goose execution

# Request #4
[Circuit Breaker] State: OPEN
[Circuit Breaker] canAttempt() → false
[Circuit Breaker] Skipping MCP, direct Goose routing
[GOOSE] Execution (no retries, faster)

# After 60s + Request #5
[Circuit Breaker] State: OPEN
[Circuit Breaker] Cooldown expired → HALF_OPEN
[Circuit Breaker] Testing MCP...
[ERROR] Still failing
[Circuit Breaker] recordFailure() → OPEN again

# After restart + Request #6
[Circuit Breaker] State: HALF_OPEN
[Circuit Breaker] Testing MCP...
[MCP] ✅ Success!
[Circuit Breaker] recordSuccess() → CLOSED
[Circuit Breaker] Normal operation resumed
```

**Success Criteria:**

- ✅ Circuit trips after exactly 3 failures
- ✅ Direct Goose routing when OPEN (no MCP attempts)
- ✅ Auto-recovery after 60 seconds (HALF_OPEN)
- ✅ Test MCP in HALF_OPEN state
- ✅ Close circuit after successful test
- ✅ Resume normal MCP operation
- ✅ Faster execution when OPEN (no retries)

**Monitoring Commands:**

```bash
# Watch circuit breaker state
tail -f logs/orchestrator.log | grep -E "Circuit Breaker|failures|OPEN|CLOSED|HALF_OPEN"

# Count failures
grep "recordFailure" logs/orchestrator.log | wc -l

# Check cooldown expiry
grep "Cooldown until" logs/orchestrator.log
```

---

## 📊 PERFORMANCE MONITORING

### Response Time Measurement

```bash
# Measure end-to-end response time
time curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Створи файл perf_test.txt","sessionId":"perf"}'
```

**Benchmarks:**
- Backend Selection: < 500ms
- Atlas Planning: < 2s
- Item Execution: < 10s each
- Total Workflow: < 30s

### Memory Monitoring

```bash
# Watch memory usage
while true; do
  ps aux | grep -E "node.*orchestrator" | awk '{print $6/1024 " MB"}'
  sleep 5
done
```

**Target:** < 500MB during workflow

### Log Analysis

```bash
# Count stage transitions
grep -E "Stage [0-9]" logs/orchestrator.log | wc -l

# Count item executions
grep "Item #" logs/orchestrator.log | wc -l

# Count errors
grep -i error logs/orchestrator.log | wc -l

# Count fallbacks
grep -i fallback logs/orchestrator.log | wc -l
```

---

## 🐛 TROUBLESHOOTING

### Services Not Starting

```bash
# Check ports
lsof -ti:5001,5101,3001,3002 | xargs kill

# Restart all
./restart_system.sh restart
```

### MCP Servers Not Found

```bash
# Install MCP packages
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @executeautomation/playwright-mcp-server
npm install -g @anthropic/computer-use

# Verify
npm list -g | grep mcp
```

### Circuit Breaker Stuck OPEN

```bash
# Wait 60 seconds for auto-recovery
# Or restart orchestrator
./restart_system.sh restart
```

### Logs Not Showing

```bash
# Check log file exists
ls -lh logs/orchestrator.log

# Increase log level (edit global-config.js)
# LOG_LEVEL: 'debug'
```

---

## ✅ CHECKLIST

### Before Testing

- [ ] All services running (green status)
- [ ] MCP packages installed globally
- [ ] Goose Desktop running
- [ ] Browser open at localhost:5001
- [ ] Monitoring terminals ready
- [ ] Test files cleared from Desktop

### During Testing

- [ ] Monitor logs in real-time
- [ ] Watch browser console for errors
- [ ] Listen to TTS feedback
- [ ] Check file creation/modification
- [ ] Note response times

### After Testing

- [ ] Record all pass/fail results
- [ ] Save error logs for failures
- [ ] Document unexpected behaviors
- [ ] Update test results tracker
- [ ] Report critical issues

---

## 📝 REPORTING TEMPLATE

```markdown
# Test Results Report - [Date]

## Test Session Info
- Date: YYYY-MM-DD HH:MM
- Tester: [Name]
- System: ATLAS v4.0 MCP Workflow
- Branch: main

## Scenario Results

### Scenario 1: Simple File Creation
- Status: PASS / FAIL
- Time: X.Xs
- Notes: [any observations]

### Scenario 2: Multi-Item Workflow
- Status: PASS / FAIL
- Time: X.Xs
- Notes: [any observations]

### Scenario 3: Error & Fallback
- Status: PASS / FAIL
- Time: X.Xs
- Notes: [any observations]

### Scenario 4: Circuit Breaker
- Status: PASS / FAIL
- Time: X.Xs
- Notes: [any observations]

## Critical Issues Found
1. [Issue description]
   - Severity: HIGH / MEDIUM / LOW
   - Impact: [what breaks]
   - Steps to reproduce: [...]

## Recommendations
- [improvement suggestion 1]
- [improvement suggestion 2]

## Overall Assessment
- Total Tests: X
- Passed: X
- Failed: X
- Success Rate: XX%
```

---

## 🎯 SUCCESS METRICS

**Phase 5 Testing Complete When:**

- ✅ All 4 scenarios PASS
- ✅ No critical bugs found
- ✅ Performance benchmarks met
- ✅ Circuit breaker working correctly
- ✅ Fallback mechanism reliable
- ✅ TTS synchronization accurate
- ✅ Frontend updates in real-time
- ✅ Zero crashes or hangs

**Next Steps After Manual Testing:**

1. Run automated tests: `npm test`
2. Run E2E tests: `npm run test:e2e`
3. Performance profiling
4. User acceptance testing
5. Production deployment checklist

---

**🚀 ГОТОВІ ДО ТЕСТУВАННЯ! Починайте з Scenario 1 і звітуйте про результати!**
