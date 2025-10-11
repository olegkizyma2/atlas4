/**
 * App Initializer
 *
 * Централізована ініціалізація всіх компонентів ATLAS v4.0
 * Використовує DI Container, State Store та Event Bus
 */

import { registerAllServices, initializeSingletons } from './service-providers.js';
import { registerAllReducers } from './reducers/index.js';
import { eventBus, EventNames } from './event-bus.js';

export class AppInitializer {
  constructor(container, store, eventBus) {
    this.container = container;
    this.store = store;
    this.eventBus = eventBus;
    this.initSteps = [];
    this.currentStep = 0;
  }

  /**
     * Головна функція ініціалізації
     */
  async initialize() {
    const startTime = Date.now();

    try {
      // Dispatch init start
      this.store.dispatch({ type: 'SYSTEM_INIT_START' });
      this.eventBus.emit(EventNames.SYSTEM.INIT_START);

      // Register services
      await this.registerServices();

      // Register reducers
      await this.registerReducers();

      // Initialize core systems
      await this.initializeCoreSystems();

      // Initialize UI components
      await this.initializeUIComponents();

      // Initialize 3D system
      await this.initialize3DSystem();

      // Initialize Chat system
      await this.initializeChatSystem();

      // Initialize Voice Control
      await this.initializeVoiceControl();

      // Setup integrations
      await this.setupIntegrations();

      // Initialize WebSocket
      await this.initializeWebSocket();

      const loadTime = Date.now() - startTime;

      // Dispatch init complete
      this.store.dispatch({
        type: 'SYSTEM_INIT_COMPLETE',
        payload: { loadTime }
      });
      this.eventBus.emit(EventNames.SYSTEM.INIT_COMPLETE, { loadTime });

      console.log(`✅ ATLAS initialized in ${loadTime}ms`);
      return true;

    } catch (error) {
      console.error('❌ Initialization failed:', error);

      this.store.dispatch({
        type: 'SYSTEM_INIT_ERROR',
        payload: { error: error.message }
      });
      this.eventBus.emit(EventNames.SYSTEM.ERROR, { error });

      throw error;
    }
  }

  /**
     * Реєструє всі сервіси в DI Container
     */
  async registerServices() {
    console.log('📦 Registering services...');
    await registerAllServices(this.container);
  }

  /**
     * Реєструє всі reducers в State Store
     */
  async registerReducers() {
    console.log('🔄 Registering reducers...');

    const { conversationReducer } = await import('./reducers/conversation.reducer.js');
    const { model3dReducer } = await import('./reducers/model3d.reducer.js');
    const { voiceReducer } = await import('./reducers/voice.reducer.js');
    const { chatReducer } = await import('./reducers/chat.reducer.js');
    const { systemReducer } = await import('./reducers/system.reducer.js');

    this.store.registerReducer('conversation', conversationReducer);
    this.store.registerReducer('model3d', model3dReducer);
    this.store.registerReducer('voice', voiceReducer);
    this.store.registerReducer('chat', chatReducer);
    this.store.registerReducer('system', systemReducer);
  }

  /**
     * Ініціалізує core системи
     */
  async initializeCoreSystems() {
    console.log('⚙️ Initializing core systems...');

    // Logger
    const logger = this.container.resolve('logger');
    logger.info('Core systems initializing...');

    // Orchestrator Client
    const orchestratorClient = this.container.resolve('orchestratorClient');

    // Setup health check
    this.setupHealthCheck();
  }

  /**
     * Ініціалізує UI компоненти
     */
  async initializeUIComponents() {
    console.log('🎨 Initializing UI components...');

    // Logging System
    const loggingSystem = this.container.resolve('loggingSystem');
    if (loggingSystem.init) {
      await loggingSystem.init();
    }
    loggingSystem.success('✅ Logging System готова', 'UI');

    // Advanced UI
    const advancedUI = this.container.resolve('advancedUI');

    // Wait for UI initialization
    await this.waitForUIInitialization();

    loggingSystem.success('✅ Advanced UI ініціалізовано', 'UI');
  }

  /**
     * Ініціалізує 3D систему
     */
  async initialize3DSystem() {
    console.log('🧬 Initializing 3D system...');

    try {
      const glbSystem = this.container.resolve('glbLivingSystem');
      const loggingSystem = this.container.resolve('loggingSystem');

      // Initialize
      if (glbSystem.init) {
        await glbSystem.init();
      }

      // Connect to state
      this.store.subscribe((state, prevState) => {
        const model3dState = state.model3d;
        const prevModel3dState = prevState.model3d;

        // Update emotion
        if (model3dState.emotion !== prevModel3dState.emotion) {
          glbSystem.setEmotion(
            model3dState.emotion,
            model3dState.intensity,
            model3dState.duration
          );
        }

        // Update speaking state
        if (model3dState.speaking !== prevModel3dState.speaking) {
          if (model3dState.speaking) {
            glbSystem.startSpeaking(model3dState.agent);
          } else {
            glbSystem.stopSpeaking();
          }
        }
      });

      loggingSystem.success('✅ GLB Living System готова', '3D');

    } catch (error) {
      console.warn('3D system initialization failed:', error);
    }
  }

  /**
     * Ініціалізує Chat систему
     */
  async initializeChatSystem() {
    console.log('💬 Initializing chat system...');

    const chatManager = this.container.resolve('chatManager');
    const loggingSystem = this.container.resolve('loggingSystem');

    if (chatManager.init) {
      await chatManager.init();
    }

    // Connect chat to state
    this.setupChatStateSync(chatManager);

    loggingSystem.success('✅ Chat Manager готовий', 'CHAT');
  }

  /**
     * Ініціалізує Voice Control
     */
  async initializeVoiceControl() {
    console.log('🎙️ Initializing voice control...');

    try {
      const loggingSystem = this.container.resolve('loggingSystem');
      loggingSystem.info('🎤 Запуск голосового управління...', 'VOICE');

      const voiceControl = await this.container.resolve('voiceControl');
      const conversationMode = this.container.resolve('conversationMode');

      // Initialize conversation mode
      if (conversationMode.initialize) {
        await conversationMode.initialize();
      }

      // Setup conversation mode integration
      this.setupConversationModeIntegration(conversationMode);

      loggingSystem.success('✅ Голосове управління готове', 'VOICE');

    } catch (error) {
      console.error('Voice control initialization failed:', error);
      const loggingSystem = this.container.resolve('loggingSystem');
      loggingSystem.error(`❌ Голосове управління: ${error.message}`, 'VOICE');
    }
  }

  /**
     * Налаштовує інтеграції між компонентами
     */
  async setupIntegrations() {
    console.log('🔗 Setting up integrations...');

    // TTS Integration
    this.setupTTSIntegration();

    // Event Bus to State Store bridge
    this.setupEventStateSync();
  }

  /**
     * Ініціалізує WebSocket
     */
  async initializeWebSocket() {
    console.log('🌐 Initializing WebSocket...');

    const webSocket = this.container.resolve('webSocket');
    const loggingSystem = this.container.resolve('loggingSystem');

    // Setup WebSocket events
    webSocket.on('connected', () => {
      this.store.dispatch({ type: 'SYSTEM_WEBSOCKET_CONNECTED' });
      this.eventBus.emit(EventNames.WS.CONNECTED);
      loggingSystem.info('🔗 WebSocket підключено', 'WS');
    });

    webSocket.on('disconnected', (data) => {
      this.store.dispatch({ type: 'SYSTEM_WEBSOCKET_DISCONNECTED' });
      this.eventBus.emit(EventNames.WS.DISCONNECTED, data);
      loggingSystem.warn(`🔌 WebSocket відключено: ${data.reason}`, 'WS');
    });

    // Connect
    webSocket.connect();
  }

  /**
     * Налаштовує синхронізацію Chat з State
     */
  setupChatStateSync(chatManager) {
    // Chat events → State
    chatManager.on('message-sent', (data) => {
      this.store.dispatch({
        type: 'CHAT_ADD_MESSAGE',
        payload: {
          role: 'user',
          content: data.message,
          timestamp: Date.now()
        }
      });
    });

    chatManager.on('message-received', (data) => {
      this.store.dispatch({
        type: 'CHAT_ADD_MESSAGE',
        payload: {
          role: 'assistant',
          content: data.message,
          agent: data.agent,
          timestamp: Date.now()
        }
      });
    });

    chatManager.on('agent-typing-start', (data) => {
      this.store.dispatch({
        type: 'CHAT_START_TYPING',
        payload: { agent: data.agent }
      });
    });

    chatManager.on('agent-typing-end', () => {
      this.store.dispatch({ type: 'CHAT_STOP_TYPING' });
    });
  }

  /**
     * Налаштовує Conversation Mode інтеграцію
     */
  setupConversationModeIntegration(conversationMode) {
    // Conversation Mode events → State
    this.eventBus.on('conversation:*', (payload, event) => {
      const actionType = event.toUpperCase().replace(/:/g, '_');
      this.store.dispatch({
        type: actionType,
        payload
      });
    });

    // Conversation Mode → Event Bus
    // (Already handled in ConversationModeManager)
  }

  /**
     * Налаштовує TTS інтеграцію
     */
  setupTTSIntegration() {
    const chatManager = this.container.resolve('chatManager');

    chatManager.on('tts-start', (data) => {
      // Update state
      this.store.dispatch({
        type: 'VOICE_TTS_START',
        payload: {
          agent: data.agent,
          text: data.text
        }
      });

      this.store.dispatch({
        type: 'MODEL3D_START_SPEAKING',
        payload: { agent: data.agent }
      });

      // Emit events
      this.eventBus.emit(EventNames.VOICE.TTS_START, data);
      this.eventBus.emit('conversation:tts-started', data);
    });

    chatManager.on('tts-stop', () => {
      // Update state
      this.store.dispatch({ type: 'VOICE_TTS_COMPLETE' });
      this.store.dispatch({ type: 'MODEL3D_STOP_SPEAKING' });

      // Emit events
      this.eventBus.emit(EventNames.VOICE.TTS_COMPLETE);
      this.eventBus.emit('conversation:tts-completed');
    });
  }

  /**
     * Синхронізує Event Bus з State Store
     */
  setupEventStateSync() {
    // Voice events → State
    this.eventBus.on('voice:recording-start', (payload) => {
      this.store.dispatch({
        type: 'VOICE_START_RECORDING',
        payload
      });
    });

    this.eventBus.on('voice:recording-stop', (payload) => {
      this.store.dispatch({
        type: 'VOICE_STOP_RECORDING',
        payload
      });
    });

    this.eventBus.on('voice:keyword-detected', (payload) => {
      this.store.dispatch({
        type: 'VOICE_KEYWORD_DETECTED',
        payload
      });
    });

    // Model3D events → State
    this.eventBus.on('model3d:emotion-changed', (payload) => {
      this.store.dispatch({
        type: 'MODEL3D_SET_EMOTION',
        payload
      });
    });
  }

  /**
     * Health check для сервісів
     */
  setupHealthCheck() {
    // Check services every 30 seconds
    setInterval(() => {
      this.checkServicesHealth();
    }, 30000);

    // Initial check
    setTimeout(() => this.checkServicesHealth(), 5000);
  }

  /**
     * Перевіряє здоров'я сервісів
     */
  async checkServicesHealth() {
    // This will be implemented with actual health checks
    // For now, just a placeholder
  }

  /**
     * Чекає на ініціалізацію UI
     */
  waitForUIInitialization() {
    return new Promise((resolve) => {
      const advancedUI = this.container.resolve('advancedUI');

      if (advancedUI.initialized) {
        resolve();
      } else {
        advancedUI.on('ui-initialized', () => {
          resolve();
        });

        // Timeout fallback
        setTimeout(resolve, 2000);
      }
    });
  }
}

export default AppInitializer;
