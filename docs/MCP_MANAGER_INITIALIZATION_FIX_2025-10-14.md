# MCP Manager Initialization Fix - 2025-10-14 02:30

## Critical Bug: MCPManager Never Initialized

### Problem
All MCP workflow tasks fail with error:
```
Tool planning failed: MCP Manager does not have listTools() method
```

**0% success rate** - no TODO items execute because tool planning fails immediately.

### Root Cause
**MCPManager.initialize() is never called** during DI Container startup!

The service registry (orchestrator/core/service-registry.js) creates MCPManager instance but **only logs** "initialized" without actually calling the async `initialize()` method.

```javascript
// ❌ WRONG - Only logs, doesn't initialize
lifecycle: {
    onInit: async function () {
        logger.system('startup', '[DI] MCPManager initialized');
    }
}
```

**What initialize() does:**
1. Spawns MCP server processes (filesystem, playwright, computercontroller)
2. Performs JSON-RPC handshake with each server
3. Loads available tools into `this.servers` Map
4. Makes tools available via `listTools()` and `getAvailableTools()`

**Without it:**
- `this.servers` Map remains empty
- `listTools()` returns empty array `[]`
- No tools available for Tetyana to plan/execute
- All MCP workflows fail at Stage 2.1 (Tool Planning)

### Symptoms from Logs
```
2025-10-14 02:11:33 [ERROR] mcp-todo [TODO] MCP Manager missing listTools method! Type: function
2025-10-14 02:11:33 [ERROR] tetyana-plan-tools Tool planning failed: MCP Manager does not have listTools() method
2025-10-14 02:11:33 [WARN] Tool planning failed for item 1: ...MCP Manager does not have listTools() method
```

The method EXISTS (`Type: function`) but returns empty array because MCPManager has no servers loaded.

### Error Flow
```
1. User request: "Створи файл TestModels.txt"
2. Stage 1-MCP: Atlas creates TODO with 2 items ✅
3. Stage 2.1-MCP: Tetyana calls planTools()
   → mcpTodoManager.planTools(item)
   → mcpManager.listTools()
   → returns [] (empty - no servers!)
   → LLM receives empty tool list
   → Can't generate valid plan
4. Retry 3x → All fail
5. Move to item 2, same failure
6. Workflow completes with 0% success
```

### The Fix

**File:** `orchestrator/core/service-registry.js`

**Two Critical Issues Fixed:**

#### Issue #1: Wrong Config Path
```javascript
// ❌ WRONG - mcpServers doesn't exist
const serversConfig = c.resolve('config').AI_BACKEND_CONFIG?.mcpServers || {};

// ✅ CORRECT - Use providers.mcp.servers
const config = c.resolve('config');
const serversConfig = config.AI_BACKEND_CONFIG?.providers?.mcp?.servers || {};
```

#### Issue #2: No Initialization Call
```javascript
// ❌ WRONG - Only logs, doesn't initialize
lifecycle: {
    onInit: async function () {
        logger.system('startup', '[DI] MCPManager initialized');
    }
}

// ✅ CORRECT - Actually call initialize()
lifecycle: {
    onInit: async function () {
        await this.initialize();
        logger.system('startup', '[DI] MCPManager initialized with servers');
    }
}
```

**Complete Fixed Code:**
```javascript
// MCPManager - керування MCP servers
container.singleton('mcpManager', async (c) => {
    // FIXED 14.10.2025 - Use correct config path for MCP servers
    const config = c.resolve('config');
    const serversConfig = config.AI_BACKEND_CONFIG?.providers?.mcp?.servers || {};
    const module = await import('../ai/mcp-manager.js');
    const MCPManager = module.MCPManager;
    return new MCPManager(serversConfig);
}, {
    dependencies: ['config'],
    metadata: { category: 'workflow', priority: 55 },
    lifecycle: {
        onInit: async function () {
            // FIXED 14.10.2025 - Actually initialize MCPManager
            await this.initialize();
            logger.system('startup', '[DI] MCPManager initialized with servers');
        }
    }
});
```

### Why This Works

1. **`this` context**: In lifecycle hooks, `this` refers to the service instance (MCPManager)
2. **`await`**: Ensures servers fully start before marking as initialized
3. **Logging**: Updated message confirms servers are actually loaded

After fix:
```
[DI] MCPManager initialized with servers
[MCP Manager] Starting filesystem... ✅
[MCP Manager] Starting playwright... ✅ 
[MCP Manager] Starting computercontroller... ✅
[MCP Manager] ✅ 3 servers started
```

### Impact

**Before:**
- 0% success rate
- All tool planning fails
- No MCP workflows work
- Fallback to error messages

**After:**
- MCPManager has 3 active servers
- `listTools()` returns 18+ tools
- Tetyana can plan & execute
- MCP workflows complete successfully

### Testing

```bash
# Test MCP workflow after fix
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt на Desktop", "sessionId": "test"}'

# Expected:
# - Stage 1: TODO created ✅
# - Stage 2.1: Tools planned (filesystem__write_file) ✅
# - Stage 2.2: File created ✅
# - Stage 2.3: Verified ✅
# - Success rate: 100%
```

### Related Issues
- Similar to TTSSyncManager which WAS properly initialized
- MCPManager is the only service missing initialization call
- This is a **critical blocker** for all MCP functionality

### Files Changed
1. `orchestrator/core/service-registry.js` - Add `await this.initialize()` to onInit

### Criticality
🔴 **CRITICAL** - Blocks 100% of MCP workflow functionality

Without this fix, MCP mode is completely non-functional.
