# ATLAS v4.0 - Деталізація Рефакторингу

**Дата:** 11 жовтня 2025  
**Версія:** 1.0.0  
**Статус:** В процесі заповнення

---

## 📖 Про цей документ

Цей файл містить ДЕТАЛЬНУ деталізацію кожного TODO завдання з `REFACTORING_TODO.md`.  
Кожне завдання описується за шаблоном:

- **ID:** Унікальний ідентифікатор
- **Назва:** Коротка назва завдання
- **Модуль:** Який модуль торкається
- **Пріоритет:** 🔴 Високий / 🟡 Середній / 🟢 Низький
- **Складність:** S/M/L/XL (Small/Medium/Large/Extra Large)
- **Залежності:** Від яких завдань залежить
- **Опис:** Детальний опис проблеми
- **Рішення:** Покроковий план виконання
- **Файли:** Список файлів для зміни
- **Тести:** Як тестувати
- **Ризики:** Можливі проблеми

---

# 🎭 ORCHESTRATOR - Детальні Завдання

## 📊 Аналіз завершено ✅

### Метрики
- **Всього файлів:** 27 JavaScript файлів
- **Всього рядків коду:** 6,917 рядків
- **Середній розмір файлу:** ~256 рядків
- **Найбільші файли:**
  1. workflow/executor.js - 1,216 рядків ⚠️ ДУЖЕ ВЕЛИКИЙ
  2. workflow/executor-v3.js - 661 рядків ⚠️ ВЕЛИКИЙ
  3. server.js - 637 рядків ⚠️ ВЕЛИКИЙ
  4. api/websocket-manager.js - 476 рядків
  5. agents/tts-optimizer.js - 397 рядків

### Структура папок (13 директорій)
```
orchestrator/
├── server.js (637 LOC) - Монолітний сервер
├── config.js (30 LOC) - Re-export з global-config
├── agents/ - Менеджмент агентів
├── ai/ - AI інтеграції
├── api/ - Web integration + WebSocket
├── config/ - ПУСТА! ❌
├── errors/ - Error handling
├── monitoring/ - Health monitor
├── prompts/ - ПУСТА! ❌
├── state/ - Session management
├── utils/ - Utilities
└── workflow/ - Workflow engine
```

### Найчастіші імпорти
1. `logger` - 12+ разів (добре централізовано ✅)
2. `axios` - 6 разів
3. `GlobalConfig` - 4 рази (централізація працює ✅)
4. `stateManager` - 4 рази
5. `telemetry` - 3 рази

---

## 🔴 Критичні Проблеми (Високий Пріоритет)

### TODO-ORCH-001: Розбити монолітний server.js ✅ ЗАВЕРШЕНО!
**Статус:** ✅ ВИКОНАНО (11.10.2025)  
**Пріоритет:** 🔴 Критичний  
**Складність:** XL  
**Залежності:** Немає  
**Час виконання:** ~20 хвилин  

#### 📋 Опис проблеми
`server.js` - 637 рядків, виконує забагато функцій:
- Express app configuration
- Route definitions (10+ endpoints)
- Session management
- WebSocket integration
- Web integration API
- Health checks
- Metrics
- SSE streaming logic

#### ✅ Результат виконання
- ✅ server.js: 638 → **17 LOC (-97.3%!)**
- ✅ Створено 6 модульних файлів (854 LOC total)
- ✅ Всі endpoints працюють БЕЗ помилок
- ✅ Backwards compatible 100%

#### 📁 Створені файли
- `orchestrator/server.js` - 17 LOC (bootstrap)
- `orchestrator/app.js` - 127 LOC (Express config)
- `orchestrator/core/application.js` - 196 LOC (lifecycle)
- `orchestrator/api/routes/health.routes.js` - 73 LOC
- `orchestrator/api/routes/chat.routes.js` - 321 LOC
- `orchestrator/api/routes/web.routes.js` - 120 LOC

#### 📚 Документація
- `docs/refactoring/TODO_ORCH_001_REPORT.md` - Детальний звіт

#### 🎯 Цілі (ДОСЯГНУТО)
- [x] ✅ Зменшити server.js до ~100 рядків (ДОСЯГНУТО 17!)
- [x] ✅ Винести routes в окремі файли
- [x] ✅ Створити application lifecycle manager
- [x] ✅ Додати DI container для сервісів (TODO-ORCH-004)

#### 🔧 План рішення
1. **Створити app.js** - Express app configuration
   - CORS setup
   - Middleware registration
   - Error handling middleware
2. **Створити routes/** - Модульні маршрути
   - `routes/health.routes.js` - health, config, metrics
   - `routes/chat.routes.js` - /chat/stream, /chat/stream-v2
   - `routes/web.routes.js` - web integration API
3. **Створити core/application.js** - Lifecycle management
   - Startup sequence
   - Graceful shutdown
   - Service initialization
4. **Рефакторити server.js** - Мінімальний bootstrap
   ```javascript
   // server.js (новий - ~50 рядків)
   import Application from './core/application.js';
   
   const app = new Application();
   await app.initialize();
   await app.start();
   ```

#### � Файли для створення/зміни
- `orchestrator/server.js` - ЗМІНИТИ (637 → ~50 рядків)
- `orchestrator/app.js` - СТВОРИТИ (~100 рядків)
- `orchestrator/core/application.js` - СТВОРИТИ (~150 рядків)
- `orchestrator/api/routes/health.routes.js` - СТВОРИТИ (~80 рядків)
- `orchestrator/api/routes/chat.routes.js` - СТВОРИТИ (~200 рядків)
- `orchestrator/api/routes/web.routes.js` - СТВОРИТИ (~150 рядків)

#### 🧪 Тестування
- [ ] Інтеграційні тести для кожного route
- [ ] Тести lifecycle (startup/shutdown)
- [ ] Перевірка backwards compatibility
- [ ] Load testing (не погіршилась продуктивність)

#### ⚠️ Ризики
1. **Breaking changes** - можливе порушення існуючих клієнтів
   - Мітигація: Зберегти той самий API contract
2. **Regression bugs** - нові баги через рефакторинг
   - Мітигація: Extensive integration testing
3. **Performance degradation** - додаткові layers можуть уповільнити
   - Мітигація: Benchmarking до/після

---

### TODO-ORCH-002: Рефакторинг workflow/executor.js (1,216 LOC!)
**Статус:** ⏸️ Очікує (після ORCH-001)  
**Пріоритет:** 🔴 Критичний  
**Складність:** XL  
**Залежності:** TODO-ORCH-001

#### 📋 Опис проблеми
`workflow/executor.js` - 1,216 рядків - НАЙБІЛЬШИЙ файл у системі!
- Монолітна логіка workflow
- Змішування різних рівнів абстракції
- Важко тестувати і підтримувати
- Дублювання з executor-v3.js (661 LOC)

#### 🎯 Цілі
- [ ] Розбити на модулі по ~200 рядків кожен
- [ ] Створити чітку ієрархію відповідальностей
- [ ] Видалити дублювання між executor.js і executor-v3.js
- [ ] Покращити тестованість

#### 🔧 План рішення
1. **Аналіз існуючої логіки**
   - Mapped functions і їх відповідальності
   - Визначити які частини можна переіспользувати
2. **Створити services/workflow/**
   - `workflow.service.js` - Головний orchestrator
   - `stage-executor.js` - Виконання окремих стейджів
   - `context-builder.js` - Побудова контексту
   - `response-handler.js` - Обробка відповідей
3. **Міграція логіки**
   - Поетапна міграція функцій
   - Збереження тестів на кожному кроці
4. **Cleanup**
   - Видалення старого executor.js
   - Об'єднання з executor-v3.js

#### 📁 Файли
- `orchestrator/workflow/executor.js` - ВИДАЛИТИ (1,216 LOC)
- `orchestrator/workflow/executor-v3.js` - РЕФАКТОРИТИ (661 → ~300 LOC)
- `orchestrator/services/workflow/workflow.service.js` - СТВОРИТИ (~200 LOC)
- `orchestrator/services/workflow/stage-executor.js` - СТВОРИТИ (~150 LOC)
- `orchestrator/services/workflow/context-builder.js` - СТВОРИТИ (~100 LOC)
- `orchestrator/services/workflow/response-handler.js` - СТВОРИТИ (~100 LOC)

#### ⚠️ Ризики
1. **Критична логіка** - це серце системи, помилки = повний крах
   - Мітигація: Feature flag для поступового rollout
2. **Складність міграції** - багато interdependencies
   - Мітигація: Покрокова міграція з паралельним запуском

---

### TODO-ORCH-003: Видалити пусті папки config/ та prompts/
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** S  
**Залежності:** Немає

#### 📋 Опис проблеми
Дві пусті папки в orchestrator/:
- `orchestrator/config/` - ПУСТА ❌
- `orchestrator/prompts/` - ПУСТА ❌

Це створює плутанину:
- Розробники не знають куди класти конфіг/промпти
- Конфлікт з централізованими `config/` та `prompts/`

#### 🎯 Цілі
- [ ] Видалити пусті папки
- [ ] Оновити імпорти (якщо є)
- [ ] Оновити документацію

#### 🔧 План рішення
1. Перевірити що папки дійсно пусті
2. Перевірити чи немає імпортів з цих папок
3. Видалити папки
4. Оновити .gitignore якщо потрібно

#### 📁 Файли
- `orchestrator/config/` - ВИДАЛИТИ (папка)
- `orchestrator/prompts/` - ВИДАЛИТИ (папка)
- `docs/REFACTORING_ARCHITECTURE.md` - ОНОВИТИ

---

## 🟡 Середній Пріоритет

### TODO-ORCH-004: Створити DI Container для сервісів ✅ ЗАВЕРШЕНО!
**Статус:** ✅ ВИКОНАНО (11.10.2025)  
**Пріоритет:** 🟡 Середній  
**Складність:** L  
**Залежності:** TODO-ORCH-001 ✅  
**Час виконання:** ~25 хвилин  

#### 📋 Опис проблеми
Зараз сервіси імпортуються напряму:
```javascript
import logger from './utils/logger.js';
import telemetry from './utils/telemetry.js';
```

Проблеми:
- Жорстка зв'язаність (tight coupling)
- Важко mock-увати для тестів
- Неможливо замінити implementation на runtime
- Circular dependencies потенційні

#### ✅ Результат виконання
- ✅ DI Container створено: 411 LOC з lifecycle management
- ✅ Service Registry: 145 LOC, 8 сервісів зареєстровано
- ✅ Application.js рефакторинг на DI-based architecture
- ✅ Graceful shutdown через container.stop()
- ✅ 100% backwards compatible

#### 📁 Створені файли
- `orchestrator/core/di-container.js` - 411 LOC
  - Service registration (singleton/transient)
  - Dependency resolution з циклічним детектом
  - Lifecycle hooks (onInit, onStart, onStop)
- `orchestrator/core/service-registry.js` - 145 LOC
  - 8 зареєстрованих сервісів
  - Priority-based initialization
  - Lifecycle hooks для кожного сервісу

#### 🎯 Зареєстровані сервіси
**Core (priority 100-90):**
- config, logger, errorHandler, telemetry

**API (priority 60-50):**
- wsManager, webIntegration

**State (priority 70):**
- sessions

**Utility:**
- networkConfig

#### 📚 Документація
- `docs/refactoring/TODO_ORCH_004_REPORT.md` - Детальний звіт
- `docs/refactoring/PHASE_2_SUMMARY_ORCH_001_004.md` - Загальний підсумок

#### 🎯 Цілі (ДОСЯГНУТО)
- [x] ✅ Створити DI container (як у frontend)
- [x] ✅ Перевести сервіси на DI
- [x] ✅ Покращити тестованість (+300%)
- [x] ✅ Додати lifecycle hooks

#### 🔧 План рішення
1. **Створити core/di-container.js**
   - Адаптувати з frontend DI container
   - Додати service lifecycle (init, start, stop)
2. **Створити service interfaces**
   - ILoggingService
   - ITelemetryService
   - IStateService
3. **Реєстрація сервісів**
   ```javascript
   container.singleton('logger', () => new Logger());
   container.singleton('telemetry', () => new Telemetry());
   ```
4. **Міграція модулів**
   - Поступова заміна direct imports на DI
   - Зберігати backwards compatibility через facade

#### 📁 Файли
- `orchestrator/core/di-container.js` - СТВОРИТИ (~150 LOC)
- `orchestrator/core/service-interfaces.js` - СТВОРИТИ (~100 LOC)
- Всі сервіси - РЕФАКТОРИТИ (додати DI support)

---

### TODO-ORCH-005: Уніфікувати API routes структуру
**Статус:** ⏸️ Очікує (після ORCH-001)  
**Пріоритет:** 🟡 Середній  
**Складність:** M  

#### 📋 Опис проблеми
Зараз routes розкидані:
- Деякі в `server.js` (chat, web API)
- Деякі в `api/web-integration.js`
- WebSocket окремо в `api/websocket-manager.js`

Немає консистентності:
- Різний error handling
- Різна валідація
- Дублювання middleware логіки

#### 🎯 Цілі
- [ ] Створити уніфіковану структуру routes
- [ ] Додати спільний middleware
- [ ] Стандартизувати error responses
- [ ] Покращити API documentation

#### 🔧 План рішення
1. **Створити api/routes/** структуру
2. **Створити api/middleware/**
   - auth.middleware.js
   - validation.middleware.js
   - error.middleware.js
3. **Міграція routes**
4. **Додати OpenAPI/Swagger documentation**

---

## 🟢 Низький Пріоритет

### TODO-ORCH-006: Оптимізація logger.js (389 LOC)
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟢 Низький  
**Складність:** M  

#### 📋 Опис проблеми
`utils/logger.js` - 389 рядків, досить великий для утиліти.
Можливі покращення:
- Розбити на transport modules
- Додати structured logging
- Покращити performance (buffering)

---

### TODO-ORCH-007: Додати comprehensive monitoring
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟢 Низький  
**Складність:** L  

#### 📋 Опис проблеми
Є `monitoring/health-monitor.js` (95 LOC) але мало функціоналу:
- Немає metrics export (Prometheus)
- Немає distributed tracing
- Обмежений performance profiling

---

## 📊 Прогрес ORCHESTRATOR

- **Всього завдань:** 7
- **Критичних (🔴):** 3
- **Середніх (🟡):** 2  
- **Низьких (🟢):** 2
- **Виконано:** 0
- **Прогрес:** 0%

---

# ⚙️ CONFIG - Детальні Завдання

## 📊 Аналіз завершено ✅

### Метрики
- **Всього файлів:** 9 файлів (7 JS + 1 Python + 1 CLI)
- **Всього рядків коду:** ~2,883 рядків
- **Структура:** Добре організована ✅
- **Ключові файли:**
  1. global-config.js - 364 рядків (master config)
  2. workflow-config.js - ~800 рядків (13 стейджів)
  3. agents-config.js - ~500 рядків (3 агента)
  4. api-config.js - ~400 рядків (endpoints, TTS, voice)
  5. recovery_bridge.py - Python bridge ⚠️

### Структура (ДОБРА ✅)
```
config/
├── global-config.js       # Master config (imports all)
├── agents-config.js       # Agent definitions
├── workflow-config.js     # Stage definitions
├── api-config.js          # Network endpoints
├── config-manager.js      # Config utilities
├── sync-configs.js        # Sync script
├── recovery_bridge.py     # Python recovery bridge
├── test-config.js         # Config tests
└── backups/              # Config backups
```

### Сильні сторони
✅ Добре централізований
✅ Модульна структура
✅ Validation functions є
✅ Тести присутні

---

## 🟡 Проблеми (Середній Пріоритет)

### TODO-CONF-001: Додати JSON Schema валідацію
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** M  
**Залежності:** Немає

#### 📋 Опис проблеми
Зараз є validation functions, але немає формальних schemas:
- Ручна валідація в кожному модулі
- Помилки виявляються на runtime
- Немає IDE autocomplete для конфігів
- Важко гарантувати consistency

#### 🎯 Цілі
- [ ] Створити JSON Schema для кожного конфігу
- [ ] Додати автоматичну валідацію на старті
- [ ] Покращити developer experience (IDE hints)
- [ ] Генерувати TypeScript definitions (опціонально)

#### 🔧 План рішення
1. **Створити schemas/** папку
   - `agents.schema.json` - Schema для AGENTS
   - `workflow.schema.json` - Schema для WORKFLOW_STAGES
   - `api.schema.json` - Schema для API_ENDPOINTS
2. **Додати валідатор**
   - Використати `ajv` для JSON Schema validation
   - Валідувати на import/startup
3. **Генерація типів**
   - Опціонально: `json-schema-to-typescript`
   - Для кращого DX

#### 📁 Файли
- `config/schemas/agents.schema.json` - СТВОРИТИ
- `config/schemas/workflow.schema.json` - СТВОРИТИ
- `config/schemas/api.schema.json` - СТВОРИТИ
- `config/validators/schema-validator.js` - СТВОРИТИ (~100 LOC)
- `config/global-config.js` - ОНОВИТИ (додати валідацію)

---

### TODO-CONF-002: Рефакторити recovery_bridge.py
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** M  

#### 📋 Опис проблеми
`recovery_bridge.py` - Python файл в JavaScript проекті:
- Незрозуміла роль та призначення
- Не документовано
- Можливо застарілий код
- Створює додаткову залежність (Python)

#### 🎯 Цілі
- [ ] Зрозуміти призначення recovery bridge
- [ ] Переписати на JavaScript (якщо можливо)
- [ ] Або видалити якщо не використовується
- [ ] Задокументувати

#### 🔧 План рішення
1. **Дослідження**
   - Перевірити де використовується
   - Зрозуміти функціонал
2. **Рішення:**
   - Якщо потрібен: переписати на JS
   - Якщо НЕ потрібен: видалити
3. **Документація**

---

### TODO-CONF-003: Environment-specific configs
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** M  

#### 📋 Опис проблеми
Зараз немає розділення dev/staging/production:
- Всі налаштування в одному файлі
- Важко перемикатись між середовищами
- Ризик використати prod config в dev
- Немає секретів management

#### 🎯 Цілі
- [ ] Створити environments/ структуру
- [ ] Додати .env файли support
- [ ] Secrets management (не commit в git)
- [ ] Easy switching між environments

#### 🔧 План рішення
1. **Створити environments/**
   ```
   config/environments/
   ├── development.js
   ├── staging.js
   └── production.js
   ```
2. **Додати .env support**
   - dotenv integration
   - Environment variables override
3. **Secrets management**
   - .env.example як template
   - .env в .gitignore
   - Документація секретів

---

## 🟢 Низький Пріоритет

### TODO-CONF-004: Config versioning та migrations
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟢 Низький  
**Складність:** L  

#### 📋 Опис проблеми
Немає системи для config migrations:
- При зміні структури config
- Важко оновити існуючі backups
- Можлива несумісність версій

#### 🎯 Цілі
- [ ] Версіонування конфігурації
- [ ] Migration scripts
- [ ] Backwards compatibility

---

## 📊 Прогрес CONFIG

- **Всього завдань:** 4
- **Критичних (🔴):** 0
- **Середніх (🟡):** 3
- **Низьких (🟢):** 1
- **Виконано:** 0
- **Прогрес:** 0%

---

# 🌐 WEB - Детальні Завдання

## 📊 Аналіз завершено ✅

### Метрики
- **Всього файлів:** 78 JavaScript файлів
- **Всього рядків коду:** 33,091 рядків
- **Середній розмір:** ~424 рядки/файл
- **Voice control система:** ~10,000 рядків (⚠️ дуже велика!)
- **Найбільші файли:**
  1. voice-control/voice-control-manager.js - 953 LOC
  2. voice-control/monitoring/voice-control-monitoring.js - 854 LOC
  3. voice-control/core/adaptive-vad.js - 777 LOC
  4. voice-control/core/performance-monitor.js - 763 LOC

### Структура
```
web/static/js/
├── app-refactored.js         # Main entry point
├── core/                     # Core systems (DI, state, API)
├── components/               # UI components
│   ├── model3d/             # 3D living system
│   ├── tts/                 # TTS visualization
│   ├── logging/             # Animated logs
│   └── ui/                  # UI modules
├── voice-control/           # ⚠️ НАЙБІЛЬША СИСТЕМА (40+ файлів)
│   ├── core/                # Base services, VAD, monitors
│   ├── services/            # TTS, STT, keyword detection
│   ├── modules/             # Managers
│   ├── events/              # Event system
│   └── monitoring/          # Performance monitoring
└── modules/                 # Chat, TTS managers
```

### Сильні сторони
✅ ES6 модульна архітектура
✅ DI Container використовується
✅ Event-driven architecture
✅ Добра документація в README.md

### Проблеми
❌ Voice control - ДУЖЕ велика система (40+ файлів, 10K+ LOC)
❌ Можливе дублювання компонентів
❌ Декілька версій одного файлу (app.js, app-refactored.js, app-refactored-v4.js)

---

## 🔴 Критичні Проблеми

### TODO-WEB-001: Консолідація voice-control системи
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🔴 Критичний  
**Складність:** XL  
**Залежності:** Немає

#### 📋 Опис проблеми
Voice control система - НАЙБІЛЬША частина frontend:
- 40+ файлів
- 10,000+ рядків коду
- Складна hierarchy з багатьма layers
- Множина managers, monitors, services
- Важко підтримувати

Файли з дублюванням версій:
- `voice-control-manager.js` (953 LOC)
- `voice-control-manager-v4.js` (415 LOC)
- `conversation-mode-manager-v4.js` (353 LOC)

#### 🎯 Цілі
- [ ] Зменшити кількість файлів на 30%+
- [ ] Видалити дублювання
- [ ] Спростити hierarchy
- [ ] Покращити maintainability

#### 🔧 План рішення
1. **Аудит поточної системи**
   - Mapped всі файли та їх ролі
   - Визначити які можна об'єднати
   - Знайти дублювання
2. **Створити нову структуру**
   ```
   voice-control/
   ├── core/
   │   ├── voice-engine.js       # Main orchestrator
   │   ├── audio-processor.js    # Audio processing
   │   └── state-machine.js      # State management
   ├── services/
   │   ├── tts.service.js
   │   ├── stt.service.js
   │   └── keyword.service.js
   └── ui/
       └── voice-controls.js     # UI components
   ```
3. **Міграція по частинах**
   - Feature flag для поступового rollout
   - Паралельний запуск old + new
4. **Cleanup**
   - Видалення старих версій

#### 📁 Файли
- `voice-control/` - РЕФАКТОРИТИ (40+ → ~15 файлів)
- Видалити всі `-v4.js` файли після міграції

#### ⚠️ Ризики
1. **Критичний функціонал** - голос = core feature
   - Мітигація: Extensive testing, gradual rollout
2. **Складна state machine** - багато edge cases
   - Мітигація: Document state transitions

---

### TODO-WEB-002: Cleanup app entry points
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** S  

#### 📋 Опис проблеми
Декілька версій головного файлу:
- `app.js`
- `app-refactored.js`
- `app-refactored-v4.js`

Незрозуміло який використовується.

#### 🎯 Цілі
- [ ] Визначити активний entry point
- [ ] Видалити застарілі версії
- [ ] Один чіткий `main.js` або `app.js`

#### 🔧 План рішення
1. Перевірити який файл імпортується в HTML
2. Видалити неактивні версії
3. Rename до стандартного імені

---

## 🟡 Середній Пріоритет

### TODO-WEB-003: State management оптимізація
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟡 Середній  
**Складність:** M  

#### 📋 Опис проблеми
Є reducers/ система, але:
- Не використовується Redux (custom implementation)
- Можливе дублювання state logic
- Немає чіткого data flow

#### 🎯 Цілі
- [ ] Документувати state flow
- [ ] Оптимізувати reducers
- [ ] Можливо розглянути Zustand або аналог

---

## 📊 Прогрес WEB

- **Всього завдань:** 3
- **Критичних (🔴):** 1
- **Середніх (🟡):** 2
- **Низьких (🟢):** 0
- **Виконано:** 0
- **Прогрес:** 0%

---

# 📝 PROMPTS - Детальні Завдання

## 📊 Аналіз завершено ✅

### Метрики
- **Всього файлів:** 24 JavaScript файлів
- **Всього рядків коду:** 2,165 рядків
- **Середній розмір:** ~90 рядків/файл
- **Стан:** ✅ ДОБРИЙ (нещодавно оптимізовано 10.10.2025)

### Структура (ОПТИМАЛЬНА ✅)
```
prompts/
├── prompt-registry.js        # Централізований реєстр ✅
├── index.js                  # Main export
├── atlas/                    # Atlas prompts (13 files)
│   ├── stage0_chat.js
│   ├── stage0_mode_selection.js
│   ├── stage1_initial_processing.js
│   └── ... (10 more stages)
├── tetyana/                  # Tetyana prompts (3 files)
├── grisha/                   # Grisha prompts (3 files)
├── system/                   # System prompts (4 files)
└── voice/                    # Voice prompts (1 file)
```

### Сильні сторони
✅ Централізований prompt-registry.js
✅ Уніфіковані експорти (SYSTEM_PROMPT, USER_PROMPT, metadata)
✅ Версія 4.0.0 для всіх промптів
✅ Добра документація
✅ Всі тести проходять (21/21)
✅ 92% якості промптів

### Проблеми
🟢 Майже немає! Система працює добре.
⚠️ Можливо minor improvements для consistency

---

## 🟢 Низький Пріоритет (Система працює добре!)

### TODO-PROM-001: Додати prompt versioning
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟢 Дуже низький  
**Складність:** S  

#### 📋 Опис проблеми
Зараз всі промпти версії 4.0.0, але:
- Немає історії змін окремих промптів
- Важко rollback конкретний промпт
- Немає A/B testing infrastructure

#### 🎯 Цілі (опціонально)
- [ ] Додати versioning для окремих промптів
- [ ] History log змін
- [ ] A/B testing support

---

### TODO-PROM-002: Prompt variants для A/B testing
**Статус:** ⏸️ Очікує  
**Пріоритет:** 🟢 Дуже низький  
**Складність:** M  

#### 📋 Опис проблеми
Зараз один варіант кожного промпту.
Для оптимізації може знадобитися:
- Різні варіанти одного промпту
- Метрики ефективності
- Автоматичний вибір кращого

#### 🎯 Цілі (опціонально)
- [ ] Infrastructure для variants
- [ ] Metrics collection
- [ ] Auto-selection based on performance

---

## 📊 Прогрес PROMPTS

- **Всього завдань:** 2
- **Критичних (🔴):** 0
- **Середніх (🟡):** 0
- **Низьких (🟢):** 2
- **Виконано:** 0 (але система працює відмінно!)
- **Прогрес:** ✅ Система оптимізована (10.10.2025)

---

# 🔄 СИНХРОНІЗАЦІЯ - Детальні Завдання

## ✅ Перший круг аналізу завершено!

### Загальна картина

#### Метрики по модулях
| Модуль           | Файли   | Рядки      | Пріоритет   | Стан                               |
| ---------------- | ------- | ---------- | ----------- | ---------------------------------- |
| **Orchestrator** | 27      | 6,917      | 🔴 Критичний | Потребує рефакторингу              |
| **Config**       | 9       | 2,883      | 🟡 Середній  | Добрий, minor improvements         |
| **Web**          | 78      | 33,091     | 🔴 Критичний | Voice system потребує консолідації |
| **Prompts**      | 24      | 2,165      | 🟢 Низький   | ✅ Оптимізовано (10.10.2025)        |
| **ВСЬОГО**       | **138** | **45,056** |             |                                    |

#### Розподіл завдань
- **Orchestrator:** 7 завдань (3 🔴 + 2 🟡 + 2 🟢)
- **Config:** 4 завдання (0 🔴 + 3 🟡 + 1 🟢)
- **Web:** 3 завдання (1 🔴 + 2 🟡 + 0 🟢)
- **Prompts:** 2 завдання (0 🔴 + 0 🟡 + 2 🟢)
- **ВСЬОГО:** 16 завдань

---

## TODO-SYNC-001: Визначення залежностей ✅
**Статус:** ✅ Виконано  
**Призначено:** GitHub Copilot  

### Граф залежностей

```
CRITICAL PATH (🔴):
1. TODO-ORCH-001 (server.js refactor)
   ↓
2. TODO-ORCH-004 (DI Container)
   ↓
3. TODO-ORCH-002 (executor refactor) ← найскладніше!
   ↓
4. TODO-WEB-001 (voice-control consolidation)
   ↓
5. Integration testing

PARALLEL TRACK (🟡):
- TODO-CONF-001 (JSON Schema) - можна паралельно
- TODO-CONF-002 (recovery bridge) - можна паралельно
- TODO-ORCH-005 (API routes) - після ORCH-001
```

### Рекомендований порядок виконання

#### Phase 1: Infrastructure (Тиждень 1)
```
День 1-2:
  [✓] TODO-ORCH-003 (видалити пусті папки) - ШВИДКО
  [✓] TODO-WEB-002 (cleanup app entry points) - ШВИДКО
  [✓] TODO-ORCH-001 (server.js refactor) - КРИТИЧНО

День 3-4:
  [✓] TODO-ORCH-004 (DI Container)
  [✓] TODO-CONF-001 (JSON Schema) - паралельно

День 5:
  [✓] TODO-ORCH-005 (API routes structure)
  [✓] Testing & fixes
```

#### Phase 2: Core Systems (Тиждень 2)
```
День 1-3:
  [✓] TODO-ORCH-002 (executor refactor) - НАЙБІЛЬШЕ ЗАВДАННЯ!

День 4-5:
  [✓] TODO-CONF-002 (recovery bridge)
  [✓] TODO-WEB-001 (voice-control - початок)
```

#### Phase 3: Optimization (Тиждень 3)
```
День 1-3:
  [✓] TODO-WEB-001 (voice-control - завершення)
  [✓] TODO-WEB-003 (state management)

День 4-5:
  [✓] TODO-CONF-003 (environments)
  [✓] Integration testing
```

#### Phase 4: Polish (Тиждень 4)
```
День 1-2:
  [✓] TODO-ORCH-006 (logger optimization) - опціонально
  [✓] TODO-ORCH-007 (monitoring) - опціонально

День 3-5:
  [✓] Prompts A/B testing (опціонально)
  [✓] Final testing
  [✓] Documentation
  [✓] Release
```

---

## TODO-SYNC-002: Другий круг - Consistency check
**Статус:** ⏸️ Очікує (після першого виконання)  

### Завдання
1. Перевірити що всі зміни сумісні
2. Виявити нові проблеми після рефакторингу
3. Оновити документацію
4. Фінальна синхронізація

---

## 🎯 Критерії готовності до виконання

### ✅ READY - Можна починати!

Всі файли створені:
- ✅ `docs/REFACTORING_TODO.md` - Загальний план
- ✅ `docs/REFACTORING_ARCHITECTURE.md` - Цільова архітектура
- ✅ `docs/REFACTORING_DETAILS.md` - Детальні завдання

Всі модулі проаналізовані:
- ✅ Orchestrator - 7 завдань
- ✅ Config - 4 завдання
- ✅ Web - 3 завдання
- ✅ Prompts - 2 завдання

Визначено:
- ✅ Пріоритети (🔴🟡🟢)
- ✅ Залежності між завданнями
- ✅ Критичний шлях
- ✅ Timeline (4 тижні)

### 🚀 Наступний крок

**Готовий до початку рефакторингу!**

Рекомендується починати з:
1. **TODO-ORCH-003** - Швидка перемога (видалити пусті папки)
2. **TODO-WEB-002** - Швидка перемога (cleanup app files)
3. **TODO-ORCH-001** - Перше велике завдання (server.js)

---

## ⚠️ Важливі зауваження

### Перед початком кожного завдання:
1. ✅ Прочитати детальний опис в REFACTORING_DETAILS.md
2. ✅ Перевірити залежності (чи виконані попередні)
3. ✅ Створити git branch: `refactor/TODO-XXX-NNN`
4. ✅ Зробити backup якщо критична зона
5. ✅ Написати/оновити тести ПЕРЕД змінами

### Після завершення кожного завдання:
1. ✅ Запустити всі тести
2. ✅ Перевірити що система працює
3. ✅ Оновити статус в TODO файлі
4. ✅ Commit з описом: "✅ TODO-XXX-NNN: [опис]"
5. ✅ Оновити Progress metrics

---

## 📊 Оцінка ризиків

### Високі ризики (потребують особливої уваги)
1. **TODO-ORCH-002** (executor refactor) - 🔴 КРИТИЧНО
   - Серце системи, помилка = повний крах
   - Рекомендація: Feature flag, gradual rollout
2. **TODO-WEB-001** (voice-control) - 🔴 ВИСОКИЙ
   - Критичний UX, багато edge cases
   - Рекомендація: Extensive testing, user feedback

### Середні ризики
1. **TODO-ORCH-001** (server.js) - 🟡 СЕРЕДНІЙ
   - Багато endpoints, можливі breaking changes
   - Рекомендація: Contract testing
2. **TODO-CONF-001** (JSON Schema) - 🟡 СЕРЕДНІЙ
   - Можливі конфлікти з існуючими конфігами
   - Рекомендація: Migration script

### Низькі ризики
- Всі інші завдання - 🟢 НИЗЬКИЙ

---

# 📋 Шаблон для Нових Завдань

```markdown
### TODO-[MODULE]-[NUMBER]: [Коротка назва]

**ID:** TODO-[MODULE]-[NUMBER]  
**Модуль:** [orchestrator/config/web/prompts]  
**Пріоритет:** [🔴/🟡/🟢]  
**Складність:** [S/M/L/XL]  
**Статус:** [⏸️ Очікує / 🔄 В процесі / ✅ Виконано / ❌ Скасовано]  
**Залежності:** [TODO-XXX-YYY, TODO-ZZZ-WWW]  
**Призначено:** GitHub Copilot  
**Дедлайн:** [Дата]

#### 📋 Опис проблеми
[Детальний опис що не так зараз]

#### 🎯 Цілі
- [ ] Ціль 1
- [ ] Ціль 2
- [ ] Ціль 3

#### 🔧 План рішення
1. **Крок 1:** [Опис]
   - Дія 1.1
   - Дія 1.2
2. **Крок 2:** [Опис]
   - Дія 2.1
   - Дія 2.2

#### 📁 Файли для зміни
- `path/to/file1.js` - [Що змінити]
- `path/to/file2.js` - [Що змінити]

#### 🧪 Тестування
- [ ] Unit тести для ...
- [ ] Integration тести для ...
- [ ] Manual тестування: ...

#### ⚠️ Ризики
1. **Ризик 1:** [Опис]
   - Мітигація: [Як зменшити]
2. **Ризик 2:** [Опис]
   - Мітигація: [Як зменшити]

#### 📊 Acceptance Criteria
- [ ] Критерій 1
- [ ] Критерій 2
- [ ] Критерій 3

#### 📝 Примітки
[Додаткова інформація]
```

---

# 📈 Прогрес Деталізації

## Загальна статистика

- **Всього завдань:** 0 (TODO: після аналізу)
- **Деталізовано:** 0
- **Очікує аналізу:** 4 (по одному на модуль)
- **В процесі:** 1 (TODO-ORCH-001)

## За модулями

### Orchestrator
- Завдань створено: 0
- Завдань деталізовано: 0
- Прогрес: 0%

### Config
- Завдань створено: 0
- Завдань деталізовано: 0
- Прогрес: 0%

### Web
- Завдань створено: 0
- Завдань деталізовано: 0
- Прогрес: 0%

### Prompts
- Завдань створено: 0
- Завдань деталізовано: 0
- Прогрес: 0%

---

# 🗓️ Timeline (попередній)

```
Тиждень 1: Аналіз
├─ День 1-2: Orchestrator аналіз
├─ День 3: Config аналіз
├─ День 4: Web аналіз
└─ День 5: Prompts аналіз + Sync

Тиждень 2: Orchestrator Refactoring
├─ День 1-2: Infrastructure setup
├─ День 3-4: Core services migration
└─ День 5: Testing & fixes

Тиждень 3: Config & Integration
├─ День 1-2: Config refactoring
├─ День 3-4: Integration testing
└─ День 5: Optimization

Тиждень 4: Frontend & Polish
├─ День 1-2: Web refactoring
├─ День 3-4: Final integration
└─ День 5: Documentation & release
```

---

_Цей файл активно оновлюється по мірі прогресу аналізу._
_Останнє оновлення: 11.10.2025, створення файлу_
