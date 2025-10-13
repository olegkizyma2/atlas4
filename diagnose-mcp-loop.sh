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

echo "📊 Last test session analysis..."
echo ""

# Get session ID from last test
SESSION_ID=$(tail -500 "$LOG_FILE" | grep "test_json_fix" | tail -1 | grep -oE "test_json_fix_[0-9]+" | head -1)

if [ -z "$SESSION_ID" ]; then
    echo "⚠️  No test session found, analyzing last TODO workflow..."
    SESSION_MARKER="TODO"
else
    echo "🔑 Found session: $SESSION_ID"
    SESSION_MARKER="$SESSION_ID"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 TODO Creation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -E "Created.*TODO|TODO.*items" "$LOG_FILE" | tail -5
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Stage 2.1 Executions (should be 1 per item)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STAGE21_LINES=$(grep -n "Planning tools for item" "$LOG_FILE" | tail -10)
echo "$STAGE21_LINES"
echo ""
STAGE21_COUNT=$(echo "$STAGE21_LINES" | wc -l | tr -d ' ')
echo "Total Stage 2.1 calls: $STAGE21_COUNT"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 LLM Responses (what Tetyana receives)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -A 3 "Raw LLM response" "$LOG_FILE" | tail -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Parsed Plans (after JSON parsing)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -A 10 "Parsed plan:" "$LOG_FILE" | tail -30
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Errors and Warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -E "Failed to parse|Warning.*tool|error.*item|attempt.*error" "$LOG_FILE" | tail -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Stage 2.2 Executions (actual tool runs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STAGE22_LINES=$(grep -E "Executing.*tool calls|STAGE-2\.2" "$LOG_FILE" | tail -10)
if [ -z "$STAGE22_LINES" ]; then
    echo "❌ No Stage 2.2 executions found (workflow stuck in planning!)"
else
    echo "$STAGE22_LINES"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Root Cause Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tool_calls array is empty
EMPTY_TOOLS=$(grep -c "tool_calls.*\[\]" "$LOG_FILE" 2>/dev/null || echo "0")
if [ "$EMPTY_TOOLS" -gt 0 ]; then
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
