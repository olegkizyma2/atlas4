#!/bin/bash
echo "🔍 Verifying MCP Manager Fix (v2)..."
echo ""
echo "1️⃣ Checking import statement..."
if grep -q "import { MCPManager } from '../ai/mcp-manager.js';" orchestrator/core/service-registry.js; then
    echo "✅ MCPManager imported at top"
else
    echo "❌ MCPManager import missing"
    exit 1
fi

echo ""
echo "2️⃣ Checking factory function..."
if grep -q "container.singleton('mcpManager', (c) =>" orchestrator/core/service-registry.js; then
    echo "✅ Factory is synchronous (not async)"
else
    echo "❌ Factory is still async"
    exit 1
fi

echo ""
echo "3️⃣ Checking onInit hook..."
if grep -q "await this.initialize();" orchestrator/core/service-registry.js; then
    echo "✅ onInit calls this.initialize()"
else
    echo "❌ onInit doesn't call initialize()"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ All checks passed - ready to test!"
echo "═══════════════════════════════════════"
echo ""
echo "Next: ./restart_system.sh restart"
