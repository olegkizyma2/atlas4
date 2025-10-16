#!/bin/bash

# ╔════════════════════════════════════════════════════════════════╗
# ║          ATLAS v4.0 - Quick Check Script                       ║
# ║          Швидка перевірка стану системи                        ║
# ╚════════════════════════════════════════════════════════════════╝

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          🔍 ATLAS v4.0 - Перевірка стану                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Python venv
echo -e "${BLUE}🐍 Python Virtual Environment:${NC}"
if [ -f "web/venv/bin/python" ]; then
    echo -e "   ${GREEN}✓${NC} venv створено"
    PYTHON_VERSION=$(./web/venv/bin/python --version 2>&1)
    echo -e "   ${GREEN}✓${NC} ${PYTHON_VERSION}"
    
    # Count installed packages
    PKG_COUNT=$(./web/venv/bin/pip list 2>/dev/null | tail -n +3 | wc -l | tr -d ' ')
    echo -e "   ${GREEN}✓${NC} Встановлено пакетів: ${PKG_COUNT}"
    
    # Check key packages
    if ./web/venv/bin/pip list 2>/dev/null | grep -q ukrainian-tts; then
        echo -e "   ${GREEN}✓${NC} Ukrainian TTS"
    else
        echo -e "   ${RED}✗${NC} Ukrainian TTS НЕ встановлено"
    fi
    
    if ./web/venv/bin/pip list 2>/dev/null | grep -q espnet; then
        echo -e "   ${GREEN}✓${NC} ESPnet"
    else
        echo -e "   ${RED}✗${NC} ESPnet НЕ встановлено"
    fi
    
    if ./web/venv/bin/pip list 2>/dev/null | grep -q torch; then
        echo -e "   ${GREEN}✓${NC} PyTorch"
    else
        echo -e "   ${RED}✗${NC} PyTorch НЕ встановлено"
    fi
else
    echo -e "   ${RED}✗${NC} venv НЕ знайдено"
fi

echo ""

# Check Node.js
echo -e "${BLUE}📦 Node.js Dependencies:${NC}"
if [ -d "node_modules" ]; then
    echo -e "   ${GREEN}✓${NC} node_modules/"
    PKG_COUNT=$(ls -1 node_modules | wc -l | tr -d ' ')
    echo -e "   ${GREEN}✓${NC} Встановлено пакетів: ${PKG_COUNT}"
else
    echo -e "   ${RED}✗${NC} node_modules/ НЕ знайдено"
fi

if [ -d "config/node_modules" ]; then
    CONFIG_PKG_COUNT=$(ls -1 config/node_modules | wc -l | tr -d ' ')
    echo -e "   ${GREEN}✓${NC} config/node_modules/ (${CONFIG_PKG_COUNT} packages)"
else
    echo -e "   ${RED}✗${NC} config/node_modules/ НЕ знайдено"
fi

if [ -d "orchestrator/node_modules" ]; then
    ORCH_PKG_COUNT=$(ls -1 orchestrator/node_modules | wc -l | tr -d ' ')
    echo -e "   ${GREEN}✓${NC} orchestrator/node_modules/ (${ORCH_PKG_COUNT} packages)"
else
    echo -e "   ${RED}✗${NC} orchestrator/node_modules/ НЕ знайдено"
    echo -e "   ${YELLOW}⚠️${NC}  Виправлення: cd orchestrator && npm install"
fi

echo ""

# Check Whisper.cpp
echo -e "${BLUE}🎤 Whisper.cpp:${NC}"
if [ -d "third_party/whisper.cpp.upstream/build" ]; then
    echo -e "   ${GREEN}✓${NC} build/ директорія існує"
    
    if [ -f "third_party/whisper.cpp.upstream/build/bin/whisper-cli" ]; then
        echo -e "   ${GREEN}✓${NC} whisper-cli зібрано"
        SIZE=$(du -h "third_party/whisper.cpp.upstream/build/bin/whisper-cli" | cut -f1)
        echo -e "   ${GREEN}✓${NC} Розмір: ${SIZE}"
    else
        echo -e "   ${RED}✗${NC} whisper-cli НЕ знайдено"
    fi
else
    echo -e "   ${RED}✗${NC} build/ директорія НЕ існує"
fi

# Check Whisper model
if [ -f "models/whisper/ggml-large-v3.bin" ]; then
    SIZE=$(du -h "models/whisper/ggml-large-v3.bin" | cut -f1)
    echo -e "   ${GREEN}✓${NC} Модель Large-v3 (${SIZE})"
else
    echo -e "   ${RED}✗${NC} Модель Large-v3 НЕ завантажена"
fi

echo ""

# Check Configuration
echo -e "${BLUE}⚙️  Configuration:${NC}"
if [ -f ".env" ]; then
    echo -e "   ${GREEN}✓${NC} .env файл створено"
    
    # Show key settings
    if grep -q "WHISPER_DEVICE=metal" .env 2>/dev/null; then
        echo -e "   ${GREEN}✓${NC} Whisper Metal GPU enabled"
    fi
    
    if grep -q "TTS_DEVICE=mps" .env 2>/dev/null; then
        echo -e "   ${GREEN}✓${NC} TTS MPS device enabled"
    fi
else
    echo -e "   ${RED}✗${NC} .env файл НЕ знайдено"
fi

if [ -f "$HOME/.config/goose/config.yaml" ]; then
    echo -e "   ${GREEN}✓${NC} Goose config створено"
else
    echo -e "   ${RED}✗${NC} Goose config НЕ знайдено"
fi

echo ""

# Check 3D model
echo -e "${BLUE}🎨 3D Assets:${NC}"
if [ -f "web/static/assets/DamagedHelmet.glb" ]; then
    SIZE=$(du -h "web/static/assets/DamagedHelmet.glb" | cut -f1)
    echo -e "   ${GREEN}✓${NC} DamagedHelmet.glb (${SIZE})"
else
    echo -e "   ${RED}✗${NC} DamagedHelmet.glb НЕ завантажено"
fi

echo ""

# Overall status
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
if [ -f "web/venv/bin/python" ] && [ -d "node_modules" ] && [ -f "third_party/whisper.cpp.upstream/build/bin/whisper-cli" ] && [ -f ".env" ]; then
    echo -e "${GREEN}║          ✅ Система готова до запуску                          ║${NC}"
else
    echo -e "${RED}║          ⚠️  Система НЕ повністю налаштована                   ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
