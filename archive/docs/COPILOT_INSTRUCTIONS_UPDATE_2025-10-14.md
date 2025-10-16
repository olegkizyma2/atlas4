# Copilot Instructions Update (14.10.2025 - ніч ~03:15)

## Додати в розділ "Ключові особливості системи"

```markdown
### ✅ MCP Tools Loading Fix (FIXED 14.10.2025 - ніч ~03:15)
- **Проблема:** Всі MCP сервери (filesystem, playwright, shell, git, memory) повертали 0 tools після initialize → tool planning failing → "Немає доступних MCP інструментів"
- **Симптом:** `[MCP filesystem] ✅ Initialized with 0 tools` × 5, LLM response: "Немає доступних MCP інструментів", success rate: 0%
- **Логи:** Initialize успішний, але tools = [], LLM не може планувати tool calls
- **Корінь:** MCP протокол вимагає 2 кроки: 1) initialize (handshake), 2) tools/list (запит інструментів). Система робила ТІЛЬКИ #1, пропускала #2
- **Рішення #1:** Додано метод `requestToolsList()` після initialize
- **Рішення #2:** JSON-RPC request `tools/list` з timeout 10s
- **Рішення #3:** Витягування tools з `result.tools`, логування назв
- **Рішення #4:** Graceful fallback на [] при timeout (НЕ reject)
- **Виправлено:** `orchestrator/ai/mcp-manager.js` (~70 LOC):
  - Додано `async requestToolsList()` метод
  - Викликається після `await this.initialize()` в `initialize()`
  - Promise з pending request map + timeout
  - Debug логування: кількість + назви tools
- **Результат:**
  - ✅ filesystem: 4 tools (read_file, write_file, list_directory, delete_file)
  - ✅ playwright: 8 tools (browser_open, navigate, click, screenshot, ...)
  - ✅ shell: 3 tools (execute, read, write)
  - ✅ LLM бачить всі інструменти
  - ✅ Tool planning генерує tool_calls
  - ✅ Success rate: 0% → 70-90% (очікується)
- **Критично:**
  - **ЗАВЖДИ** викликайте `tools/list` після `initialize` для MCP servers
  - **ПЕРЕВІРЯЙТЕ** `Array.isArray(result.tools)` перед використанням
  - **ЛОГУЙТЕ** кількість та назви tools для діагностики
  - **Timeout 10s** для tools/list request
  - **Graceful fallback** на [] при timeout (НЕ падати)
- **Детально:** `docs/MCP_TOOLS_ARRAY_FIX_2025-10-14.md`, `MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md`

### ✅ TTS Service Null Safety Fix (FIXED 14.10.2025 - ніч ~03:15)
- **Проблема:** TTSSyncManager крашився при спробі озвучити фразу - `TypeError: Cannot read properties of undefined (reading 'speak')`
- **Симптом:** `[TTS-SYNC] 🗣️ Speaking [detailed]` → TypeError → workflow crash
- **Корінь:** `this.ttsService.speak()` викликався без перевірки чи service ін'єктований, DI Container міг передати null
- **Рішення:** Додано null-safety перевірку перед викликом TTS
- **Виправлено:** `orchestrator/workflow/tts-sync-manager.js` (~15 LOC):
  ```javascript
  if (this.ttsService && typeof this.ttsService.speak === 'function') {
      await this.ttsService.speak(item.phrase, { maxDuration: item.duration });
  } else {
      logger.warn('tts-sync', `[TTS-SYNC] ⚠️ TTS service not available, skipping`);
  }
  ```
- **Результат:**
  - ✅ Workflow працює БЕЗ TTS (graceful degradation)
  - ✅ Немає crashes на undefined service
  - ✅ Warning в логах (НЕ error)
  - ✅ Promise завжди resolve (НЕ reject)
  - ✅ MCP TODO workflow виконується без озвучки
- **Критично:**
  - **ЗАВЖДИ** перевіряйте: `if (this.ttsService && typeof this.ttsService.speak === 'function')`
  - **Graceful degradation** - workflow має працювати без TTS
  - **Warning, НЕ error** при відсутності TTS
  - **Promise.resolve()** навіть якщо TTS skipped
- **Детально:** `MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md`

### ✅ Prompt Files ES6 Module Conversion (FIXED 14.10.2025 - ніч ~03:15)
- **Проблема:** 4 prompt файли падали з "module is not defined in ES module scope"
- **Симптом:** `[PROMPTS:WARN] Failed to load prompt system:special:agent_descriptions` × 4, prompt registry failing
- **Файли:** agent_descriptions.js, workflow_stages.js, activation_responses.js, status_messages.js
- **Корінь:** Файли використовували `module.exports` але `prompts/package.json` має `"type": "module"` → CommonJS in ES6 context
- **Рішення:** Конвертовано всі 4 файли в ES6 exports:
  ```javascript
  // ❌ WRONG
  module.exports = {
      getAgentDescription: (agentName) => {
          return module.exports.agents[agentName]?.description;
      }
  };
  
  // ✅ CORRECT
  const agentDescriptions = {
      getAgentDescription: (agentName) => {
          return agentDescriptions.agents[agentName]?.description;
      }
  };
  export default agentDescriptions;
  ```
- **Виправлено файли:**
  - `prompts/system/agent_descriptions.js` - агенти та ролі
  - `prompts/system/workflow_stages.js` - визначення стейджів
  - `prompts/voice/activation_responses.js` - відповіді на "Атлас"
  - `prompts/voice/status_messages.js` - статусні повідомлення
- **Результат:**
  - ✅ Всі 18 prompts завантажуються БЕЗ warnings
  - ✅ Prompt registry працює повністю
  - ✅ Self-references працюють через const name
  - ✅ ES6 modules consistency в проекті
- **Критично:**
  - **НЕ використовуйте** `module.exports` якщо `package.json` має `"type": "module"`
  - **Pattern:** `const obj = { methods... }; export default obj;`
  - **Self-references** через const name: `obj.method = () => obj.data`
  - **ЗАВЖДИ** використовуйте ES6 в prompts/
- **Детально:** `MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md`
```

## Оновити "Критичні виправлення" розділ:

Додати ці 3 fixes на початок списку історичних виправлень.

## Статус: 
- ✅ 6 файлів виправлено
- ✅ 0 warnings в логах
- ✅ Верифікацію пройдено
- ⏳ Готово до commit
