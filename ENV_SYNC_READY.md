# 📋 ENV Configuration - Ready for Local Machine

**Дата:** 13 жовтня 2025, 21:30  
**Статус:** ✅ ГОТОВО ДЛЯ КОПІЮВАННЯ

---

## 🎯 Що зроблено

### ✅ Синхронізовано 3 файли:

1. **`.env`** - робочий файл (gitignored)
2. **`.env.example`** - template для репозиторію
3. **`.env.local.ready`** - готовий файл для локальної машини

---

## 📂 Файл для копіювання на локальну машину

**Файл:** `.env.local.ready`

Скопіюй цей файл на локальну машину:
```bash
# На Mac Studio M1 MAX:
cp .env.local.ready .env

# Або вручну скопіюй вміст в .env
```

---

## 🔧 Ключові зміни

### 1. ✅ MCP налаштовано як Primary Backend
```bash
AI_BACKEND_MODE=mcp              # MCP режим увімкнено
AI_BACKEND_PRIMARY=mcp           # MCP як основний backend
AI_BACKEND_FALLBACK=goose        # Goose як резервний
```

### 2. ✅ Fallback увімкнено (Safe Mode)
```bash
AI_BACKEND_DISABLE_FALLBACK=false  # Fallback на Goose при помилках
```

**Чому false?**
- ✅ Максимальна надійність
- ✅ При помилках MCP → автоматично Goose
- ✅ Система завжди працює

### 3. ✅ Всі шляхи налаштовані
```bash
GOOSE_BIN=/Applications/Goose.app/Contents/MacOS/goose
WHISPER_CPP_BIN=/Users/dev/Documents/GitHub/atlas4/third_party/whisper.cpp.upstream/build/bin/whisper-cli
WHISPER_CPP_MODEL=/Users/dev/Documents/GitHub/atlas4/models/whisper/ggml-large-v3.bin
```

### 4. ✅ Metal GPU оптимізація
```bash
USE_METAL_GPU=true               # Metal увімкнено
TTS_DEVICE=mps                   # TTS через Metal
WHISPER_DEVICE=metal             # Whisper через Metal
WHISPER_CPP_NGL=20              # 20 шарів на GPU
WHISPER_CPP_DISABLE_GPU=false   # GPU НЕ вимкнено
```

### 5. ✅ Додані нові змінні
```bash
FORCE_FREE_PORTS=true           # Автоматично звільняти порти
GOOSE_DISABLE_KEYRING=1         # Вимкнути keyring для Goose
BUILD_NUMBER=dev                # Build version
LOG_LEVEL=info                  # Logging level
```

---

## 🚀 Як використовувати

### Крок 1: Скопіюй файл на локальну машину
```bash
cd /Users/dev/Documents/GitHub/atlas4
cp .env.local.ready .env
```

### Крок 2: Додай GitHub Token
```bash
nano .env
# Знайти: GITHUB_TOKEN=your_github_token_here
# Замінити на свій токен: GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### Крок 3: Перевір конфігурацію
```bash
# Перевірити що .env завантажується
grep AI_BACKEND_MODE .env
# Має показати: AI_BACKEND_MODE=mcp
```

### Крок 4: Запустити систему
```bash
./restart_system.sh restart
```

### Крок 5: Перевірити логи
```bash
tail -f logs/orchestrator.log | grep "Configured mode"
# Має показати: [STAGE-0.5] Configured mode: mcp
```

---

## 🧪 Режими тестування

### Production Mode (Safe) - ПОТОЧНИЙ
```bash
AI_BACKEND_MODE=mcp
AI_BACKEND_DISABLE_FALLBACK=false
```
- ✅ MCP як primary
- ✅ Fallback на Goose при помилках
- 🛡️ Максимальна надійність

### Development Mode (Strict)
```bash
AI_BACKEND_MODE=mcp
AI_BACKEND_DISABLE_FALLBACK=true
```
- ✅ MCP як primary
- ❌ NO fallback при помилках
- 🔍 Для знаходження багів

### Hybrid Mode (Smart)
```bash
AI_BACKEND_MODE=hybrid
AI_BACKEND_DISABLE_FALLBACK=false
```
- 🤖 Автоматичний вибір backend
- ✅ Fallback на Goose
- ⚡ Оптимальна продуктивність

---

## 📊 Порівняння з попереднім .env

| Параметр | Було | Стало | Зміна |
|----------|------|-------|-------|
| `AI_BACKEND_MODE` | mcp | mcp | ✅ Без змін |
| `AI_BACKEND_PRIMARY` | mcp | mcp | ✅ Без змін |
| `AI_BACKEND_FALLBACK` | - | goose | ✅ Додано |
| `AI_BACKEND_DISABLE_FALLBACK` | - | false | ✅ Додано (NEW!) |
| `GOOSE_BIN` | ✅ | ✅ | ✅ Без змін |
| `GOOSE_DESKTOP_PATH` | - | ✅ | ✅ Додано (алиас) |
| `GOOSE_DISABLE_KEYRING` | 1 | 1 | ✅ Без змін |
| `WHISPER_CPP_THREADS` | 10 | 10 | ✅ Без змін |
| `FORCE_FREE_PORTS` | true | true | ✅ Без змін |
| `USE_METAL_GPU` | true | true | ✅ Без змін |

**Додано нових змінних:** 3  
**Змінено існуючих:** 0  
**Видалено:** 0

---

## ⚠️ Важливо!

### 1. GitHub Token
```bash
# НЕ забудь замінити!
GITHUB_TOKEN=your_github_token_here  # ❌ Замінити на свій
```

### 2. Шляхи
Всі шляхи налаштовані для:
```bash
/Users/dev/Documents/GitHub/atlas4
```

Якщо проект в іншій локації → оновити шляхи!

### 3. Fallback
```bash
AI_BACKEND_DISABLE_FALLBACK=false  # РЕКОМЕНДОВАНО для production
```

Змінюй на `true` ТІЛЬКИ для тестування!

---

## 🔍 Перевірка після запуску

### 1. Перевірити ENV завантаження
```bash
tail -f logs/orchestrator.log | grep "Configured mode"
# Очікуване: [STAGE-0.5] Configured mode: mcp
```

### 2. Перевірити Backend Selection
```bash
tail -f logs/orchestrator.log | grep "Backend selected"
# Очікуване: Backend selected: mcp
```

### 3. Перевірити MCP Workflow
```bash
tail -f logs/orchestrator.log | grep "MCP Dynamic TODO"
# Очікуване: Routing to MCP Dynamic TODO Workflow
```

### 4. Перевірити Fallback Status
```bash
tail -f logs/orchestrator.log | grep "fallback"
# Якщо fallback=false → має бути: "fallbackDisabled: false"
```

---

## 🚨 Troubleshooting

### ENV не завантажується
```bash
# Перевірити що .env існує
ls -la .env

# Перевірити формат
cat .env | grep AI_BACKEND_MODE

# Restart orchestrator
./restart_system.sh restart
```

### MCP не запускається
```bash
# Перевірити логи
tail -50 logs/orchestrator.log

# Перевірити що MCP сервери встановлені
npm list -g | grep @modelcontextprotocol
```

### Fallback не працює
```bash
# Перевірити змінну
echo $AI_BACKEND_DISABLE_FALLBACK
# Має бути: false або пусто

# Перевірити в конфігурації
grep disableFallback config/global-config.js
```

---

## 📚 Документація

- **Детальний опис:** `docs/MCP_FALLBACK_DISABLE_FIX_2025-10-13.md`
- **Quick Start:** `MCP_QUICK_START.md`
- **Workflow:** `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md`

---

**Готово до копіювання на локальну машину!** 🚀

Файл: `.env.local.ready`
