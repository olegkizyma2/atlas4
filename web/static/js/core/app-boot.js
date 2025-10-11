/**
 * App Boot - Bootstrap код для ATLAS v4.0
 *
 * Створює та налаштовує DI Container, State Store, Event Bus
 * Запускає ініціалізацію додатку
 */

import { DIContainer } from './di-container.js';
import { StateStore } from './state-store.js';
import { EventBus } from './event-bus.js';
import { AppInitializer } from './app-initializer.js';

/**
 * Bootstrap функція
 * Створює всю інфраструктуру та запускає додаток
 */
export async function bootstrap() {
  console.log('🚀 ATLAS v4.0 - Bootstrapping...');

  // 1. Create DI Container
  const container = new DIContainer();
  console.log('📦 DI Container created');

  // 2. Create State Store
  const store = new StateStore({
    conversation: {},
    model3d: {},
    voice: {},
    chat: {},
    system: {}
  });
  console.log('🏪 State Store created');

  // 3. Create Event Bus
  const eventBus = new EventBus({
    enableLogging: false,
    maxHistorySize: 100
  });
  console.log('📡 Event Bus created');

  // 4. Register core services in container
  container.singleton('store', () => store);
  container.singleton('eventBus', () => eventBus);
  container.singleton('appInitializer', (c) =>
    new AppInitializer(c, store, eventBus)
  );

  // 5. Make globally accessible (for debugging)
  if (typeof window !== 'undefined') {
    window.__ATLAS__ = {
      container,
      store,
      eventBus,
      version: '4.0.0'
    };

    // Dev tools
    window.__ATLAS_DEBUG__ = {
      debugContainer: () => container.debug(),
      debugStore: () => store.debug(),
      debugEventBus: () => eventBus.debug(),
      getState: () => store.getState(),
      getServices: () => container.getServices(),
      getEvents: () => eventBus.getEvents()
    };
  }

  console.log('✅ Bootstrap complete');

  return { container, store, eventBus };
}

/**
 * Запускає додаток
 */
export async function startApp() {
  try {
    // Bootstrap
    const { container, store, eventBus } = await bootstrap();

    // Initialize
    const initializer = container.resolve('appInitializer');
    await initializer.initialize();

    // Return app instance
    return {
      container,
      store,
      eventBus,
      initialized: true
    };

  } catch (error) {
    console.error('❌ App failed to start:', error);
    throw error;
  }
}

export default { bootstrap, startApp };
