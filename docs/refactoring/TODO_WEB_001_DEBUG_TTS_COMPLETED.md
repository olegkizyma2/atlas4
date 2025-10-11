# TODO-WEB-001: Debug TTS_COMPLETED Event Flow

**Date:** 11 жовтня 2025  
**Time:** ~16:30  
**Status:** 🔍 IN PROGRESS - Debugging event emission chain

---

## 🎯 Problem

**Symptom:** Conversation loop НЕ працює після TTS completion.

**User Report:**
> "Другий режим відреагував на слово атлас і відправив повідомлення, але після того як Атлас в режимі чата відповів, він мав проіграти ттс і включитися на запис користувача дальше"

**Expected Flow:**
```
Atlas responds → TTS plays → TTS_COMPLETED emitted 
→ handleTTS Completed() called → startContinuousListening() 
→ Auto-recording starts (NO keyword needed)
```

**Actual Behavior:**
- TTS plays successfully
- Microphone resumes
- **BUT**: NO auto-recording starts
- **Missing logs**: `[CONVERSATION] 🔊 TTS_COMPLETED event received!`

---

## 🔍 Investigation

### Evidence from User Logs

```
[16:25:33] [TTS] Audio playback completed for atlas
[16:25:33] [CHAT] ✅ TTS completed for atlas
[16:25:33] [MICROPHONE_BUTTON] Resuming microphone service after TTS

❌ MISSING: [CONVERSATION] 🔊 TTS_COMPLETED event received!
❌ MISSING: [CONVERSATION_MODE] 🔊 Atlas finished speaking (chat mode) - starting continuous listening
❌ MISSING: [CONVERSATION_MODE] 🔄 Starting continuous listening (no keyword needed)
❌ MISSING: [CONVERSATION_MODE] 🎤 Started conversation recording
```

### Key Finding

**handleTTSCompleted() NEVER executed** despite:
- ✅ Subscription exists: `this.eventManager.on('TTS_COMPLETED', ...)`
- ✅ Handler exists: `handleTTSCompleted(event) {...}`
- ✅ Handler has console.log at line 603
- ❌ Console.log NEVER appears in user logs

**Conclusion:** Event either NOT emitted OR NOT reaching subscription.

---

## 🛠️ Debug Changes

### 1. Event Manager Emission Debug

**File:** `web/static/js/voice-control/events/event-manager.js`

**Added:** Debug logging for TTS_COMPLETED emissions

```javascript
async emit(eventType, payload = null, options = {}) {
  const event = {
    type: eventType,
    payload,
    timestamp: new Date(),
    source: options.source || 'unknown'
  };

  // 🐛 DEBUG: Log TTS_COMPLETED emissions
  if (eventType === 'TTS_COMPLETED') {
    console.log('[EventManager] 📤 Emitting TTS_COMPLETED:', {
      event,
      listenersCount: this.listeners.get(eventType)?.size || 0,
      wildcardCount: this.wildcardListeners.size
    });
  }

  // ... rest of emit logic
}
```

**Purpose:** Verify if TTS_COMPLETED actually emitted and how many listeners subscribed.

---

### 2. App Emission Debug

**File:** `web/static/js/app-refactored.js`

**Added:** Debug logging in tts-stop handler

```javascript
this.managers.chat.on('tts-stop', (data) => {
  // CRITICAL: Передаємо mode та isInConversation для conversation loop
  const conversationManager = this.managers.voiceControl?.voiceControl?.services?.get?.('conversation');
  const isInConversation = conversationManager?.isConversationActive?.() || false;
  const mode = data?.mode || 'chat';

  console.log('[APP] 🔊 Emitting TTS_COMPLETED:', {
    mode,
    isInConversation,
    agent: data?.agent || 'atlas',
    data
  });

  eventManager.emit('TTS_COMPLETED', {
    timestamp: Date.now(),
    mode: mode,
    isInConversation: isInConversation,
    agent: data?.agent || 'atlas'
  });
});
```

**Purpose:** 
- Verify tts-stop handler called
- Check conversationManager exists
- Verify isInConversation value
- Confirm emit() executed

---

### 3. Subscription Debug

**File:** `web/static/js/voice-control/conversation-mode-manager.js`

**Added:** Debug logging in subscription

```javascript
// Завершення TTS
console.log('[CONVERSATION] 📌 Subscribing to TTS_COMPLETED on eventManager:', this.eventManager);
this.eventManager.on('TTS_COMPLETED', (event) => {
  console.log('[CONVERSATION] 📥 TTS_COMPLETED subscription FIRED!', event);
  this.handleTTSCompleted(event);
});
```

**Purpose:**
- Verify subscription happens during initialization
- Confirm which eventManager instance used
- See if subscription callback EVER fires

---

## 🧪 Testing Plan

### Test Scenario

1. Hold microphone button 2 seconds
2. Say "Атлас"
3. Say "Привіт"
4. Wait for TTS playback to complete
5. **Check console for debug logs**

### Expected Debug Output (if working)

```
✅ [APP] 🔊 Emitting TTS_COMPLETED: {mode: 'chat', isInConversation: true, agent: 'atlas'}
✅ [EventManager] 📤 Emitting TTS_COMPLETED: {event: {...}, listenersCount: 1}
✅ [CONVERSATION] 📥 TTS_COMPLETED subscription FIRED! {...}
✅ [CONVERSATION] 🔊 TTS_COMPLETED event received! {isInConversation: true, ...}
✅ [CONVERSATION_MODE] 🔊 Atlas finished speaking (chat mode) - starting continuous listening
✅ [CONVERSATION_MODE] 🎤 Started conversation recording
```

### Diagnostic Outcomes

**If only `[APP] 🔊 Emitting` appears:**
- Problem: tts-stop handler called but emit() fails
- Likely cause: eventManager issue

**If NO logs appear:**
- Problem: tts-stop handler NOT called
- Likely cause: chat-manager NOT emitting 'tts-stop'

**If `[EventManager] 📤` shows listenersCount: 0:**
- Problem: Subscription NOT registered
- Likely cause: Timing issue or different eventManager instance

**If subscription FIRED but NO handleTTSCompleted logs:**
- Problem: Handler execution fails
- Likely cause: Exception in handler logic

---

## 🎯 Root Cause Hypotheses

### Hypothesis 1: DI Container Chain Failure

```javascript
const conversationManager = this.managers.voiceControl?.voiceControl?.services?.get?.('conversation');
```

**Risk:** Deep optional chaining - any undefined breaks silently.

**Test:** Check if conversationManager is undefined in debug logs.

---

### Hypothesis 2: EventManager Instance Mismatch

**Risk:** Different eventManager instances for emit vs subscribe.

```javascript
// app-refactored.js
import { eventManager } from './voice-control/events/event-manager.js';

// conversation-mode-manager.js
this.eventManager = config.eventManager || eventManager;
```

**Test:** Compare eventManager objects in both debug logs.

---

### Hypothesis 3: Subscription Timing Issue

**Risk:** Subscription happens AFTER emission (race condition).

**Test:** Check if `[CONVERSATION] 📌 Subscribing` appears before `[APP] 🔊 Emitting`.

---

### Hypothesis 4: chat-manager NOT Emitting tts-stop

**Risk:** TTS completes but 'tts-stop' event NOT emitted.

**Test:** Check if `[APP] 🔊 Emitting` log appears at all.

---

## 📋 Next Steps

1. **Reload page** to apply debug changes
2. **Test conversation mode** (Атлас → speak → TTS)
3. **Analyze console output** to identify failure point
4. **Fix identified issue**:
   - DI container → verify chain
   - EventManager → ensure same instance
   - Timing → ensure subscription before emission
   - chat-manager → add tts-stop emission debug
5. **Verify conversation loop works**
6. **Remove debug logs** (or convert to conditional logging)
7. **Git commit** complete fix

---

## 📊 Progress

- ✅ Debug logs added (3 files)
- 🔄 Testing in progress
- ⏳ Root cause identification pending
- ⏳ Fix implementation pending
- ⏳ Verification pending

---

**Last Updated:** 11.10.2025 ~16:35  
**Status:** Ready for testing with debug logs
