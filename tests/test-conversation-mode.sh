#!/bin/bash

# Test Conversation Mode - 11.10.2025
# Перевірка другого режиму з детальним логуванням

echo "🎯 Starting ATLAS system for Conversation Mode testing..."
echo ""
echo "📋 Test Scenario:"
echo "1. Утримати кнопку мікрофона 2+ секунди"
echo "2. Система активує Conversation Mode"
echo "3. Сказати 'Атлас'"
echo "4. Система відповість випадковою фразою"
echo "5. Після відповіді - запис вашого запиту"
echo ""
echo "🔍 Логи для перевірки:"
echo "  - Відкрийте Browser Console (Cmd+Option+J)"
echo "  - Шукайте префікси [CONVERSATION] та [KEYWORD]"
echo ""
echo "🚀 Starting services..."
echo ""

# Запуск системи
./restart_system.sh start

echo ""
echo "✅ System started!"
echo ""
echo "📖 Instructions:"
echo "1. Open http://localhost:5001 in browser"
echo "2. Open Browser Console (Cmd+Option+J)"
echo "3. Press and HOLD microphone button for 2+ seconds"
echo "4. Watch console logs for [CONVERSATION] messages"
echo "5. Say 'Атлас' and watch for [KEYWORD] messages"
echo ""
echo "🔍 Expected logs sequence:"
echo "  [CONVERSATION] 🎬 Activating conversation mode..."
echo "  [CONVERSATION] ✅ Mode state set"
echo "  [CONVERSATION] 🔍 Starting keyword listening..."
echo "  [CONVERSATION] 📡 Emitting START_KEYWORD_DETECTION event"
echo "  [KEYWORD] 📨 Received START_KEYWORD_DETECTION request"
echo "  [KEYWORD] 🎤 Starting detection..."
echo "  [KEYWORD] 🚀 startRecognition() called"
echo "  [KEYWORD] ✅ Recognition started successfully"
echo "  ... user says 'Атлас' ..."
echo "  [KEYWORD] 🎯 Keyword detected!"
echo "  [KEYWORD] 📡 Emitting KEYWORD_DETECTED event..."
echo "  [CONVERSATION] 📨 Received KEYWORD_DETECTED event"
echo "  [CONVERSATION] ✅ Keyword matched! Activating..."
echo ""
echo "Press Ctrl+C to stop monitoring logs"
echo ""

# Моніторинг логів
tail -f logs/orchestrator.log logs/whisper.log | grep -i --line-buffered "conversation\|keyword\|atlas\|атлас"
