# ATLAS Conversation Mode System

## 🎙️ Огляд системи

**Conversation Mode System** - це інноваційна система прямого спілкування з ATLAS через голос, що підтримує два режими роботи для різних сценаріїв використання.

## 🎯 Два режими роботи

### 1. 📤 Quick-Send Mode (Швидка відправка)

**Активація:** Одне натискання кнопки мікрофону

**Поведінка:**
1. Користувач натискає кнопку 🔵 один раз
2. Система починає запис голосу (макс. 30 секунд)
3. Розпізнає текст через Whisper
4. Автоматично відправляє в чат
5. Повертається в режим очікування

**Використання:**
- Швидкі запитання
- Короткі команди
- Одноразові повідомлення

**Візуальні індикатори:**
- 🔵 Синє світіння кнопки під час запису
- Toast повідомлення "Запис..."

---

### 2. 💬 Conversation Mode (Живе спілкування)

**Активація:** Утримання кнопки 2 секунди

**Поведінка:**
1. Користувач утримує кнопку 🔵 протягом 2 секунд
2. Система підтверджує активацію (звуковий сигнал + зелене світіння)
3. З'являється статус overlay: "Режим розмови активовано!"
4. Система чекає на ключове слово **"Атлас"**
5. Після виявлення "Атлас":
   - Відправляє в **Stage 0** (режим визначення)
   - Якщо система в chat-режимі → Atlas відповідає
6. **Цикл розмови:**
   ```
   User говорить → Whisper розпізнає → Atlas обробляє →
   → Atlas відповідає (TTS) → Автоматичне очікування →
   → User говорить → (повтор циклу)
   ```
7. Автоматичне завершення:
   - Після 30 секунд тиші
   - Або через 2 хвилини загального таймауту

**Використання:**
- Природні діалоги
- Багатоетапні запити
- Інтерактивна допомога

**Візуальні індикатори:**
- 🟢 Зелене світіння кнопки (conversation mode)
- 🟠 Помаранчеве світіння (Atlas говорить)
- 🟣 Фіолетове світіння (очікування відповіді користувача)
- Overlay в правому верхньому куті з підказками

---

## 🔧 Технічна архітектура

### Компоненти системи

```
ConversationModeManager
├── Quick-Send Handler    - Обробка швидких повідомлень
├── Conversation Handler  - Управління живим діалогом
├── Long-Press Detector   - Виявлення утримання кнопки
├── Keyword Listener      - Прослуховування "Атлас"
├── TTS Integration       - Координація з озвучуванням
└── Visual Feedback       - Статуси та анімації
```

### Події системи

| Подія | Опис | Payload |
|-------|------|---------|
| `CONVERSATION_MODE_QUICK_SEND_START` | Початок quick-send запису | `{ mode, timestamp }` |
| `CONVERSATION_MODE_QUICK_SEND_END` | Завершення quick-send | `{ mode, timestamp }` |
| `CONVERSATION_MODE_ACTIVATED` | Активація conversation | `{ mode, timestamp }` |
| `CONVERSATION_MODE_DEACTIVATED` | Деактивація conversation | `{ mode, timestamp }` |
| `CONVERSATION_RECORDING_START` | Початок запису в conversation | `{ mode, timestamp }` |
| `CONVERSATION_KEYWORD_ACTIVATE` | Виявлення "Атлас" | `{ keyword, stage }` |
| `SEND_CHAT_MESSAGE` | Відправка в чат | `{ text, mode, conversationMode }` |
| `TTS_STARTED` | Atlas почав говорити | `{ agent, text }` |
| `TTS_COMPLETED` | Atlas закінчив говорити | `{ timestamp }` |

---

## 📖 Використання

### Базова конфігурація

```javascript
const conversationMode = new ConversationModeManager({
    longPressDuration: 2000,        // 2 секунди для conversation
    quickSendMaxDuration: 30000,    // 30 сек максимум
    conversationTimeout: 120000,    // 2 хвилини таймаут
    keywordForActivation: 'атлас'   // Ключове слово
});

await conversationMode.initialize();
```

### Інтеграція з системою

```javascript
// Підключення до chat manager
eventManager.on('SEND_CHAT_MESSAGE', (event) => {
    chatManager.sendMessage(event.text);
});

// Підключення до TTS
chatManager.on('tts-start', (data) => {
    eventManager.emit('TTS_STARTED', data);
});

chatManager.on('tts-stop', () => {
    eventManager.emit('TTS_COMPLETED');
});
```

---

## 🎨 Візуальні стани

### Стани кнопки мікрофону

```css
/* Базовий стан */
.btn { background: grey; }

/* Утримання (pressing) */
.btn.pressing { 
    background: blue;
    box-shadow: 0 0 15px rgba(0, 136, 255, 0.8);
}

/* Quick-send запис */
.btn.quick-send {
    background: linear-gradient(135deg, #00d4ff 0%, #0088ff 100%);
    animation: quick-pulse 1s infinite;
}

/* Conversation mode */
.btn.conversation-mode {
    background: linear-gradient(135deg, #00ff7f 0%, #00aa55 100%);
    animation: conversation-pulse 2s infinite;
}

/* Atlas говорить */
.btn.atlas-speaking {
    background: linear-gradient(135deg, #ff8800 0%, #ff5500 100%);
    animation: atlas-speaking-pulse 1s infinite;
}

/* Очікування відповіді */
.btn.waiting-response {
    background: linear-gradient(135deg, #8800ff 0%, #5500ff 100%);
    animation: waiting-pulse 1.5s infinite;
}
```

### Overlay статус

```html
<div class="conversation-mode-status visible">
    <div class="status-content">
        <div class="status-icon">💬</div>
        <div class="status-text">Режим розмови</div>
        <div class="status-hint">Скажіть "Атлас" для початку...</div>
    </div>
</div>
```

---

## 🔄 Діаграма станів

### Quick-Send Mode

```
[Idle] 
   ↓ (одне натискання)
[Recording] 
   ↓ (тиша або макс. час)
[Processing] 
   ↓ (Whisper розпізнав)
[Sending to Chat] 
   ↓
[Idle]
```

### Conversation Mode

```
[Idle]
   ↓ (утримання 2 сек)
[Conversation Activated]
   ↓
[Listening for "Атлас"]
   ↓ (ключове слово виявлено)
[Recording User Message]
   ↓ (тиша)
[Processing → Stage 0]
   ↓ (визначення режиму)
[Sending to Chat]
   ↓
[Atlas Thinking]
   ↓
[Atlas Speaking (TTS)]
   ↓ (TTS завершено)
[Waiting for User Response] ←────┐
   ↓ (автоматичний запис)        │
[Recording User Response]         │
   ↓ (тиша)                       │
[Processing]                      │
   ↓ (відповідь готова)          │
[Sending to Chat]                 │
   ↓                              │
[Atlas Responding]                │
   └──────────────────────────────┘
   
   ↓ (30 сек тиші або таймаут)
[Back to Listening for "Атлас"]
```

---

## 🎯 Приклади використання

### Приклад 1: Швидке запитання

```
User: [одне натискання 🔵]
      "Яка погода сьогодні?"
      
System: [розпізнає] → [відправляє в чат] → [Atlas відповідає]

Atlas: "Сьогодні +15°C, хмарно"
```

### Приклад 2: Живий діалог

```
User: [утримує 🔵 2 сек]

System: 🟢 "Режим розмови активовано!"
        "Скажіть 'Атлас' для початку..."

User: "Атлас"

System: 🎤 "Слухаю вас..."

User: "Створи список покупок"

System: [обробка] → [Stage 0] → [визначення: chat]

Atlas: 🟠 "Звичайно! Що додати до списку?"

System: 🟣 "Ваша черга... Говоріть!"

User: "Молоко, хліб, яйця"

Atlas: "Додав до списку: молоко, хліб, яйця. Щось ще?"

User: "Ні, дякую"

Atlas: "Гаразд, список готовий!"

System: [повернення до очікування "Атлас"]
```

---

## ⚙️ Налаштування

### Параметри конфігурації

```javascript
{
    // Час утримання для conversation mode
    longPressDuration: 2000,       // 2 секунди (рекомендовано)
    
    // Максимальна тривалість quick-send запису
    quickSendMaxDuration: 30000,   // 30 секунд
    
    // Таймаут всієї conversation сесії
    conversationTimeout: 120000,   // 2 хвилини
    
    // Ключове слово для активації в conversation
    keywordForActivation: 'атлас', // можна змінити
    
    // Таймаут очікування відповіді після TTS
    responseTimeout: 30000         // 30 секунд
}
```

### Зміна ключового слова

```javascript
conversationMode.config.keywordForActivation = 'привіт атлас';
```

---

## 🐛 Відлагодження

### Логування

```javascript
// Увімкнути детальні логи
conversationMode.logger.setLevel('debug');

// Перевірка поточного режиму
console.log(conversationMode.getCurrentMode());
// → 'idle' | 'quick-send' | 'conversation'

// Перевірка чи активний conversation
console.log(conversationMode.isConversationActive());
// → true/false
```

### Типові проблеми

**Проблема:** Кнопка не реагує на утримання

**Рішення:**
- Перевірте чи ініціалізований ConversationModeManager
- Перевірте наявність елемента `#microphone-btn`
- Перевірте browser console на помилки

**Проблема:** Conversation не активується після "Атлас"

**Рішення:**
- Перевірте чи працює keyword detection
- Перевірте логи: `conversationMode.logger`
- Переконайтесь що ключове слово правильне

**Проблема:** Після TTS не чекає відповіді

**Рішення:**
- Перевірте інтеграцію з TTS events
- Переконайтесь що емітяться `TTS_STARTED` та `TTS_COMPLETED`

---

## 📊 Метрики

### Відстеження використання

```javascript
// Історія conversation сесій
conversationMode.conversationHistory
// → [{ role, text, timestamp }, ...]

// Поточний стан
{
    currentMode: 'conversation',
    isInConversation: true,
    waitingForUserResponse: true,
    conversationStartTime: 1234567890
}
```

---

## 🚀 Майбутні покращення

- [ ] Підтримка кількох ключових слів
- [ ] Голосові команди для керування (пауза, стоп, продовжити)
- [ ] Збереження контексту розмови між сесіями
- [ ] Адаптивний таймаут (на основі історії)
- [ ] Multi-language support
- [ ] Емоційні реакції GLB моделі на різних етапах
- [ ] Voice activity detection для автоматичного завершення фраз

---

## 📝 Примітки

- Conversation mode вимагає стабільного інтернет-з'єднання
- Whisper Large-v3 забезпечує високу точність розпізнавання
- Stage 0 автоматично визначає чи це chat чи task
- GLB Living System реагує на всі зміни режимів

---

**Версія:** 1.0  
**Дата:** 2025  
**Автор:** ATLAS Team  
**Статус:** ✅ Production Ready
