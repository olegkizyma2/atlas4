/**
 * Service Providers для ATLAS v4.0
 *
 * Централізована реєстрація всіх сервісів в DI Container
 * Визначає залежності та lifecycle кожного сервісу
 */

import { createLogger } from './logger.js';
import { AGENTS } from './config.js';
import { orchestratorClient } from './api-client.js';
import atlasWebSocket from './websocket-client.js';

/**
 * Реєструє core сервіси
 *
 * @param {DIContainer} container
 */
export function registerCoreServices(container) {
  // Logger - singleton
  container.singleton('logger', () => createLogger('ATLAS'));

  // Config - constant value
  container.value('agents', AGENTS);

  // Orchestrator Client - singleton
  container.singleton('orchestratorClient', () => orchestratorClient);

  // WebSocket - singleton
  container.singleton('webSocket', () => atlasWebSocket);
}

/**
 * Реєструє UI компоненти
 *
 * @param {DIContainer} container
 */
export async function registerUIComponents(container) {
  const { AnimatedLoggingSystem } = await import('../components/logging/animated-logging.js');
  const { AtlasAdvancedUI } = await import('../components/ui/atlas-advanced-ui.js');

  // Logging System - singleton
  container.singleton('loggingSystem', (c) => {
    return new AnimatedLoggingSystem({
      container: document.getElementById('logs-container'),
      maxLogs: 100,
      enableAnimations: true
    });
  });

  // Advanced UI - singleton
  container.singleton('advancedUI', (c) => {
    return new AtlasAdvancedUI({
      theme: 'dark-cyber',
      enableAnimations: true,
      enableKeyboardShortcuts: true,
      loggingSystem: c.resolve('loggingSystem')
    });
  });
}

/**
 * Реєструє 3D систему
 *
 * @param {DIContainer} container
 */
export async function register3DSystem(container) {
  const { AtlasGLBLivingSystem } = await import('../components/model3d/atlas-glb-living-system.js');
  const { AtlasTTSVisualization } = await import('../components/tts/atlas-tts-visualization.js');

  // GLB Living System - singleton
  container.singleton('glbLivingSystem', (c) => {
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) {
      throw new Error('Model viewer element not found');
    }

    return new AtlasGLBLivingSystem('#model-viewer', {
      enableBreathing: true,
      enableEyeTracking: true,
      enableEmotions: true,
      enableTTSSync: true,
      enableIntelligence: true,
      personality: {
        curiosity: 0.9,
        friendliness: 0.95,
        playfulness: 0.7,
        focus: 0.85
      }
    });
  });

  // Alias для backwards compatibility
  container.singleton('livingBehavior', (c) => c.resolve('glbLivingSystem'));

  // TTS Visualization - singleton
  container.singleton('ttsVisualization', (c) => {
    const model3d = c.resolve('glbLivingSystem');
    return new AtlasTTSVisualization(model3d, {
      enableRealTimeAnalysis: true,
      enablePhonemeMapping: true,
      enableFacialAnimation: true,
      visualEffects: ['glow', 'mouth', 'wave']
    });
  });
}

/**
 * Реєструє Chat систему
 *
 * @param {DIContainer} container
 */
export async function registerChatSystem(container) {
  const { ChatManager } = await import('../modules/chat-manager.js');

  // Chat Manager - singleton
  container.singleton('chatManager', (c) => {
    const logger = c.resolve('logger');
    const chatManager = new ChatManager();

    // Set logger
    if (chatManager.setLogger) {
      chatManager.setLogger(logger.category('CHAT'));
    }

    return chatManager;
  });
}

/**
 * Реєструє Voice Control систему
 *
 * @param {DIContainer} container
 */
export async function registerVoiceControl(container) {
  const { initializeAtlasVoice } = await import('../voice-control/atlas-voice-integration.js');
  const { ConversationModeManager } = await import('../voice-control/conversation-mode-manager.js');

  // Voice Control - singleton
  container.singleton('voiceControl', async (c) => {
    const logger = c.resolve('logger');

    const voiceControl = await initializeAtlasVoice({
      enableKeywordDetection: true,
      enablePostChatAnalysis: true,
      autoStart: true,
      logLevel: 'info'
    });

    // Integrate with chat
    const chatManager = c.resolve('chatManager');
    if (voiceControl?.integrateChatSystem) {
      voiceControl.integrateChatSystem(chatManager);
    }

    return voiceControl;
  });

  // Conversation Mode Manager - singleton
  container.singleton('conversationMode', (c) => {
    return new ConversationModeManager({
      longPressDuration: 2000,
      quickSendMaxDuration: 30000,
      conversationTimeout: 120000,
      keywordForActivation: 'атлас'
    });
  });
}

/**
 * Головна функція реєстрації всіх сервісів
 *
 * @param {DIContainer} container
 */
export async function registerAllServices(container) {
  // Core services (synchronous)
  registerCoreServices(container);

  // UI Components
  await registerUIComponents(container);

  // 3D System
  await register3DSystem(container);

  // Chat System
  await registerChatSystem(container);

  // Voice Control
  await registerVoiceControl(container);

  return container;
}

/**
 * Helper для ініціалізації всіх singleton сервісів
 *
 * @param {DIContainer} container
 */
export async function initializeSingletons(container) {
  const singletons = [
    'logger',
    'loggingSystem',
    'glbLivingSystem',
    'ttsVisualization',
    'advancedUI',
    'chatManager',
    'webSocket'
  ];

  for (const name of singletons) {
    if (container.has(name)) {
      try {
        const instance = container.resolve(name);

        // Викликаємо init якщо існує
        if (instance && typeof instance.init === 'function') {
          await instance.init();
        }
      } catch (error) {
        console.error(`Failed to initialize ${name}:`, error);
      }
    }
  }
}

export default {
  registerCoreServices,
  registerUIComponents,
  register3DSystem,
  registerChatSystem,
  registerVoiceControl,
  registerAllServices,
  initializeSingletons
};
