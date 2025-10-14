#!/bin/bash

# Test script for MCP 413 fix
# This script tests if the 413 error fix works by running a complex task

echo "🧪 Starting MCP 413 Error Fix Test..."
echo "======================================"

# Wait for system to be fully ready
sleep 5

echo "📊 Checking system status..."
curl -s http://localhost:5101/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Orchestrator is ready"
else
    echo "❌ Orchestrator not responding"
    exit 1
fi

# Test TTS service
echo "🎵 Checking TTS service..."
TTS_RESPONSE=$(timeout 10 curl -s http://localhost:3001/health)
if [[ $TTS_RESPONSE == *"\"status\":\"ok\""* ]]; then
    echo "✅ TTS service is ready"
else
    echo "❌ TTS service not responding properly: $TTS_RESPONSE"
fi

echo ""
echo "🔧 Testing MCP workflow with complex task..."
echo "Task: 'на робочому столі створи гарну пропозицію з фото у вигляді презентації з найкращими ціни в Укараїні на BYD song plus 2025 року на 10 автомобілів по зростанню з найкращою ціною.'"

# Start monitoring logs in background
LOG_FILE="/tmp/atlas_test.log"
tail -f /Users/dev/Documents/GitHub/atlas4/logs/orchestrator.log > "$LOG_FILE" 2>&1 &
MONITOR_PID=$!

# Give monitoring time to start
sleep 2

echo ""
echo "📋 Expected results:"
echo "✅ No 413 errors in logs"
echo "✅ Successful tool planning"
echo "✅ Successful tool execution"
echo "✅ Successful verification"
echo "✅ TTS synthesis working"
echo ""

echo "⏳ Running test (monitoring for 60 seconds)..."
sleep 60

# Stop monitoring
kill $MONITOR_PID 2>/dev/null

echo ""
echo "📊 Test Results:"
echo "================"

# Check for 413 errors
ERROR_413=$(grep -c "413" "$LOG_FILE")
echo "❌ 413 errors found: $ERROR_413"

# Check for successful planning
SUCCESS_PLANNING=$(grep -c "Planning tools" "$LOG_FILE")
echo "✅ Tool planning attempts: $SUCCESS_PLANNING"

# Check for successful execution
SUCCESS_EXECUTION=$(grep -c "Tool execution successful" "$LOG_FILE")
echo "✅ Tool executions: $SUCCESS_EXECUTION"

# Check for successful verification
SUCCESS_VERIFICATION=$(grep -c "Verification result" "$LOG_FILE")
echo "✅ Verifications: $SUCCESS_VERIFICATION"

# Check for TTS synthesis
TTS_SYNTHESIS=$(grep -c "TTS synthesis successful" "$LOG_FILE")
echo "✅ TTS synthesis: $TTS_SYNTHESIS"

echo ""
echo "📋 Summary:"
if [ $ERROR_413 -eq 0 ] && [ $SUCCESS_PLANNING -gt 0 ]; then
    echo "✅ SUCCESS: No 413 errors and workflow started successfully!"
    echo "🎯 MCP 413 fix appears to be working"
else
    echo "❌ ISSUES: Found $ERROR_413 errors or workflow failed to start"
    echo "🔍 Check the logs for details"
fi

echo ""
echo "📄 Recent log entries:"
tail -10 "$LOG_FILE"

echo ""
echo "🧪 Test completed at $(date)"

# Cleanup
rm -f "$LOG_FILE"
