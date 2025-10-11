# ATLAS v4.0 - Архітектура Рефакторингу

**Дата:** 11 жовтня 2025  
**Версія:** 1.0.0  
**Статус:** Планування

---

## 📐 Поточна Архітектура

### Модульна Структура
```
atlas4/
├── orchestrator/          # Node.js координатор (CORE)
│   ├── server.js         # Головний сервер
│   ├── agents/           # Менеджмент агентів
│   ├── ai/               # AI інтеграції (Goose, fallback)
│   ├── api/              # API routes
│   ├── config/           # Orchestrator-specific config
│   ├── errors/           # Error handling
│   ├── monitoring/       # Metrics & monitoring
│   ├── prompts/          # [DEPRECATED?] старі промпти
│   ├── state/            # Session & state management
│   ├── utils/            # Utilities
│   └── workflow/         # Multi-agent workflow engine
│
├── config/               # Централізована конфігурація (SHARED)
│   ├── global-config.js  # Master config
│   ├── agents-config.js  # Agent definitions
│   ├── workflow-config.js # Stage definitions
│   ├── api-config.js     # Network endpoints
│   └── recovery_bridge.py # Recovery bridge
│
├── prompts/              # Централізовані промпти (SHARED)
│   ├── atlas/           # Atlas agent prompts
│   ├── tetyana/         # Tetyana agent prompts
│   ├── grisha/          # Grisha agent prompts
│   ├── system/          # System prompts
│   └── prompt-registry.js # Централізований реєстр
│
├── web/                  # Flask frontend (FRONTEND)
│   ├── app.py           # Flask app
│   ├── static/js/       # ES6 модульний frontend
│   │   ├── app-refactored.js # Main entry
│   │   ├── core/        # Core systems (DI, state, config)
│   │   ├── components/  # UI components
│   │   └── voice-control/ # Voice system
│   └── templates/       # Jinja2 templates
│
├── ukrainian-tts/        # TTS сервіс (SERVICE)
├── services/whisper/     # STT сервіс (SERVICE)
└── goose/               # Goose Desktop інтеграція (EXTERNAL)
```

---

## 🎯 Цільова Архітектура

### Принципи
1. **Single Responsibility** - кожен модуль робить одну річ добре
2. **Dependency Injection** - слабка зв'язаність компонентів
3. **Configuration Over Code** - поведінка через config, не hardcode
4. **Event-Driven** - асинхронна комунікація через події
5. **Layered Architecture** - чіткі межі між шарами

### Шари Системи
```
┌─────────────────────────────────────────────┐
│         PRESENTATION LAYER (Web)            │
│  - Flask app, Jinja2 templates              │
│  - ES6 frontend, DI container               │
│  - 3D Living System, Voice Control          │
└─────────────────┬───────────────────────────┘
                  │ HTTP/SSE/WebSocket
┌─────────────────▼───────────────────────────┐
│       APPLICATION LAYER (Orchestrator)      │
│  - API Routes (Express.js)                  │
│  - Session Management                       │
│  - Event System                             │
└─────────────────┬───────────────────────────┘
                  │ Internal Events
┌─────────────────▼───────────────────────────┐
│         BUSINESS LOGIC LAYER                │
│  - Multi-Agent Workflow Engine              │
│  - Agent Manager (Atlas, Tetyana, Grisha)   │
│  - Stage Processors (System, Agent)         │
│  - Prompt Registry & Builder                │
└─────────────────┬───────────────────────────┘
                  │ Service Calls
┌─────────────────▼───────────────────────────┐
│         INTEGRATION LAYER                   │
│  - Goose Client (Primary AI)                │
│  - Fallback LLM (Alternative AI)            │
│  - TTS Service (Ukrainian speech)           │
│  - Whisper Service (STT)                    │
└─────────────────┬───────────────────────────┘
                  │ External APIs
┌─────────────────▼───────────────────────────┐
│         INFRASTRUCTURE LAYER                │
│  - Configuration System                     │
│  - Logging & Monitoring                     │
│  - Error Handling                           │
│  - State Persistence                        │
└─────────────────────────────────────────────┘
```

---

## 📁 Детальна Структура Модулів

### 🎭 ORCHESTRATOR (`orchestrator/`)

#### Поточна структура
```
orchestrator/
├── server.js              # Монолітний сервер (400+ рядків)
├── config.js              # [DUPLICATE] конфігурація
├── agents/
│   └── agent-manager.js   # Менеджмент агентів
├── ai/
│   ├── goose-client.js    # Goose Desktop API
│   └── fallback-llm.js    # Альтернативний LLM
├── api/
│   └── chat-routes.js     # Chat API endpoints
├── config/
│   └── [VARIOUS]          # [DUPLICATE?] локальні конфіги
├── errors/
│   └── error-handler.js   # Централізована обробка помилок
├── monitoring/
│   ├── metrics-collector.js
│   └── performance-monitor.js
├── prompts/
│   └── [OLD?]             # [DEPRECATED?] старі промпти
├── state/
│   ├── session-manager.js # Session lifecycle
│   └── memory-cleanup.js  # Memory management
├── utils/
│   ├── logger.js          # Logging utility
│   └── [VARIOUS]          # Helper utilities
└── workflow/
    ├── executor-v3.js     # Головний workflow executor
    ├── chat-helpers.js    # Chat utilities
    ├── prompt-builder.js  # Prompt construction
    └── stages/
        ├── agent-stage-processor.js    # Agent stages (1-9)
        └── system-stage-processor.js   # System stages (0, -2, -3)
```

#### Проблеми
- ❌ Монолітний `server.js` - занадто багато відповідальностей
- ❌ Дублювання конфігурації (`config.js` vs `config/global-config.js`)
- ❌ Невизначений статус `orchestrator/prompts/` vs `prompts/`
- ❌ `workflow/executor-v3.js` - складний, 600+ рядків
- ❌ Слабка модульність - важко тестувати окремо

#### Цільова структура
```
orchestrator/
├── server.js              # Мінімальний bootstrap (50-100 рядків)
├── app.js                 # Express app configuration
├── index.js               # Entry point
├── core/
│   ├── application.js     # Application lifecycle
│   ├── di-container.js    # Dependency injection
│   └── event-bus.js       # Event system
├── api/
│   ├── routes/
│   │   ├── chat.routes.js
│   │   ├── voice.routes.js
│   │   └── health.routes.js
│   └── middleware/
│       ├── auth.middleware.js
│       ├── cors.middleware.js
│       └── error.middleware.js
├── services/
│   ├── agent/
│   │   ├── agent.service.js
│   │   └── agent-factory.js
│   ├── ai/
│   │   ├── goose.service.js
│   │   ├── llm.service.js
│   │   └── ai-provider.interface.js
│   ├── workflow/
│   │   ├── workflow.service.js
│   │   ├── stage-executor.js
│   │   └── processors/
│   │       ├── agent-stage.processor.js
│   │       └── system-stage.processor.js
│   ├── session/
│   │   ├── session.service.js
│   │   └── memory-manager.js
│   └── prompt/
│       ├── prompt.service.js
│       └── prompt-builder.js
├── domain/
│   ├── models/
│   │   ├── session.model.js
│   │   ├── message.model.js
│   │   └── agent.model.js
│   └── events/
│       ├── workflow.events.js
│       └── session.events.js
└── infrastructure/
    ├── config/
    │   └── config-loader.js
    ├── logging/
    │   ├── logger.js
    │   └── log-formatter.js
    ├── monitoring/
    │   ├── metrics.collector.js
    │   └── performance.monitor.js
    └── errors/
        ├── error-handler.js
        └── custom-errors.js
```

---

### ⚙️ CONFIG (`config/`)

#### Поточна структура
```
config/
├── global-config.js       # Master config (експортує все)
├── agents-config.js       # Agent definitions
├── workflow-config.js     # Stage definitions
├── api-config.js          # Network endpoints
├── config-manager.js      # Config utilities
├── sync-configs.js        # Config sync script
├── recovery_bridge.py     # Recovery bridge
└── backups/              # Config backups
```

#### Проблеми
- ⚠️ Змішування runtime config з build-time config
- ⚠️ Немає валідації schema для конфігурації
- ⚠️ `recovery_bridge.py` - Python в JavaScript модулі (незрозуміла роль)
- ⚠️ Відсутність environment-specific configs (dev/prod)

#### Цільова структура
```
config/
├── index.js               # Main export
├── schemas/
│   ├── agents.schema.js   # JSON Schema для agents
│   ├── workflow.schema.js # JSON Schema для workflow
│   └── api.schema.js      # JSON Schema для API
├── defaults/
│   ├── agents.default.js
│   ├── workflow.default.js
│   └── api.default.js
├── environments/
│   ├── development.js
│   ├── production.js
│   └── test.js
├── validators/
│   └── config-validator.js # Schema validation
└── loaders/
    ├── config-loader.js   # Load & merge configs
    └── env-loader.js      # Environment variables
```

---

### 🌐 WEB (`web/`)

#### Поточна структура
```
web/
├── app.py                # Flask application
├── static/
│   ├── js/
│   │   ├── app-refactored.js # Main entry
│   │   ├── shared-config.js
│   │   ├── core/        # Core systems
│   │   ├── components/  # UI components
│   │   └── voice-control/ # Voice system
│   └── css/
│       └── main.css
└── templates/
    └── index.html
```

#### Проблеми
- ⚠️ Frontend досить добре організований (нещодавно рефакторили)
- ⚠️ Можлива дублювання logic між components
- ⚠️ Немає чіткого state management pattern

#### Цільова структура
```
web/
├── app.py                # Flask app (мінімальний)
├── routes/
│   ├── __init__.py
│   ├── main.routes.py
│   └── api.routes.py
├── static/
│   ├── js/
│   │   ├── main.js      # Entry point
│   │   ├── app.config.js # Frontend config
│   │   ├── core/
│   │   │   ├── di-container.js
│   │   │   ├── event-manager.js
│   │   │   ├── state-manager.js
│   │   │   └── service-registry.js
│   │   ├── services/
│   │   │   ├── api/
│   │   │   ├── voice/
│   │   │   ├── tts/
│   │   │   └── websocket/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── model3d/
│   │   │   ├── voice-control/
│   │   │   └── ui/
│   │   └── utils/
│   └── css/
│       ├── main.css
│       └── components/
└── templates/
    ├── base.html
    └── index.html
```

---

### 📝 PROMPTS (`prompts/`)

#### Поточна структура
```
prompts/
├── prompt-registry.js    # Централізований реєстр ✅
├── index.js             # Main export
├── atlas/               # Atlas prompts (13 files)
├── tetyana/             # Tetyana prompts (3 files)
├── grisha/              # Grisha prompts (3 files)
├── system/              # System prompts (4 files)
└── voice/               # Voice prompts (1 file)
```

#### Проблеми
- ✅ Недавно оптимізовано (10.10.2025)
- ✅ Уніфіковані експорти
- ⚠️ Можлива дублювання logic в prompt-builder

#### Цільова структура
```
prompts/
├── index.js             # Main export
├── registry.js          # Prompt registry
├── builder/
│   ├── prompt-builder.js
│   ├── context-builder.js
│   └── templates/
│       └── base.template.js
├── agents/
│   ├── atlas/
│   ├── tetyana/
│   └── grisha/
├── system/
└── validators/
    └── prompt-validator.js
```

---

## 🔄 Data Flow Architecture

### Request Flow (Simplified)
```
[User Input]
    ↓
[Web Frontend] → HTTP/SSE
    ↓
[API Layer] → validate, authenticate
    ↓
[Session Manager] → create/retrieve session
    ↓
[Workflow Service] → execute stages
    ↓
[Agent Manager] → select agent
    ↓
[AI Provider] → Goose/Fallback LLM
    ↓
[Response] → SSE stream back
    ↓
[TTS Service] → voice synthesis (parallel)
    ↓
[User Output]
```

### Event Flow
```
[User Action]
    ↓
[Event Emitted] → EVENT_BUS
    ↓
[Multiple Listeners]
    ├─→ [Logging Service]
    ├─→ [Metrics Service]
    ├─→ [State Manager]
    └─→ [UI Update Service]
```

---

## 🧩 Component Dependencies

### Core Dependencies
```
server.js
  ├── app.js (Express config)
  ├── core/application.js
  │   ├── core/di-container.js
  │   └── core/event-bus.js
  └── api/routes/*
      └── services/*
          ├── services/agent/
          ├── services/workflow/
          └── services/ai/
              ├── goose.service.js
              └── llm.service.js
```

### Configuration Dependencies
```
global-config.js
  ├── agents-config.js
  ├── workflow-config.js
  └── api-config.js
      └── validators/*
```

---

## 🔐 Інтерфейси та Контракти

### Service Interface Pattern
```javascript
// Base service interface
class IService {
  async initialize(config) {}
  async start() {}
  async stop() {}
  async healthCheck() {}
}

// Agent provider interface
class IAgentProvider {
  async processMessage(context, message) {}
  async streamResponse(context, message) {}
  supportsStreaming() {}
}

// State manager interface
class IStateManager {
  async get(key) {}
  async set(key, value) {}
  async delete(key) {}
  async clear() {}
}
```

---

## 📊 Метрики Архітектури

### Поточні (TODO: виміряти)
- Файлів в orchestrator/: ___
- Середній розмір файлу: ___ рядків
- Cyclomatic complexity: ___
- Coupling between modules: ___
- Test coverage: ___%

### Цільові
- Файлів в orchestrator/: < 50
- Середній розмір файлу: < 200 рядків
- Cyclomatic complexity: < 10 per function
- Coupling: Loose (DI-based)
- Test coverage: > 80%

---

## 🚀 Стратегія Міграції

### Phase 1: Infrastructure Setup
1. Створити нову структуру папок
2. Налаштувати DI container
3. Створити event bus
4. Налаштувати configuration loader

### Phase 2: Core Services Migration
1. Міграція session management
2. Міграція workflow engine
3. Міграція agent management
4. Міграція AI providers

### Phase 3: API Layer Migration
1. Створити нові routes
2. Міграція middleware
3. Налаштувати error handling
4. Parallel run (old + new)

### Phase 4: Cleanup & Optimization
1. Видалення старого коду
2. Performance optimization
3. Documentation update
4. Final testing

---

_Цей документ оновлюється по мірі прогресу аналізу._
