# ATLAS - Adaptive Task and Learning Assistant System v4.0
## Modular Architecture Edition

## Швидкий старт

### Автоматична установка на macOS (рекомендовано):

```bash
# 1. Клонувати репозиторій
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4

# 2. Запустити автоматичну установку
chmod +x setup-macos.sh
./setup-macos.sh

# 3. Після завершення установки запустити систему
./restart_system.sh start
```

### Альтернативний спосіб (ручна установка):

```bash
# 1. Встановити всі залежності
make install

# 2. Запустити систему
make start

# або використовувати єдиний скрипт управління:
./restart_system.sh start
```

📖 **Детальна документація:** [docs/MACOS_DEPLOYMENT_GUIDE.md](docs/MACOS_DEPLOYMENT_GUIDE.md)

## 🎉 Нові можливості v4.0

- **🏗️ Модульна архітектура** - повністю рефакторений фронтенд та orchestrator
- **🔄 Єдина конфігурація** - `config/global-config.js` як єдине джерело істини
- **📦 ES6 модулі** - сучасна JavaScript архітектура
- **🎯 Event-based TTS** - синхронізація через реальні події, не таймери
- **🧬 GLB Living System v4.0** - жива 3D модель шолома з повною інтеграцією інтелекту
- **💬 Conversation Mode** - два режими спілкування (quick-send та живий діалог)
- **🧹 Очищена структура** - видалено дублювання та застарілі файли

## Системні вимоги

- macOS (Apple Silicon або Intel)
- Python 3.9+
- Node.js 16+
- Goose Desktop (рекомендовано) або Goose CLI

## Основні можливості

- **🎯 Єдине централізоване управління** - один скрипт для всієї системи
- **🖥️ Інтеграція з Goose Desktop** - використовує десктопну версію як сервер
- **🤖 3 інтелектуальних агенти**: Atlas (координатор), Тетяна (виконавець), Гриша (верифікатор)
- **💡 Автоматична обробка уточнень** - Atlas автоматично бере на себе управління при потребі уточнень
- **🔊 Реальний TTS** - підтримка українського Text-to-Speech з Metal acceleration
- **🎙️ Голосове управління** - Whisper Large-v3 для розпізнавання мовлення
- **💬 Два режими спілкування**:
  - **Quick-send** (одне натискання) - швидкі запитання
  - **Conversation** (утримання 2 сек) - живий діалог STT→TTS→STT
- **🧬 GLB Living System** - жива 3D модель шолома що реагує на всі події
- **📦 Централізоване управління залежностями**

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

### Змінні середовища

```bash
# Goose конфігурація
GOOSE_DESKTOP_PATH=/Applications/Goose.app/Contents/MacOS/goose
GOOSE_USE_DESKTOP=true      # Використовувати десктопну версію
GOOSE_SERVER_PORT=3000      # Порт для Goose сервера

# TTS конфігурація
REAL_TTS_MODE=true          # Реальний TTS замість mock
TTS_DEVICE=mps              # mps для Apple Silicon
TTS_PORT=3001               # Порт TTS сервера

# Додаткові налаштування
FORCE_FREE_PORTS=true       # Автоматично звільняти порти
```

## 🏗️ Архітектура

### Основні компоненти

- **Goose Desktop** (Port 3000) - Зовнішній AI інтерфейс через WebSocket
- **Node.js Orchestrator** (Port 5101) - Координація агентів та workflow
- **Python Frontend** (Port 5001) - Веб-інтерфейс Flask
- **TTS Service** (Port 3001) - Український Text-to-Speech сервіс
- **Whisper Service** (Port 3002) - Розпізнавання мовлення

### Multi-Agent Framework

Всі агенти працюють через Goose Engine з GitHub Copilot:

- **🧠 ATLAS Agent** (зелений) - Координатор, стратег, куратор завдань
- **💪 TETYANA Agent** (блакитний) - Основний виконавець завдань
- **🛡️ GRISHA Agent** (жовтий) - Верифікатор, контроль якості результатів

### Workflow етапи:
1. **Stage 1**: ATLAS - Початкова обробка (формалізація завдання)
2. **Stage 2**: TETYANA - Виконання завдання  
3. **Stage 3**: ATLAS - Уточнення (за потреби)
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
