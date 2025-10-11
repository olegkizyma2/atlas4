#!/bin/bash

# Test script for Tetyana clarification workflow
# Scenario: Tetyana asks for clarification → should go to Atlas (stage 3), NOT to Grisha (stage 7)

echo "🧪 Testing Tetyana Clarification Workflow"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if orchestrator is running
if ! curl -s http://localhost:5101/health > /dev/null; then
  echo -e "${RED}❌ Orchestrator not running. Start it first:${NC}"
  echo "   ./restart_system.sh start"
  exit 1
fi

echo "✅ Orchestrator is running"
echo ""

# Clear logs for clean test
> logs/orchestrator.log

echo "📝 Sending test message that will require clarification..."
echo "   Message: 'найди steem программа для ігор для цього мак і заінсталюй його'"
echo ""

# Send message
SESSION_ID="test_clarification_$(date +%s)"

curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"найди steem программа для ігор для цього мак і заінсталюй його\", \"sessionId\": \"$SESSION_ID\"}" \
  --no-buffer \
  2>/dev/null &

CURL_PID=$!

# Wait for workflow to complete (max 60 seconds)
echo "⏳ Waiting for workflow to complete..."
sleep 60

# Kill curl if still running
kill $CURL_PID 2>/dev/null

echo ""
echo "🔍 Analyzing logs..."
echo ""

# Check the workflow flow
STAGE_2_DECISION=$(grep -i "Stage 2 decision: Tetyana needs clarification" logs/orchestrator.log | tail -1)
WENT_TO_STAGE_3=$(grep -i "Starting stage 3: clarification" logs/orchestrator.log | wc -l | tr -d ' ')
WENT_TO_STAGE_7=$(grep -i "Starting stage 7: verification" logs/orchestrator.log | wc -l | tr -d ' ')
TETYANA_ASKS=$(grep -i "atlas.*уточн\|не вдалос\|можу продовж" logs/orchestrator.log | wc -l | tr -d ' ')

echo "📊 Results:"
echo "=========="
echo ""

if [ ! -z "$STAGE_2_DECISION" ]; then
  echo -e "✅ Stage 2 decision logic triggered"
  echo "   $STAGE_2_DECISION"
else
  echo -e "${RED}❌ Stage 2 decision logic NOT found in logs${NC}"
fi
echo ""

echo "Tetyana requests clarification: $TETYANA_ASKS times"
echo "Went to Stage 3 (Atlas clarification): $WENT_TO_STAGE_3 times"
echo "Went to Stage 7 (Grisha verification): $WENT_TO_STAGE_7 times"
echo ""

# Determine success
SUCCESS=true

if [ "$WENT_TO_STAGE_3" -gt 0 ]; then
  echo -e "${GREEN}✅ PASS: Workflow correctly went to Stage 3 (Atlas clarification)${NC}"
else
  echo -e "${RED}❌ FAIL: Should have gone to Stage 3 but didn't${NC}"
  SUCCESS=false
fi

if [ "$WENT_TO_STAGE_7" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Also went to Stage 7 (after clarification) - this is OK if after stage 3→4${NC}"
fi

echo ""
echo "📋 Full workflow trace:"
echo "======================"
grep -E "Starting stage|Stage.*decision" logs/orchestrator.log | tail -20

echo ""
echo "🔎 Tetyana's responses:"
echo "======================"
grep -A 2 "ТЕТЯНА" logs/orchestrator.log | tail -10

echo ""
if [ "$SUCCESS" = true ]; then
  echo -e "${GREEN}✅ TEST PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ TEST FAILED${NC}"
  exit 1
fi
