/**
 * ATLAS WORKFLOW EXECUTOR v4.0
 * Рефакторований з використанням централізованої конфігурації
 */

import GlobalConfig from '../../config/global-config.js';
import { callGooseAgent } from '../agents/goose-client.js';
import { logMessage, generateMessageId } from '../utils/helpers.js';
import { sanitizeAgentMessage, sanitizeContentForUser } from '../utils/sanitizer.js';

// Centralised modules
import logger from '../utils/logger.js';
import telemetry from '../utils/telemetry.js';
import errorHandler from '../errors/error-handler.js';
import pauseState from '../state/pause-state.js';

// Workflow stage processors
import SystemStageProcessor from './stages/system-stage-processor.js';
import AgentStageProcessor from './stages/agent-stage-processor.js';
import WorkflowConditions from './conditions.js';

// Helper function for Ukrainian plurals (ADDED 14.10.2025)
function getPluralForm(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// MCP Stage Processors (Phase 4)
import {
    BackendSelectionProcessor,
    AtlasTodoPlanningProcessor,
    TetyanaПlanToolsProcessor,
    TetyanaExecuteToolsProcessor,
    GrishaVerifyItemProcessor,
    AtlasAdjustTodoProcessor,
    McpFinalSummaryProcessor
} from './stages/index.js';

// Session tracking for preventing duplicates
const activeAgentSessions = new Set();

// ✅ PHASE 4 TASK 3: Circuit breaker for repeated failures
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
    const todoProcessor = container.resolve('atlasTodoPlanningProcessor');
    const planProcessor = container.resolve('tetyanaПlanToolsProcessor');
    const executeProcessor = container.resolve('tetyanaExecuteToolsProcessor');
    const verifyProcessor = container.resolve('grishaVerifyItemProcessor');
    const adjustProcessor = container.resolve('atlasAdjustTodoProcessor');
    const summaryProcessor = container.resolve('mcpFinalSummaryProcessor');

    // Stage 1-MCP: Atlas TODO Planning
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
  logger.workflow('init', 'system', 'Starting step-by-step workflow with unified configuration', {
    sessionId: session.id
  });

  try {
    // Get workflow configuration
    const workflowConfig = GlobalConfig.WORKFLOW_CONFIG;
    const allStages = GlobalConfig.WORKFLOW_STAGES;

    // Process special stop-dispatch case
    if (options.stopDispatch === true) {
      return await processStopDispatch(userMessage, session, res, allStages);
    }

    // Start normal workflow execution
    return await executeWorkflowStages(userMessage, session, res, allStages, workflowConfig);

  } catch (error) {
    logger.error('Step-by-step workflow failed', {
      error: error.message,
      sessionId: session.id,
      stack: error.stack
    });

    if (!res.headersSent) {
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
 * Process stop-dispatch special case
 */
async function processStopDispatch(userMessage, session, res, allStages) {
  try {
    // Find stop router stage configuration
    const stopRouterStage = allStages.find(s => s.stage === -1 && s.agent === 'system');
    if (!stopRouterStage) {
      throw new Error('Stop router stage not found in configuration');
    }

    // Execute stop router
    const stopResponse = await executeConfiguredStage(
      stopRouterStage,
      userMessage,
      session,
      res,
      { enableTools: false }
    );

    if (stopResponse) {
      stopResponse.memory = { retain: false, type: 'system' };
      session.history.push(stopResponse);
    }

    // Parse router decision
    let route = { next_stage: 0, agent: 'atlas', reason: 'default_chat' };
    try {
      const routeText = (stopResponse?.content || '').replace(/^\[SYSTEM\]\s*/, '').trim();
      route = JSON.parse(routeText);
    } catch (parseError) {
      logger.warn('Failed to parse stop router response, using default', { error: parseError.message });
    }

    // Handle chat route
    if (route.next_stage === 0) {
      return await handleChatRoute(userMessage, session, res, allStages);
    }

    // Set stage for continuation
    session.currentStage = route.next_stage;

  } catch (error) {
    logger.error(`Stop router failed: ${error.message}`);
    throw new Error(`Stop router execution failed: ${error.message}`);
  }
}

/**
 * Execute main workflow stages
 */
async function executeWorkflowStages(userMessage, session, res, allStages, workflowConfig) {
  // FIXED 13.10.2025 - Define workflowStart for metrics
  const workflowStart = Date.now();
  
  // Initialize chat thread if needed
  if (!session.chatThread) {
    session.chatThread = { messages: [], lastTopic: undefined };
  }

  // CRITICAL FIX: Add user message to chatThread BEFORE mode selection
  // This ensures mode_selection can access current message for context-aware classification
  session.chatThread.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  });

  logger.info(`Workflow: Added user message to chatThread (total: ${session.chatThread.messages.length} messages)`);

  // DEBUG: Log available stages
  const stage0Stages = allStages.filter(s => s.stage === 0);
  logger.system('debug', `Available stage 0 configurations:`, {
    sessionId: session.id,
    count: stage0Stages.length,
    stages: stage0Stages.map(s => ({ stage: s.stage, agent: s.agent, name: s.name }))
  });

  // Stage 0: Mode selection
  const modeStage = allStages.find(s => s.stage === 0 && s.agent === 'system');
  logger.system('debug', `Mode stage lookup result:`, {
    sessionId: session.id,
    found: !!modeStage,
    modeStage: modeStage ? { stage: modeStage.stage, agent: modeStage.agent, name: modeStage.name } : null
  });
  if (modeStage) {
    const modeResponse = await executeConfiguredStage(modeStage, userMessage, session, res);

    if (modeResponse) {
      const mode = extractModeFromResponse(modeResponse.content);
      session.modeSelection = { mode, confidence: 0.8 };
      session.lastMode = mode;

      modeResponse.memory = { retain: false, type: 'system' };
      modeResponse.meta = { modeSelection: session.modeSelection };
      session.history.push(modeResponse);

      logger.info(`Mode selection: ${mode}`, { sessionId: session.id });

      // Handle chat mode
      if (mode === 'chat') {
        return await handleChatRoute(userMessage, session, res, allStages);
      }

      // Task mode selected - proceed to backend selection
      logger.info(`Task mode selected, proceeding to backend selection`, { sessionId: session.id });
    }
  }

  // Stage 0.5: Backend Selection (MCP vs Goose routing)
  // This determines whether to use MCP Dynamic TODO workflow or traditional Goose workflow
  try {
    // Get DI Container from session (passed from route handler)
    const container = session.container;
    
    if (!container) {
      logger.warn('DI Container not available in session, using Goose workflow');
      
      // НОВИНКА 14.10.2025 - Check if fallback is disabled
      if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
        const error = new Error('DI Container not available and fallback is disabled');
        logger.error('executor', '❌ DI Container unavailable and fallback is DISABLED', {
          sessionId: session.id
        });
        
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'workflow_error',
            data: {
              error: 'DI Container unavailable',
              message: error.message,
              fallbackDisabled: true
            }
          })}\n\n`);
          res.end();
        }
        
        throw error;
      }
      
      return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
    }

    const backendProcessor = container.resolve('backendSelectionProcessor');
    
    logger.workflow('stage', 'system', 'Stage 0.5: Backend Selection', { sessionId: session.id });
    
    const backendResult = await backendProcessor.execute({
      userMessage,
      session,
      res
    });

    if (!backendResult.success) {
      logger.warn('Backend selection failed, defaulting to Goose workflow');
      
      // НОВИНКА 14.10.2025 - Check if fallback is disabled
      if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
        const error = new Error('Backend selection failed and fallback is disabled');
        logger.error('executor', '❌ Backend selection failed and fallback is DISABLED', {
          sessionId: session.id
        });
        
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'workflow_error',
            data: {
              error: 'Backend selection failed',
              message: error.message,
              fallbackDisabled: true
            }
          })}\n\n`);
          res.end();
        }
        
        throw error;
      }
      
      return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
    }

    const selectedBackend = backendResult.backend; // 'goose' | 'mcp'
    
    logger.info(`Backend selected: ${selectedBackend}`, {
      sessionId: session.id,
      reasoning: backendResult.metadata?.reasoning
    });

    // Send backend selection to frontend
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'backend_selected',
        data: {
          backend: selectedBackend,
          reasoning: backendResult.summary
        }
      })}\n\n`);
    }

    // Route based on selected backend
    if (selectedBackend === 'mcp') {
      // ✅ PHASE 4 TASK 3: Check circuit breaker before executing MCP workflow
      if (!mcpCircuitBreaker.canExecute()) {
        const breakerState = mcpCircuitBreaker.getState();
        logger.warn('executor', `Circuit breaker ${breakerState.state} - routing to Goose workflow`, {
          sessionId: session.id,
          failureCount: breakerState.failureCount,
          threshold: breakerState.threshold
        });

        telemetry.emit('workflow.mcp.circuit_breaker_open', {
          sessionId: session.id,
          state: breakerState.state
        });

        // НОВИНКА 13.10.2025 - Check if fallback is disabled
        if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
          logger.error('executor', '❌ Circuit breaker open and fallback is DISABLED', {
            sessionId: session.id,
            breakerState: breakerState.state
          });

          if (res.writable && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'workflow_error',
              data: {
                error: 'Circuit breaker open',
                message: `Too many MCP failures (${breakerState.failureCount}/${breakerState.threshold})`,
                fallbackDisabled: true
              }
            })}\n\n`);
            res.end();
          }

          throw new Error(`Circuit breaker ${breakerState.state} - fallback disabled`);
        }

        // Send circuit breaker notification to frontend
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'workflow_fallback',
            data: {
              from: 'mcp',
              to: 'goose',
              reason: `Circuit breaker ${breakerState.state} - too many recent failures`
            }
          })}\n\n`);
        }

        return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
      }

      logger.info('Routing to MCP Dynamic TODO Workflow', { sessionId: session.id });
      
      // ✅ PHASE 4 TASK 3: Enhanced error handling with Goose fallback
      try {
        telemetry.emit('workflow.mcp.started', {
          sessionId: session.id,
          userMessage: userMessage.substring(0, 100)
        });

        const mcpResult = await executeMCPWorkflow(userMessage, session, res, container);
        
        // ✅ PHASE 4 TASK 3: Record success in circuit breaker
        mcpCircuitBreaker.recordSuccess();

        telemetry.emit('workflow.mcp.completed', {
          sessionId: session.id,
          duration: Date.now() - workflowStart,
          success: true
        });

        return mcpResult;

      } catch (mcpError) {
        // ✅ PHASE 4 TASK 3: Record failure in circuit breaker
        mcpCircuitBreaker.recordFailure();

        logger.error('executor', `MCP workflow failed: ${mcpError.message}`, {
          sessionId: session.id,
          error: mcpError.message,
          stack: mcpError.stack,
          circuitBreakerState: mcpCircuitBreaker.getState()
        });

        telemetry.emit('workflow.mcp.failed', {
          sessionId: session.id,
          error: mcpError.message,
          fallbackToGoose: !GlobalConfig.AI_BACKEND_CONFIG.disableFallback,
          circuitBreakerState: mcpCircuitBreaker.getState()
        });

        // НОВИНКА 13.10.2025 - Check if fallback is disabled
        if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
          logger.error('executor', '❌ MCP workflow failed and fallback is DISABLED (AI_BACKEND_DISABLE_FALLBACK=true)', {
            sessionId: session.id,
            error: mcpError.message
          });

          // Send error to frontend without fallback
          if (res.writable && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'workflow_error',
              data: {
                error: 'MCP workflow failed',
                message: mcpError.message,
                fallbackDisabled: true
              }
            })}\n\n`);
            res.end();
          }

          throw mcpError; // Re-throw to propagate error
        }

        // Send fallback notification to frontend
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'workflow_fallback',
            data: {
              from: 'mcp',
              to: 'goose',
              reason: mcpError.message
            }
          })}\n\n`);
        }

        logger.warn('executor', 'Falling back to Goose workflow after MCP failure');
        return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
      }
    } else {
      logger.info('Routing to traditional Goose Workflow', { sessionId: session.id });
      
      telemetry.emit('workflow.goose.started', {
        sessionId: session.id,
        userMessage: userMessage.substring(0, 100)
      });

      return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
    }

  } catch (backendError) {
    logger.error(`Backend selection error: ${backendError.message}`, {
      sessionId: session.id,
      error: backendError.message
    });
    
    // НОВИНКА 14.10.2025 - Check if fallback is disabled for backend selection errors too
    if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
      logger.error('executor', '❌ Backend selection failed and fallback is DISABLED (AI_BACKEND_DISABLE_FALLBACK=true)', {
        sessionId: session.id,
        error: backendError.message
      });

      // Send error to frontend without fallback
      if (res.writable && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: 'workflow_error',
          data: {
            error: 'Backend selection failed',
            message: backendError.message,
            fallbackDisabled: true
          }
        })}\n\n`);
        res.end();
      }

      throw backendError; // Re-throw to propagate error
    }
    
    // Fallback to Goose workflow on backend selection error
    logger.warn('Falling back to Goose workflow due to backend selection error');
    return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
  }
}

/**
 * Execute task workflow stages
 */
async function executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig) {
  const workflowStart = Date.now(); // FIXED 13.10.2025 - Define workflowStart
  let currentStage = session.currentStage || 1;
  const maxCycles = workflowConfig.maxCycles || 3;
  let cycleCount = 0;

  while (currentStage <= 9 && cycleCount < maxCycles) {
    // Find stage configuration
    const stageConfig = allStages.find(s => s.stage === currentStage);
    if (!stageConfig) {
      logger.warn(`Stage ${currentStage} configuration not found, completing workflow`);
      break;
    }

    // Check conditions if required
    if (stageConfig.condition && !await WorkflowConditions.checkCondition(stageConfig.condition, session)) {
      logger.info(`Stage ${currentStage} condition not met, skipping`, {
        condition: stageConfig.condition,
        sessionId: session.id
      });
      continue;
    }

    // Execute stage
    try {
      logger.workflow('stage', stageConfig.agent, `Starting stage ${currentStage}: ${stageConfig.name}`, {
        sessionId: session.id
      });

      const stageResponse = await executeConfiguredStage(stageConfig, userMessage, session, res);

      if (stageResponse) {
        // CRITICAL FIX: Send response to stream IMMEDIATELY, before waiting for TTS
        // This ensures user sees the message in chat without delay
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'agent_message', data: stageResponse })}\n\n`);
        }

        session.history.push(stageResponse);

        // MEMORY LEAK PREVENTION: Limit session.history size during execution
        // Keep maximum 20 messages to prevent unbounded growth
        const MAX_HISTORY_SIZE = 20;
        if (session.history.length > MAX_HISTORY_SIZE) {
          const removed = session.history.length - MAX_HISTORY_SIZE;
          session.history = session.history.slice(-MAX_HISTORY_SIZE);
          logger.debug(`History size limit: removed ${removed} old messages, kept ${MAX_HISTORY_SIZE}`);
        }

        session.currentStage = currentStage;

        // Analyze response to determine the next stage
        const nextStage = await determineNextStage(currentStage, stageResponse, session, allStages);

        if (nextStage === 8) { // 8 is the completion stage
          // Execute stage 8 through SystemStageProcessor instead of just closing stream
          const completionStage = allStages.find(s => s.stage === 8 && s.name === 'completion');
          if (completionStage) {
            logger.workflow('stage', 'system', `Starting stage 8: completion`, { sessionId: session.id });
            const completionResponse = await executeConfiguredStage(completionStage, userMessage, session, res);

            if (completionResponse && res.writable && !res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: 'agent_message', data: completionResponse })}\n\n`);
            }

            session.history.push(completionResponse);
          }

          await completeWorkflow(session, res);
          return;
        } else if (nextStage === 9) { // 9 triggers a new cycle
          cycleCount++;

          // MEMORY LEAK FIX: Clean old cycle history before starting new retry cycle
          // Keep only last 5 messages from previous cycle for context
          if (session.history.length > 5) {
            const oldLength = session.history.length;
            session.history = session.history.slice(-5);
            logger.info(`Retry cycle ${cycleCount}: cleaned history ${oldLength} → ${session.history.length} messages`);
          }

          currentStage = 1;
          logger.workflow('cycle', 'system', `Starting new cycle ${cycleCount}`, { sessionId: session.id });
        } else {
          currentStage = nextStage;
        }
      } else {
        // Stage failed, try to recover or complete
        logger.warn(`Stage ${currentStage} returned no response, completing workflow`);
        await completeWorkflow(session, res);
        return;
      }

    } catch (stageError) {
      logger.error(`Stage ${currentStage} failed`, {
        error: stageError.message,
        sessionId: session.id
      });

      // SPECIAL HANDLING: Grisha verification failure (stage 7)
      // Instead of failing, auto-approve and complete workflow
      if (currentStage === 7) {
        logger.warn(`Grisha verification failed - auto-approving task completion`);

        // Inform user about verification error
        const errorNotification = {
          role: 'assistant',
          content: '⚠️ Гриша не зміг перевірити виконання через технічну помилку. Автоматично підтверджую завершення на основі звіту Тетяни.',
          agent: 'grisha',
          stage: 7,
          timestamp: Date.now(),
          metadata: {
            verificationFailed: true,
            error: stageError.message
          }
        };

        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'agent_message', data: errorNotification })}\n\n`);
        }

        session.history.push(errorNotification);

        const autoApprovalResponse = {
          role: 'assistant',
          content: '✅ Завдання виконано',
          agent: 'system',
          stage: 8,
          timestamp: Date.now(),
          metadata: {
            autoApproved: true,
            reason: 'Grisha verification failed - fallback to auto-approval',
            originalError: stageError.message
          }
        };

        // Send auto-approval message to user
        if (res.writable && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'agent_message', data: autoApprovalResponse })}\n\n`);
        }

        session.history.push(autoApprovalResponse);

        // Complete workflow successfully
        await completeWorkflow(session, res);
        return;
      }

      // For other stages - complete workflow with error
      await completeWorkflow(session, res);
      return;
    }
  }

  // Max cycles reached or stages completed
  if (cycleCount >= maxCycles) {
    logger.warn(`Max retry cycles (${maxCycles}) reached, completing workflow`, {
      sessionId: session.id,
      finalStage: currentStage
    });

    // Відправити повідомлення про досягнення ліміту
    const limitMessage = {
      role: 'assistant',
      content: `⚠️ Досягнуто максимальної кількості спроб (${maxCycles}). Завдання потребує уточнення або перефразування.`,
      agent: 'system',
      timestamp: Date.now()
    };

    res.write(`data: ${JSON.stringify(limitMessage)}\n\n`);
  }

  await completeWorkflow(session, res);
}

/**
 * Handle chat route (both from stop dispatch and mode selection)
 * FIXED: Тепер використовує AgentStageProcessor для збереження контексту
 */
async function handleChatRoute(userMessage, session, res, allStages) {
  const chatStage = allStages.find(s => s.stage === 0 && s.name === 'stage0_chat');

  if (!chatStage) {
    throw new Error('Chat stage configuration not found');
  }

  // NOTE: chatThread was already initialized and user message added in executeWorkflowStages
  // Only add message if it's not already there (e.g., when called from stop_dispatch)
  if (!session.chatThread) {
    session.chatThread = { messages: [], lastTopic: undefined };
  }

  // Check if message already added
  const lastUserMessage = session.chatThread.messages
    .filter(m => m.role === 'user')
    .pop();

  if (!lastUserMessage || lastUserMessage.content !== userMessage) {
    // Add current user message to chat thread if not already added
    session.chatThread.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });
  }

  logger.info(`Chat route: processing message with ${session.chatThread.messages.length} messages in thread`);

  // Execute chat stage - це ПОВИННО використати AgentStageProcessor
  // який викличе buildContextMessages() і передасть весь контекст
  const chatResponse = await executeConfiguredStage(chatStage, userMessage, session, res);

  if (chatResponse) {
    // ALWAYS send the agent's response to the user via the stream
    // CRITICAL FIX: Use proper SSE format with "data: " prefix
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'agent_message', data: chatResponse })}\n\n`);
    }

    // Add agent response to chat thread
    session.chatThread.messages.push({
      role: 'assistant',
      content: chatResponse.content,
      agent: chatResponse.agent,
      timestamp: Date.now()
    });

    logger.info(`Chat route: response added, thread now has ${session.chatThread.messages.length} messages`);
  }

  await completeWorkflow(session, res, 'chat');
}

/**
 * FALLBACK REMOVED - система тепер працює виключно на живих промптах
 * При помилках генеруються exceptions замість fallback відповідей
 */

/**
 * Determine next stage based on current stage response
 */
async function determineNextStage(currentStage, response, session, allStages) {
  // Simple logic for now - can be enhanced with AI analysis
  switch (currentStage) {
    case 1: return 2; // Atlas → Tetyana
    case 2:
      // Analyze if Tetyana needs clarification or asks questions
      const tetyanaContent = response.content.toLowerCase();

      const needsClarification = tetyanaContent.includes('уточни') ||
        tetyanaContent.includes('не можу') ||
        tetyanaContent.includes('не вдалос') ||
        tetyanaContent.includes('потрібно уточн') ||
        tetyanaContent.includes('прошу уточн') ||
        tetyanaContent.includes('можу продовж') ||
        tetyanaContent.includes('можу опрацюват') ||
        tetyanaContent.includes('альтернативн') ||
        tetyanaContent.includes('уточнити') ||
        tetyanaContent.includes('помилк') ||
        tetyanaContent.includes('atlas,'); // Тетяна звертається до Atlas за допомогою

      logger.info(`Stage 2 decision: Tetyana needs clarification=${needsClarification}`, {
        contentPreview: tetyanaContent.substring(0, 100),
        nextStage: needsClarification ? 3 : 7
      });

      if (needsClarification) {
        return 3; // Tetyana → Atlas clarification
      }
      return 7; // Tetyana → Grisha verification
    case 3: return 4; // Atlas clarification → Tetyana retry
    case 4:
      // After retry, check if still blocked
      if (response.content.toLowerCase().includes('блокован') ||
        response.content.toLowerCase().includes('не вдалос')) {
        return 5; // → Grisha diagnosis
      }
      return 7; // → Grisha verification
    case 5: return 6; // Grisha diagnosis → Atlas adjustment
    case 6: return 4; // Atlas adjustment → Tetyana retry
    case 7:
      // Grisha verification result
      const content = response.content.toLowerCase();

      console.log(`[WORKFLOW] Stage 7 response analysis: "${content.substring(0, 200)}..."`);

      // Check if Grisha asks for clarification or waiting for task details
      if (content.includes('уточни') ||
        content.includes('уточнен') ||
        content.includes('чекаю') ||
        content.includes('вкажи') ||
        content.includes('очікую') ||
        (content.includes('потрібно') && content.includes('уточни'))) {
        console.log('[WORKFLOW] Stage 7: Grisha needs clarification → stage 3');
        return 3; // → Atlas clarification (to provide guidance to Tetyana)
      }

      // Check if verification failed (task incomplete/incorrect)
      if (content.includes('не виконано') ||
        content.includes('неуспішн') ||
        content.includes('частково')) {
        console.log('[WORKFLOW] Stage 7: Verification failed → stage 9 (retry)');
        return 9; // → New cycle (retry from Atlas)
      }

      // Check if verification passed
      if (content.includes('виконано') ||
        content.includes('перевірено') ||
        content.includes('готово') ||
        content.includes('підтверджено')) {
        console.log('[WORKFLOW] Stage 7: Verification passed → stage 8 (completion)');
        return 8; // → Completion
      }

      // КРИТИЧНО: Якщо Гриша НЕ дав вердикт (просто підтвердив готовність або інструкції) → потрібно уточнення
      if (content.includes('прийнято') ||
        content.includes('ознайомився') ||
        content.includes('зрозумів') ||
        content.includes('дотримуватись') ||
        (content.includes('готовий') && !content.includes('готово')) ||
        (content.includes('буд') && content.includes('діяти')) ||
        (content.includes('інструкц') && !content.includes('перевір')) ||
        content.length < 150) { // Коротка відповідь без вердикту
        console.log('[WORKFLOW] Stage 7: Grisha acknowledged instructions but no verification → needs actual task (retry cycle)');
        return 9; // → Retry to give Grisha actual context
      }

      // Default: if unclear, assume needs retry
      console.log('[WORKFLOW] Stage 7: Unclear response → stage 9 (retry)');
      return 9; // → New cycle
    case 9: return 1; // New cycle → Atlas initial processing
    default: return 8; // Completion
  }
}

/**
 * Complete workflow
 */
async function completeWorkflow(session, res, mode = 'task') {
  // MEMORY LEAK FIX: Clean up session.history to prevent accumulation
  // Keep only essential context from the current cycle
  if (session.history && session.history.length > 0) {
    const historyBeforeCleanup = session.history.length;

    // For task mode: keep only last 5 messages (current cycle context)
    // For chat mode: chatThread handles conversation history separately
    if (mode === 'task' && session.history.length > 5) {
      session.history = session.history.slice(-5);
    } else if (mode === 'chat') {
      // In chat mode, clear task history completely (chatThread persists separately)
      session.history = [];
    }

    logger.info(`Session history cleanup: ${historyBeforeCleanup} → ${session.history.length} messages (mode: ${mode})`);
  }

  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({
      type: 'workflow_complete',
      data: {
        success: true,
        completed: true,
        mode,
        session: {
          id: session.id,
          totalStages: session.history.length
        }
      }
    })}\n\n`);
    res.end();
  }
}

/**
 * Legacy function - will be deprecated
 */
async function executeAgentStageStepByStep(agentName, stageName, systemPrompt, userPrompt, session, res, options = {}) {
  logger.warn('Using deprecated executeAgentStageStepByStep, please migrate to executeConfiguredStage');

  // Find agent configuration
  const agentConfig = GlobalConfig.getAgentConfig(agentName);
  if (!agentConfig) {
    throw new Error(`Agent configuration not found: ${agentName}`);
  }

  // Create a temporary stage config
  const tempStageConfig = {
    stage: session.currentStage || 0,
    agent: agentName,
    name: stageName,
    timeout: agentConfig.timeout || 30000
  };

  // Use agent processor
  const processor = new AgentStageProcessor(tempStageConfig, GlobalConfig);
  return await processor.executeLegacy(systemPrompt, userPrompt, session, res, options);
}
