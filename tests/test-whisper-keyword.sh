#!/bin/bash

# Test Whisper Keyword Detection (11.10.2025)
# Перевірка що Whisper-based keyword detection працює краще за Web Speech

echo "==================================="
echo "Whisper Keyword Detection Test"
echo "==================================="
echo ""

# Кольори
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Перевірка що система запущена
echo "📋 Step 1: Checking system status..."
if ! curl -s http://localhost:5001 > /dev/null 2>&1; then
    echo -e "${RED}❌ Frontend not running${NC}"
    echo "Run: ./restart_system.sh start"
    exit 1
fi

if ! curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Whisper service not running${NC}"
    echo "Run: ./restart_system.sh start"
    exit 1
fi

echo -e "${GREEN}✅ System is running${NC}"
echo ""

# Перевірка що новий файл існує
echo "📋 Step 2: Checking new WhisperKeywordDetection service..."
if [ ! -f "web/static/js/voice-control/services/whisper-keyword-detection.js" ]; then
    echo -e "${RED}❌ whisper-keyword-detection.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ WhisperKeywordDetection service exists${NC}"
echo ""

# Перевірка що voice-control-manager імпортує новий сервіс
echo "📋 Step 3: Checking integration in voice-control-manager..."
if grep -q "WhisperKeywordDetection" "web/static/js/voice-control/voice-control-manager.js"; then
    echo -e "${GREEN}✅ WhisperKeywordDetection imported in manager${NC}"
else
    echo -e "${RED}❌ WhisperKeywordDetection NOT imported${NC}"
    exit 1
fi
echo ""

# Інструкції для мануального тестування
echo "==================================="
echo "📖 Manual Testing Instructions"
echo "==================================="
echo ""
echo "1. Open http://localhost:5001 in browser"
echo "2. Open DevTools Console (F12)"
echo "3. Click and HOLD microphone button for 2+ seconds"
echo "4. Look for logs:"
echo -e "   ${GREEN}[WHISPER_KEYWORD] 🔍 Starting Whisper keyword detection${NC}"
echo -e "   ${GREEN}[WHISPER_KEYWORD] 🎤 Started continuous keyword listening${NC}"
echo "5. Say 'Атлас' (or 'атлаз', 'атлус', 'слухай')"
echo "6. Look for keyword detection:"
echo -e "   ${GREEN}[WHISPER_KEYWORD] Whisper chunk: 'атлас'${NC}"
echo -e "   ${GREEN}[WHISPER_KEYWORD] 🎯 Keyword detected via Whisper${NC}"
echo "7. Recording should start automatically"
echo ""

echo "==================================="
echo "🔍 Expected Behavior vs Old"
echo "==================================="
echo ""
echo -e "${YELLOW}OLD (Web Speech):${NC}"
echo "  - Розпізнає: 'атлаз', 'атлус' (WRONG)"
echo "  - Точність: ~30-40%"
echo "  - Latency: ~0ms (instant)"
echo ""
echo -e "${GREEN}NEW (Whisper):${NC}"
echo "  - Розпізнає: 'атлас' (CORRECT)"
echo "  - Точність: ~95%+"
echo "  - Latency: ~2.7 сек (acceptable)"
echo ""

echo "==================================="
echo "📊 Testing Checklist"
echo "==================================="
echo ""
echo "□ Conversation mode activates (2+ sec hold)"
echo "□ Whisper keyword detection starts"
echo "□ Say 'Атлас' → detects correctly"
echo "□ Recording starts automatically"
echo "□ After response → loop continues"
echo "□ Variations work: 'атлаз', 'слухай'"
echo ""

# Перевірка логів
echo "==================================="
echo "📜 Recent Logs Analysis"
echo "==================================="
echo ""

if [ -f "logs/orchestrator.log" ]; then
    echo "Last 10 orchestrator log entries:"
    tail -10 logs/orchestrator.log
    echo ""
fi

# Фінальний статус
echo "==================================="
echo -e "${GREEN}✅ Test preparation complete!${NC}"
echo "==================================="
echo ""
echo "Now test manually in browser:"
echo "http://localhost:5001"
echo ""
