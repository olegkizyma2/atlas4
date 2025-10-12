/**
 * ATLAS APPLICATION - REFACTORED v4.0
 * Повністю модернізована архітектура з новими компонентами:
 * - Анімована система логування
 * - 3D модел        // 4. Ініціалізуємо розширену UI систему
        this.logger.info('🎨 Initializing Advanced UI System...');
        this.managers.advancedUI = new AtlasAdvancedUI({
            theme: 'dark-cyber',
            enableAnimations: true,
            enableKeyboardShortcuts: true,
            enableTooltips: true,
            // Передаємо уже ініціалізовані компоненти
            loggingSystem: this.managers.loggingSystem,
            model3DController: this.managers.livingBehavior || this.managers.model3D,
            ttsVisualization: this.managers.ttsVisualization
        });

        // Додаємо лог у веб-інтерфейс
        if (this.managers.loggingSystem) {
            this.managers.loggingSystem.success('✅ Advanced UI System ініціалізовано', 'UI-Controller');
        }

        // Чекаємо на ініціалізацію UI
        await this.waitForUIInitialization();цією
 * - Розширений UI контролер
 * - Збереження оригінального дизайну
 */

import { logger } from './core/logger.js';
import { AGENTS } from './core/config.js';
import { orchestratorClient } from './core/api-client.js';
import atlasWebSocket from './core/websocket-client.js';
import { ChatManager } from './modules/chat-manager.js';
import { initializeAtlasVoice } from './voice-control/atlas-voice-integration.js';
import { ConversationModeManager } from './voice-control/conversation-mode-manager.js';
import { eventManager, Events as VoiceEvents } from './voice-control/events/event-manager.js';
import { AtlasAdvancedUI } from './components/ui/atlas-advanced-ui.js';
import { AnimatedLoggingSystem } from './components/logging/animated-logging.js';
import { AtlasTTSVisualization } from './components/tts/atlas-tts-visualization.js';
import { AtlasGLBLivingSystem } from './components/model3d/atlas-glb-living-system.js';
import { AtlasLivingBehaviorEnhanced } from './components/model3d/atlas-living-behavior-enhanced.js';

// ✅ КРИТИЧНО: Експортуємо eventManager в window для доступу з TTS та інших модулів
// Це потрібно зробити ОДРАЗУ після імпорту, до будь-якої ініціалізації
if (typeof window !== 'undefined') {
  window.eventManager = eventManager;
}

class AtlasApp {
  constructor() {
    this.logger = new logger.constructor('APP');
    this.isInitialized = false;
    this.pageLoadId = `load_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    this.managers = {
      chat: null,
      status: null,
      logger: null,
      voiceControl: null,
      conversationMode: null,
      advancedUI: null,
      loggingSystem: null,
      model3D: null,
      livingBehavior: null,
      glbLivingSystem: null,
      ttsVisualization: null,
      webSocket: atlasWebSocket
    };

    this.voiceControlSubscriptions = [];
  }

  async init() {
    if (this.isInitialized) return;

    this.logger.info(`🚀 ATLAS APP INIT: ${this.pageLoadId}`);

    try {
      // Ініціалізуємо менеджери в правильному порядку
      await this.initializeManagers();

      // Налаштовуємо UI
      this.setupUI();

      // Налаштовуємо глобальні обробники
      this.setupGlobalHandlers();

      this.isInitialized = true;
      this.logger.info('✅ Atlas Application initialized successfully');

    } catch (error) {
      this.logger.error('❌ Failed to initialize Atlas Application', error.message);
      this.showErrorMessage('Помилка ініціалізації додатку');
    }
  }

  async initializeManagers() {
    // 1. Ініціалізуємо WebSocket підключення
    this.logger.info('🔌 Initializing WebSocket Connection...');
    this.initializeWebSocket();

    // 2. Ініціалізуємо систему логування
    const loggingContainer = document.getElementById('logs-container-desktop') ||
      document.getElementById('logs-container');

    if (loggingContainer) {
      this.managers.loggingSystem = new AnimatedLoggingSystem(loggingContainer.id, {
        maxLogs: 1000,
        enableGlow: true,
        enableTypewriter: !this.isMobileDevice(),
        autoScroll: true,
        colors: {
          info: '#00ffff',
          success: '#00ff7f',
          error: '#ff4444',
          warn: '#ffaa00',
          debug: '#888888',
          system: '#00ff00'
        }
      });
      this.loggingSystem = this.managers.loggingSystem;

      // Робимо logger доступним глобально для інших модулів
      window.atlasLogger = this.managers.loggingSystem;

      this.logger.info('✅ Animated Logging System initialized');

      this.managers.loggingSystem.success('✅ Animated Logging System v4.0 готовий', 'LoggingSystem');
    } else {
      this.logger.warn('Logging container not found, animated logs disabled');
    }

    // 3. Ініціалізуємо НОВУ живу систему для GLB шолома (v4.0)
    this.logger.info('🧬 Initializing Atlas GLB Living System v4.0...');
    const modelViewer = document.getElementById('model-viewer');
    if (modelViewer) {
      this.managers.glbLivingSystem = new AtlasGLBLivingSystem('#model-viewer', {
        enableBreathing: true,
        enableEyeTracking: true,
        enableEmotions: true,
        enableTTSSync: true,
        enableIntelligence: true,
        breathingSpeed: 4000,
        eyeTrackingSpeed: 0.15,
        emotionIntensity: 1.0,
        ttsGlowIntensity: 1.5,
        personality: {
          curiosity: 0.9,
          friendliness: 0.95,
          playfulness: 0.7,
          focus: 0.85
        }
      });
      // Зберігаємо також під старим іменем для сумісності
      this.managers.livingBehavior = this.managers.glbLivingSystem;

      // 3.1. Додаємо покращену поведінку (v5.0)
      this.logger.info('🎭 Initializing Enhanced Living Behavior v5.0...');
      this.managers.enhancedBehavior = new AtlasLivingBehaviorEnhanced(this.managers.glbLivingSystem);
      this.logger.info('✨ Enhanced Living Behavior v5.0 активовано!');

      this.logger.info('✨ Atlas GLB Living System v4.0 initialized successfully');
    } else {
      this.logger.warn('Model viewer not found, GLB Living System disabled');
    }

    // 4. GLB Living System є єдиною системою 3D моделі (v4.0)
    // Legacy контролери видалені

    // 5. Ініціалізуємо TTS візуалізацію
    this.logger.info('🎵 Initializing TTS Visualization...');
    const activeModelController = this.managers.livingBehavior || this.managers.model3D;
    if (activeModelController) {
      this.managers.ttsVisualization = new AtlasTTSVisualization(activeModelController, {
        enableRealTimeAnalysis: true,
        enablePhonemeMapping: true,
        enableFacialAnimation: true,
        visualEffects: ['glow', 'mouth', 'wave']
      });
      this.logger.info('✅ TTS Visualization initialized');
    }

    // 6. Ініціалізуємо розширену UI систему
    this.logger.info('🎨 Initializing Advanced UI System...');
    this.managers.advancedUI = new AtlasAdvancedUI({
      theme: 'dark-cyber',
      enableAnimations: true,
      enableKeyboardShortcuts: true,
      enableTooltips: true,
      // Передаємо уже ініціалізовані компоненти
      loggingSystem: this.managers.loggingSystem,
      model3DController: this.managers.livingBehavior || this.managers.model3D,
      ttsVisualization: this.managers.ttsVisualization
    });

    // Чекаємо на ініціалізацію UI
    await this.waitForUIInitialization();

    // 7. Ініціалізуємо Chat Manager з інтеграцією
    this.logger.info('💬 Initializing Chat Manager...');
    this.managers.chat = new ChatManager();
    await this.managers.chat.init();

    // 8. Ініціалізуємо систему голосового управління
    this.logger.info('🎤 Initializing Voice Control System...');
    try {
      // Додаємо лог у веб-інтерфейс
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.info('🎤 Запуск голосового управління...', 'Voice-System');
      }

      this.managers.voiceControl = await initializeAtlasVoice({
        enableKeywordDetection: true,
        enablePostChatAnalysis: true,
        autoStart: true,
        logLevel: 'info'
      });

      if (this.managers.voiceControl?.integrateChatSystem) {
        this.managers.voiceControl.integrateChatSystem(this.managers.chat);
      }

      this.logger.info('✅ Voice Control System initialized');

      // Додаємо лог у веб-інтерфейс
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.success('✅ Голосове управління готове', 'Voice-System');
      }

      // 9. Ініціалізуємо Conversation Mode Manager (НОВИЙ)
      this.logger.info('💬 Initializing Conversation Mode Manager...');

      // Debug EventManager assignment
      const voiceControlEventManager = this.managers.voiceControl?.getEventManager?.();
      console.log('[APP] 🔍 Voice Control EventManager:', {
        hasVoiceControl: !!this.managers.voiceControl,
        hasGetEventManagerMethod: typeof this.managers.voiceControl?.getEventManager === 'function',
        eventManager: voiceControlEventManager,
        eventManagerEmit: typeof voiceControlEventManager?.emit,
        eventManagerOn: typeof voiceControlEventManager?.on
      });

      this.managers.conversationMode = new ConversationModeManager({
        eventManager: voiceControlEventManager || null,
        longPressDuration: 2000,
        quickSendMaxDuration: 30000,
        conversationTimeout: 120000,
        keywordForActivation: 'атлас'
      });

      await this.managers.conversationMode.initialize();

      // Інтеграція conversation mode з іншими системами
      this.integrateConversationMode();

      this.logger.info('✅ Conversation Mode Manager initialized');
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.success('✅ Режими спілкування готові', 'Voice-System');
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize Voice Control System', error.message);
      this.managers.voiceControl = null;

      // Додаємо лог у веб-інтерфейс
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.error(`❌ Голосове управління: ${error.message}`, 'Voice-System');
      }
    }

    // 10. Інтегруємо всі компоненти
    this.integrateComponents();

    // 9. Ініціалізуємо Status Manager (спрощено)
    if (document.getElementById('status-container')) {
      this.logger.info('Status container found - initializing basic status display');
      this.managers.status = { initialized: true };
    }

    this.logger.info('🎯 All managers initialized successfully');

    // Робимо менеджери доступними глобально для зворотної сумісності
    window.atlasChat = this.managers.chat;
    window.atlasStatus = this.managers.status;
    window.atlasLogger = this.loggingSystem;
    window.atlasUI = this.managers.advancedUI;

    // Додаткова сумісність для старого коду
    if (window.atlasChat && !window.atlasChat.addUserMessage) {
      window.atlasChat.addUserMessage = (message) => {
        return this.managers.chat.addUserMessage(message);
      };
    }

    this.logger.info('✅ All managers initialized successfully');
  }

  async waitForUIInitialization() {
    return new Promise((resolve) => {
      if (this.managers.advancedUI.state.isInitialized) {
        resolve();
      } else {
        this.managers.advancedUI.on('ui-initialized', () => {
          resolve();
        });
      }
    });
  }

  /**
     * Ініціалізація WebSocket підключення
     */
  initializeWebSocket() {
    // Налаштовуємо обробники подій WebSocket
    this.managers.webSocket.on('connected', () => {
      this.logger.success('🔗 WebSocket connected to orchestrator');
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.info('🔗 Реального часу зв\'язок встановлено', 'WebSocket');
      }
    });

    this.managers.webSocket.on('disconnected', (data) => {
      this.logger.warn('🔌 WebSocket disconnected', data);
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.warn(`🔌 Зв'язок перервано: ${data.reason}`, 'WebSocket');
      }
    });

    this.managers.webSocket.on('log', (logEntry) => {
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.addLog(logEntry);
      }
    });

    this.managers.webSocket.on('model3d-update', (data) => {
      if (this.managers.model3D) {
        this.managers.model3D.handleServerUpdate(data);
      }
    });

    this.managers.webSocket.on('tts-start', (data) => {
      // TTS Visualization не має handleServerTTSStart методу
      if (this.managers.livingBehavior) {
        this.managers.livingBehavior.onTTSStart(data.text || '', null);
      }
    });

    this.managers.webSocket.on('tts-stop', (data) => {
      if (this.managers.ttsVisualization) {
        // Використовуємо існуючий метод stopTTS замість неіснуючого handleServerTTSStop
        this.managers.ttsVisualization.stopTTS();
      }
      if (this.managers.livingBehavior) {
        this.managers.livingBehavior.onTTSEnd();
      }
    });        // Підключаємось
    this.managers.webSocket.connect();
  }

  /**
     * Інтеграція Conversation Mode з системою
     */
  integrateConversationMode() {
    if (!this.managers.conversationMode) return;

    this.logger.info('🔗 Integrating Conversation Mode with system...');

    // 1. Підключення до Chat Manager для відправки повідомлень
    eventManager.on('SEND_CHAT_MESSAGE', (event) => {
      this.logger.info(`📨 SEND_CHAT_MESSAGE event received:`, event);

      // EventManager передає {type, payload, timestamp, source}
      const text = event.payload?.text || event.text;

      if (this.managers.chat && text) {
        this.logger.debug(`📨 Sending voice message to chat: "${text}"`);
        this.managers.chat.sendMessage(text, {
          source: 'voice',
          mode: event.payload?.mode || event.mode,
          conversationMode: event.payload?.conversationMode || event.conversationMode
        });
      } else {
        this.logger.warn('❌ SEND_CHAT_MESSAGE event rejected:', {
          hasChatManager: !!this.managers.chat,
          hasText: !!text,
          text: text,
          eventKeys: event ? Object.keys(event) : [],
          payloadKeys: event.payload ? Object.keys(event.payload) : []
        });
      }
    });

    // 2. Підключення до запису голосу (Quick-send)
    eventManager.on('CONVERSATION_MODE_QUICK_SEND_START', () => {
      this.logger.info('🎤 Quick-send mode - starting recording');
      // Емісія події для microphone service
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

      // Повідомлення GLB Living System
      if (this.managers.glbLivingSystem) {
        this.managers.glbLivingSystem.setEmotion('welcoming', 0.9, 2000);
      }

      // Вмикаємо keyword detection
      eventManager.emit('START_KEYWORD_DETECTION', {
        keywords: ['атлас'],
        mode: 'conversation'
      });
    });

    eventManager.on('CONVERSATION_MODE_DEACTIVATED', () => {
      this.logger.info('💬 Conversation mode deactivated');

      // Повідомлення GLB Living System
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

      // Візуальний feedback
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

      this.managers.chat.on('tts-stop', (data) => {
        // CRITICAL: Передаємо mode, isInConversation та isActivationResponse для conversation loop
        // FIXED (11.10.2025 - 16:50): Правильний шлях до conversation manager
        const conversationManager = this.managers.conversationMode;
        const isInConversation = conversationManager?.isConversationActive?.() || false;
        const mode = data?.mode || 'chat';
        const isActivationResponse = data?.isActivationResponse || false;

        console.log('[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED):', {
          mode,
          isInConversation,
          isActivationResponse,
          agent: data?.agent || 'atlas',
          data,
          eventName: VoiceEvents.TTS_COMPLETED,
          conversationManager: !!conversationManager,
          conversationActive: conversationManager?.isConversationActive?.()
        });

        // CRITICAL: Використовуємо Events.TTS_COMPLETED ('tts.completed'), НЕ string literal 'TTS_COMPLETED'!
        eventManager.emit(VoiceEvents.TTS_COMPLETED, {
          timestamp: Date.now(),
          mode: mode,
          isInConversation: isInConversation,
          isActivationResponse: isActivationResponse,
          agent: data?.agent || 'atlas'
        });
      });
    }

    // 6. Обробка keyword activation в conversation mode
    eventManager.on('CONVERSATION_KEYWORD_ACTIVATE', async (event) => {
      this.logger.info(`🎯 Keyword activation in conversation: ${event.keyword}`);

      // Відправка в orchestrator stage 0
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

  /**
     * Інтеграція всіх компонентів між собою
     */
  integrateComponents() {
    // Інтеграція чату з TTS та живою системою
    if (this.managers.chat && this.managers.ttsVisualization) {
      // Коли починається TTS, показуємо візуалізацію
      this.managers.chat.on('tts-start', (data) => {
        this.managers.ttsVisualization.startTTS(data.text, data.audioElement || null);

        // Інтегруємо з живою системою Атласа
        if (this.managers.livingBehavior && typeof this.managers.livingBehavior.startSpeaking === 'function') {
          // FIXED: startSpeaking приймає (agent, intensity), НЕ (text, audioElement)
          const agent = data.agent || data.detail?.agent || 'atlas';
          this.managers.livingBehavior.startSpeaking(agent, 0.8);
        }

        // Відправляємо на сервер через WebSocket з правильним voice
        this.managers.webSocket.startTTSVisualization(data.text, {
          agent: data.agent || 'atlas',
          voice: data.voice || 'mykyta', // Додаємо voice
          emotion: data.emotion || 'neutral',
          speed: data.speed || 1.0
        });
      });

      this.managers.chat.on('tts-stop', () => {
        this.managers.ttsVisualization.stopTTS();

        // Зупиняємо TTS у живій системі
        if (this.managers.livingBehavior) {
          this.managers.livingBehavior.stopSpeaking();
        }

        this.managers.webSocket.stopTTSVisualization();
      });
    }

    // Інтеграція чату з НОВОЮ живою системою GLB
    const activeModelController = this.managers.glbLivingSystem || this.managers.livingBehavior || this.managers.model3D;
    if (this.managers.chat && activeModelController) {
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
          // Початок мовлення для агента
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

    // Інтеграція голосового управління з живою системою Атласа
    if (activeModelController) {
      // Очистка попередніх підписок (у разі повторної інтеграції)
      if (Array.isArray(this.voiceControlSubscriptions) && this.voiceControlSubscriptions.length) {
        this.voiceControlSubscriptions.forEach((subscriptionId) => {
          if (subscriptionId) {
            eventManager.off(subscriptionId);
          }
        });
        this.voiceControlSubscriptions = [];
      }

      const subscriptions = [];

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

    // Інтеграція розширеної UI системи
    if (this.managers.advancedUI) {
      // Підключаємо події до UI системи
      ['chat', 'voiceControl', 'loggingSystem', 'model3D', 'ttsVisualization'].forEach(managerName => {
        const manager = this.managers[managerName];
        if (manager && manager.on && typeof manager.emit === 'function' && !manager.emit.__atlasWrapped) {
          // Передаємо всі події до UI для централізованої обробки, зберігаючи контекст менеджера
          const atlasApp = this;
          const originalEmit = manager.emit.bind(manager);

          const wrappedEmit = function (event, ...args) {
            // Викликаємо оригінальний emit з коректним контекстом
            originalEmit(event, ...args);

            // Передаємо до UI системи, якщо вона доступна
            atlasApp.managers?.advancedUI?.handleComponentEvent?.(managerName, event, ...args);
          };

          wrappedEmit.__atlasWrapped = true;
          manager.emit = wrappedEmit;
        }
      });
    }

    this.logger.info('🔗 All components integrated successfully');
  }

  /**
     * Перевірка чи це мобільний пристрій
     */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setupUI() {
    // Налаштовуємо таби
    this.setupTabs();

    // Налаштовуємо контроли TTS
    this.setupTTSControls();

    // Налаштовуємо голосові контроли (перемикач BLUE режиму)
    this.setupVoiceControls();

    // Налаштовуємо клавіатурні скорочення
    this.setupKeyboardShortcuts();
  }

  setupTabs() {
    const tabChat = document.getElementById('tab-chat');
    const tabLogs = document.getElementById('tab-logs');
    const chatContent = document.getElementById('chat-content');
    const logsContent = document.getElementById('logs-content');

    if (tabChat && chatContent) {
      tabChat.addEventListener('click', () => {
        this.switchTab('chat');
      });
    }

    if (tabLogs && logsContent) {
      tabLogs.addEventListener('click', () => {
        this.switchTab('logs');
      });
    }

    // За замовчуванням показуємо чат
    this.switchTab('chat');
  }

  switchTab(tab) {
    const tabs = ['chat', 'logs'];

    tabs.forEach(t => {
      const tabElement = document.getElementById(`tab-${t}`);
      const contentElement = document.getElementById(`${t}-content`);

      if (tabElement && contentElement) {
        if (t === tab) {
          tabElement.classList.add('active');
          contentElement.style.display = 'block';
        } else {
          tabElement.classList.remove('active');
          contentElement.style.display = 'none';
        }
      }
    });

    this.logger.debug(`Switched to ${tab} tab`);
  }

  setupTTSControls() {
    // Кнопка увімкнення/вимкнення TTS (перероблена з колонки)
    const ttsToggle = document.getElementById('tts-toggle');
    if (ttsToggle && this.managers.chat) {
      const getCurrentTTSState = () => {
        const ttsManager = this.managers.chat?.ttsManager;

        if (!ttsManager) {
          return false;
        }

        try {
          if (typeof ttsManager.isEnabled === 'function') {
            return ttsManager.isEnabled();
          }

          return Boolean(ttsManager.isEnabled);
        } catch (error) {
          this.logger.debug('Unable to determine TTS state:', error?.message || error);
          return false;
        }
      };

      const updateIcon = () => {
        const isEnabled = getCurrentTTSState();
        const span = ttsToggle.querySelector('.btn-text') || ttsToggle;
        span.textContent = isEnabled ? '🔊' : '🔇';
        ttsToggle.title = isEnabled ? 'Натисніть щоб вимкнути озвучення TTS' : 'Натисніть щоб увімкнути озвучення TTS';
      };

      ttsToggle.addEventListener('click', () => {
        const isEnabled = getCurrentTTSState();
        if (isEnabled) {
          this.managers.chat.disableTTS();
        } else {
          this.managers.chat.enableTTS();
        }
        updateIcon();
      });

      // Встановлюємо початковий стан
      updateIcon();
    }

    // Перемикач режиму TTS
    const ttsModeToggle = document.getElementById('tts-mode-toggle');
    if (ttsModeToggle && this.managers.chat) {
      ttsModeToggle.addEventListener('click', () => {
        const currentMode = this.managers.chat.getTTSMode();
        const newMode = currentMode === 'quick' ? 'standard' : 'quick';
        this.managers.chat.setTTSMode(newMode);

        ttsModeToggle.textContent = newMode === 'quick' ?
          '⚡ Швидкий режим' : '🎵 Стандартний режим';

        this.logger.info(`TTS mode changed to: ${newMode}`);
      });

      // Встановлюємо початковий стан
      const currentMode = this.managers.chat.getTTSMode();
      ttsModeToggle.textContent = currentMode === 'quick' ?
        '⚡ Швидкий режим' : '🎵 Стандартний режим';
    }
  }

  setupVoiceControls() {
    // Голосовий перемикач видалено як дубль — залишаємо заглушку щоб уникнути помилок
    this.logger.debug('Voice controls disabled (replaced by TTS toggle)');
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter - відправити повідомлення
      if (e.ctrlKey && e.key === 'Enter') {
        if (this.managers.chat) {
          this.managers.chat.sendMessage();
        }
      }

      // Ctrl+L - очистити чат
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (this.managers.chat) {
          this.managers.chat.clearChat();
        }
      }

      // Ctrl+E - експорт історії
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (this.managers.chat) {
          this.managers.chat.exportChatHistory();
        }
      }

      // Ctrl+1/2 - перемикання табів
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        this.switchTab('chat');
      }
      if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        this.switchTab('logs');
      }
    });
  }

  setupGlobalHandlers() {
    // Захист від випадкових перезавантажень
    window.addEventListener('beforeunload', (e) => {
      const pageAge = Date.now() - performance.timing.navigationStart;
      const isStreaming = this.managers.chat && this.managers.chat.isStreaming;
      const isRecentLoad = pageAge < 10000;

      if (isStreaming || isRecentLoad) {
        this.logger.warn(`Preventing reload: streaming=${isStreaming}, recentLoad=${isRecentLoad}`);

        const message = isStreaming ?
          'Зачекайте завершення обробки повідомлення...' :
          'Зачекайте кілька секунд...';

        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    });

    // Глобальний обробник помилок
    window.addEventListener('error', (e) => {
      this.logger.error('Global error', e.error?.message || 'Unknown error');
      this.showErrorMessage(`Помилка: ${e.error?.message || 'Невідома помилка'}`);
    });

    window.addEventListener('unhandledrejection', (e) => {
      // Ігноруємо AbortError як некритичні помилки
      if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('aborted')) {
        this.logger.debug('Ignoring AbortError from timeout/user action');
        e.preventDefault(); // Prevent console error
        return;
      }

      this.logger.error('Unhandled promise rejection', e.reason?.message || 'Unknown reason');
      this.showErrorMessage(`Promise помилка: ${e.reason?.message || 'Невідома причина'}`);
    });

    // Обробка втрати з'єднання
    window.addEventListener('online', () => {
      this.logger.info('Connection restored');
      this.showSuccessMessage('З\'єднання відновлено');
    });

    window.addEventListener('offline', () => {
      this.logger.warn('Connection lost');
      this.showErrorMessage('З\'єднання втрачено');
    });
  }

  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Створюємо простий toast notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            background-color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

    document.body.appendChild(notification);

    // Анімація появи
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Автоматичне приховування
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);

    // Клік для закриття
    notification.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }

  // Методи для зовнішнього API
  sendMessage(message) {
    if (this.managers.chat) {
      return this.managers.chat.sendMessage(message);
    }
  }

  clearChat() {
    if (this.managers.chat) {
      this.managers.chat.clearChat();
    }
  }

  // Методи для управління живою системою Атласа (з підтримкою нової GLB системи)
  setAtlasEmotion(emotion, intensity = 0.7, duration = 1000) {
    if (this.managers.glbLivingSystem) {
      this.managers.glbLivingSystem.setEmotion(emotion, intensity, duration);
    } else if (this.managers.livingBehavior) {
      this.managers.livingBehavior.setEmotion(emotion, intensity, duration);
    } else if (this.managers.model3D) {
      this.managers.model3D.triggerEmotion(emotion, { intensity, duration });
    }
  }

  // Реакція шолома на події
  atlasReactToEvent(eventType, data = {}) {
    if (this.managers.glbLivingSystem) {
      this.managers.glbLivingSystem.reactToEvent(eventType, data);
    }
  }

  // Початок/кінець мовлення для агентів
  atlasStartSpeaking(agent = 'atlas', intensity = 0.8) {
    if (this.managers.glbLivingSystem) {
      this.managers.glbLivingSystem.startSpeaking(agent, intensity);
    }
  }

  atlasStopSpeaking() {
    if (this.managers.glbLivingSystem) {
      this.managers.glbLivingSystem.stopSpeaking();
    }
  }

  getAtlasState() {
    if (this.managers.livingBehavior) {
      return this.managers.livingBehavior.getState();
    }
    return null;
  }

  adjustAtlasPersonality(traits) {
    if (this.managers.livingBehavior) {
      this.managers.livingBehavior.adjustPersonality(traits);
    }
  }

  startAtlasTTS(text, audioElement = null) {
    if (this.managers.livingBehavior) {
      this.managers.livingBehavior.onTTSStart(text, audioElement);
    }
  }

  stopAtlasTTS() {
    if (this.managers.livingBehavior) {
      this.managers.livingBehavior.onTTSEnd();
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      pageLoadId: this.pageLoadId,
      managers: Object.keys(this.managers).reduce((acc, key) => {
        acc[key] = !!this.managers[key];
        return acc;
      }, {}),
      streaming: this.managers.chat?.isStreaming || false,
      atlasLiving: this.managers.livingBehavior ? this.getAtlasState() : null
    };
  }
}

// Ініціалізація додатку
const atlasApp = new AtlasApp();

// Запуск після завантаження DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => atlasApp.init());
} else {
  atlasApp.init();
}

// Глобальний доступ для зворотної сумісності
window.atlasApp = atlasApp;

export default atlasApp;
