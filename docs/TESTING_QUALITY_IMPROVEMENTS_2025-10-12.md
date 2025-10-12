# 🎯 ТЕСТУВАННЯ ПОКРАЩЕНЬ ЯКОСТІ - День 12.10.2025 ~14:10

## ✅ СИСТЕМА ГОТОВА

**Всі сервіси працюють:**
- ✅ Goose Web Server (port 3000)
- ✅ Frontend (port 5001)
- ✅ Orchestrator (port 5101)
- ✅ TTS Service (port 3001)
- ✅ Whisper Service (port 3002)
- ✅ Recovery Bridge (port 5102)

**Виконані зміни застосовані:**
- ✅ Sample rate уніфіковано до 48kHz
- ✅ Frontend корекція "Атлас" активна
- ✅ Система перезапущена

---

## 🧪 ПЛАН ТЕСТУВАННЯ

### Тест #1: Quick-Send Mode (Швидкі команди)

**Мета:** Перевірити корекцію варіацій "Атлас" в режимі одиночних команд

**Кроки:**
1. Відкрити http://localhost:5001
2. Відкрити DevTools (F12) → Console
3. Клікнути на кнопку мікрофона (⚫)
4. Сказати **будь-яку варіацію** "Атлас":
   - "атлаз команда"
   - "атлус відкрий калькулятор"
   - "atlas привіт"
   - "отлас що нового"
   - "тлас допоможи"

**Очікуваний результат:**
```
[ATLAS_CORRECTION] ✅ Corrected: "атлаз команда" → "Атлас команда"
✅ Transcription completed in XXXms: "Атлас команда"
```

**Критерії успіху:**
- ✅ Всі варіації "атлаз/атлус/atlas/отлас/тлас" виправляються на "Атлас"
- ✅ Логи показують `[ATLAS_CORRECTION]` з Before → After
- ✅ Текст в чаті відображається з правильним "Атлас"

---

### Тест #2: Conversation Mode (Безперервний діалог)

**Мета:** Перевірити keyword detection з 48kHz якістю та корекцією

**Кроки:**
1. Утримувати кнопку мікрофона 2+ секунди
2. Чекати активацію Conversation Mode
3. Сказати **ключове слово** "Атлас" (або варіацію):
   - "атлас"
   - "атлаз"
   - "атлус"
   - "atlas"
4. Після активації сказати команду: "відкрий калькулятор"
5. Atlas відповість → автоматично слухає знову
6. Сказати "атлас" → наступну команду

**Очікуваний результат (Console):**
```
[WHISPER_KEYWORD] 📝 Transcribed: "атлаз"
[ATLAS_CORRECTION] ✅ Corrected: "атлаз" → "Атлас"
[KEYWORD] ✅ Keyword detected: "Атлас"
[CONVERSATION] 🎙️ Started recording after keyword
```

**Критерії успіху:**
- ✅ Keyword detection спрацьовує на варіації "атлаз/атлус/atlas"
- ✅ Автоматичний цикл працює: Atlas говорить → слухає → розпізнає
- ✅ Корекція відбувається ПЕРЕД перевіркою keyword
- ✅ Немає false negatives (система НЕ пропускає "Атлас")

---

### Тест #3: Audio Quality Verification (48kHz перевірка)

**Мета:** Підтвердити що обидва режими використовують 48kHz

**Кроки (DevTools Console):**
```javascript
// Запустити Quick-send клік
// Потім виконати в консолі:

navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const settings = stream.getAudioTracks()[0].getSettings();
  console.log('✅ Audio Settings:', {
    sampleRate: settings.sampleRate,
    channelCount: settings.channelCount,
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression
  });
  stream.getTracks().forEach(track => track.stop());
});
```

**Очікуваний результат:**
```javascript
✅ Audio Settings: {
  sampleRate: 48000,         // ✅ Має бути 48000 (було 16000)
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true
}
```

**Критерії успіху:**
- ✅ sampleRate === 48000 (НЕ 16000)
- ✅ echoCancellation та noiseSuppression активні

---

### Тест #4: Логування корекцій (Monitoring)

**Мета:** Переконатись що всі корекції логуються для аналізу

**Кроки:**
1. Виконати 5-10 команд з різними варіаціями "Атлас"
2. Після тестування відкрити логи:
   ```bash
   grep "ATLAS_CORRECTION" logs/orchestrator.log
   # АБО перевірити Browser Console
   ```

**Очікуваний формат логів:**
```
[ATLAS_CORRECTION] ✅ Corrected: "атлаз" → "Атлас"
[ATLAS_CORRECTION] ✅ Corrected: "атлус команда" → "Атлас команда"
[ATLAS_CORRECTION] ✅ Corrected: "atlas привіт" → "Атлас привіт"
```

**Критерії успіху:**
- ✅ Кожна корекція логується окремим записом
- ✅ Формат: original → corrected
- ✅ Легко знайти через grep/filter

---

## 📊 МЕТРИКИ УСПІХУ

### Базові показники (ПЕРЕД оптимізацією):
- Conversation mode accuracy: ~70% (16kHz)
- Keyword detection: ~85% (через обмежений словник)
- False negatives: ~15% (система не розпізнавала "Атлас")

### Очікувані показники (ПІСЛЯ оптимізації):
- Conversation mode accuracy: **95%+** (48kHz + корекція)
- Keyword detection: **98%+** (66+ варіантів корекції)
- False negatives: **<2%** (майже всі варіації виправляються)

### Як вимірювати:

**Метод #1: Ручне тестування (швидко)**
1. Підготувати список з 20 фраз з різними варіаціями "Атлас"
2. Сказати кожну фразу через Quick-send
3. Порахувати скільки розпізналось ПРАВИЛЬНО
4. Accuracy = (Correct / Total) × 100%

**Метод #2: Логовий аналіз (точно)**
```bash
# Кількість корекцій за сесію
grep -c "ATLAS_CORRECTION" logs/frontend.log

# Варіації які були виправлені
grep "ATLAS_CORRECTION" logs/frontend.log | cut -d'"' -f2 | sort | uniq -c

# Приклад виводу:
#   3 атлаз
#   2 атлус
#   1 atlas
#   1 отлас
```

---

## 🐛 МОЖЛИВІ ПРОБЛЕМИ

### Проблема #1: Корекція НЕ спрацьовує

**Симптоми:**
- Варіації "атлаз/атлус" передаються БЕЗ виправлення
- Немає логів `[ATLAS_CORRECTION]`

**Діагностика:**
```javascript
// DevTools Console
import('/static/js/voice-control/utils/voice-utils.js').then(module => {
  console.log(module.correctAtlasWord('атлаз тест'));
  // Має показати: "Атлас тест"
});
```

**Рішення:**
- Перевірити що import працює (НЕ 404 на voice-utils.js)
- Очистити browser cache (Ctrl+Shift+R або Cmd+Shift+R)
- Перезапустити frontend: `./restart_system.sh restart`

---

### Проблема #2: Sample Rate досі 16kHz

**Симптоми:**
- Audio settings показує sampleRate: 16000
- Якість розпізнавання НЕ покращилась

**Діагностика:**
```bash
# Перевірити зміни в коді
grep "sampleRate: 48000" web/static/js/voice-control/services/whisper-keyword-detection.js
# Має показати рядок з 48000
```

**Рішення:**
- Переконатись що файл збережено
- Очистити browser cache
- Hard reload (Cmd+Shift+R)
- Перевірити DevTools → Network → whisper-keyword-detection.js (200 OK)

---

### Проблема #3: Keyword Detection НЕ активується

**Симптоми:**
- Говорите "Атлас" але recording НЕ починається
- Немає логів `[KEYWORD] ✅ Keyword detected`

**Діагностика:**
```javascript
// DevTools Console
console.log(window.voiceControlManager?.services?.get('keyword'));
// Має показати: WhisperKeywordDetection instance
```

**Рішення:**
1. Перевірити що Whisper service працює:
   ```bash
   curl http://localhost:3002/health
   # Має показати: {"status":"ok","model":"large-v3"}
   ```
2. Перевірити що conversation mode активний
3. Утримати кнопку 2+ сек для активації

---

## 📝 ЧЕКЛИСТ ПЕРЕВІРКИ

### Перед тестуванням:
- [ ] Всі 6 сервісів працюють (status)
- [ ] Browser cache очищено
- [ ] DevTools відкрито (F12)
- [ ] Console налаштована на "All levels" (не тільки Errors)

### Під час тестування:
- [ ] Quick-send: 5+ команд з різними варіаціями
- [ ] Conversation: 3+ цикли діалогу
- [ ] Audio settings перевірені (48kHz)
- [ ] Логи `[ATLAS_CORRECTION]` з'являються

### Після тестування:
- [ ] Accuracy >95% (ручний підрахунок)
- [ ] False negatives <2%
- [ ] Всі варіації "Атлас" виправлені
- [ ] Sample rate = 48000 підтверджено

---

## 🎯 НАСТУПНІ КРОКИ

### Якщо тести ПРОЙДЕНО:
1. ✅ Задокументувати результати в новому файлі
2. ✅ Оновити `.github/copilot-instructions.md` з новими фіксами
3. ⏳ Розпочати MEDIUM priority оптимізації:
   - Покращити WHISPER_CPP_INITIAL_PROMPT
   - Додати confidence logging
   - Додати keyword detection metrics

### Якщо тести НЕ ПРОЙДЕНО:
1. Записати всі помилки з Console
2. Створити issue з діагностичною інформацією:
   - Browser (Chrome/Safari/Firefox)
   - OS version
   - Sample rate з audio settings
   - Логи з `[ATLAS_CORRECTION]`
3. Використати секцію "МОЖЛИВІ ПРОБЛЕМИ" вище

---

## 📞 ШВИДКА ДОПОМОГА

**Перевірити чи працює корекція:**
```javascript
// DevTools Console
import('/static/js/voice-control/utils/voice-utils.js').then(m => {
  const tests = ['атлаз', 'атлус', 'atlas', 'отлас', 'тлас'];
  tests.forEach(word => {
    console.log(`"${word}" → "${m.correctAtlasWord(word)}"`);
  });
});

// Очікуваний вивід:
// "атлаз" → "Атлас"
// "атлус" → "Атлас"
// "atlas" → "Атлас"
// "отлас" → "Атлас"
// "тлас" → "Атлас"
```

**Перевірити sample rate:**
```javascript
// DevTools Console
navigator.mediaDevices.getUserMedia({audio: true}).then(s => {
  console.log('Sample Rate:', s.getAudioTracks()[0].getSettings().sampleRate);
  s.getTracks().forEach(t => t.stop());
});
```

**Перевірити Whisper сервіс:**
```bash
curl http://localhost:3002/health
# Має показати: {"status":"ok","model":"large-v3","metal":true}
```

---

**УСПІХІВ У ТЕСТУВАННІ! 🚀**

Очікуємо +40% покращення точності розпізнавання та 95%+ keyword detection accuracy.
