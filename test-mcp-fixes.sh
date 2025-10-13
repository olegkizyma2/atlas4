#!/bin/bash

# MCP Workflow Testing Script
# Test all 3 fixes: workflowStart, content.replace, LLM API calls

echo "🧪 MCP Workflow Testing - 13.10.2025"
echo "===================================="
echo ""

echo "📋 Fixes Applied:"
echo "  ✅ Fix #1: workflowStart defined in executeWorkflowStages()"
echo "  ✅ Fix #2: Type-safe content handling (.replace crashes fixed)"
echo "  ✅ Fix #3: LLM API calls (axios.post in planTools/verifyItem/adjustTodoItem)"
echo ""

echo "🔍 What to look for in logs:"
echo "  ✅ [TODO] Created extended TODO with N items"
echo "  ✅ [TODO] Planning tools for item X (NO infinite retries)"
echo "  ✅ [TODO] Planned X tool calls"
echo "  ✅ [TODO] Executing X tool calls"
echo "  ✅ [TODO] Tool execution successful"
echo "  ✅ [TODO] Verifying item X"
echo "  ✅ [TODO] ✅ Item X completed"
echo "  ✅ NO 'workflowStart is not defined' errors"
echo "  ✅ NO 'content.replace is not a function' errors"
echo ""

echo "📊 Expected Results:"
echo "  - TODO items: 100% success rate (was 0%)"
echo "  - Stage 2.1: Executes ONCE per item (not 3x)"
echo "  - All 6 items complete successfully"
echo "  - Backend fallback works without errors"
echo ""

echo "🚀 Starting log monitoring..."
echo "   Press Ctrl+C to stop"
echo ""

tail -f ~/Documents/GitHub/atlas4/logs/orchestrator.log | grep -E "MCP|TODO|Stage|workflowStart|content\.replace"
