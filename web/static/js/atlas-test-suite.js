/**
 * ATLAS Frontend Testing Suite - v4.0
 *
 * Комплексна система тестування нової модульної архітектури
 */

// Простий тест-раннер для браузера
class AtlasTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runAll() {
    console.log('🧪 Running ATLAS Frontend Tests...');

    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${name}`);
        this.results.passed++;
      } catch (error) {
        console.error(`❌ ${name}:`, error.message);
        this.results.failed++;
      }
      this.results.total++;
    }

    console.log(`\n📊 Test Results: ${this.results.passed}/${this.results.total} passed`);

    if (this.results.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.warn(`⚠️ ${this.results.failed} tests failed`);
    }

    return this.results;
  }
}

// Ініціалізуємо тести
const testRunner = new AtlasTestRunner();

// Тест перевірки модулів
testRunner.test('Module imports available', async () => {
  // Перевіряємо що модулі можуть бути імпортовані
  const modules = [
    './components/logging/animated-logging.js',
    './components/model3d/atlas-3d-controller.js',
    './components/tts/atlas-tts-visualization.js',
    './components/ui/atlas-advanced-ui.js'
  ];

  for (const modulePath of modules) {
    try {
      const module = await import(modulePath);
      if (!module) {
        throw new Error(`Module ${modulePath} failed to load`);
      }
    } catch (error) {
      throw new Error(`Failed to import ${modulePath}: ${error.message}`);
    }
  }
});

// Тест DOM елементів
testRunner.test('Required DOM elements exist', () => {
  const requiredElements = [
    '#model-viewer',
    '.logs-panel',
    '#chat-container',
    '.input-container'
  ];

  for (const selector of requiredElements) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Required element ${selector} not found`);
    }
  }
});

// Тест CSS змінних
testRunner.test('CSS variables are defined', () => {
  const requiredCSSVars = [
    '--primary-color',
    '--secondary-color',
    '--accent-color',
    '--bg-primary'
  ];

  const computedStyle = getComputedStyle(document.documentElement);

  for (const varName of requiredCSSVars) {
    const value = computedStyle.getPropertyValue(varName);
    if (!value || value.trim() === '') {
      throw new Error(`CSS variable ${varName} is not defined`);
    }
  }
});

// Тест WebGL підтримки
testRunner.test('WebGL support available', () => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    throw new Error('WebGL is not supported in this browser');
  }
});

// Тест Web Audio API
testRunner.test('Web Audio API available', () => {
  if (!window.AudioContext && !window.webkitAudioContext) {
    throw new Error('Web Audio API is not supported');
  }
});

// Тест Model Viewer
testRunner.test('Model Viewer component ready', () => {
  const modelViewer = document.querySelector('#model-viewer');
  if (!modelViewer) {
    throw new Error('Model viewer element not found');
  }

  // Перевіряємо що model-viewer скрипт завантажений
  if (!customElements.get('model-viewer')) {
    throw new Error('Model viewer component not registered');
  }
});

// Тест логування системи
testRunner.test('Logging system initialization', async () => {
  const { AnimatedLoggingSystem } = await import('./components/logging/animated-logging.js');

  // Створюємо тимчасовий контейнер
  const testContainer = document.createElement('div');
  testContainer.id = 'test-logs-container';
  document.body.appendChild(testContainer);

  try {
    const logger = new AnimatedLoggingSystem('test-logs-container', {
      maxLogs: 10,
      enableGlow: false
    });

    // Тестуємо базове логування
    logger.info('Test message', 'TestModule');

    // Перевіряємо що повідомлення з'явилося
    setTimeout(() => {
      const logEntries = testContainer.querySelectorAll('.log-entry');
      if (logEntries.length === 0) {
        throw new Error('Log entries not created');
      }
    }, 100);

  } finally {
    // Очищуємо
    document.body.removeChild(testContainer);
  }
});

// Тест 3D контролера
testRunner.test('3D Controller initialization', async () => {
  const { Atlas3DModelController } = await import('./components/model3d/atlas-3d-controller.js');

  const modelViewer = document.querySelector('#model-viewer');
  if (!modelViewer) {
    throw new Error('Model viewer not available for 3D controller test');
  }

  try {
    const controller = new Atlas3DModelController('#model-viewer', {
      enableInteraction: false, // Вимкнути для тесту
      enableBehaviors: false
    });

    // Перевіряємо базову ініціалізацію
    if (!controller.config) {
      throw new Error('3D Controller config not initialized');
    }

    if (!controller.state) {
      throw new Error('3D Controller state not initialized');
    }

    // Очищуємо
    if (controller.destroy) {
      controller.destroy();
    }

  } catch (error) {
    // Очікуваний варіант якщо model-viewer ще не готовий
    if (!error.message.includes('not found')) {
      throw error;
    }
  }
});

// Тест Advanced UI
testRunner.test('Advanced UI system initialization', async () => {
  const { AtlasAdvancedUI } = await import('./components/ui/atlas-advanced-ui.js');

  try {
    const ui = new AtlasAdvancedUI({
      loggingEnabled: false, // Вимкнути для тесту
      enable3DController: false,
      enableTTSVisualization: false
    });

    // Перевіряємо базову ініціалізацію
    if (!ui.config) {
      throw new Error('Advanced UI config not initialized');
    }

    if (!ui.state) {
      throw new Error('Advanced UI state not initialized');
    }

    // Очищуємо
    if (ui.destroy) {
      ui.destroy();
    }

  } catch (error) {
    if (!error.message.includes('not found')) {
      throw error;
    }
  }
});

// Тест утиліт
testRunner.test('Atlas utilities work correctly', async () => {
  const { AtlasUtils } = await import('./components/index.js');

  // Тест генерації ID
  const id = AtlasUtils.generateId('test');
  if (!id.startsWith('test_')) {
    throw new Error('ID generation failed');
  }

  // Тест форматування часу
  const timeString = AtlasUtils.formatTime();
  if (!/\d{2}:\d{2}:\d{2}/.test(timeString)) {
    throw new Error('Time formatting failed');
  }

  // Тест визначення типу пристрою
  const deviceType = AtlasUtils.getDeviceType();
  if (!['mobile', 'tablet', 'desktop'].includes(deviceType)) {
    throw new Error('Device type detection failed');
  }
});

// Тест константи
testRunner.test('Atlas constants are defined', async () => {
  const { AtlasConstants } = await import('./components/index.js');

  if (!AtlasConstants.THEMES) {
    throw new Error('THEMES constants not defined');
  }

  if (!AtlasConstants.LOG_LEVELS) {
    throw new Error('LOG_LEVELS constants not defined');
  }

  if (!AtlasConstants.EVENTS) {
    throw new Error('EVENTS constants not defined');
  }
});

// Автоматичний запуск тестів при завантаженні
document.addEventListener('DOMContentLoaded', () => {
  // Невелика затримка для завантаження всіх скриптів
  setTimeout(() => {
    testRunner.runAll().then(results => {
      // Показуємо результати в консолі та на сторінці
      if (window.atlasUI && window.atlasUI.loggingSystem) {
        const logger = window.atlasUI.loggingSystem;

        if (results.failed === 0) {
          logger.success(`All ${results.total} tests passed!`, 'TestRunner');
        } else {
          logger.warn(`${results.failed}/${results.total} tests failed`, 'TestRunner');
        }
      }
    }).catch(error => {
      console.error('Test runner failed:', error);
    });
  }, 2000);
});

// Експортуємо для ручного використання
window.atlasTestRunner = testRunner;
