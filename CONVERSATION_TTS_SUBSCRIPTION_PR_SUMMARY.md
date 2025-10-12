# PR Summary: Conversation Mode TTS Subscription Fix

**Виправлення #5** з серії conversation mode fixes  
**Дата:** 12 жовтня 2025 - День ~14:30

---

## 🔴 Проблема
Після озвучення Atlas (TTS) continuous listening **НЕ запускався** - conversation loop зупинявся.

## ✅ Рішення
ConversationEventHandlers тепер підписується на TTS події через **`window.eventManager`** (глобальний) замість локального EventManager.

## 🔧 Зміни
- **event-handlers.js** (~25 LOC):
  - Створено `subscribeToGlobal()` method
  - TTS події (TTS_STARTED, TTS_COMPLETED, TTS_ERROR) через `window.eventManager`

## 📊 Результат
- ✅ Conversation loop працює циклічно
- ✅ Continuous listening автоматично після кожної TTS
- ✅ Pending messages відправляються правильно
- ✅ 28/28 verification checks PASSED

## 🎯 Критичне правило
**App-level події (TTS, Chat) ЗАВЖДИ емітуються через window.eventManager → ЗАВЖДИ підписуйтесь через window.eventManager!**

---

**Детально:** `docs/CONVERSATION_TTS_SUBSCRIPTION_FIX_2025-10-12.md`  
**Верифікація:** `./verify-conversation-fixes.sh` (28/28 ✅)
