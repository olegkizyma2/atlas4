#!/bin/bash
# ATLAS Comprehensive Prompts & Workflow Test
# Тестує всі стейджі та їх промпти

echo "🧪 ATLAS COMPREHENSIVE WORKFLOW TEST"
echo "════════════════════════════════════════════════════════════"
echo ""

# Кольори для виводу
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Лічильники
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Функція для виконання тесту
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name ... "
    
    if $test_command &> /tmp/atlas_test.log; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "  Error log: /tmp/atlas_test.log"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "📋 PHASE 1: Structure & Configuration Tests"
echo "────────────────────────────────────────────────────────────"

# Test 1: Audit prompts
run_test "Prompts audit" "node scripts/audit-prompts.js"

# Test 2: Quality analysis  
run_test "Prompts quality" "node scripts/analyze-prompts-quality.js"

# Test 3: Config syntax
run_test "Workflow config syntax" "node --check config/workflow-config.js"
run_test "Agents config syntax" "node --check config/agents-config.js"
run_test "Global config syntax" "node --check config/global-config.js"

echo ""
echo "📋 PHASE 2: Prompts File Tests"
echo "────────────────────────────────────────────────────────────"

# Test каждого файла промпта
for file in prompts/{atlas,tetyana,grisha,system}/stage*.js; do
    if [ -f "$file" ]; then
        basename=$(basename "$file")
        run_test "Prompt file: $basename" "node --check $file"
    fi
done

echo ""
echo "📋 PHASE 3: Context & Mode Selection Tests"
echo "────────────────────────────────────────────────────────────"

# Test context system (якщо існує)
if [ -f "tests/test-context.sh" ]; then
    run_test "Context system" "bash tests/test-context.sh"
fi

# Test mode selection
if [ -f "tests/test-mode-selection.sh" ]; then
    run_test "Mode selection" "bash tests/test-mode-selection.sh"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📊 TEST SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "🎉 System is ready for deployment!"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "⚠️  Please fix the issues above before deployment"
    exit 1
fi
