/**
 * ATLAS App Manager - v4.0
 * Відповідає за ініціалізацію та координацію основних менеджерів системи
 */

import { logger } from '../core/logger.js';
import { orchestratorClient } from '../core/api-client.js';
import atlasWebSocket from '../core/websocket-client.js';
import { ChatManager } from '../modules/chat-manager.js';
import { initializeAtlasVoice } from '../voice-control/atlas-voice-integration.js';
import { ConversationModeManager } from '../voice-control/conversation-mode-manager.js';
import { AtlasAdvancedUI } from '../components/ui/atlas-advanced-ui.js';
import { AnimatedLoggingSystem } from '../components/logging/animated-logging.js';
import { AtlasTTSVisualization } from '../components/tts/atlas-tts-visualization.js';
import { AtlasGLBLivingSystem } from '../components/model3d/atlas-glb-living-system.js';

export class AppManager {
  constructor() {
    this.logger = new logger.constructor('APP-MANAGER');
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
  }

  async initializeManagers() {
    this.logger.info('🚀 Starting manager initialization...');

    // 1. Ініціалізуємо WebSocket підключення
    this.logger.info('🔌 Initializing WebSocket Connection...');
    this.initializeWebSocket();

    // 2. Ініціалізуємо систему логування
    await this.initializeLoggingSystem();

    // 3. Ініціалізуємо 3D модель системи
    await this.initialize3DSystem();

    // 4. Ініціалізуємо TTS візуалізацію
    await this.initializeTTSVisualization();

    // 5. Ініціалізуємо розширену UI систему
    await this.initializeAdvancedUI();

    // 6. Ініціалізуємо Chat Manager
    await this.initializeChatManager();

    // 7. Ініціалізуємо голосове управління
    await this.initializeVoiceControl();

    // 8. Ініціалізуємо Status Manager
    this.initializeStatusManager();

    // 9. Роблемо менеджери доступними глобально
    this.exposeGlobalAPI();

    this.logger.info('✅ All managers initialized successfully');
  }

  async initializeLoggingSystem() {
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

      // Роблимо logger доступним глобально для інших модулів
      window.atlasLogger = this.managers.loggingSystem;

      this.logger.info('✅ Animated Logging System initialized');
      this.managers.loggingSystem.success('✅ Animated Logging System v4.0 готовий', 'LoggingSystem');
    } else {
      this.logger.warn('Logging container not found, animated logs disabled');
    }
  }

  async initialize3DSystem() {
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
      this.logger.info('✨ Atlas GLB Living System v4.0 initialized successfully');
    } else {
      this.logger.warn('Model viewer not found, GLB Living System disabled');
    }
  }

  async initializeTTSVisualization() {
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
  }

  async initializeAdvancedUI() {
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
  }

  async initializeChatManager() {
    this.logger.info('💬 Initializing Chat Manager...');
    this.managers.chat = new ChatManager();
    await this.managers.chat.init();
  }

  async initializeVoiceControl() {
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

      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.success('✅ Голосове управління готове', 'Voice-System');
      }

      // Ініціалізуємо Conversation Mode Manager
      this.logger.info('💬 Initializing Conversation Mode Manager...');
      this.managers.conversationMode = new ConversationModeManager({
        longPressDuration: 2000,
        quickSendMaxDuration: 30000,
        conversationTimeout: 120000,
        keywordForActivation: 'атлас'
      });

      await this.managers.conversationMode.initialize();

      this.logger.info('✅ Conversation Mode Manager initialized');
      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.success('✅ Режими спілкування готові', 'Voice-System');
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize Voice Control System', error.message);
      this.managers.voiceControl = null;

      if (this.managers.loggingSystem) {
        this.managers.loggingSystem.error(`❌ Голосове управління: ${error.message}`, 'Voice-System');
      }
    }
  }

  initializeStatusManager() {
    if (document.getElementById('status-container')) {
      this.logger.info('Status container found - initializing basic status display');
      this.managers.status = { initialized: true };
    }
  }

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
      if (this.managers.livingBehavior) {
        this.managers.livingBehavior.onTTSStart(data.text || '', null);
      }
    });

    this.managers.webSocket.on('tts-stop', (data) => {
      if (this.managers.ttsVisualization) {
        this.managers.ttsVisualization.stopTTS();
      }
      if (this.managers.livingBehavior) {
        this.managers.livingBehavior.onTTSEnd();
      }
    });

    // Підключаємось
    this.managers.webSocket.connect();
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

  exposeGlobalAPI() {
    // Робимо менеджери доступними глобально для зворотної сумісності
    window.atlasChat = this.managers.chat;
    window.atlasStatus = this.managers.status;
    window.atlasLogger = this.managers.loggingSystem;
    window.atlasUI = this.managers.advancedUI;

    // Додаткова сумісність для старого коду
    if (window.atlasChat && !window.atlasChat.addUserMessage) {
      window.atlasChat.addUserMessage = (message) => {
        return this.managers.chat.addUserMessage(message);
      };
    }
  }

  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}
