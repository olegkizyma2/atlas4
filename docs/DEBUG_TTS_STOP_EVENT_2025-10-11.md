# Debug TTS-Stop Event - Conversation Loop

**Дата:** 11 жовтня 2025, ~17:40  
**Статус:** 🔍 DEBUGGING  
**Проблема:** Conversation loop НЕ продовжується після TTS

---

## 🐛 Симптом

Після завершення TTS озвучення Atlas, система **НЕ запускає** continuous listening автоматично.

**Логи користувача:**
```
[17:11:18] [MICROPHONE_BUTTON] Resuming microphone service after TTS
[17:11:18] [MICROPHONE_BUTTON] [WARN] Invalid state transition: idle -> processing
[17:11:18] [TTS] Notified orchestrator: TTS completed for atlas
```

**Відсутній лог:**
```javascript
// Очікуваний лог НЕ з'являється:
[APP] 🔊 Emitting TTS_COMPLETED (Events.TTS_COMPLETED): { isInConversation: true, ... }
```

---

## 🔍 Аналіз

### Перевірка #1: Чи правильний шлях до conversation manager?
✅ **ТАК** - Виправлено в попередньому fix:
```javascript
const conversationManager = this.managers.conversationMode;  // ✅ Правильно
```

### Перевірка #2: Чи правильно емітується event?
✅ **ТАК** - ChatManager емітує на рядку 522:
```javascript
this.emit('tts-stop', { agent, voice: ttsVoice, mode: mode || 'chat' });
```

### Перевірка #3: Чи є підписка на event?
✅ **ТАК** - app-refactored.js підписується на рядку 444:
```javascript
this.managers.chat.on('tts-stop', (data) => {
  // handler code
});
```

### ❓ Гіпотеза:
Event емітується, але handler **НЕ викликається**. Можливі причини:
1. Підписка відбувається **ПІСЛЯ** події (timing issue)
2. EventManager ChatManager НЕ працює правильно
3. Event name mismatch (`'tts-stop'` vs щось інше)

---

## ✅ Рішення: Debug Logging

Додано детальне логування в ChatManager для діагностики:

**Файл:** `web/static/js/modules/chat-manager.js`

```javascript
// CRITICAL (11.10.2025 - 17:40): Debug logging для conversation loop
const eventData = { agent, voice: ttsVoice, mode: mode || 'chat' };
console.log('[CHAT] 📢 Emitting tts-stop event:', eventData, {
  hasEventHandlers: this.eventHandlers.has('tts-stop'),
  handlersCount: this.eventHandlers.get('tts-stop')?.size || 0
});

this.emit('tts-stop', eventData);
```

---

## 🧪 Очікувані логи після fix:

### Якщо event емітується але handler НЕ підписаний:
```
[CHAT] 📢 Emitting tts-stop event: {agent: 'atlas', ...} 
  { hasEventHandlers: false, handlersCount: 0 }
```
→ **Проблема:** Підписка відсутня або відбулась пізно

### Якщо event емітується і handler підписаний:
```
[CHAT] 📢 Emitting tts-stop event: {agent: 'atlas', ...} 
  { hasEventHandlers: true, handlersCount: 1 }
[APP] 🔊 Emitting TTS_COMPLETED: { isInConversation: true, ... }
```
→ **ОК:** Event працює, перевіряємо чому conversation НЕ стартує

---

## 📝 Наступні кроки

1. ✅ Додано debug logging в ChatManager
2. ⏳ **TODO:** Перезапустити систему
3. ⏳ **TODO:** Протестувати conversation mode
4. ⏳ **TODO:** Перевірити логи в browser console
5. ⏳ **TODO:** Діагностувати на основі нових логів

---

**Тестування:** http://localhost:5001  
**Інструкції:** `./tests/test-vad-conversation.sh`
