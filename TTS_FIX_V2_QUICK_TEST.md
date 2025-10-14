# 🔊 TTS Fix v2 - Quick Test Guide

**ВЕРСІЯ:** v2 (DI Container Fix)  
**ДАТА:** 14.10.2025 - Ніч  
**СТАТУС:** ✅ Ready for Testing

---

## ⚡ Що виправлено

**v1 (23:00):**
- ✅ WebSocket TTS delivery code
- ❌ DI Container НЕ інжектив wsManager

**v2 (23:30 - ТЕПЕР):**
- ✅ DI Container injection FIXED
- ✅ TTSSyncManager uses this.wsManager
- ✅ Complete end-to-end pipeline

---

## 🚀 Quick Start

### 1. Restart
```bash
cd /workspaces/atlas4
./restart_system.sh restart
```

### 2. Перевірити startup log
```bash
tail -20 logs/orchestrator.log | grep "TTS-SYNC"
```

**✅ ОЧІКУЄМО:**
```
[TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery
```

**❌ НЕ МАЄ БУТИ:**
```
[TTS-SYNC] ⚠️ TTS service not provided
```

### 3. Тест
```
Відкрити: http://localhost:5001
Написати: "на робочому столі створи файл test.txt"
```

### 4. Перевірити TTS logs
```bash
tail -50 logs/orchestrator.log | grep "TTS"
```

**✅ ОЧІКУЄМО:**
```
[TODO] 🔊 Requesting TTS: "План створено з 3 пунктів" (agent: atlas)
[TTS-SYNC] 🔊 Sending TTS to frontend: "План створено з 3 пунктів" (agent: atlas, mode: detailed)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 1500ms)
```

---

## 🔍 Що перевіряємо

### Startup Logs
```bash
grep "WebSocket Manager connected" logs/orchestrator.log
```
- Має бути 1 запис при старті
- Означає: wsManager successfully injected

### TTS Calls
```bash
grep "Requesting TTS" logs/orchestrator.log
```
- Має бути для кожного TODO item
- Atlas: "План створено..."
- Tetyana: "Планую виконання...", "Виконую..."
- Grisha: "Перевіряю результат..."

### TTS Delivery
```bash
grep "Sending TTS to frontend" logs/orchestrator.log
```
- Має бути для кожного TTS request
- Показує agent (atlas/tetyana/grisha)
- Показує mode (quick/normal/detailed)

### Success Messages
```bash
grep "TTS sent successfully" logs/orchestrator.log
```
- Має бути для кожного successful send
- Показує estimated duration

---

## ❌ Troubleshooting

### Проблема: "TTS service not provided"

**Означає:**
- DI Container НЕ інжектив wsManager
- service-registry.js має помилку

**Перевірка:**
```bash
grep -A5 "ttsSyncManager" orchestrator/core/service-registry.js | grep "dependencies"
```

**Має бути:**
```javascript
dependencies: ['wsManager', 'logger']
```

---

### Проблема: "Requesting TTS" але БЕЗ "Sending TTS"

**Означає:**
- this.wsManager = null в TTSSyncManager
- speak() method НЕ використовує this.wsManager

**Перевірка:**
```bash
grep "if (this.wsManager)" orchestrator/workflow/tts-sync-manager.js
```

**Має бути:**
```javascript
if (this.wsManager) {
    this.logger.system('tts-sync', `[TTS-SYNC] 🔊 Sending TTS to frontend...`);
    this.wsManager.broadcastToSubscribers(...);
}
```

---

### Проблема: Logs OK але NO audio

**Означає:**
- ✅ Backend працює
- ❌ Frontend TTS Manager не отримує events

**Перевірка (browser console):**
```javascript
// Має показати TTS Manager logs
[TTS Manager] Received agent_message: "..."
[TTS Manager] Playing TTS with voice: atlas
```

**Якщо немає logs:**
- WebSocket connection issue
- Frontend TTS Manager не підписаний на 'agent_message'
- Перевірити: `grep "agent_message" web/static/js/components/chat/tts-manager.js`

---

## 📊 Expected Full Flow

```
Startup:
[DI] Initializing container...
[DI] Resolved: wsManager
[DI] Resolved: ttsSyncManager
[TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery
    ↓
User sends message:
[TODO] 📋 Creating TODO...
[TODO] 🔊 Requesting TTS: "План створено з 3 пунктів" (agent: atlas)
[TTS-SYNC] 🔊 Sending TTS to frontend: "План створено..." (agent: atlas, mode: detailed)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 1500ms)
    ↓
Frontend (browser console):
[TTS Manager] Received agent_message: "План створено з 3 пунктів"
[TTS Manager] Playing TTS with voice: atlas
🔊 Audio playing...
[TTS Manager] TTS playback complete
```

---

## 📋 Files Changed (v2)

1. **service-registry.js** - DI Container injection
2. **tts-sync-manager.js** - Use this.wsManager
3. **mcp-todo-manager.js** - Remove wsManager passing

---

## ✅ Success Criteria

- ✅ Startup log: "WebSocket Manager connected for TTS delivery"
- ✅ TTS logs: "🔊 Requesting TTS" for each agent
- ✅ TTS logs: "🔊 Sending TTS to frontend" with agent names
- ✅ TTS logs: "✅ TTS sent successfully" with durations
- ✅ Browser console: TTS Manager receiving and playing audio
- ✅ User hears: Atlas/Tetyana/Grisha voices during workflow

---

**READY FOR MAC TESTING** 🚀

Команда для тебе:
```bash
./restart_system.sh restart
tail -f logs/orchestrator.log | grep "TTS"
```

Потім надішли знімок логів після тесту!
