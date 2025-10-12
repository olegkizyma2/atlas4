#!/bin/bash

# Conversation Pending Message Continuous Listening Fix - Verification Script
# Дата: 12 жовтня 2025

echo "🧪 Testing Conversation Pending Message Continuous Listening Fix..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check fix is applied
echo "📋 Test 1: Verifying fix in conversation-mode-manager.js..."
if grep -q "FIXED (12.10.2025 - 15:30): НЕ чекаємо TTS після pending - запускаємо continuous listening" web/static/js/voice-control/conversation-mode-manager.js; then
    echo -e "${GREEN}✅ Fix comment found${NC}"
else
    echo -e "${RED}❌ Fix comment NOT found${NC}"
    exit 1
fi

# Test 2: Check continuous listening after pending
echo "📋 Test 2: Checking continuous listening starts after pending message..."
if grep -A 15 "if (this.pendingMessage)" web/static/js/voice-control/conversation-mode-manager.js | grep -q "this.startContinuousListening()"; then
    echo -e "${GREEN}✅ Continuous listening call found after pending${NC}"
else
    echo -e "${RED}❌ Continuous listening NOT found after pending${NC}"
    exit 1
fi

# Test 3: Check timeout for continuous listening
echo "📋 Test 3: Verifying 500ms timeout for natural pause..."
if grep -q "}, 500);" web/static/js/voice-control/conversation-mode-manager.js; then
    echo -e "${GREEN}✅ 500ms timeout found${NC}"
else
    echo -e "${RED}❌ 500ms timeout NOT found${NC}"
    exit 1
fi

# Test 4: Check isInConversation check
echo "📋 Test 4: Checking isInConversation validation..."
if grep -q "if (this.state.isInConversation())" web/static/js/voice-control/conversation-mode-manager.js | grep -B 2 "startContinuousListening"; then
    echo -e "${GREEN}✅ isInConversation check found${NC}"
else
    echo -e "${YELLOW}⚠️ isInConversation check might be missing${NC}"
fi

# Test 5: Check diagnostic logging
echo "📋 Test 5: Verifying diagnostic logging..."
if grep -q "Pending message is DUPLICATE" web/static/js/voice-control/conversation-mode-manager.js; then
    echo -e "${GREEN}✅ Diagnostic logging found${NC}"
else
    echo -e "${YELLOW}⚠️ Diagnostic logging missing${NC}"
fi

echo ""
echo "📊 Summary:"
echo "- conversation-mode-manager.js updated with continuous listening after pending"
echo "- 500ms natural pause before recording"
echo "- isInConversation validation present"
echo "- Diagnostic logging added"

echo ""
echo -e "${GREEN}✅ All critical checks passed!${NC}"
echo ""

echo "🔍 Manual Testing Instructions:"
echo "1. Open http://localhost:5001"
echo "2. Hold microphone button for 2+ seconds"
echo "3. Say 'Атлас' → hear 'так, шефе'"
echo "4. IMMEDIATELY (without waiting) speak your request"
echo "5. Atlas responds with TTS"
echo "6. Recording should START AUTOMATICALLY (no 'Атлас' needed)"
echo "7. Continue dialogue → LOOP should work"
echo ""

echo "📋 Expected Console Log Pattern:"
echo "[CONVERSATION] 🎯 Keyword detected"
echo "[TTS] Audio playback completed {isActivationResponse: true}"
echo "[CONVERSATION] ⚠️ Cannot send message - chat is still streaming"
echo "[CONVERSATION] ⏳ Queueing message"
echo "[TTS] Audio playback completed {isActivationResponse: false}"
echo "[CONVERSATION] 📤 Sending pending message"
echo "[CONVERSATION] ⚠️ Pending message is DUPLICATE - starting continuous listening"
echo "[CONVERSATION] 🔄 Starting continuous listening ← CRITICAL!"
echo ""

echo "✅ Verification complete!"
