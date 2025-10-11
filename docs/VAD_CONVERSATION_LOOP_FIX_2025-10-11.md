# Voice Activity Detection & Conversation Loop Fixes

**Дата:** 11 жовтня 2025, ~17:00-17:30  
**Статус:** ✅ ВИПРАВЛЕНО  
**Пріоритет:** КРИТИЧНИЙ  
**Категорія:** Voice Control → VAD + Conversation Loop

---

## 🐛 Проблеми

### Проблема #1: Conversation Loop НЕ продовжується після TTS
**Симптом:** Після відповіді Atlas система НЕ запускає continuous listening автоматично.

**Логи:**
```javascript
[16:54:59] [CHAT] Event handler error for tts-start this.modelController.speak is not a function
[16:55:09] [MICROPHONE_BUTTON] [WARN] Invalid state transition: idle -> processing
```

**Корінь:**
- Race condition: `resumeAfterTTS()` встановлює `setState('idle')`, але conversation вже запустив `startRecording()` → стан змінюється на `listening`
- `handleConversationRecordingStart()` відкидає запит якщо `currentState !== 'idle'`

### Проблема #2: Пуста транскрипція
**Симптом:** `⚠️ Transcription completed but no text found`

**Корінь:**
- WhisperService емітував `{ result: {text}, latency, audioSize }`
- ConversationModeManager очікував `{ text, result: {text} }` або `{ text }`
- Payload structure mismatch → text не знайдений

### Проблема #3: Відсутність Voice Activity Detection (VAD)
**Симптом:** Запис йде фіксований час (6 сек) незалежно від того чи говорить користувач.

**Корінь:**
- MediaManager просто записував фіксований час
- Немає аналізу рівня аудіо
- Немає автоматичного визначення кінця фрази

---

## ✅ Рішення

### Fix #1: Race Condition в handleConversationRecordingStart

**Файл:** `web/static/js/voice-control/services/microphone-button-service.js`

**Було:**
```javascript
if (this.currentState !== 'idle') {
  this.logger.warn(`Conversation recording ignored - current state: ${this.currentState}`);
  return;
}
```

**Стало:**
```javascript
// FIXED (11.10.2025 - 17:05): Дозволяємо 'processing' стан після TTS resume
// Race condition: setState('idle') може бути ПІСЛЯ startRecording()
const allowedStates = ['idle', 'processing'];
if (!allowedStates.includes(this.currentState)) {
  this.logger.warn(`Conversation recording ignored - current state: ${this.currentState} (allowed: ${allowedStates.join(', ')})`);
  return;
}

// Примусово встановлюємо idle якщо processing (після TTS)
if (this.currentState === 'processing') {
  this.logger.debug('Resetting state from processing to idle before conversation recording');
  this.setState('idle', 'pre_conversation_recording');
}
```

### Fix #2: Whisper Payload Structure

**Файл:** `web/static/js/voice-control/services/whisper-service.js`

**Було:**
```javascript
await this.emit(Events.WHISPER_TRANSCRIPTION_COMPLETED, {
  result,
  latency,
  audioSize: audioBlob.size
});
```

**Стало:**
```javascript
// FIXED (11.10.2025 - 17:10): Додаємо text на верхній рівень для conversation-mode
await this.emit(Events.WHISPER_TRANSCRIPTION_COMPLETED, {
  text: result.text,      // Для conversation-mode compatibility
  result,                 // Повний результат
  latency,
  audioSize: audioBlob.size,
  confidence: result.confidence
});
```

### Fix #3: Voice Activity Detection (VAD)

**Створено новий файл:** `web/static/js/voice-control/services/microphone/simple-vad.js`

**Можливості:**
- ✅ Real-time аналіз RMS рівня аудіо
- ✅ Виявлення початку мови (speech start)
- ✅ Виявлення кінця фрази (1.5 сек тиші)
- ✅ Мінімальна тривалість мови (300мс) для відсіювання шуму
- ✅ Callbacks для подій (onSpeechStart, onSpeechEnd, onSilenceDetected)

**Інтеграція в MediaManager:**

**Файл:** `web/static/js/voice-control/services/microphone/media-manager.js`

```javascript
// НОВИНКА (11.10.2025 - 17:20): Ініціалізація VAD для автоматичного визначення кінця
if (this.vadEnabled && options.onSilenceDetected) {
  this.vad = new SimpleVAD({
    silenceThreshold: 0.01,
    silenceDuration: 1500,        // 1.5 сек тиші = кінець фрази
    minSpeechDuration: 300,       // Мінімум 300мс для валідної мови
    onSilenceDetected: (data) => {
      this.logger?.info(`VAD: Silence detected (${data.silenceDuration}ms) - triggering auto-stop`);
      options.onSilenceDetected?.();
    }
  });

  await this.vad.initialize(this.audioStream);
}
```

---

## 🎯 Результат

### Workflow після всіх виправлень:

1. ✅ Утримання 2с → Conversation mode активується
2. ✅ Keyword detection → "Атлас" детектується
3. ✅ **Запис з VAD:** Користувач говорить → VAD аналізує → 1.5 сек тиші → автостоп
4. ✅ **Транскрипція:** Whisper розпізнає → емітує з `text` на верхньому рівні
5. ✅ **Chat:** Текст з'являється в чаті → Atlas відповідає через TTS
6. ✅ **Conversation Loop:** TTS завершується → автоматично continuous listening
7. ✅ **Repeat:** Користувач говорить (БЕЗ "Атлас") → VAD → транскрипція → repeat

### Переваги VAD:

- ✅ **Природна взаємодія:** Користувач говорить як зазвичай, система чекає паузу
- ✅ **Економія:** Не відправляємо зайві секунди тиші на Whisper
- ✅ **Швидкість:** Автоматичний стоп одразу після фрази (замість фіксованих 6 сек)
- ✅ **Точність:** Мінімальна тривалість 300мс відсіює шум та випадкові звуки

---

## 📝 Виправлені файли

1. ✅ `web/static/js/voice-control/services/microphone-button-service.js` - Race condition fix
2. ✅ `web/static/js/voice-control/services/whisper-service.js` - Payload structure
3. ✅ `web/static/js/voice-control/services/microphone/simple-vad.js` - NEW - VAD система
4. ✅ `web/static/js/voice-control/services/microphone/media-manager.js` - VAD інтеграція

---

## 🧪 Тестування

### Manual Test:

```bash
# 1. Відкрити http://localhost:5001

# 2. Утримати мікрофон 2 сек → "Атлас"

# 3. Сказати фразу → НЕ чекати 6 сек, просто зробити паузу 1.5 сек
# Очікування: VAD автоматично зупинить запис

# 4. Перевірити логи:
# [VAD: Speech started]
# [VAD: Silence detected (1500ms) - triggering auto-stop]
# [Transcription successful: "текст"]

# 5. Atlas відповідає → очікування автоматичного continuous listening

# 6. Сказати наступну фразу БЕЗ "Атлас" → repeat
```

### Перевірка VAD:

```javascript
// Browser console:
window.app.managers.voiceControl.services.get('microphone').mediaManager.vad.getState()

// Має повернути:
// { isActive: true, isSpeaking: true/false, speechDuration: X, silenceDuration: Y }
```

---

## 📚 Пов'язані документи

- `docs/CONVERSATION_LOOP_TTS_FIX_2025-10-11.md` - TTS completion fix (16:50)
- `docs/CONVERSATION_MODE_INTELLIGENT_FILTER_2025-10-11.md` - Intelligent filter
- `docs/WHISPER_KEYWORD_DETECTION_2025-10-11.md` - Whisper keyword detection

---

**Автор:** GitHub Copilot  
**Version:** 1.0.0
