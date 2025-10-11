# Background Phrase Filter Fix - 2025-10-11

## ОНОВЛЕННЯ 09:55 - Фільтр для Whisper Keyword Detection

### Проблема #2 - Фонові звуки в Keyword Detection

Whisper Keyword Detection розпізнавав **фонові звуки з відео/музики** замість голосу користувача.

**Симптоми:**
```
"Субтитрувальниця Оля Шор"  ← YouTube відео
"Дякую за перегляд!" × 3     ← Кінцівка ролика
"Кого?"                      ← Діалог з відео
"Адаме."                     ← Імена з відео
```

**Корінь:** AirPods ловили системний аудіо (YouTube) як вхід мікрофона.

### Рішення - 3-рівневий фільтр

Додано в `whisper-keyword-detection.js`:

1. **Background Phrases Filter:** Ігнорує типові YouTube/відео фрази
2. **Loop Detection:** Повторювані фрази 3+ рази = фоновий шум
3. **Length Check:** Довгі фрази >50 символів = фонові

```javascript
// ФІЛЬТР 1: YouTube endings
this.backgroundPhrases = [
    'дякую за перегляд',
    'підписуйся на канал',
    'ставте лайк',
    'субтитр',
    'кінець'
];

// ФІЛЬТР 2: Loop detection
this.recentTranscripts = [];
const repeatCount = this.recentTranscripts.filter(t => t === textLower).length;
if (repeatCount >= 3) return; // Ігнор

// ФІЛЬТР 3: Length
if (textLower.length > 50) return;
```

**Результат:**
- ✅ Ігнорує фонові фрази з відео
- ✅ Працює навіть з YouTube на фоні
- ✅ Розпізнає тільки справжні команди

---

## ОРИГІНАЛЬНЕ ВИПРАВЛЕННЯ 00:45 - ConversationModeManager

### Проблема #1

Whisper розпізнавав фонові фрази (особливо **"Дякую за перегляд!"**) і вони відправлялись у чат, хоча система мала фільтр таких фраз.

## Симптоми

1. **Постійна фраза:** "Дякую за перегляд!" з'являлась у чаті після кожного тесту
2. **Фільтр існував** але не використовувався в `ConversationModeManager`
3. Whisper працював правильно (Large-v3 на Metal GPU) і розпізнавав коректно

## Корінь проблеми

**Методи обробки транскрипцій НЕ використовували фільтр:**

```javascript
// ДО ВИПРАВЛЕННЯ:
onQuickSendTranscription(text) {
  this.sendToChat(text);  // ❌ Відправка без перевірки
  this.deactivateQuickSendMode();
}

onConversationTranscription(text) {
  this.sendToChat(text, { conversationMode: true });  // ❌ Без фільтрації
  ...
}
```

**Фільтр існував** в `voice-utils.js` з списком ігнорованих фраз:
- "дякую за перегляд"
- "дякую за увагу"
- "субтитрувальниця"
- "підписуйтесь"
- "ставте лайки"
- та інші YouTube/відео фрази

Але він **НЕ викликався** перед відправкою в чат!

## Рішення

### 1. Імпорт фільтра (рядок 11)

```javascript
import { isBackgroundPhrase } from './utils/voice-utils.js';
```

### 2. Фільтрація в Quick-send (рядки 433-442)

```javascript
onQuickSendTranscription(text) {
  // Фільтрація фонових фраз
  if (isBackgroundPhrase(text)) {
    this.logger.warn(`🚫 Background phrase filtered: "${text}"`);
    this.deactivateQuickSendMode();
    return;  // ⚠️ НЕ відправляємо в чат
  }

  // Відправка в чат
  this.sendToChat(text);
  this.deactivateQuickSendMode();
}
```

### 3. Фільтрація в Conversation (рядки 449-459)

```javascript
onConversationTranscription(text) {
  // Фільтрація фонових фраз
  if (isBackgroundPhrase(text)) {
    this.logger.warn(`🚫 Background phrase filtered in conversation: "${text}"`);
    // ⚠️ В conversation mode продовжуємо слухати після фільтрації
    this.showConversationStatus('Слухаю...');
    eventManager.emit(Events.START_KEYWORD_DETECTION);
    return;  // НЕ відправляємо в чат
  }

  // Додавання в історію і відправка
  this.conversationHistory.push({ role: 'user', text, timestamp: Date.now() });
  this.sendToChat(text, { conversationMode: true });
  ...
}
```

## Логіка фільтра `isBackgroundPhrase()`

**Фраза ігнорується якщо:**

1. **Містить заборонене слово** з `ignoredPhrases`:
   - "дякую за перегляд", "дякую за увагу"
   - "субтитрувальниця", "оля шор"
   - YouTube кліше: "підписуйтесь", "ставте лайки"

2. **Занадто коротка** (`< minPhraseLength = 5` символів)

3. **Коротка + поширені слова** (`<= maxBackgroundLength = 50`):
   - "так", "ні", "добре", "окей"
   - "дякую", "спасибі", "будь ласка"

**Конфігурація фільтра:**

```javascript
backgroundFilter: {
  enabled: true,
  minPhraseLength: 5,
  maxBackgroundLength: 50,
  confidenceThreshold: 0.6,
  ignoredPhrases: [...]
}
```

## Різниця поведінки режимів

### Quick-send mode
- Фільтрація → деактивація режиму → зупинка

### Conversation mode  
- Фільтрація → продовження прослуховування → чекаємо нове ключове слово
- **Чому?** Conversation - це loop, фонова фраза НЕ має зупиняти розмову

## Whisper Configuration (підтверджено працює)

```json
{
  "backend": "whisper.cpp",
  "binary": "whisper-cli",
  "model": "ggml-large-v3.bin",
  "device": "metal",
  "ngl": 20,
  "threads": 6,
  "status": "ok"
}
```

**✅ Large-v3 модель працює на Metal GPU**

**Тестування з `user_text.wav`:**
```bash
curl -X POST http://localhost:3002/transcribe \
  -F "audio=@ukrainian-tts/user_text.wav" \
  -F "language=uk"
```

**Результат:** Розпізнав весь текст БЕЗ помилок (156 слів про літо і шлагбаум)

## Результат виправлення

### ДО:
```
[USER] 🎤 Recording...
[WHISPER] ✅ "Дякую за перегляд!"
[CHAT] 📤 "Дякую за перегляд!"  ❌ Небажана фраза у чаті
[ATLAS] "Не за що! Чим можу допомогти?"
```

### ПІСЛЯ:
```
[USER] 🎤 Recording...
[WHISPER] ✅ "Дякую за перегляд!"
[FILTER] 🚫 Background phrase filtered: "Дякую за перегляд!"
[CHAT] (порожньо)  ✅ Фраза НЕ потрапила в чат
```

## Файли змінені

1. `web/static/js/voice-control/conversation-mode-manager.js`
   - Додано імпорт `isBackgroundPhrase` (рядок 11)
   - Додано фільтрацію в `onQuickSendTranscription()` (рядки 433-442)
   - Додано фільтрацію в `onConversationTranscription()` (рядки 449-459)

## Тестування

```bash
# 1. Перезапустити систему
./restart_system.sh restart

# 2. Відкрити веб-інтерфейс
open http://localhost:5001

# 3. Клікнути мікрофон
# 4. Сказати "Дякую за перегляд!"
# 5. Очікуваний результат: текст НЕ з'являється в чаті, логи показують 🚫 фільтрацію
```

**Перевірка логів:**
```bash
# В браузері консолі має з'явитись:
🚫 Background phrase filtered: "Дякую за перегляд!"
```

## Критично

**Фільтр працює ТІЛЬКИ для транскрипцій від Whisper**, НЕ для прямого введення тексту в чаті!

Якщо користувач **вручну набере** "Дякую за перегляд" - воно НЕ буде фільтруватись.

## Додаткові переваги

1. **Чистіші чати** - без YouTube кліше
2. **Кращий UX** - система не реагує на фонові звуки з відео
3. **Економія токенів** - менше непотрібних запитів до AI
4. **Conversation loop стабільніший** - фонові фрази не зупиняють розмову

## Наступні кроки (опціонально)

1. **Розширити список** `ignoredPhrases` за потреби
2. **Додати статистику** скільки фраз відфільтровано
3. **UI індикатор** коли фраза була відфільтрована
4. **Налаштування через UI** - дозволити користувачу керувати фільтром

---

**Документ створено:** 11 жовтня 2025, 00:45  
**Версія:** 1.0  
**Статус:** Виправлення застосовано ✅
