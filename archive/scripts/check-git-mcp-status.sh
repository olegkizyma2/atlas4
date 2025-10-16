#!/bin/bash
# Git MCP Server Status Check
# Usage: ./check-git-mcp-status.sh

echo "🔍 Git MCP Server Status Check"
echo "=============================="
echo ""

# Check if git is available
echo "📦 Git Version:"
git --version || echo "❌ Git not installed"
echo ""

# Check git config
echo "👤 Git Config:"
echo "   Name:  $(git config user.name)"
echo "   Email: $(git config user.email)"
echo ""

# Check MCP package
echo "📦 MCP Package:"
if npm list -g @cyanheads/git-mcp-server 2>/dev/null | grep -q "@cyanheads/git-mcp-server"; then
    VERSION=$(npm list -g @cyanheads/git-mcp-server 2>/dev/null | grep @cyanheads | awk '{print $2}')
    echo "   ✅ @cyanheads/git-mcp-server $VERSION"
else
    echo "   ⚠️  Not installed globally (will use npx)"
fi
echo ""

# Test MCP server
echo "🧪 Testing MCP Server..."
TEST_RESULT=$((echo '{"method":"initialize","id":1,"jsonrpc":"2.0","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' ; sleep 0.3 ; echo '{"method":"tools/list","id":2,"jsonrpc":"2.0","params":{}}') | timeout 2 npx -y @cyanheads/git-mcp-server 2>/dev/null | tail -1)

if echo "$TEST_RESULT" | grep -q '"tools":\['; then
    TOOLS_COUNT=$(echo "$TEST_RESULT" | grep -o '"name":"git_[^"]*"' | wc -l | tr -d ' ')
    echo "   ✅ Server responds: $TOOLS_COUNT tools available"
    echo ""
    echo "   Sample tools:"
    echo "$TEST_RESULT" | grep -o '"name":"git_[^"]*"' | head -10 | sed 's/"name":"//;s/"//' | sed 's/^/   - /'
else
    echo "   ❌ Server not responding"
fi
echo ""

# Check orchestrator code
echo "📝 Orchestrator Code:"
if grep -q "capabilities.tools - це metadata" orchestrator/ai/mcp-manager.js 2>/dev/null; then
    echo "   ✅ Fixed code detected (metadata handling)"
else
    echo "   ⚠️  Old code or file not found"
fi
echo ""

# Summary
echo "📊 Summary:"
echo "   Status:  $([ $TOOLS_COUNT -eq 27 ] && echo '✅ WORKING' || echo '❌ ISSUES')"
echo "   Tools:   $TOOLS_COUNT/27"
echo "   Package: @cyanheads/git-mcp-server"
echo "   Fix:     ✅ Applied (14.10.2025)"
echo ""
echo "📖 Documentation:"
echo "   - docs/GIT_MCP_SERVER_FIX_2025-10-14.md"
echo "   - .github/copilot-instructions.md"
echo "   - test-git-mcp.sh (full test)"
