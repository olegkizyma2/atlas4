#!/bin/bash
# Test Mode Selection Context Fix
# Перевірка що система правильно розпізнає task після chat

API_URL="http://localhost:5101"
SESSION_ID="test_$(date +%s)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Mode Selection with Context...${NC}"
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Привітання (має бути chat)
echo -e "${YELLOW}Test 1: Привітання${NC}"
echo "Sending: 'Привіт'"
curl -s -X POST "$API_URL/chat/stream" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Привіт\", \"sessionId\": \"$SESSION_ID\"}" \
  > /dev/null
echo -e "${GREEN}✓${NC} Sent"
sleep 3

# Test 2: Анекдот (має бути chat)
echo -e "\n${YELLOW}Test 2: Анекдот${NC}"
echo "Sending: 'Розкажи анекдот'"
curl -s -X POST "$API_URL/chat/stream" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Розкажи анекдот\", \"sessionId\": \"$SESSION_ID\"}" \
  > /dev/null
echo -e "${GREEN}✓${NC} Sent"
sleep 3

# Test 3: Калькулятор (має бути TASK!)
echo -e "\n${YELLOW}Test 3: Відкрий калькулятор${NC}"
echo "Sending: 'відкрий мені калькулятор і набери там 888'"
curl -s -X POST "$API_URL/chat/stream" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"відкрий мені калькулятор і набери там 888\", \"sessionId\": \"$SESSION_ID\"}" \
  > /dev/null
echo -e "${GREEN}✓${NC} Sent"

echo ""
echo -e "${YELLOW}Checking logs...${NC}"
sleep 2

# Перевірка логів
echo ""
echo "Mode selections in this session:"
grep -A 2 "$SESSION_ID.*Mode selection" logs/orchestrator.log | tail -15

echo ""
echo -e "${YELLOW}Last mode selection actual message:${NC}"
grep "Mode selection actual message" logs/orchestrator.log | tail -1

echo ""
echo -e "${YELLOW}Expected result:${NC}"
echo "1. 'Привіт' → chat mode"
echo "2. 'Розкажи анекдот' → chat mode"
echo "3. 'відкрий калькулятор' → task mode (stage 1)"
