# Keyword Activation Response Fix - 12.10.2025

## 🎯 Проблема

Коли користувач утримує мікрофон 2+ секунди (Conversation Mode) та каже "Атлас", система:
- ✅ Детектила keyword правильно
- ✅ Генерувала response ("що бажаєте?")
- ❌ **НЕ відправляла response в чат**
- ❌ **НЕ озвучувала response через TTS**
- ❌ **НЕ починала запис після детекції**

### Симптоми з логів:

```javascript
[WHISPER_KEYWORD] 🎯 KEYWORD DETECTED! Атлас Атлас
[WHISPER_KEYWORD] 🗣️ Generated response: що бажаєте?
🎯 Keyword detected: {
  transcript: 'Атлас Атлас',
  response: 'що бажаєте?',
  keyword: 'атлас',
  confidence: 0.95
}
```

**Результат:** Відповідь згенерована, але НЕ з'явилась у чаті і НЕ озвучилась.

---

## 🔍 Корінь проблеми

### 1. Response НЕ додавався до чату

У `conversation-mode-manager.js` метод `onKeywordActivation()` **тільки емітував** `TTS_SPEAK_REQUEST`, але **НЕ додавав** повідомлення в чат:

```javascript
// ❌ БУЛО (без додавання в чат):
async onKeywordActivation(activationResponse = null) {
  this.ui?.showStatus(activationResponse, 'activation');
  
  // Тільки TTS, БЕЗ додавання в чат!
  this.eventManager.emit('TTS_SPEAK_REQUEST', {
    text: activationResponse,
    agent: 'atlas',
    mode: 'conversation',
    isActivationResponse: true
  });
}
```

### 2. Chat Manager пропускав activation response

`chatManager.addMessage()` викликався **НЕ був**, тому:
- Повідомлення НЕ з'являлось у UI
- TTS НЕ запускався (через відсутність в chat workflow)

---

## ✅ Рішення

### 1. Додано addMessage в чат ПЕРЕД TTS

**Файл:** `web/static/js/voice-control/conversation-mode-manager.js`

**Зміна:** Додано виклик `chatManager.addMessage()` перед емісією `TTS_SPEAK_REQUEST`:

```javascript
// ✅ ВИПРАВЛЕНО (з додаванням в чат):
async onKeywordActivation(activationResponse = null) {
  if (!activationResponse) {
    activationResponse = 'слухаю';
  }

  this.ui?.showStatus(activationResponse, 'activation');

  // 🆕 КРИТИЧНО: Додаємо відповідь в чат ПЕРЕД TTS
  this.logger.info(`💬 Adding activation response to chat: "${activationResponse}"`);
  try {
    if (window.atlasApp?.chatManager) {
      window.atlasApp.chatManager.addMessage(activationResponse, 'atlas', {
        skipTTS: true // НЕ запускати TTS через chatManager (буде окремо)
      });
    }
  } catch (error) {
    this.logger.error('Failed to add activation response to chat', null, error);
  }

  // Озвучуємо через окремий TTS_SPEAK_REQUEST
  this.eventManager.emit('TTS_SPEAK_REQUEST', {
    text: activationResponse,
    agent: 'atlas',
    mode: 'conversation',
    priority: 'high',
    isActivationResponse: true
  });
}
```

---

## 🔄 Workflow після виправлення

### Conversation Mode Flow (правильний):

1. **Користувач:** Утримує мікрофон 2+ сек → Conversation Mode активується
2. **Система:** Запускає keyword detection (Whisper continuous listening)
3. **Користувач:** Каже "Атлас"
4. **Keyword Detection:** Розпізнає → генерує response ("що бажаєте?")
5. **🆕 ConversationModeManager:** 
   - Додає response в чат як повідомлення Atlas
   - Емітує `TTS_SPEAK_REQUEST`
6. **🆕 TTS Manager:** Отримує event → озвучує response
7. **TTS Completed:** Емітує `TTS_COMPLETED` з `isActivationResponse: true`
8. **ConversationModeManager:** Отримує `TTS_COMPLETED` → починає запис користувача
9. **Користувач:** Говорить команду → транскрипція → чат → Atlas відповідає
10. **Loop:** Після відповіді Atlas → знову keyword detection → repeat

---

## 🎯 Критичні правила

### 1. Activation Response ЗАВЖДИ додається в чат

```javascript
// ✅ ПРАВИЛЬНО:
chatManager.addMessage(activationResponse, 'atlas', { skipTTS: true });
this.eventManager.emit('TTS_SPEAK_REQUEST', { ... });

// ❌ НЕПРАВИЛЬНО (тільки TTS, без чату):
this.eventManager.emit('TTS_SPEAK_REQUEST', { ... });
```

### 2. skipTTS: true для activation response

Причина: TTS запускається через **окремий** `TTS_SPEAK_REQUEST` з прапорцем `isActivationResponse: true`, тому НЕ треба запускати його через `chatManager.addMessage()`.

### 3. isActivationResponse флаг

```javascript
{
  text: activationResponse,
  isActivationResponse: true // КРИТИЧНО для handleTTSCompleted()
}
```

Цей флаг дозволяє `handleTTSCompleted()` розрізнити:
- **Activation response** → після TTS починається запис користувача
- **Normal response** → після TTS цикл повторюється (keyword detection)

---

## 🧪 Тестування

### Очікувана поведінка:

1. **Утримати мікрофон 2+ сек** → Conversation Mode активується
2. **Сказати "Атлас"** → keyword detection спрацює
3. **Очікувати:**
   - ✅ У чаті з'явиться: `Atlas: що бажаєте?`
   - ✅ TTS озвучить: "що бажаєте?"
   - ✅ Після TTS → автоматично почнеться запис
4. **Сказати команду** (напр. "привіт") → транскрипція → чат → Atlas відповідає
5. **Після відповіді Atlas** → знову keyword detection (loop)

### Діагностика (у консолі):

```javascript
// Перевірка що response додався в чат:
💬 Adding activation response to chat: "що бажаєте?"

// Перевірка що TTS_SPEAK_REQUEST емітився:
🔊 Playing activation response: "що бажаєте?"
🔊 TTS_SPEAK_REQUEST received: "що бажаєте?" (agent: atlas, mode: conversation, activation: true)

// Перевірка що TTS відіграв:
[TTS] Speaking for atlas (mykyta): що бажаєте?...
[TTS] Audio playback completed for atlas

// Перевірка що запис почався:
🎙️ Starting conversation recording after TTS completion
🎙️ Starting conversation recording (trigger: keyword_activation)
```

---

## 📋 Виправлені файли

1. **`web/static/js/voice-control/conversation-mode-manager.js`**
   - Метод: `onKeywordActivation()`
   - Зміна: Додано `chatManager.addMessage()` перед `TTS_SPEAK_REQUEST`
   - Lines: ~477-520

---

## 🎓 Уроки

### 1. Activation response = частина UI workflow

Activation response ("що бажаєте?") НЕ просто TTS - це **частина розмови**, тому:
- ПОВИНЕН бути у чаті як повідомлення Atlas
- ПОВИНЕН озвучуватись через TTS
- ПОВИНЕН бути видимий користувачу

### 2. Подвійний workflow TTS

Є два способи запуску TTS:
- **Chat workflow:** `chatManager.addMessage()` → `chatManager.handleTTS()` → TTS
- **Direct workflow:** `TTS_SPEAK_REQUEST` → `ttsManager.speak()` → TTS

Для activation response використовуємо:
- Chat workflow для **додавання в UI**
- Direct workflow для **озвучення** (з `skipTTS: true` в chat)

### 3. Event-driven architecture

Conversation Mode працює через events:
- `KEYWORD_DETECTED` → `onKeywordActivation()`
- `TTS_SPEAK_REQUEST` → `ttsManager.speak()`
- `TTS_COMPLETED` → `handleTTSCompleted()` → `startConversationRecording()`

Кожен event повинен передавати **всю необхідну інформацію** для наступного кроку.

---

## 🔗 Пов'язані документи

- `docs/CONVERSATION_MODE_SYSTEM.md` - Архітектура Conversation Mode
- `docs/TTS_COMPLETED_EVENT_NAME_FIX_2025-10-11.md` - Виправлення event name
- `docs/CONVERSATION_LOOP_TTS_FIX_2025-10-11.md` - Виправлення TTS completion flow
- `docs/WHISPER_KEYWORD_DETECTION_2025-10-11.md` - Whisper keyword detection

---

**STATUS:** ✅ FIXED (12.10.2025 - ранок ~06:00)  
**IMPACT:** HIGH - Критичний workflow Conversation Mode  
**TESTED:** Очікує тестування після перезапуску системи
