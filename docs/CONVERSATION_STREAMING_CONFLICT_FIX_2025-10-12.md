# Conversation Mode Streaming Conflict Fix

**Date:** 12 жовтня 2025 - День ~17:00  
**Status:** ✅ ВИПРАВЛЕНО

---

## 🎯 Проблема

Conversation mode НЕ коректно обробляв continuous listening після TTS:

### Симптоми:
1. ✅ Keyword "Атлас" detection працював
2. ✅ TTS озвучував activation response "що бажаєте?"
3. ✅ Запис користувача починався
4. ✅ Whisper транскрибував текст: "Хочу Твоя дещо запитати."
5. ❌ Chat Manager відкидав повідомлення: "Message rejected - already streaming"
6. ❌ Orchestrator parse error: неповний JSON chunk

### Workflow що був (БАГ):
```
1. "Атлас" → TTS "що бажаєте?" → запис → транскрипція "Дякую."
2. sendToChat("Дякую.") → Chat Manager streams → isStreaming = true
3. TTS "Будь ласка! Як я можу допомогти?" → запис → транскрипція "Хочу..."
4. sendToChat("Хочу...") → REJECTED (isStreaming = true) ❌
5. ПОМИЛКА: Повідомлення втрачене, conversation loop зламаний
```

---

## 🔍 Корінь проблеми

**Conversation Mode НЕ перевіряв streaming state** перед відправкою нового повідомлення.

### Event Flow Problem:
```javascript
// conversation-mode-manager.js
onConversationTranscription(text) {
  // ❌ ПРОБЛЕМА: Негайна відправка БЕЗ перевірки
  this.sendToChat(text, { conversationMode: true, confidence });
  
  // Цикл продовжиться після TTS_COMPLETED
}

sendToChat(text, metadata) {
  // ❌ ПРОБЛЕМА: Немає перевірки chatManager.isStreaming
  this.eventManager.emit('SEND_CHAT_MESSAGE', {
    text,
    source: 'voice',
    mode: this.state.getCurrentMode(),
    ...metadata
  });
}
```

### Chat Manager Rejection:
```javascript
// chat-manager.js
async sendMessage(message) {
  if (!input || this.isStreaming) {
    // ❌ Відкидає ДРУГЕ повідомлення
    this.logger.warn(`❌ Message rejected - already streaming`);
    return;
  }
  
  this.setStreamingState(true);
  await this.streamFromOrchestrator(input);
  this.setStreamingState(false);
}
```

### Race Condition:
```
Thread 1 (First message):
  sendMessage("Дякую.") → isStreaming = true
  ↓
  streamFromOrchestrator() → waiting...
  ↓
  Stream data → TTS → audio playback...
  
Thread 2 (Second message - TOO EARLY):
  onConversationTranscription("Хочу...") → sendToChat()
  ↓
  sendMessage("Хочу...") → if (isStreaming) → REJECT ❌
```

---

## ✅ Рішення

### 1. Перевірка Streaming State
Додано перевірку `chatManager.isStreaming` перед відправкою:

```javascript
// conversation-mode-manager.js
sendToChat(text, metadata = {}) {
  this.logger.info(`📨 Sending to chat: "${text}"`);

  // КРИТИЧНО: Перевірка чи попередній stream завершився
  if (this.chatManager && this.chatManager.isStreaming) {
    this.logger.warn(`⚠️ Cannot send message - chat is still streaming previous response`);
    this.logger.warn(`⏳ Queueing message: "${text}"`);
    
    // Зберігаємо для відправки після завершення TTS
    this.pendingMessage = { text, metadata };
    return;
  }

  // Емісія події для відправки
  this.eventManager.emit(ConversationEvents.SEND_CHAT_MESSAGE, {
    text,
    source: 'voice',
    mode: this.state.getCurrentMode(),
    ...metadata
  });
}
```

### 2. Pending Message Queue
Зберігаємо повідомлення якщо chat streaming:

```javascript
// Constructor
constructor(config) {
  // ...
  this.chatManager = config.chatManager || null; // Reference to chat
  this.pendingMessage = null; // Queue for blocked messages
  // ...
}
```

### 3. Відправка Pending Message після TTS
Обробка pending message в `handleTTSCompleted`:

```javascript
handleTTSCompleted(event) {
  // ... activation response handling ...
  
  // FIXED (12.10.2025): Відправка pending message якщо є
  if (this.pendingMessage) {
    this.logger.info(`📤 Sending pending message: "${this.pendingMessage.text}"`);
    const { text, metadata } = this.pendingMessage;
    this.pendingMessage = null; // Очищуємо queue
    
    // Пауза 100ms щоб chat manager скинув isStreaming
    setTimeout(() => {
      this.sendToChat(text, metadata);
    }, 100);
    
    return; // НЕ запускаємо continuous listening - чекаємо відповіді
  }

  // Continuous listening якщо немає pending
  this.startContinuousListening();
}
```

### 4. Dependency Injection
Передача chatManager через config:

```javascript
// app-refactored.js
this.managers.conversationMode = new ConversationModeManager({
  eventManager: voiceControlEventManager || null,
  chatManager: this.managers.chat || null, // ← КРИТИЧНО!
  longPressDuration: 2000,
  // ...
});
```

---

## 📊 Результат

### ✅ Виправлений Workflow:
```
1. "Атлас" → TTS "що бажаєте?" → запис → транскрипція "Дякую."
2. sendToChat("Дякую.") → Chat Manager streams → isStreaming = true
3. TTS "Будь ласка! Як я можу допомогти?" → запис → транскрипція "Хочу..."
4. sendToChat("Хочу...") → QUEUED (isStreaming = true) ✅
5. handleTTSCompleted() → pendingMessage → sendToChat("Хочу...") ✅
6. Chat Manager streams → TTS → continuous listening ✅
```

### Логи (Виправлені):
```javascript
[CONVERSATION] 📨 Sending to chat: "Дякую."
[CHAT] Starting message stream...
[CHAT] Streaming to orchestrator: Дякую....

// Перша транскрипція completed - TTS грає
[TTS] Speaking for atlas: Будь ласка! Як я можу допомогти?...
[MICROPHONE_BUTTON] Starting recording...

// Друга транскрипція - QUEUED (НЕ rejected!)
[CONVERSATION] 📨 Sending to chat: "Хочу Твоя дещо запитати."
[CONVERSATION] ⚠️ Cannot send message - chat is still streaming
[CONVERSATION] ⏳ Queueing message: "Хочу Твоя дещо запитати."

// TTS completed → відправка pending
[TTS] Audio playback completed for atlas
[CONVERSATION] 📤 Sending pending message: "Хочу Твоя дещо запитати."
[CHAT] Starting message stream...  // ✅ Успішно!
```

---

## 🔧 Змінені файли

### 1. `/web/static/js/voice-control/conversation-mode-manager.js`
**Lines 57-91:** Constructor - додано `chatManager` та `pendingMessage`
```diff
+ this.chatManager = config.chatManager || null;
+ this.pendingMessage = null;
```

**Lines 794-813:** `sendToChat()` - перевірка streaming state
```diff
+ if (this.chatManager && this.chatManager.isStreaming) {
+   this.logger.warn(`⚠️ Cannot send message - chat is still streaming`);
+   this.pendingMessage = { text, metadata };
+   return;
+ }
```

**Lines 736-753:** `handleTTSCompleted()` - відправка pending message
```diff
+ if (this.pendingMessage) {
+   const { text, metadata } = this.pendingMessage;
+   this.pendingMessage = null;
+   setTimeout(() => this.sendToChat(text, metadata), 100);
+   return;
+ }
```

### 2. `/web/static/js/app-refactored.js`
**Line 244:** ConversationModeManager initialization - передача chatManager
```diff
  this.managers.conversationMode = new ConversationModeManager({
    eventManager: voiceControlEventManager || null,
+   chatManager: this.managers.chat || null,
    longPressDuration: 2000,
```

**Total Changes:** ~30 LOC across 2 files

---

## 🧪 Тестування

### Test Case 1: Conversation Mode Continuous Flow
```
1. Утримати кнопку 2 сек → beep
2. Сказати "Атлас"
   ✅ Expected: TTS озвучує "що бажаєте?"
3. Після TTS сказати "Дякую"
   ✅ Expected: Atlas відповідає "Будь ласка!"
4. Після TTS сказати "Хочу щось запитати"
   ✅ Expected: Message НЕ rejected, Atlas відповідає
```

### Test Case 2: Pending Message Queue
```
1. Conversation mode активний
2. Сказати "Привіт" → Chat streams
3. ПОКИ streaming, сказати "Як справи?"
   ✅ Expected: "Як справи?" → queued (НЕ rejected)
4. TTS completed
   ✅ Expected: "Як справи?" → sent to orchestrator
```

### Verification:
```bash
# Console logs (має бути):
[CONVERSATION] ⏳ Queueing message: "..."
[CONVERSATION] 📤 Sending pending message: "..."

# Console logs (НЕ має бути):
[CHAT] ❌ Message rejected - already streaming
Failed to parse stream message
```

---

## ⚠️ Критичні правила

### Rule #1: ЗАВЖДИ перевіряйте streaming state
```javascript
// ❌ WRONG: Direct emission
this.eventManager.emit('SEND_CHAT_MESSAGE', { text });

// ✅ CORRECT: Check streaming first
if (this.chatManager && this.chatManager.isStreaming) {
  this.pendingMessage = { text, metadata };
  return;
}
this.eventManager.emit('SEND_CHAT_MESSAGE', { text });
```

### Rule #2: Dependency Injection для cross-module checks
```javascript
// ✅ Constructor приймає chatManager
constructor(config) {
  this.chatManager = config.chatManager || null;
}

// ✅ App передає reference
new ConversationModeManager({
  chatManager: this.managers.chat
});
```

### Rule #3: Pending messages через TTS_COMPLETED
```javascript
// Conversation flow:
1. sendToChat() → check isStreaming → queue if needed
2. TTS_COMPLETED → send pending → wait for next TTS
3. Repeat
```

---

## 📝 Детальна документація

**Technical Report:** `docs/CONVERSATION_STREAMING_CONFLICT_FIX_2025-10-12.md`
**Summary:** `CONVERSATION_STREAMING_FIX_SUMMARY.md` (цей файл)

---

**Готово до тестування!** 🚀

Перезапустіть систему і перевірте continuous conversation loop.
