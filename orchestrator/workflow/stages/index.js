/**
 * @fileoverview MCP Stage Processors - Export Module
 * Centralizes exports for all MCP workflow stage processors
 * 
 * @version 5.0.0 - MCP-only
 * @date 2025-10-16
 */

import { ModeSelectionProcessor } from './mode-selection-processor.js';
import { AtlasTodoPlanningProcessor } from './atlas-todo-planning-processor.js';
import { ServerSelectionProcessor } from './server-selection-processor.js';
import { TetyanaПlanToolsProcessor } from './tetyana-plan-tools-processor.js';
import { TetyanaExecuteToolsProcessor } from './tetyana-execute-tools-processor.js';
import { GrishaVerifyItemProcessor } from './grisha-verify-item-processor.js';
import { AtlasAdjustTodoProcessor } from './atlas-adjust-todo-processor.js';
import { AtlasReplanProcessor } from './atlas-replan-processor.js';
import { McpFinalSummaryProcessor } from './mcp-final-summary-processor.js';

// Re-export individual classes
export {
    ModeSelectionProcessor,
    AtlasTodoPlanningProcessor,
    ServerSelectionProcessor,
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    AtlasReplanProcessor,
    McpFinalSummaryProcessor
};

/**
 * MCP Processors collection
 * 
 * Maps stage names to processor classes for easy instantiation
 */
export const MCP_PROCESSORS = {
    // Stage 0-MCP - Mode Selection (NEW 16.10.2025)
    MODE_SELECTION: ModeSelectionProcessor,

    // Stage 1-MCP - Atlas TODO Planning
    ATLAS_TODO_PLANNING: AtlasTodoPlanningProcessor,
    
    // Stage 2.0-MCP - Server Selection
    SERVER_SELECTION: ServerSelectionProcessor,
    
    // Stage 2.1-MCP - Tetyana Plan Tools
    TETYANA_PLAN_TOOLS: TetyanaПlanToolsProcessor,
    
    // Stage 2.2-MCP - Tetyana Execute Tools
    TETYANA_EXECUTE_TOOLS: TetyanaExecuteToolsProcessor,
    
    // Stage 2.3-MCP - Grisha Verify Item
    GRISHA_VERIFY_ITEM: GrishaVerifyItemProcessor,
    
    // Stage 3-MCP - Atlas Adjust TODO
    ATLAS_ADJUST_TODO: AtlasAdjustTodoProcessor,
    
    // Stage 3.5-MCP - Atlas Replan TODO (NEW 18.10.2025)
    ATLAS_REPLAN_TODO: AtlasReplanProcessor,
    
    // Stage 8-MCP - MCP Final Summary
    MCP_FINAL_SUMMARY: McpFinalSummaryProcessor
};

export default MCP_PROCESSORS;
