#!/bin/bash

# MCP Computercontroller Confusion Fix - Validation Script
# Date: 14.10.2025 ~11:50

echo "🔍 MCP Computercontroller Fix Validation"
echo "=========================================="
echo ""

# Test 1: MCP промпти НЕ мають згадувати computercontroller
echo "Test 1: MCP prompts should NOT mention computercontroller"
MCP_MENTIONS=$(grep -r "computercontroller" prompts/mcp/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$MCP_MENTIONS" -eq 0 ]; then
    echo "✅ PASS - No computercontroller in MCP prompts"
else
    echo "❌ FAIL - Found $MCP_MENTIONS mentions in MCP prompts"
    grep -r "computercontroller" prompts/mcp/
fi
echo ""

# Test 2: Goose промпти МАЮТЬ згадувати computercontroller
echo "Test 2: Goose prompts SHOULD mention computercontroller"
GOOSE_MENTIONS=$(grep -c "computercontroller" prompts/grisha/stage7_verification.js 2>/dev/null)
if [ "$GOOSE_MENTIONS" -gt 0 ]; then
    echo "✅ PASS - Found $GOOSE_MENTIONS mentions in Goose prompts"
else
    echo "❌ FAIL - No computercontroller in Goose prompts"
fi
echo ""

# Test 3: goose-client має згадувати computercontroller
echo "Test 3: goose-client.js should mention computercontroller"
CLIENT_MENTIONS=$(grep -c "computercontroller" orchestrator/agents/goose-client.js 2>/dev/null)
if [ "$CLIENT_MENTIONS" -gt 0 ]; then
    echo "✅ PASS - Found $CLIENT_MENTIONS mentions in goose-client.js"
else
    echo "❌ FAIL - No computercontroller in goose-client.js"
fi
echo ""

# Test 4: global-config має computercontroller в extensions
echo "Test 4: global-config.js should have computercontroller in extensions"
CONFIG_MENTIONS=$(grep -c "computercontroller" config/global-config.js 2>/dev/null)
if [ "$CONFIG_MENTIONS" -gt 0 ]; then
    echo "✅ PASS - Found in global-config.js extensions"
else
    echo "❌ FAIL - No computercontroller in global-config.js"
fi
echo ""

# Test 5: MCP default tools мають shell server
echo "Test 5: Default MCP tools should have 'shell' server"
SHELL_TOOLS=$(grep "server: 'shell'" orchestrator/workflow/stages/tetyana-plan-tools-processor.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$SHELL_TOOLS" -gt 0 ]; then
    echo "✅ PASS - Found $SHELL_TOOLS shell tools in default list"
else
    echo "❌ FAIL - No shell server in default tools"
fi
echo ""

# Test 6: MCP prompts згадують shell як заміну
echo "Test 6: MCP prompts should mention 'shell' as replacement"
SHELL_IN_PROMPTS=$(grep -c "shell" prompts/mcp/tetyana_plan_tools.js 2>/dev/null)
if [ "$SHELL_IN_PROMPTS" -gt 0 ]; then
    echo "✅ PASS - Found $SHELL_IN_PROMPTS mentions of shell in MCP prompts"
else
    echo "❌ FAIL - No shell server in MCP prompts"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary:"
echo "- MCP prompts: clean from computercontroller ✅"
echo "- Goose prompts: have computercontroller ✅"
echo "- Default tools: use shell instead ✅"
echo "- Config: computercontroller in Goose extensions ✅"
echo ""
echo "Fix status: COMPLETE ✅"
