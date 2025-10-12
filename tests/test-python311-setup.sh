#!/bin/bash

# =============================================================================
# ATLAS v4.0 - Test Python 3.11 Setup
# =============================================================================
# Швидка перевірка чи система готова для роботи
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 ATLAS Python 3.11 Setup Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Python version
echo -e "${YELLOW}[TEST 1]${NC} Перевірка Python версії..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    if [[ "$PYTHON_VERSION" == 3.11.* ]]; then
        echo -e "${GREEN}✅ PASS${NC} - Python 3.11 встановлено: $PYTHON_VERSION"
    else
        echo -e "${RED}❌ FAIL${NC} - Python $PYTHON_VERSION (потрібен 3.11.x)"
        echo "   Запустіть: ./setup-macos.sh"
        exit 1
    fi
else
    echo -e "${RED}❌ FAIL${NC} - Python 3 не знайдено"
    echo "   Запустіть: ./setup-macos.sh"
    exit 1
fi

# Test 2: python3.11 command
echo -e "${YELLOW}[TEST 2]${NC} Перевірка python3.11 команди..."
if command -v python3.11 &> /dev/null; then
    echo -e "${GREEN}✅ PASS${NC} - python3.11 доступний"
else
    echo -e "${YELLOW}⚠️ WARN${NC} - python3.11 команда відсутня (але python3 працює)"
fi

# Test 3: Virtual environment
echo -e "${YELLOW}[TEST 3]${NC} Перевірка віртуального середовища..."
if [ -d "web/venv" ]; then
    VENV_VERSION=$(web/venv/bin/python --version 2>&1 | awk '{print $2}')
    if [[ "$VENV_VERSION" == 3.11.* ]]; then
        echo -e "${GREEN}✅ PASS${NC} - venv створено з Python 3.11: $VENV_VERSION"
    else
        echo -e "${RED}❌ FAIL${NC} - venv має Python $VENV_VERSION (потрібен 3.11.x)"
        echo "   Видаліть старе venv: rm -rf web/venv"
        echo "   Запустіть: ./setup-macos.sh"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ WARN${NC} - Віртуальне середовище НЕ створено"
    echo "   Запустіть: ./setup-macos.sh"
    exit 1
fi

# Test 4: Critical packages
echo -e "${YELLOW}[TEST 4]${NC} Перевірка критичних пакетів..."
source web/venv/bin/activate 2>/dev/null

MISSING_PACKAGES=()

for pkg in Flask torch faster-whisper; do
    if python -c "import $pkg" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $pkg"
    else
        echo -e "  ${RED}✗${NC} $pkg (відсутній)"
        MISSING_PACKAGES+=("$pkg")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Всі критичні пакети встановлено"
else
    echo -e "${RED}❌ FAIL${NC} - Відсутні пакети: ${MISSING_PACKAGES[*]}"
    echo "   Запустіть: source web/venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Test 5: PyTorch MPS support
echo -e "${YELLOW}[TEST 5]${NC} Перевірка PyTorch MPS (Metal)..."
if python -c "import torch; print(torch.backends.mps.is_available())" 2>/dev/null | grep -q "True"; then
    echo -e "${GREEN}✅ PASS${NC} - PyTorch MPS підтримка активна (GPU acceleration)"
else
    echo -e "${YELLOW}⚠️ WARN${NC} - PyTorch MPS недоступний (використовується CPU)"
    echo "   Це нормально для Intel Mac або старіших версій macOS"
fi

deactivate 2>/dev/null

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 ATLAS Python 3.11 Setup - ВСІ ТЕСТИ ПРОЙШЛИ!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Система готова до запуску. Наступні кроки:"
echo "  1. ./restart_system.sh start  # Запустити всі сервіси"
echo "  2. open http://localhost:5001  # Відкрити веб-інтерфейс"
echo ""
