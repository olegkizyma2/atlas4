/**
 * CHAT MANAGER MODULE
 * Основна логіка чату, винесена з intelligent-chat-manager.js
 */

import { logger } from '../core/logger.js';
import { AGENTS, CHAT_CONFIG } from '../core/config.js';
import { orchestratorClient } from '../core/api-client.js';
import { TTSManager } from './tts-manager.js';

export class ChatManager {
  constructor() {
    this.logger = new logger.constructor('CHAT');
    this.ttsManager = new TTSManager();

    this.messages = [];
    this.isStreaming = false;
    this.isStreamPending = false;
    this.currentSession = null;

    /** @type {Map<string, Set<Function>>} */
    this.eventHandlers = new Map();

    this.ttsFailureCount = 0;
    this.ttsBackoffTimer = null;
    this.ttsPollingIntervalDuration = CHAT_CONFIG?.tts?.ttsPollingInterval || CHAT_CONFIG?.ttsPollingInterval || 500;

    // Нові налаштування для повного озвучення
    this.fullTextMode = CHAT_CONFIG?.tts?.fullTextMode ?? true;
    this.enableChunking = CHAT_CONFIG?.tts?.enableChunking ?? true;
    this.continuousPlayback = CHAT_CONFIG?.tts?.continuousPlayback ?? true;
    this.autoPlay = CHAT_CONFIG?.tts?.autoPlay ?? true;

    // Таймер для автоматичної розблокування якщо щось застряло
    this.streamingTimeout = null;

    // ВИДАЛЕНО: this.init() - викликається явно в app-refactored.js
    // Це запобігає подвійній ініціалізації
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (!handlers.size) {
        this.eventHandlers.delete(event);
      }
    }
  }

  emit(event, payload) {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        this.logger.warn(`Event handler error for ${event}`, error?.message || error);
      }
    });
  }

  async init() {
    if (this._initialized) {
      this.logger.debug('Chat Manager already initialized, skipping');
      return;
    }

    this.logger.info('Initializing Chat Manager...');

    // Додаємо лог у веб-інтерфейс
    if (window.atlasLogger) {
      window.atlasLogger.info('💬 Ініціалізація Chat Manager', 'ChatManager');
    }

    await this.ttsManager.init();
    this.setupUI();
    this.setupEventListeners();
    // НЕ запускаємо TTS polling, оскільки використовуємо прямий TTS
    // this.startTTSPolling();
    this._initialized = true;

    window.atlasChat = {
      chatManager: this,
      ttsManager: this.ttsManager
    };

    this.logger.info('Chat Manager initialized');

    // Додаємо лог у веб-інтерфейс
    if (window.atlasLogger) {
      window.atlasLogger.success('✅ Chat Manager готовий до роботи', 'ChatManager');
    }
  }

  setupUI() {
    this.chatContainer = document.getElementById('chat-container');
    this.inputElement = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');

    this.logger.info(`UI Elements found: chat-container=${!!this.chatContainer}, message-input=${!!this.inputElement}, send-button=${!!this.sendButton}`);

    if (!this.chatContainer || !this.inputElement || !this.sendButton) {
      this.logger.error('Required UI elements not found');
      return;
    }

    // Забезпечуємо що поле вводу розблоковане при ініціалізації
    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.focus(); // Додаємо фокус для зручності
    }
    if (this.sendButton) {
      this.sendButton.disabled = false;
    }

    this.setupAutoScroll();
  }

  setupEventListeners() {
    if (this.sendButton) {
      this.sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.isStreaming && this.inputElement?.value?.trim()) {
          this.sendMessage();
        }
      });
    }

    if (this.inputElement) {
      this.inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!this.isStreaming && this.inputElement.value.trim()) {
            this.sendMessage();
          }
        }
      });
    }

    window.addEventListener('atlas-tts-completed', (e) => {
      this.logger.info(`TTS completed for ${e.detail.agent}`);
    });
  }

  setupAutoScroll() {
    if (!this.chatContainer) return;

    const observer = new MutationObserver(() => {
      this.scrollToBottom();
    });

    observer.observe(this.chatContainer, {
      childList: true,
      subtree: true
    });
  }

  scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  addMessage(content, agent = 'user', signature = null) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      agent,
      signature: signature || AGENTS[agent]?.signature || `[${agent.toUpperCase()}]`,
      timestamp: Date.now(),
      color: AGENTS[agent]?.color || '#ffffff'
    };

    this.messages.push(message);
    this.renderMessage(message);

    if (this.messages.length > CHAT_CONFIG.maxMessages) {
      this.messages.shift();
      this.removeOldestMessage();
    }

    return message;
  }

  addUserMessage(content) {
    return this.addMessage(content, 'user');
  }

  renderMessage(message) {
    if (!this.chatContainer) return;

    const messageElement = document.createElement('div');
    const agentClass = `agent-${message.agent || 'system'}`;
    messageElement.className = `chat-entry ${agentClass}`;
    messageElement.setAttribute('data-message-id', message.id);

    const timestamp = new Date(message.timestamp).toLocaleTimeString('uk-UA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    messageElement.innerHTML = `
            <span class="chat-timestamp">${timestamp}</span>
            <span class="chat-agent">${message.signature || message.agent}</span>
            <span class="chat-message">${this.formatMessageContent(message.content)}</span>
        `;

    this.chatContainer.appendChild(messageElement);
  }

  formatMessageContent(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  removeOldestMessage() {
    if (!this.chatContainer) return;
    const firstMessage = this.chatContainer.querySelector('.message');
    if (firstMessage) {
      firstMessage.remove();
    }
  }

  async sendMessage(message) {
    const input = (typeof message === 'string' && message.trim())
      ? message.trim()
      : this.inputElement?.value?.trim();

    this.logger.info(`💬 sendMessage called with: "${input}" (isStreaming: ${this.isStreaming})`);

    if (!input || this.isStreaming) {
      this.logger.warn(`❌ Message rejected - ${!input ? 'empty input' : 'already streaming'}`);
      return;
    }

    const isManualInput = typeof message !== 'string';
    if (this.inputElement && isManualInput) {
      // Очищуємо поле тільки для ручного введення, щоб програмні виклики могли повторно використати текст
      this.inputElement.value = '';
    }

    this.addMessage(input, 'user');
    this.emit('message-sent', { message: input });

    this.setStreamingState(true);

    try {
      this.logger.info('Starting message stream...');
      await this.streamFromOrchestrator(input);
      this.logger.info('Message stream completed successfully');
    } catch (error) {
      this.logger.error('Failed to send message', error.message);
      this.addMessage(`❌ Помилка: ${error.message}`, 'error');
    } finally {
      this.logger.info('Cleaning up streaming state...');
      this.setStreamingState(false);
    }
  }

  async streamFromOrchestrator(message) {
    this.logger.info(`Streaming to orchestrator: ${message.substring(0, 50)}...`);

    // Додаємо лог у веб-інтерфейс
    if (window.atlasLogger) {
      window.atlasLogger.info('📤 Відправка повідомлення до Orchestrator', 'Chat-System');
    }

    const sessionId = this.currentSession || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = sessionId;

    return new Promise((resolve, reject) => {
      orchestratorClient.stream(
        '/chat/stream',
        {
          message,
          sessionId,
          enableTTS: this.ttsManager.isEnabled()
        },
        (data) => this.handleStreamMessage(data),
        (error) => {
          this.logger.error('Stream error', error.message);

          // Додаємо лог у веб-інтерфейс
          if (window.atlasLogger) {
            window.atlasLogger.error(`❌ Помилка потоку: ${error.message}`, 'Chat-System');
          }

          reject(error);
        },
        async () => {
          this.logger.info('Stream completed');

          // Додаємо лог у веб-інтерфейс
          if (window.atlasLogger) {
            window.atlasLogger.success('✅ Потік завершено успішно', 'Chat-System');
          }
          if (this._ttsSequence) {
            try {
              await this._ttsSequence;
            } catch (waitError) {
              this.logger.debug('TTS sequence wait failed:', waitError?.message || waitError);
            }
          }
          resolve();
        }
      );
    });
  }

  async streamFromOrchestratorWithOptions(message, options = {}) {
    this.logger.info(`Streaming (opts) to orchestrator: ${message.substring(0, 50)}...`);

    const sessionId = this.currentSession || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = sessionId;

    return new Promise((resolve, reject) => {
      orchestratorClient.stream(
        '/chat/stream',
        {
          message,
          sessionId,
          enableTTS: this.ttsManager.isEnabled(),
          ...options
        },
        (data) => this.handleStreamMessage(data),
        (error) => {
          this.logger.error('Stream error', error.message);
          reject(error);
        },
        () => {
          this.logger.info('Stream completed');
          resolve();
        }
      );
    });
  }

  async handleStreamMessage(data) {
    // Будь-яке повідомлення з потоку означає активність — оновлюємо внутрішній таймер
    if (this.isStreaming && this.streamingTimeout) {
      clearTimeout(this.streamingTimeout);
      // подовжуємо ще на 150с від моменту останньої активності
      this.streamingTimeout = setTimeout(() => {
        this.logger.warn('Streaming timeout after 150s - force unlocking input. Check orchestrator connection.');
        if (window.atlasLogger) {
          window.atlasLogger.warn('⏰ Тайм-аут streaming - автоматичне розблокування', 'Chat-System');
        }
        this.setStreamingState(false);
      }, 150000);
    }

    switch (data.type) {
      case 'agent_message':
        this._ttsSequence = (this._ttsSequence || Promise.resolve()).then(() =>
          this.handleAgentMessage(data.data)
        );
        await this._ttsSequence;
        break;
      case 'status_update':
        this.handleStatusUpdate(data.data);
        break;
      case 'error':
        this.handleError(data.data);
        break;
      case 'workflow_started':
        this.handleWorkflowStarted(data.data);
        break;
      case 'workflow_complete':
        this.handleWorkflowComplete(data.data);
        break;
      case 'tts_start':
        this.emit('tts-start', data.data);
        break;
      case 'tts_stop':
        this.emit('tts-stop', data.data);
        break;
      default:
        this.logger.debug('Unknown stream message type', data.type);
    }
  }

  handleWorkflowStarted(data) {
    this.logger.info('🚀 Workflow started - enabling global stop listening');
    try {
      const voiceIntegration = window.atlasApp?.managers?.voiceControl;
      const voiceManager = voiceIntegration?.voiceControl;
      const microphoneService = voiceManager?.getService?.('microphone');

      if (microphoneService?.onWorkflowStarted) {
        microphoneService.onWorkflowStarted();
      }
    } catch (error) {
      this.logger.debug('Failed to notify microphone service about workflow start:', error?.message || error);
    }

    this.emit('workflow-started', data);
  }

  handleWorkflowComplete(data) {
    this.logger.info('✅ Workflow completed - disabling global stop listening');
    try {
      const voiceIntegration = window.atlasApp?.managers?.voiceControl;
      const voiceManager = voiceIntegration?.voiceControl;
      const microphoneService = voiceManager?.getService?.('microphone');
      if (microphoneService?.onWorkflowCompleted) {
        microphoneService.onWorkflowCompleted();
      }
    } catch (error) {
      this.logger.debug('Failed to notify microphone service about workflow completion:', error?.message || error);
    }

    this.addMessage('✅ Завдання виконано', 'system');
    this.emit('workflow-complete', data);
  }

  async handleAgentMessage(messageData) {
    const { content, agent, ttsContent, voice, messageId, mode, ttsOptimized } = messageData;

    // Додаємо лог у веб-інтерфейс
    if (window.atlasLogger) {
      const agentName = agent.toUpperCase();
      const statusText = `📝 Відповідь від ${agentName}`;
      window.atlasLogger.success(statusText, `Agent-${agentName}`);
    }

    this.emit('agent-response-start', messageData);
    const message = this.addMessage(content, agent);
    this.emit('agent-response-complete', { agent, message });

    // Миттєве підтвердження рендера повідомлення Тетяни для розблокування workflow на бекенді
    if (agent === 'tetyana' && this.currentSession && messageId) {
      // Чекаємо один кадр, щоб гарантовано відбулася отрисовка DOM
      requestAnimationFrame(() => {
        orchestratorClient.post('/chat/confirm', {
          sessionId: this.currentSession,
          messageId
        }).catch(err => {
          this.logger.debug('Failed to send chat confirmation:', err?.message || err);
        });
      });
    }

    // Захист від дублювання TTS за messageId
    const ttsKey = `tts_${messageId || 'unknown'}`;
    if (this._processedTTS?.has(ttsKey)) {
      this.logger.debug(`TTS already processed for message: ${ttsKey}`);
      return message;
    }

    // Ініціалізуємо Set для відстеження оброблених TTS
    if (!this._processedTTS) {
      this._processedTTS = new Set();
    }

    // TTS відтворення - віддаємо перевагу оптимізованому тексту, якщо він доступний
    let textForTTS;
    if (ttsOptimized && ttsContent && ttsContent.trim()) {
      textForTTS = ttsContent.trim();
      this.logger.debug(`Using optimized TTS content: ${textForTTS.length} characters`);
    } else if (this.fullTextMode) {
      // Повний текст (content) - замість скороченого ttsContent
      textForTTS = content;
      this.logger.debug(`Using full text mode for TTS: ${content?.length || 0} characters`);
    } else {
      // Стандартний режим (скорочений текст)
      textForTTS = ttsContent || content;
    }

    // КРИТИЧНЕ ВИПРАВЛЕННЯ: Видаляємо сигнатури агентів [ATLAS], [ТЕТЯНА], [ГРИША] перед TTS
    // Щоб не озвучувались лейбели, які вже є в інтерфейсі чату
    textForTTS = textForTTS?.replace(/^\[.*?\]\s*/, '').trim();

    if (textForTTS && textForTTS.trim() && this.ttsManager.isEnabled()) {
      try {
        const agentConfig = AGENTS[agent];
        const ttsVoice = voice || agentConfig?.voice;

        if (ttsVoice) {
          // Позначаємо як оброблене
          this._processedTTS.add(ttsKey);

          // Визначаємо чи потрібно чанкування: тільки для task режиму
          const isTaskMode = mode === 'task';
          const shouldChunk = isTaskMode && this.enableChunking && textForTTS.length > 500;

          this.logger.info(`🎵 Queueing TTS for ${agent} (voice: ${ttsVoice}, mode: ${mode || 'chat'}, fullText: ${this.fullTextMode ? 'YES' : 'NO'}, chunking: ${shouldChunk ? 'YES' : 'NO'}, length: ${textForTTS.length})`);

          // Емітимо події для UI
          this.emit('tts-start', { agent, voice: ttsVoice, text: textForTTS, mode });

          const voiceIntegration = window.atlasApp?.managers?.voiceControl;
          const voiceManager = voiceIntegration?.voiceControl;
          const microphoneService = voiceManager?.getService?.('microphone');
          if (microphoneService?.pauseForTTS) {
            try {
              microphoneService.pauseForTTS(agent);
            } catch (pauseError) {
              this.logger.debug('Microphone pause for TTS failed:', pauseError?.message || pauseError);
            }
          }

          // CRITICAL FIX: Використовуємо чергу TTS щоб поточне озвучення завершилось перед наступним
          // Це запобігає ситуації коли Атлас ще говорить завдання, а Тетяна вже виконує його
          const ttsOptions = { mode: mode || 'chat' };
          await this.ttsManager.addToQueue(textForTTS, agent, ttsOptions);

          this.logger.info(`✅ TTS completed for ${agent}`);

          // CRITICAL (11.10.2025 - 17:40): Debug logging для conversation loop
          const eventData = { agent, voice: ttsVoice, mode: mode || 'chat' };
          console.log('[CHAT] 📢 Emitting tts-stop event:', eventData, {
            hasEventHandlers: this.eventHandlers.has('tts-stop'),
            handlersCount: this.eventHandlers.get('tts-stop')?.size || 0
          });

          // CRITICAL: Передаємо mode для conversation loop detection
          this.emit('tts-stop', eventData);

          if (microphoneService?.resumeAfterTTS) {
            try {
              microphoneService.resumeAfterTTS(agent);
            } catch (resumeError) {
              this.logger.debug('Microphone resume after TTS failed:', resumeError?.message || resumeError);
            }
          }

          // Очищаємо через 30 секунд для запобігання переповнення пам'яті
          setTimeout(() => {
            this._processedTTS?.delete(ttsKey);
          }, 30000);
        } else {
          this.logger.debug(`No voice configured for agent: ${agent}`);
        }
      } catch (error) {
        this.logger.error(`TTS failed for ${agent}:`, error?.message || error);
        // Видаляємо з обробленого при помилці для можливості повтору
        this._processedTTS?.delete(ttsKey);
      }
    }

    return message;
  }

  handleStatusUpdate(statusData) {
    const { agent, stage, status } = statusData;
    this.logger.info(`Status update: ${agent} - ${stage} - ${status}`);
    this.showStatusIndicator(agent, stage, status);
  }

  handleError(errorData) {
    const { message, agent } = errorData;
    this.logger.error(`Agent error: ${agent}`, message);
    this.addMessage(`❌ ${agent}: ${message}`, 'error');
    this.emit('agent-error', { agent, message });
  }

  showStatusIndicator(agent, stage, status) {
    const agentName = AGENTS[agent]?.name || agent;
    const statusMessage = `${agentName}: ${stage} - ${status}`;
    this.logger.debug(statusMessage);
    this.emit('status-update', { agent, stage, status });
  }

  setStreamingState(isStreaming) {
    this.isStreaming = isStreaming;

    // Очищуємо попередній таймер
    if (this.streamingTimeout) {
      clearTimeout(this.streamingTimeout);
      this.streamingTimeout = null;
    }

    if (this.sendButton) {
      this.sendButton.disabled = isStreaming;
      this.sendButton.textContent = isStreaming ? 'Обробка...' : 'Відправити';
    }

    if (this.inputElement) {
      this.inputElement.disabled = isStreaming;
    }

    // Автоматична розблокування через 2.5 хвилини якщо щось застряло (для довгих TTS)
    if (isStreaming) {
      this.streamingTimeout = setTimeout(() => {
        this.logger.warn('Streaming timeout after 150s - force unlocking input. Check orchestrator connection.');

        // Додаємо лог у веб-інтерфейс
        if (window.atlasLogger) {
          window.atlasLogger.warn('⏰ Тайм-аут streaming - автоматичне розблокування', 'Chat-System');
        }

        this.setStreamingState(false);
      }, 150000);
    }
  }

  // ==========================================
  // TTS POLLING ВИДАЛЕНО - використовуємо прямий TTS
  // ==========================================
  // Старий механізм TTS polling призводив до дублювання TTS викликів
  // Тепер TTS викликається безпосередньо в handleAgentMessage()

  enableTTS() {
    localStorage.setItem('atlas_voice_enabled', 'true');
    this.logger.info('TTS enabled');
  }

  disableTTS() {
    localStorage.setItem('atlas_voice_enabled', 'false');
    this.ttsManager.stop();
    this.logger.info('TTS disabled');
  }

  setTTSMode(mode) {
    this.ttsManager.setMode(mode);
  }

  getTTSMode() {
    return this.ttsManager.getMode();
  }

  clearChat() {
    this.messages = [];
    if (this.chatContainer) {
      this.chatContainer.innerHTML = '';
    }
    this.logger.info('Chat cleared');
  }

  destroy() {
    if (this.ttsPollingInterval) {
      clearInterval(this.ttsPollingInterval);
      this.ttsPollingInterval = null;
    }

    if (this.eventHandlers) {
      this.eventHandlers.clear();
    }

    if (this.ttsPollingInterval) {
      clearInterval(this.ttsPollingInterval);
      this.ttsPollingInterval = null;
    }

    if (this.ttsBackoffTimer) {
      clearTimeout(this.ttsBackoffTimer);
      this.ttsBackoffTimer = null;
    }

    if (this.sendButton) {
      this.sendButton.disabled = false;
      this.sendButton.textContent = 'Відправити';
    }

    if (this.inputElement) {
      this.inputElement.disabled = false;
    }

    this.logger.info('Chat Manager destroyed');
  }
}
