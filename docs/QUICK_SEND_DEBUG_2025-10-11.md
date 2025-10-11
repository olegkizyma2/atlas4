# Quick-Send Mode Debug Investigation

**Дата:** 11 жовтня 2025, 17:35  
**Проблема:** Quick-send mode (one-click) НЕ починає запис  
**Статус:** 🔍 DEBUGGING - додано debug logging

## 🐛 Симптоми

```javascript
// Користувач клікає кнопку мікрофона:
[CONVERSATION] 📤 Quick press detected - emitting quick-send event
[CONVERSATION] 🎤 Quick-send mode activated
[CONVERSATION_EVENTS] 🚀 Quick-Send mode started  // ✅ Event емітується

// MicrophoneButtonService НЕ реагує:
// ❌ НЕМАЄ "[MICROPHONE_BUTTON] Starting recording"
// ❌ НЕМАЄ "[MICROPHONE_BUTTON] 🎤 Quick-send mode activated via conversation manager"
```

## 🔍 Гіпотези

### Можливість 1: Event НЕ доходить до MicrophoneButtonService
- ConversationMode емітує `ConversationEvents.CONVERSATION_MODE_QUICK_SEND_START`
- MicrophoneButtonService підписаний на `'CONVERSATION_MODE_QUICK_SEND_START'` (string literal)
- Можливо різні eventManager інстанси?

### Можливість 2: Event доходить, але handleQuickSendModeStart() НЕ виконується
- Перевірки `if (this._ttsLocked)` або `if (this.currentState !== 'idle')` блокують?
- Async помилка?

### Можливість 3: Старий та новий код конфліктують
- Можливо ConversationModeManager керує кнопкою, але MicrophoneButtonService ще має старі обробники?
- Dual event subscription?

## 🔧 Debug Logging (Додано)

**microphone-button-service.js** (line 752):
```javascript
eventManager.on('CONVERSATION_MODE_QUICK_SEND_START', async (event) => {
  console.log('[MICROPHONE_BUTTON] 🔔 Received CONVERSATION_MODE_QUICK_SEND_START event!', {
    event,
    payload: event?.payload,
    currentState: this.currentState,
    ttsLocked: this._ttsLocked
  });
  this.logger.info('🎤 Quick-send mode activated via conversation manager');
  await this.handleQuickSendModeStart(event.payload);
});
```

## 🧪 Тест для користувача

### Кроки:

1. **Відкрити:** http://localhost:5001
2. **Відкрити Browser Console** (Cmd+Opt+J / F12)
3. **Кликнути** кнопку мікрофона **ОДИН РАЗ** (НЕ утримувати!)
4. **Скопіювати логи** з console

### Очікувані логи (якщо працює):

```javascript
// 1. ConversationMode детектує клік
[CONVERSATION] 📤 Quick press detected - emitting quick-send event
[CONVERSATION] 🎤 Quick-send mode activated
[CONVERSATION_EVENTS] 🚀 Quick-Send mode started

// 2. MicrophoneButtonService отримує event ✅ НОВИЙ ЛОГ!
[MICROPHONE_BUTTON] 🔔 Received CONVERSATION_MODE_QUICK_SEND_START event! {
  event: {...},
  payload: {...},
  currentState: 'idle',
  ttsLocked: false
}

// 3. Запис починається
[MICROPHONE_BUTTON] 🎤 Quick-send mode activated via conversation manager
[MICROPHONE_BUTTON] 🎤 Quick-send mode: starting recording
[MICROPHONE_BUTTON] Starting recording (trigger: click)
```

### Діагностичні випадки:

#### Випадок A: НЕ бачимо `[MICROPHONE_BUTTON] 🔔 Received...`
→ **Event НЕ доходить** - проблема з eventManager subscription

#### Випадок B: Бачимо event, але `ttsLocked: true`
→ **TTS блокує мікрофон** - потрібно виправити TTS unlock logic

#### Випадок C: Бачимо event, але `currentState: 'recording'` (не 'idle')
→ **State machine проблема** - попередній стан не очистився

#### Випадок D: Бачимо event з правильними параметрами, але запис НЕ починається
→ **startRecording() падає** - помилка в методі

## 🔗 Пов'язані файли

- `web/static/js/voice-control/conversation-mode-manager.js` (line 280) - емітує event
- `web/static/js/voice-control/services/microphone-button-service.js` (line 752) - підписка на event
- `web/static/js/voice-control/services/microphone-button-service.js` (line 941) - handleQuickSendModeStart()
- `web/static/js/voice-control/conversation/constants.js` (line 66) - константа CONVERSATION_MODE_QUICK_SEND_START

## 📋 Наступні кроки

1. ✅ Додано debug logging - ЗРОБЛЕНО
2. ⏳ Чекаємо логів від користувача
3. ⏳ Діагностика за випадками A/B/C/D
4. ⏳ Виправлення залежно від результатів

---

**Система перезапущена з debug logging. Очікуємо тестування.** 🔍
