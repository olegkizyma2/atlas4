# TODO-WEB-001: TTS_COMPLETED Event Name Mismatch Fix

**Date:** 11 жовтня 2025  
**Time:** ~16:40  
**Status:** ✅ FIXED - Event name mismatch corrected

---

## 🎯 Problem

**Symptom:** Conversation loop НЕ працює після TTS completion - handleTTSCompleted() NEVER called.

**Root Cause Found:**
```javascript
// app-refactored.js ЕМІТУВАВ:
eventManager.emit('TTS_COMPLETED', {...});  // String literal

// event-handlers.js ПІДПИСУВАВСЯ НА:
this.subscribe('TTS_COMPLETED', ...);  // String literal

// АЛЕ Events.TTS_COMPLETED =
Events.TTS_COMPLETED: 'tts.completed'  // РІЗНА СТРІНГА!
```

**Evidence from Logs:**
```
[EventManager] 📤 Emitting TTS_COMPLETED: {listenersCount: 0, wildcardCount: 0}
```

`listenersCount: 0` означає що **НЕМАЄ підписок** на event 'TTS_COMPLETED', бо subscription була на Events constant ('tts.completed').

---

## 🔍 Investigation Process

### 1. Initial Suspicion
- handleTTSCompleted() has console.log → NOT in user logs → handler NEVER called

### 2. Debug Logs Added
- ✅ app-refactored.js - emission logging
- ✅ event-manager.js - TTS_COMPLETED emission tracking
- ✅ conversation-mode-manager.js - subscription verification

### 3. Key Discovery
User logs показали:
```
[16:34:35] [CONVERSATION_EVENTS] [INFO] ✅ Subscribed to 11 events
```
→ Subscription ВІДБУЛАСЬ

```
[16:35:45] [EventManager] 📤 Emitting TTS_COMPLETED: {listenersCount: 0}
```
→ Але listeners НЕ знайдено!

### 4. Root Cause
Event name mismatch:
- **Emission**: String literal `'TTS_COMPLETED'`
- **Subscription**: String literal `'TTS_COMPLETED'` в event-handlers.js
- **Events constant**: `Events.TTS_COMPLETED = 'tts.completed'` (ІНША стрінга!)

Problem: event-handlers.js comment казав "Глобальна подія від app-refactored.js" але використовував string literal замість Events константи.

---

## 🛠️ Solution

### File 1: app-refactored.js

**Before:**
```javascript
eventManager.emit('TTS_COMPLETED', {
  timestamp: Date.now(),
  mode: mode,
  isInConversation: isInConversation,
  agent: data?.agent || 'atlas'
});
```

**After:**
```javascript
// CRITICAL: Використовуємо Events.TTS_COMPLETED ('tts.completed'), НЕ string literal!
eventManager.emit(VoiceEvents.TTS_COMPLETED, {
  timestamp: Date.now(),
  mode: mode,
  isInConversation: isInConversation,
  agent: data?.agent || 'atlas'
});
```

---

### File 2: event-handlers.js

**Before:**
```javascript
this.subscribe(
  'TTS_COMPLETED',  // Глобальна подія від app-refactored.js
  this.handleTTSCompleted.bind(this)
);
```

**After:**
```javascript
this.subscribe(
  Events.TTS_COMPLETED,  // 'tts.completed' - КРИТИЧНО: той самий event!
  this.handleTTSCompleted.bind(this)
);
```

---

## ✅ Result

Тепер ОБИДВА файли використовують `Events.TTS_COMPLETED` ('tts.completed'):
- ✅ Emission: `VoiceEvents.TTS_COMPLETED` (alias для Events.TTS_COMPLETED)
- ✅ Subscription: `Events.TTS_COMPLETED`
- ✅ Обидва резолвляться в `'tts.completed'`

**Expected After Fix:**
```
[CONVERSATION] 🔊 TTS_COMPLETED event received! {isInConversation: true, ...}
[CONVERSATION_MODE] 🔊 Atlas finished speaking (chat mode) - starting continuous listening
[CONVERSATION_MODE] 🎤 Started conversation recording
```

---

## 📋 Files Changed

1. **web/static/js/app-refactored.js** (Line ~457)
   - Changed: `'TTS_COMPLETED'` → `VoiceEvents.TTS_COMPLETED`

2. **web/static/js/voice-control/conversation/event-handlers.js** (Line ~108)
   - Changed: `'TTS_COMPLETED'` → `Events.TTS_COMPLETED`

3. **web/static/js/voice-control/events/event-manager.js**
   - Removed debug logs

4. **web/static/js/voice-control/conversation-mode-manager.js**
   - Removed debug logs

---

## 🎯 Lesson Learned

**CRITICAL RULE:** ЗАВЖДИ використовуйте Events константи, НІКОЛИ string literals!

**Bad:**
```javascript
eventManager.emit('TTS_COMPLETED', {...});
eventManager.on('TTS_COMPLETED', ...);
```

**Good:**
```javascript
eventManager.emit(Events.TTS_COMPLETED, {...});
eventManager.on(Events.TTS_COMPLETED, ...);
```

---

**Status:** ✅ FIXED - Ready for testing  
**Last Updated:** 11.10.2025 ~16:45
