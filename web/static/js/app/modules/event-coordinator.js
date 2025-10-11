/**
 * ATLAS Event Coordinator - v4.0
 * Відповідає за інтеграцію та координацію подій між компонентами
 */

import { logger } from '../core/logger.js';
import { orchestratorClient } from '../core/api-client.js';
import { eventManager, Events as VoiceEvents } from '../voice-control/events/event-manager.js';

export class EventCoordinator {
  constructor(managers) {
    this.logger = new logger.constructor('EVENT-COORDINATOR');
    this.managers = managers;
    this.voiceControlSubscriptions = [];
  }

  integrateAllComponents() {
    this.logger.info('🔗 Starting components integration...');

    // Інтеграція чату з TTS та живою системою
    this.integrateChatSystem();

    // Інтеграція голосового управління
    this.integrateVoiceControl();

    // Інтеграція conversation mode
    this.integrateConversationMode();

    // Інтеграція розширеної UI системи
    this.integrateAdvancedUI();

    this.logger.info('✅ All components integrated successfully');
  }

  integrateChatSystem() {
    if (!this.managers.chat) return;

    // Інтеграція з TTS візуалізацією
    if (this.managers.ttsVisualization) {
      this.managers.chat.on('tts-start', (data) => {
        this.managers.ttsVisualization.startTTS(data.text, data.audioElement || null);

        // Інтегруємо з живою системою Атласа
        if (this.managers.livingBehavior) {
          this.managers.livingBehavior.onTTSStart(data.text, data.audioElement);
        }

        // Відправляємо на сервер через WebSocket з правильним voice
        this.managers.webSocket.startTTSVisualization(data.text, {
          agent: data.agent || 'atlas',
          voice: data.voice || 'mykyta',
          emotion: data.emotion || 'neutral',
          speed: data.speed || 1.0
        });
      });

      this.managers.chat.on('tts-stop', () => {
        this.managers.ttsVisualization.stopTTS();

        if (this.managers.livingBehavior) {
          this.managers.livingBehavior.onTTSEnd();
        }

        this.managers.webSocket.stopTTSVisualization();
      });
    }

    // Інтеграція з живою системою GLB
    const activeModelController = this.managers.glbLivingSystem || this.managers.livingBehavior || this.managers.model3D;
    if (activeModelController) {
      this.managers.chat.on('message-sent', () => {
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.reactToEvent('message-sent');
          this.managers.glbLivingSystem.setEmotion('listening', 0.7, 1500);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('listening', 0.6, 1500);
        } else {
          this.managers.model3D.triggerEmotion('listening', { intensity: 0.6, duration: 1500 });
        }
        this.managers.webSocket.setEmotion('user', 'listening', 0.6, 1500);
      });

      this.managers.chat.on('agent-response-start', (data) => {
        const agentName = data.agent || 'atlas';
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.reactToEvent('agent-thinking', { agent: agentName });
          this.managers.glbLivingSystem.setEmotion('thinking', 0.8, 2000);
          this.managers.glbLivingSystem.startSpeaking(agentName, 0.8);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('thinking', 0.8, 2000);
        } else {
          this.managers.model3D.triggerEmotion('thinking', { intensity: 0.8, duration: 2000 });
        }
        this.managers.webSocket.setEmotion(agentName, 'thinking', 0.8, 2000);
      });

      this.managers.chat.on('agent-response-complete', (data) => {
        const agentName = data.agent || 'atlas';
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.stopSpeaking();
          this.managers.glbLivingSystem.setEmotion('satisfied', 0.7, 2000);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('satisfied', 0.7, 2000);
        } else {
          this.managers.model3D.triggerEmotion('satisfied', { intensity: 0.7, duration: 2000 });
        }
        this.managers.webSocket.setEmotion(agentName, 'satisfied', 0.7, 2000);
      });
    }
  }

  integrateVoiceControl() {
    const activeModelController = this.managers.glbLivingSystem || this.managers.livingBehavior || this.managers.model3D;
    if (!activeModelController) return;

    // Очистка попередніх підписок
    if (Array.isArray(this.voiceControlSubscriptions) && this.voiceControlSubscriptions.length) {
      this.voiceControlSubscriptions.forEach((subscriptionId) => {
        if (subscriptionId) {
          eventManager.off(subscriptionId);
        }
      });
      this.voiceControlSubscriptions = [];
    }

    const subscriptions = [];

    // Підписка на зміни стану мікрофона
    const micStateSub = eventManager.on(VoiceEvents.MICROPHONE_STATE_CHANGED, (event) => {
      const state = event?.payload?.state;
      if (!state) return;

      if (state === 'error' || state === 'timeout') {
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.reactToEvent('error');
          this.managers.glbLivingSystem.setEmotion('alert', 1.0, 400);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('alert', 1.0, 400);
        } else {
          this.managers.model3D.triggerAnimation('alert');
        }
        this.managers.webSocket.setEmotion('user', 'alert', 1.0, 400);
      } else if (state === 'recording') {
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.reactToEvent('recording-start');
          this.managers.glbLivingSystem.setEmotion('focused', 0.9, 1200);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('focused', 0.9, 1200);
        } else {
          this.managers.model3D.triggerEmotion('focused', { intensity: 0.9, duration: 1200 });
        }
        this.managers.webSocket.setEmotion('user', 'focused', 0.9, 1200);
      } else if (state === 'idle') {
        if (this.managers.glbLivingSystem) {
          this.managers.glbLivingSystem.reactToEvent('recording-stop');
          this.managers.glbLivingSystem.setEmotion('neutral', 0.4, 800);
        } else if (this.managers.livingBehavior) {
          this.managers.livingBehavior.setEmotion('neutral', 0.4, 800);
        } else {
          this.managers.model3D.triggerEmotion('neutral', { intensity: 0.4, duration: 800 });
        }
        this.managers.webSocket.setEmotion('user', 'neutral', 0.4, 800);
      }
    });

    if (micStateSub) {
      subscriptions.push(micStateSub);
    }

    // Підписка на виявлення ключових слів
    const keywordSub = eventManager.on(VoiceEvents.KEYWORD_DETECTED, (event) => {
      const keyword = event?.payload?.keyword;
      if (!keyword) return;

      if (this.managers.glbLivingSystem) {
        this.managers.glbLivingSystem.reactToEvent('keyword-detected', { keyword });
        this.managers.glbLivingSystem.setEmotion('excited', 0.9, 1200);
      } else if (this.managers.livingBehavior) {
        this.managers.livingBehavior.setEmotion('excited', 0.8, 1200);
      } else {
        this.managers.model3D.triggerEmotion('excited', { intensity: 0.8, duration: 1200 });
      }
      this.managers.webSocket.setEmotion('user', 'excited', 0.8, 1200);
    });

    if (keywordSub) {
      subscriptions.push(keywordSub);
    }

    this.voiceControlSubscriptions = subscriptions;
  }

  integrateConversationMode() {
    if (!this.managers.conversationMode) return;

    this.logger.info('🔗 Integrating Conversation Mode with system...');

    // 1. Підключення до Chat Manager для відправки повідомлень
    eventManager.on('SEND_CHAT_MESSAGE', (event) => {
      if (this.managers.chat && event.text) {
        this.logger.debug(`📨 Sending voice message to chat: "${event.text}"`);
        this.managers.chat.sendMessage(event.text, {
          source: 'voice',
          mode: event.mode,
          conversationMode: event.conversationMode
        });
      }
    });

    // 2. Підключення до запису голосу (Quick-send)
    eventManager.on('CONVERSATION_MODE_QUICK_SEND_START', () => {
      this.logger.info('🎤 Quick-send mode - starting recording');
      eventManager.emit('START_RECORDING', {
        mode: 'quick-send',
        maxDuration: 30000
      });
    });

    eventManager.on('CONVERSATION_MODE_QUICK_SEND_END', () => {
      this.logger.info('🛑 Quick-send mode - stopping recording');
      eventManager.emit('STOP_RECORDING', {
        reason: 'quick-send-complete'
      });
    });

    // 3. Підключення до conversation режиму
    eventManager.on('CONVERSATION_MODE_ACTIVATED', () => {
      this.logger.info('💬 Conversation mode activated');

      if (this.managers.glbLivingSystem) {
        this.managers.glbLivingSystem.setEmotion('welcoming', 0.9, 2000);
      }

      eventManager.emit('START_KEYWORD_DETECTION', {
        keywords: ['атлас'],
        mode: 'conversation'
      });
    });

    eventManager.on('CONVERSATION_MODE_DEACTIVATED', () => {
      this.logger.info('💬 Conversation mode deactivated');

      if (this.managers.glbLivingSystem) {
        this.managers.glbLivingSystem.setEmotion('neutral', 0.5, 1000);
      }
    });

    // 4. Підключення до запису в conversation режимі
    eventManager.on('CONVERSATION_RECORDING_START', () => {
      this.logger.info('🎤 Conversation recording started');
      eventManager.emit('START_RECORDING', {
        mode: 'conversation',
        maxDuration: 60000
      });

      if (this.managers.glbLivingSystem) {
        this.managers.glbLivingSystem.setEmotion('listening', 0.9, 99999);
      }
    });

    // 5. Інтеграція з TTS для циклу розмови
    if (this.managers.chat) {
      this.managers.chat.on('tts-start', (data) => {
        eventManager.emit('TTS_STARTED', {
          agent: data.agent || 'atlas',
          text: data.text
        });
      });

      this.managers.chat.on('tts-stop', () => {
        eventManager.emit('TTS_COMPLETED', {
          timestamp: Date.now()
        });
      });
    }

    // 6. Обробка keyword activation в conversation mode
    eventManager.on('CONVERSATION_KEYWORD_ACTIVATE', async (event) => {
      this.logger.info(`🎯 Keyword activation in conversation: ${event.keyword}`);

      try {
        const response = await orchestratorClient.sendMessage(event.keyword, {
          stage: 0,
          mode: 'conversation',
          source: 'voice-keyword'
        });

        this.logger.debug('Stage 0 response:', response);
      } catch (error) {
        this.logger.error('Failed to send to stage 0:', error);
      }
    });

    this.logger.info('✅ Conversation Mode integration complete');
  }

  integrateAdvancedUI() {
    if (!this.managers.advancedUI) return;

    // Підключаємо події до UI системи
    ['chat', 'voiceControl', 'loggingSystem', 'model3D', 'ttsVisualization'].forEach(managerName => {
      const manager = this.managers[managerName];
      if (manager && manager.on && typeof manager.emit === 'function' && !manager.emit.__atlasWrapped) {
        // Передаємо всі події до UI для централізованої обробки
        const originalEmit = manager.emit.bind(manager);

        const wrappedEmit = function(event, ...args) {
          // Викликаємо оригінальний emit з коректним контекстом
          originalEmit(event, ...args);

          // Передаємо до UI системи, якщо вона доступна
          if (this.managers?.advancedUI?.handleComponentEvent) {
            this.managers.advancedUI.handleComponentEvent(managerName, event, ...args);
          }
        }.bind(this);

        wrappedEmit.__atlasWrapped = true;
        manager.emit = wrappedEmit;
      }
    });
  }
}
