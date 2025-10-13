# Phase 3 Implementation Checklist - Stage Processors

**Target:** 7 Stage Processors для MCP Dynamic TODO Workflow  
**ETA:** 2-3 дні  
**Prerequisites:** Phase 1+2 COMPLETED ✅

---

## 📋 STAGE PROCESSORS TO CREATE

### ✅ Phase 1+2 (COMPLETED)
- [x] MCPTodoManager (orchestrator/workflow/mcp-todo-manager.js)
- [x] TTSSyncManager (orchestrator/workflow/tts-sync-manager.js)
- [x] 5 MCP Prompts (prompts/mcp/*.js)

---

### ⏳ Phase 3 (NEXT - 7 Processors)

#### 1. Backend Selection Processor
- [ ] **File:** `orchestrator/workflow/stages/backend-selection-processor.js`
- **Purpose:** Route requests to Goose or MCP workflow
- **Logic:**
  - Analyze request keywords
  - Check AI_BACKEND_CONFIG.mode
  - Return 'goose' or 'mcp' decision
- **Keywords:**
  - MCP: 'створи файл', 'скріншот', 'desktop', 'відкрий браузер'
  - Goose: 'проаналізуй', 'порівняй', 'поясни', 'знайди інфо'
- **Estimate:** 100-150 LOC

---

#### 2. Atlas TODO Planning Processor
- [ ] **File:** `orchestrator/workflow/stages/atlas-todo-planning-processor.js`
- **Purpose:** Create TODO list from user request (Stage 1-MCP)
- **Dependencies:**
  - MCPTodoManager.createTodo()
  - LLMClient (atlas_todo_planning prompt)
- **Input:** User request + context
- **Output:** TodoList (standard/extended mode)
- **Estimate:** 150-200 LOC

---

#### 3. Tetyana Plan Tools Processor
- [ ] **File:** `orchestrator/workflow/stages/tetyana-plan-tools-processor.js`
- **Purpose:** Select MCP tools for TODO item (Stage 2.1-MCP)
- **Dependencies:**
  - MCPTodoManager.planTools()
  - LLMClient (tetyana_plan_tools prompt)
  - MCPManager.listTools() - available tools
- **Input:** TodoItem + available tools
- **Output:** Tool execution plan
- **Estimate:** 120-150 LOC

---

#### 4. Tetyana Execute Tools Processor
- [ ] **File:** `orchestrator/workflow/stages/tetyana-execute-tools-processor.js`
- **Purpose:** Execute planned MCP tools (Stage 2.2-MCP)
- **Dependencies:**
  - MCPTodoManager.executeTools()
  - MCPManager.executeTool()
- **Input:** Tool plan + TodoItem
- **Output:** Execution results
- **Estimate:** 150-180 LOC

---

#### 5. Grisha Verify Item Processor
- [ ] **File:** `orchestrator/workflow/stages/grisha-verify-item-processor.js`
- **Purpose:** Verify TODO item execution (Stage 2.3-MCP)
- **Dependencies:**
  - MCPTodoManager.verifyItem()
  - LLMClient (grisha_verify_item prompt)
  - MCPManager (для verification tools)
- **Input:** TodoItem + execution results
- **Output:** Verification (verified: true/false + evidence)
- **Estimate:** 130-160 LOC

---

#### 6. Atlas Adjust TODO Processor
- [ ] **File:** `orchestrator/workflow/stages/atlas-adjust-todo-processor.js`
- **Purpose:** Adjust TODO item on failure (Stage 3-MCP)
- **Dependencies:**
  - MCPTodoManager.adjustTodoItem()
  - LLMClient (atlas_adjust_todo prompt)
- **Input:** Failed item + verification + attempt
- **Output:** Adjustment plan (strategy + updated item)
- **Strategies:** retry, modify, split, skip
- **Estimate:** 140-170 LOC

---

#### 7. MCP Final Summary Processor
- [ ] **File:** `orchestrator/workflow/stages/mcp-final-summary-processor.js`
- **Purpose:** Generate workflow summary (Stage 8-MCP)
- **Dependencies:**
  - MCPTodoManager.generateSummary()
  - LLMClient (mcp_final_summary prompt)
- **Input:** Completed TodoList
- **Output:** Text summary (success rate, results, issues)
- **Estimate:** 120-150 LOC

---

## 📐 PROCESSOR ARCHITECTURE TEMPLATE

```javascript
/**
 * @fileoverview [Stage Name] Processor
 * [Description]
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../../utils/logger.js';

export class [StageName]Processor {
    constructor({ mcpTodoManager, llmClient, mcpManager, logger: loggerInstance }) {
        this.mcpTodoManager = mcpTodoManager;
        this.llmClient = llmClient;
        this.mcpManager = mcpManager;
        this.logger = loggerInstance || logger;
    }

    /**
     * Execute stage
     * 
     * @param {Object} context - Stage context
     * @returns {Promise<Object>} Stage result
     */
    async execute(context) {
        this.logger.system('stage-processor', `[STAGE-X-MCP] Starting...`);

        try {
            // Stage-specific logic here
            
            return {
                success: true,
                result: /* ... */,
                metadata: { /* ... */ }
            };

        } catch (error) {
            this.logger.error('stage-processor', `[STAGE-X-MCP] Failed: ${error.message}`);
            throw error;
        }
    }
}

export default [StageName]Processor;
```

---

## 🔗 INTEGRATION POINTS

### **Executor Integration:**
```javascript
// executor-v3.js modifications needed:

// 1. Import processors
import BackendSelectionProcessor from './stages/backend-selection-processor.js';
import AtlasTodoPlanningProcessor from './stages/atlas-todo-planning-processor.js';
// ... (all 7)

// 2. Route to MCP workflow
if (backendMode === 'mcp') {
    // Execute MCP TODO workflow
    const todoList = await atlasTodoPlanningProcessor.execute(context);
    const results = await mcpTodoManager.executeTodo(todoList);
    return results;
}
```

### **DI Container Registration:**
```javascript
// orchestrator/core/service-registry.js

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

---

## ✅ TESTING PLAN

### **Unit Tests:**
- [ ] MCPTodoManager methods
- [ ] TTSSyncManager queue logic
- [ ] Each processor execute()
- [ ] Prompt structure validation

### **Integration Tests:**
- [ ] Full TODO workflow (create → execute → verify → summary)
- [ ] Retry logic (3 attempts with adjustment)
- [ ] TTS synchronization
- [ ] Dependency resolution

### **E2E Tests:**
- [ ] Simple task (standard mode, 2 items)
- [ ] Complex task (extended mode, 6 items)
- [ ] Failure recovery (with Atlas adjustment)
- [ ] Goose vs MCP routing

---

## 📊 PROGRESS TRACKING

**Current:** Phase 2 COMPLETED (40%)

**Phase 3 Progress:**
- Processors: 0/7 (0%)
- When all 7 done: 60% total

**Timeline:**
- Day 1: Processors 1-3 (backend, planning, tool planning)
- Day 2: Processors 4-6 (execute, verify, adjust)
- Day 3: Processor 7 + testing (summary + tests)

---

## 🚀 QUICK START PHASE 3

```bash
# 1. Create stage processors directory (якщо немає)
mkdir -p orchestrator/workflow/stages

# 2. Start with processor #1
# Create backend-selection-processor.js
# Test routing logic

# 3. Continue with processors #2-7
# Each processor = 1-2 hours work

# 4. Integration
# Update executor-v3.js
# Register in DI container

# 5. Testing
# Create test files
# Run E2E tests
```

---

**READY TO START!** 🎯

Наступний крок: Створити `backend-selection-processor.js` (processor #1).
