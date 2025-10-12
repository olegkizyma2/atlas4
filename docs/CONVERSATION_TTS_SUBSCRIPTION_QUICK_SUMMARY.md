# Conversation Mode TTS Subscription Fix - Швидке резюме

**Дата:** 12 жовтня 2025 - День ~14:30  
**Виправлення #5** з серії conversation mode fixes

## 🔴 Проблема (1 речення)
Після TTS Atlas НЕ запускався continuous listening тому що ConversationEventHandlers підписувався на локальний EventManager, а app-refactored емітував TTS_COMPLETED через глобальний window.eventManager.

## ✅ Рішення (1 речення)
Створено метод `subscribeToGlobal()` та змінено TTS підписки (TTS_STARTED, TTS_COMPLETED, TTS_ERROR) використовувати `window.eventManager || this.eventManager`.

## 🔧 Виправлені файли
- `web/static/js/voice-control/conversation/event-handlers.js` (~25 LOC)

## 📊 Результат
- ✅ ConversationEventHandlers отримує TTS_COMPLETED події
- ✅ handleTTSCompleted викликається
- ✅ Pending messages відправляються
- ✅ Continuous listening запускається автоматично
- ✅ Conversation loop працює циклічно

## 🎯 Критичне правило
**App-level події (TTS, Chat) ЗАВЖДИ емітуються через window.eventManager, ЗАВЖДИ підписуйтесь через window.eventManager для цих подій!**

## 🔗 Паралель
Точно та сама проблема як Keyword Activation TTS Fix (16:45) - локальний vs глобальний EventManager.

---

**Детально:** `docs/CONVERSATION_TTS_SUBSCRIPTION_FIX_2025-10-12.md`
