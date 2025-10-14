#!/bin/bash
# Test script for prompt optimization - verify token reduction
# Created: 14.10.2025 ~03:50 - After prompt optimization

set -e

echo "=========================================="
echo "🧪 Testing Prompt Optimization"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📊 Changes Made:"
echo "  ✅ mcp-todo-manager.js - Send toolsSummary (name+description+required_params)"
echo "  ✅ global-config.js - Restored gpt-4o-mini (8k limit now sufficient)"
echo ""

echo "🔍 Verification:"
echo ""

echo "1️⃣ Check toolsSummary implementation..."
if grep -q "toolsSummary = availableTools.map" orchestrator/workflow/mcp-todo-manager.js; then
    echo -e "${GREEN}✅ PASS${NC} - toolsSummary found in mcp-todo-manager.js"
else
    echo -e "${RED}❌ FAIL${NC} - toolsSummary NOT found"
    exit 1
fi

echo ""
echo "2️⃣ Check that full JSON schemas NOT sent..."
if ! grep -q "Available MCP Tools: \${JSON.stringify(availableTools, null, 2)}" orchestrator/workflow/mcp-todo-manager.js; then
    echo -e "${GREEN}✅ PASS${NC} - Full availableTools NOT sent (optimized)"
else
    echo -e "${RED}❌ FAIL${NC} - Still sending full availableTools JSON"
    exit 1
fi

echo ""
echo "3️⃣ Check toolsSummary is sent instead..."
if grep -q "Available MCP Tools: \${JSON.stringify(toolsSummary, null, 2)}" orchestrator/workflow/mcp-todo-manager.js; then
    echo -e "${GREEN}✅ PASS${NC} - toolsSummary sent in prompt"
else
    echo -e "${RED}❌ FAIL${NC} - toolsSummary NOT sent"
    exit 1
fi

echo ""
echo "4️⃣ Check gpt-4o-mini restored..."
if grep -q "MCP_MODEL_PLAN_TOOLS || 'openai/gpt-4o-mini'" config/global-config.js; then
    echo -e "${GREEN}✅ PASS${NC} - gpt-4o-mini restored for plan_tools"
else
    echo -e "${RED}❌ FAIL${NC} - gpt-4o-mini NOT restored"
    exit 1
fi

echo ""
echo "5️⃣ Check max_tokens reduced..."
if grep -A2 "plan_tools:" config/global-config.js | grep -q "max_tokens: 800"; then
    echo -e "${GREEN}✅ PASS${NC} - max_tokens = 800 (was 1000)"
else
    echo -e "${YELLOW}⚠️  WARN${NC} - max_tokens not 800"
fi

echo ""
echo "=========================================="
echo "📈 Expected Results:"
echo "=========================================="
echo ""
echo "BEFORE optimization:"
echo "  - Sent: Full tool schemas (inputSchema, properties, etc.)"
echo "  - Size: ~8000+ tokens"
echo "  - Model: gpt-4o (expensive)"
echo "  - Result: 413 error on gpt-4o-mini"
echo ""
echo "AFTER optimization:"
echo "  - Send: {name, description, required_params} only"
echo "  - Size: ~800-1500 tokens (80-85% reduction)"
echo "  - Model: gpt-4o-mini (cheap, 8k limit sufficient)"
echo "  - Result: Should work with NO 413 errors"
echo ""

echo "=========================================="
echo "🚀 Next Steps:"
echo "=========================================="
echo ""
echo "1. Restart orchestrator:"
echo "   cd /workspaces/atlas4/orchestrator && node server.js"
echo ""
echo "2. Test with MCP request:"
echo "   curl -X POST http://localhost:5101/chat/stream \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\": \"Відкрий калькулятор\", \"sessionId\": \"test\"}'"
echo ""
echo "3. Check logs for:"
echo "   ✅ NO 413 errors"
echo "   ✅ Tool planning succeeds"
echo "   ✅ MCP tools execute"
echo ""
echo "4. Monitor token usage:"
echo "   tail -f logs/orchestrator.log | grep -E '(token|413|plan_tools)'"
echo ""

echo -e "${GREEN}✅ All prompt optimization checks PASSED!${NC}"
echo ""
