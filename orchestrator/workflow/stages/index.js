/**
 * @fileoverview MCP Stage Processors - Export Module
 * Centralizes exports for all MCP workflow stage processors
 * 
 * @version 4.2.0
 * @date 2025-10-15
 */

import { BackendSelectionProcessor } from './backend-selection-processor.js';
import { AtlasTodoPlanningProcessor } from './atlas-todo-planning-processor.js';
import { ServerSelectionProcessor } from './server-selection-processor.js';  // NEW 15.10.2025
import { TetyanaПlanToolsProcessor } from './tetyana-plan-tools-processor.js';
import { TetyanaExecuteToolsProcessor } from './tetyana-execute-tools-processor.js';
import { GrishaVerifyItemProcessor } from './grisha-verify-item-processor.js';
import { AtlasAdjustTodoProcessor } from './atlas-adjust-todo-processor.js';
import { McpFinalSummaryProcessor } from './mcp-final-summary-processor.js';

// Re-export individual classes
export {
    BackendSelectionProcessor,
    AtlasTodoPlanningProcessor,
    ServerSelectionProcessor,  // NEW 15.10.2025
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    McpFinalSummaryProcessor
};

/**
 * MCP Processors collection
 * 
 * Maps stage names to processor classes for easy instantiation
 */
export const MCP_PROCESSORS = {
    // Stage 0.5 - Backend Selection
    BACKEND_SELECTION: BackendSelectionProcessor,
    
    // Stage 1-MCP - Atlas TODO Planning
    ATLAS_TODO_PLANNING: AtlasTodoPlanningProcessor,
    
    // Stage 2.0-MCP - Server Selection (NEW 15.10.2025)
    SERVER_SELECTION: ServerSelectionProcessor,
    
    // Stage 2.1-MCP - Tetyana Plan Tools
    TETYANA_PLAN_TOOLS: TetyanaПlanToolsProcessor,
    
    // Stage 2.2-MCP - Tetyana Execute Tools
    TETYANA_EXECUTE_TOOLS: TetyanaExecuteToolsProcessor,
    
    // Stage 2.3-MCP - Grisha Verify Item
    GRISHA_VERIFY_ITEM: GrishaVerifyItemProcessor,
    
    // Stage 3-MCP - Atlas Adjust TODO
    ATLAS_ADJUST_TODO: AtlasAdjustTodoProcessor,
    
    // Stage 8-MCP - MCP Final Summary
    MCP_FINAL_SUMMARY: McpFinalSummaryProcessor
};

export default MCP_PROCESSORS;
