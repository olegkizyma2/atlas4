#!/bin/bash

# =============================================================================
# ATLAS v4.0 - Швидке виправлення orchestrator/node_modules
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  🔧 Встановлення orchestrator залежностей                   ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$REPO_ROOT/orchestrator"

if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ package.json не знайдено в orchestrator/${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Встановлення залежностей...${NC}"
npm install

if [ -d "node_modules" ]; then
    PKG_COUNT=$(ls -1 node_modules | wc -l | tr -d ' ')
    echo ""
    echo -e "${GREEN}✅ Успішно встановлено${NC}"
    echo -e "   Пакетів: ${PKG_COUNT}"
    echo -e "   Директорія: ${REPO_ROOT}/orchestrator/node_modules/"
    echo ""
    
    echo -e "${BLUE}📋 Основні залежності:${NC}"
    [ -d "node_modules/express" ] && echo -e "   ${GREEN}✓${NC} express"
    [ -d "node_modules/axios" ] && echo -e "   ${GREEN}✓${NC} axios"
    [ -d "node_modules/winston" ] && echo -e "   ${GREEN}✓${NC} winston"
    [ -d "node_modules/ws" ] && echo -e "   ${GREEN}✓${NC} ws"
    [ -d "node_modules/cors" ] && echo -e "   ${GREEN}✓${NC} cors"
    [ -d "node_modules/dotenv" ] && echo -e "   ${GREEN}✓${NC} dotenv"
    echo ""
else
    echo -e "${RED}✗ Помилка встановлення${NC}"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}          ✅ Orchestrator готовий до запуску                  ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
