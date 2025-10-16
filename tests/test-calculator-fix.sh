#!/bin/bash

# Test Calculator Opening Fix
# Tests AppleScript tool name correction and JSON parsing

echo "======================================"
echo "Testing Calculator Opening Fix"
echo "======================================"
echo ""

SESSION_ID="test-calc-$(date +%s)"

echo "📋 Test Case: Відкрий калькулятор"
echo "Session ID: $SESSION_ID"
echo ""

# Send request to orchestrator
echo "🚀 Sending request to orchestrator..."
curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Відкрий калькулятор\", \"sessionId\": \"$SESSION_ID\"}" \
  > /tmp/test-response.txt 2>&1 &

CURL_PID=$!

# Wait for response
sleep 8

# Kill curl if still running
kill $CURL_PID 2>/dev/null

echo ""
echo "======================================"
echo "Analyzing Logs..."
echo "======================================"
echo ""

# Check for correct tool name
echo "✅ Checking AppleScript tool name..."
CORRECT_TOOL=$(tail -200 logs/orchestrator.log | grep -c '"tool":"applescript_execute"')
WRONG_TOOL=$(tail -200 logs/orchestrator.log | grep -c '"tool":"execute_applescript"')

if [ $CORRECT_TOOL -gt 0 ]; then
    echo "   ✅ PASS: Found correct tool name 'applescript_execute' ($CORRECT_TOOL times)"
else
    echo "   ❌ FAIL: Correct tool name NOT found"
fi

if [ $WRONG_TOOL -gt 0 ]; then
    echo "   ⚠️  WARNING: Found wrong tool name 'execute_applescript' ($WRONG_TOOL times)"
fi

echo ""

# Check for tool execution success
echo "✅ Checking tool execution..."
TOOL_SUCCESS=$(tail -200 logs/orchestrator.log | grep -c "applescript_execute.*success\|Tool execution successful")
TOOL_ERROR=$(tail -200 logs/orchestrator.log | grep -c "Tool.*execute_applescript.*not available")

if [ $TOOL_SUCCESS -gt 0 ]; then
    echo "   ✅ PASS: Tool executed successfully ($TOOL_SUCCESS times)"
elif [ $TOOL_ERROR -gt 0 ]; then
    echo "   ❌ FAIL: Tool execution failed with 'not available' error ($TOOL_ERROR times)"
else
    echo "   ⚠️  UNKNOWN: No clear success/failure indicator"
fi

echo ""

# Check for JSON parsing errors
echo "✅ Checking JSON parsing..."
JSON_ERROR=$(tail -200 logs/orchestrator.log | grep -c "Failed to parse.*Unexpected token")
TEXT_RESPONSE=$(tail -200 logs/orchestrator.log | grep -c "Verification Process:")

if [ $JSON_ERROR -eq 0 ] && [ $TEXT_RESPONSE -eq 0 ]; then
    echo "   ✅ PASS: No JSON parsing errors"
else
    echo "   ❌ FAIL: Found JSON parsing errors ($JSON_ERROR) or text responses ($TEXT_RESPONSE)"
fi

echo ""

# Check for verification success
echo "✅ Checking verification result..."
VERIFIED_TRUE=$(tail -200 logs/orchestrator.log | grep -c '"verified":true')
VERIFIED_FALSE=$(tail -200 logs/orchestrator.log | grep -c '"verified":false')

if [ $VERIFIED_TRUE -gt 0 ]; then
    echo "   ✅ PASS: Verification successful ($VERIFIED_TRUE times)"
elif [ $VERIFIED_FALSE -gt 0 ]; then
    echo "   ⚠️  INFO: Verification returned false ($VERIFIED_FALSE times)"
else
    echo "   ⚠️  UNKNOWN: No verification result found"
fi

echo ""

# Check if Calculator is actually running
echo "🖥️  Checking if Calculator app is running..."
if pgrep -x "Calculator" > /dev/null; then
    echo "   ✅ SUCCESS: Calculator app is RUNNING!"
else
    echo "   ⚠️  INFO: Calculator app is NOT running (may need manual check)"
fi

echo ""
echo "======================================"
echo "Detailed Error Log (last 50 lines):"
echo "======================================"
tail -50 logs/orchestrator.log | grep -E "ERROR|WARN|applescript|Calculator|verified" | tail -20

echo ""
echo "======================================"
echo "Test Complete"
echo "======================================"
echo ""
echo "📊 Summary:"
echo "  - Tool name fix: $([ $CORRECT_TOOL -gt 0 ] && echo '✅ WORKING' || echo '❌ NEEDS FIX')"
echo "  - JSON parsing: $([ $JSON_ERROR -eq 0 ] && echo '✅ WORKING' || echo '❌ NEEDS FIX')"
echo "  - Calculator app: $(pgrep -x 'Calculator' > /dev/null && echo '✅ RUNNING' || echo '⚠️ NOT RUNNING')"
echo ""
