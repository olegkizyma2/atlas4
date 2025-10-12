#!/bin/bash

# Verification Script for Conversation Mode Fixes (12.10.2025)
# Verifies Quick-Send Filter Fix, Keyword Activation TTS Fix, Streaming Conflict Fix, Payload Fix, TTS Subscription Fix

# Don't exit on error - we want to count failures
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================"
echo "🔍 ATLAS Conversation Mode Fixes Verification"
echo "======================================================"
echo ""
echo "Date: 12.10.2025 - День ~14:30"
echo "Fixes: #1 Filter + #2 Keyword TTS + #3 Streaming + #4 Payload + #5 TTS Subscription"
echo ""

PASSED=0
FAILED=0

# Helper function
check() {
    local name="$1"
    local command="$2"
    
    echo -n "[$name] "
    if eval "$command" > /dev/null 2>&1; then
        echo "✅ PASS"
        ((PASSED++))
        return 0
    else
        echo "❌ FAIL"
        ((FAILED++))
        return 1
    fi
}

echo "======================================================"
echo "PART 1: Quick-Send Filter Fix"
echo "======================================================"
echo ""

# Check filters.js modifications
check "FILTER 2: Background phrases mode-aware" \
    "grep -q 'isConversationMode && isBackgroundPhrase' web/static/js/voice-control/conversation/filters.js"

check "FILTER 3: Unclear phrases mode-aware" \
    "grep -q 'isConversationMode && shouldReturnToKeywordMode' web/static/js/voice-control/conversation/filters.js"

# Verify no hardcoded blocking in Quick-send path
check "Quick-send NOT hardcoded to filter" \
    "! grep -q \"mode === 'quick-send'.*isBackgroundPhrase\" web/static/js/voice-control/conversation/filters.js"

echo ""
echo "======================================================"
echo "PART 2: Keyword Activation TTS Fix"
echo "======================================================"
echo ""

# Check conversation-mode-manager.js modifications
check "EventManager: window.eventManager used" \
    "grep -q 'window.eventManager || this.eventManager' web/static/js/voice-control/conversation-mode-manager.js"

check "TTS_SPEAK_REQUEST: globalEventManager.emit" \
    "grep -A 5 'globalEventManager.emit.*TTS_SPEAK_REQUEST' web/static/js/voice-control/conversation-mode-manager.js | grep -q 'isActivationResponse: true'"

check "Logging: EventManager type diagnostic" \
    "grep -q 'TTS_SPEAK_REQUEST emitted via' web/static/js/voice-control/conversation-mode-manager.js"

check "Priority: high for activation responses" \
    "grep -A 5 'TTS_SPEAK_REQUEST' web/static/js/voice-control/conversation-mode-manager.js | grep -q \"priority: 'high'\""

echo ""
echo "======================================================"
echo "PART 3: Documentation & Instructions"
echo "======================================================"
echo ""

# Verify documentation files exist
check "Doc: Quick-Send Filter Fix" \
    "test -f docs/QUICK_SEND_FILTER_FIX_2025-10-12.md"

check "Doc: Keyword Activation TTS Fix" \
    "test -f docs/CONVERSATION_MODE_KEYWORD_FIX_2025-10-12.md"

check "Summary: Quick-Send Filter" \
    "test -f QUICK_SEND_FIX_README.md || test -f docs/QUICK_SEND_FILTER_FIX_2025-10-12.md"

check "Summary: Keyword Activation TTS" \
    "test -f CONVERSATION_MODE_KEYWORD_FIX_SUMMARY.md"

# Verify Copilot Instructions updated
check "Copilot Instructions: Quick-Send Fix documented" \
    "grep -q 'Quick-Send Filter Fix.*FIXED 12.10.2025' .github/copilot-instructions.md"

check "Copilot Instructions: Keyword TTS Fix documented" \
    "grep -q 'Conversation Mode Keyword Activation TTS Fix.*FIXED 12.10.2025' .github/copilot-instructions.md"

check "Copilot Instructions: EventManager hierarchy explained" \
    "grep -q 'window.eventManager.*app-level' .github/copilot-instructions.md"

check "Copilot Instructions: Last updated timestamp" \
    "grep -q 'LAST UPDATED.*14:30.*TTS_COMPLETED Subscription' .github/copilot-instructions.md"

echo ""
echo "======================================================"
echo "PART 4: Streaming Conflict & Payload Fixes"
echo "======================================================"
echo ""

# Check conversation-mode-manager.js modifications
check "chatManager: Injected in constructor" \
    "grep -q 'this.chatManager = config.chatManager' web/static/js/voice-control/conversation-mode-manager.js"

check "Pending message: Queue initialized" \
    "grep -q 'this.pendingMessage = null' web/static/js/voice-control/conversation-mode-manager.js"

check "sendToChat: isStreaming check" \
    "grep -A 5 'sendToChat.*text.*metadata' web/static/js/voice-control/conversation-mode-manager.js | grep -q 'chatManager.isStreaming'"

check "handleTTSCompleted: Payload extraction pattern" \
    "grep -A 2 'handleTTSCompleted' web/static/js/voice-control/conversation-mode-mode-manager.js | grep -q 'payload.*event?.payload || event' || grep -A 2 'handleTTSCompleted' web/static/js/voice-control/conversation-mode-manager.js | grep -q 'payload.*event?.payload || event'"

check "app-refactored.js: chatManager injection" \
    "grep -A 3 'new ConversationModeManager' web/static/js/app-refactored.js | grep -q 'chatManager:'"

echo ""
echo "======================================================"
echo "PART 5: TTS Subscription Fix (NEW)"
echo "======================================================"
echo ""

# Check event-handlers.js modifications
check "subscribeToGlobal: Method exists" \
    "grep -q 'subscribeToGlobal' web/static/js/voice-control/conversation/event-handlers.js"

check "TTS_COMPLETED: Subscribed via subscribeToGlobal" \
    "grep -A 2 'subscribeToGlobal' web/static/js/voice-control/conversation/event-handlers.js | grep -q 'TTS_COMPLETED'"

check "Global EventManager: Fallback pattern" \
    "grep -q 'window.eventManager || this.eventManager' web/static/js/voice-control/conversation/event-handlers.js"

check "Diagnostic logging: Global subscription" \
    "grep -q 'Subscribed to GLOBAL' web/static/js/voice-control/conversation/event-handlers.js"

check "Doc: TTS Subscription Fix" \
    "test -f docs/CONVERSATION_TTS_SUBSCRIPTION_FIX_2025-10-12.md"

echo ""
echo "======================================================"
echo "PART 6: Code Integrity"
echo "======================================================"
echo ""

# Verify no regressions in Conversation mode filtering
check "Conversation mode: Background filter still active" \
    "grep -q 'if (isConversationMode && isBackgroundPhrase' web/static/js/voice-control/conversation/filters.js"

check "Conversation mode: Unclear filter still active" \
    "grep -q 'if (isConversationMode && shouldReturnToKeywordMode' web/static/js/voice-control/conversation/filters.js"

# Verify TTS Manager still subscribes to window.eventManager
check "TTS Manager: Subscribes to window.eventManager" \
    "grep -q \"on('TTS_SPEAK_REQUEST'\" web/static/js/modules/tts-manager.js"

echo ""
echo "======================================================"
echo "📊 VERIFICATION RESULTS"
echo "======================================================"
echo ""
echo "Total Checks: $((PASSED + FAILED))"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED!"
    echo ""
    echo "All 5 fixes verified successfully:"
    echo "  1. ✅ Quick-Send Filter Fix (mode-aware filtering)"
    echo "  2. ✅ Keyword Activation TTS Fix (EventManager hierarchy)"
    echo "  3. ✅ Streaming Conflict Fix (pending queue)"
    echo "  4. ✅ Payload Extraction Fix (event?.payload || event)"
    echo "  5. ✅ TTS Subscription Fix (subscribeToGlobal)"
    echo ""
    echo "Next steps:"
    echo "  1. Restart system: ./restart_system.sh restart"
    echo "  2. Test Quick-send: Click mic → 'Дякую за перегляд!' → should send ✅"
    echo "  3. Test Conversation: Hold 2s → 'Атлас' → TTS response → recording ✅"
    echo "  4. Test Continuous loop: Atlas responds → TTS → auto-record → repeat ✅"
    echo ""
    exit 0
else
    echo "⚠️  SOME CHECKS FAILED"
    echo ""
    echo "Please review failed checks above."
    echo "Check documentation:"
    echo "  - docs/QUICK_SEND_FILTER_FIX_2025-10-12.md"
    echo "  - docs/CONVERSATION_MODE_KEYWORD_FIX_2025-10-12.md"
    echo "  - docs/CONVERSATION_STREAMING_CONFLICT_FIX_2025-10-12.md"
    echo "  - docs/CONVERSATION_TTS_SUBSCRIPTION_FIX_2025-10-12.md"
    echo ""
    exit 1
fi
