# Voice Recognition System Testing Guide - 2025-10-11

## 🎯 Мета тестування
Перевірка всіх покращень системи голосового розпізнавання після оптимізацій.

## ✅ Що було змінено

### 1. Speaker Recognition System ✅
- Розпізнавання голосу користувача vs фонових осіб
- Автоматичне навчання профілю
- Фільтрація non-user speech

### 2. Optimized Performance ✅
- Whisper GPU: 20 → 30 шарів на Metal
- Threads: 4 → 6 потоків
- Chunk duration: 2.5s → 2.0s (-20%)
- Pause between chunks: 200ms → 100ms (-50%)
- VAD silence detection: 1.5s → 1.2s (-20%)
- Min speech duration: 300ms → 250ms (-17%)

### 3. Enhanced Audio Quality ✅
- Sample rate: 16kHz → 48kHz (+200%)
- Added: 128 kbps audio bitrate
- Added: 10ms low latency
- Added: Adaptive noise threshold

### 4. Improved Filtering ✅
- Expanded background phrases list
- Lower Whisper temperature: 0.2 → 0.0
- Enhanced initial prompt with context

## 🧪 Тестові сценарії

### Тест 1: Базова функціональність Quick-Send режиму

**Очікуваний результат:** Швидке розпізнавання без затримок

```
Кроки:
1. Відкрити http://localhost:5001
2. Клікнути кнопку мікрофона (одне натискання)
3. Сказати: "Привіт, Атлас!"
4. Відпустити кнопку

Перевірки:
✅ Запис починається миттєво
✅ VAD детектує кінець фрази через 1.2 сек тиші (було 1.5 сек)
✅ Транскрипція приходить швидше (-30-40%)
✅ Текст правильно розпізнаний
✅ Confidence > 0.9

Лог markers:
- "[MICROPHONE_BUTTON] 🎤 Quick-send mode: starting recording"
- "[SIMPLE_VAD] Speech end detected" (через 1.2 сек)
- "[WHISPER_SERVICE] Transcription: 'Привіт, Атлас!'"
```

### Тест 2: Conversation Mode з keyword detection

**Очікуваний результат:** Швидша реакція на keyword

```
Кроки:
1. Утримати кнопку мікрофона 2+ сек
2. Почути звук активації
3. Сказати: "Атлас"
4. Почути відповідь ("слухаю" або подібне)
5. Сказати запит: "Яка погода сьогодні?"

Перевірки:
✅ Keyword detection через 2.0 сек chunks (було 2.5 сек)
✅ Pause між chunks 100ms (було 200ms)
✅ Keyword розпізнається з першої спроби
✅ Запит обробляється швидко
✅ Conversation loop продовжується після TTS

Лог markers:
- "[WHISPER_KEYWORD] 🎯 KEYWORD DETECTED! – 'Атлас'"
- "[CONVERSATION_MODE] 💬 Conversation mode activated"
- "[WHISPER_SERVICE] Transcription: 'Яка погода сьогодні?'"
- "[APP] 🔊 Emitting TTS_COMPLETED"
- "[CONVERSATION_MODE] 🔄 Returning to keyword listening"
```

### Тест 3: Speaker Recognition (калібрування)

**Очікуваний результат:** Система навчається голосу користувача

```
Кроки:
1. Відкрити console браузера
2. Виконати: speakerRecognition.getCalibrationStatus()
3. Побачити: { isCalibrated: false, sampleCount: 0, samplesNeeded: 5 }
4. Зробити 5 запитів до Atlas (будь-які)
5. Знову виконати: speakerRecognition.getCalibrationStatus()

Перевірки:
✅ isCalibrated: false → true після 5 запитів
✅ sampleCount збільшується: 0 → 1 → 2 → ... → 5
✅ samplesNeeded зменшується: 5 → 4 → 3 → ... → 0
✅ Профіль зберігається в localStorage
✅ Після перезавантаження profil залишається

Команди для тестування:
```javascript
// Перевірити статус
speakerRecognition.getCalibrationStatus()

// Переглянути профіль
speakerRecognition.getUserProfile().export()

// Скинути профіль (для повторного тесту)
speakerRecognition.resetUserProfile()
```

Лог markers:
- "[SPEAKER_RECOGNITION] User voice profile updated (1 samples, calibrated: false)"
- "[SPEAKER_RECOGNITION] User voice profile updated (5 samples, calibrated: true)"
- "[SPEAKER_RECOGNITION] Saved 1 speaker profiles"
```

### Тест 4: Background Speaker Filtering

**Очікуваний результат:** Система ігнорує фонові голоси

```
Передумова: User profile calibrated (5+ зразків)

Сценарій А: Фонова особа говорить
Кроки:
1. Увімкнути conversation mode (утримати 2+ сек)
2. Сказати "Атлас" (активація)
3. Нехай хтось ІНШИЙ скаже запит (не користувач)

Перевірки:
✅ Система НЕ приймає запит від іншої особи
✅ Conversation mode залишається активним
✅ Чекає на голос користувача

Лог markers:
- "[ADAPTIVE_VAD] 🎤 Speaker: unknown (45% confidence)"
- "[ADAPTIVE_VAD] 🚫 Voice detected but not from user - filtering"

Сценарій Б: Користувач + фонова особа
Кроки:
1. Conversation mode активний
2. Фонова особа говорить (TV/YouTube)
3. Користувач говорить запит

Перевірки:
✅ Фонові фрази ігноруються
✅ Запит користувача обробляється
✅ Speaker recognition працює

Лог markers:
- "[WHISPER_KEYWORD] 🎬 Background phrase detected (YouTube/video ending), ignoring"
- "[ADAPTIVE_VAD] 🎤 Speaker: user (87% confidence)"
```

### Тест 5: Whisper Metal GPU Performance

**Очікуваний результат:** Швидший inference з GPU

```
Кроки:
1. Запустити Whisper service
2. Перевірити health endpoint:
   curl -s http://localhost:3002/health | jq

3. Зробити тестовий запит з аудіо
4. Виміряти час

Перевірки:
✅ device: "metal" (НЕ "cpu")
✅ ngl: 30 (НЕ 20)
✅ threads: 6 (НЕ 4)
✅ model: "ggml-large-v3.bin"
✅ Час інференсу < 1.5 сек (було ~2.5 сек)

Команди:
```bash
# Health check
curl -s http://localhost:3002/health | jq

# Очікуваний вивід:
{
  "status": "ok",
  "backend": "whisper.cpp",
  "binary": ".../build/bin/main",
  "device": "metal",
  "ngl": 30,
  "threads": 6,
  "model_path": ".../ggml-large-v3.bin"
}

# Тест швидкості
time curl -X POST http://localhost:3002/transcribe_blob \
  --data-binary @test_audio.wav \
  -H "Content-Type: application/octet-stream"

# Очікуваний час: ~1.2-1.6 сек (було ~2.0-2.5 сек)
```
```

### Тест 6: Adaptive VAD Noise Threshold

**Очікуваний результат:** Автоматична адаптація до шуму

```
Кроки:
1. Тихе середовище: зробити запис
2. Шумне середовище (музика/вентилятор): зробити запис
3. Порівняти thresholds

Перевірки:
✅ Тихе: threshold ≈ 0.01 (базовий)
✅ Шумне: threshold > 0.01 (адаптований)
✅ VAD коректно детектує мову в обох випадках
✅ Немає false positives від фонового шуму

Лог markers:
- "[SIMPLE_VAD] Adaptive threshold: 0.015 (baseline: 0.006)"
- "[SIMPLE_VAD] Speech detected above adaptive threshold"
```

### Тест 7: End-to-End Latency

**Очікуваний результат:** Загальна затримка зменшена

```
Виміряти час від натискання до відповіді:

Quick-send mode:
1. Натиснути мікрофон
2. Сказати "Привіт"
3. Відпустити
4. Дочекатися відповіді Atlas

Очікувані часи:
✅ VAD detection: 1.2 сек (було 1.5 сек) - ⬇️ 20%
✅ Whisper inference: 1.3 сек (було 2.0 сек) - ⬇️ 35%
✅ Atlas response: 2-3 сек (без змін)
✅ TOTAL: ~4.5-5.5 сек (було ~5.5-6.5 сек) - ⬇️ 15-18%

Conversation mode:
1. Активувати conversation mode
2. Сказати "Атлас"
3. Дочекатися звуку
4. Сказати запит
5. Дочекатися відповіді

Очікувані часи:
✅ Keyword detection: 2.0 сек chunks (було 2.5 сек) - ⬇️ 20%
✅ Pause між chunks: 100ms (було 200ms) - ⬇️ 50%
✅ Request processing: як у quick-send
✅ TOTAL для keyword: 2.1-2.5 сек (було 2.7-3.0 сек) - ⬇️ 20-25%
```

### Тест 8: Background Phrases Filtering

**Очікуваний результат:** Розширений список фонових фраз

```
Тестові фрази (мають бути проігноровані):
- "Дякую за перегляд!"
- "Субтитрувальниця Оля Шор"
- "До зустрічі!"
- "Підписуйтесь на канал"
- "Коментуйте"

Кроки:
1. Conversation mode активний
2. Відтворити відео з цими фразами
3. Спостерігати логи

Перевірки:
✅ Всі фрази ігноруються
✅ Жодна не йде в chat
✅ Conversation mode залишається активним

Лог markers:
- "[WHISPER_KEYWORD] 🎬 Background phrase detected (YouTube/video ending), ignoring: – 'Дякую за перегляд!'"
- "[WHISPER_KEYWORD] 🎬 Background phrase detected (YouTube/video ending), ignoring: – 'Субтитрувальниця Оля Шор'"
```

## 📊 Performance Benchmarks

### Before Optimizations:
```
Keyword detection:      2.5-3.0 sec per chunk
Whisper inference:      2.0-2.5 sec
VAD silence detection:  1.5 sec
Total latency:          5.5-6.5 sec
GPU layers:             20
Threads:                4
```

### After Optimizations:
```
Keyword detection:      2.0-2.5 sec per chunk  (⬇️ 20%)
Whisper inference:      1.2-1.6 sec           (⬇️ 35-40%)
VAD silence detection:  1.2 sec                (⬇️ 20%)
Total latency:          4.5-5.5 sec           (⬇️ 15-18%)
GPU layers:             30                     (⬆️ 50%)
Threads:                6                      (⬆️ 50%)
```

## 🔧 Debugging Commands

### Browser Console:

```javascript
// Перевірити Speaker Recognition статус
speakerRecognition.getCalibrationStatus()

// Переглянути user profile
speakerRecognition.getUserProfile().export()

// Переглянути всі profiles
speakerRecognition.profiles

// Reset user profile
speakerRecognition.resetUserProfile()

// Перевірити VAD config
// (доступ через voice control manager)

// Перевірити audio config
console.log(AUDIO_CONFIG)
```

### Server Commands:

```bash
# Whisper service health
curl -s http://localhost:3002/health | jq

# Whisper models
curl -s http://localhost:3002/models | jq

# Test transcription
curl -X POST http://localhost:3002/transcribe_blob \
  --data-binary @audio.wav \
  -H "Content-Type: application/octet-stream" | jq

# Restart з новими параметрами
WHISPER_CPP_THREADS=6 WHISPER_CPP_NGL=30 ./restart_system.sh
```

## ✅ Acceptance Criteria

### Must Pass:
- ✅ All 8 test scenarios pass
- ✅ Whisper using Metal GPU (ngl=30, threads=6)
- ✅ Speaker recognition calibrated after 5 samples
- ✅ Latency reduced by 15%+ overall
- ✅ Background phrases filtered correctly
- ✅ No regressions in basic functionality

### Nice to Have:
- ⭐ Latency reduced by 20%+
- ⭐ Speaker recognition accuracy > 85%
- ⭐ Zero false positives from background speakers
- ⭐ Adaptive VAD reduces noise false positives

## 🐛 Known Issues & Workarounds

### Issue 1: Quick-send mode ignored in processing state
**Status:** Існуюча проблема з логів
**Workaround:** Дочекатися завершення поточного processing
**Long-term fix:** State machine refactoring (TODO)

### Issue 2: Speaker recognition потребує калібрування
**Status:** By design - потрібно 5+ зразків
**Workaround:** Зробити 5 запитів при першому використанні
**Improvement:** Додати UI indicator (TODO)

### Issue 3: Adaptive VAD може бути надто чутливим
**Status:** Під спостереженням
**Workaround:** Можна вимкнути: `adaptiveThreshold: false`
**Tuning:** Можливо знадобиться fine-tuning threshold multiplier

## 📝 Reporting Results

Після тестування, заповніть:

```
Тестовий прогон: [Дата/Час]
Тестувальник: [Ім'я]
Середовище: [Mac Studio M1 Max / інше]

Результати:
- Тест 1 (Quick-Send): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 2 (Conversation): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 3 (Calibration): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 4 (Filtering): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 5 (GPU): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 6 (Adaptive VAD): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 7 (Latency): ✅ PASS / ❌ FAIL - [коментарі]
- Тест 8 (Background): ✅ PASS / ❌ FAIL - [коментарі]

Performance:
- Keyword detection: [секунди]
- Whisper inference: [секунди]
- Total latency: [секунди]
- GPU check: device=[metal/cpu], ngl=[число]

Issues:
[Опис будь-яких проблем]

Висновки:
[Загальна оцінка]
```

## 🚀 Next Steps

Після успішного проходження всіх тестів:
1. Deploy to production
2. Monitor performance metrics
3. Collect user feedback
4. Fine-tune parameters as needed
5. Consider Phase 3 improvements
