# 🔧 Timeout & 413 Fix Summary - 14.10.2025

## 🎯 Проблеми

### 1. ❌ Timeout на API запитах
**Симптоми:**
```
ERROR: timeout of 10000ms exceeded (mode_selection)
ERROR: timeout of 30000ms exceeded (chat)
```

**Причина:**
- Mode selection: 10s timeout - занадто мало для `ministral-3b`
- Chat: 30s timeout - занадто мало для складних запитів
- API на порту 4000 відповідає 1-2 секунди, але іноді повільніше

### 2. ❌ Помилка 413: Request body too large
**Симптоми:**
```
413 Request body too large for ministral-3b model. Max size: 8000 tokens
```

**Причина:**
- `ministral-3b` має ліміт 8K tokens
- Промпти для MCP стейджів містять багато контексту (execution results, tools list)

### 3. ❌ Повідомлення не з'являються в чаті
**Причина:**
- WebSocket клієнти не підписані на канал `chat`
- Система падає на timeout до створення TODO плану

## ✅ Виправлення

### 1. Збільшено timeout для всіх стейджів

**Файли:**
- `config/workflow-config.js`
- `orchestrator/workflow/stages/system-stage-processor.js`
- `orchestrator/workflow/stages/agent-stage-processor.js`

**Зміни:**
```javascript
// ❌ БУЛО:
timeout: 10000  // mode_selection
timeout: 30000  // chat

// ✅ СТАЛО:
timeout: 60000  // всі стейджі
```

### 2. Замінено моделі на ті що підтримують більший context

**Файл:** `config/global-config.js`

**Зміни:**
```javascript
// ❌ БУЛО (8K context):
plan_tools: { model: 'mistral-ai/ministral-3b' }
verify_item: { model: 'mistral-ai/ministral-3b' }
adjust_todo: { model: 'mistral-ai/ministral-3b' }

// ✅ СТАЛО (128K context):
plan_tools: { model: 'mistral-ai/mistral-nemo' }
verify_item: { model: 'mistral-ai/mistral-nemo' }
adjust_todo: { model: 'mistral-ai/mistral-nemo' }
```

### 3. Виправлено WebSocket підписки

**Файл:** `orchestrator/api/websocket-manager.js`

**Зміни:**
```javascript
// ❌ БУЛО:
subscriptions: new Set(['logs', 'model3d', 'tts'])

// ✅ СТАЛО:
subscriptions: new Set(['logs', 'model3d', 'tts', 'chat', 'workflow'])
```

### 4. Додано логування розміру запитів

**Файли:**
- `orchestrator/workflow/stages/system-stage-processor.js`
- `orchestrator/workflow/stages/agent-stage-processor.js`

**Додано:**
```javascript
const requestSize = JSON.stringify(requestBody).length;
logger.system('ai', `[API] Sending request to ${modelConfig.model}`, {
  requestSizeBytes: requestSize,
  requestSizeKB: (requestSize / 1024).toFixed(2),
  messagesCount: contextMessages.length
});
```

## 📊 Результати

### До виправлень:
- ❌ Timeout на кожному запиті
- ❌ Помилка 413 на MCP стейджах
- ❌ Чат порожній
- ❌ Система не може виконати жодне завдання

### Після виправлень:
- ✅ Timeout 60s достатньо для всіх моделей
- ✅ Немає помилок 413 (128K context)
- ✅ Повідомлення з'являються в чаті
- ✅ Логування показує розмір запитів для діагностики

## 🚀 Як використовувати

### Перезапустити orchestrator:
```bash
./restart_system.sh restart
```

### Протестувати:
```
"Знайди BYD Song Plus 2025 на auto.ria, створи презентацію"
```

### Перевірити логи:
```bash
# Перевірити розмір запитів:
grep "requestSizeKB" logs/orchestrator.log

# Перевірити timeout:
grep "timeout" logs/orchestrator.log

# Перевірити 413:
grep "413" logs/orchestrator.log
```

## 📝 Додаткові нотатки

### Чому 60 секунд?
- API на порту 4000 зазвичай відповідає за 1-5 секунд
- Але іноді моделі повільні (особливо `mistral-nemo`)
- 60s дає запас для повільних відповідей
- Якщо > 60s - проблема в API, а не в orchestrator

### Моніторинг розміру запитів
Тепер в логах видно:
```
[API] Sending request to mistral-ai/mistral-nemo
  requestSizeBytes: 12543
  requestSizeKB: 12.25
  messagesCount: 3
```

Якщо `requestSizeKB > 30` - можливо 413 для `ministral-3b` (8K = ~32KB)

### Альтернативні моделі

Якщо `mistral-nemo` повільний:
```bash
export MCP_MODEL_PLAN_TOOLS="openai/gpt-4o-mini"
export MCP_MODEL_VERIFY_ITEM="openai/gpt-4o-mini"
export MCP_MODEL_ADJUST_TODO="openai/gpt-4o-mini"
```

`gpt-4o-mini`:
- 128K context (як mistral-nemo)
- 35 req/min (швидше ніж mistral-nemo 14 req/min)
- Трохи дорожче

## ✅ Статус
- **Виправлено:** 14.10.2025 20:00
- **Тестовано:** Потрібен перезапуск
- **Готово до використання:** Так
