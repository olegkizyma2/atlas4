/**
 * @fileoverview MCP Dynamic TODO Workflow Prompts Index
 * Exports all MCP-related prompts for workflow execution
 * 
 * OPTIMIZATION 15.10.2025: Using optimized prompts with {{AVAILABLE_TOOLS}}
 * - atlas_todo_planning_optimized.js (278 → 120 LOC)
 * - tetyana_plan_tools_optimized.js (313 → 150 LOC)
 * - grisha_verify_item_optimized.js (339 → 150 LOC)
 * 
 * REFACTORED 17.10.2025: Visual verification for Grisha
 * - grisha_visual_verify_item.js (NEW) - AI vision-based verification
 * - Removed MCP tool dependencies from Grisha
 * 
 * NEW 15.10.2025: Server Selection Stage for intelligent tool filtering
 * - stage2_0_server_selection.js (NEW) - Pre-selects 1-2 MCP servers before Tetyana
 * 
 * NEW 16.10.2025: Mode Selection Stage for chat vs task routing
 * - stage0_mode_selection.js (NEW) - Determines if request is chat or task
 * 
 * @version 5.0.0
 * @date 2025-10-17
 */

import modeSelection from './stage0_mode_selection.js';  // NEW 16.10.2025
import atlasChat from './atlas_chat.js';  // NEW 16.10.2025 - Chat mode prompt
import atlasTodoPlanning from './atlas_todo_planning_optimized.js';  // OPTIMIZED 15.10.2025
import serverSelection from './stage2_0_server_selection.js';  // NEW 15.10.2025
import tetyanaPlanTools from './tetyana_plan_tools_optimized.js';  // OPTIMIZED 15.10.2025
import tetyanaScreenshotAndAdjust from './tetyana_screenshot_and_adjust.js';  // NEW 16.10.2025
import grishaVerifyItem from './grisha_verify_item_optimized.js';  // OPTIMIZED 15.10.2025 (legacy MCP tools)
import grishaVisualVerifyItem from './grisha_visual_verify_item.js';  // NEW 17.10.2025 - Visual AI verification
import atlasAdjustTodo from './atlas_adjust_todo.js';
import mcpFinalSummary from './mcp_final_summary.js';

export const MCP_PROMPTS = {
    // Stage 0-MCP: Mode Selection (NEW 16.10.2025)
    MODE_SELECTION: modeSelection,

    // Stage 0-MCP: Chat Mode (NEW 16.10.2025) - Atlas responds directly
    ATLAS_CHAT: atlasChat,

    // Stage 1-MCP: Atlas creates TODO
    ATLAS_TODO_PLANNING: atlasTodoPlanning,

    // Stage 2.0-MCP: Server Selection (NEW 15.10.2025) - Pre-select MCP servers
    SERVER_SELECTION: serverSelection,

    // Stage 2.1-MCP: Tetyana plans tools (OPTIMIZED)
    TETYANA_PLAN_TOOLS: tetyanaPlanTools,

    // Stage 2.1.5-MCP: Tetyana screenshot and adjust (NEW 16.10.2025)
    TETYANA_SCREENSHOT_AND_ADJUST: tetyanaScreenshotAndAdjust,

    // Stage 2.3-MCP: Grisha verifies item (VISUAL VERIFICATION - NEW 17.10.2025)
    GRISHA_VERIFY_ITEM: grishaVisualVerifyItem,  // CHANGED: Now uses visual AI verification
    
    // Legacy MCP tools verification (deprecated)
    GRISHA_VERIFY_ITEM_LEGACY: grishaVerifyItem,

    // Stage 3-MCP: Atlas adjusts TODO on failure
    ATLAS_ADJUST_TODO: atlasAdjustTodo,

    // Stage 8-MCP: Final summary
    MCP_FINAL_SUMMARY: mcpFinalSummary
};

export default MCP_PROMPTS;

// Individual exports for direct import
export {
    modeSelection,
    atlasChat,
    atlasTodoPlanning,
    serverSelection,
    tetyanaPlanTools,
    tetyanaScreenshotAndAdjust,
    grishaVerifyItem,
    grishaVisualVerifyItem,  // NEW 17.10.2025
    atlasAdjustTodo,
    mcpFinalSummary
};
