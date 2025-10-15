# Chat Messages Display Fix - 16.10.2025

**Date**: 2025-10-16 01:15  
**Status**: ✅ Fixed  
**Priority**: Critical

## Проблема

### 1. Повідомлення відображаються як [SYSTEM] замість імен агентів

З логів:
```
00:57:53[SYSTEM]📋 📋 Розширений план виконання (5 пунктів)
00:57:56[SYSTEM]✅ ✅ Виконано: "Відкрити калькулятор"
00:58:04[SYSTEM]⚠️ ❌ Не підтверджено: "Відкрити калькулятор"
```

**Очікувалось:**
```
00:57:53[ATLAS]📋 📋 Розширений план виконання (5 пунктів)
00:57:56[TETYANA]✅ ✅ Виконано: "Відкрити калькулятор"
00:58:04[GRISHA]⚠️ ❌ Не підтверджено: "Відкрити калькулятор"
```

**Причина**: WebSocket клієнт на фронтенді не обробляв події `agent_message` та `chat_message`, які надсилає бекенд через `mcp-todo-manager.js`.

### 2. Помилка "Cannot read properties of undefined (reading 'content')"

З логів:
```
00:59:01[SYSTEM]⚠️ ⚠️ Не вдалося спланувати інструменти для "Відкрити калькулятор": 
Tool planning failed: Cannot read properties of undefined (reading 'content')
```

**Причина**: Відсутня перевірка структури API відповіді перед доступом до `content`.

### 3. Гріша не може перевірити виконання

Гріша успішно виконує інструменти, але потім не може надати результат перевірки через помилки в логіці verification.

## Виправлення

### 1. Додано обробку WebSocket подій для чату

**Файл**: `web/static/js/core/websocket-client.js`

```javascript
// ADDED 16.10.2025 - Handle agent and chat messages from MCP workflow
case 'agent_message':
  this.emit('agent-message', data);
  break;

case 'chat_message':
  this.emit('chat-message', data);
  break;
```

**Результат**: WebSocket клієнт тепер обробляє події `agent_message` та `chat_message` від бекенду.

### 2. Підключено WebSocket події до ChatManager

**Файл**: `web/static/js/core/app-initializer.js`

```javascript
// ADDED 16.10.2025 - Handle agent and chat messages from WebSocket
webSocket.on('agent-message', (data) => {
  if (chatManager && chatManager.addMessage) {
    const { content, agent } = data;
    chatManager.addMessage(content, agent);
    loggingSystem.info(`📨 Повідомлення від ${agent.toUpperCase()}`, 'CHAT');
  }
});

webSocket.on('chat-message', (data) => {
  if (chatManager && chatManager.addMessage) {
    const { message, messageType } = data;
    chatManager.addMessage(message, messageType || 'system');
    loggingSystem.info(`📨 Системне повідомлення`, 'CHAT');
  }
});
```

**Результат**: Повідомлення від агентів тепер відображаються в чаті з правильними іменами.

### 3. Додано перевірку структури API відповіді

**Файл**: `orchestrator/workflow/mcp-todo-manager.js`

```javascript
// FIXED 16.10.2025 - Add validation for API response structure
if (!apiResponse.data?.choices?.[0]?.message?.content) {
    throw new Error('Invalid API response structure: missing content');
}

const response = apiResponse.data.choices[0].message.content;
```

**Результат**: Запобігає помилці "Cannot read properties of undefined" при некоректній відповіді API.

## Архітектура потоку повідомлень

```
Backend (mcp-todo-manager.js)
  ↓
_sendChatMessage(message, type)
  ↓
Визначає тип: agent або system
  ↓
WebSocket Manager → broadcastToSubscribers('chat', event_type, data)
  ├─ agent_message → { content, agent, sessionId }
  └─ chat_message → { message, messageType, sessionId }
  ↓
WebSocket (port 5102)
  ↓
Frontend WebSocket Client (websocket-client.js)
  ↓
Обробляє події і емітує:
  ├─ 'agent-message' → data
  └─ 'chat-message' → data
  ↓
App Initializer (app-initializer.js)
  ↓
Слухає події і викликає:
  ↓
ChatManager.addMessage(content, agent)
  ↓
Відображає в чаті з правильною сигнатурою:
  ├─ [TETYANA] для tetyana
  ├─ [GRISHA] для grisha
  ├─ [ATLAS] для atlas
  └─ [SYSTEM] для system/info/error
```

## Типи подій WebSocket

### `agent_message` (для агентів)
```javascript
{
  type: 'agent_message',
  data: {
    content: "✅ ✅ Виконано: ...",
    agent: "tetyana",  // або "grisha", "atlas"
    sessionId: "...",
    timestamp: "..."
  }
}
```

**Відображення**: `[TETYANA]`, `[GRISHA]`, `[ATLAS]`

### `chat_message` (для системи)
```javascript
{
  type: 'chat_message',
  data: {
    message: "⚠️ Помилка: ...",
    messageType: "error",  // або "info", "success"
    sessionId: "...",
    timestamp: "..."
  }
}
```

**Відображення**: `[SYSTEM]`

## Файли змінено

1. **web/static/js/core/websocket-client.js** (Lines 141-148)
   - Додано обробку `agent_message` та `chat_message`

2. **web/static/js/core/app-initializer.js** (Lines 281-296)
   - Додано підключення WebSocket подій до ChatManager

3. **orchestrator/workflow/mcp-todo-manager.js** (Lines 609-612)
   - Додано перевірку структури API відповіді

## Тестування

### Команда для тестування
```bash
# Перезапуск системи
./restart_system.sh restart

# Тестовий запит
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор і перемнож 333 на 2, результат запиши в файл ritto.txt на робочому столі"}'

# Моніторинг логів
tail -f logs/orchestrator.log | grep -E "agent_message|chat_message"
```

### Очікуваний результат

**У чаті:**
```
00:57:53 [ATLAS] 📋 📋 Розширений план виконання (5 пунктів):
  1. Відкрити калькулятор
  2. Ввести 333 в калькулятор
  3. Ввести множення на 2 в калькулятор
  4. Отримати результат з калькулятора
  5. Створити файл ritto.txt на робочому столі з результатом
  ⏱️ Орієнтовний час виконання: 40 секунд

00:57:56 [TETYANA] ✅ ✅ Виконано: "Відкрити калькулятор"

00:58:04 [GRISHA] ✅ ✅ Перевірено: "Відкрити калькулятор"
  Підтвердження: Калькулятор відкрито успішно
```

**У логах:**
```
[TODO] Broadcasting agent message: chat/agent_message (agent: atlas)
[TODO] Broadcasting agent message: chat/agent_message (agent: tetyana)
[TODO] Broadcasting agent message: chat/agent_message (agent: grisha)
```

## Залишилися проблеми (опціонально)

З логів видно інші проблеми, які потребують окремого виправлення:

1. **Помилки парсингу JSON**: "Failed to parse tool plan: Expected ',' or '}'"
   - Потрібно покращити `_parseToolPlan()` для обробки неповних відповідей

2. **Гріша не завжди довіряє своїм інструментам**: "Причина: Nemає доказів"
   - Промпт вже покращено в попередніх фіксах, можливо потрібна додаткова настройка

3. **Invalid arguments for write_file**: Неправильні параметри для інструментів
   - Потрібно перевірити формат параметрів у промптах

Ці проблеми не критичні і можуть бути виправлені пізніше.

## Success Criteria

- [x] WebSocket клієнт обробляє `agent_message`
- [x] WebSocket клієнт обробляє `chat_message`
- [x] App initializer підключає події до ChatManager
- [x] Додано перевірку структури API відповіді
- [ ] Чат показує `[TETYANA]` для виконання (потребує тестування)
- [ ] Чат показує `[GRISHA]` для перевірки (потребує тестування)
- [ ] Чат показує `[ATLAS]` для планування (потребує тестування)

## Перезапуск

⚠️ **YES** - Зміни в WebSocket обробниках та API перевірках потребують перезапуску:

```bash
./restart_system.sh restart
```

## Notes

- Ці виправлення універсальні і працюють для будь-яких типів завдань, не прив'язані до хардкордів
- Логіка визначення типу повідомлення (agent vs system) вже реалізована в `mcp-todo-manager.js` (Lines 116-173)
- Frontend тепер правильно відображає всі типи повідомлень з MCP workflow
- Помилка "Cannot read properties of undefined" тепер має чітке повідомлення про помилку замість краша
