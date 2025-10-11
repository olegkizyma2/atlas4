#!/bin/bash

# Quick-Send Voice Test Script
# Tests: Click → Record → Silence → Auto-stop → Transcription → Chat

echo "🧪 Testing Quick-Send Voice Mode..."
echo ""
echo "📋 Test Steps:"
echo "  1. Open http://localhost:5001 in browser"
echo "  2. Click microphone button (short click)"
echo "  3. Say: 'Привіт, Атлас!'"
echo "  4. Wait for silence auto-stop (~2 seconds)"
echo "  5. Check that text appears in chat"
echo ""
echo "✅ Expected Results:"
echo "  - Transcription completes successfully"
echo "  - Text 'Привіт, Атлас!' appears in chat"
echo "  - NO 'text.trim is not a function' errors"
echo "  - NO 'empty audio payload' spam"
echo ""
echo "❌ Known Issues (FIXED):"
echo "  - text.trim TypeError → FIXED (payload extraction)"
echo "  - Empty audio × 3 → FIXED (removed duplicate handler)"
echo ""
echo "📊 Validation Commands:"
echo ""
echo "# Check for errors in console (should be empty):"
echo "grep -i 'text.trim' logs/orchestrator.log"
echo "grep -i 'empty audio' logs/orchestrator.log"
echo ""
echo "# Monitor voice system:"
echo "tail -f logs/orchestrator.log | grep -E '(WHISPER|MICROPHONE|VOICE)'"
echo ""
echo "🎯 Press ENTER when ready to start monitoring..."
read

# Start monitoring
echo ""
echo "📡 Monitoring voice system logs..."
echo "   (Perform the test now in browser)"
echo ""

tail -f logs/orchestrator.log 2>/dev/null | grep -E "(WHISPER|MICROPHONE|VOICE|Transcription|text\.trim|empty audio)" --color=always
