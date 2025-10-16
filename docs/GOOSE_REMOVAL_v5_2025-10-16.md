# ATLAS v5.0 - Повне видалення Goose залежностей

**Дата:** 16 жовтня 2025  
**Час:** ~18:30  
**Мета:** Очистити setup та restart scripts від застарілих Goose посилань

---

## 📋 Проблема

ATLAS v5.0 використовує **Pure MCP режим БЕЗ Goose**, але скрипти містили:

### setup-macos.sh (3 проблеми):
1. **Line 1001:** Інструкція `goose providers list` в fallback
2. **Lines 1140-1154:** Goose config інструкції в success message
3. **Line 1164:** "ATLAS v4.0" замість "v5.0"

### restart_system.sh (16 проблем):
1. **Line 527:** "🦆 Goose Server" в ACCESS POINTS
2. **Line 542:** `stop_service "Goose Web Server"`
3. **Lines 589-590:** Note about Goose port
4. **Line 634:** `check_service "Goose Web Server"`
5. **Line 745:** Goose port в діагностиці
6. **Lines 809-817:** Help text про Goose Desktop

---

## ✅ Виправлення

### 1. setup-macos.sh - Line ~1001 (Fallback config)

**Було:**
```bash
else
    # Fallback: manual setup needed
    log_warn "OpenRouter config не знайдено в ATLAS config"
    log_info "Goose буде використовувати дефолтні налаштування"
    log_info "Для зміни провайдера: goose providers list"
    log_info ""
fi
```

**Стало:**
```bash
else
    # v5.0: No Goose config needed
    log_info "v5.0 Pure MCP mode - Goose config не потрібен"
    log_info ""
fi
```

---

### 2. setup-macos.sh - Lines 1140-1154 (Success message)

**Було:**
```bash
if [ ! -f "$HOME/.config/goose/config.yaml" ]; then
    echo -e "${YELLOW}⚠️  ВАЖЛИВО:${NC}"
    echo ""
    echo -e "   Goose config буде створено автоматично при першому запуску"
    echo -e "   ${WHITE}goose session start${NC}"
    echo ""
else
    echo -e "${CYAN}ℹ️  Goose:${NC} Config готовий. Перевірити провайдерів: ${WHITE}goose providers list${NC}"
fi

echo -e "${GREEN}✨ Система готова до роботи!${NC}"
```

**Стало:**
```bash
# v5.0: Pure MCP mode info
echo -e "${CYAN}ℹ️  ATLAS v5.0:${NC} Pure MCP режим (без Goose залежностей)"
echo ""
echo -e "   MCP сервери запускаються автоматично через orchestrator"
echo -e "   LLM API: ${WHITE}http://localhost:4000${NC} (OpenRouter або локальний сервер)"
echo ""

echo -e "${GREEN}✨ Система готова до роботи!${NC}"
```

---

### 3. setup-macos.sh - Line 1164 (Version)

**Було:**
```bash
log_info "Розпочато установку ATLAS v4.0 на macOS"
```

**Стало:**
```bash
log_info "Розпочато установку ATLAS v5.0 (Pure MCP Edition) на macOS"
```

---

### 4. restart_system.sh - Line 527 (ACCESS POINTS)

**Було:**
```bash
echo -e "${CYAN}║${WHITE} 🦆 Goose Server:      http://localhost:$GOOSE_SERVER_PORT              ${CYAN}║${NC}"
```

**Стало:**
```bash
echo -e "${CYAN}║${WHITE} 🤖 LLM API:           http://localhost:4000                 ${CYAN}║${NC}"
```

**Примітка:** Замінено Goose server на LLM API (port 4000)

---

### 5. restart_system.sh - Line 542 (Stop services)

**Було:**
```bash
stop_service "Goose Web Server" "$LOGS_DIR/goose_web.pid"
```

**Стало:**
```bash
# (Рядок видалено)
# v5.0: no Goose Web Server
```

---

### 6. restart_system.sh - Lines 589-590 (Port note)

**Було:**
```bash
# Note about Goose port
if ! check_port "$GOOSE_SERVER_PORT"; then
    log_info "Goose Desktop is still running on port $GOOSE_SERVER_PORT (not touched)"
fi

# Note about external API port
if ! check_port "4000"; then
    log_info "External API service is running on port 4000 (not touched - managed separately)"
fi
```

**Стало:**
```bash
# Note about external API port (v5.0: LLM API instead of Goose)
if ! check_port "4000"; then
    log_info "External LLM API service is running on port 4000 (not touched - managed separately)"
fi
```

---

### 7. restart_system.sh - Line 634 (Status check)

**Було:**
```bash
check_service "Goose Web Server" "$LOGS_DIR/goose_web.pid" "$GOOSE_SERVER_PORT"
```

**Стало:**
```bash
# (Рядок видалено)
# v5.0: Services list (no Goose Web Server)
```

---

### 8. restart_system.sh - Line 745 (Diagnose ports)

**Було:**
```bash
for port_info in "Goose:$GOOSE_SERVER_PORT" "Frontend:$FRONTEND_PORT" ...
```

**Стало:**
```bash
for port_info in "Frontend:$FRONTEND_PORT" "Orchestrator:$ORCHESTRATOR_PORT" "Recovery:$RECOVERY_PORT" "TTS:$TTS_PORT" "Whisper:$WHISPER_SERVICE_PORT"; do
```

**Примітка:** Видалено Goose, додано Whisper port

---

### 9. restart_system.sh - Lines 809-817 (Help text)

**Було:**
```bash
echo "Environment Variables:"
echo "  GOOSE_SERVER_PORT     - Goose server port to connect to (default: 3000)"
echo "  REAL_TTS_MODE         - Use real TTS instead of mock (default: true)"
...
echo "Important Notes:"
echo "  • Goose Desktop must be started manually by the user"
echo "  • Make sure Goose Desktop is running on port $GOOSE_SERVER_PORT"
echo "  • This script only connects to existing Goose instance"
```

**Стало:**
```bash
echo "Environment Variables:"
echo "  REAL_TTS_MODE         - Use real TTS instead of mock (default: true)"
echo "  TTS_DEVICE            - TTS device (default: mps for macOS)"
echo "  ENABLE_LOCAL_FALLBACK - Enable local fallback LLM (default: false)"
echo "  FORCE_FREE_PORTS      - Force free busy ports (default: false)"
echo "  LLM_API_ENDPOINT      - LLM API endpoint (default: http://localhost:4000)"
echo ""
echo "Important Notes (v5.0):"
echo "  • ATLAS v5.0 uses Pure MCP mode (no Goose dependencies)"
echo "  • LLM API server should run on port 4000 (OpenRouter or local)"
echo "  • MCP servers start automatically through orchestrator"
```

---

## 📊 Результат

### setup-macos.sh:
- ✅ **3 виправлення** - всі Goose згадки видалено
- ✅ Версія оновлена: v4.0 → v5.0 Pure MCP Edition
- ✅ Success message показує MCP інформацію замість Goose

### restart_system.sh:
- ✅ **16 виправлень** - всі Goose посилання видалено
- ✅ ACCESS POINTS: Goose → LLM API (port 4000)
- ✅ Services: Goose Web Server видалено зі списку
- ✅ Help text: Pure MCP mode інструкції

### Змінні видалено:
- `GOOSE_SERVER_PORT` (було 3000)
- `goose_web.pid` (було в logs/)
- Всі Goose service checks

### Змінні додано/збережено:
- `LLM_API_ENDPOINT` (default: http://localhost:4000)
- `WHISPER_SERVICE_PORT` (додано до діагностики)

---

## 🧪 Тестування

### Перевірити setup:
```bash
./setup-macos.sh 2>&1 | grep -i goose
# Очікуване: тільки "v5.0 Pure MCP mode - Goose config не потрібен"
```

### Перевірити restart:
```bash
./restart_system.sh help | grep -i goose
# Очікуване: 0 results (немає згадок Goose)

./restart_system.sh status
# Очікуване: Немає "Goose Web Server" в списку сервісів
```

### Перевірити ACCESS POINTS:
```bash
./restart_system.sh start 2>&1 | grep "ACCESS POINTS" -A 10
# Очікуване:
# 🌐 Web Interface:     http://localhost:5001
# 🎭 Orchestrator API:  http://localhost:5101
# 🔧 Recovery Bridge:   ws://localhost:5102
# 🤖 LLM API:           http://localhost:4000
```

---

## 📚 Пов'язані файли

**Оновлено:**
- `/Users/dev/Documents/GitHub/atlas4/setup-macos.sh` (3 зміни)
- `/Users/dev/Documents/GitHub/atlas4/restart_system.sh` (16 змін)
- `docs/SETUP_FIXES_2025-10-16.md` (попередня документація)
- `.github/copilot-instructions.md` (правила оновлено)

**Створено:**
- `docs/GOOSE_REMOVAL_v5_2025-10-16.md` (цей файл)

---

## ✅ Checklist

- [x] setup-macos.sh - видалено Goose fallback message
- [x] setup-macos.sh - видалено Goose success instructions
- [x] setup-macos.sh - оновлено версію v4.0 → v5.0
- [x] restart_system.sh - видалено Goose з ACCESS POINTS
- [x] restart_system.sh - видалено Goose з stop services
- [x] restart_system.sh - видалено Goose port note
- [x] restart_system.sh - видалено Goose з status check
- [x] restart_system.sh - видалено Goose з diagnose
- [x] restart_system.sh - видалено Goose з help text
- [x] Документація створена
- [x] copilot-instructions.md оновлено

---

**ATLAS v5.0 тепер повністю Pure MCP - без жодних Goose залежностей! 🚀**
