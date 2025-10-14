#!/bin/bash
# 🧪 TTS Testing Script - 14.10.2025 Night
# Перевіряє чи працює TTS озвучка для всіх 3 агентів

echo "🧪 ATLAS TTS Testing Script"
echo "=========================================="
echo ""

# 1. Check orchestrator running
echo "1️⃣ Перевірка orchestrator..."
if curl -s http://localhost:5101/health > /dev/null 2>&1; then
    echo "   ✅ Orchestrator running on port 5101"
else
    echo "   ❌ Orchestrator NOT running!"
    echo "   Run: ./restart_system.sh restart"
    exit 1
fi

# 2. Check WebSocket
echo "2️⃣ Перевірка WebSocket..."
if lsof -ti:5102 > /dev/null 2>&1; then
    echo "   ✅ WebSocket server on port 5102"
else
    echo "   ⚠️  WebSocket may not be running"
fi

# 3. Check TTS service
echo "3️⃣ Перевірка TTS service..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ TTS service running on port 3001"
else
    echo "   ⚠️  TTS service may not be running"
fi

echo ""
echo "=========================================="
echo "📝 TESTING INSTRUCTIONS:"
echo ""
echo "1. Відкрити http://localhost:5001 в браузері"
echo ""
echo "2. Надіслати тестове завдання в чат:"
echo "   \"на робочому столі створи файл test.txt з текстом Hello\""
echo ""
echo "3. Очікувати озвучки (в порядку):"
echo "   🔵 [ATLAS]   \"Розумію, створення файлу. План з 2 кроків\""
echo "   🟢 [TETYANA] \"Створюю файл\""
echo "   🟢 [TETYANA] \"Файл створено\""
echo "   🟡 [GRISHA]  \"Створення підтверджено\""
echo "   🟡 [GRISHA]  \"✅ Виконано\""
echo "   🔵 [ATLAS]   \"Все готово. Завдання виконано\""
echo ""
echo "4. Перевірити логи (в іншому терміналі):"
echo "   tail -f logs/orchestrator.log | grep -E '🔊|TTS|agent_message'"
echo ""
echo "=========================================="
echo "🔍 EXPECTED IN LOGS:"
echo ""
echo "✅ [TODO] 🔊 Requesting TTS: \"...\" (agent: atlas)"
echo "✅ [TTS-SYNC] 🔊 Sending TTS to frontend: \"...\" (agent: tetyana)"
echo "✅ [TODO] ✅ TTS completed successfully"
echo ""
echo "=========================================="
echo "❌ IF TTS NOT WORKING:"
echo ""
echo "1. Check browser console for errors"
echo "2. Check logs/orchestrator.log for TTS errors"
echo "3. Verify wsManager is injected in DI Container"
echo "4. Verify frontend TTS Manager is subscribed to 'agent_message' events"
echo ""
echo "=========================================="
echo ""
echo "🚀 Ready to test! Start browser and send message."
echo ""
