#!/bin/bash

# ╔════════════════════════════════════════════════════════════════╗
# ║          ATLAS v4.0 - Cleanup Script                           ║
# ║          Очищення середовища перед тестом                      ║
# ╚════════════════════════════════════════════════════════════════╝

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          🧹 ОЧИЩЕННЯ СЕРЕДОВИЩА ATLAS v4.0                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}⚠️  Це видалить:${NC}"
echo "   • web/venv/ (Python віртуальне середовище)"
echo "   • node_modules/ (Node.js залежності)"
echo "   • third_party/whisper.cpp.upstream/build/ (Whisper компіляція)"
echo "   • .env (конфігурація)"
echo "   • setup-test.log (логи)"
echo ""

# Збереження важливих файлів
echo -e "${BLUE}📦 Збережено (НЕ видаляється):${NC}"
if [ -f "models/whisper/ggml-large-v3.bin" ]; then
    SIZE=$(du -h "models/whisper/ggml-large-v3.bin" | cut -f1)
    echo -e "   ${GREEN}✓${NC} models/whisper/ggml-large-v3.bin (${SIZE})"
fi
if [ -f "web/static/assets/DamagedHelmet.glb" ]; then
    SIZE=$(du -h "web/static/assets/DamagedHelmet.glb" | cut -f1)
    echo -e "   ${GREEN}✓${NC} web/static/assets/DamagedHelmet.glb (${SIZE})"
fi
echo ""

read -p "Продовжити? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Очищення скасовано${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}📁 Видалення середовищ...${NC}"

# Cleanup
rm -rf web/venv && echo -e "   ${GREEN}✓${NC} web/venv/"
rm -rf node_modules && echo -e "   ${GREEN}✓${NC} node_modules/"
rm -rf config/node_modules && echo -e "   ${GREEN}✓${NC} config/node_modules/"
rm -rf orchestrator/node_modules && echo -e "   ${GREEN}✓${NC} orchestrator/node_modules/"
rm -f package-lock.json && echo -e "   ${GREEN}✓${NC} package-lock.json"
rm -f config/package-lock.json && echo -e "   ${GREEN}✓${NC} config/package-lock.json"
rm -rf third_party/whisper.cpp.upstream/build && echo -e "   ${GREEN}✓${NC} third_party/whisper.cpp.upstream/build/"
rm -f .env && echo -e "   ${GREEN}✓${NC} .env"
rm -f setup-test.log && echo -e "   ${GREEN}✓${NC} setup-test.log"

echo ""
echo -e "${GREEN}✅ Очищення завершено${NC}"
echo ""
echo -e "${BLUE}💡 Тепер можна запустити:${NC}"
echo -e "   ${YELLOW}./test-setup.sh${NC}  - повний тест установки"
echo ""
