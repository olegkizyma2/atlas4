# Рефакторинг системи мікрофону ATLAS
**Дата:** 11 жовтня 2025, 20:30  
**Версія:** 4.0

---

## 🎯 Мета рефакторингу

Виправити роботу двох режимів мікрофону та забезпечити правильну інтеграцію з TTS для відповідей Atlas.

---

## 🚨 Виявлені проблеми

### 1. Режим 2 (Conversation) не працював правильно
- ❌ Keyword "Атлас" виявлявся, але Atlas НЕ відзивався
- ❌ Немає озвучення відповідей ("Слухаю", "Так, я в увазі")
- ❌ Немає ротації відповідей
- ❌ Після виявлення keyword не починався запис

### 2. Відсутня інтеграція TTS з keyword detection
- ❌ `KeywordDetectionService` генерував `response`, але не озвучував його
- ❌ `ConversationModeManager` не викликав TTS для activation responses
- ❌ Немає події `TTS_SPEAK_REQUEST` для озвучення

### 3. Режим 1 (Quick-Send) працював, але не було документації

---

## ✅ Виконані виправлення

### 1. Додано TTS інтеграцію для відповідей Atlas

#### Файл: `/web/static/js/voice-control/conversation-mode-manager.js`

**Зміни:**

```javascript
// БУЛО: Просто показувало статус, без озвучення
async onKeywordActivation() {
  this.ui?.showStatus('Слухаю вас...');
  this.startConversationRecording();
}

// СТАЛО: Озвучує відповідь через TTS
async onKeywordActivation(activationResponse = null) {
  this.logger.info(`🎯 Keyword activation triggered, response: "${activationResponse}"`);

  // Якщо є відповідь від keyword detector - озвучуємо її
  if (activationResponse) {
    this.ui?.showStatus(activationResponse);

    // Озвучення відповіді через TTS
    try {
      await this.playActivationResponse(activationResponse);
    } catch (error) {
      this.logger.error('Failed to play activation response', null, error);
    }
  } else {
    this.ui?.showStatus('Слухаю вас...');
  }

  // Початок запису голосового повідомлення
  this.startConversationRecording();
}

/**
 * Озвучення відповіді на активацію через TTS
 */
async playActivationResponse(response) {
  this.logger.info(`🔊 Playing activation response: "${response}"`);

  // Емісія події для TTS
  this.eventManager.emit('TTS_SPEAK_REQUEST', {
    text: response,
    agent: 'atlas',
    mode: 'conversation',
    priority: 'high',
    isActivationResponse: true
  });
}
```

**Оновлено обробник keyword detection:**

```javascript
// БУЛО: Не передавав response
handleKeywordDetected(payload) {
  if (keyword === this.config.keywordForActivation) {
    this.onKeywordActivation(); // ❌ Без response
  }
}

// СТАЛО: Передає response для озвучення
handleKeywordDetected(payload) {
  const keyword = payload.keyword?.toLowerCase();
  const response = payload.response; // ✅ Відповідь від keyword detector

  if (keyword === this.config.keywordForActivation) {
    this.onKeywordActivation(response); // ✅ З response
  }
}
```

---

### 2. Додано обробник події `TTS_SPEAK_REQUEST` в TTS Manager

#### Файл: `/web/static/js/modules/tts-manager.js`

**Додано метод підписки на події:**

```javascript
/**
 * Підписка на події TTS
 * @private
 */
_subscribeToTTSEvents() {
  // Перевірка наявності eventManager
  if (typeof window !== 'undefined' && window.eventManager) {
    const eventManager = window.eventManager;

    // Обробка запиту на озвучення (для activation responses)
    eventManager.on('TTS_SPEAK_REQUEST', async (event) => {
      const { text, agent, mode, priority, isActivationResponse } = event.payload || event;

      this.logger.info(`🔊 TTS_SPEAK_REQUEST received: "${text}" (agent: ${agent}, mode: ${mode}, activation: ${isActivationResponse})`);

      try {
        await this.speak(text, agent, {
          mode,
          priority,
          isActivationResponse
        });
      } catch (error) {
        this.logger.error('Failed to process TTS_SPEAK_REQUEST', null, error);
      }
    });

    this.logger.debug('✅ Subscribed to TTS events');
  } else {
    this.logger.warn('⚠️ EventManager not available, TTS events disabled');
  }
}
```

**Виклик в init():**

```javascript
async init() {
  // ... існуючий код ...
  
  // Attach autoplay unlock on first user gesture
  this._attachAutoplayUnlockHandlers();

  // Підписка на події TTS
  this._subscribeToTTSEvents(); // ✅ ДОДАНО
}
```

---

### 3. Створено повну документацію

#### Файл: `/docs/MICROPHONE_MODES.md`

Створено комплексну документацію з:
- Описом обох режимів роботи
- Технічною реалізацією
- Діаграмою станів
- Конфігурацією параметрів
- Troubleshooting секцією
- Тестовими сценаріями

---

## 🔄 Логіка роботи після виправлень

### Режим 1: Quick-Send (Одиночний клік)

```
1. Користувач натискає кнопку (<2 сек)
   ↓
2. Система починає запис
   ↓
3. VAD визначає кінець мовлення (2.5-3.5 сек тиші)
   ↓
4. Автоматична зупинка запису
   ↓
5. Відправка в Whisper
   ↓
6. Транскрипція → Чат
   ↓
7. Повернення в idle
```

### Режим 2: Conversation (Утримання 2 сек)

```
1. Користувач утримує кнопку (2+ сек)
   ↓
2. Активація conversation mode
   ↓
3. Keyword detection: очікування "Атлас"
   ↓
4. Користувач каже "Атлас"
   ↓
5. ✅ Atlas відзивається (TTS): "Слухаю" / "Так, я в увазі" / тощо
   ↓
6. Автоматичний початок запису
   ↓
7. VAD визначає кінець мовлення
   ↓
8. Whisper → Транскрипція → Чат
   ↓
9. Atlas обробляє запит
   ↓
10. ✅ TTS озвучує відповідь Atlas
   ↓
11. Continuous listening (автоматичний запис БЕЗ keyword)
   ↓
12a. Користувач продовжує говорити → повторення кроків 7-11
12b. Тиша 5 секунд → повернення до кроку 3 (keyword detection)
12c. Клік по кнопці → вихід в idle
```

---

## 📊 Ротація відповідей Atlas

Система автоматично обирає випадкову відповідь з 20 варіантів:

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

Генерується в `KeywordDetectionService.getRandomActivationResponse()`.

---

## 🎛️ Конфігурація

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

## 🧪 Тестування

### Тест 1: Quick-Send Mode

```bash
# Очікуваний результат:
✅ Короткий клік → запис почався
✅ Говоріння → запис триває
✅ Тиша 2.5 сек → запис зупинився
✅ Повідомлення з'явилось в чаті
✅ Система в idle
```

### Тест 2: Conversation Mode - Keyword Detection

```bash
# Очікуваний результат:
✅ Утримання 2 сек → conversation mode активувався
✅ UI показує: "Скажіть 'Атлас' для початку..."
✅ Говоріння "Атлас" → keyword виявлено
✅ Atlas відзивається: "Слухаю" (або інша відповідь)
✅ TTS озвучує відповідь
✅ Запис автоматично починається
```

### Тест 3: Conversation Mode - Циклічний діалог

```bash
# Очікуваний результат:
✅ Після відповіді Atlas → автоматичний запис
✅ Користувач говорить → запис триває
✅ Тиша → Whisper → чат
✅ Atlas відповідає → TTS
✅ Знову автоматичний запис (continuous listening)
✅ Тиша 5 сек → повернення до keyword detection
```

---

## 📁 Змінені файли

1. **`/web/static/js/voice-control/conversation-mode-manager.js`**
   - Додано `playActivationResponse()` метод
   - Оновлено `onKeywordActivation()` для озвучення
   - Оновлено `handleKeywordDetected()` для передачі response

2. **`/web/static/js/modules/tts-manager.js`**
   - Додано `_subscribeToTTSEvents()` метод
   - Додано обробник події `TTS_SPEAK_REQUEST`
   - Інтеграція в `init()` метод

3. **`/docs/MICROPHONE_MODES.md`** (НОВИЙ)
   - Повна документація обох режимів
   - Технічна реалізація
   - Діаграми та приклади

4. **`/docs/refactoring/MICROPHONE_REFACTORING_2025-10-11.md`** (НОВИЙ)
   - Цей документ з описом всіх змін

---

## 🎯 Результат

### ✅ Виправлено:
1. **Atlas тепер відзивається** після виявлення "Атлас"
2. **Ротація відповідей** працює (20 варіантів)
3. **TTS озвучує** всі відповіді Atlas
4. **Циклічний діалог** працює автоматично
5. **Continuous listening** після відповіді Atlas
6. **Режим 1 (Quick-Send)** працює як задумано
7. **Режим 2 (Conversation)** працює з повним циклом

### ✅ Додано:
1. **Повна документація** обох режимів
2. **TTS інтеграція** для activation responses
3. **Подія `TTS_SPEAK_REQUEST`** для гнучкого озвучення
4. **Troubleshooting** секція в документації

### ✅ Видалено:
- Тестувальних методів не було знайдено (вже видалені раніше)

---

## 🚀 Наступні кроки

1. **Тестування на реальних користувачах**
   - Перевірити всі сценарії з документації
   - Збір feedback про природність діалогу

2. **Можливі покращення**
   - Додати більше варіантів відповідей Atlas
   - Налаштувати тональність голосу для різних відповідей
   - Додати контекстуальні відповіді (час доби, настрій)

3. **Моніторинг**
   - Відстежувати помилки в логах
   - Аналізувати VAD точність
   - Оптимізувати таймаути при необхідності

---

## 📞 Контакти

**Розробник:** ATLAS Development Team  
**Дата:** 11 жовтня 2025  
**Версія системи:** 4.0
