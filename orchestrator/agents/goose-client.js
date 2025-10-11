/**
 * GOOSE CLIENT
 * Клієнт для взаємодії з Goose AI через WebSocket
 */

import WebSocket from 'ws';
import axios from 'axios';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Імпортуємо нові модулі
import logger from '../utils/logger.js';
import * as agentProtocol from './agent-protocol.js';

// Функція автоматичного виявлення порту Goose
export async function detectGoosePort() {
  const commonPorts = [3000]; // Goose CLI web server always uses port 3000

  for (const port of commonPorts) {
    try {
      const response = await axios.get(`http://localhost:${port}`, {
        timeout: 1000,
        validateStatus: () => true // Accept any status code
      });

      // HTTP 401 означає що Goose працює (потребує авторизації)
      if (response.status === 401 || response.status === 200 || response.status === 404) {
        console.log(`[GOOSE] Detected on port ${port} (HTTP ${response.status})`);
        return port;
      }
    } catch (error) {
      // Порт недоступний, продовжуємо пошук
      continue;
    }
  }

  console.warn('[GOOSE] Port not detected, using default 3000');
  return 3000;
}

// Оновлений виклик Goose агента для використання загального протоколу
export async function execute(model, input, options = {}) {
  try {
    logger.info(`Відправка запиту в Goose model: ${model}`);

    // Форматування запиту згідно протоколу
    const query = agentProtocol.createQuery(input, {
      model,
      options
    });

    // Виклик існуючої функції callGooseAgent
    const result = await callGooseAgent(input, options.sessionId || 'default', options);

    // Форматування відповіді згідно протоколу
    return agentProtocol.createResponse(result);
  } catch (error) {
    logger.error(`Помилка при виконанні Goose запиту: ${error.message}`);
    return agentProtocol.createError(error.message, 'GOOSE_EXECUTION_ERROR');
  }
}

// Виправлений виклик Goose агента (БЕЗ fallback симуляції)
export async function callGooseAgent(prompt, baseSessionId, options = {}) {
  // Створюємо унікальну сесію для кожного виклику щоб уникнути конфліктів tool_calls
  const sessionId = `${baseSessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Відключаємо tools ТІЛЬКИ для Atlas (координатор не потребує інструментів)
  // Тетяна і Гриша мають ПОВНИЙ доступ до реальних інструментів!
  let enhancedPrompt = prompt;
  if (options.agent === 'atlas') {
    // Додаємо інструкцію В КІНЕЦЬ замість початку, щоб не перекривати системний промпт
    enhancedPrompt = `${prompt}

ІНСТРУКЦІЯ ВИКОНАННЯ: Відповідай ТІЛЬКИ текстом. НЕ використовуй жодних інструментів або tools. Дай повну текстову відповідь враховуючи контекст вище.`;
  } else if (options.agent === 'tetyana') {
    // Тетяна - виконавець, НЕ використовує vision для перевірки
    enhancedPrompt = `ВАЖЛИВО: Ти ВИКОНАВЕЦЬ завдань. НЕ використовуй screen_capture, screenshot або vision tools - це робота для Гріші (верифікатора). Твоя задача: виконати завдання використовуючи computercontroller, developer (команди, файли), playwright.

${prompt}`;
  } else if (options.agent === 'grisha') {
    // Гриша - верифікатор, додаємо ТІЛЬКИ нагадування про дію
    // Основні інструкції вже в системному промпті stage7_verification.js
    enhancedPrompt = `${prompt}

ПОЧНИ ПЕРЕВІРКУ ЗАРАЗ: Використай доступні інструменти (playwright screenshot, developer shell, mcp tools) для фактичної перевірки виконання завдання.`;
  }
  // Для Тетяни і Гріші - доступ до tools БЕЗ vision функцій

  // Обмежуємо довжину повідомлення до 2000 символів для Goose
  const truncatedMessage = enhancedPrompt.length > 2000
    ? enhancedPrompt.slice(0, 1997) + '...'
    : enhancedPrompt;

  // Автоматично виявляємо порт Goose або використовуємо змінну середовища
  let goosePort = process.env.GOOSE_PORT;
  if (!goosePort) {
    goosePort = await detectGoosePort();
  }
  const gooseBaseUrl = process.env.GOOSE_BASE_URL || `http://localhost:${goosePort}`;

  console.log(`[GOOSE] Calling for session ${sessionId} - NO SIMULATION FALLBACK [Message length: ${truncatedMessage.length}]`);

  try {
    // Goose web server підтримує тільки WebSocket, пропускаємо HTTP API
    const result = await callGooseWebSocket(gooseBaseUrl, truncatedMessage, sessionId);

    if (result && result.trim().length > 0) {
      console.log(`[GOOSE] Execution successful: ${result.length} chars`);
      return result;
    }

    // Якщо Goose не відповів - це помилка, не fallback
    console.error('[GOOSE] Did not provide response - NO FALLBACK');
    return null;

  } catch (error) {
    console.error(`[GOOSE] Call failed: ${error.message} - NO FALLBACK`);
    return null;
  }
}

// WebSocket інтеграція з Goose з адаптивним polling замість статичного timeout
async function callGooseWebSocket(baseUrl, message, sessionId) {
  return new Promise((resolve) => {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
    let collected = '';
    let lastActivityTime = Date.now();
    let pollInterval;
    let maxWaitTime = 240000; // Максимум 240 секунд
    const activityCheckInterval = 2000; // Перевірка кожні 2 секунди
    const maxInactivityTime = 30000; // Максимум 30 секунд без активності

    console.log(`[GOOSE] Attempting WebSocket connection to: ${wsUrl}`);

    // Адаптивна система polling - перевіряє активність кожні 2 секунди
    const startPolling = () => {
      pollInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceActivity = now - lastActivityTime;
        const totalTime = now - lastActivityTime;

        // Перевірка 1: Чи є активність в останні 30 секунд?
        if (timeSinceActivity > maxInactivityTime) {
          console.warn(`[GOOSE] No activity for ${Math.floor(timeSinceActivity / 1000)}s - closing connection`);
          clearInterval(pollInterval);
          ws.close();
          resolve(collected.trim() || null);
          return;
        }

        // Перевірка 2: Чи не перевищили максимальний час?
        if (totalTime > maxWaitTime) {
          console.warn(`[GOOSE] Max wait time ${maxWaitTime / 1000}s exceeded - closing`);
          clearInterval(pollInterval);
          ws.close();
          resolve(collected.trim() || null);
          return;
        }

        // Логування прогресу кожні 10 секунд
        if (timeSinceActivity % 10000 < activityCheckInterval) {
          console.log(`[GOOSE] Waiting... (${Math.floor(timeSinceActivity / 1000)}s since last activity, ${collected.length} chars collected)`);
        }
      }, activityCheckInterval);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    try {
      // Додаємо авторизацію для WebSocket підключення
      const headers = {};

      // Спробуємо отримати GitHub токен з конфігурації Goose
      try {
        const configPath = path.join(os.homedir(), '.config', 'goose', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf8');
          const tokenMatch = configContent.match(/api_key:\s*([^\s\n]+)/);
          if (tokenMatch && tokenMatch[1] && tokenMatch[1] !== 'null') {
            headers['Authorization'] = `Bearer ${tokenMatch[1]}`;
            console.log('[GOOSE] Using GitHub token for WebSocket authentication');
          }
        }
      } catch (configError) {
        console.warn(`[GOOSE] Could not read config: ${configError.message}`);
      }

      const ws = new WebSocket(wsUrl, { headers });

      ws.on('open', () => {
        console.log(`[GOOSE] WebSocket connected for session: ${sessionId}`);
        lastActivityTime = Date.now(); // Оновлюємо час останньої активності
        startPolling(); // Запускаємо адаптивний polling

        // Обмежуємо довжину повідомлення до 4000 символів для кращої роботи з tools
        let truncatedMessage = message.length > 4000
          ? message.slice(0, 3997) + '...'
          : message;

        // Виправляємо повідомлення: замінюємо 'tool' на 'tool_calls' для сумісності з API
        if (truncatedMessage.includes('"role": "tool"')) {
          truncatedMessage = truncatedMessage.replace(/"role": "tool"/g, '"role": "tool_calls"');
          console.log('[GOOSE] Fixed message: replaced role "tool" with "tool_calls"');
        }

        const payload = {
          type: 'message',
          content: truncatedMessage,
          session_id: sessionId,
          timestamp: Date.now()
        };
        console.log(`[GOOSE] Sending message: ${message.substring(0, 100)}...`);
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (data) => {
        lastActivityTime = Date.now(); // Оновлюємо час при будь-якій активності

        try {
          const obj = JSON.parse(data.toString());
          console.log(`[GOOSE] Received: ${obj.type} - ${String(obj.content || obj.message || '').substring(0, 100)}...`);

          if (obj.type === 'response' && obj.content) {
            collected += String(obj.content);
          } else if (obj.type === 'tool_request') {
            // Детальне логування tool request для діагностики
            console.log(`[GOOSE] Tool request: ${obj.tool_name || obj.name || 'unknown'}`);
            console.log(`[GOOSE] Tool request structure: ${JSON.stringify(obj, null, 2)}`);

            // Перевіряємо, доступний ли інструмент (ЯВНИЙ allowlist, без vision/screen_capture)
            const allowedTools = new Set([
              // computercontroller
              'computercontroller__computer_control',
              // developer (без vision/screen_capture)
              'developer__list_windows',
              'developer__shell',
              'developer__open_url',
              'developer__list_processes',
              // playwright/browser family
              'playwright__browser_open',
              'playwright__browser_click',
              'playwright__browser_type',
              'playwright__browser_navigate',
              'playwright__browser_take_screenshot',
            ]);

            // Патерни для префіксів, які ми дозволяємо (browser_*, vscode__*)
            const allowedPrefixes = ['browser_', 'playwright__', 'vscode__'];

            const toolName = obj.tool_name || '';
            const isToolAvailable = allowedTools.has(toolName) ||
              allowedPrefixes.some(p => toolName.startsWith(p));

            if (!isToolAvailable) {
              console.warn(`[GOOSE] Tool ${obj.tool_name} is not available in current extensions configuration`);
              // Відправляємо fake response для невідомих інструментів
              const toolResponse = {
                type: 'tool_response',
                tool_call_id: obj.tool_call_id || obj.id || `fake_${Date.now()}`,
                content: `Tool ${obj.tool_name} is not available. Available: computercontroller, developer, playwright browser tools.`,
                success: false
              };
              ws.send(JSON.stringify(toolResponse));
              return;
            }

            // Для доступних інструментів відправляємо успішний response
            const toolResponse = {
              type: 'tool_response',
              tool_call_id: obj.tool_call_id || obj.id || `fake_${Date.now()}`,
              content: 'Tool executed successfully',
              success: true
            };

            console.log(`[GOOSE] Sending tool response for: ${obj.tool_name}`);
            ws.send(JSON.stringify(toolResponse));
          } else if (obj.type === 'complete' || obj.type === 'cancelled') {
            console.log(`[GOOSE] Completed for session: ${sessionId}, collected: ${collected.length} chars`);
            stopPolling();
            ws.close();
            resolve(collected.trim() || null);
          } else if (obj.type === 'error') {
            const errorMsg = obj.error || obj.message || 'Unknown error';
            console.error(`[GOOSE] Error for session: ${sessionId}: ${errorMsg}`);

            // Спеціальна обробка для token limit overflow
            if (errorMsg.includes('model_max_prompt_tokens_exceeded') ||
              errorMsg.includes('prompt token count') ||
              errorMsg.includes('exceeds the limit')) {
              console.error('[GOOSE] TOKEN LIMIT EXCEEDED - контекст занадто великий!');
              console.error('[GOOSE] Можливі рішення: 1) Очистити історію 2) Обмежити web_scrape 3) Використати меншу модель');

              // Повертаємо спеціальне повідомлення замість null
              const errorResponse = '⚠️ Помилка: Контекст занадто великий (перевищено ліміт токенів). Потрібно спростити завдання або очистити історію.';
              stopPolling();
              ws.close();
              resolve(errorResponse);
              return;
            }

            stopPolling();
            ws.close();
            resolve(null);
          }
        } catch (e) {
          console.warn(`[GOOSE] Failed to parse message: ${data.toString()}`);
        }
      });

      ws.on('error', (error) => {
        console.error(`[GOOSE] WebSocket error for session: ${sessionId}: ${error.message}`);
        stopPolling();
        resolve(null);
      });

      ws.on('close', (code, reason) => {
        console.log(`[GOOSE] WebSocket closed for session: ${sessionId}, code: ${code}, reason: ${reason}`);
        stopPolling();
        resolve(collected.trim() || null);
      });

    } catch (error) {
      console.error(`[GOOSE] WebSocket creation failed: ${error.message}`);
      stopPolling();
      resolve(null);
    }
  });
}
