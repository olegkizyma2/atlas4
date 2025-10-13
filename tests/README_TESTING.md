# 🧪 ATLAS Testing System - Phase 5

**Updated:** 13 жовтня 2025 - рання ніч ~05:50  
**Status:** Ready for testing  

---

## 🎯 QUICK START (30 seconds)

```bash
# One command to install & test everything
./tests/quick-start-testing.sh
```

This will:
1. ✅ Install test dependencies (Jest)
2. ✅ Check system services
3. ✅ Run smoke tests
4. ✅ Show next steps

---

## 📋 TESTING LAYERS

### ✅ Layer 1: Unit Tests
```bash
npm run test:unit
```
- CircuitBreaker (13 tests) ✅
- Exponential Backoff (11 tests) ✅
- Timeout protection ⏳
- Input validation ⏳

**Target:** >95% coverage

### ⏳ Layer 2: Integration Tests
```bash
npm run test:integration
```
- Backend selection
- MCP → Goose fallback
- Item retry mechanism
- SSE events
- Telemetry

**Prerequisites:** `./restart_system.sh start`

### ⏳ Layer 3: E2E Tests
```bash
npm run test:e2e
```
- Complete workflows
- Error recovery
- Circuit breaker
- MCP integration

### ⏳ Layer 4: Performance
```bash
npm run test:performance
```
- Response time < 500ms
- Memory < 500MB
- Benchmarks

---

## 🧪 MANUAL TESTING

**Full guide:** `docs/MANUAL_TESTING_INSTRUCTIONS.md`

### 4 Key Scenarios

1. **Simple File** ⭐  
   `"Створи файл test.txt на Desktop"`

2. **Multi-Item** ⭐⭐  
   `"Знайди інфо про Tesla, створи звіт"`

3. **Error Fallback** ⭐⭐⭐  
   Kill MCP → Auto Goose fallback

4. **Circuit Breaker** ⭐⭐⭐⭐  
   3+ failures → Circuit OPEN → Recovery

---

## 📊 MONITORING

```bash
# Real-time logs
tail -f logs/orchestrator.log | grep -E "MCP|Circuit"

# Service status
watch -n 5 './restart_system.sh status'

# Browser
http://localhost:5001 + DevTools
```

---

## 📁 STRUCTURE

```
tests/
├── quick-start-testing.sh    # ← Start here!
├── test-mcp-workflow.sh      # Main runner
├── unit/                     # Components
├── integration/              # Interactions
├── e2e/                      # Full workflows
├── performance/              # Benchmarks
└── Legacy (context, voice)
```

---

## 🔧 COMMANDS

```bash
npm test               # Unit + Integration
npm run test:all       # All layers
npm run test:quick     # Quick smoke
npm run test:watch     # TDD mode

# Specific
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
```

---

## 📚 DOCS

- **Testing Plan:** `docs/PHASE_5_TESTING_PLAN.md`
- **Manual Instructions:** `docs/MANUAL_TESTING_INSTRUCTIONS.md`
- **Main Guide:** `.github/copilot-instructions.md`

---

## 🚀 START NOW!

```bash
./tests/quick-start-testing.sh
```

**Questions?** → `docs/MANUAL_TESTING_INSTRUCTIONS.md`
