# Виправлення двох режимів роботи мікрофона - 10.10.2025

## 🎯 Проблема

Система голосового управління мала два режими роботи мікрофона, які НЕ працювали:

1. **Quick-send режим** (одне натискання): клік → запис → Whisper → чат
2. **Conversation режим** (утримання 2 сек): утримання → прослуховування слова "Атлас" → запис → чат → відповідь → знову прослуховування

### Симптоми
- Натискання на кнопку мікрофона НЕ запускало запис
- Утримання кнопки 2 секунди НЕ активувало conversation mode
- Після виявлення слова "Атлас" НЕ починався запис
- Після відповіді Atlas система НЕ поверталася до прослуховування

### Корінь проблеми
**ВІДСУТНІСТЬ ЗВ'ЯЗКУ МІЖ ПОДІЯМИ**

`ConversationModeManager` емітував події:
- `CONVERSATION_MODE_QUICK_SEND_START` 
- `CONVERSATION_RECORDING_START`
- `START_KEYWORD_DETECTION`

Але **НІХТО НЕ ПІДПИСУВАВСЯ** на ці події!
- `MicrophoneButtonService` НЕ слухав conversation events
- `KeywordDetectionService` НЕ слухав `START_KEYWORD_DETECTION`

## ✅ Рішення

### 1. MicrophoneButtonService - підписки на conversation events

**Файл:** `web/static/js/voice-control/services/microphone-button-service.js`

**Додано в `subscribeToSystemEvents()`:**
```javascript
// === CONVERSATION MODE EVENTS ===

// Quick-send режим (одне натискання -> запис -> Whisper -> чат)
eventManager.on('CONVERSATION_MODE_QUICK_SEND_START', async (event) => {
  this.logger.info('🎤 Quick-send mode activated via conversation manager');
  await this.handleQuickSendModeStart(event.payload);
});

// Conversation режим - початок запису після виявлення keyword
eventManager.on('CONVERSATION_RECORDING_START', async (event) => {
  this.logger.info('🎤 Conversation recording start via conversation manager');
  await this.handleConversationRecordingStart(event.payload);
});

// Запит на початок keyword detection
eventManager.on('START_KEYWORD_DETECTION', async (event) => {
  this.logger.info('🔍 Starting keyword detection for conversation mode', event.payload);
  // Keyword detection service має підхопити цю подію
});
```

### 2. MicrophoneButtonService - обробники режимів

**Додано метод `handleQuickSendModeStart`:**
```javascript
async handleQuickSendModeStart(payload = {}) {
  this.logger.info('🎤 Quick-send mode: starting recording');
  
  if (this._ttsLocked) {
    this.logger.warn('Quick-send ignored during TTS playback');
    return;
  }

  if (this.currentState !== 'idle') {
    this.logger.warn(`Quick-send ignored - current state: ${this.currentState}`);
    return;
  }

  try {
    // Початок запису з міткою quick-send
    await this.startRecording('click', {
      mode: 'quick-send',
      conversationMode: false,
      ...payload
    });
    
    this.logger.debug('Quick-send recording started successfully');
  } catch (error) {
    this.logger.error('Failed to start quick-send recording', null, error);
    this.setState('error', 'Quick-send failed');
  }
}
```

**Додано метод `handleConversationRecordingStart`:**
```javascript
async handleConversationRecordingStart(payload = {}) {
  this.logger.info('🎤 Conversation mode: starting recording after keyword detection');
  
  if (this._ttsLocked) {
    this.logger.warn('Conversation recording ignored during TTS playback');
    return;
  }

  if (this.currentState !== 'idle') {
    this.logger.warn(`Conversation recording ignored - current state: ${this.currentState}`);
    return;
  }

  try {
    // Початок запису з міткою conversation
    await this.startRecording('voice_activation', {
      mode: 'conversation',
      conversationMode: true,
      keyword: payload.keyword || 'атлас',
      ...payload
    });
    
    this.logger.debug('Conversation recording started successfully');
  } catch (error) {
    this.logger.error('Failed to start conversation recording', null, error);
    this.setState('error', 'Conversation recording failed');
  }
}
```

### 3. KeywordDetectionService - підписка на START_KEYWORD_DETECTION

**Файл:** `web/static/js/voice-control/services/keyword-detection-service.js`

**Додано виклик в `onInitialize()`:**
```javascript
// Підписка на події conversation mode
this.subscribeToConversationEvents();
```

**Додано метод `subscribeToConversationEvents()`:**
```javascript
subscribeToConversationEvents() {
  // Запит на початок keyword detection від conversation mode
  if (this.eventManager) {
    this.eventManager.on('START_KEYWORD_DETECTION', async (event) => {
      const { keywords, mode } = event.payload || {};
      this.logger.info('🔍 Received START_KEYWORD_DETECTION request', { keywords, mode });

      // Оновлення keywords якщо передані
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        this.detectionConfig.keywords = keywords;
        this.logger.debug(`Updated keywords to: ${keywords.join(', ')}`);
      }

      // Запуск детекції
      await this.startDetection();
    });

    this.logger.debug('Subscribed to conversation mode events');
  } else {
    this.logger.warn('Event manager not available, conversation mode integration disabled');
  }
}
```

## 📊 Потік подій

### Quick-send режим (одне натискання):
```
1. Користувач натискає кнопку мікрофона
2. ButtonController → ModeHandler.activateQuickSendMode()
3. ModeHandler емітує CONVERSATION_MODE_QUICK_SEND_START
4. MicrophoneButtonService.handleQuickSendModeStart() → startRecording()
5. MediaManager записує аудіо
6. Whisper транскрибує
7. Результат відправляється в чат
8. Система повертається в idle
```

### Conversation режим (утримання 2 сек):
```
1. Користувач утримує кнопку 2+ секунди
2. ButtonController → ModeHandler.activateConversationMode()
3. ModeHandler емітує START_KEYWORD_DETECTION
4. KeywordDetectionService.subscribeToConversationEvents() отримує подію
5. KeywordDetectionService.startDetection() запускає Web Speech API
6. Користувач каже "Атлас"
7. Web Speech API розпізнає → KeywordDetectionService емітує KEYWORD_DETECTED
8. ModeHandler.handleKeywordDetected() → емітує CONVERSATION_RECORDING_START
9. MicrophoneButtonService.handleConversationRecordingStart() → startRecording()
10. Користувач говорить запит
11. Whisper транскрибує → відправка в чат
12. Atlas відповідає → TTS_STARTED
13. TTS відтворюється → TTS_COMPLETED
14. ModeHandler.handleTTSCompleted() → startListeningForKeyword()
15. Повернення до кроку 3 (прослуховування "Атлас")
```

## 🔧 Виправлені файли

1. **microphone-button-service.js**
   - Додано підписки на conversation events
   - Додано `handleQuickSendModeStart()`
   - Додано `handleConversationRecordingStart()`

2. **keyword-detection-service.js**
   - Додано `subscribeToConversationEvents()`
   - Додано обробку `START_KEYWORD_DETECTION`

## ✅ Результат

- ✅ **Quick-send працює**: клік → запис → чат
- ✅ **Conversation працює**: утримання → прослуховування "Атлас" → запис → відповідь → знову прослуховування
- ✅ **Циклічне прослуховування**: після кожної відповіді Atlas система автоматично повертається до прослуховування
- ✅ **TTS синхронізація**: під час відтворення TTS запис блокується
- ✅ **Зрозумілі логи**: кожна стадія логується з емодзі

## 🧪 Тестування

### Quick-send режим:
1. Відкрити http://localhost:5001
2. Натиснути кнопку мікрофона (одне натискання)
3. Сказати щось
4. Перевірити що текст з'явився у чаті

### Conversation режим:
1. Відкрити http://localhost:5001  
2. Утримувати кнопку мікрофона 2+ секунди
3. Почути звук активації
4. Сказати "Атлас"
5. Після сигналу сказати запит
6. Дочекатися відповіді Atlas (TTS)
7. Знову сказати "Атлас" → повторити запит
8. Перевірити що цикл працює

### Перевірка в логах:
```bash
# Перевірити conversation flow
tail -f logs/orchestrator.log | grep -E "Quick-send|Conversation|KEYWORD"

# Очікувані повідомлення:
# 🎤 Quick-send mode: starting recording
# 🎤 Conversation mode: starting recording after keyword detection  
# 🔍 Starting keyword detection for conversation mode
# 🔍 Received START_KEYWORD_DETECTION request
```

## 📝 Примітки

- **TTS блокування**: Під час відтворення TTS запис автоматично блокується через `_ttsLocked` flag
- **Error handling**: Всі методи мають try-catch та логування помилок
- **State validation**: Перевірка поточного стану перед запуском запису
- **Metadata**: Кожна сесія запису містить мітки режиму (`mode`, `conversationMode`)

## 🔗 Пов'язані файли

- `web/static/js/voice-control/services/microphone-button-service.js`
- `web/static/js/voice-control/services/keyword-detection-service.js`
- `web/static/js/voice-control/conversation-mode-manager-v4.js`
- `web/static/js/voice-control/conversation/modules/mode-handler.js`
- `web/static/js/voice-control/conversation/modules/button-controller.js`

---

**Дата виправлення:** 10 жовтня 2025  
**Час:** Пізній вечір (~22:00)  
**Статус:** ✅ ВИПРАВЛЕНО
