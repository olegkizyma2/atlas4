#!/bin/bash

# Test MCP Dynamic TODO with Chat Messages
# Перевіряє чи доходять повідомлення до чату під час виконання завдань

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       MCP Dynamic TODO - Chat Messages Test                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if orchestrator is running
if ! lsof -i :5101 > /dev/null 2>&1; then
    echo "❌ Orchestrator не запущений на порту 5101"
    echo "Запустіть систему: ./restart_system.sh start"
    exit 1
fi

echo "✅ Orchestrator запущений"
echo ""

# Check .env configuration
echo "📋 Перевірка конфігурації .env:"
echo "   AI_BACKEND_MODE=$(grep '^AI_BACKEND_MODE=' .env | cut -d'=' -f2)"
echo "   AI_BACKEND_PRIMARY=$(grep '^AI_BACKEND_PRIMARY=' .env | cut -d'=' -f2)"
echo "   AI_BACKEND_DISABLE_FALLBACK=$(grep '^AI_BACKEND_DISABLE_FALLBACK=' .env | cut -d'=' -f2)"
echo ""

# Test simple task
echo "🧪 Тестуємо просте завдання: 'Створи файл test.txt на Desktop'"
echo ""
echo "📝 Відправляємо запит..."

RESPONSE=$(curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Створи файл test.txt на Desktop з текстом Hello Atlas",
    "sessionId": "test-session-'$(date +%s)'"
  }' | head -50)

echo ""
echo "📥 Відповідь сервера:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Monitor logs for chat messages
echo "📊 Моніторинг логів (останні 20 рядків з chat_message):"
echo "─────────────────────────────────────────────────────────────────"
tail -100 logs/orchestrator.log | grep -i "chat_message\|broadcastToSubscribers\|_sendChatMessage" | tail -20
echo "─────────────────────────────────────────────────────────────────"
echo ""

# Check WebSocket connections
echo "🔌 Перевірка WebSocket підключень:"
WS_CONNECTIONS=$(lsof -i :5101 | grep -c ESTABLISHED || echo "0")
echo "   Активних WebSocket підключень: $WS_CONNECTIONS"
echo ""

echo "✅ Тест завершено"
echo ""
echo "📝 Для перегляду повних логів:"
echo "   tail -f logs/orchestrator.log | grep -i 'mcp-todo\|chat'"
echo ""
echo "🌐 Відкрийте браузер на http://localhost:5001 щоб побачити чат"
