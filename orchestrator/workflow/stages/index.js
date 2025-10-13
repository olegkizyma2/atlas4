/**
 * @fileoverview MCP Stage Processors - Export Module
 * Centralizes exports for all MCP workflow stage processors
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

export { BackendSelectionProcessor } from './backend-selection-processor.js';
export { AtlasTodoPlanningProcessor } from './atlas-todo-planning-processor.js';
export { TetyanaПlanToolsProcessor } from './tetyana-plan-tools-processor.js';
export { TetyanaExecuteToolsProcessor } from './tetyana-execute-tools-processor.js';
export { GrishaVerifyItemProcessor } from './grisha-verify-item-processor.js';
export { AtlasAdjustTodoProcessor } from './atlas-adjust-todo-processor.js';
export { McpFinalSummaryProcessor } from './mcp-final-summary-processor.js';

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
