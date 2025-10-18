/**
 * AGENT STAGE PROCESSOR
 * Обробляє етапи агентів (Atlas, Tetyana, Grisha) з використанням промптів
 */

import { callGooseAgent } from '../../agents/goose-client.js';
import { generateMessageId } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import telemetry from '../../utils/telemetry.js';
import axios from 'axios';

export default class AgentStageProcessor {
  constructor(stageConfig, unifiedConfig) {
    this.stageConfig = stageConfig;
    this.config = unifiedConfig;
    this.stage = stageConfig.stage;
    this.agent = stageConfig.agent;
    this.name = stageConfig.name;
    this.promptName = stageConfig.promptName;
  }

  /**
     * Execute agent stage with prompt registry AND CONTEXT HISTORY
     */
  async execute(userMessage, session, res, options = {}) {
    const messageId = generateMessageId();
    const executionStart = Date.now();

    logger.agent(this.agent, 'start', `Starting stage ${this.stage}: ${this.name}`);

    try {
      // Get agent configuration
      const agentConfig = this.config.getAgentConfig(this.agent);
      if (!agentConfig) {
        throw new Error(`Agent configuration not found: ${this.agent}`);
      }

      // Get prompt from registry
      const prompt = await this.config.getStagePrompt(
        this.stage,
        this.agent,
        this.name,
        { userMessage, session, agent: this.agent }
      );

      if (!prompt) {
        throw new Error(`Prompt not found for stage ${this.stage}, agent ${this.agent}, name ${this.name}`);
      }

      // BUILD CONTEXT from session history - CRITICAL FIX
      const contextMessages = this.buildContextMessages(session, prompt, userMessage);

      // Execute with Goose agent + FULL CONTEXT
      const response = await this.executeWithGoose(
        prompt,
        contextMessages,
        session,
        agentConfig,
        options
      );

      // Record metrics
      const executionTime = Date.now() - executionStart;
      telemetry.recordExecution(`agent_stage_${this.agent}`, executionTime, true, {
        stage: this.stage,
        name: this.name,
        contextSize: contextMessages.length
      });

      logger.agent(this.agent, 'complete', `Completed stage ${this.stage} in ${executionTime}ms with ${contextMessages.length} context messages`);

      return response;

    } catch (error) {
      const executionTime = Date.now() - executionStart;
      telemetry.recordExecution(`agent_stage_${this.agent}`, executionTime, false, {
        stage: this.stage,
        name: this.name,
        error: error.message
      });

      logger.agent(this.agent, 'error', `Failed stage ${this.stage}: ${error.message}`);
      throw error;
    }
  }

  /**
     * BUILD CONTEXT MESSAGES from session history
     * CRITICAL FIX: Це забезпечує передачу контексту розмови
     */
  buildContextMessages(session, prompt, userMessage) {
    const messages = [];

    // Add system prompt
    if (prompt.systemPrompt) {
      messages.push({
        role: 'system',
        content: prompt.systemPrompt
      });
    }

    // Determine if this is chat mode or task mode
    const isChatMode = this.stage === 0 && this.name === 'stage0_chat';

    if (isChatMode && session.chatThread && session.chatThread.messages) {
      // CHAT MODE: Include conversation history
      // Take last 10 messages to avoid token limit issues
      const recentHistory = session.chatThread.messages.slice(-10);

      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          // Clean up assistant messages - remove agent signatures
          // FIXED 13.10.2025 - Handle content as object or string
          let content = msg.content;
          if (typeof content === 'object' && content !== null) {
            content = JSON.stringify(content);
          } else if (typeof content !== 'string') {
            content = String(content || '');
          }
          
          if (msg.role === 'assistant') {
            content = content.replace(/^\[.*?\]\s*/, '').trim();
          }

          messages.push({
            role: msg.role,
            content: content
          });
        }
      }

      logger.info(`Chat mode: included ${recentHistory.length} history messages`);

    } else if (session.history && session.history.length > 0) {
      // TASK MODE: Include relevant task context
      // Get previous stage outputs for context
      const relevantHistory = session.history
        .filter(msg => msg.role === 'assistant' || msg.role === 'user')
        .slice(-5); // Last 5 messages

      for (const msg of relevantHistory) {
        // FIXED 13.10.2025 - Handle content as object or string
        let content = msg.content;
        if (typeof content === 'object' && content !== null) {
          content = JSON.stringify(content);
        } else if (typeof content !== 'string') {
          content = String(content || '');
        }
        
        if (msg.role === 'assistant') {
          content = content.replace(/^\[.*?\]\s*/, '').trim();
        }

        messages.push({
          role: msg.role,
          content: content
        });
      }

      logger.info(`Task mode: included ${relevantHistory.length} history messages`);
    }

    // Add current user message if not already in history
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.content !== userMessage) {
      messages.push({
        role: 'user',
        content: prompt.userPrompt || userMessage
      });
    }

    return messages;
  }

  /**
     * Execute with Goose agent OR API (chat mode uses API for faster responses)
     */
  async executeWithGoose(prompt, contextMessages, session, agentConfig, options) {
    // Для chat mode (stage 0) використовуємо API замість Goose для швидших відповідей
    const useFastAPI = this.stage === 0 && this.name === 'stage0_chat';

    if (useFastAPI) {
      logger.info(`Using fast API for chat mode with ${contextMessages.length} context messages`);
      return await this.executeWithAPI(contextMessages, session, agentConfig, options, prompt);
    }

    // Build full prompt with context for Goose
    let fullPrompt = '';

    for (const msg of contextMessages) {
      if (msg.role === 'system') {
        fullPrompt += `SYSTEM INSTRUCTIONS:\n${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        fullPrompt += `USER: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        fullPrompt += `ASSISTANT: ${msg.content}\n\n`;
      }
    }

    // Add final instruction
    fullPrompt += `\nПРОШУ ВІДПОВІСТИ враховуючи весь контекст розмови вище.`;

    logger.info(`Goose prompt built: ${fullPrompt.length} chars, ${contextMessages.length} messages`);

    try {
      const gooseResponse = await callGooseAgent(fullPrompt, session.id, {
        enableTools: options.enableTools || agentConfig.enableTools,
        agent: this.agent,
        timeout: agentConfig.timeout
      });

      if (!gooseResponse) {
        throw new Error('Goose agent returned empty response - NO FALLBACK');
      }

      // Process and format response
      return this.formatResponse(gooseResponse, prompt, session, contextMessages);

    } catch (gooseError) {
      // NO FALLBACK - throw error up
      logger.error(`Goose agent failed for ${this.agent} - NO FALLBACK`, {
        error: gooseError.message,
        stage: this.stage
      });
      throw new Error(`Goose agent failed: ${gooseError.message}`);
    }
  }

  /**
   * Execute with API (port 4000) - швидший варіант для chat mode з повним контекстом
   */
  async executeWithAPI(contextMessages, session, agentConfig, options, prompt) {
    try {
      logger.info(`API call with ${contextMessages.length} context messages`, {
        sessionId: session.id,
        agent: this.agent,
        stage: this.stage
      });

      // Викликаємо API з ПОВНИМ контекстом розмови
      // OPTIMIZED 18.10.2025 - atlas-ministral-3b (45 req/min)
      const requestBody = {
        model: 'atlas-ministral-3b',
        temperature: 0.7, // Вища температура для природної розмови
        max_tokens: 500,
        messages: contextMessages // ✅ ПЕРЕДАЄМО ВЕСЬ КОНТЕКСТ!
      };
      
      // ADDED 14.10.2025 - Log request size to debug 413 errors
      const requestSize = JSON.stringify(requestBody).length;
      logger.info(`[API] Sending chat request`, {
        sessionId: session.id,
        requestSizeBytes: requestSize,
        requestSizeKB: (requestSize / 1024).toFixed(2),
        messagesCount: contextMessages.length,
        model: 'ministral-3b'
      });
      
      const response = await axios.post('http://localhost:4000/v1/chat/completions', requestBody, {
        timeout: 60000,  // FIXED 14.10.2025 - Збільшено з 30s до 60s
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const apiContent = response.data?.choices?.[0]?.message?.content;

      logger.info(`API response received: ${apiContent?.length || 0} chars`, {
        sessionId: session.id,
        contextMessagesUsed: contextMessages.length
      });

      if (!apiContent) {
        throw new Error('Empty response from API');
      }

      // Format response
      return this.formatResponse(apiContent, prompt, session, contextMessages);

    } catch (error) {
      logger.error('API execution failed', {
        error: error.message,
        stage: this.stage,
        agent: this.agent,
        sessionId: session.id
      });
      throw error;
    }
  }

  /**
     * Format agent response
     */
  formatResponse(gooseResponse, prompt, session, contextMessages) {
    // Clean and process the response
    let content = String(gooseResponse).trim();

    // Remove common artifacts
    content = content
      .replace(/^```[\w]*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^\[.*?\]\s*/, ''); // Remove agent signatures if present

    // Add agent signature
    const agentConfig = this.config.getAgentConfig(this.agent);
    const signature = agentConfig?.signature || `[${this.agent.toUpperCase()}]`;

    return {
      agent: this.agent,
      content: `${signature} ${content}`,
      timestamp: Date.now(),
      stage: this.stage,
      stageName: this.name,
      messageId: generateMessageId(),
      metadata: {
        promptFile: prompt.metadata?.file,
        executedAt: Date.now(),
        promptLoadedAt: prompt.metadata?.loadedAt,
        contextMessagesCount: contextMessages?.length || 0
      },
      fullResponse: {
        rawGooseText: gooseResponse,
        promptUsed: {
          system: prompt.systemPrompt?.substring(0, 100) + '...',
          user: prompt.userPrompt?.substring(0, 100) + '...'
        },
        contextIncluded: contextMessages?.length > 1 // More than just system prompt
      }
    };
  }

  /**
   * FALLBACK RESPONSE REMOVED
   * Система тепер працює виключно на живих промптах через Goose
   * При помилках генеруються exceptions
   */

  /**
     * Legacy execution method for backward compatibility
     */
  async executeLegacy(systemPrompt, userPrompt, session, res, options = {}) {
    logger.warn(`Using legacy execution for ${this.agent} stage ${this.stage}`);

    const agentConfig = this.config.getAgentConfig(this.agent);
    if (!agentConfig) {
      throw new Error(`Agent configuration not found: ${this.agent}`);
    }

    const fullPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;

    try {
      const gooseResponse = await callGooseAgent(fullPrompt, session.id, {
        enableTools: options.enableTools || agentConfig.enableTools,
        agent: this.agent,
        timeout: agentConfig.timeout
      });

      return this.formatLegacyResponse(gooseResponse, session);

    } catch (error) {
      logger.error(`Legacy execution failed for ${this.agent}`, { error: error.message });
      throw error;
    }
  }

  /**
     * Format legacy response
     */
  formatLegacyResponse(gooseResponse, session) {
    const agentConfig = this.config.getAgentConfig(this.agent);
    const signature = agentConfig?.signature || `[${this.agent.toUpperCase()}]`;

    let content = String(gooseResponse).trim();
    content = content
      .replace(/^```[\w]*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^\[.*?\]\s*/, '');

    return {
      agent: this.agent,
      content: `${signature} ${content}`,
      timestamp: Date.now(),
      stage: this.stage,
      stageName: this.name,
      messageId: generateMessageId(),
      legacy: true,
      fullResponse: {
        rawGooseText: gooseResponse
      }
    };
  }
}
