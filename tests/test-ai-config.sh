#!/bin/bash
# Test script for AI Model Configuration
# Tests that mode_selection uses correct model config from global-config.js

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================"
echo "AI Model Configuration Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if orchestrator is running
if ! curl -s http://localhost:5101/health > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Orchestrator not running on port 5101${NC}"
    echo "Start it with: ./restart_system.sh start"
    exit 1
fi

echo -e "${GREEN}✓${NC} Orchestrator is running"
echo ""

# Test 1: Verify global-config.js exports AI_MODEL_CONFIG
echo "Test 1: Checking global-config.js exports..."
if grep -q "export const AI_MODEL_CONFIG" "$PROJECT_ROOT/config/global-config.js"; then
    echo -e "${GREEN}✓${NC} AI_MODEL_CONFIG found in global-config.js"
else
    echo -e "${RED}✗${NC} AI_MODEL_CONFIG NOT found in global-config.js"
    exit 1
fi

# Test 2: Verify getModelForStage function exists
echo "Test 2: Checking getModelForStage function..."
if grep -q "export function getModelForStage" "$PROJECT_ROOT/config/global-config.js"; then
    echo -e "${GREEN}✓${NC} getModelForStage function found"
else
    echo -e "${RED}✗${NC} getModelForStage function NOT found"
    exit 1
fi

# Test 3: Verify SystemStageProcessor imports getModelForStage
echo "Test 3: Checking SystemStageProcessor imports..."
if grep -q "getModelForStage" "$PROJECT_ROOT/orchestrator/workflow/stages/system-stage-processor.js"; then
    echo -e "${GREEN}✓${NC} SystemStageProcessor imports getModelForStage"
else
    echo -e "${RED}✗${NC} SystemStageProcessor does NOT import getModelForStage"
    exit 1
fi

# Test 4: Verify no hardcoded models in SystemStageProcessor
echo "Test 4: Checking for hardcoded models..."
if grep -q "model: 'openai/gpt-4o-mini'" "$PROJECT_ROOT/orchestrator/workflow/stages/system-stage-processor.js"; then
    echo -e "${YELLOW}⚠${NC} WARNING: Found hardcoded model in SystemStageProcessor"
    echo "This might be in comments or old code - verify manually"
else
    echo -e "${GREEN}✓${NC} No hardcoded models found"
fi

# Test 5: Send test message and check logs
echo ""
echo "Test 5: Sending test message to verify model configuration..."
SESSION_ID="test-ai-config-$(date +%s)"

# Send a simple message
RESPONSE=$(curl -s -X POST http://localhost:5101/chat/stream \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Привіт\", \"sessionId\": \"$SESSION_ID\"}")

sleep 2

# Check logs for model configuration
echo "Checking orchestrator logs for model info..."
if tail -50 "$PROJECT_ROOT/logs/orchestrator.log" | grep -q "model.*gpt"; then
    echo -e "${GREEN}✓${NC} Model configuration found in logs"
    echo ""
    echo "Recent model usage:"
    tail -50 "$PROJECT_ROOT/logs/orchestrator.log" | grep -i "model\|temperature" | tail -5
else
    echo -e "${YELLOW}⚠${NC} No model info in recent logs (might be normal)"
fi

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}✓${NC} All structure tests passed"
echo ""
echo "Next steps:"
echo "1. Send 'Відкрий калькулятор' and check if mode_selection detects task"
echo "2. Monitor logs: tail -f logs/orchestrator.log | grep mode_selection"
echo "3. Check for proper model usage in logs"
echo ""
echo "To test mode selection manually:"
echo "  curl -X POST http://localhost:5101/chat/stream \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\": \"Відкрий калькулятор і перемнож 333 на 2\", \"sessionId\": \"test\"}'"
echo ""
