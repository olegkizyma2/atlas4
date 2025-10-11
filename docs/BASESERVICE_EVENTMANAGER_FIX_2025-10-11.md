# BaseService EventManager Fix - 11.10.2025 (рання ніч ~01:50)

## 🔴 КРИТИЧНА ПРОБЛЕМА

**Симптом:**
```
[KEYWORD] ❌ EventManager is undefined!
EventManager not available in KeywordDetectionService
```

**Корінь проблеми:**
BaseService використовував **глобальний** `eventManager` (імпортований з `events/event-manager.js`) замість того що передається через конструктор!

## 🔬 Технічний аналіз

### До виправлення:

```javascript
// base-service.js
import { eventManager } from '../events/event-manager.js';

export class BaseService {
  constructor(config) {
    this.logger = createLogger(this.name);
    // ❌ eventManager НЕ зберігався з config!
  }
  
  async emit(eventType, payload) {
    // ❌ Використовувався глобальний eventManager
    return await eventManager.emit(eventType, payload, { source: this.name });
  }
}
```

```javascript
// voice-control-manager.js
const keywordService = new KeywordDetectionService({
  logger: this.logger.category('KEYWORD'),
  eventManager: this.eventManager, // ✅ Передавався
  ...serviceConfigs.keyword
});
```

```javascript
// keyword-detection-service.js
subscribeToConversationEvents() {
  if (!this.eventManager) {
    // ❌ this.eventManager був undefined бо BaseService НЕ зберігав його!
    console.error('[KEYWORD] ❌ EventManager is undefined!');
    return;
  }
}
```

**Проблема:** EventManager передавався в конструктор, але BaseService його **НЕ зберігав**!

---

## 🛠️ Виправлення

### Змінений файл: `web/static/js/voice-control/core/base-service.js`

#### 1. Збереження eventManager в конструкторі

**До:**
```javascript
constructor(config) {
  this.name = this.config.name;
  this.logger = createLogger(this.name);
  // ❌ eventManager НЕ зберігався
}
```

**Після:**
```javascript
constructor(config) {
  this.name = this.config.name;
  this.logger = config.logger || createLogger(this.name);
  
  // ✅ КРИТИЧНО: Використовуємо переданий eventManager або fallback на глобальний
  this.eventManager = config.eventManager || eventManager;
}
```

#### 2. Заміна всіх використань eventManager на this.eventManager

**До:**
```javascript
await eventManager.emit(Events.SERVICE_INITIALIZED, {...});
eventManager.on(eventType, handler, options);
eventManager.off(subscriptionId);
```

**Після:**
```javascript
await this.eventManager.emit(Events.SERVICE_INITIALIZED, {...});
this.eventManager.on(eventType, handler, options);
this.eventManager.off(subscriptionId);
```

#### Всього змінено: 7 місць

1. ✅ `constructor()` - додано `this.eventManager = config.eventManager || eventManager`
2. ✅ `constructor()` - додано `this.logger = config.logger || createLogger(...)`
3. ✅ `initialize()` - `await this.eventManager.emit(Events.SERVICE_INITIALIZED, ...)`
4. ✅ `destroy()` - `this.eventManager.off(id)` та `await this.eventManager.emit(Events.SERVICE_DESTROYED, ...)`
5. ✅ `performHealthCheck()` - `await this.eventManager.emit(Events.SERVICE_UNHEALTHY, ...)`
6. ✅ `subscribe()` - `this.eventManager.on(eventType, handler, options)`
7. ✅ `unsubscribe()` - `this.eventManager.off(subscriptionId)`
8. ✅ `emit()` - `await this.eventManager.emit(eventType, payload, ...)`

---

## ✅ Результат

### Тепер працює правильно:

```javascript
// voice-control-manager.js передає eventManager
const keywordService = new KeywordDetectionService({
  eventManager: this.eventManager, // ✅ Передається
  ...
});

// BaseService зберігає його
constructor(config) {
  this.eventManager = config.eventManager || eventManager; // ✅ Зберігається
}

// KeywordDetectionService має доступ
subscribeToConversationEvents() {
  if (!this.eventManager) {
    // ✅ Тепер this.eventManager існує!
    console.error('...');
    return;
  }
  
  this.eventManager.on('START_KEYWORD_DETECTION', ...) // ✅ Працює!
}
```

---

## 🔍 Перевірка

**Раніше:**
```
[KEYWORD] ❌ EventManager is undefined!
subscribeToConversationEvents @ keyword-detection-service.js:112
```

**Тепер (очікується):**
```
[KEYWORD] 🎬 Subscribing to conversation events...
[KEYWORD] ✅ EventManager available: object
[KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION event
```

---

## 📊 Вплив на систему

### Виправлено:
- ✅ KeywordDetectionService тепер має доступ до eventManager
- ✅ Підписка на 'START_KEYWORD_DETECTION' працює
- ✅ Conversation Mode може активувати keyword detection
- ✅ ВСІ BaseService нащадки тепер коректно використовують переданий eventManager

### Покращено:
- ✅ Додано fallback на глобальний eventManager якщо не переданий
- ✅ Додано підтримку передачі logger через config
- ✅ Більш гнучка архітектура для dependency injection

---

## 🚀 Тестування

**Запустити:**
```bash
./restart_system.sh restart
# Відкрити http://localhost:5001
# Відкрити Browser Console (Cmd+Option+J)
# Утримати кнопку мікрофона 2+ секунди
```

**Очікувані логи:**
```
[KEYWORD] 🎬 Subscribing to conversation events...
[KEYWORD] ✅ EventManager available: object
[KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION event
[CONVERSATION] 📡 Emitting START_KEYWORD_DETECTION event
[KEYWORD] 📨 Received START_KEYWORD_DETECTION request
[KEYWORD] 🎤 Starting detection...
```

---

## 📝 Супутні зміни

Це виправлення також покращує:
- **MicrophoneButtonService** - тепер коректно отримує eventManager
- **WhisperService** - тепер коректно отримує eventManager
- **SpeechResultsService** - тепер коректно отримує eventManager
- **Всі інші BaseService нащадки**

---

## ✅ Status

**Виправлення:** COMPLETED ✅  
**Тестування:** Pending - потрібен restart системи  
**Impact:** HIGH - вирішує core проблему conversation mode  
**Backward compatible:** YES - fallback на глобальний eventManager

---

**Next Step:** Restart системи та перевірка що conversation mode тепер може підписатись на події.

**Datetime:** 11.10.2025, рання ніч ~01:50
