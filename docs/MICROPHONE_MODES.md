# Режими роботи мікрофону ATLAS

## Огляд

Система має **2 основні режими** роботи з мікрофоном:

1. **Режим 1: Quick-Send (Одиночний клік)** - швидка відправка голосового повідомлення
2. **Режим 2: Conversation (Утримання 2 сек)** - циклічний діалог з Atlas

---

## Режим 1: Quick-Send (Одиночний клік)

### Призначення
Швидка відправка одноразового голосового повідомлення в чат.

### Як працює

1. **Користувач натискає кнопку мікрофону** (короткий клік < 2 сек)
2. **Система починає запис** голосу користувача
3. **VAD (Voice Activity Detection)** визначає коли користувач закінчив говорити:
   - Виявляє тишу протягом 2.5 секунд
   - Для довгих фраз (10+ сек) - до 3.5 секунд тиші
4. **Автоматична зупинка запису** після виявлення тиші
5. **Відправка в Whisper** для транскрипції
6. **Автоматична відправка в чат** після транскрипції
7. **Повернення в idle режим**

### Технічна реалізація

```javascript
// Подія активації
eventManager.emit('CONVERSATION_MODE_QUICK_SEND_START', {
  timestamp: Date.now()
});

// MicrophoneButtonService обробляє
async handleQuickSendModeStart(payload = {}) {
  await this.startRecording('click', {
    mode: 'quick-send',
    conversationMode: false,
    ...payload
  });
}
```

### Параметри VAD
- `silenceTimeout`: 2500ms (2.5 сек) - стандартний поріг тиші
- `adaptiveSilenceTimeout`: 3500ms (3.5 сек) - для довгих фраз
- `spectralRange`: 85-4000 Hz - діапазон частот голосу
- `noiseRange`: 20-80 Hz - діапазон фонового шуму

---

## Режим 2: Conversation (Утримання 2 сек)

### Призначення
Циклічний діалог з Atlas без необхідності повторно натискати кнопку.

### Як працює

#### Фаза 1: Активація режиму
1. **Користувач утримує кнопку мікрофону** 2+ секунди
2. **Система переходить в conversation mode**
3. **Запускається keyword detection** (прослуховування "Атлас")
4. **UI показує**: "Скажіть 'Атлас' для початку..."

#### Фаза 2: Виявлення ключового слова
1. **Користувач каже "Атлас"**
2. **Whisper keyword detector** розпізнає слово
3. **Atlas відзивається** (ротація відповідей):
   - "Слухаю"
   - "Так, я в увазі"
   - "Готовий до роботи"
   - "Так, слухаю вас"
   - "Я тут, що потрібно?"
   - та інші варіанти
4. **TTS озвучує відповідь** Atlas

#### Фаза 3: Запис запиту користувача
1. **Після озвучення відповіді** автоматично починається запис
2. **VAD визначає** коли користувач закінчив говорити
3. **Відправка в Whisper** для транскрипції
4. **Відправка в чат** → обробка через orchestrator

#### Фаза 4: Відповідь Atlas
1. **Atlas обробляє запит** (через orchestrator)
2. **TTS озвучує відповідь** Atlas
3. **Після озвучення** - автоматичний перехід до Фази 5

#### Фаза 5: Continuous Listening (Циклічний діалог)
1. **Система автоматично починає запис** (БЕЗ keyword "Атлас")
2. **Користувач може одразу продовжити** розмову
3. **Якщо користувач говорить** → повторення Фази 3-4
4. **Якщо тиша 5 секунд** → повернення до Фази 2 (keyword detection)

#### Вихід з режиму
- **Короткий клік** по кнопці мікрофону
- **Таймаут розмови** (за замовчуванням 5 хвилин)
- **Перехід в task mode** (якщо виявлено завдання)

### Технічна реалізація

```javascript
// Активація conversation mode
async activateConversationMode() {
  this.state.enterConversationMode();
  this.startListeningForKeyword(); // Фаза 2
}

// Обробка виявлення keyword
async onKeywordActivation(activationResponse) {
  // Озвучення відповіді Atlas
  await this.playActivationResponse(activationResponse);
  
  // Початок запису
  this.startConversationRecording();
}

// Після TTS Atlas
handleTTSCompleted(event) {
  if (mode === 'chat') {
    // Автоматичний цикл
    this.startContinuousListening();
  }
}

// Continuous listening
startContinuousListening() {
  // Пауза 500ms для природності
  setTimeout(() => {
    this.startConversationRecording();
  }, 500);
  
  // Таймаут тиші 5 секунд
  this.responseWaitTimer = setTimeout(() => {
    this.startListeningForKeyword(); // Повернення до keyword mode
  }, 5000);
}
```

### Ротація відповідей Atlas

Система автоматично обирає випадкову відповідь з набору:

```javascript
const responses = [
  'Слухаю',
  'Так, я в увазі',
  'Готовий до роботи',
  'Так, слухаю вас',
  'Я тут, що потрібно?',
  'Готовий виконувати',
  'Чим можу допомогти?',
  'Так, Олег Миколайович',
  'На зв\'язку',
  'Слухаю уважно',
  'Готовий до завдань',
  'Що потрібно зробити?',
  'Я готовий',
  'Слухаю команду',
  'Готовий працювати',
  'Так, готовий',
  'Чекаю на інструкції',
  'Що маємо робити?',
  'Готовий до дій',
  'Слухаю вас уважно'
];
```

---

## Діаграма станів

```
IDLE
  │
  ├─ Короткий клік (<2s) ──> QUICK-SEND MODE
  │                             │
  │                             ├─ Запис
  │                             ├─ VAD детекція
  │                             ├─ Whisper
  │                             ├─ Відправка в чат
  │                             └─> IDLE
  │
  └─ Довгий клік (2+s) ──> CONVERSATION MODE
                              │
                              ├─ KEYWORD DETECTION
                              │    │
                              │    └─ "Атлас" виявлено
                              │         │
                              │         ├─ Atlas відзивається (TTS)
                              │         └─> RECORDING
                              │              │
                              │              ├─ Whisper
                              │              ├─ Відправка в чат
                              │              └─> ATLAS RESPONSE
                              │                   │
                              │                   ├─ TTS озвучення
                              │                   └─> CONTINUOUS LISTENING
                              │                        │
                              │                        ├─ Користувач говорить ──> RECORDING
                              │                        │
                              │                        └─ Тиша 5 сек ──> KEYWORD DETECTION
                              │
                              └─ Клік або таймаут ──> IDLE
```

---

## Конфігурація

### Conversation Mode Timeouts

```javascript
const Timeouts = {
  LONG_PRESS: 2000,              // 2 сек для активації conversation mode
  QUICK_SEND_MAX: 60000,         // 60 сек максимум для quick-send
  CONVERSATION_TOTAL: 300000,    // 5 хвилин загальний таймаут conversation
  SILENCE_DETECTION: 5000,       // 5 сек тиші для повернення до keyword mode
  CONTINUOUS_PAUSE: 500          // 500ms пауза перед continuous listening
};
```

### VAD Configuration

```javascript
const VAD_CONFIG = {
  silenceTimeout: 2500,           // 2.5 сек стандартна тиша
  adaptiveSilenceTimeout: 3500,   // 3.5 сек для довгих фраз
  spectralRange: [85, 4000],      // Hz діапазон голосу
  noiseRange: [20, 80],           // Hz діапазон шуму
  confidenceThreshold: 0.6        // Поріг впевненості
};
```

---

## Події системи

### Quick-Send Mode

```javascript
// Початок
'CONVERSATION_MODE_QUICK_SEND_START'

// Кінець
'CONVERSATION_MODE_QUICK_SEND_END'
```

### Conversation Mode

```javascript
// Активація
'CONVERSATION_MODE_ACTIVATED'

// Деактивація
'CONVERSATION_MODE_DEACTIVATED'

// Keyword detection
'START_KEYWORD_DETECTION'
'KEYWORD_DETECTED'

// Recording
'CONVERSATION_RECORDING_START'
'CONVERSATION_RECORDING_STOP'

// TTS
'TTS_SPEAK_REQUEST'
'TTS_STARTED'
'TTS_COMPLETED'
```

---

## Troubleshooting

### Проблема: Atlas не відзивається після "Атлас"

**Рішення:**
1. Перевірити чи емітується подія `KEYWORD_DETECTED` з `response` полем
2. Перевірити чи TTS Manager підписаний на `TTS_SPEAK_REQUEST`
3. Перевірити логи: `[CONVERSATION] 🗣️ Activation response:`

### Проблема: Запис не зупиняється автоматично

**Рішення:**
1. Перевірити VAD параметри (можливо занадто короткий `silenceTimeout`)
2. Перевірити чи працює спектральний аналіз (85-4000 Hz)
3. Збільшити `silenceTimeout` до 3000-3500ms

### Проблема: Continuous listening не працює

**Рішення:**
1. Перевірити чи TTS емітує подію `TTS_COMPLETED` з `mode: 'chat'`
2. Перевірити чи `handleTTSCompleted` викликає `startContinuousListening()`
3. Перевірити логи: `[CONVERSATION] 🔊 TTS_COMPLETED event received!`

---

## Тестування

### Тест Quick-Send Mode

```javascript
// 1. Короткий клік по кнопці мікрофону
// 2. Сказати фразу
// 3. Зачекати 2.5 сек тиші
// 4. Перевірити чи з'явилось повідомлення в чаті

// Очікуваний результат:
// ✅ Запис почався
// ✅ Запис зупинився після тиші
// ✅ Повідомлення з'явилось в чаті
// ✅ Система повернулась в idle
```

### Тест Conversation Mode

```javascript
// 1. Утримати кнопку мікрофону 2+ секунди
// 2. Сказати "Атлас"
// 3. Почути відповідь Atlas ("Слухаю", тощо)
// 4. Сказати запит
// 5. Почути відповідь Atlas
// 6. Продовжити розмову або зачекати 5 сек тиші

// Очікуваний результат:
// ✅ Conversation mode активувався
// ✅ Atlas відзивається після "Атлас"
// ✅ Запис починається автоматично
// ✅ Atlas відповідає на запит
// ✅ Continuous listening працює
// ✅ Повернення до keyword mode після 5 сек тиші
```

---

## Версія
- **Документ**: v1.0
- **Дата**: 11 жовтня 2025
- **Автор**: ATLAS Development Team
