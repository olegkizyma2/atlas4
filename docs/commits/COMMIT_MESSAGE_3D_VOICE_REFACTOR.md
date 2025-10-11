🎨 3D Living System & Voice Continuous Listening - Complete Refactor

## 🎯 Overview
Повний рефакторинг 3D моделі та голосового управління для природньої взаємодії:
- Виправлено видимість 3D моделі (z-index layering)
- Інвертовано eye tracking (природній рух за мишкою)
- Додано living idle behavior (виглядання навколо)
- Реалізовано continuous listening в conversation mode

## ✅ 3D Model Improvements

### Z-Index Layering Fix
- model-container: z-index 0 → 5
- model-viewer: z-index 0 → 5
- logs-panel: z-index 1 → 10
- chat-panel: z-index 5 → 10
- **Result:** Model visible за текстом, текст читабельний

### Eye Tracking Reverse Fix
- Інвертовано horizontal tracking: `targetY = mousePosition.x * 25` → `targetY = -mousePosition.x * 25`
- **Result:** Миша вліво = модель дивиться вліво (природньо!)

### Living Idle Behavior
- Додано `performCuriousLook()` - виглядання в 5 напрямках
- Додано `returnToNeutralLook()` - плавне повернення
- Frequency: кожні 8-12 секунд при idle > 5 сек
- **Result:** Модель жива, періодично дивиться навколо

## 🎙️ Voice Control Continuous Listening

### Conversation Mode Refactor
**БУЛО:**
- Утримання 2с → "Атлас" → запис → відповідь → СТОП (потрібно знову "Атлас")

**СТАЛО:**
- Утримання 2с → "Атлас" → запис → відповідь → **АВТОЗАПИС** → цикл до тиші

### Implementation Details
1. `handleTTSCompleted()` - тепер викликає `startContinuousListening()`
2. `startContinuousListening()` - NEW METHOD
   - Автозапуск запису через 500ms БЕЗ keyword
   - 5-сек таймаут тиші → повернення до keyword mode
3. `onConversationTranscription()` - скасовує таймаут при успішній транскрипції
4. `onUserSilenceTimeout()` - повернення до keyword detection

### Visual Indicators
- Додано CSS `.btn.continuous-listening` з блакитною анімацією
- Status: "Слухаю... (говоріть або мовчіть 5 сек для виходу)"

## 📝 Files Changed

### CSS
- `web/static/css/main.css` (4 changes)
  - Z-index hierarchy fix (4 місця)
  - Continuous listening animation (NEW)

### JavaScript - 3D Model
- `web/static/js/components/model3d/atlas-glb-living-system.js` (3 changes)
  - `updateEyeTracking()` - reversed horizontal
  - `updateIdleBehavior()` - додано curious look trigger
  - `performCuriousLook()` - NEW METHOD
  - `returnToNeutralLook()` - NEW METHOD

### JavaScript - Voice Control
- `web/static/js/voice-control/conversation-mode-manager.js` (4 changes)
  - `handleTTSCompleted()` - refactored to auto-start
  - `startContinuousListening()` - NEW METHOD
  - `onUserSilenceTimeout()` - NEW METHOD
  - `onConversationTranscription()` - додано silence timer reset
  - `startWaitingForUserResponse()` - deprecated, redirects

## 🔧 Configuration Verified
- Whisper.cpp Metal Large-v3 ✅
- NGL=20 (20 layers on GPU) ✅
- Ukrainian activation words dictionary ✅

## 📖 Documentation
- `docs/3D_AND_VOICE_REFACTORING_2025-10-11.md` (NEW)
- `.github/copilot-instructions.md` (UPDATED)

## 🧪 Testing Checklist
- [ ] 3D Model видима на всіх браузерах
- [ ] Eye tracking природній (миша = погляд)
- [ ] Idle behavior працює (дивиться навколо)
- [ ] Quick-send mode працює
- [ ] Conversation mode: утримання → "Атлас" → цикл
- [ ] Continuous listening автоматично після TTS
- [ ] 5 сек тиші → exit to keyword mode
- [ ] Whisper Metal logs показують GPU

## 🚀 Deploy & Test
```bash
./restart_system.sh restart
tail -f logs/whisper.log | grep -i metal
```

---
**Version:** ATLAS v4.0
**Date:** 11 жовтня 2025
**Status:** ✅ Ready for testing
