#!/bin/bash
# Test Task Mode Message Delivery - 10.10.2025
# Перевіряє чи повідомлення від Atlas у task mode доходять до чату

echo "🧪 Testing Task Mode Message Delivery..."
echo ""

# 1. Перевірка що orchestrator запущений
if ! pgrep -f "node.*orchestrator" > /dev/null; then
    echo "❌ Orchestrator не запущений!"
    exit 1
fi
echo "✅ Orchestrator запущений"

# 2. Надіслати task запит
echo ""
echo "📤 Sending task: 'відкрий калькулятор і набери 666'"
RESPONSE=$(curl -s -N -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "відкрий калькулятор і набери 666", "sessionId": "test_task_delivery"}' \
  2>&1)

# 3. Перевірити чи є agent_message в потоці
if echo "$RESPONSE" | grep -q "agent_message"; then
    echo "✅ agent_message знайдено в SSE stream"
else
    echo "❌ agent_message НЕ знайдено в stream!"
    echo ""
    echo "Response preview:"
    echo "$RESPONSE" | head -20
    exit 1
fi

# 4. Перевірити логи на tts_async
sleep 1
echo ""
echo "📋 Checking orchestrator logs..."

if tail -50 logs/orchestrator.log | grep -q "tts_async.*task mode"; then
    echo "✅ TTS відправлений async (task mode)"
else
    echo "⚠️  TTS async log не знайдено (може використовується стара версія?)"
fi

if tail -50 logs/orchestrator.log | grep -q "Waiting for TTS completion before next stage"; then
    echo "✅ Executor чекає на TTS ПІСЛЯ відправки в stream"
else
    echo "⚠️  Executor TTS wait log не знайдено"
fi

# 5. Перевірити що немає помилок SSE
if echo "$RESPONSE" | grep -q "Failed to parse"; then
    echo "❌ SSE parse error знайдено!"
    exit 1
fi

echo ""
echo "✅ Task Mode Message Delivery - PASS"
echo ""
echo "Expected flow:"
echo "  1. Stage 1 Atlas executes"
echo "  2. Response sent to SSE stream IMMEDIATELY"
echo "  3. TTS plays async in parallel"
echo "  4. Executor waits for TTS before Stage 2"
