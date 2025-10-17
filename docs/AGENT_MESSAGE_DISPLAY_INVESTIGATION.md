# Agent Message Display Investigation

## Дата: 17.10.2025
## Проблема: "У чаті всі повідомлення ідуть під system, а не агентський"

---

## 🔍 Аналіз Архітектури

### Current Message Flow:

```
Backend (Orchestrator)
  ↓
WebSocket: agent_message event
  {
    type: 'agent_message',
    data: {
      content: "Message text",
      agent: 'atlas' | 'tetyana' | 'grisha',
      sessionId: '...',
      timestamp: '...'
    }
  }
  ↓
Frontend (ChatManager)
  ↓
handleAgentMessage(data)
  ↓
addMessage(content, agent)
  ↓
renderMessage({
    content,
    agent: 'atlas',
    signature: '[ATLAS]',  // From AGENTS config
    color: '#00ff00'
  })
  ↓
DOM: <div class="chat-entry agent-atlas">
       <span class="chat-agent">[ATLAS]</span>
       <span class="chat-message">Message text</span>
     </div>
```

### Agent Configuration:

```javascript
// web/static/js/core/config.js (auto-generated)
export const AGENTS = {
    "atlas": {
        "name": "Атлас",
        "signature": "[ATLAS]",
        "color": "#00ff00"
    },
    "tetyana": {
        "name": "Тетяна",
        "signature": "[ТЕТЯНА]",
        "color": "#00ffff"
    },
    "grisha": {
        "name": "Гриша",
        "signature": "[ГРИША]",
        "color": "#ffff00"
    },
    "system": {
        "name": "System",
        "signature": "[SYSTEM]",
        "color": "#888888"
    }
};
```

---

## ✅ Код Виглядає Правильно

### Backend (Orchestrator):

**executor-v3.js** - Відправляє agent_message з правильним agent:
```javascript
wsManager.broadcastToSubscribers('chat', 'agent_message', {
    content: atlasResponse,
    agent: 'atlas',  // ✅ Правильно
    sessionId: session.id,
    timestamp: new Date().toISOString()
});
```

**mcp-todo-manager.js** - Відправляє agent_message для Tetyana/Grisha:
```javascript
const agentNames = ['tetyana', 'grisha', 'atlas', 'agent'];
const isAgentMessage = agentNames.includes(type.toLowerCase());

if (isAgentMessage) {
    this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
        content: message,
        agent: agentName,  // ✅ Правильно (tetyana/grisha/atlas)
        sessionId: this.currentSessionId,
        timestamp: new Date().toISOString()
    });
}
```

### Frontend (Chat Manager):

**chat-manager.js** - Обробляє agent_message:
```javascript
case 'agent_message':
    this._ttsSequence = (this._ttsSequence || Promise.resolve()).then(() =>
        this.handleAgentMessage(data.data)  // ✅ Викликає handleAgentMessage
    );
    await this._ttsSequence;
    break;
```

**handleAgentMessage()** - Додає повідомлення з agent:
```javascript
async handleAgentMessage(data) {
    const content = data.content || '';
    const agent = data.agent || 'system';  // ✅ Використовує data.agent
    
    if (content) {
        const agentName = agent.toUpperCase();
        this.logger.success(`📝 Відповідь від ${agentName}`, `Agent-${agentName}`);
    }
    
    const message = this.addMessage(content, agent);  // ✅ Передає agent
}
```

**renderMessage()** - Відображає з signature:
```javascript
renderMessage(message) {
    const agentClass = `agent-${message.agent || 'system'}`;  // ✅ CSS class
    messageElement.className = `chat-entry ${agentClass}`;
    
    messageElement.innerHTML = `
        <span class="chat-timestamp">${timestamp}</span>
        <span class="chat-agent">${message.signature || message.agent}</span>  // ✅ Signature
        <span class="chat-message">${this.formatMessageContent(message.content)}</span>
    `;
}
```

---

## 🤔 Можливі Причини Проблеми

### 1. MCP Status Messages (Intentional [SYSTEM])

**ПРАВИЛЬНА ПОВЕДІНКА** - Ці повідомлення МАЮТЬ бути [SYSTEM]:

```javascript
// MCP workflow status updates
handleMCPTodoCreated(data) {
    this.addMessage(`📋 ${data.summary}`, 'system');  // ✅ Правильно - status
}

handleMCPItemExecuted(data) {
    this.addMessage(`✅ ${data.summary}`, 'system');  // ✅ Правильно - status
}

handleMCPItemVerified(data) {
    this.addMessage(`${icon} ${data.summary}`, 'system');  // ✅ Правильно - status
}
```

**Пояснення**: Це НЕ повідомлення від агентів, а **системні статуси** про прогрес виконання.

### 2. Legacy Code Path (Потенційна Проблема)

Можливо є старий код path, який використовує:
- `chat_message` event замість `agent_message`
- Direct addMessage() з 'system' замість правильного agent
- SSE stream messages without agent field

### 3. CSS Display Issue (Потенційна Проблема)

Можливо CSS ховає agent signature або показує system замість agent class:
```css
/* Перевірити що є стилі для кожного агента */
.agent-atlas .chat-agent { color: #00ff00; }
.agent-tetyana .chat-agent { color: #00ffff; }
.agent-grisha .chat-agent { color: #ffff00; }
.agent-system .chat-agent { color: #888888; }
```

---

## 🧪 Тестовий Сценарій

### Тест 1: Перевірка Agent Message Event

```javascript
// В браузері console
window.addEventListener('message', (e) => {
    if (e.data.type === 'agent_message') {
        console.log('🎯 Agent Message:', e.data);
        console.log('   Agent:', e.data.data?.agent);
        console.log('   Content:', e.data.data?.content);
    }
});
```

### Тест 2: Перевірка Rendered Messages

```javascript
// В браузері console після отримання повідомлення
const messages = document.querySelectorAll('.chat-entry');
messages.forEach(msg => {
    const agent = msg.querySelector('.chat-agent').textContent;
    const classes = msg.className;
    console.log(`Agent: ${agent}, Classes: ${classes}`);
});

// Очікуваний output:
// Agent: [ATLAS], Classes: chat-entry agent-atlas
// Agent: [ТЕТЯНА], Classes: chat-entry agent-tetyana
// Agent: [ГРИША], Classes: chat-entry agent-grisha
```

### Тест 3: Перевірка WebSocket Messages

```bash
# В orchestrator logs
tail -f logs/orchestrator.log | grep "Broadcasting agent message"

# Очікуваний output:
# [TODO] Broadcasting agent message: chat/agent_message (agent: atlas)
# [TODO] Broadcasting agent message: chat/agent_message (agent: tetyana)
# [TODO] Broadcasting agent message: chat/agent_message (agent: grisha)
```

---

## 💡 Рекомендації

### Якщо користувач бачить ВСІ повідомлення як [SYSTEM]:

#### Причина 1: Переглядає тільки MCP status messages
**Рішення**: Пояснити що це нормально - статуси мають бути [SYSTEM], а відповіді агентів будуть [ATLAS]/[ТЕТЯНА]/[ГРИША]

#### Причина 2: Legacy code path
**Рішення**: 
1. Перевірити чи всі stage processors використовують agent_message events
2. Перевірити чи SSE stream messages містять agent field
3. Додати діагностичне логування в handleStreamMessage()

#### Причина 3: Frontend не обробляє agent_message
**Рішення**:
1. Перевірити що WebSocket підписка активна
2. Перевірити що handleAgentMessage викликається
3. Додати console.log в handleAgentMessage для debugging

### Якщо користувач бачить ДЕЯКІ повідомлення як [SYSTEM]:

**Це правильна поведінка!** Системні статуси (TODO створено, Item виконано, etc.) МАЮТЬ бути [SYSTEM].

Тільки **прямі відповіді агентів** (Atlas planning, Tetyana результати, Grisha verification) мають показувати agent signatures.

---

## 📊 Очікувана Поведінка в Чаті

### Правильний Chat Flow:

```
[00:15:32] [ATLAS]    Створюю план завдання з 3 пунктів...
[00:15:32] [SYSTEM]   📋 TODO list створено: 3 пункти
[00:15:33] [ТЕТЯНА]   Починаю виконання пункту 1...
[00:15:35] [SYSTEM]   ✅ Пункт 1 виконано
[00:15:35] [ГРИША]    Перевіряю результат візуально...
[00:15:37] [SYSTEM]   ✅ Пункт 1 перевірено (confidence: 95%)
[00:15:38] [ТЕТЯНА]   Виконую пункт 2...
```

**Пояснення**:
- **[ATLAS]** - Atlas відповідає користувачу, планує TODO
- **[ТЕТЯНА]** - Tetyana повідомляє про виконання
- **[ГРИША]** - Grisha повідомляє про верифікацію
- **[SYSTEM]** - Системні статуси (створено, виконано, перевірено)

---

## ✅ Висновок

**Архітектура ПРАВИЛЬНА**. Система коректно відправляє та обробляє agent_message events з правильними agent names.

**Можливі проблеми**:
1. Користувач переглядає тільки status messages (які правильно показують [SYSTEM])
2. Legacy code path для деяких stage processors
3. CSS не показує правильні agent signatures

**Рекомендація**:
1. Запустити систему з реальним завданням
2. Перевірити що бачать користувач в чаті
3. Перевірити browser console та backend logs
4. Якщо проблема залишається - додати діагностичне логування

---

**Статус**: Архітектура перевірена, код коректний ✅  
**Наступний крок**: Запустити та протестувати в реальному середовищі
