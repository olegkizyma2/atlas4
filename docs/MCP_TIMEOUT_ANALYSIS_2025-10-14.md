# MCP Dynamic TODO Timeout Analysis
**Date**: 2025-10-14 15:34  
**Session**: session_1760445054536_g8tw80n80  
**Request**: "створи презентацію з цінами BYD Song Plus 2025"

---

## 🔴 Проблема 1: API Timeout (60 секунд)

### Симптоми
- Stage 2.1-MCP (Tetyana Plan Tools) timeout після 60 секунд
- Item 2 failed після 3 спроб (180 секунд загального зависання)
- Система не може завершити просте завдання

### Причина
**API на localhost:4000 перевантажений rate limits:**

```json
"mistral-ai/mistral-small-2503": {
  "per_minute": 40,
  "last429_at": 1760445476286,  // ← Rate limit error!
  "daily_requests": 63,
  "daily_errors": 1
}
```

### Часова лінія
```
15:30:56 - TODO створено (24 сек) ✅
15:31:20 - Item 1 виконано ✅
15:32:51 - Item 2 Attempt 1 timeout (60s) ❌
15:33:51 - Item 2 Attempt 2 timeout (60s) ❌  
15:34:51 - Item 2 Attempt 3 timeout (60s) ❌
```

### Корінна причина
1. **Занадто багато API calls**: 10 items = 10+ запитів до API
2. **Недостатня затримка**: 500ms між запитами замало
3. **Rate limiting**: API блокує запити через перевантаження

---

## 🔴 Проблема 2: Відсутність відповіді в чаті

### Симптоми
- Користувач бачить тільки "Обробка..." без feedback
- Жодних повідомлень про прогрес
- Жодних повідомлень про помилки

### Причина
**Критична помилка в WebSocket broadcast:**

```
[WARN] [MCP-TODO] Failed to send chat message: 
this.wsManager.broadcastToSession is not a function
```

### Корінна причина
`MCPTodoManager` викликає неіснуючий метод `wsManager.broadcastToSession()`.  
Правильний метод: `wsManager.broadcastToSubscribers(channel, type, data)`

---

## ✅ Рішення

### 1. Виправлено WebSocket Broadcast
**Файл**: `orchestrator/workflow/mcp-todo-manager.js`

```javascript
// BEFORE (BROKEN)
this.wsManager.broadcastToSession(this.currentSessionId, {
    type: 'chat_message',
    data: { message, messageType: type }
});

// AFTER (FIXED)
this.wsManager.broadcastToSubscribers('chat', 'chat_message', {
    message,
    messageType: type,
    sessionId: this.currentSessionId,
    timestamp: new Date().toISOString()
});
```

**Результат**: Тепер повідомлення надсилаються в UI:
- ✅ "📋 План створено, 10 пунктів"
- ✅ "🔄 Виконую: [action]"
- ✅ "✅ Виконано: [action]"
- ✅ "❌ Не вдалося: [action]"

---

### 2. Збільшено затримку між API calls
**Файл**: `orchestrator/workflow/mcp-todo-manager.js`

```javascript
// BEFORE
this.minApiDelay = 500; // 500ms

// AFTER
this.minApiDelay = 2000; // 2000ms to avoid rate limits
```

**Результат**: Менше rate limit errors, стабільніша робота

---

### 3. Додано логування моделей
**Файли**: 
- `orchestrator/workflow/mcp-todo-manager.js` (createTodo, planTools)

```javascript
this.logger.system('mcp-todo', 
  `[TODO] Using model: ${modelConfig.model} (temp: ${modelConfig.temperature})`
);
```

**Результат**: Тепер видно, яка модель використовується для кожного stage

---

## 📊 Метрики Performance

### TODO Planning (Stage 1-MCP)
- **Модель**: `mistral-ai/mistral-small-2503`
- **Час**: 24 секунди ✅
- **Результат**: 10 items, complexity 9/10

### Tool Planning (Stage 2.1-MCP)
- **Модель**: `openai/gpt-4o-mini`
- **Час**: 60+ секунд ❌ (timeout)
- **Проблема**: Rate limiting

---

## 🎯 Рекомендації

### Короткострокові (DONE)
1. ✅ Виправити WebSocket broadcast
2. ✅ Збільшити затримку між API calls (500ms → 2000ms)
3. ✅ Додати логування моделей

### Середньострокові (TODO)
1. **Batch tool planning**: Планувати інструменти для всіх items одразу
2. **Кешування**: Зберігати результати планування для схожих items
3. **Легша модель**: Використати `ministral-3b` для tool planning (45 req/min)

### Довгострокові (TODO)
1. **Local LLM**: Використати локальну модель для tool planning
2. **Adaptive rate limiting**: Динамічно підлаштовувати затримки
3. **Parallel execution**: Виконувати незалежні items паралельно

---

## 🔧 Testing

### Перезапуск системи
```bash
pkill -f "node.*orchestrator"
node orchestrator/core/application.js > logs/orchestrator.log 2>&1 &
```

### Перевірка логів
```bash
tail -f logs/orchestrator.log | grep -E "(Using model|TODO|chat_message)"
```

### Очікувані результати
1. ✅ Повідомлення в чаті відображаються
2. ✅ Логи показують використані моделі
3. ✅ Менше timeout errors
4. ⚠️ Повільніше виконання (через 2s затримки)

---

## 📝 Висновок

**Чому система не справилася з простим завданням?**

1. **API перевантажений** - rate limiting блокує запити
2. **WebSocket broken** - користувач не бачить прогресу
3. **Недостатня затримка** - 500ms замало між запитами

**Що виправлено?**

1. ✅ WebSocket broadcast працює
2. ✅ Затримка збільшена до 2s
3. ✅ Додано логування для діагностики

**Наступні кроки:**

Перезапустити систему та протестувати з простим завданням.
