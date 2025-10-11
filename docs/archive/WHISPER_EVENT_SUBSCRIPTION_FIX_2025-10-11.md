# Whisper Event Subscription Fix - 11.10.2025 (рання ніч ~00:05)

## ❌ Проблема

**Симптом 1:** Quick-send режим мікрофона записував аудіо, але транскрипція НЕ відбувалась - повідомлення НЕ з'являлись у чаті.

**Симптом 2 (виправлено ~00:15):** `POST http://localhost:3002/v1/audio/transcriptions 404 NOT FOUND`

**Логи frontend:**
```
[00:00:19] Starting recording (trigger: click)
[00:00:25] Stopping recording (reason: silence)
[00:00:25] 📤 Submitting audio for transcription (session: rec_1760130019276_hdk4uzy5g, size: 2329 bytes, duration: 6152ms)
// ← ПІСЛЯ ЦЬОГО ТИША - жодної реакції від Whisper
```

**Логи Whisper сервісу:**
```
2025-10-11 00:03:15,003 [INFO] werkzeug: 127.0.0.1 - - [11/Oct/2025 00:03:15] "GET /health HTTP/1.1" 200 -
// ← ТІЛЬКИ /health запити, жодних POST /v1/audio/transcriptions
```

## 🔍 Корінь проблеми

**Проблема 1:** WhisperService НЕ підписувався на подію `AUDIO_READY_FOR_TRANSCRIPTION` від MicrophoneButtonService.

**Проблема 2 (виправлено ~00:15):** Неправильний API endpoint - використовувався OpenAI API `/v1/audio/transcriptions` замість Whisper.cpp `/transcribe`.

### Архітектура що була:
```javascript
MicrophoneButtonService.submitForTranscription():
  emit(Events.AUDIO_READY_FOR_TRANSCRIPTION, { audioBlob, sessionId, ... })
  ↓
  ❌ НІХТО НЕ СЛУХАЄ - подія втрачена!
```

### Що очікувалось:
```javascript
MicrophoneButtonService → emit AUDIO_READY_FOR_TRANSCRIPTION
  ↓
WhisperService.handleAudioReadyForTranscription() → transcribeAudio()
  ↓
POST /v1/audio/transcriptions → Whisper.cpp → результат
  ↓
emit WHISPER_TRANSCRIPTION_COMPLETED
  ↓
SpeechResultsService → відправка в чат
```

## ✅ Рішення

### 1. Додано метод підписки на події (~00:05)

**Файл:** `web/static/js/voice-control/services/whisper-service.js`

```javascript
/**
 * Підписка на події від мікрофона
 */
subscribeToMicrophoneEvents() {
  // Обробка готового аудіо для транскрипції
  this.subscribe(Events.AUDIO_READY_FOR_TRANSCRIPTION, (event) => {
    this.handleAudioReadyForTranscription(event.payload);
  });

  this.logger.debug('Subscribed to microphone events (AUDIO_READY_FOR_TRANSCRIPTION)');
}
```

### 2. Додано обробник події (~00:05 + захист ~00:15)

```javascript
/**
 * Обробка події готовності аудіо для транскрипції
 * @param {Object} payload - Дані події
 */
async handleAudioReadyForTranscription(payload) {
  try {
    // Перевірка наявності audioBlob (додано ~00:15)
    if (!payload || !payload.audioBlob) {
      this.logger.warn('Audio blob not found in payload', { payload });
      return;
    }

    this.logger.info(`🎙️ Received audio for transcription (session: ${payload.sessionId}, size: ${payload.audioBlob.size} bytes)`);

    // Виконання транскрипції
    const result = await this.transcribeAudio(payload.audioBlob, {
      mode: payload.mode,
      language: 'uk'
    });

    this.logger.info(`✅ Transcription successful: "${result.text}"`);

  } catch (error) {
    this.logger.error('Failed to process audio for transcription', {
      sessionId: payload?.sessionId  // Safe navigation (додано ~00:15)
    }, error);
  }
}
```

### 3. Виправлено API endpoint для Whisper.cpp (~00:15)

```javascript
async performTranscription(audioBlob, options) {
  const formData = new FormData();

  // Whisper.cpp використовує ім'я поля 'audio' замість 'file'
  formData.append('audio', audioBlob, 'audio.webm');

  // Додаємо параметри
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && key !== 'maxDuration') {
      formData.append(key, value.toString());
    }
  });

  // Whisper.cpp endpoint: /transcribe (НЕ /v1/audio/transcriptions як OpenAI)
  const response = await fetch(`${this.serviceUrl}/transcribe`, {
    method: 'POST',
    body: formData
  });
  
  // ... обробка відповіді
}
```

**Різниця API:**
- ❌ **OpenAI API:** `POST /v1/audio/transcriptions` + field `file`
- ✅ **Whisper.cpp:** `POST /transcribe` + field `audio`

### 3. Підключено в onInitialize (~00:05)

```javascript
async onInitialize() {
  try {
    // ... перевірки ...

    // Підписка на події від MicrophoneButtonService
    this.subscribeToMicrophoneEvents();

    this.logger.info(`Whisper service initialized (URL: ${this.serviceUrl})`);
    return true;
  } catch (error) {
    this.logger.error('Failed to initialize Whisper service', null, error);
    return false;
  }
}
```

## 🎯 Очікуваний результат

**Після виправлення:**

1. ✅ **Користувач клікає мікрофон** → MicrophoneButtonService починає запис
2. ✅ **Говорить щось** → аудіо записується
3. ✅ **Тиша 6 секунд або клік знову** → запис зупиняється
4. ✅ **submitForTranscription()** → emit AUDIO_READY_FOR_TRANSCRIPTION
5. ✅ **WhisperService.handleAudioReadyForTranscription()** → отримує подію
6. ✅ **transcribeAudio()** → POST до Whisper.cpp на :3002
7. ✅ **Whisper.cpp розпізнає** → повертає текст
8. ✅ **emit WHISPER_TRANSCRIPTION_COMPLETED** → SpeechResultsService
9. ✅ **Текст з'являється в чаті** → користувач бачить результат

## 🧪 Тестування

### Перевірка Whisper сервісу
```bash
curl -s http://localhost:3002/health
# Має повернути: {"backend":"whisper.cpp","status":"ok",...}
```

### Тестування Quick-send режиму
1. Відкрити http://localhost:5001
2. Клікнути мікрофон (одне натискання)
3. Сказати щось українською (напр. "Привіт Атлас")
4. Зачекати 6 секунд або клікнути знову
5. **Очікується:** Текст з'явиться в чаті

### Очікувані логи frontend
```
[00:XX:XX] Starting recording (trigger: click)
[00:XX:XX] Stopping recording (reason: silence/user_stop)
[00:XX:XX] 📤 Submitting audio for transcription (session: rec_..., size: XXXX bytes)
[00:XX:XX] 🎙️ Received audio for transcription (session: rec_...)
[00:XX:XX] ✅ Transcription successful: "Привіт Атлас"
```

### Очікувані логи Whisper
```
2025-10-11 00:XX:XX [INFO] werkzeug: 127.0.0.1 - - [11/Oct/2025 00:XX:XX] "POST /v1/audio/transcriptions HTTP/1.1" 200 -
```

## 📝 Виправлені файли

1. **web/static/js/voice-control/services/whisper-service.js**
   - (~00:05) Додано `subscribeToMicrophoneEvents()` метод
   - (~00:05) Додано `handleAudioReadyForTranscription()` обробник
   - (~00:05) Викликається в `onInitialize()`
   - (~00:15) Виправлено endpoint `/v1/audio/transcriptions` → `/transcribe`
   - (~00:15) Виправлено form field `file` → `audio`
   - (~00:15) Додано перевірки `payload?.audioBlob` для безпеки

## 🔗 Пов'язані виправлення

- **MICROPHONE_MODES_FIX_2025-10-10.md** - виправлення підписки на conversation events
- **MICROPHONE_CLICK_CONFLICT_FIX_2025-10-11.md** - виправлення race condition між обробниками кліку

## ⚠️ Критично

**ЗАВЖДИ підписуйтесь на події в onInitialize()!** Якщо сервіс очікує події від інших компонентів, він МУСИТЬ мати метод `subscribeToXXXEvents()` який викликається при ініціалізації.

### Паттерн підписки:
```javascript
async onInitialize() {
  // ... ініціалізація ...
  this.subscribeToEvents();  // ← ОБОВ'ЯЗКОВО!
  return true;
}

subscribeToEvents() {
  this.subscribe(Events.SOME_EVENT, (event) => {
    this.handleSomeEvent(event.payload);
  });
}

async handleSomeEvent(payload) {
  // обробка події
}
```

## 📊 Статус

- ✅ **Виправлено:** WhisperService підписується на AUDIO_READY_FOR_TRANSCRIPTION
- 🔄 **Потребує тестування:** Запустити quick-send режим і перевірити що текст з'являється в чаті
- 📄 **Документація:** Створена
- 🎯 **Наступний крок:** Перезавантажити сторінку та протестувати обидва режими мікрофона

---

**Час виправлення:** 11.10.2025, рання ніч ~00:05  
**Тип проблеми:** Missing event subscription  
**Критичність:** БЛОКУЮЧА - quick-send режим повністю не працював  
**Складність:** Низька - додано 40 рядків коду
