# 🧪 PHASE 5: MCP DYNAMIC TODO WORKFLOW - TESTING PLAN

**Created:** 13 жовтня 2025 - рання ніч ~05:30  
**Phase:** Testing & Optimization  
**ETA:** 2-3 дні  
**Status:** IN PROGRESS

---

## 📋 TESTING OVERVIEW

### Testing Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: UNIT TESTS (Components)                       │
│  ├─ CircuitBreaker state transitions                    │
│  ├─ Exponential backoff timing                          │
│  ├─ Timeout protection                                  │
│  └─ Input validation                                    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: INTEGRATION TESTS (Interactions)              │
│  ├─ Backend selection routing                           │
│  ├─ MCP → Goose fallback flow                          │
│  ├─ Item retry mechanism                                │
│  ├─ SSE event emission                                  │
│  └─ Telemetry tracking                                  │
├─────────────────────────────────────────────────────────┤
│  Layer 3: E2E TESTS (Full Workflows)                    │
│  ├─ Complete TODO workflow                              │
│  ├─ Error recovery scenarios                            │
│  ├─ Circuit breaker behavior                            │
│  ├─ Real MCP server integration                         │
│  └─ Frontend-backend synchronization                    │
├─────────────────────────────────────────────────────────┤
│  Layer 4: PERFORMANCE TESTS (Optimization)              │
│  ├─ Memory usage monitoring                             │
│  ├─ Response time benchmarks                            │
│  ├─ Concurrent request handling                         │
│  └─ Load testing                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 LAYER 1: UNIT TESTS

### Test Files Created

1. **tests/unit/circuit-breaker.test.js** - CircuitBreaker pattern
2. **tests/unit/exponential-backoff.test.js** - Retry timing
3. **tests/unit/timeout-protection.test.js** - Timeout logic
4. **tests/unit/input-validation.test.js** - Data validation

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test
npm run test:unit -- circuit-breaker

# Watch mode (development)
npm run test:unit:watch
```

---

## 🔗 LAYER 2: INTEGRATION TESTS

### Test Files Created

1. **tests/integration/backend-selection.test.js** - Routing logic
2. **tests/integration/mcp-goose-fallback.test.js** - Fallback flow
3. **tests/integration/item-retry.test.js** - Retry mechanism
4. **tests/integration/sse-events.test.js** - Event emission
5. **tests/integration/telemetry.test.js** - Metrics tracking

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Requires running services
./restart_system.sh start

# Run specific test
npm run test:integration -- backend-selection
```

---

## 🌐 LAYER 3: E2E TESTS

### Test Files Created

1. **tests/e2e/complete-workflow.test.js** - Full TODO execution
2. **tests/e2e/error-recovery.test.js** - Failure scenarios
3. **tests/e2e/circuit-breaker-behavior.test.js** - Circuit breaker
4. **tests/e2e/mcp-server-integration.test.js** - Real MCP servers
5. **tests/e2e/frontend-sync.test.js** - Frontend coordination

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Requires full system running
./restart_system.sh start

# Run specific test
npm run test:e2e -- complete-workflow

# Run with video recording (Playwright)
npm run test:e2e -- --video on
```

---

## 📊 LAYER 4: PERFORMANCE TESTS

### Test Files Created

1. **tests/performance/memory-usage.test.js** - Memory monitoring
2. **tests/performance/response-time.test.js** - Latency benchmarks
3. **tests/performance/concurrent-requests.test.js** - Concurrency
4. **tests/performance/load-testing.test.js** - Load testing

### Running Performance Tests

```bash
# Run all performance tests
npm run test:performance

# Run with profiling
npm run test:performance -- --profile

# Generate performance report
npm run test:performance:report
```

---

## 🎯 MANUAL TESTING SCENARIOS

### Scenario 1: Simple File Creation

**Request:** "Створи файл test.txt на Desktop з текстом Hello ATLAS"

**Expected Flow:**
```
1. Backend Selection (Stage 0.5) → MCP mode
2. Atlas Planning (Stage 1-MCP) → TODO з 1 item
3. Tetyana Plan Tools (Stage 2.1-MCP) → developer__shell
4. Tetyana Execute (Stage 2.2-MCP) → створення файлу
5. Grisha Verify (Stage 2.3-MCP) → перевірка існування
6. Final Summary (Stage 8-MCP) → "✅ Завдання виконано"
```

**How to Test:**
```bash
# Start system
./restart_system.sh start

# Open browser
http://localhost:5001

# Send request via chat
# Watch logs
tail -f logs/orchestrator.log | grep -E "MCP|TODO|Stage"
```

---

### Scenario 2: Multi-Item Workflow

**Request:** "Знайди інфо про Tesla, створи звіт, збережи на Desktop"

**Expected Flow:**
```
1. Backend Selection → MCP mode
2. Atlas Planning → TODO з 5 пунктів:
   - Open browser
   - Scrape Tesla data
   - Format as report
   - Save to Desktop
   - Verify file
3. Item-by-item execution (5 cycles)
4. TTS synchronization (quick phrases)
5. Final summary
```

**How to Test:**
```bash
# Monitor real-time progress
tail -f logs/orchestrator.log | grep -E "Item #|progress|TTS"

# Check frontend updates
# Open DevTools → Network → SSE events
```

---

### Scenario 3: Error & Fallback

**Request:** "Зроби щось що викликає помилку в MCP"

**Expected Flow:**
```
1. Backend Selection → MCP mode
2. Atlas Planning → TODO
3. Tetyana Execute → ERROR
4. Circuit Breaker triggers (3 failures)
5. Automatic fallback to Goose
6. Goose completes task
7. Frontend notification
```

**How to Test:**
```bash
# Kill MCP server (simulate failure)
pkill -f "mcp-server"

# Send request
# Watch fallback logs
tail -f logs/orchestrator.log | grep -E "fallback|Goose|Circuit"
```

---

### Scenario 4: Circuit Breaker

**Request:** Send 3+ requests while MCP is down

**Expected Flow:**
```
1. Request 1 → MCP fail → Goose fallback
2. Request 2 → MCP fail → Goose fallback
3. Request 3 → MCP fail → Goose fallback → Circuit OPEN
4. Request 4+ → Circuit OPEN → Direct Goose (no MCP attempt)
5. After 60s → Circuit HALF_OPEN → Test MCP
6. If success → Circuit CLOSED → Resume MCP
```

**How to Test:**
```bash
# Monitor circuit breaker state
tail -f logs/orchestrator.log | grep -E "Circuit|OPEN|CLOSED|HALF_OPEN"
```

---

## 📝 TEST RESULTS TRACKING

### Manual Test Checklist

```bash
# Copy this template to track results
cat > /tmp/test-results.txt << 'EOF'
═══════════════════════════════════════════════════════════
MCP WORKFLOW TESTING RESULTS
═══════════════════════════════════════════════════════════

LAYER 1: UNIT TESTS
  [ ] CircuitBreaker transitions     Pass/Fail: ___  Notes: ___
  [ ] Exponential backoff timing     Pass/Fail: ___  Notes: ___
  [ ] Timeout protection             Pass/Fail: ___  Notes: ___
  [ ] Input validation               Pass/Fail: ___  Notes: ___

LAYER 2: INTEGRATION TESTS
  [ ] Backend selection routing      Pass/Fail: ___  Notes: ___
  [ ] MCP → Goose fallback          Pass/Fail: ___  Notes: ___
  [ ] Item retry mechanism           Pass/Fail: ___  Notes: ___
  [ ] SSE event emission             Pass/Fail: ___  Notes: ___
  [ ] Telemetry tracking             Pass/Fail: ___  Notes: ___

LAYER 3: E2E TESTS
  [ ] Complete TODO workflow         Pass/Fail: ___  Notes: ___
  [ ] Error recovery scenarios       Pass/Fail: ___  Notes: ___
  [ ] Circuit breaker behavior       Pass/Fail: ___  Notes: ___
  [ ] Real MCP server integration    Pass/Fail: ___  Notes: ___
  [ ] Frontend-backend sync          Pass/Fail: ___  Notes: ___

LAYER 4: PERFORMANCE TESTS
  [ ] Memory usage monitoring        Pass/Fail: ___  Notes: ___
  [ ] Response time benchmarks       Pass/Fail: ___  Notes: ___
  [ ] Concurrent request handling    Pass/Fail: ___  Notes: ___
  [ ] Load testing                   Pass/Fail: ___  Notes: ___

MANUAL SCENARIOS
  [ ] Simple file creation           Pass/Fail: ___  Notes: ___
  [ ] Multi-item workflow            Pass/Fail: ___  Notes: ___
  [ ] Error & fallback               Pass/Fail: ___  Notes: ___
  [ ] Circuit breaker                Pass/Fail: ___  Notes: ___

═══════════════════════════════════════════════════════════
OVERALL STATUS: ___% passing
CRITICAL ISSUES: ___
BLOCKERS: ___
NEXT STEPS: ___
═══════════════════════════════════════════════════════════
EOF

cat /tmp/test-results.txt
```

---

## 🚀 QUICK START TESTING

### 1. Install Test Dependencies

```bash
cd /workspaces/atlas4
npm install --save-dev jest @jest/globals
npm install --save-dev supertest # For API testing
npm install --save-dev @playwright/test # For E2E testing
```

### 2. Run All Tests

```bash
# One command to rule them all
npm test

# Or step by step
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
```

### 3. Watch Test Output

```bash
# Terminal 1: System logs
tail -f logs/orchestrator.log

# Terminal 2: Run tests
npm test

# Terminal 3: Monitor frontend
http://localhost:5001
```

---

## 🐛 DEBUGGING TESTS

### Common Issues

**Issue 1: Tests failing due to services not running**
```bash
# Solution: Start all services first
./restart_system.sh start
./restart_system.sh status # Verify all green
npm test
```

**Issue 2: Circuit breaker stuck in OPEN state**
```bash
# Solution: Wait 60 seconds or reset
# Edit executor-v3.js temporarily: circuitBreaker.reset()
# Or wait for auto-recovery
```

**Issue 3: MCP servers not responding**
```bash
# Solution: Check MCP packages installed
npm list -g | grep @modelcontextprotocol

# Reinstall if missing
npm install -g @modelcontextprotocol/server-filesystem
```

**Issue 4: SSE events not received in tests**
```bash
# Solution: Check EventSource connection
# Enable debug logging in test files
```

---

## 📈 SUCCESS CRITERIA

### Phase 5 Complete When:

- ✅ **All unit tests passing** (>95% coverage)
- ✅ **All integration tests passing** (>90% coverage)
- ✅ **All E2E tests passing** (>80% coverage)
- ✅ **Performance benchmarks met** (see below)
- ✅ **Manual scenarios verified** (4/4 pass)
- ✅ **Zero critical bugs**
- ✅ **Documentation complete**

### Performance Benchmarks

```
Metric                  Target      Current    Status
────────────────────────────────────────────────────────
Response Time           < 500ms     ___ms      ___
TODO Planning           < 2s        ___s       ___
Item Execution          < 10s       ___s       ___
Memory Usage            < 500MB     ___MB      ___
CPU Usage               < 50%       ___%       ___
Concurrent Requests     10+         ___        ___
Error Recovery Time     < 5s        ___s       ___
Circuit Breaker Trip    3 failures  ___        ___
```

---

## 📚 NEXT STEPS AFTER TESTING

1. **Fix Critical Bugs** - блокуючі проблеми першими
2. **Optimize Performance** - досягти targets
3. **Improve Coverage** - >90% для всіх layers
4. **Update Documentation** - based on findings
5. **Prepare for Production** - checklists, monitoring
6. **User Acceptance Testing** - real-world scenarios

---

**🎯 МЕТА Phase 5:** Довести систему до production-ready стану через комплексне тестування і оптимізацію.

**📅 TIMELINE:** 2-3 дні intensive testing + fixes

**🚀 READY TO START!**
