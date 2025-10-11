# Voice Modes Workflow Documentation

**Date:** 2025-10-11  
**Version:** 4.0.0  
**Status:** Refactored & Enhanced

## 📋 Overview

Atlas v4.0 підтримує два режими голосового вводу:
1. **Quick-send** (Швидкий режим) - одне натискання
2. **Conversation** (Режим розмови) - утримання 2 секунди

## 🎯 Mode 1: Quick-Send (Швидкий Режим)

### Призначення
Швидка відправка голосового повідомлення в чат без активації повного conversation mode.

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│  User Action: Клік на кнопку мікрофона                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  System: Visual feedback - синій pulse (mode-quick-send)        │
│  Status: "Записую... (відпустіть для завершення)"              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Recording starts:                                               │
│  - MediaRecorder активується                                    │
│  - VAD (Voice Activity Detection) моніторить аудіо рівень      │
│  - Захоплення аудіо чанків                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  VAD Detection:                                                  │
│  - Аналізує RMS рівень кожен frame                             │
│  - Speech detected: RMS > 0.01                                  │
│  - Silence detected: RMS ≤ 0.01 протягом 1.5 сек               │
│  - Min speech duration: 300ms                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auto-stop (VAD silence threshold reached):                     │
│  - MediaRecorder.stop()                                         │
│  - Audio blob створюється                                       │
│  - Min duration check: ≥ 500ms                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Whisper Transcription:                                          │
│  - POST /transcribe (audio blob)                                │
│  - Response: { text, confidence, ... }                          │
│  - Event: WHISPER_TRANSCRIPTION_COMPLETED                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Transcription Filter:                                           │
│  - Background phrase check (фонові відео)                       │
│  - Confidence threshold check                                   │
│  - Empty/short text filter                                      │
│  - Passed → Send to chat                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Chat Send:                                                      │
│  - Event: SEND_CHAT_MESSAGE                                     │
│  - Payload: { text, source: 'voice', mode: 'quick-send' }     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Atlas Response:                                                 │
│  - OpenAI API processing                                        │
│  - Response text generated                                      │
│  - TTS synthesis (Ukrainian TTS)                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS Playback:                                                   │
│  - Audio blob playback                                          │
│  - Visual: Atlas speaking animation                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS_COMPLETED:                                                  │
│  - isActivationResponse: false                                  │
│  - mode: 'chat'                                                 │
│  - isInConversation: false                                      │
│  → Return to IDLE (зелена кнопка)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features
- ✅ **VAD автоматичний стоп** - не треба натискати кнопку повторно
- ✅ **Швидкість** - одне натискання, без conversation overhead
- ✅ **Фільтрація** - автоматичне відсіювання фонових фраз
- ✅ **Visual feedback** - синій pulse під час запису

## 🎯 Mode 2: Conversation (Режим Розмови)

### Призначення
Безперервний діалог з Atlas без необхідності повторювати "Атлас" після кожної відповіді.

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│  User Action: Утримання кнопки 2 секунди                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Conversation Mode Activated:                                    │
│  - Visual: Зелений pulse (mode-conversation)                   │
│  - Status: "Режим розмови активний"                            │
│  - State: IDLE → CONVERSATION                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Keyword Detection Start:                                        │
│  - Event: START_KEYWORD_DETECTION                               │
│  - Keywords: ['атлас']                                          │
│  - Service: WhisperKeywordDetection                             │
│  - Status: "Скажіть 'Атлас' для початку..."                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Continuous Keyword Listening:                                   │
│  - Record 2.5 sec audio chunk                                   │
│  - POST /transcribe                                             │
│  - Check if contains "атлас" (fuzzy match)                     │
│  - NO → Pause 200ms → Record next chunk                        │
│  - YES → Emit KEYWORD_DETECTED                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  KEYWORD_DETECTED Event:                                         │
│  - Keyword: "атлас"                                             │
│  - Response: getRandomActivationResponse() with ROTATION        │
│    * Circular buffer prevents repeats                           │
│    * Pool refreshes when empty                                  │
│    * Examples: "слухаю", "в увазі", "готовий до роботи"       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Activation Response TTS:                                        │
│  - Event: TTS_SPEAK_REQUEST                                     │
│  - Text: response (e.g., "слухаю")                             │
│  - isActivationResponse: TRUE ← CRITICAL FLAG                   │
│  - mode: 'conversation'                                         │
│  - Ukrainian TTS synthesis                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS Playback (Activation):                                      │
│  - Audio playback: "слухаю"                                     │
│  - Visual: Atlas speaking                                       │
│  - Duration: ~1-2 seconds                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS_COMPLETED (Activation):                                     │
│  - isActivationResponse: TRUE ← Детектується!                  │
│  - Action: Start conversation recording (300ms pause)           │
│  - NOT starting continuous listening yet                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  User Request Recording:                                         │
│  - Event: CONVERSATION_RECORDING_START                          │
│  - MediaRecorder starts                                         │
│  - VAD monitoring active                                        │
│  - Status: "Записую..."                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  VAD Detection (User speaks):                                    │
│  - User говорить запит                                          │
│  - VAD детектує кінець фрази (1.5 сек тиші)                   │
│  - Auto-stop → Audio blob                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Whisper Transcription:                                          │
│  - POST /transcribe                                             │
│  - Response: { text, confidence }                               │
│  - Event: WHISPER_TRANSCRIPTION_COMPLETED                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Conversation Filter (STRICT):                                   │
│  - Background phrase check                                      │
│  - Short text filter (<5 chars)                                │
│  - Unclear phrases ("хм", "е", "аа")                          │
│  - Low confidence (<0.3)                                        │
│  - FAIL → Return to keyword detection                           │
│  - PASS → Send to chat                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Chat Send:                                                      │
│  - Event: SEND_CHAT_MESSAGE                                     │
│  - Payload: { text, mode: 'conversation', confidence }         │
│  - Add to conversation history                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Atlas Response:                                                 │
│  - OpenAI API processing                                        │
│  - Response generation                                          │
│  - TTS synthesis                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS Playback (Atlas Answer):                                    │
│  - Audio playback                                               │
│  - Visual: Atlas speaking                                       │
│  - isActivationResponse: FALSE                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS_COMPLETED (Atlas Answer):                                   │
│  - isActivationResponse: FALSE ← CRITICAL!                      │
│  - mode: 'chat'                                                 │
│  - isInConversation: TRUE                                       │
│  → Start CONTINUOUS LISTENING (БЕЗ "Атлас"!)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Continuous Listening (Auto-loop):                               │
│  - 500ms pause (природність)                                   │
│  - Auto-start recording БЕЗ keyword!                            │
│  - VAD monitoring                                               │
│  - Status: "Слухаю... (говоріть або 5 сек тиші)"             │
│  - Silence timer: 5 seconds                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
             ┌───────┴───────┐
             │               │
             ▼               ▼
     User Speaks     5 Sec Silence
             │               │
             │               ▼
             │    Return to Keyword Detection
             │    ("Скажіть 'Атлас'...")
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  LOOP CONTINUES:                                                 │
│  - VAD detects end → Whisper → Filter → Chat → Atlas TTS       │
│  → TTS_COMPLETED → Continuous listening → REPEAT                │
└─────────────────────────────────────────────────────────────────┘
```

### Exit Conditions

#### 1. User Silence (5 seconds)
```
Continuous Listening → 5 sec silence → Return to Keyword Detection
→ User must say "Атлас" again to continue
```

#### 2. Task Mode Detected
```
Chat Response mode: 'task' → NO continuous listening
→ Task execution workflow instead
→ Conversation loop STOPS
```

#### 3. Manual Exit
```
User clicks button during conversation → Deactivate conversation mode
→ Return to IDLE
```

### Key Features
- ✅ **Activation Response Rotation** - різноманітність відповідей, БЕЗ повторів
- ✅ **Auto-loop after TTS** - не треба повторювати "Атлас"
- ✅ **VAD integration** - автоматичний стоп при тиші
- ✅ **Intelligent filtering** - відсіювання фонових і невиразних фраз
- ✅ **Conversation history** - контекст зберігається протягом діалогу
- ✅ **Visual feedback** - зелений pulse під час conversation mode

## 🔧 Technical Components

### 1. ConversationModeManager
- **Location:** `web/static/js/voice-control/conversation-mode-manager.js`
- **Role:** Управління режимами, координація workflow
- **Key Methods:**
  - `activateQuickSendMode()` - Mode 1 activation
  - `activateConversationMode()` - Mode 2 activation
  - `onKeywordActivation()` - Обробка "Атлас" + activation response
  - `handleTTSCompleted()` - Розпізнавання типу TTS (activation vs chat)
  - `startContinuousListening()` - Auto-loop після Atlas відповіді

### 2. WhisperKeywordDetection
- **Location:** `web/static/js/voice-control/services/whisper-keyword-detection.js`
- **Role:** Continuous listening для "Атлас"
- **Key Features:**
  - 2.5 sec audio chunks
  - Whisper API transcription
  - Fuzzy keyword matching
  - **Activation response rotation** (NEW!)

### 3. MicrophoneButtonService
- **Location:** `web/static/js/voice-control/services/microphone-button-service.js`
- **Role:** Запис аудіо, VAD integration
- **Key Methods:**
  - `handleQuickSendModeStart()` - Quick-send recording
  - `handleConversationRecordingStart()` - Conversation recording
  - `startRecording()` - Universal recording with VAD

### 4. SimpleVAD
- **Location:** `web/static/js/voice-control/services/microphone/simple-vad.js`
- **Role:** Voice Activity Detection
- **Config:**
  - `silenceThreshold: 0.01` (RMS)
  - `silenceDuration: 1500ms`
  - `minSpeechDuration: 300ms`

### 5. ConversationUIController
- **Location:** `web/static/js/voice-control/conversation/ui-controller.js`
- **Role:** Візуальні індикатори
- **CSS Classes:**
  - `.mode-idle` - Standby (зелений border)
  - `.mode-quick-send` - Синій pulse
  - `.mode-conversation` - Зелений pulse

## 📊 Event Flow

### Quick-Send Events
```
CONVERSATION_MODE_QUICK_SEND_START
  → AUDIO_READY_FOR_TRANSCRIPTION
    → WHISPER_TRANSCRIPTION_COMPLETED
      → SEND_CHAT_MESSAGE
        → (Atlas processing)
          → TTS_STARTED
            → TTS_COMPLETED (isActivationResponse: false)
```

### Conversation Mode Events
```
CONVERSATION_MODE_ACTIVATED
  → START_KEYWORD_DETECTION
    → KEYWORD_DETECTED (response: "слухаю")
      → TTS_SPEAK_REQUEST (isActivationResponse: TRUE)
        → TTS_STARTED
          → TTS_COMPLETED (isActivationResponse: TRUE)
            → CONVERSATION_RECORDING_START
              → WHISPER_TRANSCRIPTION_COMPLETED
                → SEND_CHAT_MESSAGE
                  → TTS_STARTED
                    → TTS_COMPLETED (isActivationResponse: FALSE)
                      → Continuous Listening → LOOP
```

## 🎨 Visual Feedback States

| State | CSS Class | Animation | Button Color |
|-------|-----------|-----------|--------------|
| Idle | `.mode-idle` | None | Green border |
| Quick-send recording | `.mode-quick-send .recording` | Blue pulse | Blue gradient |
| Conversation active | `.mode-conversation` | Green pulse | Green gradient |
| Waiting for keyword | `.mode-conversation` | Breathing | Green pulse |
| Atlas speaking | `.atlas-speaking` | Orange pulse | Orange gradient |
| Continuous listening | `.continuous-listening` | Blue-green pulse | Cyan gradient |

## 🔒 Critical Flags

### isActivationResponse
**Purpose:** Розрізняє activation TTS vs chat response TTS

```javascript
// Activation response (після "Атлас")
{
  isActivationResponse: true,
  text: "слухаю",
  mode: "conversation"
}
// → After TTS: Start recording

// Chat response
{
  isActivationResponse: false,
  text: "Я можу відповісти на ваше запитання...",
  mode: "chat"
}
// → After TTS: Start continuous listening
```

### mode ('chat' vs 'task')
**Purpose:** Визначає чи продовжувати conversation loop

```javascript
// Chat mode - conversation loop продовжується
{ mode: 'chat', isInConversation: true }
→ TTS_COMPLETED → Continuous listening

// Task mode - conversation loop ЗУПИНЯЄТЬСЯ
{ mode: 'task', isInConversation: true }
→ TTS_COMPLETED → NO continuous listening (task execution)
```

## 📝 Known Issues & Solutions

### Issue: Activation response повторюється
**Solution:** ✅ FIXED - Rotation system з circular buffer

### Issue: Conversation loop не продовжується після TTS
**Solution:** ✅ FIXED - isActivationResponse flag + proper event routing

### Issue: Кнопка не показує режим
**Solution:** ✅ FIXED - CSS mode classes + UI controller updates

### Issue: VAD не детектує кінець фрази
**Solution:** ✅ Working - SimpleVAD з 1.5 sec silence threshold

## 🚀 Future Improvements

- [ ] Adaptive VAD thresholds (based on environment noise)
- [ ] Multi-language activation keywords
- [ ] Voice biometrics for user identification
- [ ] Context-aware activation responses
- [ ] Gesture-based mode switching
- [ ] Offline mode with Web Speech API fallback

---

**Last Updated:** 2025-10-11  
**Maintainer:** Atlas Development Team  
**Version:** 4.0.0
