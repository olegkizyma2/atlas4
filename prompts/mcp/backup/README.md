# MCP Prompts Backup - Non-Optimized Versions

**Date:** 2025-10-15  
**Reason:** System uses optimized versions, moved here to avoid confusion

## Files in Backup

### 1. atlas_todo_planning.js (11KB)
- **Status:** NOT USED
- **Replaced by:** `atlas_todo_planning_optimized.js`
- **Difference:** Contains hardcoded list of 92 MCP tools (~3000 tokens)
- **Optimized version:** Uses `{{AVAILABLE_TOOLS}}` placeholder (~500 tokens)

### 2. tetyana_plan_tools.js (13KB)
- **Status:** NOT USED
- **Replaced by:** `tetyana_plan_tools_optimized.js`
- **Difference:** Contains hardcoded tool lists and verbose examples
- **Optimized version:** Uses dynamic tools list, shorter examples

### 3. grisha_verify_item.js (15KB)
- **Status:** NOT USED
- **Replaced by:** `grisha_verify_item_optimized.js`
- **Difference:** Contains hardcoded tool lists
- **Optimized version:** Uses `{{AVAILABLE_TOOLS}}` placeholder

## Active Prompts (in parent directory)

✅ **atlas_todo_planning_optimized.js** - Stage 1-MCP (Atlas creates TODO)  
✅ **tetyana_plan_tools_optimized.js** - Stage 2.1-MCP (Tetyana plans tools)  
✅ **grisha_verify_item_optimized.js** - Stage 2.3-MCP (Grisha verifies)  
✅ **atlas_adjust_todo.js** - Stage 3-MCP (Atlas adjusts on failure)  
✅ **mcp_final_summary.js** - Stage 8-MCP (Final summary)

## Why Optimized?

**Benefits:**
- 🚀 Faster LLM responses (less tokens to process)
- 💰 Lower API costs (fewer tokens)
- 🔄 Dynamic tool list (auto-updates when MCP servers change)
- 🎯 More focused prompts (less noise)

**Token Reduction:**
- atlas_todo_planning: 278 → 120 LOC (~57% reduction)
- tetyana_plan_tools: 313 → 150 LOC (~52% reduction)
- grisha_verify_item: 339 → 150 LOC (~56% reduction)

## When to Use Non-Optimized Versions?

**Never in production.** These are kept for:
- Reference/comparison
- Debugging if optimized versions have issues
- Understanding original prompt structure

## Restoration

If you need to restore non-optimized versions:

```bash
# Copy back to parent directory
cp backup/atlas_todo_planning.js ../
cp backup/tetyana_plan_tools.js ../
cp backup/grisha_verify_item.js ../

# Update index.js imports
# Change: atlas_todo_planning_optimized.js → atlas_todo_planning.js
# Change: tetyana_plan_tools_optimized.js → tetyana_plan_tools.js
# Change: grisha_verify_item_optimized.js → grisha_verify_item.js

# Restart system
./restart_system.sh restart
```

## See Also

- `MCP_APPLESCRIPT_FIX_COMPLETE.md` - AppleScript tool name fix
- `MCP_APPLESCRIPT_TOOL_NAME_FIX_V2.md` - Why optimized prompts needed fixing
