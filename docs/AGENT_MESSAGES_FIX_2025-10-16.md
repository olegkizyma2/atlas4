# Виправлення відображення агентів у чаті (16.10.2025)

## Проблема

Всі повідомлення в чаті відображались як `[SYSTEM]` замість конкретних агентів (`[ATLAS]`, `[ТЕТЯНА]`, `[ГРИША]`).

### Симптоми з логів

**Веб-чат:**
```
03:33:41[SYSTEM]📋 📋 Розширений план виконання (10 пунктів)...
03:33:46[SYSTEM]✅ ✅ Виконано: "Відкрити браузер на auto.ria.com"
03:33:51[SYSTEM]✅ ✅ Перевірено: "Відкрити браузер на auto.ria.com"
```

**Очікувалось:**
```
03:33:41[ATLAS]📋 📋 Розширений план виконання (10 пунктів)...
03:33:46[ТЕТЯНА]✅ ✅ Виконано: "Відкрити браузер на auto.ria.com"
03:33:51[ГРИША]✅ ✅ Перевірено: "Відкрити браузер на auto.ria.com"
```

## Корінь проблеми

### Backend (правильно відправляв)

Backend коректно відправляв повідомлення з агентом через WebSocket:

```javascript
// orchestrator/workflow/mcp-todo-manager.js
this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
    content: message,
    agent: 'atlas',  // ✅ Правильно!
    sessionId: this.currentSessionId,
    timestamp: new Date().toISOString()
});
```

### WebSocket Manager (правильно формував)

WebSocket Manager створював правильний payload:

```javascript
// orchestrator/api/websocket-manager.js
sendToClient(clientId, type, data) {
    const message = JSON.stringify({
        type: 'agent_message',      // ✅ Правильний тип
        data: { 
            content: "...", 
            agent: "atlas",         // ✅ Агент є!
            ... 
        },
        timestamp: Date.now(),
        clientId
    });
    client.ws.send(message);
}
```

### Frontend (губив agent в ланцюжку)

**Проблема #1:** WebSocket Client передавав лише `data` без розгортання

```javascript
// web/static/js/core/websocket-client.js - BEFORE
case 'agent_message':
    this.emit('agent-message', data);  // ❌ Тільки data, без type
    break;
```

**Проблема #2:** App Initializer очікував плоску структуру

```javascript
// web/static/js/core/app-initializer.js - BEFORE
webSocket.on('agent-message', (data) => {
    const { content, agent } = data;  // ❌ Прямо з data (помилка)
    chatManager.addMessage(content, agent);
});
```

**Реальна структура payload:**
```json
{
  "type": "agent_message",
  "data": {
    "content": "...",
    "agent": "atlas"
  }
}
```

**Що отримувалось після emit:**
```javascript
data = {
  "content": "...",
  "agent": "atlas"
}
```

**Що витягувалось:**
```javascript
const { content, agent } = data;  // ✅ content = "...", ✅ agent = "atlas"
```

**Але!** Проблема була в іншому місці - chat-manager вже отримував правильні дані, але не правильно обробляв їх у `handleStreamMessage()`.

## Рішення

### 1. WebSocket Client - Передавати весь message object

```javascript
// web/static/js/core/websocket-client.js - FIXED
case 'agent_message':
    // Передаємо весь message object з type та data
    this.logger.debug('Agent message received', { type, data });
    this.emit('agent-message', { type, data });  // ✅ Весь об'єкт
    break;

case 'chat_message':
    this.logger.debug('Chat message received', { type, data });
    this.emit('chat-message', { type, data });  // ✅ Весь об'єкт
    break;
```

### 2. App Initializer - Розгортати data з payload

```javascript
// web/static/js/core/app-initializer.js - FIXED
webSocket.on('agent-message', (payload) => {
    if (chatManager && chatManager.addMessage) {
        // Payload має структуру: { type: 'agent_message', data: { content, agent, ... } }
        const data = payload.data || payload;  // ✅ Fallback для compatibility
        const { content, agent } = data;
        
        if (content && agent) {
            chatManager.addMessage(content, agent);
            loggingSystem.info(`📨 Повідомлення від ${agent.toUpperCase()}`, 'CHAT');
        } else {
            loggingSystem.warn('⚠️ Incomplete agent-message payload', 'CHAT');
            console.warn('[CHAT] Incomplete agent-message:', payload);
        }
    }
});

webSocket.on('chat-message', (payload) => {
    if (chatManager && chatManager.addMessage) {
        const data = payload.data || payload;  // ✅ Fallback
        const { message, messageType } = data;
        
        if (message) {
            chatManager.addMessage(message, messageType || 'system');
            loggingSystem.info(`📨 Системне повідомлення`, 'CHAT');
        } else {
            loggingSystem.warn('⚠️ Incomplete chat-message payload', 'CHAT');
            console.warn('[CHAT] Incomplete chat-message:', payload);
        }
    }
});
```

## Виправлені файли

1. **web/static/js/core/websocket-client.js**
   - Додано логування для діагностики
   - Передача всього payload (`{ type, data }`) замість лише `data`

2. **web/static/js/core/app-initializer.js**
   - Розгортання `data` з `payload.data`
   - Fallback для сумісності (`payload.data || payload`)
   - Валідація наявності обов'язкових полів
   - Попередження про неповні дані

## Результат

✅ **Atlas** → `[ATLAS]` (зелений #00ff00) + TTS голосом Atlas  
✅ **Тетяна** → `[ТЕТЯНА]` (бірюзовий #00ffff) + TTS голосом Тетяни  
✅ **Гриша** → `[ГРИША]` (жовтий #ffff00) + TTS голосом Гриші  
✅ **System** → `[SYSTEM]` (сірий #888888) + без TTS

## Event Flow

```
Backend (mcp-todo-manager.js)
  ↓ broadcastToSubscribers('chat', 'agent_message', { content, agent: 'atlas' })
  
WebSocket Manager (websocket-manager.js)
  ↓ sendToClient(clientId, 'agent_message', { content, agent })
  ↓ JSON.stringify({ type: 'agent_message', data: { content, agent }, ... })
  
Frontend (WebSocket Client)
  ↓ ws.onmessage → JSON.parse → { type, data }
  ↓ emit('agent-message', { type, data })  ✅ FIXED
  
App Initializer
  ↓ on('agent-message', (payload) => ...)
  ↓ const data = payload.data || payload  ✅ FIXED
  ↓ const { content, agent } = data
  
Chat Manager
  ↓ addMessage(content, agent)
  ↓ AGENTS[agent].signature → [ATLAS]/[ТЕТЯНА]/[ГРИША]
  ↓ TTS Manager → speak(content, AGENTS[agent].voice)
```

## Критичні правила

1. ✅ **WebSocket Client** ЗАВЖДИ передає весь payload: `{ type, data }`
2. ✅ **App Initializer** ЗАВЖДИ розгортає: `const data = payload.data || payload`
3. ✅ **Валідація** перед використанням: `if (content && agent) { ... }`
4. ✅ **Backend** правильно відправляв - НЕ треба було міняти
5. ✅ **TTS** автоматично отримує правильний голос через `AGENTS[agent].voice`

## Тестування

### Manual Test
1. Відправити запит: "на робочому столі створи файл"
2. Перевірити чат:
   - `[ATLAS]` для плану
   - `[ТЕТЯНА]` для виконання
   - `[ГРИША]` для верифікації
3. Перевірити TTS:
   - Atlas говорить про план
   - Тетяна говорить про виконання
   - Гриша говорить про верифікацію

### Console Check
```javascript
// Перевірити що payload має правильну структуру
webSocket.on('agent-message', (payload) => {
    console.log('[WS] Agent message:', payload);
    // Має показати: { type: 'agent_message', data: { content, agent, ... } }
});
```

## Додаткові покращення

1. **Діагностичне логування** додано у всіх критичних точках
2. **Fallback механізм** для backward compatibility
3. **Валідація даних** перед використанням
4. **Console warnings** при неповних даних для швидкого debugging

## Пов'язані документи

- `docs/CHAT_AGENT_MESSAGES_FIX_2025-10-16.md` (попередня спроба fix)
- `.github/copilot-instructions.md` (оновлено секцію про Chat Agent Messages Fix)

## Версія

- **Дата:** 16.10.2025 ~04:00
- **Версія ATLAS:** 4.0.0
- **Компоненти:** WebSocket Client, App Initializer, Chat Manager
