# Keyword Detection Analysis & Fix Plan - 11.10.2025 (рання ніч ~02:05)

## 🔍 Проблема

**Симптом:** Conversation mode активується, але НЕ реагує на слово "Атлас"

**Логи показують:**
```
✅ [CONVERSATION] 📡 Emitting START_KEYWORD_DETECTION event
❌ Немає логів [KEYWORD] 📨 Received START_KEYWORD_DETECTION
```

**Висновок:** KeywordDetectionService НЕ отримує подію АБО НЕ розпізнає слово.

---

## 🔬 Технічний аналіз

### 1. Яким чином прослуховується?

**Web Speech API (browser native):**
- KeywordDetectionService використовує `window.SpeechRecognition`
- Це browser API, працює локально
- **Швидкість:** Дуже швидка (real-time)
- **Точність:** Залежить від браузера
- **Українська мова:** Підтримка варіюється

**Whisper (окремий сервіс):**
- WhisperService використовує Whisper.cpp через HTTP
- Працює на порту 3002
- **Швидкість:** Повільніша (~1-3 секунди обробки)
- **Точність:** Дуже висока (state-of-the-art)
- **Українська мова:** Відмінна підтримка

### 2. Поточна конфігурація keywords

**Файл:** `web/static/js/voice-control/core/config.js`
```javascript
'activation': {
  'keywords': [
    'атлас',      // ❌ Тільки один варіант
    'atlas'       // ❌ Англійський
  ],
  'confidence': 0.7,
  'language': 'uk-UA'
}
```

**Проблеми:**
1. ❌ Тільки 2 варіанти слова
2. ❌ Web Speech API може розпізнавати по-різному
3. ❌ Немає варіацій написання/вимови
4. ❌ Немає альтернативних ключових слів

---

## 🛠️ Рішення

### Варіант 1: Покращити Web Speech API (швидше, але менш точно)

#### 1.1. Додати варіації ключових слів

**Файл:** `config/global-config.js`
```javascript
voice: {
  activation: {
    keywords: [
      // Основні варіанти
      'атлас',
      'atlas',
      
      // Варіації вимови
      'атлаз',
      'атлус',
      'атлес',
      
      // З наголосами
      'а́тлас',
      'атла́с',
      
      // Частини імені
      'олег миколайович',
      'олеже миколайовичу',
      
      // Альтернативи
      'ей атлас',
      'гей атлас',
      'слухай',
      'слухай атлас'
    ],
    confidence: 0.6  // Знижено для кращого розпізнавання
  }
}
```

#### 1.2. Покращити розпізнавання в containsActivationKeyword

**Файл:** `web/static/js/voice-control/utils/voice-utils.js`
```javascript
export function containsActivationKeyword(text, keywords = VOICE_CONFIG.activation.keywords) {
  if (!text) return false;

  const normalized = text.toLowerCase().trim();
  
  // Точне співпадіння
  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // Fuzzy matching для варіацій
  const fuzzyVariations = [
    'атлас', 'атлаз', 'атлус', 'атлес',
    'atlas', 'atlus', 'atlass'
  ];
  
  for (const variation of fuzzyVariations) {
    if (normalized.includes(variation)) {
      return true;
    }
  }
  
  return false;
}
```

### Варіант 2: Використовувати Whisper для keyword detection (повільніше, але точніше)

#### 2.1. Створити WhisperKeywordDetectionService

**Ідея:** Замість Web Speech API використовувати Whisper для детекції ключових слів.

**Переваги:**
- ✅ Набагато точніше розпізнає українську
- ✅ Краще розпізнає варіації
- ✅ Працює з різними акцентами

**Недоліки:**
- ❌ Повільніше (~1-3 сек затримка)
- ❌ Потребує серверної обробки
- ❌ Більше навантаження

#### 2.2. Архітектура

```javascript
// Conversation Mode активується
→ startListeningForKeyword()
→ MicrophoneButtonService.startContinuousRecording()
→ Кожні 2-3 секунди: відправка аудіо в Whisper
→ Whisper транскрибує
→ Перевірка на ключові слова
→ Якщо знайдено "атлас" → emit KEYWORD_DETECTED
```

### Варіант 3: Гібридний підхід (найкраще співвідношення)

#### 3.1. Web Speech для початкової детекції
- Швидко реагує на можливі ключові слова
- Низький поріг confidence (0.4-0.5)

#### 3.2. Whisper для підтвердження
- Якщо Web Speech детектує → короткий запис Whisper
- Whisper підтверджує чи справді "атлас"
- Тільки після підтвердження → KEYWORD_DETECTED

---

## 📊 Порівняння варіантів

| Характеристика | Web Speech (покращений) | Whisper | Гібрид |
| -------------- | ----------------------- | ------- | ------ |
| Швидкість      | ⭐⭐⭐⭐⭐                   | ⭐⭐      | ⭐⭐⭐⭐   |
| Точність       | ⭐⭐⭐                     | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  |
| Українська     | ⭐⭐⭐                     | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  |
| Навантаження   | ⭐⭐⭐⭐⭐                   | ⭐⭐      | ⭐⭐⭐    |
| Складність     | ⭐⭐                      | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  |

---

## 🎯 Рекомендований план

### Phase 1: Швидке виправлення (ЗАРАЗ)

1. ✅ Додати варіації ключових слів в config
2. ✅ Покращити containsActivationKeyword з fuzzy matching
3. ✅ Знизити confidence threshold до 0.5
4. ✅ Додати логування розпізнаних фраз

**Час:** 15-20 хвилин  
**Результат:** Web Speech краще розпізнає "атлас"

### Phase 2: Гібридний підхід (ПІЗНІШЕ)

1. ⏳ Додати Whisper fallback для підтвердження
2. ⏳ Оптимізувати розмір аудіо chunks
3. ⏳ Додати кешування розпізнаних фраз

**Час:** 1-2 години  
**Результат:** Майже 100% точність

### Phase 3: Whisper-only (ОПЦІОНАЛЬНО)

1. ⏳ Повністю замінити Web Speech на Whisper
2. ⏳ Оптимізувати streaming audio
3. ⏳ Додати локальний кеш моделі

**Час:** 3-4 години  
**Результат:** Найвища точність, але повільніше

---

## 🚀 Імплементація Phase 1

### Крок 1: Оновити config

**Файл:** `config/global-config.js`
```javascript
export const CONFIG = {
  voice: {
    activation: {
      keywords: [
        'атлас', 'atlas',
        'атлаз', 'атлус', 'атлес',
        'а́тлас', 'атла́с',
        'ей атлас', 'гей атлас',
        'слухай', 'слухай атлас',
        'олег миколайович'
      ],
      confidence: 0.5  // Знижено з 0.7
    }
  }
};
```

### Крок 2: Покращити voice-utils.js

**Додати fuzzy matching та логування:**
```javascript
export function containsActivationKeyword(text, keywords) {
  console.log('[KEYWORD] 🔍 Checking text:', text);
  
  const normalized = text.toLowerCase().trim();
  
  // Точне співпадіння
  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      console.log('[KEYWORD] ✅ Exact match:', keyword);
      return true;
    }
  }
  
  // Fuzzy для варіацій "атлас"
  const atlasVariations = ['атлас', 'атлаз', 'атлус', 'атлес', 'atlas'];
  for (const variant of atlasVariations) {
    if (normalized.includes(variant)) {
      console.log('[KEYWORD] ✅ Fuzzy match:', variant);
      return true;
    }
  }
  
  console.log('[KEYWORD] ❌ No keyword match in:', text);
  return false;
}
```

### Крок 3: Додати логування в recognition handler

**Файл:** `keyword-detection-service.js`
```javascript
handleRecognitionResult(event) {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript.trim();
    const confidence = result[0].confidence || 1.0;

    // ✅ ДОДАТИ ЦЕ
    console.log('[KEYWORD] 🎤 Web Speech recognized:', {
      text: transcript,
      confidence,
      isFinal: result.isFinal
    });

    if (result.isFinal) {
      this.processFinalResult(transcript, confidence);
    }
  }
}
```

---

## ✅ Очікуваний результат

**Після Phase 1:**
```
[KEYWORD] 🎤 Web Speech recognized: {text: "атлас", confidence: 0.8, isFinal: true}
[KEYWORD] 🔍 Checking text: "атлас"
[KEYWORD] ✅ Exact match: атлас
[KEYWORD] 🎯 Keyword detected!
[KEYWORD] 🗣️ Generated response: "Слухаю"
[CONVERSATION] 📨 Received KEYWORD_DETECTED event
[CONVERSATION] ✅ Keyword matched! Activating...
```

---

**Status:** Phase 1 ready for implementation  
**Estimated time:** 15-20 minutes  
**Next:** Implement config changes and fuzzy matching

**Datetime:** 11.10.2025, рання ніч ~02:05
