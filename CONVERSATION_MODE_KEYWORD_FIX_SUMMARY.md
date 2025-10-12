# Conversation Mode Keyword Activation TTS Fix - Summary

**Дата:** 12 жовтня 2025 - День ~16:45  
**Статус:** ✅ ВИПРАВЛЕНО

---

## 🎯 Проблема

При активації Conversation mode через keyword "Атлас":
- ✅ Keyword detection спрацьовував правильно
- ✅ Activation response генерувався ("так творець, ви мене звали")
- ❌ Response НЕ озвучувався через TTS
- ❌ Response НЕ додавався в чат як [ATLAS]
- ❌ Замість цього з'являвся [USER] message

**Очікуваний workflow:**
```
"Атлас" → TTS response → [ATLAS] в чаті → запис користувача → [USER] команда
```

**Реальний workflow (БАГ):**
```
"Атлас" → (тиша) → запис користувача → [USER] "Дякую за перегляд!"
```

---

## 🔍 Корінь проблеми

**EventManager Mismatch:**
- `ConversationModeManager` емітував `TTS_SPEAK_REQUEST` через **`this.eventManager`** (локальний інстанс)
- `TTS Manager` підписаний на **`window.eventManager`** (глобальний інстанс)
- Події емітувались в один EventManager, але слухалися в іншому → **event mismatch**

**Файл:** `conversation-mode-manager.js` (метод `onKeywordActivation`, lines 502-530)

```javascript
// ❌ BEFORE (BAD):
this.eventManager.emit('TTS_SPEAK_REQUEST', { ... });

// ✅ AFTER (FIXED):
const globalEventManager = window.eventManager || this.eventManager;
globalEventManager.emit('TTS_SPEAK_REQUEST', { ... });
```

---

## ✅ Рішення

### 1. Використання Global EventManager
```javascript
const globalEventManager = window.eventManager || this.eventManager;
```
- Пріоритет: **`window.eventManager`** (глобальний для app-level events)
- Fallback: **`this.eventManager`** (локальний якщо глобальний недоступний)

### 2. Logging для діагностики
```javascript
console.log('[CONVERSATION] Using', 
    globalEventManager === window.eventManager ? 'GLOBAL' : 'LOCAL',
    'eventManager for TTS');
```

### 3. Priority для activation responses
```javascript
globalEventManager.emit('TTS_SPEAK_REQUEST', {
    text: activationResponse,
    agent: 'atlas',
    mode: 'conversation',
    priority: 'high',  // ← HIGH priority for activation
    isActivationResponse: true
});
```

---

## 📊 Результат

### ✅ Виправлений workflow:
1. Користувач каже "Атлас" → keyword detection
2. **TTS озвучує** "так творець, ви мене звали"
3. **[ATLAS] response** з'являється в чаті
4. Запис користувача починається **ПІСЛЯ** TTS
5. Користувач говорить команду → [USER] message

### 🔧 Змінені файли:
- `web/static/js/voice-control/conversation-mode-manager.js` (+3 LOC)
  - Lines 502-530: `onKeywordActivation` method
  - Використання `window.eventManager` замість `this.eventManager`

### 📝 Створені документи:
- `docs/CONVERSATION_MODE_KEYWORD_FIX_2025-10-12.md` (технічний звіт)
- `.github/copilot-instructions.md` (оновлено історію виправлень)
- `CONVERSATION_MODE_KEYWORD_FIX_SUMMARY.md` (цей файл)

---

## 🧪 Тестування

### Як перевірити виправлення:

1. **Перезапустити систему:**
   ```bash
   ./restart_system.sh restart
   ```

2. **Активувати Conversation mode:**
   - Утримувати кнопку мікрофона **2 секунди**
   - Почути звуковий сигнал (beep)
   - Побачити синій border навколо моделі

3. **Викликати Atlas:**
   - Сказати "Атлас" чітко
   - **Очікується:** TTS озвучує "так творець, ви мене звали"
   - **Очікується:** [ATLAS] message з'являється в чаті
   - **Очікується:** Запис починається ПІСЛЯ TTS

4. **Дати команду:**
   - Після TTS сказати щось (наприклад, "Привіт")
   - **Очікується:** [USER] message з вашою командою

### Перевірка в консолі:
```javascript
// Має показати "GLOBAL":
console.log(window.eventManager === eventManager);

// Перевірити TTS Manager підписку:
window.ttsManager.eventManager === window.eventManager; // true
```

---

## ⚠️ Критичні правила

### ЗАВЖДИ використовуйте `window.eventManager` для:
- ✅ TTS_SPEAK_REQUEST (озвучення тексту)
- ✅ CHAT_MESSAGE_ADDED (додавання в чат)
- ✅ MODEL_UPDATE (оновлення 3D моделі)
- ✅ Будь-які **app-level events** (міжмодульна комунікація)

### Використовуйте `this.eventManager` тільки для:
- ✅ **Локальних подій модуля** (internal state changes)
- ✅ **Private events** всередині сервісу

### EventManager Hierarchy:
```
window.eventManager (GLOBAL)
    ├── TTS Manager (підписка на TTS_SPEAK_REQUEST)
    ├── Chat Manager (підписка на CHAT_MESSAGE_ADDED)
    ├── 3D Model System (підписка на MODEL_UPDATE)
    └── ...

this.eventManager (LOCAL to module)
    └── Internal state events only
```

---

## 📚 Детальна документація

**Технічний звіт:** `docs/CONVERSATION_MODE_KEYWORD_FIX_2025-10-12.md`
- Повний аналіз проблеми
- Stack trace і event flow
- Діагностика EventManager mismatch
- Покрокове рішення
- Testing instructions

**Copilot Instructions:** `.github/copilot-instructions.md`
- Історія виправлення (lines 69-79)
- Критичні правила EventManager usage
- Workflow documentation

---

**Готово до тестування!** 🚀

Перезапустіть систему і перевірте workflow "Атлас" → TTS → запис → команда.
