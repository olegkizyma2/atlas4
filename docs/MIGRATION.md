# ATLAS v5.0 Migration Guide
## Перехід від Goose Hybrid до MCP Dynamic TODO Only

### 🎯 Що змінилось

ATLAS v5.0 - це спрощена, швидша версія системи з фокусом на **MCP Dynamic TODO** workflow. 
Видалено Goose Desktop integration та всю legacy архітектуру.

### ✨ Ключові зміни

#### 1. Архітектура
- **Було (v4.0):** Hybrid system (Goose + MCP) з backend selection
- **Стало (v5.0):** Pure MCP Dynamic TODO workflow
- **Результат:** -53% коду в executor (1428 → 675 lines)

#### 2. Workflow Execution
- **Було:** Backend Selection → Goose workflow або MCP workflow
- **Стало:** Прямо в MCP Dynamic TODO workflow
- **Переваги:**
  - Швидше виконання (без WebSocket overhead)
  - Гранулярний контроль (item-by-item)
  - Краща адаптивність (dynamic TODO adjustment)

#### 3. Agents
- **Atlas** - створює динамічні TODO плани (1-10 items)
- **Тетяна** - виконує кожен item через MCP tools
- **Гриша** - перевіряє виконання кожного item
- **Видалено:** Legacy stage-based workflow з Goose

#### 4. MCP Tools
Доступні MCP сервери:
- `filesystem` - 14 tools для роботи з файлами
- `playwright` - 32 tools для браузер автоматизації
- `shell` - 9 tools для shell команд
- `applescript` - 1 tool для macOS GUI automation
- `git` - 27 tools для версійного контролю (опціонально)
- `memory` - 9 tools для cross-session memory (опціонально)

### 📦 Архівовані компоненти

Всі Goose-залежні компоненти переміщено в `archive/`:

#### `archive/goose/`
- `goose-client.js` - WebSocket клієнт для Goose Desktop
- `goose-backend.js` - Goose backend provider
- `ai-provider-interface.js` - Backend routing logic
- `agent-stage-processor.js` - Legacy stage processor
- `system-stage-processor.js` - Legacy system processor
- `chat-helpers.js` - Goose-based chat utilities
- `agent-manager.js` - Legacy agent manager
- `backend-selection-processor.js` - Backend selection logic

#### `archive/legacy-prompts/`
- `atlas/` - Goose-based Atlas prompts (5 файлів)
- `tetyana/` - Goose-based Tetyana prompts (3 файли)
- `grisha/` - Goose-based Grisha prompts (2 файли)
- `system/` - Legacy system prompts (11 файлів)
- `voice/` - Voice activation prompts (2 файли)

#### `archive/docs/`
- 100+ MD файлів з fixes та summaries
- requirements.txt, config.yaml - старі конфігурації

#### `archive/scripts/`
- 20+ shell скриптів тестування та перевірки

### 🔧 Конфігурація

#### Видалено з `config/global-config.js`:
```javascript
// ❌ REMOVED
AI_BACKEND_CONFIG.mode = 'hybrid' | 'goose' | 'mcp'
AI_BACKEND_CONFIG.primary = 'goose'
AI_BACKEND_CONFIG.fallback = 'mcp'
AI_BACKEND_CONFIG.disableFallback
AI_BACKEND_CONFIG.providers.goose
AI_BACKEND_CONFIG.routing.gooseKeywords
```

#### Додано/Спрощено:
```javascript
// ✅ SIMPLIFIED
AI_BACKEND_CONFIG.mode = 'mcp'  // Always MCP
AI_BACKEND_CONFIG.primary = 'mcp'
AI_BACKEND_CONFIG.fallback = null
AI_BACKEND_CONFIG.disableFallback = true
AI_BACKEND_CONFIG.providers.mcp  // Only MCP config
```

### 🚀 Як мігрувати

#### 1. Оновити код
```bash
git pull origin main
npm install  # Оновити залежності
```

#### 2. Видалити Goose Desktop (опціонально)
```bash
# Якщо Goose Desktop більше не потрібен
killall Goose
rm -rf ~/.config/goose
```

#### 3. Перевірити MCP сервери
```bash
# Перевірити що MCP packages встановлені
npx -y @modelcontextprotocol/server-filesystem --help
npx -y @executeautomation/playwright-mcp-server --help
npx -y super-shell-mcp --help
```

#### 4. Запустити систему
```bash
./restart_system.sh restart
```

### 📝 API Changes

#### Workflow Execution
```javascript
// ❌ OLD (v4.0)
executeStepByStepWorkflow() {
  // Mode selection
  // Backend selection (Goose vs MCP)
  // Execute через вибраний backend
  // Fallback на Goose при помилках
}

// ✅ NEW (v5.0)
executeStepByStepWorkflow() {
  // Validate DI Container
  // Execute MCP Dynamic TODO Workflow directly
  // No fallback - pure MCP
}
```

#### Stage Processors
```javascript
// ❌ REMOVED
SystemStageProcessor
AgentStageProcessor
BackendSelectionProcessor

// ✅ KEPT (MCP-specific)
AtlasTodoPlanningProcessor
ServerSelectionProcessor
TetyanaПlanToolsProcessor
TetyanaExecuteToolsProcessor
GrishaVerifyItemProcessor
AtlasAdjustTodoProcessor
McpFinalSummaryProcessor
```

### 🎯 Переваги v5.0

1. **Швидкість** - без WebSocket overhead від Goose
2. **Простота** - єдиний чіткий workflow path
3. **Надійність** - прямий контроль над MCP tools
4. **Гранулярність** - item-by-item execution з retry
5. **Прозорість** - користувач бачить кожен крок TODO
6. **Recovery** - retry тільки failed items (не весь workflow)
7. **Менше коду** - простіше підтримувати та розширювати

### ⚠️ Breaking Changes

1. **Goose Desktop більше не потрібен** - система працює без нього
2. **ENV змінні видалено:**
   - `AI_BACKEND_MODE` - завжди 'mcp'
   - `AI_BACKEND_PRIMARY` - завжди 'mcp'
   - `AI_BACKEND_FALLBACK` - немає fallback
   - `AI_BACKEND_DISABLE_FALLBACK` - завжди true
   - `GOOSE_API_KEY` - не використовується
   
3. **Prompts структура:**
   - Legacy prompts (`prompts/atlas/`, `prompts/tetyana/`, etc.) → `archive/legacy-prompts/`
   - Тільки `prompts/mcp/` залишився активним

4. **Workflow stages:**
   - Видалено stages 0, -1, -2, -3 (mode selection, stop router, post-chat analysis, TTS optimization)
   - Залишено тільки MCP stages (1, 2.0, 2.1, 2.1.5, 2.2, 2.3, 3, 8)

### 🧪 Тестування

```bash
# Перевірка що система працює
./restart_system.sh status

# Тест MCP workflow
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt на Desktop з текстом Hello MCP", "sessionId": "test"}'

# Очікуваний результат:
# 1. Atlas створює TODO (1 item)
# 2. Tetyana планує tools (filesystem)
# 3. Tetyana виконує (create file)
# 4. Grisha перевіряє (file exists)
# 5. Final summary
```

### 📚 Додаткові ресурси

- **Архітектура MCP:** `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md`
- **Copilot інструкції:** `.github/copilot-instructions.md`
- **Конфігурація:** `config/global-config.js`
- **Архів:** `archive/` - всі видалені компоненти

### 🆘 Підтримка

Якщо виникли проблеми при міграції:

1. Перевірте логи: `tail -f logs/orchestrator.log`
2. Перевірте DI Container: логи містять "[DI]" теги
3. Перевірте MCP Manager: логи містять "[MCP]" теги
4. Створіть issue з детальним описом помилки

---

**ATLAS v5.0** - Простіше. Швидше. Надійніше. 🚀
