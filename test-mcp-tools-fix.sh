#!/bin/bash

# Test MCP Tools Array Fix - 14.10.2025
# Перевіряє що виправлення працює

echo "🔍 Testing MCP Tools Array Fix..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check prompts/package.json has type: module
echo "Test 1: Перевірка prompts/package.json..."
if grep -q '"type": "module"' prompts/package.json; then
    echo -e "${GREEN}✅ PASS${NC}: prompts/package.json має type: module"
else
    echo -e "${RED}❌ FAIL${NC}: prompts/package.json НЕ має type: module"
fi
echo ""

# Test 2: Check MCP Manager має Array.isArray перевірки
echo "Test 2: Перевірка Array.isArray() guards..."
if grep -q "Array.isArray(toolsData)" orchestrator/ai/mcp-manager.js; then
    echo -e "${GREEN}✅ PASS${NC}: _handleMCPMessage має Array.isArray guard"
else
    echo -e "${RED}❌ FAIL${NC}: _handleMCPMessage БЕЗ Array.isArray guard"
fi

if grep -q "Array.isArray(server.tools)" orchestrator/ai/mcp-manager.js; then
    echo -e "${GREEN}✅ PASS${NC}: Інші методи мають Array.isArray guards"
else
    echo -e "${RED}❌ FAIL${NC}: Інші методи БЕЗ Array.isArray guards"
fi
echo ""

# Test 3: Check logs після restart (якщо система запущена)
echo "Test 3: Перевірка логів (якщо orchestrator запущено)..."
if [ -f logs/orchestrator.log ]; then
    # Перевірити чи є TypeError з tools.some
    if grep -q "tools.some is not a function" logs/orchestrator.log | tail -50; then
        echo -e "${YELLOW}⚠️  WARNING${NC}: В логах є старі TypeError (можливо перед рестартом)"
    else
        echo -e "${GREEN}✅ PASS${NC}: Немає TypeError з tools.some в останніх логах"
    fi
    
    # Перевірити чи є module warning
    if grep -q "MODULE_TYPELESS_PACKAGE_JSON" logs/orchestrator.log | tail -50; then
        echo -e "${YELLOW}⚠️  WARNING${NC}: В логах є module warning (можливо перед рестартом)"
    else
        echo -e "${GREEN}✅ PASS${NC}: Немає module warnings в останніх логах"
    fi
    
    # Перевірити чи tools ініціалізуються як числа
    TOOLS_INIT=$(grep "Initialized with.*tools" logs/orchestrator.log | tail -5)
    if echo "$TOOLS_INIT" | grep -q "undefined tools"; then
        echo -e "${RED}❌ FAIL${NC}: MCP servers мають undefined tools"
    else
        echo -e "${GREEN}✅ PASS${NC}: MCP servers ініціалізуються з числовими значеннями tools"
    fi
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: Логи не знайдено (orchestrator не запущений?)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Виправлення застосовано. Для повного тестування:"
echo ""
echo "1. Restart orchestrator:"
echo "   ${YELLOW}./restart_system.sh restart${NC}"
echo ""
echo "2. Перевірити MCP initialization:"
echo "   ${YELLOW}tail -f logs/orchestrator.log | grep 'MCP.*Initialized'${NC}"
echo ""
echo "3. Test TODO execution:"
echo "   ${YELLOW}curl -X POST http://localhost:5101/chat/stream \\${NC}"
echo "   ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo "   ${YELLOW}  -d '{\"message\": \"відкрий калькулятор\", \"sessionId\": \"test\"}'${NC}"
echo ""
echo "4. Перевірити що немає TypeError:"
echo "   ${YELLOW}grep 'tools.some is not a function' logs/orchestrator.log${NC}"
echo "   ${YELLOW}# Має бути порожньо після рестарту${NC}"
echo ""

# Documentation
echo "📚 Детальна документація:"
echo "   ${YELLOW}docs/MCP_TOOLS_ARRAY_FIX_2025-10-14.md${NC}"
echo ""
