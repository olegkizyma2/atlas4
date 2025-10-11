/**
 * UNIFIED API CLIENT
 * Спільний клієнт для всіх API викликів
 */

import { logger } from './logger.js';
import { API_ENDPOINTS } from './config.js';

export class ApiClient {
  constructor(baseUrl, serviceName = 'API') {
    this.baseUrl = baseUrl;
    this.serviceName = serviceName;
    this.logger = new logger.constructor(serviceName);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    this.logger.debug(`${config.method} ${url}`, config.body ? JSON.parse(config.body) : null);

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let data;

      // Явний пріоритет responseType, якщо задано (наприклад, 'blob' для TTS)
      if (options.responseType === 'blob') {
        data = await response.blob();
      } else if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('audio/')) {
        data = await response.blob();
      } else {
        data = await response.text();
      }

      this.logger.debug(`Response from ${endpoint}`, typeof data === 'object' ? data : `${typeof data} (${data.length || 0})`);
      return { data, response };

    } catch (error) {
      this.logger.error(`Request failed: ${config.method} ${url}`, error.message);
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url);
  }

  async post(endpoint, data = null) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null
    });
  }

  async put(endpoint, data = null) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }

  // Streaming request for chat
  async stream(endpoint, data, onMessage, onError, onComplete) {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.info(`Starting stream: ${url}`);

    // Таймаут стріму з авто-оновленням на кожну активність
    const controller = new AbortController();
    // Базовий ліміт суттєво збільшуємо (довгі таски + TTS + верифікація)
    const STREAM_TIMEOUT_MS = 10 * 60 * 1000; // 10 хвилин
    let timeoutId;
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.logger.warn(`Stream timeout after ${STREAM_TIMEOUT_MS / 1000}s - aborting request`);
        controller.abort();
      }, STREAM_TIMEOUT_MS);
    };
    resetTimeout();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.info('Stream completed successfully');
          if (timeoutId) clearTimeout(timeoutId);
          if (onComplete) onComplete();
          break;
        }

        // Будь-яка активність у потоці — скидаємо таймер
        resetTimeout();

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            // SSE format: lines start with "data: " prefix
            // Remove it before parsing JSON
            const jsonString = line.startsWith('data: ') ? line.substring(6) : line;
            const message = JSON.parse(jsonString);
            // Тихо ігноруємо keepalive повідомлення
            if (message.type === 'keepalive') continue;
            if (onMessage) onMessage(message);
          } catch {
            // Логуємо тільки якщо це не схоже на keepalive
            if (!line.includes('keepalive')) {
              this.logger.warn('Failed to parse stream message', line);
            }
          }
        }
      }

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      // Не викидаємо AbortError як критичну помилку
      if (error.name === 'AbortError') {
        this.logger.warn('Stream was aborted (timeout or user action)');
        if (onComplete) onComplete(); // Викликаємо onComplete навіть при abort
        return; // Не викидаємо помилку
      }

      this.logger.error('Stream failed', error.message);
      if (onError) onError(error);
      throw error;
    }
  }
}

// Pre-configured API clients
export const orchestratorClient = new ApiClient(API_ENDPOINTS.orchestrator, 'ORCHESTRATOR');
export const frontendClient = new ApiClient(API_ENDPOINTS.frontend, 'FRONTEND');
export const ttsClient = new ApiClient(API_ENDPOINTS.tts, 'TTS');
export const gooseClient = new ApiClient(API_ENDPOINTS.goose, 'GOOSE');

// Спеціальні методи для веб-інтеграції з оркестратором
orchestratorClient.webIntegration = {
  // Отримати стан веб-інтерфейсу
  getWebState: () => orchestratorClient.request('/web/state'),

  // Логування
  addLog: (level, message, source, metadata) =>
    orchestratorClient.request('/web/logs', {
      method: 'POST',
      body: JSON.stringify({ level, message, source, metadata })
    }),

  // 3D Model API
  updateModel3D: (updates) =>
    orchestratorClient.request('/web/model3d/update', {
      method: 'POST',
      body: JSON.stringify(updates)
    }),

  triggerAnimation: (type, context) =>
    orchestratorClient.request('/web/model3d/animation', {
      method: 'POST',
      body: JSON.stringify({ type, context })
    }),

  setEmotion: (agent, emotion, intensity, duration) =>
    orchestratorClient.request('/web/model3d/emotion', {
      method: 'POST',
      body: JSON.stringify({ agent, emotion, intensity, duration })
    }),

  // TTS API
  startTTSVisualization: (text, options) =>
    orchestratorClient.request('/web/tts/start', {
      method: 'POST',
      body: JSON.stringify({ text, options })
    }),

  stopTTSVisualization: () =>
    orchestratorClient.request('/web/tts/stop', { method: 'POST' }),

  updateAudioAnalysis: (analysisData) =>
    orchestratorClient.request('/web/tts/analysis', {
      method: 'POST',
      body: JSON.stringify({ analysisData })
    }),

  // WebSocket Status
  getWebSocketStatus: () => orchestratorClient.request('/web/websocket/status')
};
