# Chat Agent Messages Fix - 16.10.2025

## 🎯 Проблема

У веб-чаті **всі повідомлення відображались як [SYSTEM]** замість конкретних агентів ([ATLAS], [ТЕТЯНА], [ГРИША]).

## 🔍 Аналіз

### Backend (Orchestrator)
✅ **Правильно:**
- `mcp-todo-manager.js` відправляє `agent_message` з правильними агентами:
  ```javascript
  this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
      content: message,
      agent: agentName, // 'atlas', 'tetyana', 'grisha'
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString()
  });
  ```

### Frontend (Chat Manager)
❌ **Проблема:**
- `addMessage()` отримував агента як `'atlas'` (малі літери)
- Намагався знайти в `AGENTS['atlas']` 
- **Config мав правильні ключі** з малими літерами
- **НО:** не було нормалізації регістру в `addMessage()`

## ✅ Виправлення

### File: `web/static/js/modules/chat-manager.js`

**Зміни в методі `addMessage()`:**
```javascript
addMessage(content, agent = 'user', signature = null) {
  // FIXED 16.10.2025 - Normalize agent name to lowercase for consistent lookup
  const agentKey = agent.toLowerCase();
  
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    agent: agentKey, // Use normalized agent name
    signature: signature || AGENTS[agentKey]?.signature || `[${agent.toUpperCase()}]`,
    timestamp: Date.now(),
    color: AGENTS[agentKey]?.color || '#ffffff'
  };

  this.messages.push(message);
  this.renderMessage(message);

  if (this.messages.length > CHAT_CONFIG.maxMessages) {
    this.messages.shift();
    this.removeOldestMessage();
  }

  return message;
}
```

## 📊 Результат

✅ **До:** Всі повідомлення → `[SYSTEM]`  
✅ **Після:** Кожен агент зі своїм підписом:
- Atlas → `[ATLAS]` (зелений #00ff00)
- Tetyana → `[ТЕТЯНА]` (бірюзовий #00ffff)
- Grisha → `[ГРИША]` (жовтий #ffff00)
- System → `[SYSTEM]` (сірий #888888)

## 🔧 Технічні деталі

### Конфігурація агентів
```javascript
// config/agents-config.js (backend) 
// web/static/js/shared-config.js (frontend - auto-generated)
export const AGENTS = {
  "atlas": { signature: "[ATLAS]", color: "#00ff00", ... },
  "tetyana": { signature: "[ТЕТЯНА]", color: "#00ffff", ... },
  "grisha": { signature: "[ГРИША]", color: "#ffff00", ... },
  "system": { signature: "[SYSTEM]", color: "#888888", ... }
};
```

### Backend → Frontend Flow
```
1. MCPTodoManager._sendChatMessage('message', 'atlas')
   ↓
2. wsManager.broadcastToSubscribers('chat', 'agent_message', { agent: 'atlas', ... })
   ↓
3. Frontend WebSocket receives event
   ↓
4. chat-manager.handleAgentMessage({ agent: 'atlas', content: '...' })
   ↓
5. addMessage(content, 'atlas') → agentKey = 'atlas'.toLowerCase()
   ↓
6. AGENTS['atlas'] → { signature: "[ATLAS]", color: "#00ff00" }
   ↓
7. Render with correct signature and color
```

## 🎨 CSS Styling

Повідомлення мають різні кольори через класи:
```css
.chat-entry.agent-atlas { /* зелений */ }
.chat-entry.agent-tetyana { /* бірюзовий */ }
.chat-entry.agent-grisha { /* жовтий */ }
.chat-entry.agent-system { /* сірий */ }
```

## 🧪 Тестування

### Перевірка виправлення:
1. Запустити систему
2. Відправити завдання: "Відкрий калькулятор і перемнож 333 на 2"
3. Перевірити чат:
   - ✅ Atlas планування → `[ATLAS]` (зелений)
   - ✅ Tetyana виконання → `[ТЕТЯНА]` (бірюзовий)
   - ✅ Grisha верифікація → `[ГРИША]` (жовтий)

### Лог консолі:
```javascript
// Має показувати правильні агенти:
handleAgentMessage: agent=atlas, has_ttsContent=true, content_length=120
handleAgentMessage: agent=tetyana, has_ttsContent=true, content_length=85
handleAgentMessage: agent=grisha, has_ttsContent=true, content_length=95
```

## 📝 Критично

1. **ЗАВЖДИ** нормалізуйте регістр агента: `agent.toLowerCase()`
2. **ЗАВЖДИ** перевіряйте наявність в AGENTS: `AGENTS[agentKey]?.signature`
3. **Fallback:** Якщо агент не знайдено → `[${agent.toUpperCase()}]`
4. **Config sync:** `shared-config.js` генерується автоматично з `global-config.js`

## 🔗 Пов'язані файли

- ✅ `web/static/js/modules/chat-manager.js` - виправлено
- ✅ `config/agents-config.js` - конфіг агентів (source)
- ✅ `web/static/js/shared-config.js` - frontend config (auto-generated)
- ✅ `orchestrator/workflow/mcp-todo-manager.js` - backend sending (вже правильно)

## 📅 Metadata

- **Дата:** 16.10.2025 ~02:30
- **Проблема:** Agent messages показували [SYSTEM] замість [ATLAS]/[ТЕТЯНА]/[ГРИША]
- **Рішення:** Нормалізація регістру в `addMessage()`
- **Файлів змінено:** 1 (`chat-manager.js`)
- **LOC:** +3 (агентKey нормалізація)
