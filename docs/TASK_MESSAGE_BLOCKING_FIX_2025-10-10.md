# Task Mode Message Blocking Fix - 10.10.2025 (21:18)

## 🐛 Проблема

У режимі завдання (task mode) повідомлення від Атласа (stage 1) **НЕ з'являлись у чаті** на frontend.

### Симптоми
- ✅ Stage 1 (Atlas) виконується успішно - формує завдання для Тетяни
- ✅ Goose отримує та обробляє запит
- ✅ TTS відправляється та програється
- ❌ Frontend **НЕ отримує** повідомлення в чат
- ❌ Browser console: `Failed to parse stream message data: {"type` - SSE stream обривається

### Діагностика
```javascript
// orchestrator.log показав:
[21:16:15] Using AgentStageProcessor for stage 1: initial_processing
[21:16:20] [AGENT] atlas - complete: Completed stage 1 in 5819ms
[21:16:20] [AGENT] atlas - tts_wait: Waiting for TTS completion (task mode)  // ⬅️ БЛОКУВАННЯ!
[21:16:32] [TTS] mykyta - generated: TTS generated...  // ⬅️ 12 секунд чекання!

// Frontend browser console:
[21:16:14] [ORCHESTRATOR] Starting stream
// ... 18 секунд тиші ...
[21:17:05] Failed to parse stream message  // ⬅️ Timeout!
```

## 🔍 Корінь проблеми

### Проблема 1: TTS блокує повернення response
У `agent-stage-processor.js` (stage 1+, task mode):

```javascript
// ❌ БУЛО (блокує response):
if (!isChatMode) {
  // TASK MODE: Wait for TTS before returning
  await sendToTTSAndWait(contentForTTS, voice);  // ⬅️ Чекає 10-15 секунд!
}
return response;  // ⬅️ response повертається ПІСЛЯ TTS
```

### Проблема 2: SSE stream відправка ПІСЛЯ очікування
У `executor-v3.js`:

```javascript
// ❌ БУЛО:
const stageResponse = await executeConfiguredStage(...);  // ⬅️ Чекає TTS всередині!
if (stageResponse) {
  res.write(`data: ${JSON.stringify({...})}\n\n`);  // ⬅️ Пише через 15 сек!
}
```

**Результат:** Frontend чекає 15+ секунд на повідомлення → SSE timeout → помилка парсингу.

## ✅ Рішення

### Виправлення 1: Response повертається негайно, TTS йде async з promise

**Файл:** `orchestrator/workflow/stages/agent-stage-processor.js`

```javascript
// ✅ ВИПРАВЛЕНО:
// ALWAYS send TTS async - don't block response from reaching the user
logger.agent(this.agent, 'tts_async', 
  `Sending to TTS async (${isChatMode ? 'chat' : 'task'} mode)...`);

const ttsPromise = sendToTTSAndWait(contentForTTS, voice)
  .then(() => logger.agent(this.agent, 'tts_complete', `TTS completed for ${this.agent}`))
  .catch(err => logger.agent(this.agent, 'tts_error', `TTS failed: ${err.message}`));

// For task mode, attach promise to response so executor can await it AFTER sending message
if (!isChatMode) {
  response.ttsPromise = ttsPromise;  // ⬅️ Promise прикріплюється до response
}

return response;  // ⬅️ Повертається НЕГАЙНО!
```

### Виправлення 2: SSE відправка ПЕРЕД очікуванням TTS

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
// ✅ ВИПРАВЛЕНО:
const stageResponse = await executeConfiguredStage(...);  // Повертається негайно!

if (stageResponse) {
  // CRITICAL: Send to stream IMMEDIATELY
  if (res.writable && !res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type: 'agent_message', data: stageResponse })}\n\n`);
  }

  // NOW wait for TTS (task mode only)
  if (stageResponse.ttsPromise) {
    logger.info(`Waiting for TTS completion before next stage...`);
    await stageResponse.ttsPromise;  // ⬅️ Чекаємо ПІСЛЯ відправки в чат!
    delete stageResponse.ttsPromise;
  }

  session.history.push(stageResponse);
  // ...
}
```

## 🎯 Логіка роботи

### Chat Mode (stage 0):
1. AI відповідає → response повертається
2. SSE пише в stream → користувач бачить повідомлення
3. TTS йде async паралельно (Promise без await)

### Task Mode (stage 1+):
1. AI відповідає → response з прикріпленим `ttsPromise`
2. SSE пише в stream → користувач бачить повідомлення **НЕГАЙНО** ✅
3. Executor чекає на `ttsPromise` → TTS завершується
4. Тільки ТОДІ переходить до наступного stage

## 📊 Результат

### ✅ До виправлення:
- ❌ Повідомлення НЕ з'являються у чаті
- ❌ SSE stream timeout через 15+ сек чекання TTS
- ❌ Frontend показує помилки парсингу

### ✅ Після виправлення:
- ✅ Повідомлення з'являються у чаті **МИТТЄВО**
- ✅ TTS грає паралельно (не блокує UI)
- ✅ Workflow синхронізація збережена (Atlas говорить → Tetyana виконує)
- ✅ Немає помилок SSE stream

## 🧪 Тестування

```bash
# 1. Відкрити http://localhost:5001
# 2. Надіслати task: "відкрий калькулятор і набери 666"
# 3. Очікуваний результат:
#    - Повідомлення Atlas з'являється НЕГАЙНО в чаті ✅
#    - TTS грає паралельно ✅
#    - Немає помилок SSE у console ✅
#    - Tetyana виконує ПІСЛЯ завершення TTS Atlas ✅

# Перевірити логи:
tail -50 logs/orchestrator.log | grep -E "tts_async|Waiting for TTS"

# Має показати:
# [AGENT] atlas - tts_async: Sending to TTS async (task mode)
# Waiting for TTS completion before next stage...
# [AGENT] atlas - tts_complete: TTS completed for atlas
```

## 📝 Відмінності від Chat Mode TTS Fix

**Chat Mode Fix (21:00):** Відповіді НЕ з'являлись через блокування на TTS в handleChatRoute  
**Task Mode Fix (21:18):** Відповіді НЕ з'являлись через блокування на TTS в AgentStageProcessor

**Спільне:** Обидва виправлення роблять TTS async, але response повертається негайно  
**Відмінність:** Task mode зберігає синхронізацію workflow через `ttsPromise`

## 🔗 Пов'язані документи

- `docs/CHAT_TTS_BLOCKING_FIX_2025-10-10.md` - Chat mode fix (stage 0)
- `docs/TTS_WORKFLOW_SYNC_FIX_2025-10-10.md` - TTS workflow sync
- `docs/SSE_FORMAT_FIX_2025-10-10.md` - SSE stream format fix

---

**Виправлено:** 10.10.2025 о 21:18  
**Файли:** `agent-stage-processor.js`, `executor-v3.js`  
**Проблема:** Task mode messages blocked by TTS wait  
**Рішення:** Response returns immediately, TTS waits AFTER stream send
