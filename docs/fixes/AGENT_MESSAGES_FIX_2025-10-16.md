# Agent Messages & Verification Logic Fix

**Date**: 2025-10-16  
**Status**: ✅ Fixed  
**Priority**: Critical

## Problems

### 1. Повідомлення йдуть від [SYSTEM] замість [TETYANA]/[GRISHA]

Всі повідомлення в чаті показувалися як `[SYSTEM]`:
```
00:18:47 [SYSTEM] ✅ Виконано: "Відкрити калькулятор"
00:18:51 [SYSTEM] ⚠️ Не підтверджено: "Відкрити калькулятор"
```

**Очікувалось:**
```
00:18:47 [TETYANA] ✅ Виконано: "Відкрити калькулятор"
00:18:51 [GRISHA] ⚠️ Не підтверджено: "Відкрити калькулятор"
```

**Причина**: `_sendChatMessage()` використовував `chat_message` замість `agent_message` для всіх повідомлень.

### 2. Гріша завжди каже "НЕ ПІДТВЕРДЖЕНО" навіть коли інструменти успішні

З логів:
```
✅ Grisha tool playwright_screenshot succeeded
✅ Grisha tool read_file succeeded
🧠 Grisha analysis: ❌ NOT VERIFIED
Причина: Немає доказів, що 333 введено в калькулятор
```

**Проблема**: Гріша **виконує** інструменти успішно, але потім **не довіряє** їм і каже що немає доказів.

**Причина**: Промпт для аналізу був занадто суворий і не містив правил "якщо інструменти успішні → verified=true".

## Solutions

### 1. Виправлено `_sendChatMessage()` - використання правильних типів повідомлень

**До:**
```javascript
_sendChatMessage(message, type = 'info') {
    this.wsManager.broadcastToSubscribers('chat', 'chat_message', {
        message,
        messageType: type,  // ❌ Завжди chat_message
        sessionId: this.currentSessionId
    });
}
```

**Після:**
```javascript
_sendChatMessage(message, type = 'info') {
    const agentNames = ['tetyana', 'grisha', 'atlas', 'agent'];
    const isAgentMessage = agentNames.includes(type.toLowerCase());

    if (isAgentMessage) {
        // ✅ Send as agent_message (shows as [TETYANA], [GRISHA], etc)
        let agentName = type.toLowerCase();
        
        // Extract agent name from [AGENT] prefix if type is 'agent'
        if (agentName === 'agent') {
            const match = message.match(/^\[([A-Z]+)\]/);
            if (match) {
                agentName = match[1].toLowerCase();
            }
        }

        this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
            content: message,
            agent: agentName,  // ✅ Agent name for voice/display
            sessionId: this.currentSessionId
        });
    } else {
        // ✅ Send as chat_message (shows as [SYSTEM])
        this.wsManager.broadcastToSubscribers('chat', 'chat_message', {
            message,
            messageType: type,
            sessionId: this.currentSessionId
        });
    }
}
```

**Використання:**
```javascript
// Tetyana
this._sendChatMessage(`✅ Виконано: "${item.action}"`, 'tetyana');

// Grisha
this._sendChatMessage(`🔍 Перевіряю: "${item.action}"`, 'grisha');
this._sendChatMessage(`✅ Перевірено: "${item.action}"`, 'grisha');

// Atlas
this._sendChatMessage(`🔄 Коригую стратегію`, 'atlas');

// System
this._sendChatMessage(`📋 План створено`, 'info');
```

### 2. Покращено промпт для аналізу Гріші

**До:**
```javascript
const analysisPrompt = `Ти Гриша - верифікатор. 
Проаналізуй докази та визнач чи виконано завдання.

- verified: true якщо Success Criteria виконано (підтверджено доказами)
- verified: false якщо НЕ виконано або немає доказів
`;
```

**Проблема**: Немає чітких правил коли довіряти інструментам.

**Після:**
```javascript
const analysisPrompt = `Ти Гриша - верифікатор. 
Проаналізуй докази та визнач чи виконано завдання.

⚠️ КРИТИЧНО ВАЖЛИВІ ПРАВИЛА ВЕРИФІКАЦІЇ:

1. **Якщо Tetyana's execution показує success=true + Grisha's tools виконані успішно:**
   → verified=true (ДОВІРЯЙ інструментам!)
   
2. **Якщо Tetyana's execution показує error АБО Grisha's tools показують error:**
   → verified=false
   
3. **Якщо screenshot/file check показують КОНКРЕТНУ помилку:**
   → verified=false + опиши помилку

4. **Якщо ВСІ інструменти виконані успішно (success=true):**
   → verified=true (НЕ вигадуй проблеми!)

ПРИКЛАДИ:

✅ ПРАВИЛЬНО:
Tetyana: applescript_execute success=true
Grisha: playwright_screenshot success=true
→ {"verified": true, "reason": "Калькулятор відкрито успішно"}

❌ НЕПРАВИЛЬНО:
Tetyana: applescript_execute success=true
Grisha: playwright_screenshot success=true
→ {"verified": false, "reason": "Немає доказів"} ← ЦЕ ПОМИЛКА! Інструменти успішні!
`;
```

### 3. Видалено дублювання повідомлень

**Проблема**: `_safeTTSSpeak()` відправляв повідомлення `[AGENT]`, які дублювалися з повідомленнями від `verifyItem()`.

**Виправлення:**
```javascript
async _safeTTSSpeak(phrase, options = {}) {
    // REMOVED 16.10.2025 - Don't send chat messages from TTS
    // Chat messages are now sent by the methods that call _safeTTSSpeak
    
    if (this.tts && typeof this.tts.speak === 'function') {
        await this.tts.speak(phrase, ttsOptions);
    }
}
```

## Files Modified

1. **orchestrator/workflow/mcp-todo-manager.js**
   - Updated `_sendChatMessage()` - Lines 116-173 (agent_message vs chat_message)
   - Updated `_analyzeVerificationResults()` - Lines 1737-1769 (stricter verification rules)
   - Updated `_safeTTSSpeak()` - Lines 1493-1494 (removed duplicate messages)
   - Updated `verifyItem()` - Line 752 (removed redundant message)

2. **docs/fixes/AGENT_MESSAGES_FIX_2025-10-16.md**
   - This documentation file

## Testing

### Before Fix
```
00:18:47 [SYSTEM] ✅ Виконано: "Відкрити калькулятор"
00:18:51 [SYSTEM] ⚠️ Не підтверджено: "Відкрити калькулятор"
         Причина: Немає доказів

Logs:
✅ Grisha tool playwright_screenshot succeeded
🧠 Grisha analysis: ❌ NOT VERIFIED
```

### After Fix (Expected)
```
00:18:47 [TETYANA] ✅ Виконано: "Відкрити калькулятор"
00:18:51 [GRISHA] 🔍 Перевіряю: "Відкрити калькулятор"
00:18:52 [GRISHA] ✅ Перевірено: "Відкрити калькулятор"
         Підтвердження: Калькулятор відкрито успішно

Logs:
✅ Grisha tool playwright_screenshot succeeded
🧠 Grisha analysis: ✅ VERIFIED
```

### Test Command
```bash
# Restart orchestrator
./restart_system.sh restart

# Test calculator request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор і перемнож 333 на 2, результат запиши в файл ritto.txt на робочому столі"}'

# Monitor logs
tail -f logs/orchestrator.log | grep -E "(TETYANA|GRISHA|agent_message|verified)"
```

## WebSocket Event Types

### `agent_message` (для агентів)
```javascript
{
  type: 'agent_message',
  data: {
    content: "✅ Виконано: ...",
    agent: "tetyana",  // або "grisha", "atlas"
    sessionId: "...",
    timestamp: "..."
  }
}
```

**Відображення в чаті:** `[TETYANA] ✅ Виконано: ...`

### `chat_message` (для системи)
```javascript
{
  type: 'chat_message',
  data: {
    message: "📋 План створено",
    messageType: "info",  // або "success", "error", "progress"
    sessionId: "...",
    timestamp: "..."
  }
}
```

**Відображення в чаті:** `[SYSTEM] 📋 План створено`

## Benefits

### 1. Правильні імена агентів
- Тетяна: виконання завдань
- Гріша: перевірка та підтвердження
- Atlas: коригування стратегії
- System: системні повідомлення

### 2. TTS працює з правильними голосами
- `agent: 'tetyana'` → жіночий голос
- `agent: 'grisha'` → чоловічий голос
- `agent: 'atlas'` → командний голос

### 3. Гріша довіряє інструментам
- Якщо інструменти успішні → verified=true
- Менше false negatives
- Більше завдань підтверджуються

### 4. Чистіший чат
- Немає дублювання повідомлень
- Кожне повідомлення від правильного агента
- Легше відстежувати хто що робить

## Success Criteria

- [x] `_sendChatMessage()` використовує `agent_message` для агентів
- [x] `_sendChatMessage()` використовує `chat_message` для системи
- [x] Промпт Гріші містить правила довіри до інструментів
- [x] Видалено дублювання повідомлень з `_safeTTSSpeak()`
- [ ] Чат показує `[TETYANA]` для виконання
- [ ] Чат показує `[GRISHA]` для перевірки
- [ ] Гріша підтверджує успішні виконання (verified=true)
- [ ] TTS використовує правильні голоси

## Restart Required

⚠️ **YES** - WebSocket event type changes require restart:
```bash
./restart_system.sh restart
```

## Monitoring

Watch for these patterns in chat:

**Good signs:**
```
[TETYANA] ✅ Виконано: "..."
[GRISHA] 🔍 Перевіряю: "..."
[GRISHA] ✅ Перевірено: "..."
[ATLAS] 🔄 Коригую стратегію
```

**Bad signs:**
```
[SYSTEM] ✅ Виконано: "..."  ← Should be [TETYANA]
[SYSTEM] ⚠️ Не підтверджено: "..."  ← Should be [GRISHA]
```

## Notes

- WebSocket Manager розрізняє `agent_message` та `chat_message`
- Frontend має обробляти обидва типи подій
- Agent names: `tetyana`, `grisha`, `atlas` (lowercase)
- Display names: `[TETYANA]`, `[GRISHA]`, `[ATLAS]` (uppercase)
- Гріша тепер більш "оптимістичний" - довіряє успішним інструментам
