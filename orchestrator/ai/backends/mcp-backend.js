/**
 * @fileoverview MCP Backend - прямий доступ до MCP серверів без Goose
 * Використовує MCP Manager для виконання tools та LLM для reasoning
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import { MCPManager } from '../mcp-manager.js';
import logger from '../../utils/logger.js';

/**
 * Backend для роботи з прямими MCP серверами
 * Швидший за Goose для простих операцій, але потребує LLM для planning
 */
export class MCPBackend {
  /**
   * @param {Object} config - MCP конфігурація з AI_BACKEND_CONFIG
   */
  constructor(config) {
    this.config = config;
    this.mcpManager = new MCPManager(config.servers);
    this.llm = null; // Буде ініціалізовано в initialize()
  }

  /**
   * Ініціалізація MCP backend
   */
  async initialize() {
    logger.system('mcp-backend', '[MCP Backend] Initializing...');

    // Запустити MCP servers
    await this.mcpManager.initialize();

    // Ініціалізувати LLM client для planning
    if (this.config.llm) {
      const { LLMClient } = await import('../llm-client.js');
      this.llm = new LLMClient(this.config.llm);
      await this.llm.initialize();
      logger.system('mcp-backend', '[MCP Backend] ✅ LLM client initialized');
    }

    const tools = this.mcpManager.getAvailableTools();
    logger.system('mcp-backend', `[MCP Backend] ✅ Ready with ${tools.length} tools`);
  }

  /**
   * Виконати AI запит через MCP servers + LLM
   * 
   * @param {string} prompt - Текст запиту
   * @param {Object} context - Контекст виконання
   * @param {Object} options - Опції виконання
   * @returns {Promise<Object>} Результат виконання
   */
  async execute(prompt, context, options = {}) {
    const startTime = Date.now();

    logger.debug('mcp-backend', '[MCP Backend] Executing request', {
      agent: options.agent,
      enableTools: options.enableTools,
      promptLength: prompt.length
    });

    try {
      // Якщо tools НЕ потрібні - тільки LLM
      if (!options.enableTools) {
        const response = await this.llm.generate({
          prompt,
          context: context.history,
          systemPrompt: this._getSystemPrompt(options.agent)
        });

        return {
          text: response,
          agent: options.agent,
          tools: [],
          confidence: 1.0
        };
      }

      // 1. Спланувати які tools викликати (через LLM)
      const toolPlan = await this.planTools(prompt, context, options);

      logger.debug('mcp-backend', `[MCP Backend] Tool plan: ${toolPlan.tools.length} tools`);

      // 2. Виконати tools через MCP Manager
      const toolResults = await this.executeTools(toolPlan.tools);

      logger.debug('mcp-backend', `[MCP Backend] Executed ${toolResults.length} tools`);

      // 3. LLM генерує фінальну відповідь на основі tool results
      const finalResponse = await this.llm.generate({
        prompt,
        context: context.history,
        toolResults,
        systemPrompt: this._getSystemPrompt(options.agent)
      });

      const latency = Date.now() - startTime;

      logger.debug('mcp-backend', `[MCP Backend] ✅ Success (${latency}ms)`);

      return {
        text: finalResponse,
        agent: options.agent,
        tools: toolResults,
        confidence: toolPlan.confidence || 0.9
      };

    } catch (error) {
      logger.error('mcp-backend', `[MCP Backend] ❌ Error: ${error.message}`);

      const enhancedError = new Error(`MCP execution failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.backend = 'mcp';
      enhancedError.agent = options.agent;

      throw enhancedError;
    }
  }

  /**
   * Спланувати які tools викликати (через LLM)
   * @private
   */
  async planTools(prompt, context, options) {
    const availableTools = this.mcpManager.getAvailableTools();

    const planningPrompt = `
Ти - tool planner для AI агента "${options.agent}".

ДОСТУПНІ TOOLS:
${JSON.stringify(availableTools, null, 2)}

ЗАПИТ КОРИСТУВАЧА:
${prompt}

ЗАВДАННЯ:
Визнач які tools потрібно викликати та в якому порядку.

ПОВЕРНИ JSON:
{
  "tools": [
    {
      "name": "tool_name",
      "parameters": { ... }
    }
  ],
  "reasoning": "Чому обрав ці tools",
  "confidence": 0.0-1.0
}
`;

    const planResponse = await this.llm.generate({
      prompt: planningPrompt,
      context: [],
      systemPrompt: 'You are a tool planner. Analyze requests and determine which tools to call. Respond ONLY with valid JSON.'
    });

    // Парсити JSON response
    try {
      const plan = JSON.parse(planResponse);
      logger.debug('mcp-backend', `[MCP Backend] Tool plan reasoning: ${plan.reasoning}`);
      return plan;
    } catch (error) {
      logger.error('mcp-backend', `[MCP Backend] ❌ Invalid tool plan JSON: ${planResponse}`);
      
      // Fallback: порожній plan
      return {
        tools: [],
        reasoning: 'Failed to parse plan',
        confidence: 0.0
      };
    }
  }

  /**
   * Виконати tools через MCP Manager
   * @private
   */
  async executeTools(toolCalls) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        logger.debug('mcp-backend', `[MCP Backend] Executing tool: ${toolCall.name}`);

        const result = await this.mcpManager.executeTool(
          toolCall.name,
          toolCall.parameters
        );

        results.push({
          tool: toolCall.name,
          success: true,
          result
        });

      } catch (error) {
        logger.error('mcp-backend', `[MCP Backend] ❌ Tool ${toolCall.name} failed: ${error.message}`);

        results.push({
          tool: toolCall.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Отримати system prompt для агента
   * @private
   */
  _getSystemPrompt(agent) {
    const prompts = {
      atlas: 'Ти - Atlas, координатор та стратег. Аналізуй завдання, плануй workflow, надавай інструкції.',
      tetyana: 'Ти - Тетяна, виконавець. Виконуй технічні завдання: код, файли, браузер automation. Використовуй tools ефективно.',
      grisha: 'Ти - Гриша, верифікатор. Перевіряй якість виконання, знаходь помилки, валідуй результати.'
    };

    return prompts[agent] || prompts.atlas;
  }

  /**
   * Отримати статус MCP backend
   * @returns {Object} Статус інформація
   */
  async getStatus() {
    return {
      available: true,
      servers: this.mcpManager.getStatus(),
      tools: this.mcpManager.getAvailableTools().length,
      llm: this.llm ? 'initialized' : 'not initialized'
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.system('mcp-backend', '[MCP Backend] Shutting down...');
    
    await this.mcpManager.shutdown();
    
    if (this.llm && this.llm.shutdown) {
      await this.llm.shutdown();
    }

    logger.system('mcp-backend', '[MCP Backend] ✅ Stopped');
  }
}

export default MCPBackend;
