# Quick Summary: Microphone SessionID Fix

**Дата:** 12.10.2025 ~12:45
**Критичність:** 🔴 HIGH

## 🐛 Проблема
Після першого quick-send запису всі наступні блокувались:
```
Quick-send ignored - current state: processing
```

## 🔍 Корінь
`WhisperService` НЕ передавав `sessionId` в події `WHISPER_TRANSCRIPTION_COMPLETED` → 
`MicrophoneButtonService` НЕ обробляв подію → 
`resetToIdle()` НЕ викликався → 
стан залишався `processing` назавжди

## ✅ Рішення
Передати `sessionId` через весь event chain:

1. `handleAudioReadyForTranscription()` - передача в `transcribeAudio()`
2. `WHISPER_TRANSCRIPTION_COMPLETED` - додано `sessionId` в payload
3. `WHISPER_TRANSCRIPTION_ERROR` - додано `sessionId` в payload

## 📋 Виправлено
- `web/static/js/voice-control/services/whisper-service.js` (3 місця)

## 🎯 Результат
✅ Quick-send працює НЕОБМЕЖЕНО (1-й, 2-й, 3-й... клік)
✅ Стан правильно скидається: `processing` → `idle`
✅ Conversation mode також виграє від правильного lifecycle

**Детально:** `docs/MICROPHONE_SESSIONID_FIX_2025-10-12.md`
