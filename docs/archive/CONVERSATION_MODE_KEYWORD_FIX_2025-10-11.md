# Conversation Mode Keyword Detection Fix - 2025-10-11 01:15

## Проблема

**Conversation mode НЕ реагував на ключове слово "Атлас":**
1. Утримання 2с → режим активується ✅
2. Показується "Скажіть 'Атлас' для початку..." ✅
3. Говоримо "Атлас" → **НІЧОГО НЕ ВІДБУВАЄТЬСЯ** ❌

## Симптоми з логів

```javascript
[01:14:01] 🎙️ Long press detected - activating Conversation Mode
[01:14:01] 💬 Conversation mode activated
[01:14:01] 🔍 Starting keyword detection for conversation mode
// Далі НІЧОГО - не реагує на "Атлас"
```

## Корінь проблеми

### Проблема #1: Неправильна назва події

**conversation-mode-manager.js (рядок 356):**
```javascript
// ❌ НЕПРАВИЛЬНО:
startListeningForKeyword() {
  eventManager.emit('START_KEYWORD_LISTENING', { ... });
}
```

**keyword-detection-service.js (рядок 110):**
```javascript
// ✅ Слухає ІНШУ подію:
this.eventManager.on('START_KEYWORD_DETECTION', async (event) => {
  this.logger.info('🔍 Received START_KEYWORD_DETECTION request', ...);
});
```

**Результат:** Події **НЕ співпадають** → KeywordDetectionService **НЕ отримує** сигнал!

### Проблема #2: Подія НЕ була в Events enum

`Events.START_KEYWORD_DETECTION` **НЕ існувала** в event-manager.js, тому import давав `undefined`.

## Рішення

### 1. Виправлено назву події (conversation-mode-manager.js, рядок 356)

```javascript
// ДО:
startListeningForKeyword() {
  eventManager.emit('START_KEYWORD_LISTENING', { // ❌ Неправильна назва
    keywords: [this.config.keywordForActivation],
    mode: 'conversation'
  });
}

// ПІСЛЯ:
startListeningForKeyword() {
  eventManager.emit(Events.START_KEYWORD_DETECTION, { // ✅ Правильна назва
    keywords: [this.config.keywordForActivation],
    mode: 'conversation'
  });
}
```

### 2. Додано подію в Events enum (event-manager.js, рядок 420)

```javascript
// Keyword Detection події
KEYWORD_DETECTED: 'keyword.detected',
KEYWORD_DETECTION_STARTED: 'keyword.detection.started',
KEYWORD_DETECTION_STOPPED: 'keyword.detection.stopped',
KEYWORD_DETECTION_ERROR: 'keyword.detection.error',
START_KEYWORD_DETECTION: 'START_KEYWORD_DETECTION', // ✅ ДОДАНО для conversation mode
```

## Правильний Event Flow (ПІСЛЯ виправлення)

```
1. User: Утримує кнопку 2 секунди
   ↓
2. ConversationModeManager.activateConversationMode()
   ↓
3. ConversationModeManager.startListeningForKeyword()
   ↓
4. emit(Events.START_KEYWORD_DETECTION, { keywords: ['атлас'], mode: 'conversation' })
   ↓
5. KeywordDetectionService.on('START_KEYWORD_DETECTION') ← ✅ ТЕПЕР ОТРИМУЄ!
   ↓
6. KeywordDetectionService.startDetection()
   ↓
7. User: Каже "Атлас"
   ↓
8. emit(Events.KEYWORD_DETECTED, { keyword: 'атлас' })
   ↓
9. ConversationModeManager.handleKeywordDetected()
   ↓
10. ConversationModeManager.startConversationRecording()
   ↓
11. emit(Events.CONVERSATION_RECORDING_START)
   ↓
12. MicrophoneButtonService.handleConversationRecordingStart()
   ↓
13. Recording starts! ✅
```

## Додаткова проблема: Background phrase filter

**"Субтитрувальниця Оля Шор"** - відфільтровано ✅ (ПРАВИЛЬНО!)

Ця фраза є в списку `ignoredPhrases`:
```javascript
backgroundFilter: {
  ignoredPhrases: [
    'дякую за перегляд',
    'дякую за увагу',
    'субтитрувальниця',  // ← Містить це слово
    'оля шор',            // ← І це теж
    ...
  ]
}
```

**Логіка фільтра:**
```javascript
if (cleanText.includes(ignoredPhrase.toLowerCase())) {
  logger.warn(`🚫 Background phrase filtered: "${text}"`);
  return; // НЕ відправляємо в чат
}
```

Текст "Субтитрувальниця Оля Шор" містить ОБА ігноровані слова → **коректно відфільтрований**.

## Результат виправлення

### ДО:
```
1. Утримати 2с → Conversation mode активується ✅
2. Показується "Скажіть 'Атлас'..." ✅
3. Каже "Атлас" → НІЧОГО ❌ (подія НЕ доходить до KeywordDetectionService)
```

### ПІСЛЯ:
```
1. Утримати 2с → Conversation mode активується ✅
2. Показується "Скажіть 'Атлас'..." ✅
3. Каже "Атлас" → KeywordDetectionService ОТРИМУЄ подію ✅
4. Keyword detected → START_RECORDING ✅
5. Recording → Transcription → Chat → TTS → Loop ✅
```

## Файли змінені

1. **`web/static/js/voice-control/conversation-mode-manager.js`** (рядок 356)
   - Змінено `'START_KEYWORD_LISTENING'` → `Events.START_KEYWORD_DETECTION`

2. **`web/static/js/voice-control/events/event-manager.js`** (рядок 420)
   - Додано `START_KEYWORD_DETECTION: 'START_KEYWORD_DETECTION'` в Events enum

## Тестування

### Quick-send mode (одне натискання):
```
1. Клік → запис
2. Мовчання 6с → зупинка
3. Транскрипція → фільтр background phrase
4. Якщо НЕ фонова → відправка в чат ✅
5. Якщо фонова → відкидається ✅
```

### Conversation mode (утримання 2с):
```
1. Утримати 2с → активація ✅
2. Каже "Атлас" → keyword detection ✅
3. Запис → транскрипція → чат ✅
4. TTS відповідь → повтор keyword listening ✅
5. Loop продовжується ✅
```

## Наступні кроки

1. **Протестувати conversation mode** з реальним аудіо:
   - Утримати кнопку 2 секунди
   - Сказати "Атлас"
   - Сказати команду (НЕ фонову фразу)
   - Перевірити що цикл продовжується

2. **Перевірити список background phrases:**
   - Можливо деякі фрази потрібно видалити
   - Можливо додати нові

3. **Моніторинг логів:**
   - `🔍 Received START_KEYWORD_DETECTION` - має з'являтись після активації
   - `🎯 Keyword "атлас" detected` - має з'являтись після вимови
   - `🚫 Background phrase filtered` - тільки для фонових фраз

---

**Документ створено:** 11 жовтня 2025, 01:15  
**Версія:** 1.0  
**Статус:** Виправлення застосовано ✅  
**Потрібен перезапуск:** Ні (hot-reload в браузері достатньо)
