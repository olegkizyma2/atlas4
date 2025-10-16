#!/bin/bash

# ╔════════════════════════════════════════════════════════════════╗
# ║          ATLAS v4.0 - Setup Test Script                        ║
# ║          Тестування повної установки                           ║
# ╚════════════════════════════════════════════════════════════════╝

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          🚀 ATLAS v4.0 - Тест установки                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Start time
START_TIME=$(date +%s)
START_DISPLAY=$(date '+%H:%M:%S')

echo -e "${YELLOW}⏱️  Початок: ${START_DISPLAY}${NC}"
echo -e "${YELLOW}📝 Лог файл: setup-test.log${NC}"
echo ""
echo -e "${BLUE}Виконую ./setup-macos.sh з логуванням...${NC}"
echo ""

# Run setup with logging
./setup-macos.sh 2>&1 | tee setup-test.log

# End time
END_TIME=$(date +%s)
END_DISPLAY=$(date '+%H:%M:%S')
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ УСТАНОВКА ЗАВЕРШЕНА                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⏱️  Початок:    ${START_DISPLAY}${NC}"
echo -e "${YELLOW}⏱️  Завершення: ${END_DISPLAY}${NC}"
echo -e "${YELLOW}⏱️  Тривалість: ${MINUTES}м ${SECONDS}с${NC}"
echo ""

# Validate installation
echo -e "${BLUE}🔍 Перевірка установки...${NC}"
echo ""

# Check Python venv
if [ -f "web/venv/bin/python" ]; then
    echo -e "${GREEN}✅ Python venv створено${NC}"
    PYTHON_VERSION=$(./web/venv/bin/python --version 2>&1)
    echo "   ${PYTHON_VERSION}"
else
    echo -e "${RED}❌ Python venv НЕ знайдено${NC}"
fi

# Check Ukrainian TTS
if ./web/venv/bin/pip list 2>/dev/null | grep -q ukrainian-tts; then
    echo -e "${GREEN}✅ Ukrainian TTS встановлено${NC}"
else
    echo -e "${RED}❌ Ukrainian TTS НЕ встановлено${NC}"
fi

# Check Node modules
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Node.js залежності встановлено${NC}"
else
    echo -e "${RED}❌ Node.js залежності НЕ встановлено${NC}"
fi

# Check Whisper.cpp build
if [ -f "third_party/whisper.cpp.upstream/build/bin/whisper-cli" ]; then
    echo -e "${GREEN}✅ Whisper.cpp зібрано${NC}"
else
    echo -e "${RED}❌ Whisper.cpp НЕ зібрано${NC}"
fi

# Check .env
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env файл створено${NC}"
else
    echo -e "${RED}❌ .env файл НЕ створено${NC}"
fi

# Check Goose config
if [ -f "$HOME/.config/goose/config.yaml" ]; then
    echo -e "${GREEN}✅ Goose config створено${NC}"
else
    echo -e "${RED}❌ Goose config НЕ створено${NC}"
fi

echo ""
echo -e "${BLUE}📊 Детальний лог: setup-test.log${NC}"
echo -e "${BLUE}📊 Розмір логу: $(wc -l < setup-test.log) рядків${NC}"
echo ""
