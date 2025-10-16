#!/bin/bash
# Test Git MCP server initialization
# Date: 2025-10-14

echo "🧪 Testing Git MCP Server..."
echo ""

cd /workspaces/atlas4

# Test 1: Check if git is available
echo "1️⃣ Checking git availability..."
if command -v git &> /dev/null; then
    echo "✅ git $(git --version)"
else
    echo "❌ git not found"
    exit 1
fi

# Test 2: Check git config
echo ""
echo "2️⃣ Checking git config..."
GIT_USER=$(git config user.name)
GIT_EMAIL=$(git config user.email)
if [ -n "$GIT_USER" ] && [ -n "$GIT_EMAIL" ]; then
    echo "✅ Git configured: $GIT_USER <$GIT_EMAIL>"
else
    echo "❌ Git not configured"
    exit 1
fi

# Test 3: Test MCP protocol initialization
echo ""
echo "3️⃣ Testing MCP protocol (initialize)..."
INIT_RESPONSE=$(echo '{"method":"initialize","id":1,"jsonrpc":"2.0","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 2 npx -y @cyanheads/git-mcp-server 2>/dev/null)

if echo "$INIT_RESPONSE" | grep -q '"protocolVersion":"2024-11-05"'; then
    echo "✅ Initialize response received"
else
    echo "❌ Initialize failed"
    exit 1
fi

# Test 4: Test tools/list
echo ""
echo "4️⃣ Testing tools/list..."
TOOLS_RESPONSE=$((echo '{"method":"initialize","id":1,"jsonrpc":"2.0","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' ; sleep 0.3 ; echo '{"method":"tools/list","id":2,"jsonrpc":"2.0","params":{}}') | timeout 2 npx -y @cyanheads/git-mcp-server 2>/dev/null | tail -1)

if echo "$TOOLS_RESPONSE" | grep -q '"tools":\['; then
    TOOLS_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name":"git_[^"]*"' | wc -l)
    echo "✅ Tools list received: $TOOLS_COUNT tools"
    
    # Show first 5 tools
    echo "   Sample tools:"
    echo "$TOOLS_RESPONSE" | grep -o '"name":"git_[^"]*"' | head -5 | sed 's/"name":"//;s/"//' | sed 's/^/   - /'
else
    echo "❌ Tools list failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Git MCP server is working."
echo ""
echo "📋 Summary:"
echo "   - Package: @cyanheads/git-mcp-server"
echo "   - Protocol: 2024-11-05"
echo "   - Tools: $TOOLS_COUNT available"
echo "   - Status: ✅ READY"
