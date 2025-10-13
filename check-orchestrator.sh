#!/bin/bash
# Check orchestrator status and find actual logs location
# Run this on your Mac: ./check-orchestrator.sh

echo "═══════════════════════════════════════════════════════════════"
echo "  ATLAS Orchestrator Diagnostic Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Check if orchestrator is running
echo "1️⃣  ORCHESTRATOR PROCESS:"
echo "─────────────────────────────────────────────────────────"
if pgrep -f "node.*orchestrator" > /dev/null 2>&1; then
    PID=$(pgrep -f "node.*orchestrator" | head -1)
    echo "✅ Running (PID: $PID)"
    ps aux | grep $PID | grep -v grep
else
    echo "❌ NOT RUNNING"
    echo ""
    echo "Start it with: ./restart_system.sh restart"
fi
echo ""

# 2. Health check
echo "2️⃣  HEALTH ENDPOINT:"
echo "─────────────────────────────────────────────────────────"
HEALTH=$(curl -s http://localhost:5101/health 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ Responding: $HEALTH"
else
    echo "❌ Not responding"
    echo "Error: $HEALTH"
fi
echo ""

# 3. Find log files
echo "3️⃣  LOG FILES:"
echo "─────────────────────────────────────────────────────────"
LOG_DIR="$HOME/Documents/GitHub/atlas4/logs"

if [ -d "$LOG_DIR" ]; then
    echo "Log directory: $LOG_DIR"
    echo ""
    
    if [ -f "$LOG_DIR/orchestrator.log" ]; then
        SIZE=$(du -h "$LOG_DIR/orchestrator.log" | cut -f1)
        LINES=$(wc -l < "$LOG_DIR/orchestrator.log")
        MODIFIED=$(stat -f "%Sm" "$LOG_DIR/orchestrator.log" 2>/dev/null || stat -c "%y" "$LOG_DIR/orchestrator.log" 2>/dev/null)
        
        echo "✅ orchestrator.log found"
        echo "   Size: $SIZE"
        echo "   Lines: $LINES"
        echo "   Modified: $MODIFIED"
    else
        echo "❌ orchestrator.log NOT FOUND"
    fi
    
    echo ""
    echo "All logs in directory:"
    ls -lh "$LOG_DIR/"
else
    echo "❌ Log directory NOT FOUND: $LOG_DIR"
fi
echo ""

# 4. Check if logs are being written
echo "4️⃣  LIVE LOG CHECK (last 10 lines):"
echo "─────────────────────────────────────────────────────────"
if [ -f "$LOG_DIR/orchestrator.log" ]; then
    tail -10 "$LOG_DIR/orchestrator.log"
else
    echo "❌ No log file to check"
fi
echo ""

# 5. Test a simple request
echo "5️⃣  TEST REQUEST:"
echo "─────────────────────────────────────────────────────────"
echo "Sending test message..."

TEST_SESSION="diagnostic_$(date +%s)"
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Привіт\", \"sessionId\": \"$TEST_SESSION\"}" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>&1 | head -20

echo ""
echo "Waiting 3 seconds for logs to be written..."
sleep 3
echo ""

echo "Checking if request was logged:"
if [ -f "$LOG_DIR/orchestrator.log" ]; then
    grep "$TEST_SESSION" "$LOG_DIR/orchestrator.log" | tail -5
    
    if [ $? -eq 0 ]; then
        echo "✅ Request logged successfully"
    else
        echo "❌ Request NOT in logs (logging issue!)"
    fi
else
    echo "❌ No log file"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 SUMMARY:"
echo ""
echo "If orchestrator is NOT running → Start with: ./restart_system.sh restart"
echo "If logs are NOT being written → Check logger configuration"
echo "If health check FAILS → Check port 5101 is not in use"
echo ""
echo "Once orchestrator is running and logging, re-run the MCP test:"
echo "  ./test-mcp-json-fix.sh"
echo ""
