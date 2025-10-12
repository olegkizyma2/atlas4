#!/bin/bash

# =============================================================================
# ATLAS v4.0 - Автоматичне розгортання на macOS
# =============================================================================
# Цей скрипт автоматично встановлює та налаштовує ATLAS систему на macOS
# після клонування з GitHub
#
# Використання:
#   git clone https://github.com/olegkizyma2/atlas4.git
#   cd atlas4
#   chmod +x setup-macos.sh
#   ./setup-macos.sh
#
# Вимоги: macOS 11.0+ (Big Sur або новіше)
# =============================================================================

set -e

# ANSI кольори для виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Конфігурація
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS_DIR="$REPO_ROOT/logs"
MODELS_DIR="$REPO_ROOT/models"

# =============================================================================
# Utility Functions
# =============================================================================

print_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}          ATLAS v4.0 - macOS Deployment Setup                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE}       Adaptive Task and Learning Assistant System              ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🔧 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_macos_version() {
    local min_version="11.0"
    local current_version=$(sw_vers -productVersion)
    
    log_info "macOS version: $current_version"
    
    if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
        log_success "macOS version is compatible"
        return 0
    else
        log_error "Потрібна macOS 11.0 (Big Sur) або новіша. Поточна версія: $current_version"
        return 1
    fi
}

check_architecture() {
    local arch=$(uname -m)
    log_info "Архітектура процесора: $arch"
    
    if [ "$arch" = "arm64" ]; then
        log_success "Виявлено Apple Silicon (M1/M2/M3) - буде використано Metal GPU acceleration"
        export USE_METAL_GPU=true
        export TTS_DEVICE="mps"
        export WHISPER_DEVICE="metal"
    elif [ "$arch" = "x86_64" ]; then
        log_warn "Виявлено Intel процесор - Metal GPU acceleration недоступний"
        export USE_METAL_GPU=false
        export TTS_DEVICE="cpu"
        export WHISPER_DEVICE="cpu"
    else
        log_error "Непідтримувана архітектура: $arch"
        return 1
    fi
}

# =============================================================================
# Перевірка системних вимог
# =============================================================================

check_system_requirements() {
    log_step "КРОК 1: Перевірка системних вимог"
    
    # Перевірка macOS версії
    if ! check_macos_version; then
        exit 1
    fi
    
    # Перевірка архітектури
    if ! check_architecture; then
        exit 1
    fi
    
    # Перевірка доступної пам'яті
    local total_mem=$(sysctl hw.memsize | awk '{print $2/1024/1024/1024}')
    log_info "Доступна пам'ять: ${total_mem} GB"
    
    if (( $(echo "$total_mem < 8" | bc -l) )); then
        log_warn "Рекомендується мінімум 8GB RAM. Система може працювати повільно."
    else
        log_success "Достатньо пам'яті для роботи системи"
    fi
    
    # Перевірка вільного місця на диску
    local free_space=$(df -h "$REPO_ROOT" | tail -1 | awk '{print $4}' | sed 's/Gi//;s/G//')
    log_info "Вільне місце на диску: ${free_space} GB"
    
    if (( $(echo "$free_space < 10" | bc -l) )); then
        log_error "Потрібно мінімум 10GB вільного місця (для моделей та даних)"
        exit 1
    else
        log_success "Достатньо місця на диску"
    fi
}

# =============================================================================
# Встановлення Homebrew
# =============================================================================

install_homebrew() {
    log_step "КРОК 2: Встановлення Homebrew"
    
    if check_command brew; then
        log_success "Homebrew вже встановлено"
        log_info "Версія: $(brew --version | head -1)"
    else
        log_info "Встановлення Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Додати Homebrew до PATH
        if [ "$(uname -m)" = "arm64" ]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        else
            echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/usr/local/bin/brew shellenv)"
        fi
        
        log_success "Homebrew встановлено"
    fi
    
    # Оновити Homebrew
    log_info "Оновлення Homebrew..."
    brew update || log_warn "Не вдалося оновити Homebrew (можливо немає інтернету)"
}

# =============================================================================
# Встановлення Python
# =============================================================================

install_python() {
    log_step "КРОК 3: Встановлення Python 3.9+"
    
    if check_command python3; then
        local python_version=$(python3 --version | awk '{print $2}')
        log_info "Виявлено Python: $python_version"
        
        # Перевірка мінімальної версії 3.9
        local min_version="3.9"
        if [ "$(printf '%s\n' "$min_version" "$python_version" | sort -V | head -n1)" = "$min_version" ]; then
            log_success "Python версія підходить"
            return 0
        fi
    fi
    
    log_info "Встановлення Python 3.11 через Homebrew..."
    brew install python@3.11
    
    # Додати до PATH
    echo 'export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"' >> ~/.zprofile
    export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
    
    log_success "Python встановлено: $(python3 --version)"
}

# =============================================================================
# Встановлення Node.js
# =============================================================================

install_nodejs() {
    log_step "КРОК 4: Встановлення Node.js 18+"
    
    if check_command node; then
        local node_version=$(node --version | sed 's/v//')
        log_info "Виявлено Node.js: $node_version"
        
        # Перевірка мінімальної версії 16
        local min_version="16.0.0"
        if [ "$(printf '%s\n' "$min_version" "$node_version" | sort -V | head -n1)" = "$min_version" ]; then
            log_success "Node.js версія підходить"
            return 0
        fi
    fi
    
    log_info "Встановлення Node.js 20 через Homebrew..."
    brew install node@20
    
    # Додати до PATH
    echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zprofile
    export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    
    log_success "Node.js встановлено: $(node --version)"
    log_info "npm версія: $(npm --version)"
}

# =============================================================================
# Встановлення Git (якщо не встановлено)
# =============================================================================

install_git() {
    log_step "КРОК 5: Перевірка Git"
    
    if check_command git; then
        log_success "Git вже встановлено: $(git --version)"
    else
        log_info "Встановлення Git..."
        brew install git
        log_success "Git встановлено"
    fi
}

# =============================================================================
# Встановлення додаткових залежностей
# =============================================================================

install_dependencies() {
    log_step "КРОК 6: Встановлення додаткових залежностей"
    
    log_info "Встановлення системних утиліт..."
    brew install wget curl jq portaudio ffmpeg cmake
    
    # Для Mac M1/M2/M3 - встановити Metal tools
    if [ "$USE_METAL_GPU" = "true" ]; then
        log_info "Встановлення Metal SDK компонентів..."
        xcode-select --install 2>/dev/null || log_info "Xcode Command Line Tools вже встановлено"
    fi
    
    log_success "Системні залежності встановлено"
}

# =============================================================================
# Встановлення Goose Desktop
# =============================================================================

install_goose() {
    log_step "КРОК 7: Встановлення Goose AI"
    
    # Спочатку перевірити Desktop версію
    if [ -x "/Applications/Goose.app/Contents/MacOS/goose" ]; then
        log_success "Goose Desktop вже встановлено"
        export GOOSE_BIN="/Applications/Goose.app/Contents/MacOS/goose"
        return 0
    fi
    
    # Якщо Desktop немає, встановити CLI
    if check_command goose; then
        log_success "Goose CLI вже встановлено"
        export GOOSE_BIN="goose"
        return 0
    fi
    
    log_info "Встановлення Goose CLI..."
    brew tap block/goose
    brew install goose
    
    log_success "Goose встановлено"
    export GOOSE_BIN="goose"
    
    log_warn ""
    log_warn "ВАЖЛИВО: Для кращої продуктивності рекомендується Goose Desktop:"
    log_warn "Завантажте з: https://github.com/block/goose/releases"
    log_warn ""
}

# =============================================================================
# Створення Python віртуального середовища
# =============================================================================

setup_python_venv() {
    log_step "КРОК 8: Налаштування Python віртуального середовища"
    
    cd "$REPO_ROOT"
    
    # Створити venv якщо не існує
    if [ ! -d "web/venv" ]; then
        log_info "Створення віртуального середовища..."
        python3 -m venv web/venv
        log_success "Віртуальне середовище створено"
    else
        log_info "Віртуальне середовище вже існує"
    fi
    
    # Активувати та встановити залежності
    log_info "Встановлення Python залежностей..."
    source web/venv/bin/activate
    
    pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    
    # Перевірка TTS підтримки
    log_info "Перевірка підтримки PyTorch MPS (Metal Performance Shaders)..."
    if python3 -c "import torch; print(torch.backends.mps.is_available())" 2>/dev/null | grep -q "True"; then
        log_success "PyTorch MPS підтримка доступна - буде використано GPU acceleration"
        export TTS_DEVICE="mps"
    else
        log_warn "PyTorch MPS недоступний - буде використано CPU для TTS"
        export TTS_DEVICE="cpu"
    fi
    
    deactivate
    log_success "Python залежності встановлено"
}

# =============================================================================
# Встановлення Node.js залежностей
# =============================================================================

setup_nodejs_packages() {
    log_step "КРОК 9: Встановлення Node.js залежностей"
    
    cd "$REPO_ROOT"
    
    log_info "Встановлення npm пакетів..."
    npm install --silent
    
    # Встановити пакети в config/
    if [ -f "config/package.json" ]; then
        log_info "Встановлення config залежностей..."
        cd config
        npm install --silent
        cd "$REPO_ROOT"
    fi
    
    log_success "Node.js залежності встановлено"
}

# =============================================================================
# Компіляція Whisper.cpp з Metal підтримкою
# =============================================================================

build_whisper_cpp() {
    log_step "КРОК 10: Компіляція Whisper.cpp (з Metal GPU)"
    
    local whisper_dir="$REPO_ROOT/third_party/whisper.cpp.upstream"
    
    if [ ! -d "$whisper_dir" ]; then
        log_info "Клонування Whisper.cpp репозиторію..."
        mkdir -p "$REPO_ROOT/third_party"
        cd "$REPO_ROOT/third_party"
        git clone https://github.com/ggerganov/whisper.cpp.git whisper.cpp.upstream
        cd whisper.cpp.upstream
    else
        log_info "Whisper.cpp вже клоновано, оновлення..."
        cd "$whisper_dir"
        git pull
    fi
    
    # Компіляція з Metal підтримкою для M1/M2/M3
    if [ "$USE_METAL_GPU" = "true" ]; then
        log_info "Компіляція Whisper.cpp з Metal GPU acceleration..."
        mkdir -p build
        cd build
        cmake .. -DWHISPER_METAL=ON -DWHISPER_COREML=ON
        make -j$(sysctl -n hw.ncpu)
        log_success "Whisper.cpp скомпільовано з Metal підтримкою"
    else
        log_info "Компіляція Whisper.cpp (CPU режим)..."
        make clean
        make -j$(sysctl -n hw.ncpu)
        log_success "Whisper.cpp скомпільовано"
    fi
    
    cd "$REPO_ROOT"
}

# =============================================================================
# Завантаження моделей Whisper
# =============================================================================

download_whisper_models() {
    log_step "КРОК 11: Завантаження Whisper моделей"
    
    mkdir -p "$MODELS_DIR/whisper"
    cd "$MODELS_DIR/whisper"
    
    # Завантажити Large-v3 модель для кращої якості української мови
    local model_url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
    local model_file="ggml-large-v3.bin"
    
    if [ -f "$model_file" ]; then
        log_info "Модель $model_file вже завантажена"
    else
        log_info "Завантаження Whisper Large-v3 моделі (~3GB)..."
        log_warn "Це може зайняти кілька хвилин залежно від швидкості інтернету..."
        
        if wget --show-progress -O "$model_file" "$model_url" 2>&1 | grep -o '[0-9]*%' | tail -1; then
            log_success "Модель завантажена"
        else
            log_error "Не вдалося завантажити модель"
            return 1
        fi
    fi
    
    cd "$REPO_ROOT"
}

# =============================================================================
# Створення директорій
# =============================================================================

create_directories() {
    log_step "КРОК 12: Створення необхідних директорій"
    
    mkdir -p "$LOGS_DIR"
    mkdir -p "$LOGS_DIR/archive"
    mkdir -p "$MODELS_DIR/whisper"
    mkdir -p "$MODELS_DIR/tts"
    mkdir -p "$HOME/.local/share/goose/sessions"
    mkdir -p "$HOME/.config/goose"
    mkdir -p data
    
    log_success "Директорії створено"
}

# =============================================================================
# Налаштування конфігурації
# =============================================================================

configure_system() {
    log_step "КРОК 13: Налаштування системної конфігурації"
    
    # Створити .env файл якщо не існує
    if [ ! -f "$REPO_ROOT/.env" ]; then
        log_info "Створення .env файлу..."
        cat > "$REPO_ROOT/.env" << EOF
# ATLAS System Configuration
# Generated: $(date)

# System
NODE_ENV=production
FORCE_FREE_PORTS=true

# Goose Configuration
GOOSE_BIN=${GOOSE_BIN}
GOOSE_SERVER_PORT=3000
GOOSE_DISABLE_KEYRING=1

# TTS Configuration
REAL_TTS_MODE=true
TTS_DEVICE=${TTS_DEVICE}
TTS_PORT=3001

# Whisper Configuration
WHISPER_BACKEND=cpp
WHISPER_DEVICE=${WHISPER_DEVICE}
WHISPER_PORT=3002
WHISPER_CPP_MODEL=$MODELS_DIR/whisper/ggml-large-v3.bin
WHISPER_CPP_NGL=20
WHISPER_CPP_THREADS=6

# Ports
FRONTEND_PORT=5001
ORCHESTRATOR_PORT=5101

# Features
USE_METAL_GPU=${USE_METAL_GPU}
EOF
        log_success ".env файл створено"
    else
        log_info ".env файл вже існує (пропускаємо)"
    fi
    
    # Перевірка налаштування Goose
    log_info "Перевірка конфігурації Goose..."
    if [ ! -f "$HOME/.config/goose/config.yaml" ]; then
        log_warn "Goose ще не налаштовано"
        log_warn "Потрібно буде налаштувати після установки"
    else
        log_success "Goose вже налаштовано"
    fi
}

# =============================================================================
# Налаштування Goose
# =============================================================================

configure_goose() {
    log_step "КРОК 14: Налаштування Goose AI"
    
    if [ ! -f "$HOME/.config/goose/config.yaml" ]; then
        log_warn ""
        log_warn "═══════════════════════════════════════════════════════════════"
        log_warn "  Goose потребує налаштування для роботи з GitHub Copilot"
        log_warn "═══════════════════════════════════════════════════════════════"
        log_warn ""
        log_info "Запускаємо інтерактивне налаштування..."
        log_info "Будь ласка, дотримуйтесь інструкцій на екрані"
        log_info ""
        
        sleep 2
        
        if [ -n "$GOOSE_BIN" ]; then
            $GOOSE_BIN configure || log_warn "Налаштування пропущено або не завершено"
        else
            log_error "Goose binary не знайдено"
            return 1
        fi
    else
        log_success "Goose вже налаштовано"
    fi
}

# =============================================================================
# Тестування установки
# =============================================================================

test_installation() {
    log_step "КРОК 15: Тестування установки"
    
    local all_ok=true
    
    # Python
    if check_command python3; then
        log_success "Python: $(python3 --version)"
    else
        log_error "Python не встановлено"
        all_ok=false
    fi
    
    # Node.js
    if check_command node; then
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js не встановлено"
        all_ok=false
    fi
    
    # Goose
    if [ -n "$GOOSE_BIN" ] && [ -x "$GOOSE_BIN" ]; then
        log_success "Goose: доступний"
    else
        log_error "Goose не встановлено"
        all_ok=false
    fi
    
    # Whisper binary
    local whisper_bin="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli"
    if [ -x "$whisper_bin" ]; then
        log_success "Whisper.cpp: скомпільовано"
    else
        log_warn "Whisper.cpp binary не знайдено (використовуватиметься fallback)"
    fi
    
    # Whisper model
    if [ -f "$MODELS_DIR/whisper/ggml-large-v3.bin" ]; then
        log_success "Whisper Large-v3 модель: завантажена"
    else
        log_error "Whisper модель не завантажена"
        all_ok=false
    fi
    
    # Metal GPU
    if [ "$USE_METAL_GPU" = "true" ]; then
        log_success "Metal GPU: доступний (Apple Silicon)"
    else
        log_info "Metal GPU: недоступний (Intel процесор)"
    fi
    
    # PyTorch MPS
    if python3 -c "import torch; assert torch.backends.mps.is_available()" 2>/dev/null; then
        log_success "PyTorch MPS: доступний"
    else
        log_warn "PyTorch MPS: недоступний (буде використано CPU)"
    fi
    
    echo ""
    if [ "$all_ok" = "true" ]; then
        log_success "Всі основні компоненти встановлено успішно!"
        return 0
    else
        log_error "Деякі компоненти не встановлено коректно"
        return 1
    fi
}

# =============================================================================
# Фінальні інструкції
# =============================================================================

print_final_instructions() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${WHITE}                 УСТАНОВКА ЗАВЕРШЕНА УСПІШНО!                  ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📋 Наступні кроки:${NC}"
    echo ""
    echo -e "${YELLOW}1.${NC} Запустити систему:"
    echo -e "   ${WHITE}./restart_system.sh start${NC}"
    echo ""
    echo -e "${YELLOW}2.${NC} Або використати Make команди:"
    echo -e "   ${WHITE}make start${NC}"
    echo ""
    echo -e "${YELLOW}3.${NC} Перевірити статус системи:"
    echo -e "   ${WHITE}./restart_system.sh status${NC}"
    echo ""
    echo -e "${YELLOW}4.${NC} Переглядати логи:"
    echo -e "   ${WHITE}./restart_system.sh logs${NC}"
    echo ""
    echo -e "${CYAN}🌐 Доступ до системи:${NC}"
    echo ""
    echo -e "   ${WHITE}• Веб-інтерфейс:${NC}     http://localhost:5001"
    echo -e "   ${WHITE}• Orchestrator API:${NC}  http://localhost:5101"
    echo -e "   ${WHITE}• Goose Server:${NC}      http://localhost:3000"
    echo -e "   ${WHITE}• TTS Service:${NC}       http://localhost:3001"
    echo -e "   ${WHITE}• Whisper Service:${NC}   http://localhost:3002"
    echo ""
    echo -e "${CYAN}📚 Документація:${NC}"
    echo ""
    echo -e "   ${WHITE}• README.md${NC}          - Загальна інформація"
    echo -e "   ${WHITE}• docs/ATLAS_SYSTEM_ARCHITECTURE.md${NC} - Архітектура"
    echo -e "   ${WHITE}• .github/copilot-instructions.md${NC}  - Розробка"
    echo ""
    echo -e "${CYAN}💡 Корисні команди:${NC}"
    echo ""
    echo -e "   ${WHITE}make help${NC}            - Показати всі Make команди"
    echo -e "   ${WHITE}./restart_system.sh help${NC} - Показати опції управління"
    echo ""
    
    if [ ! -f "$HOME/.config/goose/config.yaml" ]; then
        echo -e "${YELLOW}⚠️  ВАЖЛИВО:${NC}"
        echo ""
        echo -e "   Goose потребує налаштування перед першим запуском:"
        echo -e "   ${WHITE}${GOOSE_BIN} configure${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}✨ Система готова до роботи!${NC}"
    echo ""
}

# =============================================================================
# Головна функція
# =============================================================================

main() {
    print_banner
    
    log_info "Розпочато установку ATLAS v4.0 на macOS"
    log_info "Робоча директорія: $REPO_ROOT"
    echo ""
    
    # Виконати кроки установки
    check_system_requirements
    install_homebrew
    install_python
    install_nodejs
    install_git
    install_dependencies
    install_goose
    setup_python_venv
    setup_nodejs_packages
    build_whisper_cpp
    download_whisper_models
    create_directories
    configure_system
    configure_goose
    test_installation
    
    # Фінальні інструкції
    print_final_instructions
    
    log_info "Установка завершена за $(date)"
}

# =============================================================================
# Запуск скрипта
# =============================================================================

# Перевірка що скрипт запущено на macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_error "Цей скрипт призначено тільки для macOS"
    exit 1
fi

# Запустити установку
main "$@"
