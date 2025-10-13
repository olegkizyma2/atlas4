#!/bin/bash

# MCP Model Optimization Test Script
# Date: 14.10.2025
# Purpose: Restart orchestrator and test MCP workflow with new model config

set -e

echo "=================================================="
echo "MCP Model Optimization - Test Script"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop orchestrator
echo -e "${YELLOW}[1/5]${NC} Stopping orchestrator..."
pkill -f "orchestrator/server.js" || echo "Orchestrator not running"
sleep 2
echo -e "${GREEN}✓${NC} Orchestrator stopped"
echo ""

# Step 2: Verify ENV variables
echo -e "${YELLOW}[2/5]${NC} Verifying ENV configuration..."
if grep -q "MCP_MODEL_TODO_PLANNING" .env; then
    echo -e "${GREEN}✓${NC} MCP model config found in .env"
    echo ""
    echo "Model configuration:"
    grep "MCP_MODEL" .env | head -7
else
    echo -e "${RED}✗${NC} MCP model config NOT found in .env"
    echo "Please run the model optimization first"
    exit 1
fi
echo ""

# Step 3: Start orchestrator
echo -e "${YELLOW}[3/5]${NC} Starting orchestrator with new config..."
cd orchestrator
node server.js > ../logs/orchestrator.log 2>&1 &
ORCH_PID=$!
cd ..
sleep 5
echo -e "${GREEN}✓${NC} Orchestrator started (PID: $ORCH_PID)"
echo ""

# Step 4: Wait for initialization
echo -e "${YELLOW}[4/5]${NC} Waiting for orchestrator initialization..."
for i in {1..10}; do
    if grep -q "ATLAS Orchestrator fully initialized" logs/orchestrator.log 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Orchestrator initialized"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""
echo ""

# Step 5: Test MCP workflow
echo -e "${YELLOW}[5/5]${NC} Testing MCP workflow..."
echo ""

TEST_MESSAGE="Створи файл на робочому столі з іменем TestMCPModels і напиши MCP Model Optimization Test - 14.10.2025"

echo "Sending test request: $TEST_MESSAGE"
echo ""

curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$TEST_MESSAGE\", \"sessionId\": \"test_models_$(date +%s)\"}" \
  2>/dev/null

echo ""
echo ""

# Step 6: Check logs
echo "=================================================="
echo "Log Analysis"
echo "=================================================="
echo ""

echo -e "${YELLOW}Models used:${NC}"
grep "model:" logs/orchestrator.log | tail -10 || echo "No model logs found"
echo ""

echo -e "${YELLOW}Rate limits:${NC}"
if grep -q "429" logs/orchestrator.log; then
    echo -e "${RED}⚠ Rate limit detected!${NC}"
    grep "429" logs/orchestrator.log | tail -5
else
    echo -e "${GREEN}✓ No rate limits${NC}"
fi
echo ""

echo -e "${YELLOW}Success rate:${NC}"
grep "Success rate" logs/orchestrator.log | tail -3 || echo "No success rate logs yet"
echo ""

echo -e "${YELLOW}TODO items status:${NC}"
grep "Item.*failed\|Item.*completed" logs/orchestrator.log | tail -10 || echo "No item status logs yet"
echo ""

echo "=================================================="
echo "Test completed!"
echo "=================================================="
echo ""
echo "Full logs: tail -f logs/orchestrator.log"
echo ""
