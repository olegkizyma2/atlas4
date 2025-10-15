/**
 * @fileoverview MCP Dynamic TODO Workflow Prompts Index
 * Exports all MCP-related prompts for workflow execution
 * 
 * OPTIMIZATION 15.10.2025: Using optimized prompts with {{AVAILABLE_TOOLS}}
 * - atlas_todo_planning_optimized.js (278 → 120 LOC)
 * - tetyana_plan_tools_optimized.js (313 → 150 LOC)
 * - grisha_verify_item_optimized.js (339 → 150 LOC)
 * 
 * @version 4.0.1
 * @date 2025-10-15
 */

import atlasTodoPlanning from './atlas_todo_planning_optimized.js';  // OPTIMIZED 15.10.2025
import tetyanaPlanTools from './tetyana_plan_tools_optimized.js';  // OPTIMIZED 15.10.2025
import grishaVerifyItem from './grisha_verify_item_optimized.js';  // OPTIMIZED 15.10.2025
import atlasAdjustTodo from './atlas_adjust_todo.js';
import mcpFinalSummary from './mcp_final_summary.js';

export const MCP_PROMPTS = {
    // Stage 1-MCP: Atlas creates TODO
    ATLAS_TODO_PLANNING: atlasTodoPlanning,

    // Stage 2.1-MCP: Tetyana plans tools (OPTIMIZED)
    TETYANA_PLAN_TOOLS: tetyanaPlanTools,

    // Stage 2.3-MCP: Grisha verifies item (OPTIMIZED)
    GRISHA_VERIFY_ITEM: grishaVerifyItem,

    // Stage 3-MCP: Atlas adjusts TODO on failure
    ATLAS_ADJUST_TODO: atlasAdjustTodo,

    // Stage 8-MCP: Final summary
    MCP_FINAL_SUMMARY: mcpFinalSummary
};

export default MCP_PROMPTS;

// Individual exports for direct import
export {
    atlasTodoPlanning,
    tetyanaPlanTools,
    grishaVerifyItem,
    atlasAdjustTodo,
    mcpFinalSummary
};
