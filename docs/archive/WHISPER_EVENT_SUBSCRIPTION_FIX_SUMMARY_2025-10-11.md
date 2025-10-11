# Whisper Event Subscription Fix - Summary

**Дата:** 11.10.2025, рання ніч ~00:05-00:15  
**Тип:** Missing event subscription + Wrong API endpoint (БЛОКУЮЧІ помилки)  

## ❌ Проблема

Quick-send режим мікрофона **НЕ відправляв транскрипції в чат**.

### Симптоми:
1. Аудіо записувалось, але транскрипція НЕ з'являлась (~00:05)
2. `POST http://localhost:3002/v1/audio/transcriptions 404 NOT FOUND` (~00:15)

### Логи що показували проблему:
```
[00:00:25] 📤 Submitting audio for transcription (size: 2329 bytes)
// ← ПІСЛЯ ЦЬОГО ТИША - жодної реакції
```

Whisper сервіс працював (health OK), але НЕ отримував POST запити з аудіо.

## 🔍 Корінь

**Проблема 1 (~00:05):** WhisperService НЕ підписувався на подію `AUDIO_READY_FOR_TRANSCRIPTION`.

**Проблема 2 (~00:15):** Використовувався OpenAI API endpoint `/v1/audio/transcriptions` замість Whisper.cpp `/transcribe`.

```javascript
// ❌ ЩО БУЛО:
MicrophoneButtonService.submitForTranscription()
  → emit(AUDIO_READY_FOR_TRANSCRIPTION, { audioBlob, ... })
  → НІХТО НЕ СЛУХАЄ - подія втрачена
```

## ✅ Рішення

Додано в `WhisperService`:

1. **Метод підписки (~00:05):**
```javascript
subscribeToMicrophoneEvents() {
  this.subscribe(Events.AUDIO_READY_FOR_TRANSCRIPTION, (event) => {
    this.handleAudioReadyForTranscription(event.payload);
  });
}
```

2. **Обробник події (~00:05 + захист ~00:15):**
```javascript
async handleAudioReadyForTranscription(payload) {
  // Перевірка наявності audioBlob (додано ~00:15)
  if (!payload || !payload.audioBlob) {
    this.logger.warn('Audio blob not found in payload');
    return;
  }
  
  const result = await this.transcribeAudio(payload.audioBlob, {
    mode: payload.mode,
    language: 'uk'
  });
}
```

3. **Виправлено API endpoint (~00:15):**
```javascript
// ❌ БУЛО:
fetch(`${this.serviceUrl}/v1/audio/transcriptions`, { ... })
formData.append('file', audioBlob, 'audio.webm');

// ✅ СТАЛО:
fetch(`${this.serviceUrl}/transcribe`, { ... })
formData.append('audio', audioBlob, 'audio.webm');
```

4. **Виклик в onInitialize() (~00:05):**
```javascript
async onInitialize() {
  // ... перевірки ...
  this.subscribeToMicrophoneEvents(); // ← ДОДАНО
  return true;
}
```

## 🎯 Результат

```javascript
// ✅ ЩО СТАЛО:
MicrophoneButtonService → emit AUDIO_READY_FOR_TRANSCRIPTION
  ↓
WhisperService.handleAudioReadyForTranscription()
  ↓
POST /v1/audio/transcriptions → Whisper.cpp
  ↓
emit WHISPER_TRANSCRIPTION_COMPLETED
  ↓
SpeechResultsService → текст в чат ✅
```

## 📝 Виправлено

**Файл:** `web/static/js/voice-control/services/whisper-service.js`  
**Додано/Змінено (~00:05-00:15):**
- `subscribeToMicrophoneEvents()` - підписка на події
- `handleAudioReadyForTranscription()` - обробник з перевірками
- Виправлено endpoint: `/v1/audio/transcriptions` → `/transcribe`
- Виправлено form field: `file` → `audio`
- Додано safe navigation: `payload?.sessionId`, `payload?.audioBlob`

## ⚠️ Важливо

**ЗАВЖДИ підписуйтесь на події в `onInitialize()`!**

Паттерн:
```javascript
async onInitialize() {
  this.subscribeToEvents();  // ← ОБОВ'ЯЗКОВО!
  return true;
}
```

## 🧪 Тестування

1. Відкрити http://localhost:5001
2. Клікнути мікрофон → говорити → зачекати 6с
3. **Очікується:** Текст з'являється в чаті

## 📄 Документація

- Детально: `docs/WHISPER_EVENT_SUBSCRIPTION_FIX_2025-10-11.md`
- Copilot instructions: Оновлено
