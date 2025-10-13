/**
 * @fileoverview MCP Dynamic TODO Workflow Prompts Index
 * Exports all MCP-related prompts for workflow execution
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import atlasTodoPlanning from './atlas_todo_planning.js';
import tetyanaPlanTools from './tetyana_plan_tools.js';
import grishaVerifyItem from './grisha_verify_item.js';
import atlasAdjustTodo from './atlas_adjust_todo.js';
import mcpFinalSummary from './mcp_final_summary.js';

export const MCP_PROMPTS = {
    // Stage 1-MCP: Atlas creates TODO
    ATLAS_TODO_PLANNING: atlasTodoPlanning,
    
    // Stage 2.1-MCP: Tetyana plans tools
    TETYANA_PLAN_TOOLS: tetyanaPlanTools,
    
    // Stage 2.3-MCP: Grisha verifies item
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
