#!/bin/bash

# =============================================================================
# ATLAS Universal System Management Script
# =============================================================================
# Єдиний скрипт для управління всім стеком ATLAS
# Підтримує запуск, зупинку, рестарт та статус системи
# Підключається до зовнішнього Goose Desktop (не запускає його)
# =============================================================================

set -e

# ANSI escape codes для кольорового виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# =============================================================================
# Конфігурація системи
# =============================================================================
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS_DIR="$REPO_ROOT/logs"
ARCHIVE_DIR="$LOGS_DIR/archive"

# Goose Configuration (External service - managed by user)
GOOSE_SERVER_PORT="${GOOSE_SERVER_PORT:-3000}"

# TTS Configuration
REAL_TTS_MODE="${REAL_TTS_MODE:-true}"
TTS_DEVICE="${TTS_DEVICE:-mps}"
TTS_PORT="${TTS_PORT:-3001}"

# Whisper Configuration
WHISPER_MODEL="${WHISPER_MODEL:-base}"
WHISPER_DEVICE="${WHISPER_DEVICE:-cpu}"
WHISPER_PORT="${WHISPER_PORT:-3002}"
# Default backend: whisper.cpp (Metal on macOS)
WHISPER_BACKEND="${WHISPER_BACKEND:-cpp}"
# Default paths for whisper.cpp (can be overridden by env)
# Use whisper-cli (GPU enabled by default, use --no-gpu to disable)
if [ -z "${WHISPER_CPP_BIN:-}" ]; then
    if [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli"
    elif [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main"
    else
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp/main"
    fi
else
    WHISPER_CPP_BIN="${WHISPER_CPP_BIN}"
fi
WHISPER_CPP_MODEL="${WHISPER_CPP_MODEL:-$REPO_ROOT/models/whisper/ggml-large-v3.bin}"
WHISPER_CPP_NGL="${WHISPER_CPP_NGL:-20}"
WHISPER_CPP_THREADS="${WHISPER_CPP_THREADS:-6}"

# Service Ports
FRONTEND_PORT=5001
ORCHESTRATOR_PORT=5101
RECOVERY_PORT=5102
WHISPER_SERVICE_PORT=3002
FALLBACK_PORT=3010

# Features
ENABLE_LOCAL_FALLBACK="${ENABLE_LOCAL_FALLBACK:-false}"
FORCE_FREE_PORTS="${FORCE_FREE_PORTS:-false}"

# Goose Storage
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

# =============================================================================
# Utility Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}               ATLAS INTELLIGENT SYSTEM MANAGER                ${CYAN}║${NC}"
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

log_progress() {
    echo -e "${BLUE}⚡${NC} $1"
}

# Get Goose binary path from config or fallback
get_goose_binary() {
    # 1) Explicit env override
    if [ -n "$GOOSE_BIN" ] && [ -x "$GOOSE_BIN" ]; then
        echo "$GOOSE_BIN"
        return 0
    fi

    # 2) Try to get path from config.yaml (desktop_path for legacy compatibility)
    if [ -f "$REPO_ROOT/config/config.yaml" ]; then
        local config_path=$(grep -A 10 "^goose:" "$REPO_ROOT/config/config.yaml" | grep "desktop_path:" | sed 's/.*desktop_path: *"\([^"\\]*\)".*/\1/')
        if [ -n "$config_path" ] && [ -x "$config_path" ]; then
            echo "$config_path"
            return 0
        fi
    fi

    # 3) Prefer Homebrew CLI first, then PATH, then Desktop app
    if [ -x "/opt/homebrew/bin/goose" ]; then
        echo "/opt/homebrew/bin/goose"
    elif command -v goose >/dev/null 2>&1; then
        echo "goose"
    elif [ -x "$HOME/.local/bin/goose" ]; then
        echo "$HOME/.local/bin/goose"
    elif [ -x "/Applications/Goose.app/Contents/MacOS/goose" ]; then
        echo "/Applications/Goose.app/Contents/MacOS/goose"
    else
        echo ""
    fi
}

# Create necessary directories
init_directories() {
    mkdir -p "$LOGS_DIR"
    mkdir -p "$ARCHIVE_DIR"
    mkdir -p "$HOME/.local/share/goose/sessions"
}

# Check if port is in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        if lsof -ti:$port > /dev/null 2>&1; then
            return 1
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

# Free port if requested
free_port() {
    local port=$1
    local name=$2
    
    if [ "$FORCE_FREE_PORTS" = "true" ]; then
        log_warn "Freeing port $port ($name)..."
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            kill $pids 2>/dev/null || true
            sleep 1
            pids=$(lsof -ti:$port 2>/dev/null || true)
            if [ -n "$pids" ]; then
                kill -9 $pids 2>/dev/null || true
            fi
        fi
        if check_port "$port"; then
            log_success "Port $port freed"
            return 0
        else
            log_error "Failed to free port $port"
            return 1
        fi
    fi
    return 1
}

# Stop service by PID file
stop_service() {
    local name=$1
    local pidfile=$2
    local signal=${3:-TERM}
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if ps -p $pid > /dev/null 2>&1; then
            log_info "Stopping $name (PID: $pid)..."
            kill -$signal $pid 2>/dev/null || true
            
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if ps -p $pid > /dev/null 2>&1; then
                log_warn "Force killing $name..."
                kill -KILL $pid 2>/dev/null || true
                sleep 1
            fi
            
            log_success "$name stopped"
        else
            log_warn "$name was not running (stale PID file)"
        fi
        rm -f "$pidfile"
    fi
}

# Goose configuration validation and repair functions
validate_goose_config() {
    local goose_bin=$(get_goose_binary)
    local config_file="$HOME/.config/goose/config.yaml"
    
    if [ ! -f "$config_file" ]; then
        log_warn "Goose config file not found. Running initial configuration..."
        return 1
    fi
    
    # Check if provider is configured (new format)
    if ! grep -q "GOOSE_PROVIDER:" "$config_file"; then
        log_warn "Goose provider not properly configured"
        return 1
    fi
    
    # Test if Goose actually works instead of checking token details
    log_info "Testing Goose functionality..."
    local timeout_cmd=""
    if command -v timeout >/dev/null 2>&1; then
        timeout_cmd="timeout 10"
    elif command -v gtimeout >/dev/null 2>&1; then
        timeout_cmd="gtimeout 10"
    fi

    if [ -n "$timeout_cmd" ]; then
        if $timeout_cmd "$goose_bin" web --help > /dev/null 2>&1; then
            log_info "Goose configuration appears to be working"
            return 0
        else
            log_warn "Goose functionality test failed"
            return 1
        fi
    else
        # No timeout available; rely on CLI help being instant for CLI builds
        if "$goose_bin" web --help > /dev/null 2>&1; then
            log_info "Goose configuration appears to be working"
            return 0
        else
            log_warn "Goose functionality test failed"
            return 1
        fi
    fi
}

repair_goose_config() {
    log_warn "Goose configuration issues detected. Attempting repair..."
    local goose_bin=$(get_goose_binary)
    
    if [ -z "$goose_bin" ] || [ ! -x "$goose_bin" ]; then
        log_error "Goose binary not available for configuration repair"
        return 1
    fi
    
    log_info "Running Goose configuration wizard..."
    log_info "Please follow the prompts to configure GitHub Copilot"
    
    if "$goose_bin" configure; then
        log_success "Goose configuration completed successfully"
        return 0
    else
        log_error "Goose configuration failed"
        return 1
    fi
}

# =============================================================================
# Service Management Functions
# =============================================================================

detect_goose_port() {
    # Try to find Goose port from running processes
    local goose_port=""
    
    # Look for GOOSE_PORT in process environment
    if command -v ps >/dev/null 2>&1; then
        goose_port=$(ps aux | grep -i goose | grep "GOOSE_PORT" | sed -n 's/.*GOOSE_PORT[":]*\([0-9]\+\).*/\1/p' | head -1)
    fi
    
    # If not found, try common ports
    if [ -z "$goose_port" ]; then
        for port in 3000 49299 51958 53769 65459 8080 8000; do
            if ! check_port "$port"; then
                if command -v curl >/dev/null 2>&1; then
                    local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null || echo "000")
                    if [ "$response" = "401" ] || [ "$response" = "200" ] || [ "$response" = "404" ]; then
                        goose_port=$port
                        break
                    fi
                fi
            fi
        done
    fi
    
    echo "$goose_port"
}

start_goose_web_server() {
    log_progress "Starting Goose Web Server on port $GOOSE_SERVER_PORT..."
    
    # Check if port is available
    if ! check_port "$GOOSE_SERVER_PORT"; then
        if [ "$FORCE_FREE_PORTS" = "true" ]; then
            free_port "$GOOSE_SERVER_PORT" "Goose Web Server" || return 1
        else
            log_warn "Port $GOOSE_SERVER_PORT is busy. Checking if it's already Goose..."
            local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$GOOSE_SERVER_PORT" 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                log_success "Goose already running on port $GOOSE_SERVER_PORT"
                # Find and save the existing Goose PID
                local existing_pid=$(lsof -ti:$GOOSE_SERVER_PORT 2>/dev/null | head -1)
                if [ -n "$existing_pid" ]; then
                    echo "$existing_pid" > "$LOGS_DIR/goose_web.pid"
                    log_info "Saved existing Goose PID: $existing_pid"
                fi
                return 0
            else
                log_error "Port $GOOSE_SERVER_PORT is busy with another service (HTTP $response)"
                return 1
            fi
        fi
    fi
    
    # Check if Goose binary is available
    local goose_bin=$(get_goose_binary)
    if [ -z "$goose_bin" ] || [ ! -x "$goose_bin" ]; then
        log_error "Goose binary not found"
        log_info "Install with: brew install --cask block-goose OR brew install block-goose-cli"
        return 1
    fi
    
    log_info "Using Goose binary: $goose_bin"
    
    # Check Goose configuration before starting
    log_info "Checking Goose configuration..."
    if ! "$goose_bin" --version > /dev/null 2>&1; then
        log_error "Goose CLI is not working properly"
        log_info "Hint: prefer Homebrew CLI (brew install block-goose-cli) or set GOOSE_BIN=<path>"
        return 1
    fi
    
    # Validate Goose configuration
    if ! validate_goose_config; then
        log_warn "Goose configuration validation failed"
        # Avoid interactive configure here; instruct user instead
        log_info "If needed, run manually: $goose_bin configure"
    fi
    
    # Start Goose web server
    (
        cd "$REPO_ROOT"
        "$goose_bin" web --port "$GOOSE_SERVER_PORT" > "$LOGS_DIR/goose_web.log" 2>&1 &
        echo $! > "$LOGS_DIR/goose_web.pid"
    )
    
    # Wait for startup with progressive checks
    log_info "Waiting for Goose to start..."
    local attempts=0
    local max_attempts=10
    
    while [ $attempts -lt $max_attempts ]; do
        sleep 1
        attempts=$((attempts + 1))
        
        # Check if process is still running
        if [ -f "$LOGS_DIR/goose_web.pid" ] && ps -p $(cat "$LOGS_DIR/goose_web.pid") > /dev/null 2>&1; then
            # Check if it's responding
            local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$GOOSE_SERVER_PORT" 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                log_success "Goose Web Server started (PID: $(cat "$LOGS_DIR/goose_web.pid"), attempt $attempts)"
                return 0
            elif [ "$response" != "000" ]; then
                log_info "Goose responding with HTTP $response, waiting..."
            fi
        else
            log_error "Goose process died during startup (attempt $attempts)"
            if [ -f "$LOGS_DIR/goose_web.log" ]; then
                log_error "Last log lines:"
                tail -3 "$LOGS_DIR/goose_web.log" | sed 's/^/  /'
            fi
            return 1
        fi
    done
    
    log_error "Goose Web Server failed to respond after $max_attempts attempts"
    if [ -f "$LOGS_DIR/goose_web.log" ]; then
        log_error "Check logs: tail -f $LOGS_DIR/goose_web.log"
    fi
    return 1
}

start_tts_service() {
    log_progress "Starting TTS Service on port $TTS_PORT..."
    
    if ! check_port "$TTS_PORT"; then
        log_warn "Port $TTS_PORT is busy. Skipping TTS."
        return 0
    fi
    
    if [ "$REAL_TTS_MODE" = "true" ]; then
        (
            # Ukrainian-TTS пакет встановлено в web/venv/, використовуємо його
            cd "$REPO_ROOT/web"
            if [ -f "venv/bin/activate" ]; then
                source venv/bin/activate
                log_info "Using web/venv for TTS (ukrainian-tts package installed here)"
            else
                log_error "web/venv not found! Run: python3 -m venv web/venv && source web/venv/bin/activate && pip install git+https://github.com/robinhad/ukrainian-tts.git"
                return 1
            fi
            
            # КРИТИЧНО: Копіюємо model files в ukrainian-tts/ якщо відсутні
            cd "$REPO_ROOT"
            for file in feats_stats.npz model.pth spk_xvector.ark config.yaml; do
                if [ -f "$file" ] && [ ! -f "ukrainian-tts/$file" ]; then
                    log_info "Copying TTS model file: $file → ukrainian-tts/"
                    cp "$file" "ukrainian-tts/"
                fi
            done
            
            # Запускаємо TTS сервер з правильного venv
            cd "$REPO_ROOT/ukrainian-tts"
            # КРИТИЧНО: MPS fallback для unsupported operations
            export PYTORCH_ENABLE_MPS_FALLBACK=1
            python3 tts_server.py --host 127.0.0.1 --port "$TTS_PORT" --device "$TTS_DEVICE" > "$LOGS_DIR/tts_real.log" 2>&1 &
            echo $! > "$LOGS_DIR/tts.pid"
        )
        log_success "Real TTS started"
    else
        (
            cd "$REPO_ROOT/web"
            if [ -f "venv/bin/activate" ]; then
                source venv/bin/activate
            fi
            TTS_PORT="$TTS_PORT" python3 ukrainian_tts_server.py > "$LOGS_DIR/tts.log" 2>&1 &
            echo $! > "$LOGS_DIR/tts.pid"
        )
        log_success "Mock TTS started"
    fi
}

start_whisper_service() {
    log_progress "Starting Whisper Service on port $WHISPER_PORT..."
    
    if ! check_port "$WHISPER_PORT"; then
        log_warn "Port $WHISPER_PORT is busy. Skipping Whisper."
        return 0
    fi
    
    (
        cd "$REPO_ROOT"
        if [ "$WHISPER_BACKEND" = "cpp" ]; then
            log_info "Starting whisper.cpp backend (Metal-ready)"
            # Готуємо Python оточення локально у корені репозиторію
            if [ ! -f ".venv/bin/activate" ]; then
                log_info "Creating Python virtual environment for Whisper service..."
                python3 -m venv .venv
                source .venv/bin/activate
                pip install -r requirements.txt
            else
                source .venv/bin/activate
            fi

            # Якщо відсутній бінарник або модель — автоматично встановимо whisper.cpp
            if [ ! -x "$WHISPER_CPP_BIN" ] || [ ! -f "$WHISPER_CPP_MODEL" ]; then
                log_warn "whisper.cpp binary or model missing. Running setup..."
                bash scripts/setup_whisper_cpp.sh
            fi

            # Переконаємось, що PyAV встановлено (потрібно для конвертації webm->wav)
            python - <<'PY'
try:
    import av  # noqa: F401
    print('pyav_ok')
except Exception:
    print('pyav_missing')
PY
            if [ "$(python - <<'PY'
try:
    import av
    print('ok')
except Exception:
    print('no')
PY
)" != "ok" ]; then
                log_info "Installing PyAV dependency..."
                pip install av --no-input
            fi

            : ${WHISPER_CPP_BIN:?"Set WHISPER_CPP_BIN to whisper.cpp binary"}
            : ${WHISPER_CPP_MODEL:?"Set WHISPER_CPP_MODEL to ggml/gguf model path"}
            export WHISPER_PORT
            export WHISPER_CPP_BIN
            export WHISPER_CPP_MODEL
            export WHISPER_CPP_LANG=${WHISPER_CPP_LANG:-uk}
            export WHISPER_CPP_THREADS=${WHISPER_CPP_THREADS:-6}
            export WHISPER_CPP_NGL=${WHISPER_CPP_NGL:-20}
            
            # FIXED 13.10.2025 v3 - Тільки параметри що підтримує whisper-cli
            # whisper-cli підтримує: -tp (temperature), -bo (best_of), -bs (beam_size), -nth (no_speech_threshold), --prompt
            # НЕ підтримує: patience, length_penalty, compression_ratio_threshold, condition_on_previous_text
            export WHISPER_CPP_TEMPERATURE=${WHISPER_CPP_TEMPERATURE:-0.0}
            export WHISPER_CPP_BEST_OF=${WHISPER_CPP_BEST_OF:-5}
            export WHISPER_CPP_BEAM_SIZE=${WHISPER_CPP_BEAM_SIZE:-5}
            export WHISPER_CPP_NO_SPEECH_THRESHOLD=${WHISPER_CPP_NO_SPEECH_THRESHOLD:-0.6}
            export WHISPER_CPP_INITIAL_PROMPT="${WHISPER_CPP_INITIAL_PROMPT:-Це українська мова з правильною орфографією, граматикою та пунктуацією. Олег Миколайович розмовляє з Атласом.}"
            python3 services/whisper/whispercpp_service.py > "$LOGS_DIR/whisper.log" 2>&1 &
            echo $! > "$LOGS_DIR/whisper.pid"
        else
            # Faster-whisper backend (CPU on macOS)
            export WHISPER_MODEL="${WHISPER_MODEL:-medium}"
            export WHISPER_DEVICE="${WHISPER_DEVICE:-auto}"
            export WHISPER_COMPUTE_TYPE="${WHISPER_COMPUTE_TYPE:-float32}"
            
            # Покращені параметри для faster-whisper
            export WHISPER_TEMPERATURE=${WHISPER_TEMPERATURE:-0.0}
            export WHISPER_BEAM_SIZE=${WHISPER_BEAM_SIZE:-5}
            export WHISPER_BEST_OF=${WHISPER_BEST_OF:-5}
            export WHISPER_PATIENCE=${WHISPER_PATIENCE:-1.0}
            export WHISPER_LENGTH_PENALTY=${WHISPER_LENGTH_PENALTY:-1.0}
            export WHISPER_COMPRESSION_RATIO_THRESHOLD=${WHISPER_COMPRESSION_RATIO_THRESHOLD:-2.4}
            export WHISPER_NO_SPEECH_THRESHOLD=${WHISPER_NO_SPEECH_THRESHOLD:-0.6}
            export WHISPER_CONDITION_ON_PREVIOUS_TEXT=${WHISPER_CONDITION_ON_PREVIOUS_TEXT:-true}
            export WHISPER_INITIAL_PROMPT="${WHISPER_INITIAL_PROMPT:-Це українська мова з правильною орфографією, граматикою та пунктуацією.}"
            python3 services/whisper/whisper_service.py > "$LOGS_DIR/whisper.log" 2>&1 &
            echo $! > "$LOGS_DIR/whisper.pid"
        fi
    )
    
    # Determine device info and model name for logging (AFTER subshell to access variables)
    if [ "$WHISPER_BACKEND" == "cpp" ]; then
        MODEL_NAME=$(basename "$WHISPER_CPP_MODEL" 2>/dev/null || echo "unknown")
        BIN_NAME=$(basename "$WHISPER_CPP_BIN" 2>/dev/null || echo "unknown")
        if [[ "$BIN_NAME" == *"whisper-cli"* ]]; then
            DEVICE_INFO="Metal GPU (whisper-cli default)"
        elif [ "${WHISPER_CPP_NGL:-0}" -gt 0 ]; then
            DEVICE_INFO="Metal GPU (ngl=$WHISPER_CPP_NGL)"
        else
            DEVICE_INFO="CPU"
        fi
    else
        MODEL_NAME="$WHISPER_MODEL"
        DEVICE_INFO="$WHISPER_DEVICE"
    fi
    
    log_success "Whisper Service started with model $MODEL_NAME on $DEVICE_INFO"
}

start_orchestrator() {
    log_progress "Starting Node.js Orchestrator on port $ORCHESTRATOR_PORT..."
    
    if ! check_port "$ORCHESTRATOR_PORT"; then
        if ! free_port "$ORCHESTRATOR_PORT" "Orchestrator"; then
            log_error "Cannot start Orchestrator - port $ORCHESTRATOR_PORT is busy"
            return 1
        fi
    fi
    
    (
        cd "$REPO_ROOT/orchestrator"
        if [ ! -d "node_modules" ]; then
            log_info "Installing Node.js dependencies..."
            npm install
        fi
        
        export FALLBACK_API_BASE="http://127.0.0.1:$FALLBACK_PORT/v1"
        export ORCH_SSE_FOR_GITHUB_COPILOT="${ORCH_SSE_FOR_GITHUB_COPILOT:-false}"
        export ORCH_FORCE_GOOSE_REPLY="${ORCH_FORCE_GOOSE_REPLY:-false}"
        
        node server.js > "$LOGS_DIR/orchestrator.log" 2>&1 &
        echo $! > "$LOGS_DIR/orchestrator.pid"
    )
    
    log_success "Orchestrator started (PID: $(cat "$LOGS_DIR/orchestrator.pid"))"
}

start_frontend() {
    log_progress "Starting Python Frontend on port $FRONTEND_PORT..."
    
    if ! check_port "$FRONTEND_PORT"; then
        if ! free_port "$FRONTEND_PORT" "Frontend"; then
            log_error "Cannot start Frontend - port $FRONTEND_PORT is busy"
            return 1
        fi
    fi
    
    (
        cd "$REPO_ROOT/web"
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
        else
            log_info "Creating Python virtual environment..."
            python3 -m venv venv
            source venv/bin/activate
            pip install -r ../requirements.txt
        fi
        
        export ATLAS_TTS_URL="${ATLAS_TTS_URL:-http://127.0.0.1:$TTS_PORT/tts}"
        python3 atlas_server.py > "$LOGS_DIR/frontend.log" 2>&1 &
        echo $! > "$LOGS_DIR/frontend.pid"
    )
    
    log_success "Frontend started (PID: $(cat "$LOGS_DIR/frontend.pid"))"
}

start_recovery_bridge() {
    log_progress "Starting Recovery Bridge on port $RECOVERY_PORT..."
    
    if ! check_port "$RECOVERY_PORT"; then
        free_port "$RECOVERY_PORT" "Recovery Bridge" || true
    fi
    
    (
        cd "$REPO_ROOT/config"
        if [ -f "../web/venv/bin/activate" ]; then
            source ../web/venv/bin/activate
        fi
        python3 recovery_bridge.py > "$LOGS_DIR/recovery.log" 2>&1 &
        echo $! > "$LOGS_DIR/recovery.pid"
    )
    
    log_success "Recovery Bridge started (PID: $(cat "$LOGS_DIR/recovery.pid"))"
}

start_fallback_llm() {
    if [ "$ENABLE_LOCAL_FALLBACK" != "true" ]; then
        log_info "Local Fallback LLM is disabled"
        return 0
    fi
    
    log_progress "Starting Fallback LLM on port $FALLBACK_PORT..."
    
    if ! check_port "$FALLBACK_PORT"; then
        log_info "Port $FALLBACK_PORT already in use (external provider detected)"
        return 0
    fi
    
    (
        cd "$REPO_ROOT/fallback_llm"
        if [ ! -d "node_modules" ]; then
            log_info "Installing Fallback LLM dependencies..."
            npm install
        fi
        node server.js > "$LOGS_DIR/fallback.log" 2>&1 &
        echo $! > "$LOGS_DIR/fallback.pid"
    )
    
    log_success "Fallback LLM started (PID: $(cat "$LOGS_DIR/fallback.pid"))"
}

# =============================================================================
# Main Commands
# =============================================================================

cmd_start() {
    print_header
    log_info "Starting ATLAS System..."
    
    init_directories
    
    # Start Goose Web Server
    start_goose_web_server
    
    # Start all other services in order
    start_tts_service
    start_whisper_service
    start_orchestrator
    start_frontend
    start_recovery_bridge
    start_fallback_llm
    
    # Wait for services to initialize
    log_info "Waiting for services to initialize..."
    sleep 5
    
    # Check health
    cmd_status
    
    echo ""
    log_success "ATLAS System Started Successfully!"
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}                     ACCESS POINTS                             ${CYAN}║${NC}"
    echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${WHITE} 🌐 Web Interface:     http://localhost:$FRONTEND_PORT              ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE} 🦆 Goose Server:      http://localhost:$GOOSE_SERVER_PORT              ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE} 🎭 Orchestrator API:  http://localhost:$ORCHESTRATOR_PORT              ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE} 🔧 Recovery Bridge:   ws://localhost:$RECOVERY_PORT               ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

cmd_stop() {
    print_header
    log_info "Stopping ATLAS System..."
    
    # Stop all services
    stop_service "Recovery Bridge" "$LOGS_DIR/recovery.pid"
    stop_service "Frontend" "$LOGS_DIR/frontend.pid"
    stop_service "Orchestrator" "$LOGS_DIR/orchestrator.pid"
    stop_service "Goose Web Server" "$LOGS_DIR/goose_web.pid"
    stop_service "TTS Service" "$LOGS_DIR/tts.pid"
    stop_service "Whisper Service" "$LOGS_DIR/whisper.pid"
    stop_service "Fallback LLM" "$LOGS_DIR/fallback.pid"
    
    # Clean up any remaining processes on ports (except Goose port)
    for port in $FRONTEND_PORT $ORCHESTRATOR_PORT $RECOVERY_PORT $TTS_PORT $WHISPER_SERVICE_PORT $FALLBACK_PORT; do
        if ! check_port "$port"; then
            local pid=$(lsof -ti:$port 2>/dev/null || true)
            if [ -n "$pid" ]; then
                log_warn "Cleaning up process on port $port (PID: $pid)"
                kill -9 $pid 2>/dev/null || true
            fi
        fi
    done
    
    # Note about Goose port
    if ! check_port "$GOOSE_SERVER_PORT"; then
        log_info "Goose Desktop is still running on port $GOOSE_SERVER_PORT (not touched)"
    fi
    
    # Clean up PID files
    find "$LOGS_DIR" -name "*.pid" -delete 2>/dev/null || true
    
    log_success "ATLAS System Stopped"
}

cmd_restart() {
    cmd_stop
    echo ""
    log_info "Waiting 5 seconds before restart..."
    sleep 5
    echo ""
    cmd_start
}

cmd_status() {
    echo ""
    echo -e "${CYAN}System Status:${NC}"
    echo "─────────────────────────────────────────"
    
    check_service() {
        local name=$1
        local pidfile=$2
        local port=$3
        
        printf "%-20s " "$name:"
        
        if [ -f "$pidfile" ] && ps -p $(cat "$pidfile") > /dev/null 2>&1; then
            echo -e "${GREEN}● RUNNING${NC} (PID: $(cat "$pidfile"), Port: $port)"
        elif ! check_port "$port"; then
            echo -e "${YELLOW}● PORT IN USE${NC} (Port: $port, external process)"
        else
            echo -e "${RED}● STOPPED${NC}"
        fi
    }
    
    check_service "Goose Web Server" "$LOGS_DIR/goose_web.pid" "$GOOSE_SERVER_PORT"
    check_service "Frontend" "$LOGS_DIR/frontend.pid" "$FRONTEND_PORT"
    check_service "Orchestrator" "$LOGS_DIR/orchestrator.pid" "$ORCHESTRATOR_PORT"
    check_service "Recovery Bridge" "$LOGS_DIR/recovery.pid" "$RECOVERY_PORT"
    check_service "TTS Service" "$LOGS_DIR/tts.pid" "$TTS_PORT"
    check_service "Whisper Service" "$LOGS_DIR/whisper.pid" "$WHISPER_SERVICE_PORT"
    
    if [ "$ENABLE_LOCAL_FALLBACK" = "true" ]; then
        check_service "Fallback LLM" "$LOGS_DIR/fallback.pid" "$FALLBACK_PORT"
    fi
}

cmd_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        log_info "Following all logs... (Press Ctrl+C to stop)"
        tail -f "$LOGS_DIR"/*.log
    else
        case $service in
            goose)
                tail -f "$LOGS_DIR/goose_web.log"
                ;;
            frontend)
                tail -f "$LOGS_DIR/frontend.log"
                ;;
            orchestrator)
                tail -f "$LOGS_DIR/orchestrator.log"
                ;;
            recovery)
                tail -f "$LOGS_DIR/recovery.log"
                ;;
            tts)
                tail -f "$LOGS_DIR/tts.log"
                ;;
            whisper)
                tail -f "$LOGS_DIR/whisper.log"
                ;;
            fallback)
                tail -f "$LOGS_DIR/fallback.log"
                ;;
            *)
                log_error "Unknown service: $service"
                echo "Available services: goose, frontend, orchestrator, recovery, tts, whisper, fallback"
                exit 1
                ;;
        esac
    fi
}

cmd_clean() {
    log_info "Cleaning logs and temporary files..."
    
    # Archive current logs
    if [ "$(ls -A "$LOGS_DIR"/*.log 2>/dev/null | wc -l)" -gt 0 ]; then
        local ts=$(date +%Y%m%d_%H%M%S)
        tar -czf "$ARCHIVE_DIR/atlas_logs_$ts.tar.gz" -C "$LOGS_DIR" *.log 2>/dev/null || true
        log_success "Logs archived to $ARCHIVE_DIR/atlas_logs_$ts.tar.gz"
    fi
    
    # Remove log files
    rm -f "$LOGS_DIR"/*.log
    rm -f "$LOGS_DIR"/*.pid
    
    log_success "Cleanup completed"
}

cmd_diagnose() {
    print_header
    log_info "Running ATLAS System Diagnostics..."
    echo ""
    
    # Check Goose Binary
    echo -e "${CYAN}Goose Binary Status:${NC}"
    echo "─────────────────────────────────────────"
    local goose_bin=$(get_goose_binary)
    if [ -n "$goose_bin" ] && [ -x "$goose_bin" ]; then
        local version=$("$goose_bin" --version 2>/dev/null || echo "unknown")
        echo -e "${GREEN}✓${NC} Goose binary found: $goose_bin (version: $version)"
    else
        echo -e "${RED}✗${NC} Goose binary not found"
        echo "  Install Desktop: brew install --cask block-goose"
        echo "  Install CLI: brew install block-goose-cli"
    fi
    
    # Check Goose configuration
    echo ""
    echo -e "${CYAN}Goose Configuration:${NC}"
    echo "─────────────────────────────────────────"
    local config_file="$HOME/.config/goose/config.yaml"
    if [ -f "$config_file" ]; then
        echo -e "${GREEN}✓${NC} Config file exists: $config_file"
        if validate_goose_config; then
            echo -e "${GREEN}✓${NC} Configuration is valid"
        else
            echo -e "${YELLOW}⚠${NC} Configuration needs attention"
        fi
        
        # Show key config values
        if grep -q "provider:" "$config_file"; then
            local provider=$(grep "provider:" "$config_file" | head -1 | cut -d: -f2 | tr -d ' ')
            echo "  Provider: $provider"
        fi
        if grep -q "model:" "$config_file"; then
            local model=$(grep "model:" "$config_file" | head -1 | cut -d: -f2 | tr -d ' ')
            echo "  Model: $model"
        fi
    else
        echo -e "${RED}✗${NC} Config file not found"
        echo "  Run: $goose_bin configure"
    fi
    
    # Check ports
    echo ""
    echo -e "${CYAN}Port Status:${NC}"
    echo "─────────────────────────────────────────"
    for port_info in "Goose:$GOOSE_SERVER_PORT" "Frontend:$FRONTEND_PORT" "Orchestrator:$ORCHESTRATOR_PORT" "Recovery:$RECOVERY_PORT" "TTS:$TTS_PORT"; do
        local name=$(echo "$port_info" | cut -d: -f1)
        local port=$(echo "$port_info" | cut -d: -f2)
        
        if check_port "$port"; then
            echo -e "${GREEN}✓${NC} Port $port ($name) is available"
        else
            echo -e "${YELLOW}⚠${NC} Port $port ($name) is in use"
            local pid=$(lsof -ti:$port 2>/dev/null || echo "unknown")
            if [ "$pid" != "unknown" ]; then
                local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
                echo "  Process: $process (PID: $pid)"
            fi
        fi
    done
    
    # Check dependencies
    echo ""
    echo -e "${CYAN}Dependencies:${NC}"
    echo "─────────────────────────────────────────"
    for cmd in curl lsof ps node python3 npm; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $cmd is available"
        else
            echo -e "${RED}✗${NC} $cmd is missing"
        fi
    done
    
    echo ""
    log_success "Diagnostics completed"
}

cmd_help() {
    print_header
    echo "Usage: $0 {start|stop|restart|status|logs|clean|diagnose|help}"
    echo ""
    echo "Commands:"
    echo "  start     - Start all ATLAS services"
    echo "  stop      - Stop all ATLAS services"
    echo "  restart   - Restart all ATLAS services"
    echo "  status    - Show status of all services"
    echo "  logs      - Follow logs (optionally specify service)"
    echo "  clean     - Archive and clean log files"
    echo "  diagnose  - Run system diagnostics"
    echo "  help      - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  GOOSE_SERVER_PORT     - Goose server port to connect to (default: 3000)"
    echo "  REAL_TTS_MODE         - Use real TTS instead of mock (default: true)"
    echo "  TTS_DEVICE            - TTS device (default: mps for macOS)"
    echo "  ENABLE_LOCAL_FALLBACK - Enable local fallback LLM (default: false)"
    echo "  FORCE_FREE_PORTS      - Force free busy ports (default: false)"
    echo ""
    echo "Important Notes:"
    echo "  • Goose Desktop must be started manually by the user"
    echo "  • Make sure Goose Desktop is running on port $GOOSE_SERVER_PORT"
    echo "  • This script only connects to existing Goose instance"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start system"
    echo "  $0 diagnose                 # Check system health"
    echo "  $0 logs orchestrator        # Follow orchestrator logs"
    echo "  FORCE_FREE_PORTS=true $0 start  # Start and force free ports"
    echo ""
}

# =============================================================================
# Main Entry Point
# =============================================================================

case "${1:-help}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$2"
        ;;
    clean)
        cmd_clean
        ;;
    diagnose)
        cmd_diagnose
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        log_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
