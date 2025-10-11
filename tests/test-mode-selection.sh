#!/bin/bash

# Test Context-Aware Mode Selection
# Перевірка чи система розпізнає task після розмови

echo "🧪 Testing Context-Aware Mode Selection (Chat → Task Transition)"
echo "================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if orchestrator is running
if ! lsof -Pi :5101 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator is not running on port 5101${NC}"
    echo "Start with: ./restart_system.sh start"
    exit 1
fi

echo -e "${GREEN}✅ Orchestrator is running${NC}"
echo ""

# Test session ID
SESSION_ID="test_mode_selection_$(date +%s)"

echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Start with chat
echo -e "${YELLOW}Test 1: Chat message (greeting)${NC}"
curl -s -X POST http://localhost:5101/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Привіт!\", \"sessionId\": \"$SESSION_ID\"}" | jq -r '.response' | head -3
echo ""
sleep 2

# Test 2: Continue chat
echo -e "${YELLOW}Test 2: Chat message (asking for joke)${NC}"
curl -s -X POST http://localhost:5101/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Розкажи анекдот про роботів\", \"sessionId\": \"$SESSION_ID\"}" | jq -r '.response' | head -3
echo ""
sleep 2

# Test 3: Switch to task (THE CRITICAL TEST)
echo -e "${YELLOW}Test 3: TASK message (should NOT be chat!)${NC}"
echo -e "${YELLOW}Expected: Should detect as TASK and go to stage 1${NC}"
RESPONSE=$(curl -s -X POST http://localhost:5101/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Відкрий калькулятор і в ньому виконай множення 2 на 333, результат збережи на робочому столі\", \"sessionId\": \"$SESSION_ID\"}")

echo "$RESPONSE" | jq -r '.response' | head -5
echo ""

# Check logs for mode detection
echo -e "${YELLOW}Checking logs for mode detection...${NC}"
echo ""

CHAT_COUNT=$(tail -100 logs/orchestrator.log | grep -c "mode.*chat" || echo "0")
TASK_COUNT=$(tail -100 logs/orchestrator.log | grep -c "mode.*task" || echo "0")

echo "Recent mode detections in logs:"
echo "  - Chat mode: $CHAT_COUNT times"
echo "  - Task mode: $TASK_COUNT times"
echo ""

# Check if task mode was detected in last message
LAST_MODE=$(tail -50 logs/orchestrator.log | grep -i "mode" | tail -1)
echo "Last mode detection:"
echo "  $LAST_MODE"
echo ""

if echo "$LAST_MODE" | grep -q "task"; then
    echo -e "${GREEN}✅ SUCCESS: Task mode detected!${NC}"
    echo -e "${GREEN}✅ Context-aware mode selection is working!${NC}"
else
    echo -e "${RED}❌ FAILED: Task mode NOT detected${NC}"
    echo -e "${RED}❌ System still treating task request as chat${NC}"
    echo ""
    echo "Check logs/orchestrator.log for details:"
    echo "  tail -100 logs/orchestrator.log | grep -i mode"
fi

echo ""
echo "================================================================"
echo "Test completed. Review results above."
