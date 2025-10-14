/**
 * @fileoverview LLM Client - для MCP backend reasoning
 * Використовується коли MCP backend потребує LLM для planning або генерації відповідей
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../utils/logger.js';

/**
 * LLM Client для MCP mode
 * Використовує той самий endpoint що й система (port 4000)
 */
export class LLMClient {
  /**
   * @param {Object} config - LLM конфігурація з AI_BACKEND_CONFIG.providers.mcp.llm
   */
  constructor(config) {
    this.config = config;
    this.provider = config.provider || 'openai';
    this.endpoint = config.apiEndpoint || 'http://localhost:4000/v1/chat/completions';
    this.model = config.model || 'mistral-ai/ministral-3b';  // OPTIMIZED 14.10.2025 - 45 req/min
    this.temperature = config.temperature || 0.3;
  }

  /**
   * Ініціалізація LLM client
   */
  async initialize() {
    logger.system('llm-client', `[LLM Client] Initializing (${this.model} @ ${this.endpoint})`);

    // Перевірка доступності endpoint
    try {
      const healthCheck = await fetch(this.endpoint.replace('/v1/chat/completions', '/health'), {
        method: 'GET',
        timeout: 3000
      }).catch(() => null);

      if (healthCheck && healthCheck.ok) {
        logger.system('llm-client', '[LLM Client] ✅ LLM endpoint is available');
      } else {
        logger.warn('llm-client', '[LLM Client] ⚠️ LLM endpoint health check failed');
      }
    } catch (error) {
      logger.warn('llm-client', `[LLM Client] ⚠️ Could not verify endpoint: ${error.message}`);
    }
  }

  /**
   * Згенерувати відповідь через LLM
   * 
   * @param {Object} options - Параметри генерації
   * @param {string} options.prompt - Основний prompt
   * @param {string} options.systemPrompt - System prompt (опціонально)
   * @param {Array} options.context - Історія розмови (опціонально)
   * @param {Array} options.toolResults - Результати виконання tools (опціонально)
   * @returns {Promise<string>} Згенерована відповідь
   */
  async generate(options) {
    const { prompt, systemPrompt, context = [], toolResults = [] } = options;

    logger.debug('llm-client', '[LLM Client] Generating response', {
      model: this.model,
      promptLength: prompt.length,
      contextMessages: context.length,
      toolResults: toolResults.length
    });

    // Побудувати messages для LLM
    const messages = [];

    // System prompt
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Context history
    if (context.length > 0) {
      messages.push(...context);
    }

    // Tool results (якщо є)
    if (toolResults.length > 0) {
      const toolSummary = this._formatToolResults(toolResults);
      messages.push({
        role: 'system',
        content: `TOOL EXECUTION RESULTS:\n${toolSummary}`
      });
    }

    // User prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    // API request
    const requestBody = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: 2000
    };

    try {
      const startTime = Date.now();

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const content = data.choices?.[0]?.message?.content || '';

      logger.debug('llm-client', `[LLM Client] ✅ Generated (${latency}ms, ${content.length} chars)`);

      return content;

    } catch (error) {
      logger.error('llm-client', `[LLM Client] ❌ Generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Форматувати tool results для передачі в LLM
   * @private
   */
  _formatToolResults(toolResults) {
    return toolResults.map((result, index) => {
      if (result.success) {
        return `${index + 1}. ✅ ${result.tool}: ${JSON.stringify(result.result, null, 2)}`;
      } else {
        return `${index + 1}. ❌ ${result.tool}: Error - ${result.error}`;
      }
    }).join('\n\n');
  }

  /**
   * Streaming generation (для майбутнього)
   * @param {Object} options - Параметри генерації
   * @param {Function} onChunk - Callback для кожного chunk
   */
  async generateStream(options, onChunk) {
    // TODO: Implement streaming через Server-Sent Events
    throw new Error('Streaming not implemented yet');
  }

  /**
   * Graceful shutdown (немає процесів для зупинки)
   */
  async shutdown() {
    logger.system('llm-client', '[LLM Client] Shutting down (no active processes)');
    // HTTP client не потребує cleanup
  }
}

export default LLMClient;
