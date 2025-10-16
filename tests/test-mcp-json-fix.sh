#!/bin/bash
# Test MCP JSON Parsing Fix
# Tests that Stage 2.1 runs ONCE per item (not 3x infinite loop)

set -e

echo "🧪 Testing MCP JSON Parsing Infinite Loop Fix"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test message
TEST_MESSAGE="Створи файл на робочому столі з іменем TestMCP і напиши Hello from MCP fix test"
SESSION_ID="test_json_fix_$(date +%s)"

echo "📝 Test message: $TEST_MESSAGE"
echo "🔑 Session ID: $SESSION_ID"
echo ""

# Check if orchestrator is running
if ! curl -s http://localhost:5101/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator not running on port 5101${NC}"
    echo "Please start it first: ./restart_system.sh restart"
    exit 1
fi

echo "✅ Orchestrator is running"
echo ""

# Send test request
echo "🚀 Sending test request..."
RESPONSE=$(curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"$TEST_MESSAGE\",
    \"sessionId\": \"$SESSION_ID\"
  }")

echo "📨 Response received"
echo ""

# Wait for workflow to complete
echo "⏳ Waiting 15 seconds for workflow to complete..."
sleep 15
echo ""

# Analyze logs
echo "📊 Analyzing logs..."
echo ""

# Check Stage 2.1 count for item 1
STAGE21_COUNT=$(grep -E "Stage 2.1.*item 1" logs/orchestrator.log 2>/dev/null | tail -20 | wc -l | tr -d ' \n')
echo "Stage 2.1 count for item 1: $STAGE21_COUNT"

if [ "$STAGE21_COUNT" -eq 1 ] 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: Stage 2.1 ran ONCE (expected: 1)${NC}"
elif [ "$STAGE21_COUNT" -eq 3 ] 2>/dev/null; then
    echo -e "${RED}❌ FAIL: Stage 2.1 ran THREE TIMES (infinite loop still present!)${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Stage 2.1 ran $STAGE21_COUNT times (expected: 1)${NC}"
fi
echo ""

# Check for parse errors
PARSE_ERRORS=$(grep -c "Failed to parse tool plan" logs/orchestrator.log 2>/dev/null | tr -d ' \n' || echo "0")
echo "Parse errors: $PARSE_ERRORS"

if [ -z "$PARSE_ERRORS" ] || [ "$PARSE_ERRORS" = "0" ]; then
    echo -e "${GREEN}✅ PASS: No parse errors${NC}"
else
    echo -e "${RED}❌ FAIL: Found $PARSE_ERRORS parse errors${NC}"
fi
echo ""

# Check for Stage 2.2 execution
STAGE22_COUNT=$(grep -c "STAGE-2.2-MCP.*Executing" logs/orchestrator.log 2>/dev/null | tr -d ' \n' || echo "0")
echo "Stage 2.2 execution count: $STAGE22_COUNT"

if [ -z "$STAGE22_COUNT" ] || [ "$STAGE22_COUNT" = "0" ]; then
    echo -e "${RED}❌ FAIL: Stage 2.2 not found (workflow stuck in planning)${NC}"
else
    echo -e "${GREEN}✅ PASS: Stage 2.2 executed (workflow progressed past planning)${NC}"
fi
echo ""

# Check success rate
SUCCESS_RATE=$(grep "Success rate:" logs/orchestrator.log 2>/dev/null | tail -1 | grep -oE "[0-9]+%" || echo "N/A")
echo "Success rate: $SUCCESS_RATE"

if [[ "$SUCCESS_RATE" =~ ^(100|9[5-9]|[0-9]{3,})% ]]; then
    echo -e "${GREEN}✅ PASS: High success rate (${SUCCESS_RATE})${NC}"
elif [ "$SUCCESS_RATE" = "0%" ]; then
    echo -e "${RED}❌ FAIL: 0% success rate (items failed)${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Success rate ${SUCCESS_RATE}${NC}"
fi
echo ""

# Overall result
echo "=============================================="
if [ "$STAGE21_COUNT" = "1" ] && ([ -z "$PARSE_ERRORS" ] || [ "$PARSE_ERRORS" = "0" ]) && [ ! -z "$STAGE22_COUNT" ] && [ "$STAGE22_COUNT" != "0" ]; then
    echo -e "${GREEN}🎉 TEST PASSED: JSON parsing fix working correctly!${NC}"
    exit 0
else
    echo -e "${RED}💥 TEST FAILED: Issues detected${NC}"
    echo ""
    echo "Recommendations:"
    [ "$STAGE21_COUNT" != "1" ] && echo "  - Check _parseToolPlan() markdown cleaning"
    [ ! -z "$PARSE_ERRORS" ] && [ "$PARSE_ERRORS" != "0" ] && echo "  - Review parse error logs for details"
    [ -z "$STAGE22_COUNT" ] || [ "$STAGE22_COUNT" = "0" ] && echo "  - Verify tool execution is triggered"
    exit 1
fi
