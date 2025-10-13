#!/bin/bash

# Test MCP Dynamic TODO Workflow
# Date: 2025-10-13

echo "🧪 Testing MCP Dynamic TODO Workflow..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_mcp() {
    local test_name="$1"
    local disable_fallback="$2"
    local message="$3"
    
    echo -e "${YELLOW}📋 Test: ${test_name}${NC}"
    echo "   Disable Fallback: ${disable_fallback}"
    echo "   Message: ${message}"
    echo ""
    
    # Set ENV
    export AI_BACKEND_MODE=mcp
    export AI_BACKEND_DISABLE_FALLBACK="${disable_fallback}"
    
    # Make request
    response=$(curl -s -X POST http://localhost:5101/chat/stream \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"${message}\", \"sessionId\": \"test_$(date +%s)\"}" \
        2>&1)
    
    # Check response
    if echo "$response" | grep -q "workflow_error"; then
        echo -e "${RED}❌ ERROR: MCP failed with no fallback${NC}"
        echo "$response" | grep "workflow_error"
    elif echo "$response" | grep -q "workflow_fallback"; then
        echo -e "${YELLOW}⚠️  FALLBACK: MCP failed, fell back to Goose${NC}"
        echo "$response" | grep "workflow_fallback"
    elif echo "$response" | grep -q "TODO"; then
        echo -e "${GREEN}✅ SUCCESS: MCP TODO created${NC}"
        echo "$response" | grep -i "todo" | head -n 2
    else
        echo -e "${RED}❌ UNKNOWN: Check logs${NC}"
    fi
    
    echo ""
    echo "---"
    echo ""
}

# Test 1: Strict mode - Simple task
echo "════════════════════════════════════════"
echo "Test 1: Strict Mode (should succeed)"
echo "════════════════════════════════════════"
test_mcp "Simple task with strict mode" "true" "Створи файл test.txt на Desktop з текстом Hello World"

# Test 2: Safe mode - Simple task
echo "════════════════════════════════════════"
echo "Test 2: Safe Mode (should succeed)"
echo "════════════════════════════════════════"
test_mcp "Simple task with safe mode" "false" "Створи файл test2.txt на Desktop"

# Test 3: Complex task
echo "════════════════════════════════════════"
echo "Test 3: Complex Task"
echo "════════════════════════════════════════"
test_mcp "Complex task" "false" "Знайди інформацію про Tesla на Wikipedia, створи звіт та збережи на Desktop"

echo ""
echo "🏁 Tests completed!"
echo ""
echo "Check logs for detailed information:"
echo "  tail -f logs/orchestrator.log | grep -E '(MCP|TODO|fallback)'"
