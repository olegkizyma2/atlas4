#!/bin/bash
# 🧪 MCP Workflow - Quick Test Runner
# Запускає вибрані тести для швидкої перевірки функціональності

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "════════════════════════════════════════════════════════════════"
echo "🧪 MCP DYNAMIC TODO WORKFLOW - QUICK TEST RUNNER"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
run_test() {
    local name=$1
    local command=$2
    
    echo -e "${BLUE}▶ Running: $name${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if eval "$command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}  ✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}  ❌ FAIL${NC}"
        echo "  Logs: /tmp/test_output.log"
        cat /tmp/test_output.log | head -20
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

check_service() {
    local name=$1
    local port=$2
    
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ $name (port $port) - RUNNING${NC}"
        return 0
    else
        echo -e "${RED}  ❌ $name (port $port) - NOT RUNNING${NC}"
        return 1
    fi
}

# ════════════════════════════════════════════════════════════════
# STEP 1: Check System Status
# ════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Checking System Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICES_OK=true

check_service "Flask Frontend" 5001 || SERVICES_OK=false
check_service "Orchestrator API" 5101 || SERVICES_OK=false
check_service "TTS Service" 3001 || SERVICES_OK=false
check_service "Whisper Service" 3002 || SERVICES_OK=false

if [ "$SERVICES_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some services are not running.${NC}"
    echo "   Start system with: ./restart_system.sh start"
    echo ""
    echo "   Continue with available tests? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 2: Unit Tests
# ════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Unit Tests (Components)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Jest is installed
if ! command -v npx &> /dev/null; then
    echo -e "${YELLOW}⚠️  npx not found. Installing test dependencies...${NC}"
    cd "$ROOT_DIR"
    npm install --save-dev jest @jest/globals
fi

# Run unit tests
run_test "CircuitBreaker State Transitions" "cd $ROOT_DIR && npx jest tests/unit/circuit-breaker.test.js --verbose"
run_test "Exponential Backoff Timing" "cd $ROOT_DIR && npx jest tests/unit/exponential-backoff.test.js --verbose"

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 3: Integration Tests (Basic)
# ════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Integration Tests (Basic)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$SERVICES_OK" = true ]; then
    run_test "DI Container Services" "node $ROOT_DIR/tests/test-di-mcp-services.js"
    run_test "Orchestrator Health Check" "curl -sf http://localhost:5101/health"
    run_test "Chat Endpoint Availability" "curl -sf http://localhost:5101/chat/stream -X POST -H 'Content-Type: application/json' -d '{\"message\":\"test\",\"sessionId\":\"test\"}' --max-time 5"
else
    echo -e "${YELLOW}⚠️  Skipping integration tests (services not running)${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 4: Manual Test Instructions
# ════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Manual Testing Instructions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'EOF'

🎯 Manual Test Scenarios:

1. Simple File Creation:
   └─ Request: "Створи файл test.txt на Desktop з текстом Hello ATLAS"
   └─ Expected: TODO → Execute → Verify → Success
   └─ Monitor: tail -f logs/orchestrator.log | grep -E "MCP|TODO"

2. Multi-Item Workflow:
   └─ Request: "Знайди інфо про Tesla, створи звіт, збережи на Desktop"
   └─ Expected: 5 items executed sequentially
   └─ Monitor: tail -f logs/orchestrator.log | grep "Item #"

3. Error & Fallback:
   └─ Action: Kill MCP server (pkill -f mcp-server)
   └─ Request: Any task request
   └─ Expected: Automatic fallback to Goose
   └─ Monitor: tail -f logs/orchestrator.log | grep fallback

4. Circuit Breaker:
   └─ Action: Send 3+ requests with MCP down
   └─ Expected: Circuit opens, direct Goose routing
   └─ Monitor: tail -f logs/orchestrator.log | grep Circuit

📊 Test in Browser:
   └─ Open: http://localhost:5001
   └─ Send requests via chat interface
   └─ Monitor: Browser DevTools → Network → SSE events

EOF

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 5: Results Summary
# ════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST RESULTS SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run full test suite: npm test"
    echo "  2. Run E2E tests: npm run test:e2e"
    echo "  3. Run manual scenarios (see above)"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Check logs at: /tmp/test_output.log"
    echo "Debug with: tail -f logs/orchestrator.log"
    exit 1
fi
