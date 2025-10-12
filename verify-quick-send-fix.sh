#!/bin/bash

# Quick-Send Filter Fix Verification Script
# Дата: 12.10.2025, день ~13:30

echo "🔍 Quick-Send Filter Fix - Verification"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if filters.js has the fix
echo "📁 Checking filters.js for fix..."
if grep -q "isConversationMode && isBackgroundPhrase" /workspaces/atlas4/web/static/js/voice-control/conversation/filters.js; then
    echo -e "${GREEN}✅ FILTER 2 FIXED${NC} - isConversationMode guard present"
else
    echo -e "${RED}❌ FILTER 2 NOT FIXED${NC} - missing isConversationMode guard"
    exit 1
fi

if grep -q "isConversationMode && shouldReturnToKeywordMode" /workspaces/atlas4/web/static/js/voice-control/conversation/filters.js; then
    echo -e "${GREEN}✅ FILTER 3 FIXED${NC} - isConversationMode guard present"
else
    echo -e "${RED}❌ FILTER 3 NOT FIXED${NC} - missing isConversationMode guard"
    exit 1
fi

# Check documentation
echo ""
echo "📖 Checking documentation..."
if [ -f /workspaces/atlas4/docs/QUICK_SEND_FILTER_FIX_2025-10-12.md ]; then
    echo -e "${GREEN}✅ Full report created${NC}"
else
    echo -e "${YELLOW}⚠️ Full report missing${NC}"
fi

if [ -f /workspaces/atlas4/docs/QUICK_SEND_FILTER_TESTING.md ]; then
    echo -e "${GREEN}✅ Testing guide created${NC}"
else
    echo -e "${YELLOW}⚠️ Testing guide missing${NC}"
fi

if [ -f /workspaces/atlas4/docs/QUICK_SEND_FILTER_FIX_SUMMARY.md ]; then
    echo -e "${GREEN}✅ Quick summary created${NC}"
else
    echo -e "${YELLOW}⚠️ Quick summary missing${NC}"
fi

# Check Copilot Instructions
echo ""
echo "📝 Checking Copilot Instructions..."
if grep -q "Quick-Send Filter Fix" /workspaces/atlas4/.github/copilot-instructions.md; then
    echo -e "${GREEN}✅ Copilot Instructions updated${NC}"
else
    echo -e "${YELLOW}⚠️ Copilot Instructions not updated${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Restart system: ./restart_system.sh restart"
echo "2. Open browser: http://localhost:5001"
echo "3. Test Quick-send: Click mic → 'Дякую за перегляд!' → should send ✅"
echo "4. Test Conversation: Hold 2s → 'Атлас' → YouTube 'Дякую за перегляд!' → should filter ✅"
echo ""
echo "📖 Documentation:"
echo "- Full Report: docs/QUICK_SEND_FILTER_FIX_2025-10-12.md"
echo "- Testing Guide: docs/QUICK_SEND_FILTER_TESTING.md"
echo "- Quick Summary: docs/QUICK_SEND_FILTER_FIX_SUMMARY.md"
echo ""
