#!/bin/bash
# Extract MCP diagnostic information from logs
# Run this on your Mac to find the actual error

LOG_FILE="$HOME/Documents/GitHub/atlas4/logs/orchestrator.log"

echo "═══════════════════════════════════════════════════════════════"
echo "  MCP JSON Parsing Fix - Diagnostic Log Extractor"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Error: Log file not found at $LOG_FILE"
    exit 1
fi

echo "📋 Extracting diagnostic information..."
echo ""

# 1. Check for planning errors
echo "1️⃣  PLANNING ERRORS:"
echo "─────────────────────────────────────────────────────────"
grep -E "(Failed to plan tools|Tool planning failed)" "$LOG_FILE" | tail -10
echo ""

# 2. Check for raw LLM responses
echo "2️⃣  RAW LLM RESPONSES:"
echo "─────────────────────────────────────────────────────────"
grep "Raw LLM response" "$LOG_FILE" | tail -5
echo ""

# 3. Check for empty tool calls
echo "3️⃣  EMPTY TOOL CALLS:"
echo "─────────────────────────────────────────────────────────"
grep "No tool calls generated" "$LOG_FILE" | tail -5
if [ $? -ne 0 ]; then
    echo "(none found)"
fi
echo ""

# 4. Check for parse errors
echo "4️⃣  PARSE ERRORS:"
echo "─────────────────────────────────────────────────────────"
grep "Failed to parse tool plan" "$LOG_FILE" | tail -5
if [ $? -ne 0 ]; then
    echo "(none found - parsing is working! ✅)"
fi
echo ""

# 5. Check axios errors
echo "5️⃣  AXIOS/API ERRORS:"
echo "─────────────────────────────────────────────────────────"
grep -E "(ECONNREFUSED|axios|localhost:4000)" "$LOG_FILE" | tail -10
if [ $? -ne 0 ]; then
    echo "(none found)"
fi
echo ""

# 6. Check stage processor results
echo "6️⃣  STAGE PROCESSOR RESULTS:"
echo "─────────────────────────────────────────────────────────"
grep "planTools() returned:" "$LOG_FILE" | tail -5
if [ $? -ne 0 ]; then
    echo "(not logged yet - update orchestrator)"
fi
echo ""

# 7. Get last 50 lines of MCP workflow
echo "7️⃣  LAST 50 LINES OF MCP WORKFLOW:"
echo "─────────────────────────────────────────────────────────"
grep -E "STAGE-2|TODO|MCP" "$LOG_FILE" | tail -50
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📤 Please share these logs with the diagnostic results!"
echo ""
