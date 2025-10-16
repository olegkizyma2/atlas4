/**
 * ATLAS WORKFLOW EXECUTOR v5.0 - MCP Dynamic TODO Only
 * Спрощено: тільки MCP Dynamic TODO система, без Goose fallback
 */

import GlobalConfig from '../../config/global-config.js';
import { logMessage, generateMessageId } from '../utils/helpers.js';
import { sanitizeAgentMessage, sanitizeContentForUser } from '../utils/sanitizer.js';

// Centralised modules
import logger from '../utils/logger.js';
import telemetry from '../utils/telemetry.js';
import errorHandler from '../errors/error-handler.js';
import pauseState from '../state/pause-state.js';

// Helper function for Ukrainian plurals
function getPluralForm(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// MCP Stage Processors
import {
    ModeSelectionProcessor,
    AtlasTodoPlanningProcessor,
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    McpFinalSummaryProcessor
} from './stages/index.js';

// Circuit breaker for MCP workflow failures
class CircuitBreaker {
  constructor(threshold = 3, resetTimeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = null;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.warn('circuit-breaker', `Circuit breaker OPEN after ${this.failureCount} failures`);
      
      // Auto-reset after timeout
      setTimeout(() => {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
        logger.info('circuit-breaker', 'Circuit breaker entering HALF_OPEN state');
      }, this.resetTimeout);
    }
  }

  canExecute() {
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.resetTimeout) {
        return false;
      }
      this.state = 'HALF_OPEN';
    }
    return true;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.threshold
    };
  }
}

const mcpCircuitBreaker = new CircuitBreaker(3, 60000); // 3 failures, 60s reset

// ============================================================================
// HELPER FUNCTIONS (must be defined before use due to hoisting)
// ============================================================================

/**
 * Execute a configured workflow stage using the appropriate processor
 * This function determines whether to use SystemStageProcessor or AgentStageProcessor
 * based on the stage configuration and executes the stage accordingly.
 * 
 * FIXED: stage0_chat тепер обробляється через AgentStageProcessor для збереження контексту
 */
async function executeConfiguredStage(stageConfig, userMessage, session, res, options = {}) {
  if (!stageConfig) {
    throw new Error('Stage configuration is required');
  }

  // Determine processor type based on agent
  // CRITICAL FIX: stage0_chat має agent='atlas', тому використовуємо AgentStageProcessor
  const isSystemStage = stageConfig.agent === 'system';

  try {
    let processor;

    if (isSystemStage) {
      // Use SystemStageProcessor for system stages (mode_selection, stop_router, etc.)
      processor = new SystemStageProcessor(stageConfig, GlobalConfig);
      logger.info(`Using SystemStageProcessor for stage ${stageConfig.stage}: ${stageConfig.name}`);
    } else {
      // Use AgentStageProcessor for agent stages (Atlas, Tetyana, Grisha)
      // This includes stage0_chat which has agent='atlas'
      processor = new AgentStageProcessor(stageConfig, GlobalConfig);
      logger.info(`Using AgentStageProcessor for stage ${stageConfig.stage}: ${stageConfig.name} (agent: ${stageConfig.agent})`);
    }

    // Execute the stage
    const response = await processor.execute(userMessage, session, res, options);

    return response;

  } catch (error) {
    logger.error(`Stage execution failed (stage=${stageConfig.stage}, agent=${stageConfig.agent}): ${error.message}`, {
      sessionId: session.id,
      stage: stageConfig.stage,
      agent: stageConfig.agent,
      error: error.message
    });
    throw error;
  }
}

/**
 * Extract mode ('chat' or 'task') from system response
 */
function extractModeFromResponse(content) {
  try {
    // FIXED 13.10.2025 - Handle content as object or string
    let contentStr = content;
    if (typeof content === 'object' && content !== null) {
      contentStr = JSON.stringify(content);
    }
    
    const cleanContent = contentStr.replace(/^\[SYSTEM\]\s*/, '').trim();
    const json = JSON.parse(cleanContent);
    return json.mode === 'chat' ? 'chat' : 'task';
  } catch (error) {
    // Fallback parsing
    const text = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
    if (text.includes('"mode":"chat"') || text.includes('mode: chat')) {
      return 'chat';
    }
    return 'task'; // Default to task
  }
}

// ============================================================================
// MAIN WORKFLOW FUNCTIONS
// ============================================================================

/**
 * MCP DYNAMIC TODO WORKFLOW EXECUTOR (Phase 4)
 * 
 * Executes user requests through MCP TODO workflow:
 * 1. Plan TODO list (Atlas)
 * 2. For each item: Plan → Execute → Verify → Adjust (if needed)
 * 3. Generate final summary
 * 
 * @param {string} userMessage - User request
 * @param {Object} session - Session object
 * @param {Object} res - Response stream
 * @param {Object} container - DI Container for resolving processors
 * @returns {Promise<Object>} Final summary result
 */
async function executeMCPWorkflow(userMessage, session, res, container) {
  logger.workflow('init', 'mcp', 'Starting MCP Dynamic TODO Workflow', {
    sessionId: session.id,
    userMessage: userMessage.substring(0, 100)
  });

  // Get WebSocket Manager for chat updates (ADDED 14.10.2025)
  const wsManager = container.resolve('wsManager');
  
  const workflowStart = Date.now();
  
  // ✅ PHASE 4 TASK 3: Timeout protection (max 5 minutes)
  const WORKFLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  let workflowCompleted = false;
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      if (!workflowCompleted) {
        reject(new Error(`MCP workflow timeout after ${WORKFLOW_TIMEOUT_MS / 1000}s`));
      }
    }, WORKFLOW_TIMEOUT_MS);
  });

  try {
    // Resolve processors from DI Container
    const modeProcessor = container.resolve('modeSelectionProcessor');
    const todoProcessor = container.resolve('atlasTodoPlanningProcessor');
    const planProcessor = container.resolve('tetyanaПlanToolsProcessor');
    const executeProcessor = container.resolve('tetyanaExecuteToolsProcessor');
    const verifyProcessor = container.resolve('grishaVerifyItemProcessor');
    const adjustProcessor = container.resolve('atlasAdjustTodoProcessor');
    const summaryProcessor = container.resolve('mcpFinalSummaryProcessor');

    // ===============================================
    // Stage 0-MCP: Mode Selection (NEW 16.10.2025)
    // ===============================================
    logger.workflow('stage', 'system', 'Stage 0-MCP: Mode Selection', { sessionId: session.id });
    
    const modeResult = await modeProcessor.execute({
      userMessage,
      session
    });

    const mode = modeResult.mode;
    const confidence = modeResult.confidence;
    
    logger.workflow('stage', 'system', `Mode selected: ${mode} (confidence: ${confidence})`, { 
      sessionId: session.id,
      reasoning: modeResult.reasoning
    });

    // Send mode selection to frontend via SSE
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'mode_selected',
        data: {
          mode,
          confidence,
          reasoning: modeResult.reasoning
        }
      })}\n\n`);
    }

    // Send mode selection message to chat via WebSocket
    if (wsManager) {
      try {
        wsManager.broadcastToSubscribers('chat', 'agent_message', {
          content: `Режим: ${mode === 'chat' ? '💬 Розмова' : '🔧 Завдання'} (впевненість: ${Math.round(confidence * 100)}%)`,
          agent: 'system',
          sessionId: session.id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.warn('executor', `Failed to send mode selection WebSocket message: ${error.message}`);
      }
    }

    // ===============================================
    // Handle CHAT mode - Simple response from Atlas
    // ===============================================
    if (mode === 'chat') {
      logger.workflow('stage', 'atlas', 'Chat mode detected - Atlas will respond directly', { 
        sessionId: session.id 
      });

      // TODO: Implement simple chat response from Atlas
      // For now, we'll just send a message and continue to task mode
      // This can be expanded later to use a dedicated chat prompt
      
      if (wsManager) {
        try {
          wsManager.broadcastToSubscribers('chat', 'agent_message', {
            content: 'Режим розмови поки що в розробці. Переходжу до виконання як завдання...',
            agent: 'atlas',
            sessionId: session.id,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.warn('executor', `Failed to send chat mode message: ${error.message}`);
        }
      }
      
      // For now, fall through to task mode
      // In the future, we can return here after handling chat
    }

    // ===============================================
    // Stage 1-MCP: Atlas TODO Planning
    // ===============================================
    logger.workflow('stage', 'atlas', 'Stage 1-MCP: TODO Planning', { sessionId: session.id });
    
    const todoResult = await todoProcessor.execute({
      userMessage,
      session,
      res
    });

    // ✅ PHASE 4 TASK 3: Validate TODO result structure
    if (!todoResult.success) {
      throw new Error(`TODO planning failed: ${todoResult.error || 'Unknown error'}`);
    }

    if (!todoResult.todo || !todoResult.todo.items || !Array.isArray(todoResult.todo.items)) {
      throw new Error('Invalid TODO structure: missing items array');
    }

    if (todoResult.todo.items.length === 0) {
      throw new Error('TODO planning produced empty items list');
    }

    const todo = todoResult.todo;
    logger.info(`TODO created with ${todo.items.length} items`, {
      sessionId: session.id,
      mode: todo.mode,
      items: todo.items.map(item => ({
        id: item.id,
        action: item.action,
        max_attempts: item.max_attempts
      }))
    });

    // Send TODO plan to frontend via SSE
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'mcp_todo_created',
        data: {
          summary: todoResult.summary,
          itemCount: todo.items.length,
          mode: todo.mode
        }
      })}\n\n`);
    }

    // REMOVED 16.10.2025 - Duplicate message (mcp-todo-manager already sends via agent_message)
    // TODO plan is now sent correctly via agent_message with agent='atlas' in mcp-todo-manager.js line ~243

    // Execute TODO items one by one
    for (let i = 0; i < todo.items.length; i++) {
      const item = todo.items[i];
      logger.info(`Processing TODO item ${i + 1}/${todo.items.length}: ${item.action}`, {
        sessionId: session.id,
        itemId: item.id
      });

      // Send item start message via WebSocket (ADDED 14.10.2025)
      if (wsManager) {
        try {
          wsManager.broadcastToSubscribers('chat', 'chat_message', {
            message: `🔄 Виконую: ${item.action}`,
            messageType: 'progress',
            sessionId: session.id,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.warn(`Failed to send WebSocket message: ${error.message}`);
        }
      }

      let attempt = 1;
      const maxAttempts = item.max_attempts || 3;

      while (attempt <= maxAttempts) {
        logger.info(`Item ${item.id}: Attempt ${attempt}/${maxAttempts}`, {
          sessionId: session.id
        });

        // ✅ PHASE 4 TASK 3: Exponential backoff between retries
        if (attempt > 1) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 2), 8000); // Max 8s
          logger.info(`Retry backoff: waiting ${backoffDelay}ms before attempt ${attempt}`, {
            sessionId: session.id,
            itemId: item.id
          });
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        try {
          // Stage 2.1-MCP: Tetyana Plan Tools
          logger.workflow('stage', 'tetyana', `Stage 2.1-MCP: Planning tools for item ${item.id}`, {
            sessionId: session.id
          });

          const planResult = await planProcessor.execute({
            currentItem: item,
            todo,
            session,
            res
          });

          if (!planResult.success) {
            logger.warn(`Tool planning failed for item ${item.id}: ${planResult.error}`, {
              sessionId: session.id
            });
            
            // FIXED 14.10.2025 - Send error message to user when tool planning fails
            if (res.writable && !res.writableEnded) {
              res.write(`data: ${JSON.stringify({
                type: 'mcp_item_planning_failed',
                data: {
                  itemId: item.id,
                  action: item.action,
                  attempt: attempt,
                  maxAttempts: maxAttempts,
                  error: planResult.error,
                  summary: planResult.summary || `⚠️ Помилка планування інструментів (спроба ${attempt}/${maxAttempts}): ${planResult.error}`
                }
              })}\n\n`);
            }
            
            attempt++;
            continue;
          }

          // Stage 2.2-MCP: Tetyana Execute Tools
          logger.workflow('stage', 'tetyana', `Stage 2.2-MCP: Executing tools for item ${item.id}`, {
            sessionId: session.id
          });

          const execResult = await executeProcessor.execute({
            currentItem: item,
            plan: planResult.plan,
            todo,
            session,
            res
          });

          // Send execution update to frontend
          if (res.writable && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'mcp_item_executed',
              data: {
                itemId: item.id,
                action: item.action,
                success: execResult.success,
                summary: execResult.summary
              }
            })}\n\n`);
          }

          // Stage 2.3-MCP: Grisha Verify Item
          logger.workflow('stage', 'grisha', `Stage 2.3-MCP: Verifying item ${item.id}`, {
            sessionId: session.id
          });

          const verifyResult = await verifyProcessor.execute({
            currentItem: item,
            execution: execResult.execution,
            todo,
            session,
            res
          });

          // Send verification update to frontend
          if (res.writable && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'mcp_item_verified',
              data: {
                itemId: item.id,
                verified: verifyResult.verified,
                confidence: verifyResult.metadata?.confidence || 0,
                summary: verifyResult.summary
              }
            })}\n\n`);
          }

          if (verifyResult.verified) {
            // Success! Mark as completed
            item.status = 'completed';
            item.verification = verifyResult.verification;
            item.attempt = attempt;

            logger.info(`Item ${item.id} completed successfully`, {
              sessionId: session.id,
              attempts: attempt
            });

            // Success message is sent via agent_message with agent='tetyana' in mcp-todo-manager.js

            break; // Exit retry loop
          }

          // Verification failed - need adjustment
          logger.workflow('stage', 'atlas', `Stage 3-MCP: Adjusting TODO item ${item.id}`, {
            sessionId: session.id
          });

          const adjustResult = await adjustProcessor.execute({
            currentItem: item,
            verification: verifyResult.verification,
            todo,
            attemptNumber: attempt,
            session,
            res
          });

          if (adjustResult.strategy === 'skip') {
            item.status = 'skipped';
            item.skip_reason = adjustResult.reason;

            logger.warn(`Item ${item.id} skipped: ${adjustResult.reason}`, {
              sessionId: session.id
            });

            // Send skip update to frontend
            if (res.writable && !res.writableEnded) {
              res.write(`data: ${JSON.stringify({
                type: 'mcp_item_skipped',
                data: {
                  itemId: item.id,
                  reason: adjustResult.reason
                }
              })}\n\n`);
            }

            break; // Exit retry loop
          }

          // Apply adjustment and retry
          logger.info(`Item ${item.id} adjusted with strategy: ${adjustResult.strategy}`, {
            sessionId: session.id
          });

          attempt++;

        } catch (itemError) {
          // ✅ PHASE 4 TASK 3: Enhanced error logging with context
          logger.error(`Item ${item.id} execution error: ${itemError.message}`, {
            sessionId: session.id,
            itemId: item.id,
            action: item.action,
            attempt,
            maxAttempts,
            error: itemError.message,
            stack: itemError.stack,
            tools_needed: item.tools_needed,
            mcp_servers: item.mcp_servers
          });

          telemetry.emit('workflow.mcp.item_error', {
            sessionId: session.id,
            itemId: item.id,
            attempt,
            error: itemError.message
          });

          attempt++;

          if (attempt > maxAttempts) {
            item.status = 'failed';
            item.error = itemError.message;

            // ✅ PHASE 4 TASK 3: Log final failure with full context
            logger.error(`Item ${item.id} PERMANENTLY FAILED after ${maxAttempts} attempts`, {
              sessionId: session.id,
              itemId: item.id,
              action: item.action,
              totalAttempts: maxAttempts,
              finalError: itemError.message,
              context: {
                tools: item.tools_needed,
                servers: item.mcp_servers,
                dependencies: item.dependencies
              }
            });
          }
        }
      }

      // Max attempts reached without success
      if (item.status !== 'completed' && item.status !== 'skipped') {
        item.status = 'failed';
        item.error = item.error || 'Max attempts reached';

        logger.warn(`Item ${item.id} failed after ${maxAttempts} attempts`, {
          sessionId: session.id
        });

        // Send failure update to frontend
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'mcp_item_failed',
            data: {
              itemId: item.id,
              attempts: maxAttempts,
              error: item.error
            }
          })}\n\n`);
        }
      }
    }

    // Stage 8-MCP: Final Summary
    logger.workflow('stage', 'system', 'Stage 8-MCP: Generating final summary', {
      sessionId: session.id
    });

    const summaryResult = await summaryProcessor.execute({
      todo,
      session,
      res
    });

    // Send final summary to frontend
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'mcp_workflow_complete',
        data: {
          success: summaryResult.success,
          summary: summaryResult.summary,
          metrics: summaryResult.metadata?.metrics || {},
          duration: Date.now() - workflowStart
        }
      })}\n\n`);
    }

    // Add summary to session history
    session.history.push({
      role: 'assistant',
      content: summaryResult.summary,
      agent: 'system',
      timestamp: Date.now(),
      metadata: {
        workflow: 'mcp',
        metrics: summaryResult.metadata?.metrics
      }
    });

    logger.workflow('complete', 'mcp', 'MCP workflow completed', {
      sessionId: session.id,
      duration: Date.now() - workflowStart,
      metrics: summaryResult.metadata?.metrics
    });

    // ✅ PHASE 4 TASK 3: Mark workflow as completed (disables timeout)
    workflowCompleted = true;

    return summaryResult;

  } catch (error) {
    // ✅ PHASE 4 TASK 3: Mark workflow as completed on error too
    workflowCompleted = true;

    logger.error(`MCP workflow failed: ${error.message}`, {
      sessionId: session.id,
      error: error.message,
      stack: error.stack
    });

    // Send error to frontend
    if (res && res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'mcp_workflow_error',
        data: {
          error: error.message,
          sessionId: session.id
        }
      })}\n\n`);
    }

    throw error;
  }
}

/**
 * MAIN STEP-BY-STEP WORKFLOW EXECUTOR
 * Використовує unified configuration та prompt registry
 */
export async function executeStepByStepWorkflow(userMessage, session, res, options = {}) {
  // Add user message to history
  session.history.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  });

  const workflowStart = Date.now();
  logger.workflow('init', 'mcp', 'Starting MCP Dynamic TODO Workflow', {
    sessionId: session.id,
    userMessage: userMessage.substring(0, 100)
  });

  try {
    // Validate DI Container
    const container = session.container;
    if (!container) {
      const error = new Error('DI Container not available in session - cannot execute MCP workflow');
      logger.error('executor', '❌ DI Container unavailable', {
        sessionId: session.id
      });
      
      if (res.writable && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: 'workflow_error',
          data: {
            error: 'System initialization error',
            message: 'DI Container not available'
          }
        })}\n\n`);
        res.end();
      }
      
      throw error;
    }

    // Execute MCP Dynamic TODO Workflow
    return await executeMCPWorkflow(userMessage, session, res, container);

  } catch (error) {
    logger.error('MCP workflow failed', {
      error: error.message,
      sessionId: session.id,
      stack: error.stack
    });

    if (!res.headersSent && res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'Workflow failed',
          details: error.message
        }
      })}\n\n`);
    }

    throw error;
  }
}

/**
 * LEGACY COMPATIBILITY - Deprecated
 * Use executeMCPWorkflow directly instead
 */
export async function executeAgentStageStepByStep(
  agentName,
  stageName,
  systemPrompt,
  userPrompt,
  session,
  res,
  options = {}
) {
  logger.warn('Using deprecated executeAgentStageStepByStep, MCP workflow recommended');
  
  // For backward compatibility, delegate to MCP workflow
  const container = session.container;
  if (!container) {
    throw new Error('DI Container not available - cannot execute workflow');
  }
  
  return await executeMCPWorkflow(userPrompt, session, res, container);
}
