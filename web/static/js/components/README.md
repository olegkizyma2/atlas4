# ATLAS Web Frontend v2.0 - Документація

## 🚀 Огляд

ATLAS Web Frontend v2.0 - це повністю модернізована веб-система інтерфейсу з підтримкою:

- **Анімованої системи логування** з синьо-зеленою колірною схемою та вертикальним потоком
- **Інтерактивної 3D моделі** з TTS візуалізацією та поведінковими анімаціями  
- **Розширеної UI системи** з модальними вікнами, сповіщеннями та підказками
- **Модульної архітектури** з ES6 модулями та чистим розділенням відповідальності
- **Збереженого оригінального дизайну** у хакерському стилі

## 📁 Структура проекту

```
web/static/js/
├── components/                    # Нові модульні компоненти
│   ├── index.js                  # Головний експорт компонентів
│   ├── logging/
│   │   └── animated-logging.js   # Система логування з анімаціями  
│   ├── model3d/
│   │   └── atlas-3d-controller.js # Контролер 3D моделі
│   ├── tts/
│   │   └── atlas-tts-visualization.js # TTS візуалізація
│   └── ui/
│       └── atlas-advanced-ui.js  # Розширена UI система
├── core/                         # Існуюче ядро
├── modules/                      # Існуючі модулі
├── voice-control/               # Існуюча голосова система
├── app-refactored.js            # Оновлений головний додаток
└── atlas-test-suite.js          # Система тестування
```

## 🎨 Нові можливості

### 1. Анімована система логування

- **Вертикальний потік логів** (спадання вниз) замість горизонтального
- **Синьо-зелена колірна схема** (#00ffff, #00ff7f) з анімаціями
- **Typewriter ефект** для нових повідомлень (тільки на desktop)
- **Glow ефекти** та пульсація для важливих повідомлень
- **Фільтрація за рівнями** (INFO, WARN, ERROR, DEBUG, SYSTEM, SUCCESS)
- **Статистика логів** у футері з лічильниками
- **Експорт логів** у текстовий файл

```javascript
// Використання
const logger = new AnimatedLoggingSystem('logs-container', {
    maxLogs: 1000,
    enableGlow: true,
    enableTypewriter: true,
    colors: {
        info: '#00ffff',
        success: '#00ff7f'
    }
});

logger.info('System started', 'Core');
logger.success('Connection established', 'Network');
```

### 2. 3D модель з інтелектуальною поведінкою

- **Адаптивні анімації** базовані на контексті (idle, speaking, listening, thinking)
- **Емоційна система** з різними станами (happy, calm, excited, neutral)
- **TTS синхронізація** з рухом губ та виразами обличчя
- **Інтерактивні реакції** на кліки та ховер
- **Машинне навчання** патернів взаємодії користувача
- **Динамічне освітлення** та glow ефекти

```javascript
// Управління 3D моделлю
const model3D = new Atlas3DModelController('#model-viewer', {
    enableInteraction: true,
    enableBehaviors: true,
    enableTTSVisualization: true
});

model3D.triggerEmotion('happy', { intensity: 0.8, duration: 2000 });
model3D.speak('Привіт! Я Атлас.');
```

### 3. TTS візуалізація з аудіо аналізом

- **Реальний час аудіо аналіз** з Web Audio API
- **Фонемічне мапування** для природної анімації рота
- **Частотний спектр аналіз** для реактивних ефектів  
- **Візуальні ефекти** (glow, particles, wave) синхронізовані з голосом
- **Адаптивна інтенсивність** базована на гучності та тоні
- **Автоматичне моргання** та вирази обличчя

```javascript
// TTS візуалізація
const ttsViz = new AtlasTTSVisualization(model3D, {
    enableRealTimeAnalysis: true,
    enablePhonemeMapping: true,
    enableFacialAnimation: true
});

ttsViz.startTTS('Це тестове повідомлення', audioElement);
```

### 4. Розширена UI система

- **Модальні вікна** з анімаціями та backdrop blur
- **Система сповіщень** (toast notifications) у правому верхньому куті
- **Tooltip підказки** для всіх інтерактивних елементів
- **Контекстні меню** з правим кліком
- **Прогрес індикатори** для довгих операцій
- **Клавіатурні скорочення** (F1 - допомога, F11 - повноекранний режим)
- **Три теми** (dark-cyber, light-tech, neo-green)

```javascript
// Розширена UI система
const ui = new AtlasAdvancedUI({
    theme: 'dark-cyber',
    enableAnimations: true,
    enableKeyboardShortcuts: true
});

ui.showNotification('Операція завершена!', 'success');
ui.showModal('help-modal', 'Допомога', content);
```

## ⚙️ Налаштування та використання

### Базова ініціалізація

```javascript
import { createAtlasUI } from './components/index.js';

// Автоматична ініціалізація всієї системи
const atlasUI = await createAtlasUI({
    theme: 'dark-cyber',
    enableAnimations: true,
    enable3DController: true,
    enableTTSVisualization: true,
    loggingEnabled: true
});
```

### Ручна ініціалізація компонентів

```javascript
import { 
    AnimatedLoggingSystem,
    Atlas3DModelController, 
    AtlasTTSVisualization,
    AtlasAdvancedUI 
} from './components/index.js';

// Ініціалізація по частинах
const logger = new AnimatedLoggingSystem('logs-container');
const model3D = new Atlas3DModelController('#model-viewer');
const ttsViz = new AtlasTTSVisualization(model3D);
const ui = new AtlasAdvancedUI();
```

## 🎛️ Конфігурація

### Теми

```javascript
// Доступні теми
ui.switchTheme('dark-cyber');   // Темно-кібер (за замовчуванням)
ui.switchTheme('light-tech');   // Світло-технічна
ui.switchTheme('neo-green');    // Нео-зелена (Matrix стиль)
```

### Логування

```javascript
const logger = new AnimatedLoggingSystem('container', {
    maxLogs: 1000,              // Максимум логів
    enableGlow: true,           // Glow ефекти
    enableTypewriter: true,     // Typewriter анімація
    autoScroll: true,           // Автоскрол
    fadeOutDelay: 5000,         // Затримка зникнення
    colors: {                   // Кольорова схема
        info: '#00ffff',
        success: '#00ff7f',
        error: '#ff4444'
    }
});
```

### 3D модель

```javascript
const model3D = new Atlas3DModelController('#model-viewer', {
    enableInteraction: true,        // Інтерактивність
    enableBehaviors: true,          // Поведінкові анімації
    enableTTSVisualization: true,   // TTS візуалізація
    animationSpeed: 1.0,           // Швидкість анімацій
    emotionalRange: 1.0,           // Діапазон емоцій
    adaptiveLearning: true         // Машинне навчання
});
```

## 🔧 API Довідник

### Система логування

```javascript
// Методи логування
logger.info(message, source);     // Інформація
logger.warn(message, source);     // Попередження  
logger.error(message, source);    // Помилка
logger.debug(message, source);    // Відлагодження
logger.system(message, source);   // Системне
logger.success(message, source);  // Успіх

// Управління
logger.clear();                   // Очистити логи
logger.togglePause();            // Пауза/продовжити
logger.downloadLogs();           // Завантажити логи
```

### 3D контролер

```javascript
// Анімації
model3D.playAnimation('speaking', { duration: 1000, loop: true });
model3D.stopAnimation('speaking');

// Емоції
model3D.triggerEmotion('happy', { intensity: 0.8, duration: 2000 });
model3D.updateMood('joyful');

// TTS інтеграція
model3D.speak('Текст для озвучення');
model3D.stopSpeaking();

// Стан
const state = model3D.getState();
const config = model3D.getConfig();
```

### UI система

```javascript
// Сповіщення
ui.showNotification('Повідомлення', 'info', 5000);
ui.showNotification('Успіх!', 'success');
ui.showNotification('Помилка!', 'error');

// Модальні вікна
ui.showModal('modal-id', 'Заголовок', 'Контент');
ui.closeModal();

// Прогрес
ui.showProgress('task-id', 'Завантаження...');
ui.updateProgress('task-id', 50);
ui.hideProgress('task-id');

// Теми
ui.switchTheme('neo-green');

// Події
ui.on('theme-changed', (data) => console.log(data));
ui.emit('custom-event', { data: 'value' });
```

## 🎹 Клавіатурні скорочення

- **F1** - Показати довідку
- **F11** - Повноекранний режим  
- **Ctrl+Shift+L** - Показати/сховати логи
- **Ctrl+Shift+T** - Змінити тему
- **Ctrl+Shift+D** - Режим відлагодження
- **Escape** - Закрити модальні вікна

## 📱 Адаптивність

Система автоматично адаптується до розміру екрану:

- **Desktop** (>1024px) - Повна функціональність
- **Tablet** (768-1024px) - Спрощений інтерфейс
- **Mobile** (<768px) - Мобільна версія з табами

## 🔍 Відлагодження

### Режим відлагодження

```javascript
// Активація режиму відлагодження
ui.toggleDebugMode();

// Або через клавіатуру: Ctrl+Shift+D
```

### Тестування

```javascript
// Автоматичні тести
window.atlasTestRunner.runAll();

// Ручне тестування компонентів
import { AtlasUtils } from './components/index.js';
console.log('WebGL підтримка:', AtlasUtils.supportsWebGL());
console.log('Web Audio підтримка:', AtlasUtils.supportsWebAudio());
```

## 🚀 Продуктивність

### Оптимізації

- **Lazy loading** модулів
- **Debounce/throttle** для часто викликаних функцій
- **RequestAnimationFrame** для анімацій
- **Web Workers** для важких обчислень (в майбутніх версіях)
- **CSS Hardware Acceleration** для 3D трансформацій

### Моніторинг

```javascript
// Метрики продуктивності
const metrics = ui.getComponent('monitoring');
console.log('FPS:', metrics.getFPS());
console.log('Memory usage:', metrics.getMemoryUsage());
```

## 🌟 Приклади використання

### Інтеграція з чатом

```javascript
// Підключення до існуючої чат системи
ui.on('message-sent', (event) => {
    ui.loggingSystem.info(`User: ${event.detail.message}`, 'Chat');
    model3D.triggerEmotion('listening', { intensity: 0.6 });
});

ui.on('message-received', (event) => {
    ui.loggingSystem.success(`AI Response received`, 'Chat');
    model3D.triggerEmotion('thinking', { intensity: 0.7 });
});
```

### Кастомні анімації

```javascript
// Реєстрація нової анімації для 3D моделі
model3D.registerAnimation('custom-dance', {
    rotation: { x: 5, y: 15, z: -2 },
    scale: { x: 1.1, y: 1.1, z: 1.1 },
    duration: 800,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    loop: true
});

model3D.playAnimation('custom-dance');
```

### Кастомні TTS ефекти

```javascript
// Додавання нового візуального ефекту
ttsViz.visualEffects.rainbow = {
    type: 'color',
    trigger: 'frequency', 
    mapping: frequencies => {
        // Логіка rainbow ефекту
    },
    duration: 500
};
```

## 🔮 Майбутні покращення

- **WebRTC інтеграція** для реального голосового зв'язку
- **WebGL шейдери** для покращених візуальних ефектів
- **AI-керовані анімації** на основі контексту розмови
- **Голосові команди** для управління інтерфейсом
- **Multiplayer режим** для спільної взаємодії
- **VR/AR підтримка** для іммерсивного досвіду

## 💡 Поради по використанню

1. **Завжди перевіряйте підтримку браузера** перед використанням Web Audio API
2. **Використовуйте debounce** для часто викликаних функцій
3. **Вимикайте анімації на слабких пристроях** для кращої продуктивності
4. **Тестуйте на різних розмірах екранів** для кращої адаптивності
5. **Моніторте використання пам'яті** при довгих сесіях

## 🆘 Усунення несправностей

### Часті проблеми

**3D модель не завантажується:**
- Перевірте шлях до GLB файлу
- Переконайтеся що model-viewer скрипт завантажений
- Перевірте підтримку WebGL в браузері

**TTS візуалізація не працює:**
- Дозвольте доступ до мікрофону
- Перевірте підтримку Web Audio API
- Переконайтеся що аудіо елемент підключений

**Логи не з'являються:**
- Перевірте що контейнер існує в DOM
- Переконайтеся що CSS стилі завантажені
- Перевірте консоль на помилки ініціалізації

---

**Розроблено з ❤️ для проекту ATLAS**  
*Версія: 2.0 | Дата: Вересень 2025*