#!/bin/bash

# =============================================================================
# ATLAS v5.0 - Автоматичне розгортання на macOS
# =============================================================================
# Цей скрипт автоматично встановлює та налаштовує ATLAS систему на macOS
# після клонування з GitHub
#
# v5.0 CHANGES:
# - Pure MCP mode with 6 operational servers
# - Mac Studio M1 MAX optimizations
# - Centralized configuration through .env
#
# Використання:
#   git clone https://github.com/olegkizyma2/atlas4.git
#   cd atlas4
#   chmod +x setup-macos.sh
#   ./setup-macos.sh
#
# Вимоги: 
# - macOS 11.0+ (Big Sur або новіше)
# - Mac Studio M1 MAX recommended (optimized for Apple Silicon)
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
set -o pipefail
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}          ATLAS v5.0 - macOS Deployment Setup                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE}       Pure MCP Edition - Mac Studio M1 MAX Optimized          ${CYAN}║${NC}"
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
    echo -e "${BLUE}[STEP]${NC} ${WHITE}$1${NC}"
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
    local chip_name=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
    
    log_info "Архітектура процесора: $arch"
    log_info "Процесор: $chip_name"
    
    if [ "$arch" = "arm64" ]; then
        log_success "Виявлено Apple Silicon - буде використано Metal GPU acceleration"
        export USE_METAL_GPU=true
        export TTS_DEVICE="mps"
        export WHISPER_DEVICE="metal"
        export OPTIMIZE_FOR_M1_MAX=true
        
        # Detect specific chip for optimizations
        if echo "$chip_name" | grep -iq "M1 Max"; then
            log_success "✨ Mac Studio M1 MAX виявлено - застосування оптимізацій"
            export WHISPER_CPP_THREADS=10  # M1 Max має 10 performance cores
            export WHISPER_SAMPLE_RATE=48000
        elif echo "$chip_name" | grep -iq "M2 Max\|M3 Max"; then
            log_success "✨ Apple Max chip виявлено - застосування оптимізацій"
            export WHISPER_CPP_THREADS=12  # M2/M3 Max мають більше cores
            export WHISPER_SAMPLE_RATE=48000
        else
            log_info "Apple Silicon базова конфігурація"
            export WHISPER_CPP_THREADS=8
            export WHISPER_SAMPLE_RATE=48000
        fi
    elif [ "$arch" = "x86_64" ]; then
        log_warn "Виявлено Intel процесор - Metal GPU acceleration недоступний"
        export USE_METAL_GPU=false
        export TTS_DEVICE="cpu"
        export WHISPER_DEVICE="cpu"
        export OPTIMIZE_FOR_M1_MAX=false
        export WHISPER_CPP_THREADS=4
        export WHISPER_SAMPLE_RATE=16000
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
    log_step "КРОК 3: Встановлення Python 3.11"
    
    local required_version="3.11"
    local has_python311=false
    
    # Перевірка наявності python3.11
    if check_command python3.11; then
        local python_version=$(python3.11 --version | awk '{print $2}')
        log_info "Виявлено Python 3.11: $python_version"
        has_python311=true
    elif check_command python3; then
        local python_version=$(python3 --version | awk '{print $2}')
        log_info "Виявлено Python: $python_version"
        
        # Перевірка чи це 3.11.x
        if [[ "$python_version" == 3.11.* ]]; then
            log_success "Python 3.11 вже встановлено як python3"
            has_python311=true
        else
            log_warn "Поточна версія Python ($python_version) не є 3.11.x"
        fi
    fi
    
    if [ "$has_python311" = false ]; then
        log_info "Встановлення Python 3.11 через Homebrew..."
        brew install python@3.11
        
        # Додати до PATH
        echo 'export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"' >> ~/.zprofile
        export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
        
        # Створити symlink python3 → python3.11
        if [ ! -L "/opt/homebrew/bin/python3" ]; then
            ln -sf /opt/homebrew/opt/python@3.11/bin/python3.11 /opt/homebrew/bin/python3
        fi
        
        log_success "Python 3.11 встановлено: $(python3.11 --version)"
    else
        log_success "Python 3.11 готовий до використання"
    fi
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
# Встановлення MCP Серверів (v5.0 Pure MCP)
# =============================================================================

install_mcp_servers() {
    log_step "КРОК 7: Встановлення MCP серверів (6 серверів, 92 tools)"
    
    log_info "ATLAS v5.0 використовує Pure MCP mode - встановлення глобальних серверів..."
    
    # MCP packages (6 operational servers з setup-mcp-todo-system.sh)
    local MCP_PACKAGES=(
        "@modelcontextprotocol/server-filesystem"
        "@executeautomation/playwright-mcp-server"
        "super-shell-mcp"
        "@peakmojo/applescript-mcp"
        "@cyanheads/git-mcp-server"
        "@modelcontextprotocol/server-memory"
    )
    
    echo ""
    log_info "📦 MCP Сервери (6 серверів, 92 tools):"
    echo -e "  ${GREEN}1. filesystem${NC}   - 14 tools - Файли та директорії"
    echo -e "  ${GREEN}2. playwright${NC}   - 32 tools - Браузер automation"
    echo -e "  ${GREEN}3. shell${NC}        -  9 tools - Shell команди"
    echo -e "  ${GREEN}4. applescript${NC}  -  1 tool  - macOS GUI automation"
    echo -e "  ${GREEN}5. git${NC}          - 27 tools - Git операції"
    echo -e "  ${GREEN}6. memory${NC}       -  9 tools - Cross-session пам'ять"
    echo ""
    
    local all_installed=true
    
    for package in "${MCP_PACKAGES[@]}"; do
        log_info "Встановлення $package..."
        if npm list -g "$package" >/dev/null 2>&1; then
            log_success "$package вже встановлено"
        else
            if npm install -g "$package" 2>/dev/null; then
                log_success "$package встановлено"
            else
                log_error "Не вдалося встановити $package"
                all_installed=false
            fi
        fi
    done
    
    echo ""
    if [ "$all_installed" = true ]; then
        log_success "Всі MCP сервери встановлено (6/6)"
        log_info "Total tools: 92 (14+32+9+1+27+9)"
    else
        log_warn "Деякі MCP сервери не встановились - перевірте помилки вище"
        log_warn "Система працюватиме з доступними серверами"
    fi
}

# =============================================================================
# Створення Python віртуального середовища
# =============================================================================

setup_python_venv() {
    log_step "КРОК 8: Налаштування Python віртуального середовища"
    
    cd "$REPO_ROOT"
    
    # Визначити який python використовувати
    local python_cmd="python3"
    if check_command python3.11; then
        python_cmd="python3.11"
        log_info "Використовується Python 3.11 для віртуального середовища"
    fi
    
    # Видалити старе venv якщо воно створене неправильною версією Python
    if [ -d "web/venv" ]; then
        local venv_python_version=$(web/venv/bin/python --version 2>&1 | awk '{print $2}')
        if [[ ! "$venv_python_version" == 3.11.* ]]; then
            log_warn "Видалення старого venv (версія $venv_python_version)"
            rm -rf web/venv
        fi
    fi
    
    # Створити venv якщо не існує
    if [ ! -d "web/venv" ]; then
        log_info "Створення віртуального середовища з Python 3.11..."
        $python_cmd -m venv web/venv
        log_success "Віртуальне середовище створено"
    else
        log_info "Віртуальне середовище вже існує"
    fi
    
    # Активувати та встановити залежності
    log_info "Встановлення Python залежностей..."
    source web/venv/bin/activate
    
    # Оновити pip, setuptools, wheel
    log_info "Оновлення pip, setuptools, wheel..."
    pip install --upgrade pip setuptools wheel
    
    # Встановити залежності поетапно для уникнення конфліктів
    log_info "Встановлення core залежностей..."
    pip install Flask==2.3.3 Flask-CORS==4.0.0 requests==2.31.0 aiohttp==3.8.5
    
    log_info "Встановлення PyTorch та TTS залежностей (це може зайняти час)..."
    # Встановити PyTorch з Metal підтримкою
    pip install torch==2.1.0 torchaudio==2.1.0
    
    log_info "Встановлення Ukrainian TTS (це може зайняти час - завантажується з GitHub)..."
    pip install git+https://github.com/robinhad/ukrainian-tts.git || {
        log_warn "Не вдалося встановити ukrainian-tts з GitHub, спроба пізніше..."
    }
    
    log_info "Встановлення решти залежностей..."
    pip install -r requirements.txt || {
        log_warn "Деякі залежності не встановились, спроба встановити критичні..."
        pip install websockets jsonschema pyyaml colorama soundfile scipy librosa num2words
        pip install openai faster-whisper aiofiles
    }
    
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
    
    # Встановити пакети в orchestrator/
    if [ -f "orchestrator/package.json" ]; then
        log_info "Встановлення orchestrator залежностей..."
        cd orchestrator
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
        # Скинути всі локальні зміни перед pull
        git reset --hard HEAD
        git clean -fd
        git pull --rebase origin master || git pull origin master
    fi
    
    log_info "Підготовка до компіляції Whisper.cpp..."
    # Очистити build директорію для свіжої конфігурації
    rm -rf build
    mkdir -p build
    cd build

    if [ "$USE_METAL_GPU" = "true" ]; then
        log_info "Компіляція Whisper.cpp з Metal GPU acceleration (Core ML вимкнено)..."
        cmake .. -DGGML_METAL=ON -DWHISPER_COREML=OFF
    else
        log_info "Компіляція Whisper.cpp у CPU режимі (без Metal/Core ML)..."
        cmake .. -DGGML_METAL=OFF -DWHISPER_COREML=OFF
    fi

    make -j$(sysctl -n hw.ncpu)

    if [ "$USE_METAL_GPU" = "true" ]; then
        log_success "Whisper.cpp скомпільовано з Metal підтримкою (Core ML вимкнено)"
    else
        log_success "Whisper.cpp скомпільовано у CPU режимі"
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
        # Перевірка чи модель валідна (не пошкоджена)
        local file_size=$(stat -f%z "$model_file" 2>/dev/null || echo "0")
        if [ "$file_size" -gt 100000 ]; then
            log_info "Модель $model_file вже завантажена ($(($file_size / 1024 / 1024)) MB)"
            cd "$REPO_ROOT"
            return 0
        else
            log_warn "Існуюча модель пошкоджена або неповна, перезавантажуємо..."
            rm -f "$model_file"
        fi
    fi
    
    log_info "Завантаження Whisper Large-v3 моделі (~3GB)..."
    log_warn "Це може зайняти кілька хвилин залежно від швидкості інтернету..."
    
    # Спроба завантаження через тимчасовий файл
    local tmp_file="${model_file}.download"
    rm -f "$tmp_file"

    if check_command curl; then
        if curl -L --fail --progress-bar -o "$tmp_file" "$model_url"; then
            mv "$tmp_file" "$model_file"
        else
            log_error "Не вдалося завантажити модель через curl"
            rm -f "$tmp_file"
            cd "$REPO_ROOT"
            return 1
        fi
    elif check_command wget; then
        if wget --show-progress -O "$tmp_file" "$model_url"; then
            mv "$tmp_file" "$model_file"
        else
            log_error "Не вдалося завантажити модель через wget"
            rm -f "$tmp_file"
            cd "$REPO_ROOT"
            return 1
        fi
    else
        log_error "curl або wget не знайдено - неможливо завантажити модель"
        cd "$REPO_ROOT"
        return 1
    fi

    # Перевірка розміру завантаженого файлу
    local file_size=$(stat -f%z "$model_file" 2>/dev/null || echo "0")
    if [ "$file_size" -le 100000 ]; then
        log_error "Завантажена модель занадто мала (можливо, помилка)"
        rm -f "$model_file"
        cd "$REPO_ROOT"
        return 1
    fi

    log_success "Модель завантажена успішно (розмір: $(($file_size / 1024 / 1024)) MB)"
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
    mkdir -p data
    mkdir -p "$REPO_ROOT/web/static/assets"
    
    log_success "Директорії створено"
}

# =============================================================================
# Завантаження 3D моделей
# =============================================================================

download_3d_models() {
    log_step "КРОК 13: Завантаження 3D моделей"
    
    local model_path="$REPO_ROOT/web/static/assets/DamagedHelmet.glb"
    local model_url="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"
    
    if [ -f "$model_path" ]; then
        log_info "3D модель DamagedHelmet.glb вже існує"
        local file_size=$(stat -f%z "$model_path" 2>/dev/null || echo "0")
        if [ "$file_size" -gt 100000 ]; then
            log_success "Модель валідна (розмір: $(($file_size / 1024)) KB)"
            return 0
        else
            log_warn "Модель пошкоджена або неповна, перезавантажуємо..."
            rm -f "$model_path"
        fi
    fi
    
    log_info "Завантаження DamagedHelmet.glb з Khronos glTF Sample Models..."
    
    if check_command curl; then
        if curl -L -f -o "$model_path" "$model_url" 2>/dev/null; then
            local file_size=$(stat -f%z "$model_path" 2>/dev/null || echo "0")
            if [ "$file_size" -gt 100000 ]; then
                log_success "3D модель завантажено успішно ($(($file_size / 1024)) KB)"
                return 0
            else
                log_error "Завантажена модель занадто мала (можливо, помилка)"
                rm -f "$model_path"
                return 1
            fi
        else
            log_error "Не вдалося завантажити модель через curl"
            return 1
        fi
    elif check_command wget; then
        if wget -q -O "$model_path" "$model_url" 2>/dev/null; then
            local file_size=$(stat -f%z "$model_path" 2>/dev/null || echo "0")
            if [ "$file_size" -gt 100000 ]; then
                log_success "3D модель завантажено успішно ($(($file_size / 1024)) KB)"
                return 0
            else
                log_error "Завантажена модель занадто мала (можливо, помилка)"
                rm -f "$model_path"
                return 1
            fi
        else
            log_error "Не вдалося завантажити модель через wget"
            return 1
        fi
    else
        log_error "curl або wget не знайдено - не можу завантажити модель"
        log_warn "Встановіть curl: brew install curl"
        return 1
    fi
}

# =============================================================================
# Налаштування конфігурації
# =============================================================================

# =============================================================================
# Налаштування конфігурації (v5.0)
# =============================================================================

configure_system() {
    log_step "КРОК 14: Налаштування системної конфігурації"
    
    local tts_device_value="${TTS_DEVICE:-mps}"
    local whisper_device_value="${WHISPER_DEVICE:-metal}"
    local use_metal_value="${USE_METAL_GPU:-true}"
    local optimize_m1_value="${OPTIMIZE_FOR_M1_MAX:-true}"
    local whisper_disable_gpu_value="${WHISPER_CPP_DISABLE_GPU:-false}"
    local whisper_bin_default="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli"
    local whisper_bin_value="${WHISPER_CPP_BIN:-$whisper_bin_default}"
    local whisper_threads_value="${WHISPER_CPP_THREADS:-10}"
    local whisper_sample_rate="${WHISPER_SAMPLE_RATE:-48000}"
    
    # Створити .env файл якщо не існує
    if [ ! -f "$REPO_ROOT/.env" ]; then
        log_info "Створення .env файлу (v5.0 Pure MCP)..."
        cat > "$REPO_ROOT/.env" << EOF
# ===================================
# ATLAS v5.0 - Environment Configuration
# ===================================
# Generated: $(date)
# Platform: macOS $(sw_vers -productVersion)
# Architecture: $(uname -m)

# === SYSTEM ===
NODE_ENV=production
BUILD_NUMBER=dev
LOG_LEVEL=info
FORCE_FREE_PORTS=true

# === LLM API CONFIGURATION ===
LLM_API_ENDPOINT=http://localhost:4000/v1/chat/completions
LLM_API_FALLBACK_ENDPOINT=
LLM_API_USE_FALLBACK=true
LLM_API_TIMEOUT=60000

# === AI BACKEND CONFIGURATION (Pure MCP Mode) ===
AI_BACKEND_MODE=mcp
AI_BACKEND_PRIMARY=mcp
AI_BACKEND_DISABLE_FALLBACK=false

# === TTS & VOICE ===
REAL_TTS_MODE=true
TTS_DEVICE=${tts_device_value}
TTS_PORT=3001

# === WHISPER CONFIGURATION ===
WHISPER_BACKEND=cpp
WHISPER_DEVICE=${whisper_device_value}
WHISPER_PORT=3002
WHISPER_CPP_BIN=${whisper_bin_value}
WHISPER_CPP_MODEL=$MODELS_DIR/whisper/ggml-large-v3.bin
WHISPER_CPP_NGL=20
WHISPER_CPP_THREADS=${whisper_threads_value}
WHISPER_CPP_DISABLE_GPU=${whisper_disable_gpu_value}
WHISPER_SAMPLE_RATE=${whisper_sample_rate}

# === NETWORK PORTS ===
ORCHESTRATOR_PORT=5101
WEB_PORT=5001
FRONTEND_PORT=5001

# === FEATURES ===
USE_METAL_GPU=${use_metal_value}
OPTIMIZE_FOR_M1_MAX=${optimize_m1_value}
EOF
        log_success ".env файл створено (v5.0 Pure MCP Edition)"
    else
        log_info ".env файл вже існує (пропускаємо)"
    fi
    
    log_success "Системна конфігурація завершена"
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
    
    # MCP Servers
    log_info "Перевірка MCP серверів..."
    local mcp_installed=0
    local mcp_total=6
    
    for package in "@modelcontextprotocol/server-filesystem" "@executeautomation/playwright-mcp-server" "super-shell-mcp" "@peakmojo/applescript-mcp" "@cyanheads/git-mcp-server" "@modelcontextprotocol/server-memory"; do
        if npm list -g "$package" >/dev/null 2>&1; then
            ((mcp_installed++))
        fi
    done
    
    log_success "MCP Servers: $mcp_installed/$mcp_total встановлено"
    
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
# Фінальні інструкції (v5.0)
# =============================================================================

print_final_instructions() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${WHITE}              ATLAS v5.0 УСТАНОВКА ЗАВЕРШЕНА УСПІШНО!          ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}🚀 ATLAS v5.0 Features:${NC}"
    echo -e "   ${WHITE}✓${NC} Pure MCP режим (6 серверів, 92 tools)"
    echo -e "   ${WHITE}✓${NC} Mac Studio M1 MAX оптимізації"
    echo -e "   ${WHITE}✓${NC} Централізована конфігурація через .env"
    echo -e "   ${WHITE}✓${NC} Metal GPU acceleration для Whisper та TTS"
    echo ""
    echo -e "${CYAN}� MCP Servers (6/6):${NC}"
    echo -e "   ${WHITE}•${NC} filesystem (14 tools) - Файли та директорії"
    echo -e "   ${WHITE}•${NC} playwright (32 tools) - Браузер automation"
    echo -e "   ${WHITE}•${NC} shell (9 tools) - Системні команди"
    echo -e "   ${WHITE}•${NC} applescript (1 tool) - macOS GUI"
    echo -e "   ${WHITE}•${NC} git (27 tools) - Версійний контроль"
    echo -e "   ${WHITE}•${NC} memory (9 tools) - Cross-session пам'ять"
    echo ""
    echo -e "${CYAN}�📋 Наступні кроки:${NC}"
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
    echo -e "   ${WHITE}• TTS Service:${NC}       http://localhost:3001"
    echo -e "   ${WHITE}• Whisper Service:${NC}   http://localhost:3002"
    echo -e "   ${WHITE}• LLM API:${NC}           http://localhost:4000 (external)"
    echo ""
    echo -e "${CYAN}⚙️  Конфігурація:${NC}"
    echo ""
    echo -e "   ${WHITE}• .env${NC}               - Системні налаштування"
    echo -e "   ${WHITE}• .env.example${NC}       - Приклад конфігурації"
    echo ""
    echo -e "${CYAN}📚 Документація:${NC}"
    echo ""
    echo -e "   ${WHITE}• README.md${NC}          - Загальна інформація"
    echo -e "   ${WHITE}• .github/copilot-instructions.md${NC}  - v5.0 Guide"
    echo ""
    echo -e "${CYAN}💡 Корисні команди:${NC}"
    echo ""
    echo -e "   ${WHITE}make help${NC}            - Показати всі Make команди"
    echo -e "   ${WHITE}./restart_system.sh help${NC} - Показати опції управління"
    echo ""
    echo -e "${CYAN}ℹ️  ATLAS v5.0:${NC} Pure MCP режим"
    echo ""
    echo -e "   MCP сервери запускаються автоматично через orchestrator"
    echo -e "   LLM API: ${WHITE}http://localhost:4000${NC} (OpenRouter або локальний сервер)"
    echo ""
    echo -e "${GREEN}✨ Система готова до роботи!${NC}"
    echo ""
}

# =============================================================================
# Головна функція
# =============================================================================

main() {
    print_banner
    
    log_info "Розпочато установку ATLAS v5.0 (Pure MCP Edition) на macOS"
    log_info "Робоча директорія: $REPO_ROOT"
    echo ""
    
    # Виконати кроки установки
    check_system_requirements
    install_homebrew
    install_python
    install_nodejs
    install_git
    install_dependencies
    install_mcp_servers
    setup_python_venv
    setup_nodejs_packages
    build_whisper_cpp
    download_whisper_models
    create_directories
    download_3d_models
    configure_system
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
