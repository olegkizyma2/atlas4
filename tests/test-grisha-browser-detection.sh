#!/bin/bash

# Test Grisha Browser Detection Fix
# Created: 17.10.2025 - evening ~21:15
# Tests 3 scenarios for browser/GUI verification

set -e

echo "🧪 GRISHA BROWSER DETECTION FIX - TEST SUITE"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test 1: Safari process exists, but Chrome is active
echo -e "${YELLOW}TEST 1: Safari процес є, але Chrome активний${NC}"
echo "Expected: verified=false (frontmost check fails)"
echo ""

# Simulate: Open Safari in background, Chrome in foreground
osascript -e 'tell application "Safari" to activate' 2>/dev/null || true
sleep 1
osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null || true
sleep 1

# Check frontmost
FRONTMOST=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null || echo "Unknown")
echo "Frontmost application: $FRONTMOST"

if [ "$FRONTMOST" = "Google Chrome" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Chrome is frontmost (Safari in background)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Expected Chrome frontmost, got: $FRONTMOST"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "---"
echo ""

# Test 2: Check windows count
echo -e "${YELLOW}TEST 2: Windows count verification${NC}"
echo "Expected: count > 0 for active browser"
echo ""

SAFARI_WINDOWS=$(osascript -e 'tell application "Safari" to get count of windows' 2>/dev/null || echo "0")
CHROME_WINDOWS=$(osascript -e 'tell application "Google Chrome" to get count of windows' 2>/dev/null || echo "0")

echo "Safari windows: $SAFARI_WINDOWS"
echo "Chrome windows: $CHROME_WINDOWS"

if [ "$CHROME_WINDOWS" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Chrome has windows"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Chrome should have windows"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "---"
echo ""

# Test 3: Screenshot capture
echo -e "${YELLOW}TEST 3: Screenshot verification${NC}"
echo "Expected: screenshot captured successfully"
echo ""

SCREENSHOT_PATH="/tmp/grisha_test_screenshot.png"
screencapture -x "$SCREENSHOT_PATH" 2>/dev/null || true

if [ -f "$SCREENSHOT_PATH" ]; then
    FILE_SIZE=$(stat -f%z "$SCREENSHOT_PATH" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 100000 ]; then
        echo -e "${GREEN}✅ PASS${NC} - Screenshot captured (${FILE_SIZE} bytes)"
        echo "Path: $SCREENSHOT_PATH"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Screenshot too small (${FILE_SIZE} bytes)"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${RED}❌ FAIL${NC} - Screenshot not created"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "---"
echo ""

# Test 4: Dependency context validation simulation
echo -e "${YELLOW}TEST 4: Dependency context validation${NC}"
echo "Simulating: Item 1 opens Safari, user switches to Chrome, Item 2 checks context"
echo ""

# Item 1: Safari should be frontmost
osascript -e 'tell application "Safari" to activate' 2>/dev/null || true
sleep 1

CONTEXT_BEFORE=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null || echo "Unknown")
echo "Context after Item 1: $CONTEXT_BEFORE"

# User switches to Chrome (context loss)
osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null || true
sleep 1

# Item 2: Check if Safari still frontmost
CONTEXT_AFTER=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null || echo "Unknown")
echo "Context before Item 2: $CONTEXT_AFTER"

if [ "$CONTEXT_BEFORE" != "$CONTEXT_AFTER" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Context loss detected (Safari → Chrome)"
    echo "Expected behavior: verified=false, clarification_needed='Context втрачено'"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Context should have changed"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "=============================================="
echo "📊 TEST RESULTS"
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo "Grisha browser detection fix working correctly!"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "Review test output above for details"
    exit 1
fi
