#!/bin/bash

# Test MCP workflow with trailing comma fixes
echo "🧪 Testing MCP workflow with trailing comma JSON..."

# Send a test request to the orchestrator
curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Відкрий калькулятор і додай 5 + 3, потім збережи результат",
    "sessionId": "test-trailing-comma-fix-001",
    "mode": "mcp"
  }' \
  -w "\n\n✅ Request sent to orchestrator\n" \
  2>&1 | head -100

echo ""
echo "📋 Checking logs for trailing comma fixes..."
sleep 2
tail -30 /Users/dev/Documents/GitHub/atlas4/logs/orchestrator.log 2>&1 | grep -E "sanitization|tool_calls|tool plan" | tail -10

echo ""
echo "✅ Test complete! Check logs above for trailing comma handling."
