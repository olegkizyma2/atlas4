# MCP Dynamic TODO Workflow Prompts

**Version:** 4.0.1  
**Date:** 2025-10-15  
**Status:** OPTIMIZED ✅

## Active Prompts (Used by System)

### Stage 1-MCP: Atlas Creates TODO
**File:** `atlas_todo_planning_optimized.js`  
**Agent:** Atlas  
**Purpose:** Analyze user request and create structured TODO list  
**Modes:** Standard (1-3 items) | Extended (4-10 items)  
**Optimization:** Uses `{{AVAILABLE_TOOLS}}` placeholder (278 → 120 LOC)

### Stage 2.1-MCP: Tetyana Plans Tools
**File:** `tetyana_plan_tools_optimized.js`  
**Agent:** Tetyana  
**Purpose:** Select optimal MCP tools for TODO item execution  
**Output:** JSON tool execution plan  
**Optimization:** Dynamic tools list (313 → 150 LOC)  
**Critical:** Contains AppleScript tool name fix (applescript_execute)

### Stage 2.3-MCP: Grisha Verifies Item
**File:** `grisha_verify_item_optimized.js`  
**Agent:** Grisha  
**Purpose:** Verify TODO item completion against success criteria  
**Output:** Verification result with evidence  
**Optimization:** Uses `{{AVAILABLE_TOOLS}}` placeholder (339 → 150 LOC)

### Stage 3-MCP: Atlas Adjusts TODO
**File:** `atlas_adjust_todo.js`  
**Agent:** Atlas  
**Purpose:** Adjust TODO item on failure (retry/alternative/skip)  
**Output:** Updated TODO item with new strategy

### Stage 8-MCP: Final Summary
**File:** `mcp_final_summary.js`  
**Agent:** System  
**Purpose:** Generate final execution summary  
**Output:** Human-readable summary with metrics

## File Structure

```
prompts/mcp/
├── index.js                              # Exports all prompts
├── atlas_todo_planning_optimized.js      # ✅ ACTIVE
├── tetyana_plan_tools_optimized.js       # ✅ ACTIVE (AppleScript fix)
├── grisha_verify_item_optimized.js       # ✅ ACTIVE
├── atlas_adjust_todo.js                  # ✅ ACTIVE
├── mcp_final_summary.js                  # ✅ ACTIVE
├── backup/                               # Non-optimized versions (NOT USED)
│   ├── README.md
│   ├── atlas_todo_planning.js
│   ├── tetyana_plan_tools.js
│   └── grisha_verify_item.js
└── README.md                             # This file
```

## Optimization Benefits

### Token Reduction
- **atlas_todo_planning:** ~57% reduction (278 → 120 LOC)
- **tetyana_plan_tools:** ~52% reduction (313 → 150 LOC)
- **grisha_verify_item:** ~56% reduction (339 → 150 LOC)

### Dynamic Tools List
Instead of hardcoding 92 tools (~3000 tokens), optimized prompts use:
```javascript
{{AVAILABLE_TOOLS}}  // Replaced at runtime by MCPManager.getToolsSummary()
```

### Benefits:
- 🚀 Faster LLM responses (less tokens to process)
- 💰 Lower API costs (fewer input tokens)
- 🔄 Auto-updates when MCP servers change
- 🎯 More focused prompts (less noise)

## Recent Fixes

### AppleScript Tool Name Fix (2025-10-15)
**Problem:** LLM generated `{"server": "applescript", "tool": "execute"}`  
**Solution:** Added critical instructions to `tetyana_plan_tools_optimized.js`  
**Result:** Now generates `{"server": "applescript", "tool": "applescript_execute"}`

**Files updated:**
- ✅ `tetyana_plan_tools_optimized.js` - Added examples and critical section
- ✅ `atlas_todo_planning_optimized.js` - Clarified rule #9

**See:** `MCP_APPLESCRIPT_FIX_COMPLETE.md` for details

## Usage

Prompts are automatically loaded by the orchestrator via `index.js`:

```javascript
import { MCP_PROMPTS } from './prompts/mcp/index.js';

// Access prompts
const todoPrompt = MCP_PROMPTS.ATLAS_TODO_PLANNING;
const planPrompt = MCP_PROMPTS.TETYANA_PLAN_TOOLS;
const verifyPrompt = MCP_PROMPTS.GRISHA_VERIFY_ITEM;
```

## Modifying Prompts

1. Edit the optimized version (e.g., `tetyana_plan_tools_optimized.js`)
2. Restart orchestrator to reload prompts:
   ```bash
   ./restart_system.sh restart
   ```
3. Test changes with a simple command
4. Check logs for validation errors

## Available MCP Servers

The `{{AVAILABLE_TOOLS}}` placeholder is replaced with:

```
- **shell** (9 tools): get_platform_info, execute_command, get_whitelist...
- **memory** (9 tools): create_entities, create_relations, add_observations...
- **filesystem** (14 tools): read_file, write_file, list_directory...
- **playwright** (32 tools): playwright_navigate, playwright_click...
- **applescript** (1 tool): applescript_execute
- **git** (0 tools): (dynamically loaded)
```

## Testing

After modifying prompts, test with:

```bash
# Test calculator (AppleScript)
"Відкрий калькулятор і перемнож 333 на 2"

# Test file operations (filesystem)
"Створи файл test.txt на Desktop"

# Test web automation (playwright)
"Відкрий google.com та зроби screenshot"
```

Check logs:
```bash
tail -f logs/orchestrator.log | grep -E "(TODO|STAGE|validation)"
```

## Backup

Non-optimized versions are in `backup/` directory:
- `atlas_todo_planning.js` (11KB)
- `tetyana_plan_tools.js` (13KB)
- `grisha_verify_item.js` (15KB)

**These are NOT used by the system.** Kept for reference only.

## See Also

- `../../config/global-config.js` - MCP server configuration
- `../../orchestrator/ai/mcp-manager.js` - MCP Manager implementation
- `../../orchestrator/workflow/mcp-todo-manager.js` - TODO workflow manager
- `MCP_APPLESCRIPT_FIX_COMPLETE.md` - AppleScript fix documentation
