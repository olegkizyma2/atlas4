#!/bin/bash

# Test script for context preservation
# Симулює розмову з Atlas для перевірки збереження контексту

SESSION_ID="test_$(date +%s)"
API_URL="http://localhost:5101/chat/stream"

echo "🧪 Testing ATLAS context preservation..."
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Привітання
echo "=== Test 1: Привітання ==="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Привіт\", \"sessionId\": \"$SESSION_ID\"}" \
  2>/dev/null | grep -o '"content":"[^"]*"' | head -1
echo ""
sleep 2

# Test 2: Продовження розмови (без повторного привітання)
echo "=== Test 2: Розкажи анекдот (має відповісти анекдотом, а не привітанням!) ==="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Розкажи анекдот\", \"sessionId\": \"$SESSION_ID\"}" \
  2>/dev/null | grep -o '"content":"[^"]*"' | head -1
echo ""
sleep 2

# Test 3: Перевірка пам'яті
echo "=== Test 3: Про що ми говорили? (має згадати попередню тему) ==="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Про що ми щойно говорили?\", \"sessionId\": \"$SESSION_ID\"}" \
  2>/dev/null | grep -o '"content":"[^"]*"' | head -1
echo ""

echo "✅ Test completed. Check orchestrator logs for context details:"
echo "   tail -100 logs/orchestrator.log | grep -i 'context\|chat mode\|thread'"
