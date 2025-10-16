#!/bin/bash

# =============================================================================
# ATLAS v5.0 Universal System Management Script
# =============================================================================
# Єдиний скрипт для управління всім стеком ATLAS
# v5.0: Pure MCP режим з 6 операційними серверами
# =============================================================================

set -e

# =============================================================================
# Load Environment Variables
# =============================================================================
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load .env file if it exists
if [ -f "$REPO_ROOT/.env" ]; then
    echo "Loading environment variables from .env..."
    set -a
    source <(cat "$REPO_ROOT/.env" | grep -v '^#' | grep -v '^\s*$')
    set +a
fi

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
LOGS_DIR="$REPO_ROOT/logs"
ARCHIVE_DIR="$LOGS_DIR/archive"

# TTS Configuration
REAL_TTS_MODE="${REAL_TTS_MODE:-true}"
TTS_DEVICE="${TTS_DEVICE:-mps}"
TTS_PORT="${TTS_PORT:-3001}"

# Whisper Configuration (Optimized for Mac Studio M1 MAX)
WHISPER_MODEL="${WHISPER_MODEL:-large-v3}"
WHISPER_DEVICE="${WHISPER_DEVICE:-metal}"
WHISPER_PORT="${WHISPER_PORT:-3002}"
WHISPER_BACKEND="${WHISPER_BACKEND:-cpp}"
WHISPER_SAMPLE_RATE="${WHISPER_SAMPLE_RATE:-48000}"

# Whisper.cpp paths (can be overridden by env)
if [ -z "${WHISPER_CPP_BIN:-}" ]; then
    if [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli"
    elif [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main"
    else
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp/main"
    fi
fi
WHISPER_CPP_MODEL="${WHISPER_CPP_MODEL:-$REPO_ROOT/models/whisper/ggml-large-v3.bin}"
WHISPER_CPP_NGL="${WHISPER_CPP_NGL:-20}"
WHISPER_CPP_THREADS="${WHISPER_CPP_THREADS:-10}"  # M1 Max has 10 performance cores

# Service Ports
FRONTEND_PORT="${WEB_PORT:-5001}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-5101}"
RECOVERY_PORT=5102
WHISPER_SERVICE_PORT="${WHISPER_PORT:-3002}"
FALLBACK_PORT=3010

# Features
ENABLE_LOCAL_FALLBACK="${ENABLE_LOCAL_FALLBACK:-false}"
FORCE_FREE_PORTS="${FORCE_FREE_PORTS:-false}"
USE_METAL_GPU="${USE_METAL_GPU:-true}"
OPTIMIZE_FOR_M1_MAX="${OPTIMIZE_FOR_M1_MAX:-true}"

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

# Create necessary directories
init_directories() {
    mkdir -p "$LOGS_DIR"
    mkdir -p "$ARCHIVE_DIR"
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
    
    # CRITICAL: NEVER touch port 4000 (External LLM API server)
    if [ "$port" = "4000" ]; then
        log_info "Port 4000 is protected (External LLM API) - skipping"
        return 1
    fi
    
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

# =============================================================================
# Service Management Functions
# =============================================================================

# ===================================================================
# End of deprecated functions
# ===================================================================

# ===================================================================

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
    log_info "Starting ATLAS v5.0 System (Pure MCP Mode)..."
    
    init_directories
    
    # Start all services in order
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
    echo -e "${CYAN}║${WHITE} 🎭 Orchestrator API:  http://localhost:$ORCHESTRATOR_PORT              ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE} 🔧 Recovery Bridge:   ws://localhost:$RECOVERY_PORT               ${CYAN}║${NC}"
    echo -e "${CYAN}║${WHITE} 🤖 LLM API:           http://localhost:4000                 ${CYAN}║${NC}"
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
    stop_service "TTS Service" "$LOGS_DIR/tts.pid"
    stop_service "Whisper Service" "$LOGS_DIR/whisper.pid"
    stop_service "Fallback LLM" "$LOGS_DIR/fallback.pid"
    
    # ✅ CRITICAL FIX: Kill ALL node server.js processes (не чіпати ті, що займають порт 4000)
    log_info "Cleaning up any remaining orchestrator processes..."
    local remaining_pids=$(pgrep -f "node server.js" 2>/dev/null || true)
    if [ -n "$remaining_pids" ]; then
        for pid in $remaining_pids; do
            # Перевіряємо чи цей PID займає порт 4000
            local ports=$(lsof -Pan -p $pid -i 2>/dev/null | awk '{print $9}' | grep -Eo ':[0-9]+' | tr -d ':')
            local skip=false
            for p in $ports; do
                if [ "$p" = "4000" ]; then
                    log_info "Skipping process PID $pid (uses protected port 4000)"
                    skip=true
                fi
            done
            if [ "$skip" = "true" ]; then
                continue
            fi
            log_warn "Killing remaining orchestrator process (PID: $pid)"
            kill -9 $pid 2>/dev/null || true
        done
    fi
    
    # Clean up any remaining processes on ports (except external API port 4000)
    # NOTE: Port 4000 is NOT touched - it's an external API service (OpenRouter/local LLM)
    # CRITICAL: Port 4000 is explicitly excluded from cleanup to preserve LLM API service
    for port in $FRONTEND_PORT $ORCHESTRATOR_PORT $RECOVERY_PORT $TTS_PORT $WHISPER_SERVICE_PORT $FALLBACK_PORT; do
        # Double-check: NEVER kill port 4000 even if somehow it appears in the list
        if [ "$port" = "4000" ]; then
            log_info "Skipping port 4000 (protected External LLM API)"
            continue
        fi
        
        if ! check_port "$port"; then
            local pid=$(lsof -ti:$port 2>/dev/null || true)
            if [ -n "$pid" ]; then
                log_warn "Cleaning up process on port $port (PID: $pid)"
                kill -9 $pid 2>/dev/null || true
            fi
        fi
    done
    
    # Note about external API port
    if ! check_port "4000"; then
        log_info "External LLM API service is running on port 4000 (not touched - managed separately)"
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
                echo "Available services: frontend, orchestrator, recovery, tts, whisper, fallback"
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
    
    echo -e "${CYAN}AI Backend Configuration (v5.0):${NC}"
    echo "─────────────────────────────────────────"
    echo -e "${GREEN}✓${NC} Mode: Pure MCP only"
    echo "  LLM API: ${LLM_API_ENDPOINT:-http://localhost:4000}"
    if [ -n "${LLM_API_FALLBACK_ENDPOINT}" ]; then
        echo "  Fallback API: ${LLM_API_FALLBACK_ENDPOINT}"
    fi

    if command -v npm >/dev/null 2>&1; then
        echo ""
        echo -e "${CYAN}Global MCP Server Packages:${NC}"
        echo "─────────────────────────────────────────"
        local mcp_packages=(
            "@modelcontextprotocol/server-filesystem"
            "@executeautomation/playwright-mcp-server"
            "super-shell-mcp"
            "@peakmojo/applescript-mcp"
            "@cyanheads/git-mcp-server"
            "@modelcontextprotocol/server-memory"
        )
        local missing_packages=0
        for pkg in "${mcp_packages[@]}"; do
            if npm list -g "$pkg" >/dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} $pkg"
            else
                echo -e "${YELLOW}⚠${NC} $pkg not detected (install with: npm install -g $pkg)"
                missing_packages=1
            fi
        done
        if [ $missing_packages -eq 0 ]; then
            echo -e "${GREEN}✓${NC} All required MCP servers detected"
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠${NC} npm not available - unable to verify MCP server packages"
    fi
    
    # Check service ports
    echo ""
    echo -e "${CYAN}Port Status:${NC}"
    echo "─────────────────────────────────────────"
    for port_info in "Frontend:$FRONTEND_PORT" "Orchestrator:$ORCHESTRATOR_PORT" "Recovery:$RECOVERY_PORT" "TTS:$TTS_PORT" "Whisper:$WHISPER_SERVICE_PORT"; do
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
    
    # Check external API port (informational only, not managed by this script)
    echo ""
    echo -e "${CYAN}External Services:${NC}"
    echo "─────────────────────────────────────────"
    if ! check_port "4000"; then
        echo -e "${GREEN}✓${NC} Port 4000 (External API) is available"
        local pid=$(lsof -ti:4000 2>/dev/null || echo "unknown")
        if [ "$pid" != "unknown" ]; then
            local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            echo "  Process: $process (PID: $pid)"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Port 4000 (External API) is NOT available"
        echo "  Note: This is an external service (not managed by this script)"
        echo "  Please ensure your OpenRouter API or local LLM server is running on port 4000"
    fi
    
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
    echo "  REAL_TTS_MODE         - Use real TTS instead of mock (default: true)"
    echo "  TTS_DEVICE            - TTS device (default: mps for macOS)"
    echo "  ENABLE_LOCAL_FALLBACK - Enable local fallback LLM (default: false)"
    echo "  FORCE_FREE_PORTS      - Force free busy ports (default: false)"
    echo "  LLM_API_ENDPOINT      - LLM API endpoint (default: http://localhost:4000)"
    echo ""
    echo "Important Notes (v5.0):"
    echo "  • ATLAS v5.0 runs in Pure MCP mode"
    echo "  • LLM API server should run on port 4000 (OpenRouter or local)"
    echo "  • MCP servers start automatically through orchestrator"
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
