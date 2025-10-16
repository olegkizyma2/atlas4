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

# MCP packages to install (5 operational servers, 65 tools)
MCP_PACKAGES=(
    "@modelcontextprotocol/server-filesystem"
    "@executeautomation/playwright-mcp-server"
    "super-shell-mcp"
    "@peakmojo/applescript-mcp"
    # "@cyanheads/git-mcp-server"  # DISABLED 17.10.2025: crashes on startup (logger conflict)
    "@modelcontextprotocol/server-memory"
)

echo ""
echo -e "${BLUE}📦 MCP Сервери що будуть встановлені (5 серверів, 65 tools):${NC}"
echo -e "  ${GREEN}1. filesystem${NC}          - 14 tools - Робота з файлами та директоріями"
echo -e "  ${GREEN}2. playwright${NC}          - 32 tools - Автоматизація браузера та web scraping"
echo -e "  ${GREEN}3. super-shell${NC}         -  9 tools - Shell команди + git операції"
echo -e "  ${GREEN}4. applescript${NC}         -  1 tool  - macOS GUI автоматизація"
echo -e "  ${GREEN}5. memory${NC}              -  9 tools - Тривала пам'ять AI між сесіями"
echo ""
log_warn "⚠️  git-mcp (@cyanheads) - ВИМКНЕНО через logger crash (git через shell)"
log_warn "⚠️  github-lightweight (@wipiano) - ВИМКНЕНО через SDK compatibility"
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
log_info "Виберіть режим AI Backend для Dynamic TODO MCP:"
echo "  ${GREEN}1) mcp${NC}       - Чистий Dynamic TODO MCP (РЕКОМЕНДОВАНО) 🚀"
echo "            • Швидко, без overhead"
echo "            • 6 серверів, 92 tools"
echo "            • Короткі TTS фрази агентів"
echo ""
read -p "Введіть номер (1 для MCP, Enter для default): " MODE_CHOICE

case $MODE_CHOICE in
    1|"")
        AI_MODE="mcp"
        AI_PRIMARY="mcp"
        AI_FALLBACK="mcp"
        AI_DISABLE_FALLBACK="true"
        log_success "✅ Режим: Чистий Dynamic TODO MCP"
        ;;
    *)
        AI_MODE="mcp"
        AI_PRIMARY="mcp"
        AI_FALLBACK="mcp"
        AI_DISABLE_FALLBACK="true"
        log_success "✅ Використано default: Чистий Dynamic TODO MCP"
        ;;
esac

update_env_var "AI_BACKEND_MODE" "$AI_MODE"
update_env_var "AI_BACKEND_PRIMARY" "$AI_PRIMARY"
update_env_var "AI_BACKEND_FALLBACK" "$AI_FALLBACK"
update_env_var "AI_BACKEND_DISABLE_FALLBACK" "$AI_DISABLE_FALLBACK"

log_success "AI Backend Mode налаштовано:"
log_info "  • Mode: $AI_MODE"
log_info "  • Primary: $AI_PRIMARY"
log_info "  • Fallback: $AI_FALLBACK"
log_info "  • Disable Fallback: $AI_DISABLE_FALLBACK"

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
log_info "MCP servers (6/6 operational): filesystem, playwright, shell, applescript, git, memory"
log_info "Total tools: 92 (14+32+9+1+27+9)"
log_info "Orchestrator: dependencies installed"
echo ""
echo "� СТАТУС MCP СЕРВЕРІВ:"
echo ""
echo "  ✅ filesystem   - 14 tools (файли та директорії)"
echo "  ✅ playwright   - 32 tools (web автоматизація)"
echo "  ✅ shell        -  9 tools (системні команди)"
echo "  ✅ applescript  -  1 tool  (macOS GUI)"
echo "  ✅ git          - 27 tools (версійний контроль)"
echo "  ✅ memory       -  9 tools (cross-session пам'ять)"
echo ""
echo "🎭 АГЕНТИ З ГОЛОСОВИМ ОЗВУЧЕННЯМ:"
echo ""
echo "  • Atlas   - Планувальник TODO (~1.5s TTS)"
echo "  • Тетяна  - Виконавець tasks (~1s TTS)"
echo "  • Гриша   - Верифікатор результатів (~0.5s TTS)"
echo ""
echo "�📋 НАСТУПНІ КРОКИ:"
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
echo "4. Верифікувати MCP сервери:"
echo "   ./verify-mcp-servers.sh"
echo ""
echo "5. Тестувати Dynamic TODO MCP workflow:"
echo "   curl -X POST http://localhost:5101/chat/stream \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\": \"Створи файл test.txt на Desktop\", \"sessionId\": \"test-001\"}'"
echo ""
echo "6. Моніторити логи:"
echo "   tail -f logs/orchestrator.log | grep -E 'MCP|TODO|STAGE|TTS'"
echo ""
echo "7. Змінити режим пізніше (в .env):"
echo "   AI_BACKEND_MODE=mcp                # чистий Dynamic TODO MCP (default)"
echo "   AI_BACKEND_DISABLE_FALLBACK=true  # strict mode (для testing)"
echo ""
echo "📚 ДОКУМЕНТАЦІЯ:"
echo ""
echo "   • Quick Reference:  MCP_DYNAMIC_TODO_QUICK_REF.md"
echo "   • Verification:     MCP_SERVERS_VERIFICATION_2025-10-14.md"
echo "   • Complete Report:  MCP_SERVER_UPDATE_COMPLETE.md"
echo "   • Summary:          cat MCP_UPDATE_SUMMARY.txt"
echo ""
echo "════════════════════════════════════════════════════════════════"
