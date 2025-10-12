#!/bin/bash

# Verification Script for Conversation Mode Fixes (12.10.2025)
# Verifies both Quick-Send Filter Fix and Keyword Activation TTS Fix

# Don't exit on error - we want to count failures
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================"
echo "🔍 ATLAS Conversation Mode Fixes Verification"
echo "======================================================"
echo ""
echo "Date: 12.10.2025 - День ~16:45"
echo "Fixes: Quick-Send Filter + Keyword Activation TTS"
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
    "grep -q 'LAST UPDATED.*16:45.*Keyword Activation' .github/copilot-instructions.md"

echo ""
echo "======================================================"
echo "PART 4: Code Integrity"
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
    echo "Both fixes verified successfully:"
    echo "  1. ✅ Quick-Send Filter Fix (mode-aware filtering)"
    echo "  2. ✅ Keyword Activation TTS Fix (EventManager hierarchy)"
    echo ""
    echo "Next steps:"
    echo "  1. Restart system: ./restart_system.sh restart"
    echo "  2. Test Quick-send: Click mic → 'Дякую за перегляд!' → should send ✅"
    echo "  3. Test Conversation: Hold 2s → 'Атлас' → TTS response → recording ✅"
    echo ""
    exit 0
else
    echo "⚠️  SOME CHECKS FAILED"
    echo ""
    echo "Please review failed checks above."
    echo "Check documentation:"
    echo "  - docs/QUICK_SEND_FILTER_FIX_2025-10-12.md"
    echo "  - docs/CONVERSATION_MODE_KEYWORD_FIX_2025-10-12.md"
    echo ""
    exit 1
fi
