# MCP Manager Fix - Iteration 2 (CORRECTED)

## Date: 2025-10-14 02:25

## First Attempt Failed ❌

**Error:**
```
Application startup failed: TypeError: this.initialize is not a function
    at Promise.onInit (service-registry.js:176:28)
```

**Why It Failed:**
The factory function was `async`, which means it returned a **Promise**, not the actual MCPManager instance!

```javascript
// ❌ WRONG - Returns Promise<MCPManager>
container.singleton('mcpManager', async (c) => {
    const module = await import('../ai/mcp-manager.js');
    return new MCPManager(serversConfig);  // Wrapped in Promise!
}, {
    lifecycle: {
        onInit: async function () {
            await this.initialize();  // this = Promise, not MCPManager!
        }
    }
});
```

When DI Container calls `resolve()`, it stores the Promise in `singletons` Map. Then when `onInit` is called with `this` bound to the stored value, `this` is a Promise, not a MCPManager instance. Promises don't have an `initialize()` method!

## Second Attempt - CORRECT ✅

### Solution
Make the factory **synchronous** and import MCPManager at the top of the file.

### Changes Made

**1. Add Import at Top:**
```javascript
// orchestrator/core/service-registry.js (top of file)
import { MCPManager } from '../ai/mcp-manager.js';
```

**2. Synchronous Factory:**
```javascript
container.singleton('mcpManager', (c) => {  // NOT async!
    const config = c.resolve('config');
    const serversConfig = config.AI_BACKEND_CONFIG?.providers?.mcp?.servers || {};
    
    // Create instance immediately (servers NOT started yet)
    return new MCPManager(serversConfig);  // Returns actual instance, not Promise
}, {
    dependencies: ['config'],
    metadata: { category: 'workflow', priority: 55 },
    lifecycle: {
        onInit: async function () {
            // this = actual MCPManager instance ✅
            await this.initialize();  // This works now!
            logger.system('startup', '[DI] MCPManager initialized with servers');
        }
    }
});
```

## Why This Works

1. **Factory is synchronous** → Returns MCPManager instance directly
2. **DI Container stores instance** in singletons Map (not a Promise)
3. **onInit lifecycle hook** is called with `this` bound to the actual MCPManager instance
4. **`this.initialize()` works** because `this` is MCPManager, which has the `initialize()` method

## Key Learnings

### DI Container Pattern
- **Factory functions should be synchronous** unless you modify DI Container to await Promises
- **Lifecycle hooks get `this` = service instance** (whatever factory returned)
- **Import classes at module top** for synchronous use in factories

### Async/Await Gotcha
```javascript
async function factory() {
    return value;  // Returns Promise<value>, NOT value!
}

const result = factory();  // result is Promise, not value
```

To get actual value, you must `await`:
```javascript
const result = await factory();  // NOW result is value
```

But DI Container's `resolve()` doesn't await, so async factories break the pattern.

## Files Changed
1. `orchestrator/core/service-registry.js`
   - Added `import { MCPManager }` at top
   - Changed factory from `async (c) => {...}` to `(c) => {...}`
   - Kept onInit with `await this.initialize()`

## Testing
```bash
# Restart to apply fix
./restart_system.sh restart

# Check logs for successful initialization
tail -f logs/orchestrator.log | grep MCPManager

# Expected:
# [DI] MCPManager initialized with servers
# [MCP Manager] Starting MCP servers...
# [MCP Manager] ✅ 7 servers started
```

## Status
✅ **FIXED** - Ready for testing
