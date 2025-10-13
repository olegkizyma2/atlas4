#!/bin/bash
# Diagnose MCP Infinite Loop Issue
# Extracts detailed logs to understand why Stage 2.1 runs 3 times

echo "🔍 MCP Infinite Loop Diagnostic"
echo "================================"
echo ""

LOG_FILE="logs/orchestrator.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    exit 1
fi

echo "📊 Analyzing last 2 minutes of logs..."
echo ""

# Get last 200 lines (approximately last 2 minutes)
RECENT_LOGS=$(tail -200 "$LOG_FILE")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 TODO Creation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -E "Created.*TODO|TODO.*items" | tail -5
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Stage 2.1 Executions (should be 1 per item)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STAGE21_LINES=$(echo "$RECENT_LOGS" | grep -n "Planning tools for item")
echo "$STAGE21_LINES"
echo ""
STAGE21_COUNT=$(echo "$STAGE21_LINES" | wc -l | tr -d ' \n')
echo "Total Stage 2.1 calls: $STAGE21_COUNT"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 LLM API Calls"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -E "Calling LLM API|LLM API responded|LLM API call failed" | tail -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 LLM Responses (what Tetyana receives)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -A 3 "Full LLM response" | tail -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Parsed Plans (after JSON parsing)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -A 10 "Parsed plan:" | tail -30
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Errors and Warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -E "Failed to parse|Warning.*tool|error.*item|attempt.*error|ERROR.*mcp-todo" | tail -30
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💥 Full Error Stack Traces"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -A 5 "Error stack:" | tail -40
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Stage 2.2 Executions (actual tool runs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STAGE22_LINES=$(echo "$RECENT_LOGS" | grep -E "Executing.*tool calls|STAGE-2\.2")
if [ -z "$STAGE22_LINES" ]; then
    echo "❌ No Stage 2.2 executions found (workflow stuck in planning!)"
else
    echo "$STAGE22_LINES"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 API Connectivity Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RECENT_LOGS" | grep -E "ECONNREFUSED|ETIMEDOUT|Network|localhost:4000|Failed to plan tools" | tail -10
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -E "ECONNREFUSED|ETIMEDOUT|Network|localhost:4000|Failed to plan tools" "$LOG_FILE" | tail -10
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Root Cause Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tool_calls array is empty
EMPTY_TOOLS=$(grep -c "tool_calls.*\[\]" "$LOG_FILE" 2>/dev/null | tr -d ' \n' || echo "0")
if [ ! -z "$EMPTY_TOOLS" ] && [ "$EMPTY_TOOLS" != "0" ]; then
    echo "🔴 ISSUE: LLM returns EMPTY tool_calls array ($EMPTY_TOOLS times)"
    echo "   → Tetyana can't plan tools"
    echo "   → Throws error: 'No tool calls generated'"
    echo "   → Retry loop starts (attempt 1, 2, 3)"
fi

# Check for specific errors
if grep -q "No tool calls generated" "$LOG_FILE" 2>/dev/null; then
    echo "🔴 CONFIRMED: 'No tool calls generated' error found"
    echo "   → LLM prompt may be insufficient"
    echo "   → LLM may not understand task format"
fi

if grep -q "Failed to plan tools" "$LOG_FILE" 2>/dev/null; then
    echo "🔴 CONFIRMED: 'Failed to plan tools' error found"
    echo "   → planTools() throwing errors"
    echo "   → Check LLM API response format"
fi

# Check if Stage 2.2 never reached
if [ -z "$STAGE22_LINES" ]; then
    echo "🔴 CONFIRMED: Stage 2.2 never executed"
    echo "   → planTools() or executeTools() failing"
    echo "   → Workflow stuck in retry loop at Stage 2.1"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Recommendations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -z "$(grep -E "tool_calls.*\[\]|No tool calls generated" "$LOG_FILE" 2>/dev/null)" ]; then
    echo "1. Check TETYANA_PLAN_TOOLS prompt:"
    echo "   → Does it clearly request JSON with tool_calls array?"
    echo "   → Are examples provided in the prompt?"
    echo ""
    echo "2. Check available MCP tools:"
    echo "   → Run: grep 'Available MCP Tools' logs/orchestrator.log | tail -1"
    echo "   → Ensure tools are properly listed"
    echo ""
    echo "3. Check LLM response format:"
    echo "   → Review 'Full LLM response' in logs above"
    echo "   → Ensure it returns valid JSON with tool_calls"
fi

if grep -q "Failed to parse" "$LOG_FILE" 2>/dev/null; then
    echo "4. JSON parsing still has issues despite markdown cleaning"
    echo "   → Review _parseToolPlan() implementation"
fi

echo ""
echo "================================"
echo "✅ Diagnostic complete"
