/**
 * AI STATE ANALYZER
 * Аналіз станів агентів за допомогою AI
 */

import axios from 'axios';
import { STATE_ANALYSIS_PROMPTS, FALLBACK_ANALYSIS_RULES, DEFAULT_STATES } from '../../prompts/system/state_analysis_prompts.mjs';

// Імпортуємо централізовані модулі
import stateManager from '../state/state-manager.js';
import logger from '../utils/logger.js';

// Функція для аналізу відповіді агента за допомогою AI
export async function analyzeAgentResponse(agent, response, stage) {
  logger.info(`[AI ANALYZER] Analyzing ${agent} response for stage: ${stage}`);

  // Отримуємо поточний стан з централізованого менеджера
  const currentState = stateManager.getCurrentState();

  // Перевіряємо чи response не undefined
  if (!response || response === 'undefined' || typeof response !== 'string') {
    logger.warn(`[AI Analysis] Invalid response for ${agent}/${stage}:`, response);

    // Оновлюємо стан з результатами аналізу
    stateManager.updateState({
      analysisResults: {
        predicted_state: getDefaultState(stage),
        confidence: 0.1,
        agent,
        stage
      }
    });

    return {
      predicted_state: getDefaultState(stage),
      confidence: 0.1
    };
  }

  // Функція для отримання дефолтного стану
  function getDefaultState(stage) {
    return DEFAULT_STATES[stage] || 'needs_analysis';
  }

  // Використовуємо імпортовані промпти
  const systemPrompts = STATE_ANALYSIS_PROMPTS;

  const systemPrompt = systemPrompts[stage] || `You are analyzing Ukrainian agent responses.
Return ONLY a valid JSON object with these exact fields:
{
    "predicted_state": string,
    "confidence": number (0.0-1.0)
}
DO NOT include any additional text, markdown formatting or explanation.`;

  // Використовуємо GPT-4o-mini для аналізу (оптимальний баланс якості та швидкості)
  const MODEL = 'openai/gpt-4o-mini';

  // Формуємо чіткий prompt для аналізу
  const userPrompt = `
CONTEXT:
Agent: ${agent}
Current Stage: ${stage}
Response to Analyze: "${response.trim()}"

TASK:
1. Analyze the response considering:
   - Agent's role and capabilities
   - Stage requirements and expectations
   - Ukrainian language context and meaning
   - Specific indicators mentioned in the system prompt

2. Return ONLY valid JSON with predicted_state and confidence (0.0-1.0)
3. Be precise and consider context carefully
4. Higher confidence for clear indicators, lower for ambiguous cases

ANALYZE NOW:`;

  try {
    // Використовуємо локальний fallback LLM сервер
    const response_ai = await axios.post('http://localhost:4000/v1/chat/completions', {
      model: MODEL,
      temperature: 0.1,
      max_tokens: 100,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    if (response_ai.data?.choices?.[0]?.message?.content) {
      const content = response_ai.data.choices[0].message.content.trim();
      console.log(`[AI Analysis] Raw response: ${content}`);

      try {
        const result = JSON.parse(content);
        if (result.predicted_state && typeof result.confidence === 'number') {
          logger.info(`[AI Analysis] Success: ${agent}/${stage} -> ${result.predicted_state} (${result.confidence})`);

          // Оновлюємо стан після успішного аналізу
          stateManager.updateState({
            analysisResults: {
              ...result,
              agent,
              stage,
              timestamp: new Date().toISOString()
            }
          });

          return result;
        }
      } catch (parseError) {
        console.warn(`[AI Analysis] JSON parse error: ${parseError.message}`);
      }
    }

    // NO FALLBACK - throw error if AI analysis fails
    logger.error(`[AI Analysis] Invalid AI response for ${agent}/${stage} - NO FALLBACK`);
    
    // Оновлюємо стан з помилкою
    stateManager.updateState({
      analysisResults: {
        predicted_state: 'analysis_failed',
        confidence: 0.0,
        agent,
        stage,
        error: 'AI analysis returned invalid response',
        timestamp: new Date().toISOString()
      }
    });

    throw new Error(`AI analysis failed for ${agent}/${stage}: Invalid response format`);

  } catch (error) {
    logger.error('AI Model Error:', error.message);
    
    // Оновлюємо стан з помилкою
    stateManager.updateState({
      analysisResults: {
        predicted_state: 'analysis_failed',
        confidence: 0.0,
        agent,
        stage,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    // Re-throw error instead of fallback
    throw new Error(`AI state analysis failed: ${error.message}`);
  }
}

/**
 * FALLBACK ANALYSIS REMOVED
 * Система тепер працює виключно на AI аналізі через LLM
 * При помилках генеруються exceptions замість fallback логіки
 */
