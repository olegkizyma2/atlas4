#!/bin/bash
# 🚀 QUICK START - MCP Workflow Testing
# Run this first to get started immediately

set -e

echo "════════════════════════════════════════════════════════════════"
echo "🚀 MCP DYNAMIC TODO WORKFLOW - QUICK START"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ════════════════════════════════════════════════════════════════
# STEP 1: Install Test Dependencies
# ════════════════════════════════════════════════════════════════

echo -e "${BLUE}STEP 1: Installing test dependencies...${NC}"

cd "$ROOT_DIR"

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm not found. Please install Node.js first.${NC}"
    exit 1
fi

# Install Jest and test dependencies
npm install --save-dev jest @jest/globals

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ════════════════════════════════════════════════════════════════
# STEP 2: Verify System Services
# ════════════════════════════════════════════════════════════════

echo -e "${BLUE}STEP 2: Checking system services...${NC}"

./restart_system.sh status || true

echo ""
echo -e "${YELLOW}If services are not running, start them with:${NC}"
echo "  ./restart_system.sh start"
echo ""

# ════════════════════════════════════════════════════════════════
# STEP 3: Run Quick Tests
# ════════════════════════════════════════════════════════════════

echo -e "${BLUE}STEP 3: Running quick tests...${NC}"
echo ""

# Run the quick test script
./tests/test-mcp-workflow.sh

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ QUICK START COMPLETE!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. View test results above"
echo "2. Read detailed instructions:"
echo "   cat docs/MANUAL_TESTING_INSTRUCTIONS.md"
echo ""
echo "3. Run full test suite:"
echo "   npm test"
echo ""
echo "4. Run specific test layers:"
echo "   npm run test:unit          # Unit tests"
echo "   npm run test:integration   # Integration tests"
echo "   npm run test:e2e           # End-to-end tests"
echo ""
echo "5. Manual testing in browser:"
echo "   http://localhost:5001"
echo ""
echo "6. Monitor logs:"
echo "   tail -f logs/orchestrator.log | grep -E 'MCP|TODO|Circuit'"
echo ""
echo "════════════════════════════════════════════════════════════════"
