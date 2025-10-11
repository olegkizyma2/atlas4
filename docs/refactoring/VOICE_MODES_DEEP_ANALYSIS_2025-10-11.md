# Voice Modes Deep Analysis - 11 жовтня 2025

## 🎯 Мета

Глибокий аналіз та повний рефакторинг двох голосових режимів для усунення всіх проблем у conversation loop і забезпечення правильної роботи обох режимів.

## 📋 Вимоги користувача

### Режим 1: Quick-Send (Один клік)
1. Користувач натискає кнопку мікрофону
2. Система починає запис
3. VAD детектує кінець мовлення (пауза після завершення монологу)
4. Автоматична відправка в Whisper
5. Транскрипція → чат → Atlas відповідає → TTS → ЗАВЕРШЕННЯ

**Ключова особливість:** Одноразова операція, система повертається в idle після TTS.

### Режим 2: Conversation (Утримання 2 сек)
1. Користувач утримує кнопку 2+ секунди
2. Система активує conversation mode
3. **Фаза Keyword Detection:** Прослуховування слова "Атлас"
4. Користувач каже "Атлас"
5. Atlas відзивається (TTS): "Слухаю" / "Так, я в увазі" / інші варіації
6. **КРИТИЧНО:** Після TTS відповіді - автоматичний початок запису
7. Користувач говорить запит
8. VAD детектує кінець мовлення (дає трохи часу після паузи щоб переконатись що користувач закінчив)
9. Відправка в Whisper → транскрипція → чат
10. Atlas відповідає → TTS озвучує
11. **ЦИКЛІЧНА ЧАСТИНА:** Після TTS Atlas система автоматично починає слухати (БЕЗ keyword "Атлас"!)
12. Якщо користувач починає говорити → VAD детектує → повтор кроків 8-11
13. Якщо тиша декілька секунд (5 сек) → повернення до фази Keyword Detection (крок 3)
14. Повний вихід: користувач перестає говорити на деякий час → діалог завершується

**Ключова особливість:** Безперервний цикл STT→TTS→STT, keyword "Атлас" потрібен тільки після тиші.

## 🔍 Поточна Архітектура

### Компоненти системи

#### 1. ConversationModeManager
**Файл:** `web/static/js/voice-control/conversation-mode-manager.js`

**Відповідальність:**
- Управління режимами (idle → quick-send → conversation)
- Координація conversation loop
- Обробка keyword detection
- Обробка TTS completion events
- Запуск continuous listening

**Ключові методи:**
- `activateQuickSendMode()` - Режим 1
- `activateConversationMode()` - Режим 2
- `startListeningForKeyword()` - Очікування "Атлас"
- `onKeywordActivation()` - Обробка детекції + activation response TTS
- `handleTTSCompleted()` - Розпізнавання типу TTS (activation vs chat response)
- `startConversationRecording()` - Початок запису після keyword/TTS
- `startContinuousListening()` - Автоматичний loop після Atlas TTS

#### 2. MicrophoneButtonService
**Файл:** `web/static/js/voice-control/services/microphone-button-service.js`

**Відповідальність:**
- Управління MediaRecorder
- VAD integration
- Обробка audio streams
- Відправка на транскрипцію

**Ключові методи:**
- `handleQuickSendModeStart()` - Quick-send запис
- `handleConversationRecordingStart()` - Conversation запис
- `startRecording()` - Універсальний метод запису
- `stopRecording()` - Зупинка + відправка на транскрипцію

#### 3. WhisperKeywordDetection
**Файл:** `web/static/js/voice-control/services/whisper-keyword-detection.js`

**Відповідальність:**
- Continuous listening для keyword "Атлас"
- 2.5 сек audio chunks → Whisper → перевірка
- Генерація activation responses з ротацією

**Workflow:**
```
Loop:
1. Record 2.5 sec
2. Send to Whisper
3. Check if contains "атлас"
   → YES: emit KEYWORD_DETECTED with response
   → NO: pause 200ms, repeat
```

#### 4. SimpleVAD
**Файл:** `web/static/js/voice-control/services/microphone/simple-vad.js`

**Відповідальність:**
- Voice Activity Detection
- Автоматичне визначення кінця мовлення

**Параметри:**
- `silenceThreshold`: 0.01 (RMS level)
- `silenceDuration`: 1500ms (1.5 сек тиші)
- `minSpeechDuration`: 300ms (мінімум для валідної мови)

## 🔄 Event Flow Analysis

### Режим 1: Quick-Send

```
User: Клік кнопки
  ↓
ConversationModeManager: endPressTimer() 
  → emit CONVERSATION_MODE_QUICK_SEND_START
  ↓
MicrophoneButtonService: handleQuickSendModeStart()
  → startRecording(mode: 'quick-send')
  ↓
MediaManager: Запуск MediaRecorder + VAD
  ↓
VAD: Детекція тиші (1.5 сек)
  → handleSilenceDetected()
  ↓
MicrophoneButtonService: stopRecording('silence')
  → submitForTranscription()
  ↓
WhisperService: POST /transcribe
  → emit WHISPER_TRANSCRIPTION_COMPLETED
  ↓
ConversationModeManager: handleTranscriptionComplete()
  → onQuickSendTranscription()
  → sendToChat()
  ↓
ChatManager: Відправка в orchestrator
  ↓
Orchestrator: Обробка → Atlas response
  ↓
ChatManager: emit 'tts-stop' (після TTS)
  ↓
app-refactored.js: emit TTS_COMPLETED (mode: 'chat', isInConversation: false)
  ↓
ConversationModeManager: handleTTSCompleted()
  → НЕ conversation mode → ignore
  ↓
END (повернення в idle)
```

### Режим 2: Conversation - Повний цикл

#### Фаза 1: Активація

```
User: Утримання 2+ сек
  ↓
ConversationModeManager: startPressTimer()
  → setTimeout(2000ms)
  → activateConversationMode()
  ↓
State: idle → conversation
  ↓
UI: Зелений pulse, "Режим розмови активний"
  ↓
ConversationModeManager: startListeningForKeyword()
  → emit START_KEYWORD_DETECTION
  ↓
WhisperKeywordDetection: startListening()
  → Continuous loop (2.5 сек chunks)
```

#### Фаза 2: Keyword Detection

```
WhisperKeywordDetection: Loop
  1. Record 2.5 sec chunk
  2. POST /transcribe
  3. containsActivationKeyword(text)
  ↓
✅ Keyword detected: "атлас"
  ↓
Response = getRandomActivationResponse()
  → "Слухаю" / "В увазі" / "Готовий до роботи" / etc.
  → Rotation prevents repeats
  ↓
emit KEYWORD_DETECTED {
  keyword: "атлас",
  response: "Слухаю",
  confidence: 0.95
}
  ↓
ConversationModeManager: handleKeywordDetected()
  → onKeywordActivation(response)
```

#### Фаза 3: Activation Response

```
ConversationModeManager: onKeywordActivation("Слухаю")
  ↓
emit TTS_SPEAK_REQUEST {
  text: "Слухаю",
  agent: 'atlas',
  mode: 'conversation',
  isActivationResponse: TRUE ← КРИТИЧНИЙ FLAG
}
  ↓
TTSManager: Synthesis + playback
  ↓
TTSManager: emit 'tts-stop' (isActivationResponse: true)
  ↓
app-refactored.js: emit TTS_COMPLETED {
  mode: 'conversation',
  isInConversation: true,
  isActivationResponse: TRUE ← КРИТИЧНО!
}
  ↓
ConversationModeManager: handleTTSCompleted()
  → if (isActivationResponse) {
      startConversationRecording() // Пауза 300ms
    }
```

#### Фаза 4: User Request Recording

```
ConversationModeManager: startConversationRecording()
  → emit CONVERSATION_RECORDING_START
  ↓
MicrophoneButtonService: handleConversationRecordingStart()
  → startRecording(mode: 'conversation')
  ↓
MediaManager: MediaRecorder + VAD active
  ↓
User: Говорить запит
  ↓
VAD: Детекція мовлення → тиші (1.5 сек) → auto-stop
  ↓
MicrophoneButtonService: stopRecording('silence')
  → submitForTranscription()
  ↓
WhisperService: POST /transcribe
  → emit WHISPER_TRANSCRIPTION_COMPLETED
  ↓
ConversationModeManager: handleTranscriptionComplete()
  → onConversationTranscription(text)
  → filterTranscription() // Intelligent filtering
  → sendToChat(text)
```

#### Фаза 5: Atlas Response

```
ChatManager: Відправка в orchestrator
  ↓
Orchestrator: Обробка запиту
  ↓
Atlas: Генерація відповіді
  ↓
ChatManager: TTS synthesis
  ↓
ChatManager: emit 'tts-stop' (isActivationResponse: false)
  ↓
app-refactored.js: emit TTS_COMPLETED {
  mode: 'chat',
  isInConversation: true,
  isActivationResponse: FALSE ← Це НЕ activation!
}
  ↓
ConversationModeManager: handleTTSCompleted()
  → if (!isActivationResponse && mode === 'chat') {
      startContinuousListening() // ← ЦИКЛІЧНИЙ LOOP ПОЧИНАЄТЬСЯ ТУТ!
    }
```

#### Фаза 6: Continuous Listening (ЦИКЛІЧНА)

```
ConversationModeManager: startContinuousListening()
  ↓
state.setWaitingForUserResponse(true)
  ↓
UI: "Слухаю... (говоріть або мовчіть 5 сек для виходу)"
  ↓
setTimeout(500ms) // Пауза для природності
  → startConversationRecording()
  ↓
responseWaitTimer = setTimeout(5000ms) // Timeout тиші
  → onUserSilenceTimeout()
  ↓
┌─────────────────────────────────────────┐
│  Тепер дві можливості:                  │
│  A) Користувач говорить                 │
│  B) 5 секунд тиші                       │
└─────────────────────────────────────────┘

A) Користувач говорить:
  ↓
MicrophoneButtonService: Recording active
  ↓
clearTimeout(responseWaitTimer) // Скасування timeout тиші
  ↓
VAD: Детекція кінця → auto-stop
  ↓
WhisperService: Транскрипція
  ↓
ConversationModeManager: onConversationTranscription()
  → filterTranscription()
  → sendToChat()
  ↓
Atlas: Відповідь → TTS
  ↓
TTS_COMPLETED (isActivationResponse: false)
  ↓
startContinuousListening() ← ПОВЕРНЕННЯ В ЦЕЙ ЦИКЛ!
  ↓
LOOP CONTINUES...

B) 5 секунд тиші:
  ↓
responseWaitTimer спрацьовує
  ↓
ConversationModeManager: onUserSilenceTimeout()
  → state.setWaitingForUserResponse(false)
  → startListeningForKeyword() ← ПОВЕРНЕННЯ ДО KEYWORD MODE
  ↓
BACK TO PHASE 2 (очікування "Атлас")
```

## ⚠️ Потенційні Проблеми

### 1. State Race Conditions
**Локація:** `MicrophoneButtonService.handleConversationRecordingStart()`

```javascript
// FIXED (11.10.2025 - 17:05): Дозволяємо 'processing' стан
const allowedStates = ['idle', 'processing'];
if (!allowedStates.includes(this.currentState)) {
  // БЛОК запису
}
```

**Проблема:** Після TTS resume, можливий стан 'processing', що блокував запис.  
**Рішення:** Дозволено 'processing' + примусовий reset в 'idle' перед записом.

**Питання:** Чи повністю вирішено race condition?

### 2. Event Name Consistency
**Локація:** Різні файли

```javascript
// event-manager.js
TTS_COMPLETED: 'tts.completed'

// conversation/constants.js
TTS_COMPLETED: 'TTS_COMPLETED' // String literal!

// app-refactored.js
eventManager.emit(VoiceEvents.TTS_COMPLETED) // Використовує 'tts.completed'

// conversation-mode-manager.js
this.eventManager.on(Events.TTS_COMPLETED) // FIXED: тепер використовує константу
```

**Проблема:** Невідповідність між string literals та constants могла призвести до пропущених events.  
**Статус:** ВИПРАВЛЕНО (11.10.2025 - 17:25) - тепер використовуються централізовані константи.

**Питання:** Чи всі місця перевірені?

### 3. VAD Timing
**Локація:** `SimpleVAD`

```javascript
silenceDuration: 1500ms // 1.5 сек тиші
minSpeechDuration: 300ms // Мінімум для валідної мови
```

**Питання від користувача:** "система дає ще трохи часу після завершення щоб розпізнати чи користувач повністю закінчив свій монолог"

**Поточна логіка:** VAD чекає 1.5 сек тиші після останнього звуку.

**Можлива проблема:** Чи достатньо 1.5 сек для природних пауз у мовленні? Можливо треба адаптивну логіку?

### 4. Continuous Listening Trigger
**Локація:** `ConversationModeManager.startContinuousListening()`

```javascript
setTimeout(() => {
  if (this.state.isWaitingForUserResponse() && this.state.isInConversation()) {
    this.startConversationRecording();
  }
}, 500);
```

**Питання:** Чи 500ms пауза оптимальна? Чи не занадто швидко після TTS?

### 5. Silence Timeout Value
**Локація:** `ConversationModeManager.startContinuousListening()`

```javascript
this.responseWaitTimer = setTimeout(() => {
  this.onUserSilenceTimeout();
}, 5000); // 5 секунд
```

**Питання від користувача:** "якщо протягом декілька секунд тиша, тоді іде завершення"

**Поточно:** 5 секунд фіксований timeout.

**Можлива проблема:** Чи достатньо 5 сек? Чи не занадто багато? Чи треба конфігуровано?

## 🎯 План Рефакторингу

### Етап 1: Валідація поточної реалізації ✅
- [x] Аналіз архітектури
- [x] Документація event flow
- [x] Виявлення потенційних проблем
- [ ] Запуск системи та тестування обох режимів
- [ ] Збір логів з реальної поведінки

### Етап 2: Виправлення виявлених проблем
- [ ] Перевірка всіх event subscriptions/emissions на consistency
- [ ] Валідація state transitions у MicrophoneButtonService
- [ ] Оптимізація VAD timing (адаптивна логіка?)
- [ ] Налаштування continuous listening delays
- [ ] Налаштування silence timeouts

### Етап 3: Покращення UX
- [ ] Додати візуальні індикатори стану VAD
- [ ] Покращити feedback при переході між фазами
- [ ] Додати конфігураційні параметри для timeouts
- [ ] Покращити error handling

### Етап 4: Тестування
- [ ] Режим 1: Quick-send повний цикл
- [ ] Режим 2: Conversation - keyword detection
- [ ] Режим 2: Continuous loop (3+ кроків)
- [ ] Режим 2: Silence timeout → keyword mode
- [ ] Режим 2: Manual exit
- [ ] Edge cases: швидке мовлення, довгі паузи, фонові шуми

### Етап 5: Документація
- [ ] Оновлення MICROPHONE_MODES.md
- [ ] Додання troubleshooting guide
- [ ] Додання configuration guide
- [ ] Оновлення коментарів у коді

## 🔧 Конфігурація для тестування

```javascript
// VAD Configuration
const VAD_CONFIG = {
  silenceThreshold: 0.01,      // RMS level
  silenceDuration: 1500,       // 1.5 сек
  minSpeechDuration: 300,      // 300мс
  
  // АДАПТИВНА ЛОГІКА (TODO):
  adaptiveSilence: true,       // Збільшення для довгих фраз
  maxSilenceDuration: 2500,    // Макс 2.5 сек
  speechLengthThreshold: 10000 // 10+ сек = довга фраза
};

// Conversation Timeouts
const CONVERSATION_TIMEOUTS = {
  longPress: 2000,              // 2 сек активація
  continuousPause: 500,         // 500мс після TTS
  activationPause: 300,         // 300мс після activation response
  silenceTimeout: 5000,         // 5 сек тиші → keyword mode
  
  // НАЛАШТОВУВАНІ (TODO):
  silenceTimeoutMin: 3000,     // Мін 3 сек
  silenceTimeoutMax: 10000     // Макс 10 сек
};
```

## 📊 Метрики для моніторингу

- Час від keyword до початку запису
- Час від TTS до continuous listening start
- Частота false VAD triggers
- Середня довжина conversation sessions
- Частота timeout exits vs manual exits
- Якість транскрипції (confidence scores)

## 🚀 Наступні кроки

1. **Запустити систему** і протестувати обидва режими
2. **Зібрати реальні логи** з browser console
3. **Ідентифікувати actual проблеми** (не потенційні)
4. **Виправити критичні issues** першими
5. **Оптимізувати UX** другими
6. **Додати конфігурацію** третіми

---

**Дата:** 11 жовтня 2025  
**Версія:** 1.0  
**Статус:** In Progress - Analysis Complete
