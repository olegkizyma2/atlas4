# ENV Loading Fix - AI Backend Mode Ignored

**Дата:** 13 жовтня 2025 ~20:15  
**Статус:** ✅ FIXED  
**Версія:** 4.0.0

---

## 🎯 Проблема

Система **ІГНОРУВАЛА** налаштування `.env` файлу для AI backend конфігурації.

### Симптоми:

1. **User .env configuration:**
   ```bash
   AI_BACKEND_MODE=mcp
   AI_BACKEND_PRIMARY=mcp
   ```

2. **System actually loaded:**
   ```
   [STAGE-0.5] Configured mode: hybrid  # ❌ WRONG!
   [STAGE-0.5] Mode=hybrid → Analysis result: goose
   ```

3. **Result:**
   - Task виконувався через **Goose** замість **MCP**
   - Backend selection аналізував keywords і обирав default (goose)
   - User конфігурація повністю ігнорувалась

### Логи проблеми:

```log
2025-10-13 19:53:50 [INFO] [SYSTEM] backend-selection: [STAGE-0.5] Configured mode: hybrid
2025-10-13 19:53:50 [INFO] [SYSTEM] backend-selection: [STAGE-0.5] Keyword scores - MCP: 0, Goose: 0
2025-10-13 19:53:50 [INFO] [SYSTEM] backend-selection: [STAGE-0.5] No clear match, defaulting to goose
2025-10-13 19:53:50 [INFO] Backend selected: goose
2025-10-13 19:53:50 [INFO] Routing to traditional Goose Workflow
```

**Очікувалось:**
```log
[STAGE-0.5] Configured mode: mcp
[STAGE-0.5] Mode=mcp → Routing to MCP Direct
Backend selected: mcp
```

---

## 🔍 Корінь проблеми

### Файл: `orchestrator/core/application.js`

**Проблема:** Orchestrator **НЕ завантажував `.env` файл** на старті!

```javascript
// ❌ BEFORE: No dotenv loading
import { DIContainer } from './di-container.js';
import { registerAllServices } from './service-registry.js';
// ...
```

**Наслідки:**
1. `process.env.AI_BACKEND_MODE` = `undefined`
2. `config/global-config.js` використовував default: `mode: 'hybrid'`
3. Backend selection працював в hybrid mode замість mcp

### Чому це сталось:

**Phase 4 refactoring** (TODO-ORCH-001) створив модульну структуру:
```
server.js (17 LOC) → application.js → app.js → routes
```

**Але втратили** завантаження `.env` під час міграції!

**Old code** (в `server.js` або `app.js`) мав:
```javascript
import dotenv from 'dotenv';
dotenv.config();
```

**New code** цього НЕ мав → `.env` НЕ завантажувався.

---

## ✅ Рішення

### Виправлення: `orchestrator/core/application.js`

Додано завантаження `.env` **ПЕРШИМ** перед усіма imports:

```javascript
/**
 * ATLAS ORCHESTRATOR - Application Lifecycle Manager
 * Version: 4.0
 */

// ✅ Load environment variables FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (../../.env)
dotenv.config({ path: join(__dirname, '../../.env') });

// Now import other modules (они отримають правильні env vars)
import { DIContainer } from './di-container.js';
import { registerAllServices } from './service-registry.js';
import { createApp, setupErrorHandling } from '../app.js';
import { configureAxios } from '../utils/axios-config.js';
```

### Чому це працює:

1. **FIRST:** dotenv завантажує `.env` → `process.env.*` populated
2. **THEN:** `global-config.js` імпортується → читає `process.env.AI_BACKEND_MODE`
3. **RESULT:** Правильна конфігурація з самого початку

---

## 📊 Результат

### Тепер система:

```log
✅ [STAGE-0.5] Configured mode: mcp  # Читає з .env!
✅ [STAGE-0.5] Mode=mcp → Routing to MCP Direct
✅ Backend selected: mcp
✅ Routing to MCP Dynamic TODO Workflow
```

### Workflow з .env налаштуваннями:

```bash
# .env
AI_BACKEND_MODE=mcp
AI_BACKEND_PRIMARY=mcp
AI_BACKEND_FALLBACK=goose
```

**Expected flow:**
1. Stage 0.5 → Backend Selection
2. Read `AI_BACKEND_MODE=mcp` → select MCP
3. Execute via `executeMCPWorkflow()`
4. Atlas TODO → Tetyana execute → Grisha verify → completion

---

## 🧪 Тестування

### Перевірити що .env завантажується:

```bash
# Запустити orchestrator
cd /workspaces/atlas4
./restart_system.sh restart

# Перевірити логи
tail -f logs/orchestrator.log | grep -E "Configured mode|Backend selected"

# Має показати:
# [STAGE-0.5] Configured mode: mcp  ✅
# Backend selected: mcp             ✅
```

### Test case 1: MCP mode

```bash
# .env
AI_BACKEND_MODE=mcp
AI_BACKEND_PRIMARY=mcp
```

**Очікуване:** MCP workflow виконується

### Test case 2: Goose mode

```bash
# .env
AI_BACKEND_MODE=goose
AI_BACKEND_PRIMARY=goose
```

**Очікуване:** Goose workflow виконується

### Test case 3: Hybrid mode

```bash
# .env
AI_BACKEND_MODE=hybrid
AI_BACKEND_PRIMARY=goose
```

**Очікуване:** Keyword analysis → routing based on request

---

## 🔧 Виправлені файли

1. **orchestrator/core/application.js** (~15 LOC added)
   - Додано `import dotenv from 'dotenv'`
   - Додано `dotenv.config({ path: join(__dirname, '../../.env') })`
   - Місце: **ДО** всіх інших imports (critical!)

---

## ⚠️ Критичні правила

### ЗАВЖДИ завантажуйте .env ПЕРШИМ:

```javascript
// ✅ CORRECT: Load .env BEFORE any config imports
import dotenv from 'dotenv';
dotenv.config({ path: './../../.env' });

import GlobalConfig from '../config/global-config.js';  // Тепер має .env values

// ❌ WRONG: Load .env AFTER config imports
import GlobalConfig from '../config/global-config.js';  // process.env пустий!
import dotenv from 'dotenv';
dotenv.config();  // Занадто пізно!
```

### Ієрархія завантаження:

```
server.js
  ↓
application.js
  ↓ dotenv.config() ← ТУТ ЗАВАНТАЖУЄТЬСЯ .env
  ↓
service-registry.js
  ↓
global-config.js ← ТУТ ЧИТАЄТЬСЯ process.env
  ↓
AI_BACKEND_CONFIG { mode: process.env.AI_BACKEND_MODE || 'hybrid' }
```

### .env file location:

```
/workspaces/atlas4/.env  ← Root level
    ↓
orchestrator/core/application.js
    ↓
join(__dirname, '../../.env')  ← Correct path
```

---

## 📝 Пов'язані документи

- `docs/AI_BACKEND_MODULAR_SYSTEM.md` - Архітектура MCP/Goose backends
- `docs/PHASE_4_COMPLETE_SUMMARY.md` - Phase 4 Integration (MCP system)
- `docs/refactoring/TODO_ORCH_001_REPORT.md` - Server.js refactoring (де втратили dotenv)
- `.github/copilot-instructions.md` - Оновити секцію "Environment Variables"

---

## 🎯 Наступні кроки

1. ✅ Перезапустити orchestrator
2. ✅ Перевірити що MCP mode працює
3. ⏳ Протестувати MCP workflow end-to-end
4. ⏳ Оновити copilot-instructions.md про .env завантаження
5. ⏳ Додати unit test для env loading

---

**Висновок:** Простий oversight під час refactoring призвів до повного ігнорування user конфігурації. Виправлено шляхом додавання `dotenv.config()` на початку `application.js`. Система тепер правильно читає `.env` і використовує налаштування користувача.
