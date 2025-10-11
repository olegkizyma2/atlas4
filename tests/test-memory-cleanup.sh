#!/bin/bash
# Memory Leak Fix Verification Test
# Tests session.history cleanup after completion and retry cycles

echo "🧪 MEMORY LEAK FIX VERIFICATION TEST"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ORCHESTRATOR_URL="http://localhost:5101"
SESSION_ID="memory-test-$(date +%s)"

# Check if orchestrator is running
echo "📡 Checking orchestrator status..."
if ! curl -sf "${ORCHESTRATOR_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator not running!${NC}"
    echo "Start it with: ./restart_system.sh start"
    exit 1
fi
echo -e "${GREEN}✅ Orchestrator is running${NC}"
echo ""

# Function to send test message
send_message() {
    local message="$1"
    local description="$2"
    
    echo "📤 Sending: $description"
    echo "   Message: \"$message\""
    
    curl -s -X POST "${ORCHESTRATOR_URL}/chat/stream" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$message\", \"sessionId\": \"$SESSION_ID\"}" \
        > /tmp/atlas_response.json 2>&1
    
    echo -e "${GREEN}   ✅ Sent${NC}"
    sleep 2
}

# Function to check logs for cleanup
check_cleanup() {
    local pattern="$1"
    local description="$2"
    
    echo "🔍 Checking: $description"
    
    if tail -100 logs/orchestrator.log | grep -q "$pattern"; then
        echo -e "${GREEN}   ✅ Found: $pattern${NC}"
        tail -100 logs/orchestrator.log | grep "$pattern" | tail -1
        return 0
    else
        echo -e "${YELLOW}   ⚠️  Not found: $pattern${NC}"
        return 1
    fi
    echo ""
}

# Clear old logs
echo "🧹 Clearing old test logs..."
> /tmp/atlas_response.json
echo ""

# Test 1: Chat completion cleanup
echo "TEST 1: Chat Completion Cleanup"
echo "--------------------------------"
send_message "Привіт, Atlas!" "Chat message 1"
send_message "Як справи?" "Chat message 2"
sleep 3

check_cleanup "Session history cleanup:.*→ 0 messages.*mode: chat" \
    "Chat mode cleanup (should clear to 0)"
echo ""

# Test 2: Task completion cleanup
echo "TEST 2: Task Completion Cleanup"
echo "--------------------------------"
send_message "створи файл test.txt з текстом hello" "Task message"
sleep 5

check_cleanup "Session history cleanup:.*→ 5 messages.*mode: task" \
    "Task mode cleanup (should keep last 5)"
echo ""

# Test 3: History size limit during execution
echo "TEST 3: History Size Limit During Execution"
echo "--------------------------------------------"
send_message "відкрий калькулятор" "Task to trigger multiple stages"
sleep 5

check_cleanup "History size limit: removed.*old messages, kept 20" \
    "Push limit enforcement (max 20 messages)"
echo ""

# Test 4: Retry cycle cleanup
echo "TEST 4: Retry Cycle Cleanup"
echo "---------------------------"
# This is harder to test - would need to trigger stage 9
echo "⚠️  Requires failed task to trigger retry cycle (stage 9 → 1)"
echo "   Manually test with: intentionally ambiguous task"
echo ""

# Summary
echo "📊 SUMMARY"
echo "=========="
echo ""
echo "Expected log patterns:"
echo "1. Chat completion:    'Session history cleanup: X → 0 messages (mode: chat)'"
echo "2. Task completion:    'Session history cleanup: X → 5 messages (mode: task)'"
echo "3. Push limit:         'History size limit: removed N old messages, kept 20'"
echo "4. Retry cycle:        'Retry cycle N: cleaned history X → 5 messages'"
echo ""

# Check recent logs
echo "📝 Recent cleanup activity:"
tail -50 logs/orchestrator.log | grep -E "(cleanup|History size limit|Retry cycle)" | tail -5
echo ""

echo "✅ Test completed. Review logs above."
echo "   Full logs: tail -f logs/orchestrator.log | grep -E '(cleanup|history)'"
