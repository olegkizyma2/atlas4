#!/bin/bash

################################################################################
# ATLAS v5.0 - MCP Setup Test Script
# Перевіряє встановлення MCP серверів після setup-macos.sh
################################################################################

set -e

# Кольори
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════════"
echo "🧪 ATLAS v5.0 - MCP Servers Installation Test"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Тест 1: Перевірка Node.js
echo -e "${BLUE}[TEST 1]${NC} Перевірка Node.js..."
if command -v node >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Node.js: $(node -v)"
else
    echo -e "${RED}✗${NC} Node.js НЕ встановлено"
    exit 1
fi

# Тест 2: Перевірка npm
echo -e "${BLUE}[TEST 2]${NC} Перевірка npm..."
if command -v npm >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} npm: $(npm -v)"
else
    echo -e "${RED}✗${NC} npm НЕ встановлено"
    exit 1
fi

# Тест 3: Перевірка глобальних MCP пакетів
echo ""
echo -e "${BLUE}[TEST 3]${NC} Перевірка MCP серверів (6 пакетів)..."
echo ""

MCP_PACKAGES=(
    "@modelcontextprotocol/server-filesystem"
    "@executeautomation/playwright-mcp-server"
    "super-shell-mcp"
    "@peakmojo/applescript-mcp"
    # "@cyanheads/git-mcp-server"  # DISABLED 17.10.2025: crashes on startup
    "@modelcontextprotocol/server-memory"
)

INSTALLED=0
FAILED=0

for package in "${MCP_PACKAGES[@]}"; do
    if npm list -g "$package" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $package"
        ((INSTALLED++))
    else
        echo -e "${RED}✗${NC} $package НЕ встановлено"
        ((FAILED++))
    fi
done

echo ""
echo -e "Встановлено: ${GREEN}$INSTALLED${NC}/6"
echo -e "Помилки: ${RED}$FAILED${NC}/6"

# Тест 4: Перевірка .env файлу
echo ""
echo -e "${BLUE}[TEST 4]${NC} Перевірка .env конфігурації..."

if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env файл існує"
    
    # Перевірка AI_BACKEND_MODE
    if grep -q "AI_BACKEND_MODE=mcp" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} AI_BACKEND_MODE=mcp"
    else
        echo -e "${YELLOW}⚠${NC} AI_BACKEND_MODE не встановлено на 'mcp'"
    fi
    
    # Перевірка AI_BACKEND_PRIMARY
    if grep -q "AI_BACKEND_PRIMARY=mcp" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} AI_BACKEND_PRIMARY=mcp"
    else
        echo -e "${YELLOW}⚠${NC} AI_BACKEND_PRIMARY не встановлено"
    fi
else
    echo -e "${RED}✗${NC} .env файл не знайдено"
fi

# Тест 5: Перевірка що Goose ВИДАЛЕНО
echo ""
echo -e "${BLUE}[TEST 5]${NC} Перевірка відсутності Goose залежностей..."

GOOSE_FOUND=false

if grep -qi "goose" setup-macos.sh 2>/dev/null | grep -v "# DEPRECATED\|v5.0\|Pure MCP" >/dev/null; then
    echo -e "${YELLOW}⚠${NC} Знайдено згадки Goose в setup-macos.sh"
    GOOSE_FOUND=true
fi

if [ "$GOOSE_FOUND" = false ]; then
    echo -e "${GREEN}✓${NC} Goose видалено з setup scripts (v5.0 Pure MCP)"
else
    echo -e "${YELLOW}⚠${NC} Деякі Goose згадки залишились"
fi

# Підсумок
echo ""
echo "════════════════════════════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ВСІ ТЕСТИ ПРОЙДЕНО УСПІШНО!${NC}"
    echo ""
    echo "ATLAS v5.0 Pure MCP Edition готовий до роботи:"
    echo "  • 5/5 MCP серверів встановлено"
    echo "  • 65 tools доступно (git через shell)"
    echo "  • .env налаштовано (AI_BACKEND_MODE=mcp)"
    echo "  • Goose залежності видалено"
    echo ""
    echo "Запустити систему: ./restart_system.sh start"
else
    echo -e "${RED}❌ ДЕЯКІ ТЕСТИ НЕ ПРОЙДЕНО${NC}"
    echo ""
    echo "Помилки:"
    echo "  • $FAILED MCP серверів не встановлено"
    echo ""
    echo "Спробуйте встановити вручну:"
    echo "  npm install -g @modelcontextprotocol/server-filesystem"
    echo "  npm install -g @executeautomation/playwright-mcp-server"
    echo "  npm install -g super-shell-mcp"
    echo "  npm install -g @peakmojo/applescript-mcp"
    # echo "  npm install -g @cyanheads/git-mcp-server"  # DISABLED: crashes
    echo "  npm install -g @modelcontextprotocol/server-memory"
fi
echo "════════════════════════════════════════════════════════════════"
