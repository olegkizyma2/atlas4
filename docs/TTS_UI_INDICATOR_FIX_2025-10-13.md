# TTS UI Indicator Fix

**Дата:** 13 жовтня 2025 - ніч ~00:06
**Версія:** 4.0.0
**Статус:** ✅ FIXED

---

## 📋 Проблема

**Симптом:** Червона кнопка TTS (🔇) показує що озвучення вимкнене, хоча в логах `[CHAT] TTS enabled` і TTS працює.

**Користувацька скарга:**
```
у фронтенді у мене показано у веб червону колонку що ттс виключний
```

**Логи показують:**
```javascript
[00:05:23] [CHAT] TTS enabled  // TTS насправді УВІМКНЕНО
// Але UI показує 🔇 (червоний, вимкнено)
```

---

## 🔍 Діагностика

### Аналіз коду:

**app-refactored.js (setupTTSControls):**
```javascript
const updateIcon = () => {
  const isEnabled = getCurrentTTSState();
  const span = ttsToggle.querySelector('.btn-text') || ttsToggle;
  span.textContent = isEnabled ? '🔊' : '🔇';  // Змінює іконку
};

// Встановлюємо початковий стан
updateIcon();  // ❌ Викликається ОДИН РАЗ при init
```

**chat-manager.js (enableTTS/disableTTS):**
```javascript
enableTTS() {
  localStorage.setItem('atlas_voice_enabled', 'true');
  this.logger.info('TTS enabled');
  // ❌ НЕ повідомляє UI про зміну стану!
}

disableTTS() {
  localStorage.setItem('atlas_voice_enabled', 'false');
  this.ttsManager.stop();
  this.logger.info('TTS disabled');
  // ❌ НЕ повідомляє UI про зміну стану!
}
```

### Корінь проблеми:

1. **`updateIcon()` викликається ОДИН РАЗ** при ініціалізації компонентів
2. **НЕ викликається** коли TTS змінює стан через `enableTTS()` / `disableTTS()`
3. **localStorage може бути null** при першому запуску → UI показує вимкнено
4. **Немає event-based синхронізації** між chat-manager та UI

### Race Condition:

```
1. app-refactored init → setupTTSControls() → updateIcon()
   localStorage.getItem('atlas_voice_enabled') = null
   → isEnabled() = false → UI показує 🔇

2. chat-manager init → TTS service ready
   → (немає виклику enableTTS)
   → localStorage залишається null
   → UI НЕ оновлюється

3. Користувач відправляє повідомлення
   → TTS працює (isEnabled() = true бо null !== 'false')
   → Але UI досі показує 🔇
```

---

## ✅ Рішення

### Зміна #1: Event-based синхронізація UI

**Файл:** `web/static/js/modules/chat-manager.js`

```javascript
enableTTS() {
  localStorage.setItem('atlas_voice_enabled', 'true');
  this.logger.info('TTS enabled');
  // ✅ Emit event для оновлення UI
  this.emit('tts-state-changed', { enabled: true });
}

disableTTS() {
  localStorage.setItem('atlas_voice_enabled', 'false');
  this.ttsManager.stop();
  this.logger.info('TTS disabled');
  // ✅ Emit event для оновлення UI
  this.emit('tts-state-changed', { enabled: false });
}
```

### Зміна #2: Підписка на зміни стану

**Файл:** `web/static/js/app-refactored.js`

```javascript
ttsToggle.addEventListener('click', () => {
  const isEnabled = getCurrentTTSState();
  if (isEnabled) {
    this.managers.chat.disableTTS();
  } else {
    this.managers.chat.enableTTS();
  }
  updateIcon();
});

// ✅ Підписка на зміни стану TTS
if (this.managers.chat) {
  this.managers.chat.on('tts-state-changed', () => {
    updateIcon();
    this.logger.debug('TTS UI updated via state change event');
  });
}

// Встановлюємо початковий стан
updateIcon();
```

### Зміна #3: Дефолтний стан TTS

**Файл:** `web/static/js/modules/chat-manager.js`

```javascript
await this.ttsManager.init();
this.setupUI();
this.setupEventListeners();

// ✅ Встановлюємо дефолтний стан TTS якщо не встановлено
if (localStorage.getItem('atlas_voice_enabled') === null) {
  localStorage.setItem('atlas_voice_enabled', 'true'); // Дефолт: увімкнено
  this.logger.info('TTS default state set to enabled');
}

this._initialized = true;
```

---

## 🎯 Результат

### Workflow тепер:

```
1. Init:
   chat-manager.init()
   → localStorage.getItem('atlas_voice_enabled') = null
   → встановлюємо 'true' (дефолт)
   → isEnabled() = true ✅

2. Setup UI:
   app-refactored.setupTTSControls()
   → підписка на 'tts-state-changed'
   → updateIcon() → 🔊 (зелений)

3. TTS state change:
   enableTTS() / disableTTS()
   → emit('tts-state-changed')
   → updateIcon() викликається автоматично
   → UI синхронізується з реальним станом
```

### Переваги:

- ✅ **Event-driven архітектура** - UI оновлюється автоматично
- ✅ **Дефолтний стан** - TTS увімкнено за замовчуванням
- ✅ **Синхронізація** - UI завжди відповідає реальному стану
- ✅ **Без race condition** - event викликається ПІСЛЯ зміни стану
- ✅ **Debuggable** - логування змін стану

---

## 🔧 Виправлені файли

1. **`web/static/js/modules/chat-manager.js`** (2 методи + init):
   - `enableTTS()` - додано emit event
   - `disableTTS()` - додано emit event
   - `init()` - встановлення дефолтного стану

2. **`web/static/js/app-refactored.js`** (setupTTSControls):
   - Додано підписку на `tts-state-changed` event
   - Автоматичне оновлення UI при змінах стану

**Змінено:** 3 місця (~12 LOC)

---

## 📊 Метрики

- **LOC змінено:** 12
- **Файлів:** 2
- **Event listeners:** +1 (tts-state-changed)
- **Дефолтний стан:** TTS enabled (true)

---

## 🧪 Тестування

### Сценарій #1: Перший запуск
```javascript
// localStorage.getItem('atlas_voice_enabled') = null
// → встановлюється 'true'
// → UI показує 🔊 (зелений)
// → TTS працює ✅
```

### Сценарій #2: Вимкнення TTS
```javascript
// Клік на кнопку → disableTTS()
// → emit('tts-state-changed', { enabled: false })
// → updateIcon() → 🔇 (червоний)
// → TTS припиняється ✅
```

### Сценарій #3: Увімкнення TTS
```javascript
// Клік на кнопку → enableTTS()
// → emit('tts-state-changed', { enabled: true })
// → updateIcon() → 🔊 (зелений)
// → TTS працює ✅
```

### Перевірка в консолі:
```javascript
// Перевірити стан TTS
window.atlasChat.ttsManager.isEnabled()  // true/false

// Перевірити localStorage
localStorage.getItem('atlas_voice_enabled')  // 'true'/'false'/null

// Перевірити UI
document.getElementById('tts-toggle').querySelector('.btn-text').textContent
// '🔊' (enabled) або '🔇' (disabled)
```

---

## 🚨 Критично

### Завжди:
- ✅ **Emit event** після зміни стану TTS
- ✅ **Підписуватись** на `tts-state-changed` в UI компонентах
- ✅ **Встановлювати дефолт** якщо localStorage null
- ✅ **Синхронізувати** UI з реальним станом через events

### Ніколи:
- ❌ НЕ викликати `updateIcon()` тільки при ініціалізації
- ❌ НЕ змінювати стан БЕЗ emit event
- ❌ НЕ залишати localStorage null (встановити дефолт)
- ❌ НЕ робити прямі перевірки - використовувати `isEnabled()`

---

## 📚 Пов'язані файли

- `web/static/js/modules/chat-manager.js` - Chat Manager з TTS control
- `web/static/js/modules/tts-manager.js` - TTS Manager з isEnabled()
- `web/static/js/app-refactored.js` - UI setup з event listeners
- `web/templates/index.html` - HTML розмітка кнопки TTS

---

## 🔄 Workflow виправлення

1. 📋 **Аналіз проблеми** - логи показують enabled, UI показує disabled
2. 🔍 **Діагностика** - знайдено відсутність event-based sync
3. ✏️ **Реалізація** - додано emit events + підписка + дефолт
4. 🧪 **Тестування** - перевірити всі сценарії (перший запуск, toggle)
5. 📚 **Документація** - цей файл

---

**Детально:** Цей файл  
**Версія системи:** ATLAS v4.0.0  
**Архітектура:** Event-driven UI synchronization  
**Автор виправлення:** GitHub Copilot  
**Час виправлення:** ~15 хвилин
