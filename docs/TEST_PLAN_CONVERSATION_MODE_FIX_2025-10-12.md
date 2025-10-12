# Тестовий План - Conversation Mode Fix (12.10.2025)

## 🎯 Мета тестування

Перевірити що виправлення subscription на `KEYWORD_DETECTED` повністю вирішило проблему з activation response в Conversation Mode.

## 🧪 Передумови

1. Система ATLAS запущена (backend + frontend)
2. Whisper service працює (http://localhost:3002)
3. TTS service працює (http://localhost:3001)
4. Браузер відкрито на http://localhost:5001
5. Мікрофон підключений і дозволений
6. Browser console відкрито (F12)

## ✅ Тестові кейси

### Test 1: Quick-Send Mode (Режим 1) - Базова функціональність

**Кроки:**
1. Клікнути на кнопку мікрофона (🎤)
2. Сказати "Раз, два, три, чотири"
3. Почекати автостоп (VAD - 1.5 сек тиші)

**Очікуваний результат:**
- ✅ Запис починається
- ✅ VAD детектує кінець фрази
- ✅ Whisper транскрибує: "Раз, два, три, чотири"
- ✅ Текст з'являється в чаті від User
- ✅ Atlas відповідає
- ✅ TTS озвучує відповідь Atlas

**Лог в консолі:**
```
[MICROPHONE_BUTTON] Starting recording
[MICROPHONE_BUTTON] VAD: Silence detected - triggering auto-stop
[WHISPER] Transcription: "Раз, два, три, чотири"
[CHAT] sendMessage: "Раз, два, три, чотири"
[TTS] Speaking for atlas: ...
```

---

### Test 2: Conversation Mode Activation (Режим 2) - Активація

**Кроки:**
1. Утримувати кнопку мікрофона 2+ секунди
2. Відпустити кнопку

**Очікуваний результат:**
- ✅ Після 2 сек: "Conversation mode activated"
- ✅ Кнопка змінює колір (indicates conversation mode)
- ✅ Статус: "Listening for keyword..."
- ✅ Whisper keyword detection починає слухати

**Лог в консолі:**
```
[CONVERSATION] 🎬 Activating conversation mode...
[CONVERSATION] 💬 Conversation mode activated
[CONVERSATION] 👂 Listening for keyword...
[WHISPER_KEYWORD] 🎙️ Starting keyword listening...
```

---

### Test 3: Keyword Detection + Activation Response (КРИТИЧНИЙ!)

**Кроки:**
1. В Conversation Mode (після Test 2)
2. Сказати "Атлас"
3. Почекати ~2 секунди

**Очікуваний результат:**
- ✅ Whisper детектує "Атлас"
- ✅ **НОВИЙ**: В консолі: `[CONVERSATION] 🔔 KEYWORD_DETECTED event received`
- ✅ **НОВИЙ**: В чаті з'являється від Atlas: "слухаю" (або інша відповідь з ротації)
- ✅ **НОВИЙ**: TTS озвучує: "слухаю"
- ✅ **НОВИЙ**: Після TTS → починається запис користувача

**Лог в консолі (КРИТИЧНИЙ - має бути ВЕСЬ цей flow!):**
```
[WHISPER_KEYWORD] 📝 Transcribed: "Атлас"
[WHISPER_KEYWORD] 🎯 KEYWORD DETECTED! Атлас
[WHISPER_KEYWORD] 🗣️ Generated response: слухаю команди
[WHISPER_KEYWORD] 📡 Emitting KEYWORD_DETECTED event...
[WHISPER_KEYWORD] ✅ KEYWORD_DETECTED event emitted
[CONVERSATION] 🔔 KEYWORD_DETECTED event received in ConversationModeManager!  ← ⭐ КЛЮЧОВИЙ ЛОГ!
[CONVERSATION] 📨 Received KEYWORD_DETECTED event: {response: "слухаю команди", ...}
[CONVERSATION] ✅ Keyword matched! Activating with response...
[CONVERSATION_MODE] 🎯 Keyword activation triggered, response: "слухаю команди"
[CONVERSATION_MODE] 💬 Adding activation response to chat: "слухаю команди"  ← ⭐ ЧАТ!
[CONVERSATION_MODE] 🔊 Playing activation response: "слухаю команди"  ← ⭐ TTS!
[TTS] 🔊 TTS_SPEAK_REQUEST received: "слухаю команди"
[TTS] Speaking for atlas: слухаю команди...
[TTS] Audio playback completed {isActivationResponse: true}
[CONVERSATION] 🔊 TTS_COMPLETED event received! {isActivationResponse: true}
[CONVERSATION_MODE] 🎙️ Activation response completed - starting conversation recording  ← ⭐ ЗАПИС!
```

**Візуальна перевірка:**
- ✅ В чаті: "Atlas: слухаю команди" (або інша фраза)
- ✅ Чути голос Atlas: "слухаю команди"
- ✅ Після озвучення: статус "Записую..." + червона кнопка

---

### Test 4: User Request After Activation (Цикл 1)

**Кроки:**
1. Після Test 3 (коли почався запис)
2. Сказати "Розкажи про штучний інтелект"
3. Почекати VAD автостоп

**Очікуваний результат:**
- ✅ VAD детектує кінець фрази
- ✅ Whisper транскрибує: "Розкажи про штучний інтелект"
- ✅ Текст з'являється в чаті від User (БЕЗ TTS!)
- ✅ Atlas генерує відповідь
- ✅ Atlas відповідь в чаті
- ✅ TTS озвучує Atlas відповідь

**Лог в консолі:**
```
[MICROPHONE_BUTTON] VAD: Silence detected - auto-stop
[WHISPER] Transcription: "Розкажи про штучний інтелект"
[CONVERSATION_MODE] 📝 Transcription received: "Розкажи про штучний інтелект"
[CHAT] sendMessage: "Розкажи про штучний інтелект" (user)
[ORCHESTRATOR] Stream started...
[CHAT] addMessage: "..." (atlas)
[TTS] Speaking for atlas: ...
```

---

### Test 5: Continuous Loop (Цикл 2+)

**Кроки:**
1. Після Test 4 (Atlas закінчив говорити)
2. Почекати ~500ms
3. Сказати "А що з машинним навчанням?"
4. Почекати VAD автостоп

**Очікуваний результат:**
- ✅ **Автоматично** починається запис (БЕЗ слова "Атлас"!)
- ✅ Статус: "Слухаю... (говоріть або мовчіть 5 сек для виходу)"
- ✅ Whisper транскрибує
- ✅ Текст в чаті від User
- ✅ Atlas відповідає
- ✅ TTS озвучує
- ✅ Після TTS → знову автоматичний запис

**Лог в консолі:**
```
[TTS] Audio playback completed {isActivationResponse: false, mode: 'chat'}
[CONVERSATION] 🔊 TTS_COMPLETED event received! {mode: 'chat'}
[CONVERSATION_MODE] 🔊 Atlas finished speaking - starting continuous listening  ← ⭐ АВТОЦИКЛ!
[CONVERSATION_MODE] 🔄 Starting continuous listening (no keyword needed)
[CONVERSATION_MODE] 🎤 Started conversation recording
```

---

### Test 6: Exit via Silence (5 секунд тиші)

**Кроки:**
1. В Continuous Loop (після Test 5)
2. НЕ говорити нічого 5+ секунд

**Очікуваний результат:**
- ✅ Через 5 секунд: "User silence timeout"
- ✅ Повернення до keyword detection mode
- ✅ Статус: "Listening for keyword..."
- ✅ Знову чекає на слово "Атлас"

**Лог в консолі:**
```
[CONVERSATION_MODE] ⏱️ User silence timeout (5 sec) - returning to keyword mode
[CONVERSATION_MODE] 🔄 Returning to keyword detection mode after silence
[WHISPER_KEYWORD] 🎙️ Starting keyword listening...
```

---

### Test 7: Exit via Manual Click

**Кроки:**
1. В Conversation Mode (будь-який момент)
2. Клікнути на кнопку мікрофона

**Очікуваний результат:**
- ✅ Conversation mode деактивується
- ✅ Повернення до idle
- ✅ Кнопка повертається до нормального стану

**Лог в консолі:**
```
[CONVERSATION] 🛑 Deactivating conversation mode by click
[CONVERSATION] 💬 Conversation mode deactivated
```

---

### Test 8: Activation Response Rotation

**Кроки:**
1. Виконати Test 2-3 (активація + "Атлас") **5 разів підряд**
2. Записати всі activation responses

**Очікуваний результат:**
- ✅ Кожна відповідь **різна** (ротація без повторів)
- ✅ Можливі фрази:
  - "я уважно Вас слухаю Олег Миколайович"
  - "так творець, ви мене звали"
  - "весь в увазі"
  - "слухаю"
  - "що бажаєте?"
  - "слухаю команди"
  - ... (всього 20 варіантів)

**Лог в консолі:**
```
Спроба 1: [WHISPER_KEYWORD] 🗣️ Generated response: слухаю
Спроба 2: [WHISPER_KEYWORD] 🗣️ Generated response: весь в увазі
Спроба 3: [WHISPER_KEYWORD] 🗣️ Generated response: що бажаєте?
Спроба 4: [WHISPER_KEYWORD] 🗣️ Generated response: готовий до роботи
Спроба 5: [WHISPER_KEYWORD] 🗣️ Generated response: я уважно Вас слухаю Олег Миколайович
```

---

## 🚨 Failure Scenarios (Що НЕ має статися)

### ❌ Scenario 1: Event Not Received (OLD BUG)
**Симптом**: "Атлас" детектується, але НЕМАЄ логу `[CONVERSATION] 🔔 KEYWORD_DETECTED event received`  
**Діагноз**: subscribeToSystemEvents() не викликається - BUG NOT FIXED!

### ❌ Scenario 2: No Chat Message
**Симптом**: TTS озвучує, але в чаті немає "Atlas: слухаю"  
**Діагноз**: chatManager.addMessage() failed або не викликається

### ❌ Scenario 3: No TTS Playback
**Симптом**: В чаті є "Atlas: слухаю", але БЕЗ озвучення  
**Діагноз**: TTS_SPEAK_REQUEST не емітується або TTSManager не отримує

### ❌ Scenario 4: No Recording After TTS
**Симптом**: TTS озвучує, але запис НЕ починається  
**Діагноз**: handleTTSCompleted() не викликається або isActivationResponse=false

### ❌ Scenario 5: Loop Не Працює
**Симптом**: Після 1 запиту conversation mode завершується  
**Діагноз**: startContinuousListening() не викликається або mode не 'chat'

---

## 📊 Success Criteria

### ✅ PASS критерії:

1. **Test 3 - КРИТИЧНИЙ**: ВСІ логи присутні, включаючи:
   - `[CONVERSATION] 🔔 KEYWORD_DETECTED event received` ⭐
   - `[CONVERSATION_MODE] 💬 Adding activation response to chat` ⭐
   - `[TTS] 🔊 TTS_SPEAK_REQUEST received` ⭐
   - `[CONVERSATION_MODE] 🎙️ Activation response completed` ⭐

2. **Test 4-5**: Continuous loop працює мінімум 3 цикли

3. **Test 6-7**: Exit conditions працюють коректно

4. **Test 8**: Ротація без повторів (5+ різних фраз)

### ❌ FAIL критерії:

- Будь-який з ❌ Failure Scenarios
- Відсутність критичних логів з Test 3
- Loop не продовжується після 1 запиту
- Activation response не в чаті або без TTS

---

## 🔍 Debug Checklist

Якщо тест не проходить:

1. **Перевірити subscription**:
   ```javascript
   // В browser console:
   window.atlasApp.managers.conversationMode._eventManager
   // Має бути EventManager instance
   ```

2. **Перевірити event flow**:
   - WhisperKeywordDetection емітує? → шукати лог `[WHISPER_KEYWORD] ✅ KEYWORD_DETECTED event emitted`
   - ConversationModeManager отримує? → шукати лог `[CONVERSATION] 🔔 KEYWORD_DETECTED event received`

3. **Перевірити chatManager**:
   ```javascript
   window.atlasApp.chatManager
   // Має існувати і мати метод addMessage
   ```

4. **Перевірити TTSManager**:
   ```javascript
   window.atlasApp.ttsManager
   // Має існувати і бути subscribed на TTS_SPEAK_REQUEST
   ```

---

## 📝 Тестовий результат (заповнити після тестування)

| Test # | Назва | Статус | Примітки |
|--------|-------|--------|----------|
| 1 | Quick-Send Mode | ⬜ | |
| 2 | Conversation Activation | ⬜ | |
| 3 | Keyword + Activation Response | ⬜ | КРИТИЧНИЙ! |
| 4 | User Request (Цикл 1) | ⬜ | |
| 5 | Continuous Loop (Цикл 2+) | ⬜ | |
| 6 | Exit via Silence | ⬜ | |
| 7 | Exit via Click | ⬜ | |
| 8 | Response Rotation | ⬜ | |

**Загальний статус**: ⬜ Не тестовано / ✅ PASS / ❌ FAIL

**Тестував**: _______________  
**Дата**: _______________  
**Версія коду**: 67583af (або новіша)

---

## 🎯 Post-Test Actions

Якщо ✅ PASS:
1. Видалити debug logging (console.log statements)
2. Оновити документацію з результатами
3. Закрити Issue/PR як вирішений

Якщо ❌ FAIL:
1. Записати детальні логи помилки
2. Створити новий Issue з debugging info
3. Re-analyze root cause
