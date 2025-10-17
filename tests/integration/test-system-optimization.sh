#!/bin/bash
# Integration test for ATLAS v5.0 optimizations
# Tests vision caching, MCP tool loading, parameter correction, and stability

set -e

echo "🧪 ATLAS v5.0 - Integration Test Suite"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_feature() {
    local name="$1"
    local command="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing: $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Vision Analysis Service exists
echo "📋 Test Group 1: Vision Service"
test_feature "Vision service file exists" \
    "test -f orchestrator/services/vision-analysis-service.js"

test_feature "Vision service has cache" \
    "grep -q 'this.cache = new Map' orchestrator/services/vision-analysis-service.js"

test_feature "Vision service has circuit breaker" \
    "grep -q 'this.circuitBreakers' orchestrator/services/vision-analysis-service.js"

test_feature "Vision service has retry logic" \
    "grep -q '_callVisionAPIWithRetry' orchestrator/services/vision-analysis-service.js"

echo ""

# Test 2: MCP Manager optimizations
echo "📋 Test Group 2: MCP Manager"
test_feature "MCP manager has tools cache" \
    "grep -q 'this.toolsCache' orchestrator/ai/mcp-manager.js"

test_feature "MCP manager has stats tracking" \
    "grep -q 'this.toolStats' orchestrator/ai/mcp-manager.js"

test_feature "MCP manager has validation" \
    "grep -q '_validateParameters' orchestrator/ai/mcp-manager.js"

echo ""

# Test 3: Parameter auto-correction
echo "📋 Test Group 3: Parameter Auto-Correction"
test_feature "Auto-correction method exists" \
    "grep -q '_autoCorrectParameters' orchestrator/workflow/mcp-todo-manager.js"

test_feature "Playwright corrections configured" \
    "grep -q 'playwright_fill' orchestrator/workflow/mcp-todo-manager.js"

test_feature "AppleScript corrections configured" \
    "grep -q 'applescript_execute' orchestrator/workflow/mcp-todo-manager.js"

echo ""

# Test 4: Circuit breaker implementation
echo "📋 Test Group 4: Circuit Breaker"
test_feature "Circuit breaker file exists" \
    "test -f orchestrator/utils/circuit-breaker.js"

test_feature "Circuit breaker has states" \
    "grep -q 'CircuitState.CLOSED' orchestrator/utils/circuit-breaker.js"

test_feature "Circuit breaker has metrics" \
    "grep -q 'getMetrics' orchestrator/utils/circuit-breaker.js"

test_feature "Circuit breaker has recovery" \
    "grep -q '_scheduleRecovery' orchestrator/utils/circuit-breaker.js"

echo ""

# Test 5: Session history cleanup
echo "📋 Test Group 5: Memory Management"
test_feature "Session history cleanup exists" \
    "grep -q 'Trimmed session.history' orchestrator/workflow/executor-v3.js"

test_feature "ChatThread cleanup exists" \
    "grep -q 'Trimmed chatThread' orchestrator/workflow/executor-v3.js"

test_feature "History limit is 20" \
    "grep -q 'slice(-20)' orchestrator/workflow/executor-v3.js"

echo ""

# Test 6: Prompt system
echo "📋 Test Group 6: Prompt System"
test_feature "Grisha visual verification prompt exists" \
    "test -f prompts/mcp/grisha_visual_verify_item.js"

test_feature "Dynamic tools substitution in prompts" \
    "grep -q '{{AVAILABLE_TOOLS}}' prompts/mcp/tetyana_plan_tools_optimized.js"

test_feature "Tetyana plan tools is optimized" \
    "grep -q 'OPTIMIZED' prompts/mcp/tetyana_plan_tools_optimized.js"

echo ""

# Test 7: ESLint passes
echo "📋 Test Group 7: Code Quality"
test_feature "ESLint config exists" \
    "test -f eslint.config.js"

test_feature "No critical ESLint errors" \
    "npx eslint orchestrator/services/vision-analysis-service.js --max-warnings 5"

echo ""

# Final summary
echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo "Total tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
