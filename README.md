# ATLAS - Adaptive Task and Learning Assistant System v5.0
## MCP Dynamic TODO Edition

**ATLAS v5.0** - система оркестрації з MCP Dynamic TODO workflow, українською TTS/STT, та 3D GLB інтерфейсом.

## 🎉 Нові можливості v5.0

- **🎯 MCP Dynamic TODO Workflow** - єдина система виконання завдань
- **🔄 Прямі MCP сервери** - filesystem, playwright, shell, applescript
- **📦 Спрощена архітектура** - видалено Goose fallback
- **🧹 Чистий код** - 53% менше коду в executor (1428 → 675 lines)
- **⚡ Швидша робота** - без WebSocket overhead
- **🔧 Item-by-item виконання** - гранулярний контроль та recovery

## Системні вимоги

- macOS (Apple Silicon або Intel)
- Python 3.11+ (REQUIRED)
- Node.js 16+
- Metal GPU для Whisper та TTS (рекомендовано)

## Основні можливості

- **🤖 3 інтелектуальних агенти**: 
  - **Atlas** - створює динамічні TODO плани
  - **Тетяна** - виконує завдання через MCP tools
  - **Гриша** - перевіряє виконання кожного пункту
- **🔊 Реальний TTS** - українське озвучування з Metal acceleration
- **🎙️ Голосове управління** - Whisper Large-v3 для розпізнавання мовлення
- **🧬 GLB Living System** - жива 3D модель шолома
- **📦 MCP Tools**: filesystem (14), playwright (32), shell (9), applescript (1), git (27), memory (9)

## 🛠️ Управління системою

### Команди Make

```bash
make help         # Показати всі команди
make install      # Встановити залежності
make setup        # Початкове налаштування
make start        # Запустити систему
make stop         # Зупинити систему
make restart      # Перезапустити систему
make status       # Перевірити статус
make logs         # Переглядати логи
make clean        # Очистити логи
make test         # Запустити тести
```

### Універсальний скрипт управління

```bash
./restart_system.sh start    # Запустити систему
./restart_system.sh stop     # Зупинити систему
./restart_system.sh restart  # Перезапустити
./restart_system.sh status   # Статус сервісів
./restart_system.sh logs     # Переглядати логи
./restart_system.sh clean    # Очистити логи
./restart_system.sh help     # Довідка
```

### Змінні середовища (.env)

Скопіюйте `.env.example` до `.env` та налаштуйте:

```bash
# === LLM API CONFIGURATION ===
LLM_API_ENDPOINT=http://localhost:4000/v1/chat/completions
LLM_API_FALLBACK_ENDPOINT=https://your-ngrok-url.ngrok-free.app/v1/chat/completions
LLM_API_USE_FALLBACK=true

# === AI BACKEND ===
AI_BACKEND_MODE=mcp              # Pure MCP mode (v5.0)

# === TTS & VOICE ===
REAL_TTS_MODE=true
TTS_DEVICE=mps                   # Metal GPU для Apple Silicon
TTS_PORT=3001

# === WHISPER ===
WHISPER_BACKEND=cpp
WHISPER_DEVICE=metal             # Metal GPU acceleration
WHISPER_PORT=3002
WHISPER_SAMPLE_RATE=48000        # High quality audio

# === MAC STUDIO M1 MAX OPTIMIZATIONS ===
USE_METAL_GPU=true
OPTIMIZE_FOR_M1_MAX=true
WHISPER_CPP_THREADS=10           # M1 Max performance cores
WHISPER_CPP_NGL=20               # GPU layers

# === PORTS ===
ORCHESTRATOR_PORT=5101
WEB_PORT=5001
FRONTEND_PORT=5001
```

## 🏗️ Архітектура

### Основні компоненти (v5.0)

- **Node.js Orchestrator** (Port 5101) - Координація агентів та MCP workflow
- **Python Frontend** (Port 5001) - Веб-інтерфейс Flask
- **TTS Service** (Port 3001) - Український Text-to-Speech сервіс (Metal GPU)
- **Whisper Service** (Port 3002) - Розпізнавання мовлення (Metal GPU)
- **LLM API** (Port 4000) - Зовнішній API для моделей (localhost або ngrok)
- **MCP Servers** - Direct MCP tools (filesystem, playwright, shell, applescript, git, memory)

### Multi-Agent Framework (Pure MCP)

Система використовує MCP Dynamic TODO Workflow:

- **🧠 ATLAS Agent** (зелений) - Створює TODO плани з item-by-item розбивкою
- **💪 TETYANA Agent** (блакитний) - Виконує кожен пункт через MCP tools
- **🛡️ GRISHA Agent** (жовтий) - Перевіряє виконання кожного item окремо

### MCP Workflow етапи:
1. **Stage 0**: Mode Selection (chat vs task)
2. **Stage 1-MCP**: ATLAS - TODO Planning (створює динамічний план)
3. **Stage 2.1-MCP**: TETYANA - Plan Tools (підбирає MCP tools)
4. **Stage 2.2-MCP**: TETYANA - Execute Tools (виконує через MCP)
5. **Stage 2.3-MCP**: GRISHA - Verify Item (перевіряє окремий item)
6. **Stage 3-MCP**: ATLAS - Adjust TODO (коригує при failing)
7. **Stage 8-MCP**: Final Summary (загальний результат)
4. **Stage 4**: TETYANA - Повторне виконання з уточненнями
5. **Stage 5**: GRISHA - Діагностика (якщо блокування)
6. **Stage 6**: ATLAS - Корекція завдання  
7. **Stage 7**: GRISHA - Верифікація результатів ✅
8. **Stage 8**: SYSTEM - Завершення workflow
9. **Stage 9**: ATLAS - Новий цикл (якщо потрібно)

## 🎯 Ключові особливості

### Система без fallback механізмів:
- **Живі промпти** - система працює виключно через Goose Desktop
- **Контекст-орієнтована архітектура** - 10 повідомлень історії в chat mode, 5 в task mode
- **Виявлення проблем** - при помилках генеруються exceptions, не маскуються fallback відповідями
- **WebSocket інтеграція** - стабільне з'єднання з Goose через WebSocket

### Ukrainian TTS система:
- **Множинні голоси**: dmytro, tetiana, mykyta, oleksa
- **Реальний синтез мовлення** - не mock-режим
- **Голосова система агентів** - кожен агент має свій голос
- **Apple Silicon оптимізація** - MPS device для нейронних мереж

### Централізоване управління:
- **restart_system.sh** - єдиний скрипт для всієї системи
- **config/global-config.js** - головний конфігураційний файл (єдине джерело істини)
- **Модульні конфіги** - agents-config.js, workflow-config.js, api-config.js
- **Автоматична діагностика** - вбудована система перевірок

## 🚀 Швидкий старт

### Передумови

- macOS (Apple Silicon або Intel)
- Python 3.9+
- Node.js 16+
- Goose Desktop або Goose CLI

### Установка

1. **Встановити залежності**
```bash
./install.sh
```

2. **Налаштувати Goose** (за потреби)
```bash
/opt/homebrew/bin/goose configure
```

3. **Запустити систему**
```bash
./restart_system.sh start
```

### Доступ до системи
- **Веб-інтерфейс**: http://localhost:5001
- **Goose Desktop**: http://localhost:3000  
- **Orchestrator API**: http://localhost:5101
- **TTS Service**: http://localhost:3001
- **Whisper Service**: http://localhost:3002

### 💬 Голосове спілкування

Після запуску системи відкрийте веб-інтерфейс та використовуйте кнопку мікрофону 🔵:

**Quick-send (швидке повідомлення):**
1. Натисніть кнопку 🔵 **один раз**
2. Говоріть (макс. 30 секунд)
3. Повідомлення автоматично відправиться

**Conversation (живий діалог):**
1. **Утримуйте** кнопку 🔵 протягом **2 секунд**
2. Дочекайтеся зеленого світла 🟢
3. Скажіть **"Атлас"**
4. Почніть діалог - система автоматично підтримує розмову

Детальна інструкція: [`docs/CONVERSATION_MODE_QUICK_GUIDE.md`](docs/CONVERSATION_MODE_QUICK_GUIDE.md)

### Конфігурація

Вся конфігурація системи централізована в `config/global-config.js`. Система підтримує:

- Конфігурацію агентів та їх ролей (`config/agents-config.js`)
- Workflow параметри та таймаути (`config/workflow-config.js`)
- API endpoints та мережеві налаштування (`config/api-config.js`)
- TTS налаштування з підтримкою українських голосів
- **AI Model конфігурація (NEW v4.0)** - централізоване управління моделями для system stages
  - 58+ доступних моделей (OpenAI GPT-4/5, DeepSeek, Claude, Cohere)
  - Різні моделі для різних типів завдань (classification, chat, analysis, tts_optimization)
  - Детальна документація: [`docs/AI_MODEL_CONFIG_2025-10-10.md`](docs/AI_MODEL_CONFIG_2025-10-10.md)

## 📁 Структура проекту

```
atlas4/
├── restart_system.sh          # 🎛️ Головний скрипт управління
├── README.md                  # 📖 Документація проекту
├── install.sh                 # 📦 Скрипт установки
├── web/                       # 🌐 Flask веб-інтерфейс
│   └── static/js/             # 📦 Модульний JavaScript
│       ├── core/              # 🔧 Основні модулі (logger, config, api-client)
│       ├── modules/           # 📱 Функціональні модулі (chat, tts)
│       ├── app-refactored.js  # 🚀 Головний додаток
│       └── _unused/           # 🗃️ Застарілі файли
├── orchestrator/              # 🎭 Node.js управління агентами (модульна архітектура)
│   ├── agents/                # 🤖 Клієнти агентів
│   ├── ai/                    # 🧠 AI модулі
│   ├── utils/                 # 🛠️ Утиліти
│   └── workflow/              # 🔄 Workflow логіка
├── config/                    # ⚙️ Централізована система конфігурації
│   ├── global-config.js       # 🔧 Головний конфіг (єдине джерело)
│   ├── agents-config.js       # 🤖 Конфігурація агентів
│   ├── workflow-config.js     # 🔄 Конфігурація workflow
│   └── api-config.js          # 🌐 API endpoints
├── prompts/                   # 🧠 Промпти агентів
├── ukrainian-tts/             # 🔊 TTS система
├── docs/                      # 📚 Документація системи
├── scripts/                   # 🛠️ Допоміжні скрипти
├── logs/                      # 📝 Логування системи
└── unused_files/              # 🗃️ Архів старих файлів
```

### Ключові файли

- `restart_system.sh` - Управління всією системою
- `config/global-config.js` - Головна конфігурація (єдине джерело істини)
- `config/agents-config.js` - Конфігурація агентів
- `config/workflow-config.js` - Конфігурація workflow
- `requirements.txt` - Python залежності
- `orchestrator/server.js` - Координація агентів (модульна архітектура)
- `web/atlas_server.py` - Веб-інтерфейс
- `web/static/js/app-refactored.js` - Модульний фронтенд
- `ukrainian-tts/tts_server.py` - TTS сервер

### Документація

Вся детальна документація знаходиться в папці [`docs/`](docs/):
- Архітектура системи
- Технічні специфікації  
- Звіти про рефакторинг
- Історія змін

## 📊 Моніторинг та діагностика

### Статус системи

```bash
./restart_system.sh status    # Статус всіх сервісів
./restart_system.sh diagnose  # Повна діагностика
./restart_system.sh logs      # Перегляд логів
```

### Логування

Система веде детальні логи всіх компонентів:

- `logs/orchestrator.log` - Логи оркестратора та workflow
- `logs/frontend.log` - Логи веб-інтерфейсу
- `logs/goose_web.log` - Логи Goose сервера
- `logs/tts.log` - Логи TTS системи
- `logs/recovery_bridge.log` - Логи мостового сервісу

### Команди діагностики

```bash
# Повна діагностика
./restart_system.sh diagnose

# Перевірка конфігурації Goose
./check_goose_config.sh

# Переконфігурація Goose (за потреби)
/opt/homebrew/bin/goose configure

# Очищення логів
./restart_system.sh clean
```

## 🔧 Підтримка та налагодження

### Відомі проблеми та рішення:

1. **Goose WebSocket timeout** - збільшено до 120 секунд
2. **Token limit exceeded** - автоматичне обрізання до 2000 символів  
3. **Authentication issues** - потрібна переавторизація GitHub
4. **Port conflicts** - автоматичне звільнення зайнятих портів

### Для вирішення проблем:

1. Перевірте статус системи: `./restart_system.sh status`
2. Запустіть діагностику: `./restart_system.sh diagnose` 
3. Перегляньте логи: `./restart_system.sh logs`
4. Перезапустіть систему: `./restart_system.sh restart`

## 🧪 Тестування та валідація

### Перевірка промптів і workflow:
```bash
# Швидка валідація всієї системи промптів
./scripts/validate-prompts.sh

# Детальна перевірка структури
node scripts/audit-prompts.js

# Аналіз якості промптів
node scripts/analyze-prompts-quality.js

# Комплексні тести (21 тест)
bash tests/test-all-prompts.sh
```

### Функціональні тести:
```bash
# Тест контексту та пам'яті
./tests/test-context.sh

# Тест mode selection (chat vs task)
./tests/test-mode-selection.sh

# Перевірка всіх виправлень
./verify-fixes.sh
```

### Статус системи промптів:
- ✅ **21/21 тестів** проходять
- ✅ **92% якості** промптів
- ✅ **13 стейджів** повністю покриті
- 📄 Детальний звіт: `docs/PROMPTS_WORKFLOW_AUDIT_REPORT.md`

## 📚 Документація

### Основна документація
- **README.md** (цей файл) - загальна інформація та швидкий старт

### Детальна документація (в docs/)

**Context & Memory System:**
- `docs/CONTEXT_FIX_SUMMARY.md` - короткий огляд виправлень системи контексту (10 жовтня 2025)
- `docs/CONTEXT_SYSTEM_FIX_REPORT.md` - детальний звіт про виправлення контексту та пам'яті
- `docs/CONTEXT_MEMORY_PROBLEM_ANALYSIS.md` - глибокий аналіз проблеми
- `docs/REFACTORING_CONTEXT_FALLBACK_REPORT.md` - детальний звіт про рефакторинг

**Тестування:**
- `docs/TESTING_INSTRUCTIONS.md` - інструкції для тестування системи
- `tests/test-context.sh` - автоматичний тест збереження контексту розмови

**Архітектура:**
- `docs/ATLAS_SYSTEM_ARCHITECTURE.md` - детальна архітектура системи
- `docs/TECHNICAL_SPECIFICATION.md` - технічна специфікація
- `docs/ATLAS_3D_LIVING_SYSTEM.md` - документація 3D системи шолома

**Додатково:**
- `docs/DOCUMENTATION_CLEANUP_REPORT.md` - звіт про очищення документації
- `docs/VERSION_UPDATE_TO_4.0_REPORT.md` - звіт про оновлення до v4.0
- `docs/PROMPTS_WORKFLOW_AUDIT_REPORT.md` - аудит системи промптів і workflow (10 жовтня 2025)

## License

This project is licensed under MIT License - see LICENSE file for details.

---

*ATLAS v4.0 - Adaptive Task and Learning Assistant System with Ukrainian TTS*
