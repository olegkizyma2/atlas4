# TTS Completion Event Fix - 10.10.2025 (пізній вечір ~21:00)

## ✅ Проблема виправлена

### Симптом:
**Task mode відповіді НЕ з'являлись у чаті** - Atlas генерував відповідь але користувач її НЕ бачив.

**Логи показували:**
```
[AGENT] atlas - complete: Completed stage 1 in 4020ms with 2 context messages
[AGENT] atlas - tts_wait: Waiting for TTS completion (task mode) - voice: mykyta, length: 427 chars
[TTS] mykyta - generated: TTS generated, waiting for playback completion event...
[TTS] mykyta - queued: TTS request queued for frontend: id=tts_1760119172610_yxoc00ww4
# ❌ НЕ ПРИХОДИТЬ completion event від frontend!
# ❌ sendToTTSAndWait() чекає вічно
# ❌ Response НЕ повертається з AgentStageProcessor
# ❌ res.write() ніколи НЕ викликається
```

---

### Корінь проблеми:

**Frontend передавав VOICE замість AGENT** в `/tts/completed` endpoint.

**Місце помилки:** `web/static/js/modules/tts-manager.js`

#### Проблема 1: speak() method (line 413)
```javascript
// ❌ BEFORE (WRONG):
await this.playAudio(audioBlob, currentVoice);  // currentVoice = "mykyta"

// ✅ AFTER (FIXED):
await this.playAudio(audioBlob, agent);  // agent = "atlas"
```

**Наслідок:**
- `playAudio()` отримувала `agent = "mykyta"` замість `agent = "atlas"`
- В `audio.onended` викликався `notifyPlaybackCompleted("mykyta")`
- Backend очікував completion для `voice: "mykyta"` але шукав по `agent: "atlas"`
- **Event ніколи не матчився** → `sendToTTSAndWait()` чекав вічно

#### Проблема 2: Fallback notification (line 494)
```javascript
// ❌ BEFORE (WRONG):
await this.notifyPlaybackCompleted(voice);  // voice = "mykyta"

// ✅ AFTER (FIXED):
await this.notifyPlaybackCompleted(agent);  // agent = "atlas"
```

---

### Виправлення:

**Файл:** `/web/static/js/modules/tts-manager.js`

**Change 1 (line 413):**
```javascript
await this.playAudio(audioBlob, agent);  // Pass agent NOT voice
```

**Change 2 (line 494):**
```javascript
await this.notifyPlaybackCompleted(agent);  // Pass agent NOT voice
```

**Коментарі додані:**
```javascript
// CRITICAL FIX: Pass agent (atlas/tetyana/grisha) NOT voice (mykyta/dmytro) for completion tracking
```

---

### Backend очікування (для контексту):

**Orchestrator helper:** `orchestrator/helpers.js`

```javascript
function sendToTTSAndWait(text, voice) {
  return new Promise((resolve, reject) => {
    // Send TTS request...
    
    // Setup completion listener
    ttsCompletionHandlers.set(voice, resolve);  // ← Чекає на VOICE
    
    // Wait for /tts/completed POST with { voice: "mykyta" }
  });
}
```

**Frontend відправка (ВИПРАВЛЕНО):**
```javascript
async notifyPlaybackCompleted(agent) {
  // agent = "atlas" → отримуємо voice = "mykyta"
  const voice = AGENTS[agent]?.voice || agent;
  
  // POST /tts/completed with { voice: "mykyta" }
  await orchestratorClient.post('/tts/completed', { voice });
}
```

**Flow після виправлення:**
1. ✅ Atlas генерує response (427 chars)
2. ✅ `sendToTTSAndWait("text", "mykyta")` реєструє listener для `voice: "mykyta"`
3. ✅ Frontend отримує audio blob
4. ✅ `audio.onended` → викликає `notifyPlaybackCompleted("atlas")`
5. ✅ Конвертує `"atlas"` → voice `"mykyta"`
6. ✅ POST `/tts/completed` з `{ voice: "mykyta" }`
7. ✅ Backend знаходить listener для `"mykyta"` та resolve Promise
8. ✅ `AgentStageProcessor.execute()` повертає response
9. ✅ `executeTaskWorkflow()` відправляє `res.write()` з SSE format
10. ✅ Frontend отримує response і відображає в чаті

---

### Тестування:

**Інструкції:**
1. Hard refresh браузера: `Cmd+Shift+R` (Mac) або `Ctrl+Shift+R` (Windows)
2. Відправити task запит: "відкрий калькулятор"
3. Перевірити:
   - ✅ Atlas response з'являється в чаті ОДРАЗУ після генерації
   - ✅ Audio грає
   - ✅ В Network tab є POST `/tts/completed`
   - ✅ Немає помилок в консолі

**Очікуваний лог (backend):**
```
[AGENT] atlas - complete: Completed stage 1 in 4020ms
[AGENT] atlas - tts_wait: Waiting for TTS completion (task mode)
[TTS] mykyta - generated: TTS generated
[TTS] mykyta - queued: TTS request queued for frontend
[TTS] mykyta - event_received: Audio playback completed  ← NEW!
[TTS] mykyta - completed: TTS playback completed  ← NEW!
```

---

### Змінені файли:

1. `/web/static/js/modules/tts-manager.js`
   - Line 413: `await this.playAudio(audioBlob, agent);` (було `currentVoice`)
   - Line 494: `await this.notifyPlaybackCompleted(agent);` (було `voice`)

---

**Дата виправлення:** 10 жовтня 2025, ~21:00  
**Версія системи:** ATLAS v4.0  
**Статус:** Виправлено, очікує hard refresh для застосування
