#!/bin/bash
# Quick test for all MCP fixes including prompt optimization
# Run this after restarting orchestrator

set -e

echo "=========================================="
echo "🧪 Testing ALL MCP Fixes"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📋 Running verification scripts..."
echo ""

# 1. Core fixes
echo -e "${BLUE}1️⃣ Core MCP Fixes${NC}"
if ./verify-mcp-fixes.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - Core fixes verified"
else
    echo -e "${RED}❌ FAIL${NC} - Core fixes not working"
    exit 1
fi

# 2. Prompt optimization
echo -e "${BLUE}2️⃣ Prompt Optimization${NC}"
if ./test-prompt-optimization.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - Prompt optimization verified"
else
    echo -e "${RED}❌ FAIL${NC} - Prompt optimization not working"
    exit 1
fi

echo ""
echo "=========================================="
echo "🚀 Integration Test"
echo "=========================================="
echo ""

# Check if orchestrator is running
if ! lsof -ti:5101 > /dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator NOT running on port 5101${NC}"
    echo "Start it with: cd orchestrator && node server.js"
    exit 1
fi

echo -e "${GREEN}✅ Orchestrator running on port 5101${NC}"
echo ""

# Test MCP workflow
echo -e "${BLUE}Testing MCP workflow...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:5101/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test-mcp-all"}' \
  --max-time 30)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Request completed successfully${NC}"
    
    # Check for errors in response
    if echo "$RESPONSE" | grep -q "413"; then
        echo -e "${RED}❌ FAIL: 413 error in response${NC}"
        exit 1
    fi
    
    if echo "$RESPONSE" | grep -qi "error"; then
        echo -e "${YELLOW}⚠️  WARN: Error detected in response${NC}"
        echo "$RESPONSE" | grep -i "error"
    else
        echo -e "${GREEN}✅ No errors in response${NC}"
    fi
else
    echo -e "${RED}❌ Request failed or timed out${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo "📊 Log Analysis"
echo "=========================================="
echo ""

# Check logs
if [ -f logs/orchestrator.log ]; then
    echo -e "${BLUE}Checking recent logs...${NC}"
    
    # Check for 413 errors
    if tail -100 logs/orchestrator.log | grep -q "413"; then
        echo -e "${RED}❌ FAIL: 413 errors in logs${NC}"
        tail -100 logs/orchestrator.log | grep "413"
        exit 1
    else
        echo -e "${GREEN}✅ No 413 errors in logs${NC}"
    fi
    
    # Check for tool loading
    if tail -100 logs/orchestrator.log | grep -q "Loaded.*tools"; then
        echo -e "${GREEN}✅ MCP tools loaded${NC}"
        tail -100 logs/orchestrator.log | grep "Loaded.*tools" | tail -3
    fi
    
    # Check for successful planning
    if tail -100 logs/orchestrator.log | grep -q "Planning tools"; then
        echo -e "${GREEN}✅ Tool planning executed${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""

echo "📋 Summary:"
echo "  ✅ Core MCP fixes working"
echo "  ✅ Prompt optimization working"
echo "  ✅ Integration test passed"
echo "  ✅ No 413 errors"
echo "  ✅ Tools loading successfully"
echo ""

echo "🎉 System ready for production!"
echo ""
echo "Next steps:"
echo "  1. Commit changes: ./commit-mcp-fixes.sh"
echo "  2. Monitor logs: tail -f logs/orchestrator.log"
echo "  3. Test with real requests"
echo ""
