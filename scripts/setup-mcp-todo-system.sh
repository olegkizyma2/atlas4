#!/bin/bash

################################################################################
# ATLAS MCP TODO WORKFLOW SYSTEM - INSTALLATION SCRIPT
# 
# Встановлює та налаштовує MCP Dynamic TODO Workflow систему з усіма залежностями
# 
# Версія: 1.0.0
# Дата: 2025-10-13
# Автор: ATLAS System
################################################################################

set -e  # Exit on error

# Кольорові виводи
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функції логування
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Перевірка, чи запущено на macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_error "Цей скрипт призначений для macOS. Поточна ОС: $OSTYPE"
    exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo "🚀 ATLAS MCP TODO WORKFLOW SYSTEM - INSTALLATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

# КРОК 1: Перевірка Node.js
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 1: Перевірка Node.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v node &> /dev/null; then
    log_error "Node.js не встановлено!"
    log_info "Встановіть Node.js: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v)
log_success "Node.js встановлено: $NODE_VERSION"

# КРОК 2: Встановлення MCP npm packages
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 2: Встановлення MCP npm packages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "Встановлення глобальних MCP серверів..."

# MCP packages to install
MCP_PACKAGES=(
    "@modelcontextprotocol/server-filesystem"
    "@executeautomation/playwright-mcp-server"
    "super-shell-mcp"
    "@mseep/applescript-mcp"
    "@wipiano/github-mcp-lightweight"
    "@cyanheads/git-mcp-server"
    "@modelcontextprotocol/server-memory"
)

echo ""
echo -e "${BLUE}📦 MCP Сервери що будуть встановлені:${NC}"
echo -e "  ${GREEN}1. filesystem${NC}          - Робота з файлами та директоріями"
echo -e "  ${GREEN}2. playwright${NC}          - Автоматизація браузера та web scraping"
echo -e "  ${GREEN}3. super-shell${NC}         - Виконання Terminal команд (npm, brew, git CLI)"
echo -e "  ${GREEN}4. applescript${NC}         - macOS автоматизація (запуск програм, UI control)"
echo -e "  ${GREEN}5. github-lightweight${NC}  - GitHub API (issues, pull requests, repos)"
echo -e "  ${GREEN}6. git-mcp${NC}             - Git операції (commit, push, pull, merge, branch)"
echo -e "  ${GREEN}7. memory${NC}              - Тривала пам'ять AI між сесіями"
echo ""

for package in "${MCP_PACKAGES[@]}"; do
    log_info "Встановлення $package..."
    if npm list -g "$package" >/dev/null 2>&1; then
        log_success "$package вже встановлено"
    else
        npm install -g "$package"
        log_success "$package встановлено"
    fi
done

# КРОК 3: Перевірка установки
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 3: Перевірка установки"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ALL_INSTALLED=true

for package in "${MCP_PACKAGES[@]}"; do
    if npm list -g "$package" >/dev/null 2>&1; then
        log_success "✓ $package"
    else
        log_error "✗ $package НЕ встановлено"
        ALL_INSTALLED=false
    fi
done

if [ "$ALL_INSTALLED" = false ]; then
    log_error "Деякі пакети не встановлено. Перевірте помилки вище."
    exit 1
fi

# КРОК 4: Налаштування AI Backend Mode
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 4: Налаштування AI Backend Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Перевірка .env файлу
if [ ! -f .env ]; then
    log_warn ".env файл не знайдено, створюємо..."
    touch .env
fi

# Функція для оновлення або додавання змінної в .env
update_env_var() {
    local key=$1
    local value=$2
    local file=".env"
    
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Змінна існує - оновлюємо
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
        rm -f "${file}.bak"
        log_info "Оновлено: ${key}=${value}"
    else
        # Змінна не існує - додаємо
        echo "${key}=${value}" >> "$file"
        log_info "Додано: ${key}=${value}"
    fi
}

# Вибір режиму користувачем
echo ""
log_info "Виберіть режим AI Backend:"
echo "  1) mcp       - Тільки MCP (швидко, без Goose)"
echo "  2) goose     - Тільки Goose Desktop"
echo "  3) hybrid    - Автоматичний вибір (рекомендовано)"
echo ""
read -p "Введіть номер (1-3, default: 1): " MODE_CHOICE

case $MODE_CHOICE in
    1)
        AI_MODE="mcp"
        ;;
    2)
        AI_MODE="goose"
        ;;
    3)
        AI_MODE="hybrid"
        ;;
    *)
        AI_MODE="mcp"
        log_info "Використано default: mcp"
        ;;
esac

update_env_var "AI_BACKEND_MODE" "$AI_MODE"
update_env_var "AI_BACKEND_PRIMARY" "$AI_MODE"

if [ "$AI_MODE" = "hybrid" ]; then
    update_env_var "AI_BACKEND_FALLBACK" "mcp"
fi

log_success "AI Backend Mode налаштовано: $AI_MODE"

# КРОК 5: Встановлення orchestrator залежностей
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 5: Встановлення orchestrator залежностей"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd orchestrator
log_info "npm install в orchestrator/..."
npm install
log_success "Orchestrator залежності встановлено"
cd ..

# КРОК 6: Перевірка конфігурації
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 6: Перевірка конфігурації"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "Поточна конфігурація AI Backend:"
echo ""
grep "AI_BACKEND" .env || log_warn "AI_BACKEND змінні не знайдено в .env"
echo ""

# КРОК 7: Створення директорій для логів
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "КРОК 7: Створення директорій"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p logs/metrics
log_success "Директорії створено: logs/metrics/"

# ЗАВЕРШЕННЯ
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ MCP TODO WORKFLOW SYSTEM - ВСТАНОВЛЕНО УСПІШНО!"
echo "════════════════════════════════════════════════════════════════"
echo ""
log_success "Режим: $AI_MODE"
log_info "MCP servers (7): filesystem, playwright, super-shell, applescript, github-lightweight, git-mcp, memory"
log_info "Orchestrator: dependencies installed"
echo ""
echo "📋 НАСТУПНІ КРОКИ:"
echo ""
echo "1. Запустити систему:"
echo "   ./restart_system.sh start"
echo ""
echo "2. Перевірити статус:"
echo "   ./restart_system.sh status"
echo ""
echo "3. ⚠️  КРИТИЧНО - Перевірити LLM API (port 4000):"
echo "   lsof -i :4000"
echo "   # Має показати процес на порту 4000"
echo ""
echo "4. Тестувати MCP workflow:"
echo "   ./tests/quick-start-testing.sh"
echo ""
echo "5. Змінити режим пізніше:"
echo "   export AI_BACKEND_MODE=mcp     # тільки MCP"
echo "   export AI_BACKEND_MODE=goose   # тільки Goose"
echo "   export AI_BACKEND_MODE=hybrid  # автовибір"
echo ""
echo "════════════════════════════════════════════════════════════════"
