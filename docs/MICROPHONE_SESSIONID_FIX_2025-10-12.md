# Microphone SessionID Fix - 12.10.2025 (~12:45)

## 🐛 Проблема

Після першого успішного quick-send запису, **всі наступні спроби quick-send блокувались** з помилкою:
```
[12:40:37] Quick-send ignored - current state: processing
[12:41:04] Quick-send ignored - current state: processing
[12:41:17] Quick-send ignored - current state: processing
```

### Симптоми:
1. ✅ Перший quick-send запис працював
2. ❌ Транскрипція виконувалась успішно
3. ❌ Стан `currentState` НЕ скидався з `processing` в `idle`
4. ❌ Всі наступні quick-send ігнорувались через перевірку `if (this.currentState !== 'idle')`

### Корінь проблеми:

**SessionID mismatch** в event flow між `WhisperService` та `MicrophoneButtonService`:

```javascript
// ❌ ДО ВИПРАВЛЕННЯ:

// 1️⃣ MicrophoneButtonService відправляє sessionId
this.emit(Events.AUDIO_READY_FOR_TRANSCRIPTION, {
  sessionId: this.currentSession.id,  // ✅ sessionId передається
  audioBlob: this.currentSession.audioBlob,
  mode: this.currentSession.mode
});

// 2️⃣ WhisperService отримує sessionId, але НЕ передає його далі
async handleAudioReadyForTranscription(payload) {
  const result = await this.transcribeAudio(payload.audioBlob, {
    mode: payload.mode,       // ✅ mode передається
    language: 'uk'
    // ❌ payload.sessionId НЕ передається!
  });
}

// 3️⃣ WhisperService емітує WHISPER_TRANSCRIPTION_COMPLETED БЕЗ sessionId
await this.emit(Events.WHISPER_TRANSCRIPTION_COMPLETED, {
  // ❌ sessionId відсутній!
  text: result.text,
  result,
  latency,
  audioSize: audioBlob.size,
  confidence: result.confidence
});

// 4️⃣ MicrophoneButtonService НЕ обробляє подію через sessionId mismatch
this.subscribe(Events.WHISPER_TRANSCRIPTION_COMPLETED, (event) => {
  if (this.currentSession && this.currentSession.id === event.payload.sessionId) {
    // ❌ Ніколи НЕ виконується: event.payload.sessionId === undefined
    this.handleTranscriptionComplete(event.payload);
  }
});

// 5️⃣ handleTranscriptionComplete НЕ викликається
async handleTranscriptionComplete(result) {
  await this.resetToIdle('Transcription complete');  // ❌ НЕ викликається!
}

// 6️⃣ Результат: currentState залишається "processing" назавжди
```

### Event Flow (broken):
```
MicrophoneButtonService
  └─> AUDIO_READY_FOR_TRANSCRIPTION (sessionId ✅)
       └─> WhisperService.handleAudioReadyForTranscription()
            └─> transcribeAudio(audioBlob, {mode, language})  ❌ sessionId загублено
                 └─> WHISPER_TRANSCRIPTION_COMPLETED (sessionId ❌)
                      └─> MicrophoneButtonService.subscribe()
                           └─> if (sessionId === undefined) → FALSE ❌
                                └─> handleTranscriptionComplete() НЕ викликається ❌
                                     └─> resetToIdle() НЕ викликається ❌
                                          └─> currentState = "processing" НАЗАВЖДИ ❌
```

## ✅ Рішення

Передати `sessionId` через весь ланцюжок транскрипції.

### Виправлення #1: handleAudioReadyForTranscription (whisper-service.js)

```javascript
// ✅ ПІСЛЯ ВИПРАВЛЕННЯ:
async handleAudioReadyForTranscription(payload) {
  // ...
  
  // FIXED (12.10.2025): Передаємо sessionId для правильної обробки
  const result = await this.transcribeAudio(payload.audioBlob, {
    sessionId: payload.sessionId,  // ✅ КРИТИЧНО: передати sessionId!
    mode: payload.mode,
    language: 'uk'
  });
  
  // ...
}
```

### Виправлення #2: transcribeAudio - success event (whisper-service.js)

```javascript
// ✅ ПІСЛЯ ВИПРАВЛЕННЯ:
async transcribeAudio(audioBlob, options = {}) {
  const transcriptionOptions = {
    ...this.defaultOptions,
    ...options  // ✅ sessionId тепер в options
  };
  
  // ...
  
  // FIXED (12.10.2025): Передаємо sessionId для правильної обробки
  await this.emit(Events.WHISPER_TRANSCRIPTION_COMPLETED, {
    sessionId: transcriptionOptions.sessionId,  // ✅ КРИТИЧНО: sessionId для reset!
    text: result.text,
    result,
    latency,
    audioSize: audioBlob.size,
    confidence: result.confidence
  });
  
  // ...
}
```

### Виправлення #3: transcribeAudio - error event (whisper-service.js)

```javascript
// ✅ ПІСЛЯ ВИПРАВЛЕННЯ:
catch (error) {
  // ...
  
  // FIXED (12.10.2025): Передаємо sessionId для правильної обробки помилки
  await this.emit(Events.WHISPER_TRANSCRIPTION_ERROR, {
    sessionId: transcriptionOptions.sessionId,  // ✅ КРИТИЧНО: sessionId для reset!
    error: error.message,
    latency,
    audioSize: audioBlob.size
  });
  
  // ...
}
```

## 🔄 Event Flow (fixed):
```
MicrophoneButtonService
  └─> AUDIO_READY_FOR_TRANSCRIPTION (sessionId ✅)
       └─> WhisperService.handleAudioReadyForTranscription()
            └─> transcribeAudio(audioBlob, {sessionId ✅, mode, language})
                 └─> WHISPER_TRANSCRIPTION_COMPLETED (sessionId ✅)
                      └─> MicrophoneButtonService.subscribe()
                           └─> if (sessionId === currentSession.id) → TRUE ✅
                                └─> handleTranscriptionComplete() ✅
                                     └─> resetToIdle('Transcription complete') ✅
                                          └─> currentState = "idle" ✅
                                               └─> Наступний quick-send працює! ✅
```

## 📋 Виправлені файли

1. **web/static/js/voice-control/services/whisper-service.js**
   - Line ~127: `handleAudioReadyForTranscription()` - передача sessionId
   - Line ~470: `transcribeAudio()` - емісія sessionId в COMPLETED event
   - Line ~485: `transcribeAudio()` - емісія sessionId в ERROR event

## 🎯 Результат

- ✅ `sessionId` передається через весь ланцюжок транскрипції
- ✅ `MicrophoneButtonService.handleTranscriptionComplete()` викликається
- ✅ `resetToIdle()` виконується після кожної транскрипції
- ✅ `currentState` правильно скидається: `processing` → `idle`
- ✅ Всі наступні quick-send запуски працюють БЕЗ блокування
- ✅ Conversation mode також виграє від правильного lifecycle

## ⚠️ Критичні правила

1. ✅ **ЗАВЖДИ передавайте sessionId** через весь event flow
2. ✅ **Перевіряйте payload structure** на кожному етапі
3. ✅ **Session lifecycle:** start → recording → processing → transcription → idle
4. ✅ **State reset обов'язковий** після КОЖНОЇ операції (success/error)
5. ✅ **Event handlers з умовами** МАЮТЬ отримувати всі необхідні дані

## 🧪 Тестування

```javascript
// Перевірка що sessionId передається
console.log('Testing sessionId flow...');

// 1. Клік на мікрофон (quick-send)
// 2. Говоріть щось
// 3. Очікуйте автостоп
// 4. Перевірте логи:

// ✅ Має бути:
// [MICROPHONE_BUTTON] 📤 Submitting audio (session: rec_XXX)
// [WHISPER_SERVICE] 🎙️ Received audio (session: rec_XXX)
// [WHISPER_SERVICE] ✅ Transcription completed: "текст"
// [MICROPHONE_BUTTON] Transcription completed: "текст"
// [MICROPHONE_BUTTON] Reset to idle state (Transcription complete)

// 5. Повторний клік - має працювати БЕЗ "Quick-send ignored - current state: processing"
```

## 📊 До/Після

### ❌ ДО (broken):
- Перший quick-send: ✅ працює
- Другий quick-send: ❌ `Quick-send ignored - current state: processing`
- Третій quick-send: ❌ `Quick-send ignored - current state: processing`
- Стан: **processing** назавжди

### ✅ ПІСЛЯ (fixed):
- Перший quick-send: ✅ працює → idle
- Другий quick-send: ✅ працює → idle
- Третій quick-send: ✅ працює → idle
- Стан: **idle** після кожної операції

---

**Виправлення:** 12.10.2025 ~12:45
**Критичність:** 🔴 HIGH (блокуюча проблема для основного функціоналу)
**Тип:** Bug fix - SessionID propagation через event chain
