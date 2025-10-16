# Setup Script Fixes - 16.10.2025

## ✅ Виправлення застосовано

### 1. 📁 Структура проекту - .md файли переміщено в docs/

**Проблема:** .md файли знаходились у корені проекту

**Виправлено:**
```bash
# Переміщено з root/ в docs/:
REFACTORING_SUMMARY.md → docs/
MIGRATION_v5.md → docs/
MIGRATION.md → docs/
copilot.md → docs/

# Залишився в корені (правильно):
README.md ✅
```

**Результат:**
```
atlas4/
├── README.md                    # ✅ Головний файл (залишається в корені)
├── docs/
│   ├── REFACTORING_SUMMARY.md  # ✅ Перенесено
│   ├── MIGRATION_v5.md         # ✅ Перенесено
│   ├── MIGRATION.md            # ✅ Перенесено
│   └── copilot.md              # ✅ Перенесено
```

---

### 2. ❌ Goose перевірка видалена зі setup-macos.sh

**Проблема:** Setup перевіряв наявність Goose і показував ERROR, 
хоча Goose deprecated в v5.0

**Було:**
```bash
# Goose
if [ -n "$GOOSE_BIN" ] && [ -x "$GOOSE_BIN" ]; then
    log_success "Goose: доступний"
else
    log_error "Goose не встановлено"  # ❌ ERROR який не має бути
    all_ok=false
fi
```

**Стало:**
```bash
# Goose - DEPRECATED в v5.0 (Pure MCP mode)
# Goose integration видалено з ATLAS v5.0
log_info "Goose: не потрібен (v5.0 Pure MCP mode)"
```

**Результат:**
- ✅ Немає помилок про відсутність Goose
- ✅ Чітке повідомлення що Goose deprecated
- ✅ Setup завершується без помилок

**Файл:** `setup-macos.sh` (lines ~1030-1037)

---

### 3. 🔄 Restart System Behavior - Правильна логіка

**Питання:** Чи перезапустить систему при `./restart_system.sh start` 
якщо вона вже запущена?

**Відповідь:** **НІ**, `start` НЕ перезапускає автоматично.

**Логіка команд:**

#### `./restart_system.sh start`
```bash
cmd_start() {
    # 1. Створює директорії
    init_directories
    
    # 2. Запускає сервіси
    start_tts_service
    start_whisper_service
    start_orchestrator
    start_frontend
    start_recovery_bridge
    start_fallback_llm
    
    # 3. Перевіряє статус
    cmd_status
}
```
**Поведінка:** Якщо сервіси вже запущені - спробує запустити ще раз
(може бути конфлікт портів)

#### `./restart_system.sh restart`
```bash
cmd_restart() {
    cmd_stop          # 1. Зупиняє ВСІ сервіси
    sleep 5           # 2. Чекає 5 секунд
    cmd_start         # 3. Запускає заново
}
```
**Поведінка:** Гарантовано перезапускає - спочатку зупиняє, потім запускає

#### `./restart_system.sh stop`
```bash
cmd_stop() {
    # Зупиняє всі сервіси по PID files
    stop_service "Recovery Bridge" "$LOGS_DIR/recovery.pid"
    stop_service "Frontend" "$LOGS_DIR/frontend.pid"
    stop_service "Orchestrator" "$LOGS_DIR/orchestrator.pid"
    stop_service "Whisper Service" "$LOGS_DIR/whisper.pid"
    stop_service "TTS Service" "$LOGS_DIR/tts.pid"
    # ... решта сервісів
}
```

---

### 📋 Рекомендації використання

#### ✅ Правильний workflow:

**Перший запуск:**
```bash
./restart_system.sh start
```

**Якщо система вже запущена і треба перезапустити:**
```bash
./restart_system.sh restart  # ✅ Правильно
```

**АБО окремо:**
```bash
./restart_system.sh stop     # Зупинити
# Зміни в коді...
./restart_system.sh start    # Запустити заново
```

**Перевірка статусу:**
```bash
./restart_system.sh status
```

**Логи:**
```bash
./restart_system.sh logs              # Всі логи
./restart_system.sh logs orchestrator # Конкретний сервіс
```

#### ❌ Не рекомендується:

```bash
# Якщо система вже запущена:
./restart_system.sh start  # ❌ Може бути конфлікт портів

# Натомість:
./restart_system.sh restart  # ✅ Правильно
```

---

### 🎯 Підсумок змін

| Зміна                | Статус       | Файл              |
| -------------------- | ------------ | ----------------- |
| .md файли в docs/    | ✅ Виправлено | root → docs/      |
| Goose ERROR видалено | ✅ Виправлено | setup-macos.sh    |
| Restart логіка       | ✅ Перевірено | restart_system.sh |

**Всі зміни застосовано успішно!** ✨

---

## 📚 Додаткова інформація

### Структура команд restart_system.sh:

```
restart_system.sh
├── start      → Запустити (без зупинки)
├── stop       → Зупинити все
├── restart    → Зупинити + Запустити
├── status     → Показати статус
├── logs       → Переглянути логи
├── clean      → Очистити старі логи
├── diagnose   → Діагностика системи
└── help       → Допомога
```

### Environment Variables:

```bash
REAL_TTS_MODE=true              # Використовувати Ukrainian TTS
TTS_DEVICE=mps                  # Metal GPU для TTS
WHISPER_DEVICE=metal            # Metal GPU для Whisper
USE_METAL_GPU=true              # Metal GPU acceleration
OPTIMIZE_FOR_M1_MAX=true        # M1 Max оптимізації
FORCE_FREE_PORTS=false          # Примусово звільняти порти
```

---

**Дата:** 16 жовтня 2025 р.  
**Версія:** ATLAS v5.0 Pure MCP Edition
