# EventManager Window Export Fix - 12.10.2025 ~15:00

## 📋 Проблема

**Помилка в консолі:**
```
logger.js:33 [13:16:03] [TTS] ⚠️ EventManager not available after retry, TTS events disabled
```

**Симптом:**
- TTS Manager НЕ міг підписатись на події через EventManager
- EventManager був імпортований як ES6 модуль але НЕ доступний через `window.eventManager`
- Підписка на `TTS_SPEAK_REQUEST` НЕ працювала
- Activation responses НЕ озвучувались

---

## 🔍 Діагностика

### Архітектура проблеми:

```javascript
// app-refactored.js (БУЛО)
import { eventManager } from './voice-control/events/event-manager.js';

class AtlasApp {
  async init() {
    // eventManager використовується внутрішньо
    // але НЕ експортується в window
  }
}

// tts-manager.js
_subscribeToTTSEvents() {
  const trySubscribe = () => {
    if (typeof window !== 'undefined' && window.eventManager) {
      // ❌ window.eventManager === undefined
      // Підписка НЕ працює
    }
  };
}
```

### Порядок ініціалізації (проблемний):

```
1. app-refactored.js imports eventManager (ES6 module scope)
   ↓
2. TTSManager.init() → _subscribeToTTSEvents()
   ↓
3. trySubscribe() → window.eventManager === undefined ❌
   ↓
4. setTimeout retry (100ms) → still undefined ❌
   ↓
5. Warning: "EventManager not available after retry"
```

### Корінь проблеми:

**EventManager був доступний ТІЛЬКИ через ES6 import**, але TTS Manager очікував його в `window.eventManager` для сумісності з legacy кодом та пізньою ініціалізацією.

---

## ✅ Рішення

### Експорт eventManager в window

```javascript
// web/static/js/app-refactored.js

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
  // ... initialization
}
```

### Чому це працює:

1. **Ранній експорт** - одразу після import, ДО будь-якої ініціалізації
2. **Глобальна доступність** - всі модулі можуть використовувати `window.eventManager`
3. **Сумісність** - працює з ES6 modules та legacy кодом
4. **Синхронність** - доступний негайно, без race conditions

---

## 📊 Результат

### ПЕРЕД:

```
[TTS] ⏳ EventManager not ready, retrying in 100ms...
[TTS] ⚠️ EventManager not available after retry, TTS events disabled
```

**Наслідки:**
- ❌ TTS_SPEAK_REQUEST події НЕ обробляються
- ❌ Activation responses НЕ озвучуються
- ❌ TTS система частково непрацездатна

### ПІСЛЯ:

```
[TTS] ✅ Subscribed to TTS events
[TTS] 🔊 TTS_SPEAK_REQUEST received: "що бажаєте?" (agent: atlas, mode: normal)
```

**Переваги:**
- ✅ EventManager доступний глобально
- ✅ TTS підписується на події успішно
- ✅ Activation responses озвучуються
- ✅ Повна функціональність TTS системи

---

## 🔧 Технічні деталі

### Event Flow (виправлений):

```
Initialization:
  app-refactored.js imports eventManager
    ↓
  IMMEDIATELY: window.eventManager = eventManager
    ↓
  AtlasApp.init()
    ↓
  ChatManager.init() → TTSManager.init()
    ↓
  TTSManager._subscribeToTTSEvents()
    ↓
  window.eventManager ✅ available
    ↓
  eventManager.on('TTS_SPEAK_REQUEST', handler)
    ↓
  Subscription successful ✅

Runtime:
  ConversationMode → keyword "Атлас" detected
    ↓
  chatManager.addMessage(activationResponse, 'atlas', {skipTTS: true})
    ↓
  eventManager.emit('TTS_SPEAK_REQUEST', {text, agent, isActivationResponse})
    ↓
  TTSManager receives event ✅
    ↓
  TTS speaks: "що бажаєте?" ✅
```

### Критичні моменти:

1. **Timing** - експорт ПЕРЕД будь-якою ініціалізацією
2. **Scope** - window.eventManager доступний всюди
3. **Compatibility** - ES6 modules + legacy global access
4. **No race conditions** - синхронний експорт при завантаженні модуля

---

## 📁 Змінені файли

### 1. `web/static/js/app-refactored.js`

**Зміни:**
- Додано експорт `window.eventManager = eventManager` після imports
- Коментар з поясненням критичності

**Розмір:** +6 рядків

**Commit:**
```
fab2c5f fix: Export eventManager to window for TTS and other modules
```

---

## ✅ Перевірка

### Тест #1: Консоль після завантаження

```javascript
// DevTools Console
console.log('EventManager:', window.eventManager);
// Має показати: EventManager { _events: Map, ... }

console.log('TTS subscribed:', 
  window.eventManager?._events?.has('TTS_SPEAK_REQUEST'));
// Має показати: true
```

### Тест #2: Activation Response

```
1. Відкрити http://localhost:5001
2. Утримати мікрофон 2+ сек
3. Сказати: "Атлас"
4. Перевірити Console:
   [TTS] 🔊 TTS_SPEAK_REQUEST received: "що бажаєте?"
5. Почути озвучення ✅
```

### Тест #3: Event Subscription

```javascript
// DevTools Console
window.eventManager.on('TEST_EVENT', (data) => {
  console.log('Test event received:', data);
});

window.eventManager.emit('TEST_EVENT', {message: 'Hello'});
// Має показати: Test event received: {message: 'Hello'}
```

---

## 🎯 Критерії успіху

- ✅ `window.eventManager` доступний з консолі
- ✅ Немає warning "EventManager not available"
- ✅ TTS підписується на події успішно
- ✅ Activation responses озвучуються
- ✅ Conversation loop працює повністю

---

## 📝 Пов'язані виправлення

Це виправлення працює разом з:

1. **Keyword Activation Response Fix** (12.10.2025 ранок)
   - Додано `chatManager.addMessage()` для activation response
   - Emit `TTS_SPEAK_REQUEST` з правильним payload

2. **TTS_COMPLETED Event Name Fix** (11.10.2025)
   - Використання Events константи замість string literal
   - Event chain працює без помилок

3. **Conversation Loop TTS Fix** (11.10.2025)
   - Правильний шлях до conversation manager
   - TTS → continuous listening цикл

**Разом ці виправлення забезпечують:**
- 🎯 Повний conversation workflow
- 🎯 Озвучення activation responses
- 🎯 Автоматичний цикл діалогу
- 🎯 Стабільну роботу TTS системи

---

## 🚀 Майбутні покращення

### Можливі оптимізації (OPTIONAL):

1. **TypeScript типи для window.eventManager**
   ```typescript
   declare global {
     interface Window {
       eventManager: EventManager;
       atlasLogger: AnimatedLoggingSystem;
     }
   }
   ```

2. **EventManager health check**
   ```javascript
   window.eventManager.healthCheck = () => ({
     subscriptions: window.eventManager._events.size,
     events: [...window.eventManager._events.keys()]
   });
   ```

3. **Debug mode для event tracing**
   ```javascript
   window.eventManager.enableDebug = () => {
     window.eventManager._debugMode = true;
     // Log all emit/on calls
   };
   ```

---

**Виправлення застосовано успішно! ✅**

EventManager тепер доступний глобально, TTS система працює повністю.
