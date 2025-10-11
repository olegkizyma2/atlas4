# 💬 Conversation Mode Manager Modules v4.0

**Дата створення:** 2025-01-09  
**Статус:** ✅ ЗАВЕРШЕНО  
**Призначення:** Модульна архітектура режимів спілкування ATLAS

## 📁 Структура модулів

```
voice-control/conversation/modules/
├── mode-handler.js        # Управління режимами спілкування
├── ui-manager.js         # Візуальне представлення
├── button-controller.js  # Обробка взаємодії з кнопкою
└── README.md            # Ця документація
```

## 🎯 Принципи архітектури

### ✅ Single Responsibility Principle
- **ModeHandler**: тільки логіка режимів
- **UIManager**: тільки візуальні компоненти
- **ButtonController**: тільки обробка кнопки

### ✅ Модульна архітектура
```javascript
const uiManager = new ConversationUIManager(config);
const modeHandler = new ModeHandler(config);
const buttonController = new ButtonController(config, uiManager);
```

### ✅ Event-Driven Architecture
Всі модулі взаємодіють через event manager без прямих залежностей.

---

## 📋 Детальний опис модулів

### 1. 🎭 ModeHandler (`mode-handler.js`)

**Розмір:** ~350 рядків (було частина з 669)  
**Відповідальність:** Управління логікою режимів спілкування

**Ключові методи:**
- `activateQuickSendMode()` - активація швидкого режиму
- `activateConversationMode()` - активація режиму розмови
- `deactivateConversationMode()` - деактивація розмови
- `handleTranscriptionComplete()` - обробка результатів транскрипції
- `handleKeywordDetected()` - обробка ключових слів
- `saveConversationHistory()` - збереження історії

**Режими роботи:**
- **idle**: стан очікування
- **quick-send**: одне натискання → запис → відправка
- **conversation**: утримання 2 сек → живе спілкування

**Обробка подій:**
```javascript
- WHISPER_TRANSCRIPTION_COMPLETED
- KEYWORD_DETECTED  
- TTS_STARTED
- TTS_COMPLETED
```

**Таймери:**
- `conversationTimer`: таймаут розмови (2 хвилини)
- `responseWaitTimer`: очікування відповіді системи (30 сек)

---

### 2. 🎨 ConversationUIManager (`ui-manager.js`)

**Розмір:** ~400 рядків (було частина з 669)  
**Відповідальність:** Візуальне представлення режимів

**Ключові методи:**
- `showModeNotification()` - показ сповіщень
- `showConversationStatus()` - статус conversation режиму
- `showRecordingState()` - стан запису
- `playActivationSound()` - звук активації
- `injectStyles()` - впровадження CSS стилів

**UI компоненти:**
- **Status Indicator**: центральний індикатор режиму
- **Toast Notifications**: сповіщення в кутку екрана
- **Button States**: візуальні стани кнопки
- **Sound Effects**: звукові сигнали

**CSS класи:**
```css
.conversation-mode-status     # Центральний статус
.conversation-notification    # Toast сповіщення
.pressing                    # Стан натискання
.recording                   # Стан запису
.quick-send                  # Quick-send режим
.conversation-mode          # Conversation режим
```

**Анімації:**
- `pulse`: пульсація іконок
- `recording-pulse`: пульсація при записі
- Smooth transitions для всіх станів

---

### 3. 🔘 ButtonController (`button-controller.js`)

**Розмір:** ~200 рядків (було частина з 669)  
**Відповідальність:** Обробка взаємодії з кнопкою мікрофона

**Ключові методи:**
- `startPress()` - початок натискання
- `endPress()` - кінець натискання
- `triggerQuickPress()` - обробка короткого кліку
- `triggerLongPress()` - обробка тривалого натискання
- `setQuickPressCallback()` - callback короткого кліку
- `setLongPressCallback()` - callback тривалого кліку

**Підтримувані події:**
- **Mouse events**: `mousedown`, `mouseup`, `mouseleave`
- **Touch events**: `touchstart`, `touchend`, `touchcancel`
- **Accessibility**: запобігання context menu

**Логіка розпізнавання:**
- Натискання < 2 сек = Quick-send
- Натискання ≥ 2 сек = Conversation mode
- Підтримка мультитач та mouse одночасно

**Стан кнопки:**
```javascript
{
    isPressed: Boolean,
    pressDuration: Number,
    hasLongPressTimer: Boolean,
    isEnabled: Boolean
}
```

---

## 🔧 Використання

### Ініціалізація рефакторованого менеджера:
```javascript
import { ConversationModeManager } from './conversation-mode-manager-v4.js';

const conversationManager = new ConversationModeManager({
    longPressDuration: 2000,
    quickSendMaxDuration: 30000,
    conversationTimeout: 120000,
    keywordForActivation: 'атлас'
});

await conversationManager.initialize();
```

### Отримання статусу:
```javascript
// Поточний режим
const mode = conversationManager.getCurrentMode();

// Статистика
const stats = conversationManager.getStatistics();

// Історія розмови
const history = conversationManager.getConversationHistory();
```

### Програмне управління:
```javascript
// Деактивація conversation режиму
conversationManager.deactivateConversationMode();

// Увімкнення/вимкнення кнопки
conversationManager.setButtonEnabled(false);

// Тестування режимів
conversationManager.testQuickSendMode();
conversationManager.testConversationMode();
```

### Оновлення конфігурації:
```javascript
conversationManager.updateConfig({
    longPressDuration: 1500,
    conversationTimeout: 180000
});
```

---

## 📊 Статистика рефакторингу

| Метрика | До | Після | Покращення |
|---------|----|----|------------|
| **Розмір головного файлу** | 669 рядків | 100 рядків | **-85%** |
| **Кількість відповідальностей** | 5+ | 1 | **-80%** |
| **Модулів створено** | 0 | 3 | **+3** |
| **Читабельність** | Складно | Легко | ✅ |
| **Тестованість** | Важко | Легко | ✅ |
| **Повторне використання** | Ні | Так | ✅ |

## 🎉 Переваги нової архітектури

### ✅ Модульність
- Логіка режимів відділена від UI
- UI компоненти можна використовувати окремо
- Button controller універсальний

### ✅ Тестованість
- Кожен модуль тестується незалежно
- Легко мокати залежності
- Unit тести стають простішими

### ✅ Розширюваність
- Легко додавати нові режими
- Простіше змінювати UI
- Модульні компоненти

### ✅ Підтримуваність
- Чіткий розподіл відповідальностей
- Зрозуміла структура коду
- Менший ризик регресій

---

## 🔄 Режими роботи

### 1. 📤 Quick-send Mode
**Активація:** Короткий клік (< 2 сек)  
**Поведінка:** 
1. Початок запису
2. Автоматична зупинка (або вручну)
3. Відправка в чат
4. Повернення в idle

**Візуальні індикатори:**
- Жовта рамка кнопки
- Toast "Запис..."
- Пульсація кнопки

### 2. 💬 Conversation Mode
**Активація:** Тривалий клік (≥ 2 сек)  
**Поведінка:**
1. Звуковий сигнал активації
2. Прослуховування ключового слова "атлас"
3. Запис після виявлення ключового слова
4. Відправка в чат
5. Очікування TTS відповіді
6. Повторення циклу

**Візуальні індикатори:**
- Зелена рамка кнопки
- Центральний статус "Режим розмови"
- Різні підказки залежно від стану

**Таймаути:**
- Загальний час розмови: 2 хвилини
- Очікування відповіді: 30 секунд

---

## 🚀 Наступні кроки

1. **Unit тести** - для кожного модуля
2. **E2E тести** - повного workflow
3. **Accessibility** - підтримка screen readers
4. **Персоналізація** - налаштування ключових слів

---

**Автор:** GitHub Copilot  
**Дата оновлення:** 2025-01-09  
**Версія:** 4.0.0