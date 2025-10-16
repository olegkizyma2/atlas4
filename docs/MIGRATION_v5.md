# ATLAS Migration Guide: v4.0 → v5.0

## Overview

ATLAS v5.0 представляє значні архітектурні зміни з переходом на Pure MCP режим. Цей документ описує всі зміни та кроки міграції.

## Основні зміни v5.0

### 🎯 Pure MCP Architecture
- **Видалено:** Goose integration та всі fallback механізми
- **Додано:** Direct MCP server connections (filesystem, playwright, shell, applescript, git, memory)
- **Результат:** -53% коду в executor (1428 → 675 LOC), швидша робота

### 🔧 Централізована конфігурація
- **Новий підхід:** Всі налаштування через `.env` файл
- **LLM API:** Підтримка primary та fallback endpoints
- **Mac M1 MAX:** Автоматичні оптимізації на базі детекції hardware

### 📦 Deprecated компоненти
- Goose Desktop integration
- Hybrid mode (goose/mcp)
- Goose-related scripts (setup_goose.sh, configure-goose.sh, goose-monitor)

## Кроки міграції

### 1. Backup поточної конфігурації

```bash
# Backup .env файлу якщо існує
cp .env .env.v4.backup

# Backup config.yaml
cp config/config.yaml config/config.yaml.v4.backup
```

### 2. Оновлення .env файлу

Створіть новий `.env` на базі `.env.example`:

```bash
cp .env.example .env
```

**Ключові зміни в .env:**

#### Додано нові змінні:
```bash
# LLM API Configuration (NEW in v5.0)
LLM_API_ENDPOINT=http://localhost:4000/v1/chat/completions
LLM_API_FALLBACK_ENDPOINT=https://your-ngrok-url.ngrok-free.app/v1/chat/completions
LLM_API_USE_FALLBACK=true
LLM_API_TIMEOUT=60000

# Mac Studio M1 MAX Optimizations (NEW)
OPTIMIZE_FOR_M1_MAX=true
WHISPER_SAMPLE_RATE=48000
```

#### Видалено/Deprecated:
```bash
# DEPRECATED (закоментовано в .env.example)
# GOOSE_BIN=...
# GOOSE_DESKTOP_PATH=...
# GOOSE_SERVER_PORT=...
# GOOSE_PORT=...
# GOOSE_DISABLE_KEYRING=...
# GITHUB_TOKEN=...
```

#### Змінено значення за замовчуванням:
```bash
# v4.0
AI_BACKEND_MODE=hybrid
AI_BACKEND_FALLBACK=goose

# v5.0
AI_BACKEND_MODE=mcp
AI_BACKEND_DISABLE_FALLBACK=false  # Pure MCP mode
```

### 3. Налаштування LLM API

v5.0 потребує зовнішній LLM API endpoint (localhost:4000 або remote).

#### Локальний API (рекомендовано):
```bash
LLM_API_ENDPOINT=http://localhost:4000/v1/chat/completions
```

#### Remote API (через ngrok):
```bash
LLM_API_ENDPOINT=http://localhost:4000/v1/chat/completions
LLM_API_FALLBACK_ENDPOINT=https://your-id.ngrok-free.app/v1/chat/completions
LLM_API_USE_FALLBACK=true
```

### 4. Перевірка залежностей

```bash
# Python 3.11 (REQUIRED)
python3 --version  # Має бути 3.11.x

# Node.js packages
cd orchestrator && npm install

# Python packages
cd web && source venv/bin/activate && pip install -r requirements.txt
```

### 5. Видалення застарілих компонентів (опціонально)

Goose-related файли вже перенесені в `archive/`:

```bash
archive/goose/           # Goose integration code
archive/scripts/         # Goose setup scripts
archive/legacy-prompts/  # Old prompts
```

### 6. Запуск системи

```bash
# Використовуючи оновлений restart_system.sh
./restart_system.sh start

# Або через Make
make start
```

### 7. Перевірка роботи

```bash
# Перевірити статус всіх сервісів
./restart_system.sh status

# Перевірити логи
./restart_system.sh logs

# Доступ до веб-інтерфейсу
open http://localhost:5001
```

## Troubleshooting

### Проблема: "LLM API not available"

**Рішення:**
1. Перевірте що LLM API працює на порту 4000
2. Або налаштуйте fallback endpoint через ngrok
3. Перевірте `LLM_API_USE_FALLBACK=true` в .env

### Проблема: "MCP server initialization timeout"

**Рішення:**
1. Перевірте інтернет-з'єднання (для npx downloads)
2. Збільште timeout в `config/global-config.js`
3. Перевірте логи: `tail -f logs/orchestrator.log`

### Проблема: "Whisper service failing"

**Рішення:**
1. Перевірте що Metal GPU доступний:
   ```bash
   python -c "import torch; print(torch.backends.mps.is_available())"
   ```
2. Якщо Metal недоступний, встановіть:
   ```bash
   WHISPER_DEVICE=cpu
   WHISPER_CPP_DISABLE_GPU=true
   ```

### Проблема: "Missing Goose Desktop"

**Пояснення:** v5.0 НЕ потребує Goose Desktop. Це нормально.

**Дії:** Просто видаліть або закоментуйте всі Goose-related змінні в .env

## Mac Studio M1 MAX Оптимізації

v5.0 автоматично визначає Mac Studio M1 MAX та застосовує оптимізації:

```bash
# Автоматично встановлюється при setup
WHISPER_CPP_THREADS=10           # 10 performance cores на M1 Max
WHISPER_CPP_NGL=20               # GPU layers для Metal
WHISPER_SAMPLE_RATE=48000        # High quality audio
TTS_DEVICE=mps                   # Metal Performance Shaders
OPTIMIZE_FOR_M1_MAX=true
```

## Різниці в архітектурі

### v4.0 Workflow:
```
User → Goose Desktop → WebSocket → Orchestrator → Agents
       ↓
       GitHub Copilot API
```

### v5.0 Workflow:
```
User → Orchestrator → MCP Dynamic TODO → Direct MCP Servers
       ↓
       LLM API (localhost:4000 or remote)
```

### v5.0 Переваги:
- ✅ Швидше (no WebSocket overhead)
- ✅ Простіше (fewer components)
- ✅ Надійніше (fewer failure points)
- ✅ Гранулярніше (item-by-item execution)
- ✅ Адаптивніше (dynamic TODO adjustment)

## Breaking Changes

### 1. Goose Integration видалено
- Немає більше Goose Desktop залежності
- Немає hybrid mode (goose/mcp)
- Всі старі Goose prompts deprecated

### 2. Config структура змінена
- `AI_BACKEND_CONFIG` тепер Pure MCP only
- `GOOSE_*` змінні deprecated
- `LLM_API_*` змінні додано

### 3. API Endpoints змінені
- Goose Server (port 3000) більше НЕ використовується
- LLM API (port 4000) тепер обов'язковий

## Rollback до v4.0

Якщо потрібно повернутись до v4.0:

```bash
# 1. Checkout v4.0 branch/tag
git checkout v4.0

# 2. Відновити backup конфігурації
cp .env.v4.backup .env
cp config/config.yaml.v4.backup config/config.yaml

# 3. Перезапустити систему
./restart_system.sh restart
```

## Підтримка

Якщо виникли проблеми з міграцією:

1. Перевірте `.github/copilot-instructions.md` для v5.0 специфікацій
2. Перегляньте `docs/` для детальної документації
3. Перевірте `archive/` для старих конфігурацій

## Контрольний список міграції

- [ ] Backup поточної конфігурації (.env, config.yaml)
- [ ] Створено новий .env з .env.example
- [ ] Налаштовано LLM_API_ENDPOINT
- [ ] Перевірено Python 3.11
- [ ] Перевірено Node.js packages
- [ ] Видалено/закоментовано GOOSE_* змінні
- [ ] Встановлено OPTIMIZE_FOR_M1_MAX=true (якщо Mac M1)
- [ ] Запущено ./restart_system.sh start
- [ ] Перевірено статус сервісів
- [ ] Протестовано базовий workflow

---

**Дата створення:** 16 жовтня 2025  
**Версія документу:** 1.0  
**Для ATLAS:** v4.0 → v5.0
