/**
 * SYSTEM STAGE PROCESSOR
 * Обробляє системні етапи (mode selection, routing, completion)
 */

import logger from '../../utils/logger.js';
import axios from 'axios';
import { getModelForStage } from '../../../config/global-config.js';

export default class SystemStageProcessor {
  constructor(stageConfig, unifiedConfig) {
    this.stageConfig = stageConfig;
    this.config = unifiedConfig;
    this.stage = stageConfig.stage;
    this.agent = stageConfig.agent;
    this.name = stageConfig.name;
  }

  /**
     * Execute system stage
     */
  async execute(userMessage, session, res, options = {}) {
    logger.system('stage', `Executing system stage ${this.stage}: ${this.name}`);

    try {
      switch (this.stage) {
        case -1:
          return await this.executeStopRouter(userMessage, session, options);
        case 0:
          // FIXED: stage0_chat тепер обробляється через AgentStageProcessor
          // тому тут залишається тільки mode_selection
          return await this.executeModeSelection(userMessage, session, options);
        case 8:
          return await this.executeCompletion(userMessage, session, options);
        default:
          logger.warn(`Unknown system stage: ${this.stage}`);
          return null;
      }
    } catch (error) {
      logger.error(`System stage ${this.stage} failed`, { error: error.message });
      throw error;
    }
  }

  /**
     * Execute stop router stage
     */
  async executeStopRouter(userMessage, session, options) {
    try {
      const prompt = await this.config.getStagePrompt(
        this.stage,
        this.agent,
        this.name,
        { userMessage, agent: this.agent }
      );

      if (!prompt) {
        throw new Error(`Prompt not found for stop router stage`);
      }

      // Use AI analysis via port 4000 for stop router
      const aiResponse = await this.executeWithAI(prompt, session, options);

      return {
        agent: this.agent,
        content: `[SYSTEM] ${aiResponse}`,
        timestamp: Date.now(),
        stage: this.stage,
        stageName: this.name,
        metadata: prompt.metadata
      };

    } catch (error) {
      logger.error('Stop router execution failed', { error: error.message });
      // Fallback response
      return {
        agent: this.agent,
        content: `[SYSTEM] {"next_stage": 0, "agent": "atlas", "reason": "error_fallback"}`,
        timestamp: Date.now(),
        stage: this.stage,
        stageName: this.name
      };
    }
  }

  /**
     * Execute mode selection stage
     */
  async executeModeSelection(userMessage, session, options) {
    try {
      const prompt = await this.config.getStagePrompt(
        this.stage,
        this.agent,
        this.name,
        { userMessage, session, agent: this.agent }  // FIXED: включили session для правильного контексту
      );

      if (!prompt) {
        throw new Error(`Prompt not found for mode selection stage`);
      }

      // DEBUG: Log the prompts being used
      logger.system('debug', `Mode selection prompts:`, {
        sessionId: session.id,
        systemPromptLength: prompt.systemPrompt?.length,
        systemPromptPreview: prompt.systemPrompt?.substring(0, 200),
        userPromptPreview: prompt.userPrompt?.substring(0, 150)
      });

      // Build context from session history (similar to AgentStageProcessor)
      const contextMessages = this.buildContextForModeSelection(session, prompt, userMessage);

      // Use AI analysis with CONTEXT instead of isolated message
      const aiResponse = await this.executeWithAIContext(contextMessages, session, options);

      // Extract mode and confidence from AI response
      let mode = 'chat';
      let confidence = 0.7;

      try {
        const cleanResponse = aiResponse.replace(/^\[SYSTEM\]\s*/, '').trim();
        const parsed = JSON.parse(cleanResponse);
        mode = parsed.mode === 'chat' ? 'chat' : 'task';
        confidence = parsed.confidence || 0.7;
      } catch (parseError) {
        logger.warn('Failed to parse AI mode selection response, defaulting to chat', {
          response: aiResponse,
          error: parseError.message
        });
        // Default to chat mode if parsing fails (safer for conversation)
        mode = 'chat';
        confidence = 0.7;
      }

      return {
        agent: this.agent,
        content: `[SYSTEM] {"mode": "${mode}", "confidence": ${confidence}}`,
        timestamp: Date.now(),
        stage: this.stage,
        stageName: this.name,
        metadata: prompt.metadata
      };

    } catch (error) {
      logger.error('Mode selection execution failed', { error: error.message });
      // Fallback to chat mode (safer for conversation)
      return {
        agent: this.agent,
        content: `[SYSTEM] {"mode": "chat", "confidence": 0.7}`,
        timestamp: Date.now(),
        stage: this.stage,
        stageName: this.name
      };
    }
  }

  /**
     * Execute completion stage
     */
  async executeCompletion(userMessage, session, options) {
    logger.system('workflow', 'Executing workflow completion');

    return {
      agent: this.agent,
      content: '[SYSTEM] Workflow completed successfully',
      timestamp: Date.now(),
      stage: this.stage,
      stageName: this.name,
      completed: true
    };
  }

  /**
   * ВИДАЛЕНО: executeChatResponse
   * stage0_chat тепер обробляється через AgentStageProcessor
   * для правильної роботи з контекстом через buildContextMessages()
   */

  /**
   * Build context messages for mode selection
   * FIXED: Uses LAST message from chatThread, includes history for context-aware classification
   */
  buildContextForModeSelection(session, prompt, userMessage) {
    const messages = [];

    // Add system prompt
    if (prompt.systemPrompt) {
      messages.push({
        role: 'system',
        content: prompt.systemPrompt
      });
    }

    // Include recent history (last 5 messages) for context-aware classification
    // This helps recognize task intent after chat conversations
    if (session.chatThread && session.chatThread.messages) {
      const historyMessages = session.chatThread.messages.slice(-5);

      historyMessages.forEach(msg => {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });

      logger.info(`Mode selection: included ${historyMessages.length} history messages for context-aware classification`);
    }

    // Get the ACTUAL last user message from chatThread (not the stale one from context)
    const actualUserMessage = session.chatThread?.messages
      ?.filter(m => m.role === 'user')
      .pop()?.content || userMessage;

    // Add current user message with ACTUAL content (rebuild prompt with correct message)
    const userPromptContent = `"${actualUserMessage}"`;
    messages.push({
      role: 'user',
      content: userPromptContent
    });

    logger.system('debug', 'Mode selection actual message:', {
      sessionId: session.id,
      actualMessage: actualUserMessage,
      contextMessageFromPrompt: prompt.userPrompt
    });

    return messages;
  }

  /**
   * Execute system stage with AI analysis using context messages
   */
  async executeWithAIContext(contextMessages, session, options = {}) {
    try {
      // Get model configuration for this stage from central config
      const modelConfig = getModelForStage(this.name);

      logger.system('ai', `Calling system API with context for: ${this.name}`, {
        sessionId: session.id,
        messageCount: contextMessages.length,
        model: modelConfig.model,
        temperature: modelConfig.temperature
      });

      // DEBUG: Log full messages for mode_selection
      if (this.name === 'mode_selection') {
        logger.system('debug', `Mode selection messages:`, {
          sessionId: session.id,
          messages: JSON.stringify(contextMessages, null, 2)
        });

        // Also log the user message specifically
        const userMsg = contextMessages.find(m => m.role === 'user');
        logger.system('debug', `User message for classification:`, {
          sessionId: session.id,
          userMessage: userMsg?.content
        });
      }

      // Use configured API endpoint with FULL CONTEXT
      const response = await axios.post(modelConfig.endpoint, {
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.max_tokens,
        messages: contextMessages
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const aiContent = response.data?.choices?.[0]?.message?.content;

      logger.system('ai', `System API response received for ${this.name}`, {
        sessionId: session.id,
        hasResponse: !!response.data,
        hasContent: !!aiContent,
        contentLength: aiContent?.length || 0,
        content: aiContent?.substring(0, 200) || 'No content'
      });

      if (!aiContent) {
        throw new Error('Empty response from system API');
      }

      return aiContent;

    } catch (error) {
      logger.error('System API execution with context failed', {
        error: error.message,
        stage: this.stage,
        name: this.name,
        sessionId: session.id,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  /**
     * Execute system stage with AI analysis via configured API
     */
  async executeWithAI(prompt, session, options = {}) {
    try {
      // Get model configuration for this stage from central config
      const modelConfig = getModelForStage(this.name);

      logger.system('ai', `Building full prompt for ${this.name}`, {
        sessionId: session.id,
        hasSystemPrompt: !!prompt.systemPrompt,
        hasUserPrompt: !!prompt.userPrompt,
        systemPromptLength: prompt.systemPrompt?.length || 0,
        userPromptLength: prompt.userPrompt?.length || 0,
        model: modelConfig.model
      });

      // DEBUG: Log actual prompt content
      logger.system('ai', `PROMPT DEBUG for ${this.name}`, {
        sessionId: session.id,
        systemPrompt: prompt.systemPrompt?.substring(0, 100) + '...',
        userPrompt: prompt.userPrompt
      });

      logger.system('ai', `Calling system API for: ${this.name}`, {
        sessionId: session.id,
        endpoint: modelConfig.endpoint,
        model: modelConfig.model
      });

      // Use configured API endpoint with model settings
      const response = await axios.post(modelConfig.endpoint, {
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.max_tokens,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ]
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const aiContent = response.data?.choices?.[0]?.message?.content;

      logger.system('ai', `System API response received for ${this.name}`, {
        sessionId: session.id,
        hasResponse: !!response.data,
        hasContent: !!aiContent,
        contentLength: aiContent?.length || 0,
        content: aiContent?.substring(0, 200) || 'No content'
      });

      if (!aiContent) {
        throw new Error('Empty response from system API');
      }

      return aiContent;

    } catch (error) {
      logger.error('System API execution failed', {
        error: error.message,
        stage: this.stage,
        name: this.name,
        sessionId: session.id,
        responseData: error.response?.data
      });
      throw error;
    }
  }
}
