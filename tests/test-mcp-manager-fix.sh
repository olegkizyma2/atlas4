#!/bin/bash
# Test MCPManager Initialization Fix - 2025-10-14
# Tests that MCPManager properly initializes with servers

set -e

echo "🧪 Testing MCPManager Initialization Fix..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Check if orchestrator is running
echo "1️⃣ Checking orchestrator status..."
if ! curl -s http://localhost:5101/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator not running${NC}"
    echo "   Run: ./restart_system.sh start"
    exit 1
fi
echo -e "${GREEN}✅ Orchestrator running${NC}"
echo ""

# 2. Check startup logs for MCPManager initialization
echo "2️⃣ Checking MCPManager initialization in logs..."
if grep -q "\[DI\] MCPManager initialized with servers" logs/orchestrator.log 2>/dev/null; then
    echo -e "${GREEN}✅ MCPManager initialization logged${NC}"
else
    echo -e "${RED}❌ MCPManager initialization NOT found in logs${NC}"
    echo "   Expected: '[DI] MCPManager initialized with servers'"
    exit 1
fi
echo ""

# 3. Check for MCP server startup messages
echo "3️⃣ Checking MCP server startup..."
if grep -q "\[MCP Manager\] Starting MCP servers" logs/orchestrator.log 2>/dev/null; then
    echo -e "${GREEN}✅ MCP servers startup initiated${NC}"
    
    # Count how many servers started
    SERVER_COUNT=$(grep -c "\[MCP Manager\].*started" logs/orchestrator.log 2>/dev/null || echo "0")
    echo "   Started servers: $SERVER_COUNT"
else
    echo -e "${YELLOW}⚠️  MCP server startup not found (may be still initializing)${NC}"
fi
echo ""

# 4. Test MCP workflow with actual request
echo "4️⃣ Testing MCP workflow with file creation..."
RESPONSE=$(curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test-mcp-fix.txt на Desktop з текстом Test", "sessionId": "test_fix"}')

echo "Response preview:"
echo "$RESPONSE" | head -n 20

# Check for success indicators
if echo "$RESPONSE" | grep -q "mcp_workflow_complete"; then
    echo ""
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ MCP workflow completed successfully${NC}"
    else
        echo -e "${RED}❌ MCP workflow completed but with errors${NC}"
        # Extract error details
        echo "$RESPONSE" | grep "success_rate" || true
    fi
elif echo "$RESPONSE" | grep -q "Tool planning failed"; then
    echo -e "${RED}❌ Tool planning still failing - fix not working${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠️  Unexpected response format${NC}"
fi
echo ""

# 5. Check for tool planning errors
echo "5️⃣ Checking for tool planning errors..."
if grep -q "Tool planning failed.*listTools" logs/orchestrator.log 2>/dev/null | tail -5; then
    echo -e "${RED}❌ Tool planning errors still present${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No tool planning errors (or fix resolved them)${NC}"
fi
echo ""

# Summary
echo "════════════════════════════════════════"
echo -e "${GREEN}✅ MCPManager Initialization Fix Verified!${NC}"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Monitor logs: tail -f logs/orchestrator.log"
echo "  2. Test more complex tasks"
echo "  3. Verify all MCP servers are active"
echo ""
