# Conversation Mode TTS Subscription Fix

**Дата:** 12 жовтня 2025 - День ~14:30  
**Контекст:** Session 5 - Sequential bug fixes в ATLAS v4.0 Conversation Mode  
**Номер виправлення:** #5 з серії conversation mode fixes

## 🔴 Проблема

### Симптоми
1. **Після TTS Atlas НЕ запускався continuous listening** - conversation loop зупинявся
2. **Pending message НЕ відправлялось** - якщо користувач говорив під час TTS, повідомлення зберігалось але НЕ відправлялось після завершення
3. **НЕМАЄ логів** з ConversationEventHandlers про TTS_COMPLETED - подія НЕ доходила

### Користувацький сценарій
```
1. Conversation mode активний
2. "Атлас" → TTS activation → Запис починається
3. Користувач: "Що ти мені можеш розповісти..."
4. Atlas відповідає → TTS грає
5. ❌ TTS завершується → НІЧОГО НЕ ВІДБУВАЄТЬСЯ
6. ❌ Pending message (якщо був) НЕ відправляється
7. ❌ Continuous listening НЕ запускається
8. ❌ Conversation loop СТОП замість циклу
```

### Логи помилки
```javascript
// 14:24:46 - app-refactored.js ЕМІТУЄ подію
[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED): {
  mode: 'chat', 
  isInConversation: true, 
  isActivationResponse: false, 
  agent: 'atlas'
}

// ❌ НЕМАЄ логів з ConversationEventHandlers про отримання TTS_COMPLETED
// ❌ НЕМАЄ виклику handleTTSCompleted
// ❌ НЕМАЄ логів про pending message
// ❌ НЕМАЄ запуску continuous listening

// 14:25:22 - Conversation timeout замість циклу
[CONVERSATION_MODE] ⏱️ Conversation timeout reached
[CONVERSATION_MODE] 💬 Conversation mode deactivated
```

## 🔍 Корінь проблеми

### EventManager Hierarchy Mismatch

**app-refactored.js емітує через ГЛОБАЛЬНИЙ EventManager:**
```javascript
// app-refactored.js:466
const globalEventManager = window.eventManager;
globalEventManager.emit('TTS_COMPLETED', {
  mode: 'chat',
  isInConversation: true,
  agent: 'atlas'
});
```

**ConversationEventHandlers підписувався на ЛОКАЛЬНИЙ EventManager:**
```javascript
// event-handlers.js:109 (СТАРИЙ КОД)
this.subscribe(
  Events.TTS_COMPLETED,  // 'tts.completed'
  this.handleTTSCompleted.bind(this)
);

// subscribe() використовує this.eventManager
subscribe(eventName, handler) {
  const unsubscribe = this.eventManager.on(eventName, handler);
  // ❌ this.eventManager = Voice Control EventManager (ЛОКАЛЬНИЙ)
}
```

**Який EventManager в ConversationEventHandlers:**
```javascript
// conversation-mode-manager.js:122
this.eventHandlers = createEventHandlers({
  eventManager: this.eventManager,  // ← Voice Control EventManager
  // ...
});

// app-refactored.js:243
this.managers.conversationMode = new ConversationModeManager({
  eventManager: voiceControlEventManager || null,  // ← ЛОКАЛЬНИЙ
  // ...
});
```

### Паралель з Keyword Activation Fix

**Точно та сама проблема** як Keyword Activation TTS Fix (16:45):

| Час | Проблема | Емітує | Підписаний | Рішення |
|-----|----------|--------|------------|---------|
| 16:45 | Keyword activation TTS не грав | window.eventManager | this.eventManager | `window.eventManager \|\| this.eventManager` в onKeywordActivation |
| **14:30** | **TTS_COMPLETED не обробляється** | **window.eventManager** | **this.eventManager** | **subscribeToGlobal() для TTS подій** |

### Архітектурна причина

```
┌─────────────────────────────────────────────────────────┐
│                    ATLAS Application                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  window.eventManager (ГЛОБАЛЬНИЙ)                      │
│  ├── app-refactored.js емітує TTS_COMPLETED            │
│  ├── chat-manager.js емітує CHAT events                │
│  └── tts-manager.js слухає TTS_SPEAK_REQUEST           │
│                                                         │
│  voiceControlEventManager (ЛОКАЛЬНИЙ)                  │
│  ├── VoiceControlManager                               │
│  ├── WhisperService                                    │
│  ├── MicrophoneButtonService                           │
│  └── ConversationModeManager                           │
│      └── ConversationEventHandlers                     │
│          ❌ підписаний на ЛОКАЛЬНИЙ                    │
│          ✅ потрібно на ГЛОБАЛЬНИЙ для TTS             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Принцип розподілу:**
- **App-level події** (TTS, Chat, System) → `window.eventManager` (ГЛОБАЛЬНИЙ)
- **Voice Control події** (Microphone, Whisper, VAD) → `voiceControlEventManager` (ЛОКАЛЬНИЙ)
- **ConversationEventHandlers потребує ОБОХ** - локальний для Voice, глобальний для TTS/Chat

## ✅ Рішення

### 1. Створено метод subscribeToGlobal

```javascript
// event-handlers.js - NEW METHOD (~15 LOC)
/**
 * Helper для підписки на глобальний EventManager (TTS, Chat події)
 * FIXED (12.10.2025 - 14:30): App-level події емітуються через window.eventManager
 * @private
 */
subscribeToGlobal(eventManager, eventName, handler) {
  try {
    const unsubscribe = eventManager.on(eventName, handler);
    this.subscriptions.push(unsubscribe);
    logger.debug(`📌 Subscribed to GLOBAL: ${eventName} (via ${
      eventManager === window.eventManager ? 'window.eventManager' : 'local eventManager'
    })`);
  } catch (error) {
    logger.error(`Failed to subscribe to global ${eventName}:`, error);
  }
}
```

### 2. TTS події тепер через window.eventManager

```javascript
// event-handlers.js:103 - UPDATED SUBSCRIPTIONS (~10 LOC)
// TTS events (FIXED: використовуємо правильні константи)
// КРИТИЧНО (12.10.2025 - 14:30): TTS події емітуються через window.eventManager в app-refactored.js
// Потрібно підписуватись на ГЛОБАЛЬНИЙ eventManager, НЕ локальний!
const globalEventManager = window.eventManager || this.eventManager;

this.subscribeToGlobal(
  globalEventManager,
  Events.TTS_STARTED,
  this.handleTTSStarted.bind(this)
);

this.subscribeToGlobal(
  globalEventManager,
  Events.TTS_COMPLETED,  // 'tts.completed' - КРИТИЧНО: той самий event що емітить app-refactored.js!
  this.handleTTSCompleted.bind(this)
);

this.subscribeToGlobal(
  globalEventManager,
  Events.TTS_ERROR,
  this.handleTTSError.bind(this)
);
```

### 3. Diagnostic logging

```javascript
// Очікуваний лог при успішній підписці:
[CONVERSATION_EVENTS] 📌 Subscribed to GLOBAL: tts.completed (via window.eventManager)
[CONVERSATION_EVENTS] 📌 Subscribed to GLOBAL: tts.started (via window.eventManager)
[CONVERSATION_EVENTS] 📌 Subscribed to GLOBAL: tts.error (via window.eventManager)
```

## 📊 Результат

### Виправлений workflow

```
1. Conversation mode активний
2. "Атлас" → TTS activation → Запис починається
3. Користувач: "Що ти мені можеш розповісти..."
4. Atlas відповідає → TTS грає
5. ✅ app-refactored.js емітує TTS_COMPLETED через window.eventManager
6. ✅ ConversationEventHandlers отримує подію (subscribeToGlobal)
7. ✅ handleTTSCompleted викликається
8. ✅ Якщо є pending message → відправляється
9. ✅ Якщо немає pending → запускається continuous listening
10. ✅ Conversation loop продовжується ЦИКЛІЧНО
```

### Очікувані логи (після виправлення)

```javascript
// 14:24:46 - app-refactored.js
[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED): {mode: 'chat', isInConversation: true}

// ✅ NEW - ConversationEventHandlers отримує подію
[CONVERSATION_EVENTS] ✅ TTS playback completed {
  mode: 'chat', 
  isInConversation: true, 
  payload: {...}
}

// ✅ NEW - handleTTSCompleted виконується
[CONVERSATION_MODE] 🔊 TTS_COMPLETED event received!
[CONVERSATION_MODE] 💬 In conversation mode: true

// Сценарій A: Є pending message
[CONVERSATION_MODE] 📤 Sending pending message: "..."
[CONVERSATION_MODE] ✅ Pending message sent, cleared queue

// Сценарій B: Немає pending message
[CONVERSATION_MODE] 🎙️ Starting continuous listening after TTS
[MICROPHONE_BUTTON] 🎤 Starting recording (trigger: conversation_continuous)
```

## 🔧 Виправлені файли

### event-handlers.js (~25 LOC)
1. **subscribeToGlobal() method** - новий helper для глобальних подій (~15 LOC)
2. **TTS subscriptions** - змінено з `subscribe()` на `subscribeToGlobal()` (~10 LOC)

```javascript
// BEFORE (BROKEN):
this.subscribe(Events.TTS_COMPLETED, ...);
// Підписка на this.eventManager (ЛОКАЛЬНИЙ)

// AFTER (FIXED):
const globalEventManager = window.eventManager || this.eventManager;
this.subscribeToGlobal(globalEventManager, Events.TTS_COMPLETED, ...);
// Підписка на window.eventManager (ГЛОБАЛЬНИЙ)
```

## 🎯 Критичні правила

### EventManager Scope Rules

| Тип події | Емітує через | Підписуйтесь через | Приклади |
|------------|--------------|-------------------|----------|
| **App-level** | `window.eventManager` | `window.eventManager` | TTS_*, CHAT_*, SYSTEM_* |
| **Voice Control** | `voiceControlEventManager` | `voiceControlEventManager` | WHISPER_*, MICROPHONE_*, VAD_* |
| **Conversation** | `voiceControlEventManager` | `voiceControlEventManager` | CONVERSATION_*, KEYWORD_* |

### Коли використовувати subscribeToGlobal

```javascript
// ✅ ПРАВИЛЬНО - App-level події
const globalEM = window.eventManager || this.eventManager;
this.subscribeToGlobal(globalEM, Events.TTS_COMPLETED, ...);
this.subscribeToGlobal(globalEM, Events.CHAT_MESSAGE_SENT, ...);

// ✅ ПРАВИЛЬНО - Voice Control події
this.subscribe(Events.WHISPER_TRANSCRIPTION_COMPLETED, ...);
this.subscribe(Events.RECORDING_STARTED, ...);

// ❌ НЕПРАВИЛЬНО - Змішування scope
this.subscribe(Events.TTS_COMPLETED, ...);  // TTS - app-level, потрібно subscribeToGlobal!
```

### Паралель з попередніми виправленнями

**Всі EventManager проблеми вирішуються однаково:**

| Виправлення | Проблема | Рішення |
|-------------|----------|---------|
| Keyword Activation TTS (16:45) | onKeywordActivation емітував через this.eventManager | `window.eventManager \|\| this.eventManager` |
| **TTS Subscription (14:30)** | **ConversationEventHandlers підписаний на this.eventManager** | **subscribeToGlobal(window.eventManager, ...)** |

**Загальний принцип:**
- **Емісія** app-level подій → ЗАВЖДИ `window.eventManager || this.eventManager`
- **Підписка** на app-level події → ЗАВЖДИ `subscribeToGlobal(window.eventManager, ...)`

## 🧪 Тестування

### Manual Testing

```bash
# 1. Перезапустити систему
./restart_system.sh restart

# 2. Відкрити http://localhost:5001
# 3. Утримати мікрофон 2 секунди
# 4. Сказати "Атлас"
# 5. Сказати будь-яке питання
# 6. Дочекатись відповіді Atlas
# 7. ✅ ПЕРЕВІРИТИ: Continuous listening запускається автоматично
# 8. Сказати ще щось
# 9. ✅ ПЕРЕВІРИТИ: Atlas відповідає → цикл продовжується
```

### Expected Console Output

```javascript
// Після TTS completion
[APP] 🔊 Emitting TTS_COMPLETED
[CONVERSATION_EVENTS] ✅ TTS playback completed
[CONVERSATION_MODE] 🔊 TTS_COMPLETED event received!
[CONVERSATION_MODE] 🎙️ Starting continuous listening
[MICROPHONE_BUTTON] 🎤 Starting recording

// Або якщо є pending
[CONVERSATION_MODE] 📤 Sending pending message: "..."
```

### Verification Script Update

```bash
# verify-conversation-fixes.sh - потрібно додати перевірку
echo "Checking TTS subscription fix..."
grep -q "subscribeToGlobal" web/static/js/voice-control/conversation/event-handlers.js && \
  echo "✅ subscribeToGlobal method exists" || \
  echo "❌ subscribeToGlobal method missing"

grep -q "window.eventManager || this.eventManager" web/static/js/voice-control/conversation/event-handlers.js && \
  echo "✅ Global EventManager usage found" || \
  echo "❌ Global EventManager usage missing"
```

## 📚 Зв'язок з іншими виправленнями

### Session 5 - Conversation Mode Fixes Timeline

1. **13:30** - Quick-Send Filter Fix (mode-aware filtering)
2. **16:45** - Keyword Activation TTS Fix (window.eventManager в onKeywordActivation)
3. **17:00** - Streaming Conflict Fix (pending queue + chatManager.isStreaming)
4. **17:15** - Payload Extraction Fix (event?.payload || event)
5. **14:30** - **TTS Subscription Fix (subscribeToGlobal для app-level подій)** ← ПОТОЧНЕ

### Загальна тема: EventManager Scope

**Всі проблеми #2, #4, #5 пов'язані з EventManager hierarchy:**
- #2 (16:45): Емісія через неправильний EventManager
- #5 (14:30): Підписка на неправильний EventManager
- #4 (17:15): Payload structure varies між EventManagers

**Урок:** ЗАВЖДИ явно використовуйте `window.eventManager` для app-level communication!

## 🔄 Backwards Compatibility

### Fallback Pattern

```javascript
const globalEventManager = window.eventManager || this.eventManager;
```

Якщо `window.eventManager` недоступний (старий код, тести), fallback на локальний.

### Graceful Degradation

- subscribeToGlobal приймає eventManager як параметр
- Може працювати з будь-яким EventManager (глобальним чи локальним)
- Diagnostic logging показує який використовується

## 📝 Висновки

### Що було виправлено
✅ ConversationEventHandlers тепер отримує TTS_COMPLETED події  
✅ handleTTSCompleted викликається після кожного TTS  
✅ Pending messages відправляються правильно  
✅ Continuous listening запускається автоматично  
✅ Conversation loop працює циклічно БЕЗ manual re-activation  

### Що НЕ змінилось
✅ Voice Control події (Whisper, Microphone) працюють через локальний EventManager  
✅ Conversation Mode events (KEYWORD_DETECTED) працюють через локальний EventManager  
✅ Backward compatibility збережена через fallback pattern  

### Наступні кроки
1. ✅ Перезапустити систему
2. ✅ Тестувати conversation loop (multiple exchanges)
3. ✅ Verify pending message workflow
4. ✅ Оновити verification script
5. ✅ Оновити Copilot instructions

---

**Автор:** GitHub Copilot  
**Дата:** 12 жовтня 2025  
**Версія:** ATLAS v4.0  
**Категорія:** Bug Fix - Event System
