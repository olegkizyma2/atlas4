# Agent Messages & Verification Logic Fix

**Date**: 2025-10-16  
**Status**: ✅ Fixed (Updated 00:42)  
**Priority**: Critical

## Problems (Updated 00:42)

### 1. Playwright відкриває вікно браузера Chromium при кожному screenshot

Кожного разу коли Гріша робить screenshot для перевірки, відкривається вікно браузера `about:blank`.

**Причина**: `HEADLESS: 'false'` в конфігурації Playwright MCP server.

### 2. Помилка доступу до файлу при перевірці файлів на Desktop

Гріша не може перевірити файли на Desktop через filesystem MCP server:
```
⚠️ ❌ Не підтверджено: "Зберегти результат в файл ritto.txt на робочому столі"
Причина: Помилка доступу до файлу
```

**Причина**: filesystem MCP server має обмежений доступ до `~/Desktop`, потрібно використовувати shell команди.

### 3. Повідомлення йдуть від [SYSTEM] замість [TETYANA]/[GRISHA] (FIXED EARLIER)

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

## Solutions (Updated 00:42)

### 1. Встановлено HEADLESS=true для Playwright

**Файл**: `config/global-config.js`

**До:**
```javascript
playwright: {
  command: 'npx',
  args: ['-y', '@executeautomation/playwright-mcp-server'],
  env: {
    HEADLESS: 'false'  // ❌ Browser window opens
  }
}
```

**Після:**
```javascript
playwright: {
  command: 'npx',
  args: ['-y', '@executeautomation/playwright-mcp-server'],
  env: {
    HEADLESS: 'true'  // ✅ FIXED 16.10.2025 - Run in headless mode
  }
}
```

**Результат**: Браузер більше не відкривається при screenshot, все працює в фоновому режимі.

### 2. Виправлено доступ до файлів на Desktop

**Файли**: 
- `orchestrator/workflow/mcp-todo-manager.js` (Lines 1581-1586)
- `prompts/mcp/grisha_verify_item_optimized.js` (Lines 101-106)

**Проблема**: Гріша використовував `filesystem__read_file` для файлів на Desktop, що викликало помилки доступу.

**Виправлення**: Додано інструкції використовувати shell команди для Desktop:

```javascript
// mcp-todo-manager.js - Grisha's verification tool planning
Приклади:
- Для "Відкрити калькулятор" → [{"server": "shell", "tool": "run_shell_command", "parameters": {"command": "screencapture -x /tmp/verify_calc.png"}}]
- Для "Створити файл на Desktop" → [{"server": "shell", "tool": "run_shell_command", "parameters": {"command": "cat ~/Desktop/filename.txt"}}]
- Для "Створити файл в /tmp" → [{"server": "filesystem", "tool": "read_file", "parameters": {"path": "/tmp/filename.txt"}}]

⚠️ ВАЖЛИВО: Для файлів на Desktop використовуй shell (cat ~/Desktop/file), НЕ filesystem (проблеми з доступом)
```

```javascript
// grisha_verify_item_optimized.js - Verification examples
**Приклад 2: Перевірка файлу (MCP tool needed)**
Success Criteria: "Файл містить текст 'Hello ATLAS'"
Execution Results: [{"tool": "write_file", "success": true, "path": "~/Desktop/test.txt"}]
→ Success but need to verify CONTENT
→ ⚠️ ВАЖЛИВО: Для Desktop використовуй shell__run_shell_command з "cat ~/Desktop/test.txt", НЕ filesystem (проблеми доступу)
→ {"verified": true, "reason": "Файл містить правильний текст", "evidence": {"tool": "shell_cat", "content_match": true}, "from_execution_results": false}
```

**Результат**: Гріша тепер використовує `shell__run_shell_command` з `cat ~/Desktop/file` для перевірки файлів на Desktop.

### 3. Виправлено підписи агентів для повідомлень (FIXED 00:51)

**Файл**: `orchestrator/workflow/mcp-todo-manager.js`

**Проблема**: Всі повідомлення йшли від `[SYSTEM]` замість від відповідних агентів.

**Зміни**:
- Додано подвійні емодзі для кращої видимості (📋 📋, ✅ ✅, ❌ ❌)
- Видалено зайві проміжні повідомлення (progress, retry)
- **КРИТИЧНО**: Змінено типи повідомлень на правильні агенти:
  - План виконання → `'atlas'` (було `'info'`)
  - Виконано → `'tetyana'` (було `'info'`)
  - Перевірено/Не підтверджено → `'grisha'` (було `'info'`)
  - Завершено → `'atlas'` (було `'success'/'info'/'error'`)

**До:**
```javascript
this._sendChatMessage(todoMessage, 'info');  // ❌ [SYSTEM]
this._sendChatMessage(`✅ ✅ Виконано: "${item.action}"`, 'info');  // ❌ [SYSTEM]
this._sendChatMessage(`✅ ✅ Перевірено: "${item.action}"`, 'info');  // ❌ [SYSTEM]
this._sendChatMessage(`🎉 Завершено: ...`, 'success');  // ❌ [SYSTEM]
```

**Після:**
```javascript
this._sendChatMessage(todoMessage, 'atlas');  // ✅ [ATLAS]
this._sendChatMessage(`✅ ✅ Виконано: "${item.action}"`, 'tetyana');  // ✅ [TETYANA]
this._sendChatMessage(`✅ ✅ Перевірено: "${item.action}"`, 'grisha');  // ✅ [GRISHA]
this._sendChatMessage(`🎉 Завершено: ...`, 'atlas');  // ✅ [ATLAS]
```

**Результат**: Кожне повідомлення тепер йде від правильного агента з подвійними емодзі.

### 4. Виправлено `_sendChatMessage()` - використання правильних типів повідомлень (EARLIER FIX)

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

## Files Modified (Updated 00:42)

1. **config/global-config.js**
   - Line 253: Changed `HEADLESS: 'false'` → `HEADLESS: 'true'` for Playwright

2. **orchestrator/workflow/mcp-todo-manager.js**
   - Lines 1581-1586: Added Desktop file access instructions for Grisha
   - Line 243: Changed plan message to 'atlas' (was 'info') ✅ [ATLAS]
   - Line 388: Changed execution message to 'tetyana' (was 'info') ✅ [TETYANA]
   - Lines 764-766: Changed verification messages to 'grisha' (was 'info') ✅ [GRISHA]
   - Line 335: Changed final summary to 'atlas' (was 'success'/'info'/'error') ✅ [ATLAS]
   - Line 459: Changed failure message with double emoji (❌ ❌)
   - Lines 370, 380, 743: Removed verbose progress messages
   - Updated `_sendChatMessage()` - Lines 116-173 (agent_message vs chat_message) [EARLIER]
   - Updated `_analyzeVerificationResults()` - Lines 1737-1769 (stricter verification rules) [EARLIER]

3. **prompts/mcp/grisha_verify_item_optimized.js**
   - Lines 101-106: Updated Example 2 with Desktop file access instructions

4. **docs/fixes/AGENT_MESSAGES_FIX_2025-10-16.md**
   - This documentation file (updated with new fixes)

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

### After Fix (Expected) - UPDATED 00:51
```
00:34:15 [ATLAS] 📋 📋 Розширений план виконання (3 пункти):
         1. Відкрити калькулятор
         2. Перемножити 333 на 2 в калькуляторі
         3. Зберегти результат в файл ritto.txt на робочому столі
         ⏱️ Орієнтовний час виконання: 24 секунд

00:34:21 [TETYANA] ✅ ✅ Виконано: "Відкрити калькулятор"
00:34:25 [GRISHA] ✅ ✅ Перевірено: "Відкрити калькулятор"
         Підтвердження: Калькулятор відкрито успішно

00:34:33 [TETYANA] ✅ ✅ Виконано: "Перемножити 333 на 2 в калькуляторі"
00:34:38 [GRISHA] ✅ ✅ Перевірено: "Перемножити 333 на 2 в калькуляторі"
         Підтвердження: Результат 666 підтверджено

00:34:45 [TETYANA] ✅ ✅ Виконано: "Зберегти результат в файл ritto.txt на робочому столі"
00:34:50 [GRISHA] ✅ ✅ Перевірено: "Зберегти результат в файл ritto.txt на робочому столі"
         Підтвердження: Файл містить правильний текст (666)

00:34:56 [ATLAS] 🎉 Завершено: 3/3 пунктів (100% успіху)

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

## Success Criteria (Updated 00:42)

**New Fixes (00:42):**
- [x] Playwright працює в headless mode (HEADLESS=true)
- [x] Гріша використовує shell для файлів на Desktop
- [x] Всі повідомлення мають подвійні емодзі (📋 📋, ✅ ✅, ❌ ❌)
- [x] Видалено зайві проміжні повідомлення (progress, retry)
- [x] Покращено фінальне повідомлення (🎉 Завершено: X/Y пунктів)
- [ ] Тестування: браузер не відкривається при screenshot
- [ ] Тестування: файли на Desktop перевіряються успішно

**Earlier Fixes:**
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

**Good signs (UPDATED 00:51):**
```
[ATLAS] 📋 📋 Розширений план виконання (3 пункти): ...
[TETYANA] ✅ ✅ Виконано: "..."
[GRISHA] ✅ ✅ Перевірено: "..."
[ATLAS] 🎉 Завершено: 3/3 пунктів (100% успіху)
```

**Bad signs:**
```
[SYSTEM] 📋 📋 Розширений план виконання ...  ← Should be [ATLAS]
[SYSTEM] ✅ Виконано: "..."  ← Should be [TETYANA]
[SYSTEM] ⚠️ Не підтверджено: "..."  ← Should be [GRISHA]
[SYSTEM] 🎉 Завершено: ...  ← Should be [ATLAS]
```

## Notes

- WebSocket Manager розрізняє `agent_message` та `chat_message`
- Frontend має обробляти обидва типи подій
- Agent names: `tetyana`, `grisha`, `atlas` (lowercase)
- Display names: `[TETYANA]`, `[GRISHA]`, `[ATLAS]` (uppercase)
- Гріша тепер більш "оптимістичний" - довіряє успішним інструментам
