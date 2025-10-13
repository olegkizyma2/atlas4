# Phase 4 Checklist - DI Container & Executor Integration

**Date:** 13 жовтня 2025  
**Status:** ⏳ PENDING  
**Prerequisites:** ✅ Phase 1, 2, 3 completed

---

## 📋 Overview

Phase 4 integrates MCP Dynamic TODO Workflow System into existing ATLAS architecture:
- Register services in DI Container
- Implement routing logic in Executor
- Add error handling & fallback mechanisms
- Test end-to-end workflow

**ETA:** 1-2 days

---

## ✅ Task 1: DI Container Registration (1-2 hours)

### File: `orchestrator/core/service-registry.js`

**Actions:**

1. **Register MCPTodoManager**
   ```javascript
   container.singleton('mcpTodoManager', (c) => {
       return new MCPTodoManager({
           mcpManager: c.resolve('mcpManager'),
           llmClient: c.resolve('llmClient'),
           ttsSyncManager: c.resolve('ttsSyncManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpManager', 'llmClient', 'ttsSyncManager', 'logger'],
       metadata: { category: 'workflow', priority: 50 }
   });
   ```

2. **Register TTSSyncManager**
   ```javascript
   container.singleton('ttsSyncManager', (c) => {
       return new TTSSyncManager({
           ttsService: c.resolve('ttsService'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['ttsService', 'logger'],
       metadata: { category: 'workflow', priority: 60 }
   });
   ```

3. **Register 7 Stage Processors**
   ```javascript
   // Backend Selection
   container.singleton('backendSelectionProcessor', (c) => {
       return new BackendSelectionProcessor({
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // Atlas TODO Planning
   container.singleton('atlasTodoPlanningProcessor', (c) => {
       return new AtlasTodoPlanningProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // Tetyana Plan Tools
   container.singleton('tetyanaПlanToolsProcessor', (c) => {
       return new TetyanaПlanToolsProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           mcpManager: c.resolve('mcpManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // Tetyana Execute Tools
   container.singleton('tetyanaExecuteToolsProcessor', (c) => {
       return new TetyanaExecuteToolsProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           mcpManager: c.resolve('mcpManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // Grisha Verify Item
   container.singleton('grishaVerifyItemProcessor', (c) => {
       return new GrishaVerifyItemProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           mcpManager: c.resolve('mcpManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // Atlas Adjust TODO
   container.singleton('atlasAdjustTodoProcessor', (c) => {
       return new AtlasAdjustTodoProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });

   // MCP Final Summary
   container.singleton('mcpFinalSummaryProcessor', (c) => {
       return new McpFinalSummaryProcessor({
           mcpTodoManager: c.resolve('mcpTodoManager'),
           logger: c.resolve('logger')
       });
   }, {
       dependencies: ['mcpTodoManager', 'logger'],
       metadata: { category: 'processors', priority: 40 }
   });
   ```

**Imports needed:**
```javascript
import { MCPTodoManager } from '../workflow/mcp-todo-manager.js';
import { TTSSyncManager } from '../workflow/tts-sync-manager.js';
import {
    BackendSelectionProcessor,
    AtlasTodoPlanningProcessor,
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    McpFinalSummaryProcessor
} from '../workflow/stages/index.js';
```

**Testing:**
```bash
# Verify container can resolve all services
node -e "
import { DIContainer } from './orchestrator/core/di-container.js';
import { registerAllServices } from './orchestrator/core/service-registry.js';

const container = new DIContainer();
await registerAllServices(container);
await container.initialize();

console.log('mcpTodoManager:', container.resolve('mcpTodoManager'));
console.log('ttsSyncManager:', container.resolve('ttsSyncManager'));
console.log('Processors:', [
    'backendSelectionProcessor',
    'atlasTodoPlanningProcessor',
    'tetyanaПlanToolsProcessor',
    'tetyanaExecuteToolsProcessor',
    'grishaVerifyItemProcessor',
    'atlasAdjustTodoProcessor',
    'mcpFinalSummaryProcessor'
].map(name => container.resolve(name)));
"
```

---

## ✅ Task 2: Executor Routing Logic (4-6 hours)

### File: `orchestrator/workflow/executor-v3.js`

**Actions:**

1. **Import processors**
   ```javascript
   import {
       BackendSelectionProcessor,
       AtlasTodoPlanningProcessor,
       TetyanaПlanToolsProcessor,
       TetyanaExecuteToolsProcessor,
       GrishaVerifyItemProcessor,
       AtlasAdjustTodoProcessor,
       McpFinalSummaryProcessor
   } from './stages/index.js';
   ```

2. **Add backend selection stage (0.5)**
   ```javascript
   async executeWorkflow(session, userMessage) {
       // Stage 0.5: Backend Selection
       const backendProcessor = container.resolve('backendSelectionProcessor');
       const backendResult = await backendProcessor.execute({
           userMessage,
           session
       });

       if (!backendResult.success) {
           throw new Error('Backend selection failed');
       }

       // Route based on selected backend
       if (backendResult.backend === 'mcp') {
           return await this.executeMCPWorkflow(session, userMessage);
       } else {
           return await this.executeGooseWorkflow(session, userMessage);
       }
   }
   ```

3. **Implement MCP workflow**
   ```javascript
   async executeMCPWorkflow(session, userMessage) {
       // Stage 1-MCP: Plan TODO
       const todoProcessor = container.resolve('atlasTodoPlanningProcessor');
       const todoResult = await todoProcessor.execute({
           userMessage,
           session
       });

       if (!todoResult.success) {
           throw new Error(`TODO planning failed: ${todoResult.error}`);
       }

       const todo = todoResult.todo;

       // Execute TODO item-by-item
       for (const item of todo.items) {
           let attempt = 1;
           
           while (attempt <= (item.max_attempts || 3)) {
               // Stage 2.1: Plan Tools
               const planProcessor = container.resolve('tetyanaПlanToolsProcessor');
               const planResult = await planProcessor.execute({
                   currentItem: item,
                   todo
               });

               if (!planResult.success) {
                   // Log error and continue to adjustment
                   logger.error('executor', `Tool planning failed: ${planResult.error}`);
                   attempt++;
                   continue;
               }

               // Stage 2.2: Execute Tools
               const executeProcessor = container.resolve('tetyanaExecuteToolsProcessor');
               const execResult = await executeProcessor.execute({
                   currentItem: item,
                   plan: planResult.plan,
                   todo
               });

               // Stage 2.3: Verify
               const verifyProcessor = container.resolve('grishaVerifyItemProcessor');
               const verifyResult = await verifyProcessor.execute({
                   currentItem: item,
                   execution: execResult.execution,
                   todo
               });

               if (verifyResult.verified) {
                   // Success! Mark item as completed
                   item.status = 'completed';
                   item.verification = verifyResult.verification;
                   break; // Exit retry loop
               }

               // Verification failed - need adjustment
               const adjustProcessor = container.resolve('atlasAdjustTodoProcessor');
               const adjustResult = await adjustProcessor.execute({
                   currentItem: item,
                   verification: verifyResult.verification,
                   todo,
                   attemptNumber: attempt
               });

               if (adjustResult.strategy === 'skip') {
                   item.status = 'skipped';
                   break; // Exit retry loop
               }

               // Apply adjustment and retry
               attempt++;
           }

           // Max attempts reached without success
           if (item.status !== 'completed' && item.status !== 'skipped') {
               item.status = 'failed';
           }
       }

       // Stage 8-MCP: Final Summary
       const summaryProcessor = container.resolve('mcpFinalSummaryProcessor');
       const summaryResult = await summaryProcessor.execute({
           todo,
           session
       });

       return summaryResult;
   }
   ```

4. **Keep existing Goose workflow**
   ```javascript
   async executeGooseWorkflow(session, userMessage) {
       // Existing logic - no changes
       return await this.callGooseAgent(session, userMessage);
   }
   ```

---

## ✅ Task 3: Error Handling & Fallback (2-3 hours)

**Actions:**

1. **Wrap MCP workflow in try-catch**
   ```javascript
   async executeMCPWorkflow(session, userMessage) {
       try {
           // ... MCP workflow code ...
       } catch (error) {
           logger.error('executor', `MCP workflow failed: ${error.message}`);
           
           // Emit telemetry
           telemetry.emit('workflow.mcp.failed', {
               error: error.message,
               sessionId: session.id
           });

           // Fallback to Goose
           logger.warning('executor', 'Falling back to Goose workflow');
           return await this.executeGooseWorkflow(session, userMessage);
       }
   }
   ```

2. **Add retry mechanism**
   ```javascript
   async executeWorkflowWithRetry(session, userMessage, maxRetries = 2) {
       for (let retry = 0; retry < maxRetries; retry++) {
           try {
               return await this.executeWorkflow(session, userMessage);
           } catch (error) {
               if (retry === maxRetries - 1) {
                   throw error; // Last retry failed
               }
               
               logger.warning('executor', `Retry ${retry + 1}/${maxRetries} after error: ${error.message}`);
               await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // Exponential backoff
           }
       }
   }
   ```

---

## ✅ Task 4: Testing (2-3 hours)

### Unit Tests

**File:** `tests/unit/mcp-workflow.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MCPTodoManager } from '../../orchestrator/workflow/mcp-todo-manager.js';
import { BackendSelectionProcessor } from '../../orchestrator/workflow/stages/backend-selection-processor.js';

describe('MCP Workflow', () => {
    let mcpTodoManager;
    let backendProcessor;

    beforeEach(() => {
        // Setup mocks
    });

    it('should create TODO from request', async () => {
        const todo = await mcpTodoManager.createTodo('Знайди ціни Tesla');
        expect(todo).toBeDefined();
        expect(todo.items).toHaveLength.greaterThan(0);
    });

    it('should select MCP backend for concrete actions', async () => {
        const result = await backendProcessor.execute({
            userMessage: 'Створи файл test.txt'
        });
        expect(result.backend).toBe('mcp');
    });

    it('should select Goose backend for analytical tasks', async () => {
        const result = await backendProcessor.execute({
            userMessage: 'Проаналізуй ринок Tesla'
        });
        expect(result.backend).toBe('goose');
    });
});
```

### Integration Tests

**File:** `tests/integration/mcp-todo-execution.test.js`

```javascript
describe('MCP TODO Execution', () => {
    it('should execute simple 2-item TODO', async () => {
        const result = await executor.executeMCPWorkflow(session, 'Створи файл test.txt з текстом Hello');
        
        expect(result.success).toBe(true);
        expect(result.metrics.success_rate).toBeGreaterThanOrEqual(80);
    });

    it('should handle verification failure and retry', async () => {
        // Mock verification failure
        const result = await executor.executeMCPWorkflow(session, 'Створи файл на неіснуючому шляху');
        
        expect(result.metrics.total_attempts).toBeGreaterThan(1);
    });
});
```

### E2E Tests

**File:** `tests/e2e/test-mcp-workflow.sh`

```bash
#!/bin/bash

echo "Testing MCP Dynamic TODO Workflow..."

# Test 1: Simple file creation
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt на Desktop з текстом Hello ATLAS", "sessionId": "test-1"}'

# Test 2: Complex task (browser + scraping + file)
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Знайди ціни Tesla на auto.ria, створи Excel файл, збережи на Desktop", "sessionId": "test-2"}'

# Verify logs
grep "Stage 1-MCP" logs/orchestrator.log
grep "Stage 2.1-MCP" logs/orchestrator.log
grep "Stage 8-MCP" logs/orchestrator.log
```

---

## 📊 Success Criteria

- ✅ All services registered in DI Container
- ✅ Container can resolve all dependencies
- ✅ Executor routes to MCP workflow correctly
- ✅ Backend selection works (goose/mcp/hybrid)
- ✅ Item-by-item execution loop works
- ✅ Verification triggers adjustment
- ✅ Final summary generated
- ✅ Fallback to Goose on critical errors
- ✅ Unit tests pass (>80% coverage)
- ✅ Integration tests pass
- ✅ E2E test completes successfully

---

## 🔧 Troubleshooting

### Issue: Circular dependency error
**Solution:** Check metadata.priority - higher priority services initialize first

### Issue: Processor not found
**Solution:** Verify registration in service-registry.js and import in executor

### Issue: MCP server not responding
**Solution:** Ensure MCP servers running, check `mcpManager.getAvailableTools()`

### Issue: TODO creation fails
**Solution:** Check LLM client connection, verify prompt structure

---

## 📚 Next: Phase 5 - Testing & Optimization

After Phase 4 completion:
1. Comprehensive test suite
2. Performance optimization
3. Error handling improvements
4. Documentation updates
5. Production deployment preparation

---

**🚀 LET'S INTEGRATE! 🚀**
