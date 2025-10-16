# 🚀 MCP Tools Quick Reference Guide

## 📍 Где что находится?

| Вопрос                                       | Ответ                                                           | Файл                                        | Строка     |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- | ---------- |
| **Как Тетяна ПОЛУЧАЕТ список инструментов?** | `MCPManager.getToolsSummary()` или `getDetailedToolsSummary()`  | `orchestrator/ai/mcp-manager.js`            | 500-550    |
| **Как Тетяна ИХ ПЛАНИРУЕТ?**                 | `planTools()` - LLM выбирает tools на основе промпта            | `orchestrator/workflow/mcp-todo-manager.js` | 636-750    |
| **Как Тетяна ИХ ВЫПОЛНЯЕТ?**                 | `executeTools()` - цикл по tool_calls, вызывает `executeTool()` | `orchestrator/workflow/mcp-todo-manager.js` | 989-1070   |
| **Как Гриша ПОЛУЧАЕТ список инструментов?**  | Тот же `getToolsSummary()` или фильтрованный набор              | `orchestrator/ai/mcp-manager.js`            | 520-550    |
| **Как Гриша ПЛАНИРУЕТ верификацию?**         | `_planVerificationTools()` - LLM with {{AVAILABLE_TOOLS}}       | `orchestrator/workflow/mcp-todo-manager.js` | 1971-2050  |
| **Как Гриша ВЫПОЛНЯЕТ верификацию?**         | `_executeVerificationTools()` - вызывает MCP tools              | `orchestrator/workflow/mcp-todo-manager.js` | 2065-2120  |
| **Как Гриша АНАЛИЗИРУЕТ результаты?**        | `_analyzeVerificationResults()` - LLM читает РЕАЛЬНЫЕ данные    | `orchestrator/workflow/mcp-todo-manager.js` | ~2130-2175 |

---

## 🔍 Быстрый поиск по ключевым словам

### Если нужно понять...

#### 📚 **Tool List Acquisition**
- 📄 Файл: `mcp-manager.js` (490-550)
- 🔑 Функции: `getAvailableTools()`, `getToolsSummary()`, `getToolsFromServers()`
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 1

#### 🧠 **Planning Logic**
- 📄 Файл: `mcp-todo-manager.js` (636-750)
- 🔑 Функция: `planTools(item, todo, options)`
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 2
- 🎯 Ключевая логика: {{AVAILABLE_TOOLS}} substitution (line 700-730)

#### ⚙️ **Execution Process**
- 📄 Файл: `mcp-todo-manager.js` (989-1070)
- 🔑 Функция: `executeTools(plan, item)`
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 3

#### ✅ **Verification Planning**
- 📄 Файл: `mcp-todo-manager.js` (1971-2050)
- 🔑 Функция: `_planVerificationTools(item, execution, options)`
- 🚨 КРИТИЧНО: Screenshot marked ОБОВ'ЯЗКОВИЙ (line 1989)
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 4

#### 🔎 **Verification Execution**
- 📄 Файл: `mcp-todo-manager.js` (2065-2120)
- 🔑 Функция: `_executeVerificationTools(plan, item)`
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 5

#### 📊 **Verification Analysis (FIXED 16.10.2025)**
- 📄 Файл: `mcp-todo-manager.js` (2120-2175)
- 🔑 Функция: `_analyzeVerificationResults()`
- 🚨 FIX LOCATION: Lines 2130-2145, 2160-2175
- ✅ STATUS: Graceful fallback now returns `false` instead of `true`
- 📖 Документ: `HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md` - ЭТАП 6

---

## 📋 API Reference

### MCP Manager Methods

```javascript
// Get ALL tools (92+)
const allTools = mcpManager.getAvailableTools();
// Returns: Array<{tool, server, description, inputSchema, ...}>
// Size: ~500 tokens

// Get tools summary (compact)
const summary = mcpManager.getToolsSummary(filterServers?);
// filterServers: ['shell', 'playwright'] (optional)
// Returns: Markdown string
// Size: ~500 tokens (all) or ~150 tokens (filtered)

// Get detailed summary for specific servers
const detailed = mcpManager.getDetailedToolsSummary(serverNames);
// serverNames: ['shell', 'playwright']
// Returns: Detailed markdown with examples

// Execute a tool
const result = await mcpManager.executeTool(serverName, toolName, parameters);
// serverName: 'shell', 'playwright', 'filesystem', etc.
// toolName: 'execute_command', 'screenshot', etc.
// parameters: {...}
// Returns: Tool execution result
```

### Tetyana Methods

```javascript
// Plan which tools to use
const plan = await mco.planTools(item, todo, options);
// options: {
//   selectedServers: ['shell', 'playwright'],  // Optional optimization
//   toolsSummary: '...',                        // Optional pre-gen summary
//   item: {...}
// }
// Returns: {tool_calls: [{server, tool, parameters}, ...], ...}

// Execute planned tools
const execution = await mco.executeTools(plan, item);
// Returns: {results: [...], all_successful: boolean}

// Optionally adjust after screenshot
const adjusted = await mco.screenshotAndAdjust(plan, item);
// Returns: {adjusted_plan: {...}, needs_adjustment: boolean}
```

### Grisha Methods

```javascript
// Plan verification tools
const verificationPlan = await mco._planVerificationTools(item, execution);
// execution: Results from Tetyana
// Returns: {tool_calls: [...]}  ← Screenshot ALWAYS included!

// Execute verification tools
const verificationResults = await mco._executeVerificationTools(verificationPlan, item);
// Returns: {results: [...], all_successful: boolean}
// ⚠️ Results contain REAL data (screenshot bytes, file contents, etc.)

// Analyze verification results
const decision = await mco._analyzeVerificationResults(item, execution, verificationResults);
// Returns: {verified: boolean, reason: string}
// ✅ CRITICAL FIX: Returns FALSE if data missing, no false positives!
```

---

## 🎯 Common Scenarios

### Сценарий 1: Добавить новый MCP Server

1. **Установить npm пакет**
   ```bash
   npm install -g @modelcontextprotocol/server-xxx
   ```

2. **Добавить в `global-config.js`**
   ```javascript
   mcp_servers: [
     { name: 'xxx', command: 'npx @modelcontextprotocol/server-xxx' }
   ]
   ```

3. **MCPManager автоматически:**
   - Запустит сервер
   - Загрузит tools
   - Сделает их доступными в `getToolsSummary()`

### Сценарий 2: Используемые инструменты

```javascript
// Если нужны ТОЛЬКО файловые операции
const plan = await mco.planTools(item, todo, {
  selectedServers: ['filesystem']  // Только 14 tools, не 92!
});

// LLM получит только filesystem tools
// Prompt сократится с 500 до ~50 токенов
```

### Сценарий 3: Проверить какие инструменты доступны

```javascript
// Список ВСЕх инструментов
const tools = mco.mcpManager.getAvailableTools();
console.log(tools.map(t => `${t.server}.${t.name}`));
// Output: ['shell.execute_command', 'filesystem.read_file', ...]

// Компактная сводка
const summary = mco.mcpManager.getToolsSummary();
console.log(summary);
// Output: "- shell (9 tools): execute_command, ..."
```

### Сценарий 4: Отладка падения tool execution

```javascript
// 1. Проверить что tool существует
const tools = mco.mcpManager.getAvailableTools();
const exists = tools.find(t => t.server === 'shell' && t.name === 'execute_command');

// 2. Попробовать вызвать напрямую
try {
  const result = await mco.mcpManager.executeTool('shell', 'execute_command', {
    command: 'echo test'
  });
  console.log('SUCCESS:', result);
} catch (error) {
  console.log('ERROR:', error.message);
}

// 3. Проверить логи Grisha
grep "_executeVerificationTools" logs/orchestrator.log
```

---

## 🚨 Critical Code Locations

### Graceful Fallback Fixes (FIXED 16.10.2025)

```javascript
// FILE: orchestrator/workflow/mcp-todo-manager.js
// METHOD: _analyzeVerificationResults()

// ❌ BEFORE (Lines 2130-2145):
if (verificationResults?.results?.find) {
  const screenshot = verificationResults.results.find(r => r.tool === 'screenshot');
  const verified = screenshot?.result?.path ? true : false;  // ❌ WRONG!
  return { verified: execution?.all_successful }; // ❌ FALSE POSITIVE!
}

// ✅ AFTER:
if (!verificationResults?.results || !Array.isArray(verificationResults.results)) {
  return {
    verified: false,  // ✅ Conservative: return false when data missing
    reason: 'Unable to verify - no verification data'
  };
}
```

---

## 📊 Performance Metrics

| Operation                                    | Time      | Tokens | Notes                  |
| -------------------------------------------- | --------- | ------ | ---------------------- |
| `getToolsSummary()` - all                    | <100ms    | ~500   | 92 tools               |
| `getToolsSummary()` - filtered               | <50ms     | ~150   | 2-3 servers            |
| `planTools()` - LLM call                     | 1-3s      | 2K     | With context           |
| `executeTools()` - per tool                  | 100-500ms | -      | Varies by tool         |
| `_planVerificationTools()` - LLM             | 1-2s      | 2K     | Always with screenshot |
| `_executeVerificationTools()` - verification | 500ms-2s  | -      | Takes screenshot       |
| `_analyzeVerificationResults()` - LLM        | 1-2s      | 3K     | Reads real data        |
| **Total per TODO item**                      | 5-10s     | 7K     | 3 LLM calls            |

---

## 🔗 Related Documentation

- **Complete Guide**: `docs/HOW_TETYANA_GRISHA_GET_AND_USE_TOOLS_2025-10-16.md`
- **Diagrams**: `docs/MCP_TOOL_FLOW_DIAGRAMS_2025-10-16.md`
- **Graceful Fallback Fix**: `docs/GRISHA_VERIFICATION_CRASH_FIX_2025-10-16.md`
- **Architecture**: `docs/ATLAS_SYSTEM_ARCHITECTURE.md`
- **All MCP Tools**: `docs/MCP_TOOL_FLOW_DIAGRAMS_2025-10-16.md` - Diagram 3

---

## ✅ Testing Checklist

- [ ] MCPManager starts all 6 servers
- [ ] `getAvailableTools()` returns 92 tools
- [ ] `getToolsSummary()` creates readable description
- [ ] Tetyana can plan with full tool list
- [ ] Tetyana can plan with pre-selected servers
- [ ] Tetyana can execute planned tools
- [ ] Grisha gets tool list for verification
- [ ] Grisha plans with screenshot mandatory
- [ ] Grisha executes verification tools
- [ ] Grisha analyzes REAL verification data
- [ ] Graceful fallback returns FALSE (not TRUE) when data missing
- [ ] No false-positive VERIFIED status

---

**Last Updated:** 16 октября 2025  
**Status:** ✅ System FIXED and documented
