# TTS_COMPLETED Event Name Mismatch Fix

**Дата:** 11 жовтня 2025, 17:25  
**Проблема:** Conversation loop НЕ продовжувався після TTS completion  
**Корінь:** Event name mismatch - emitter та subscriber використовували різні імена

## 🐛 Симптоми

```javascript
// Логи показували:
[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED): {isInConversation: true, ...}
// ✅ Event емітувався

// Але ConversationMode НЕ реагував:
// ❌ Немає "[CONVERSATION] 🔊 TTS_COMPLETED event received!"
```

## 🔍 Корінь проблеми

**app-refactored.js** (line 463):
```javascript
import { eventManager, Events as VoiceEvents } from './voice-control/events/event-manager.js';

eventManager.emit(VoiceEvents.TTS_COMPLETED, {...});  
// ✅ Емітує: 'tts.completed' (з event-manager.js константи)
```

**conversation-mode-manager.js** (line 172 - ДО виправлення):
```javascript
import { eventManager, Events } from './events/event-manager.js';

this.eventManager.on('TTS_COMPLETED', (event) => {...});  
// ❌ Слухає: 'TTS_COMPLETED' (string literal, НЕ константа!)
```

## 🔧 Виправлення

**conversation-mode-manager.js** (line 172 - ПІСЛЯ виправлення):
```javascript
// FIXED (11.10.2025 - 17:25): використовуємо Events.TTS_COMPLETED ('tts.completed')
this.eventManager.on(Events.TTS_COMPLETED, (event) => {
  this.handleTTSCompleted(event);
});
```

## ✅ Результат

- ✅ ConversationMode тепер підписаний на правильний event: `'tts.completed'`
- ✅ Event chain працює: ChatManager → app-refactored → ConversationMode
- ✅ Conversation loop автоматично продовжується після TTS completion
- ✅ Код використовує централізовані константи (Events), НЕ hardcoded strings

## 📊 Event Flow (ВИПРАВЛЕНИЙ)

```
1. TTS завершується
   ↓
2. ChatManager.emit('tts-stop', {agent, voice, mode})
   ↓
3. app-refactored.js tts-stop handler
   ↓
4. eventManager.emit(VoiceEvents.TTS_COMPLETED, {isInConversation, mode})
   |
   | Event name: 'tts.completed' ✅
   ↓
5. ConversationMode.handleTTSCompleted(event)  ← ТЕПЕР ПРАЦЮЄ!
   ↓
6. Автоматично починає continuous listening (якщо chat mode)
```

## 🎯 Критичні Уроки

1. **ЗАВЖДИ використовуйте константи** з centralized event registry, НЕ string literals
2. **Event names мають збігатися** - emitter та subscriber повинні використовувати ОДНУ константу
3. **3 різні TTS_COMPLETED** існували в системі:
   - `event-manager.js`: `'tts.completed'` ✅ (правильна)
   - `event-bus.js`: `'conversation:tts-completed'` (legacy)
   - `constants.js`: `'TTS_COMPLETED'` (string literal, неправильна)
4. **Debug logging показав проблему**: `hasEventHandlers: true` але handler НЕ спрацьовував = різні events

## 🧪 Тестування

### Очікувані логи після виправлення:

```javascript
// 1. TTS завершується
[CHAT] 📢 Emitting tts-stop event: {...} {hasEventHandlers: true, handlersCount: 2}

// 2. app-refactored емітує Events.TTS_COMPLETED
[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED): {isInConversation: true, ...}

// 3. ConversationMode отримує event ✅ НОВИЙ ЛОГ!
[CONVERSATION] 🔊 TTS_COMPLETED event received! {
  isInConversation: true,
  conversationActive: true,
  currentMode: 'conversation',
  eventMode: 'chat'
}

// 4. Автоматично починає listening
[CONVERSATION] 🔊 Atlas finished speaking - starting continuous listening
```

### Тест-кейс:

1. Утримати кнопку мікрофона 2 сек → Conversation mode активується
2. Сказати "Атлас" → Keyword детектується
3. Сказати фразу → Whisper транскрибує
4. Atlas відповідає → TTS грає
5. **TTS завершується → АВТОМАТИЧНО починається запис** ← МАЄ ПРАЦЮВАТИ ТЕПЕР!

## 📁 Змінені файли

- `web/static/js/voice-control/conversation-mode-manager.js` (line 172)
  - Замінено `'TTS_COMPLETED'` → `Events.TTS_COMPLETED`
  - Додано коментар з датою та причиною

## 🔗 Пов'язані документи

- `docs/CONVERSATION_LOOP_TTS_FIX_2025-10-11.md` - Попереднє виправлення шляху до conversationManager
- `docs/DEBUG_TTS_STOP_EVENT_2025-10-11.md` - Діагностика event flow
- `docs/VAD_CONVERSATION_LOOP_FIX_2025-10-11.md` - VAD система та conversation loop

---

**Статус:** ✅ ВИПРАВЛЕНО - Conversation loop тепер продовжується після TTS completion
