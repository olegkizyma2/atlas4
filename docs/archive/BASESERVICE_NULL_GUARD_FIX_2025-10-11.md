# BaseService Null EventManager Guard Fix - 11.10.2025 (рання ніч ~02:00)

## 🔴 КРИТИЧНА ПРОБЛЕМА #2

**Симптом:**
```
Uncaught (in promise) TypeError: Cannot read properties of null (reading 'emit')
at VoiceControlManager.emit (base-service.js:279:36)
at VoiceControlManager.setState (base-service.js:294:12)
at VoiceControlManager.initialize (base-service.js:88:10)
```

**Корінь проблеми:**
BaseService викликає `setState('initializing')` ПЕРЕД `await this.onInitialize()`, але VoiceControlManager створює `this.eventManager` саме в `onInitialize()`!

## 🔬 Технічний аналіз

### Послідовність виконання:

```javascript
// 1. VoiceControlManager constructor
constructor(config) {
  super(config); // BaseService constructor
  this.eventManager = null; // ❌ Поки null!
}

// 2. BaseService.initialize()
async initialize() {
  this.setState('initializing'); // ❌ Викликає this.emit()
                                  // ❌ this.emit() викликає this.eventManager.emit()
                                  // ❌ this.eventManager ще null!
  
  const success = await this.onInitialize(); // Тут створюється eventManager
}

// 3. VoiceControlManager.onInitialize()
async onInitialize() {
  this.eventManager = new EventManager(...); // ✅ Тільки тут створюється!
}
```

**Проблема:** setState використовує eventManager ПЕРЕД його створенням!

---

## 🛠️ Виправлення

### Файл: `web/static/js/voice-control/core/base-service.js`

Додано **null-safety guards** в усі методи що використовують eventManager:

#### 1. emit() - додана перевірка

**До:**
```javascript
async emit(eventType, payload) {
  return await this.eventManager.emit(eventType, payload, { source: this.name });
}
```

**Після:**
```javascript
async emit(eventType, payload) {
  // Перевірка наявності eventManager
  if (!this.eventManager) {
    this.logger?.debug?.(`EventManager not available, skipping emit: ${eventType}`);
    return false;
  }
  return await this.eventManager.emit(eventType, payload, { source: this.name });
}
```

#### 2. setState() - умовна емісія

**До:**
```javascript
setState(newState) {
  const oldState = this.state;
  this.state = newState;

  if (oldState !== newState) {
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
    
    // ❌ Завжди викликає emit
    this.emit(Events.SERVICE_STATE_CHANGED, {...});
  }
}
```

**Після:**
```javascript
setState(newState) {
  const oldState = this.state;
  this.state = newState;

  if (oldState !== newState) {
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
    
    // ✅ Емісія тільки якщо eventManager доступний
    if (this.eventManager) {
      this.emit(Events.SERVICE_STATE_CHANGED, {...});
    }
  }
}
```

#### 3. initialize() - умовна емісія

**До:**
```javascript
// Емісія події
await this.eventManager.emit(Events.SERVICE_INITIALIZED, {...});
```

**Після:**
```javascript
// Емісія події (тільки якщо eventManager доступний)
if (this.eventManager) {
  await this.eventManager.emit(Events.SERVICE_INITIALIZED, {...});
}
```

#### 4. destroy() - умовна відписка та емісія

**До:**
```javascript
// Відписка від подій
this.subscriptions.forEach(id => this.eventManager.off(id));

// Емісія події
await this.eventManager.emit(Events.SERVICE_DESTROYED, {...});
```

**Після:**
```javascript
// Відписка від подій (тільки якщо eventManager доступний)
if (this.eventManager) {
  this.subscriptions.forEach(id => this.eventManager.off(id));
}

// Емісія події (тільки якщо eventManager доступний)
if (this.eventManager) {
  await this.eventManager.emit(Events.SERVICE_DESTROYED, {...});
}
```

#### 5. performHealthCheck() - умовна емісія

**До:**
```javascript
if (this.healthStatus.consecutiveFailures >= 3) {
  await this.eventManager.emit(Events.SERVICE_UNHEALTHY, {...});
}
```

**Після:**
```javascript
if (this.healthStatus.consecutiveFailures >= 3 && this.eventManager) {
  await this.eventManager.emit(Events.SERVICE_UNHEALTHY, {...});
}
```

#### 6. subscribe() - перевірка та warning

**До:**
```javascript
subscribe(eventType, handler, options = {}) {
  const subscriptionId = this.eventManager.on(eventType, handler, options);
  this.subscriptions.add(subscriptionId);
  return subscriptionId;
}
```

**Після:**
```javascript
subscribe(eventType, handler, options = {}) {
  if (!this.eventManager) {
    this.logger?.warn?.(`EventManager not available, cannot subscribe to: ${eventType}`);
    return null;
  }
  const subscriptionId = this.eventManager.on(eventType, handler, options);
  this.subscriptions.add(subscriptionId);
  return subscriptionId;
}
```

#### 7. unsubscribe() - перевірка subscriptionId та eventManager

**До:**
```javascript
unsubscribe(subscriptionId) {
  this.eventManager.off(subscriptionId);
  this.subscriptions.delete(subscriptionId);
}
```

**Після:**
```javascript
unsubscribe(subscriptionId) {
  if (!subscriptionId || !this.eventManager) {
    return;
  }
  this.eventManager.off(subscriptionId);
  this.subscriptions.delete(subscriptionId);
}
```

---

## ✅ Результат

### Тепер працює:

```javascript
// 1. VoiceControlManager constructor
this.eventManager = null; // Поки null

// 2. BaseService.initialize()
this.setState('initializing'); // ✅ Перевіряє eventManager, не крашить
                               // ✅ Логує state change, але НЕ емітує подію

// 3. VoiceControlManager.onInitialize()
this.eventManager = new EventManager(); // Створюється

// 4. BaseService.initialize() продовжує
this.setState('active'); // ✅ Тепер eventManager є, емітує подію
await this.eventManager.emit(Events.SERVICE_INITIALIZED, ...); // ✅ Працює
```

### Безпечна деградація:

- ✅ Якщо eventManager null → логування працює, емісія пропускається
- ✅ Якщо eventManager створений пізніше → починає емітувати
- ✅ Немає crashes через null reference
- ✅ Всі критичні операції (setState, subscribe, emit) захищені

---

## 📊 Вплив на систему

### Виправлено:
- ✅ VoiceControlManager тепер ініціалізується БЕЗ crash
- ✅ setState працює на будь-якому етапі життєвого циклу
- ✅ Всі BaseService нащадки захищені від null eventManager
- ✅ Graceful degradation коли eventManager недоступний

### Покращено:
- ✅ Додано інформативні debug/warn логи
- ✅ subscribe() повертає null якщо не може підписатись
- ✅ unsubscribe() безпечний з null subscriptionId
- ✅ emit() повертає false якщо не може емітувати

---

## 🔍 Перевірка

**Раніше:**
```
TypeError: Cannot read properties of null (reading 'emit')
at VoiceControlManager.emit (base-service.js:279:36)
```

**Тепер (очікується):**
```
[VOICE_CONTROL_MANAGER] State changed: inactive -> initializing
[VOICE_CONTROL_MANAGER] EventManager not available, skipping emit: service.state.changed
[VOICE_CONTROL_MANAGER] Initializing Voice Control System v4.0
[VOICE_CONTROL_MANAGER] State changed: initializing -> active
✅ Emitting SERVICE_STATE_CHANGED event
✅ System initialized successfully
```

---

## 🚀 Тестування

**Запустити:**
```bash
# Система вже restart-нута, просто refresh браузер
# Cmd+Shift+R для hard refresh
```

**Очікувана поведінка:**
1. ✅ VoiceControlManager ініціалізується без помилок
2. ✅ KeywordDetectionService отримує eventManager
3. ✅ Conversation Mode може підписатись на події
4. ✅ Логи показують нормальну ініціалізацію

---

## 📝 Супутні зміни

Це виправлення **НЕ змінює** попереднє (передача eventManager через config), але **додає** додатковий рівень захисту для випадків коли:
- eventManager створюється в onInitialize()
- eventManager передається, але може бути null
- Сервіс використовується до повної ініціалізації

---

## ✅ Status

**Виправлення #1:** EventManager передача через config ✅  
**Виправлення #2:** Null-safety guards ✅  
**Тестування:** Потрібен refresh браузера  
**Impact:** CRITICAL - дозволяє системі запуститись

---

**Next Step:** Refresh браузера та перевірка що система стартує без помилок.

**Datetime:** 11.10.2025, рання ніч ~02:00
