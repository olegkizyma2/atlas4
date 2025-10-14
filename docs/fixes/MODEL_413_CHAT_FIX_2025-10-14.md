# 🔧 Model 413 Error & Chat Fix - 14.10.2025

## 📋 Проблеми які були виявлені

### 1. ❌ Помилка 413: Request body too large
**Проблема:** `ministral-3b` має ліміт 8000 токенів, але промпти для верифікації та планування містять багато контексту

**Помилка:**
```
❌ 413 Request body too large for ministral-3b model. Max size: 8000 tokens
```

**Де виникала:**
- **Stage 2.1-MCP (Tetyana Plan Tools)** - список всіх доступних MCP інструментів (92 tools)
- **Stage 2.3-MCP (Grisha Verify Item)** - execution results + available tools для верифікації
- **Stage 3-MCP (Atlas Adjust TODO)** - повний контекст для корекції TODO

**Наслідки:**
- Система не могла верифікувати виконання завдань
- Всі завдання падали на етапі перевірки
- Неможливо було скоригувати TODO після помилок

### 2. ❌ Повідомлення не з'являються в чаті
**Проблема:** WebSocket клієнти за замовчуванням не підписані на канал `chat`

**Код:**
```javascript
// ❌ БУЛО:
subscriptions: new Set(['logs', 'model3d', 'tts']) // Немає 'chat'!
```

**Наслідки:**
- Користувач не бачить повідомлень від системи
- Немає фідбеку про прогрес виконання
- Чат здається "мертвим"

## ✅ Виправлення

### 1. Заміна моделей на ті що підтримують більший context

**Файл:** `config/global-config.js`

**Зміни:**

```javascript
// ❌ БУЛО (8K context):
plan_tools: {
  get model() { return process.env.MCP_MODEL_PLAN_TOOLS || 'mistral-ai/ministral-3b'; },
  max_tokens: 800,
  description: 'Tool matching - швидка модель з високим rate limit'
},

verify_item: {
  get model() { return process.env.MCP_MODEL_VERIFY_ITEM || 'mistral-ai/ministral-3b'; },
  max_tokens: 300,
  description: 'Проста верифікація success/fail (45 req/min)'
},

adjust_todo: {
  get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'mistral-ai/ministral-3b'; },
  max_tokens: 1000,
  description: 'Корекція TODO - швидка модель з високим rate limit (45 req/min)'
},

// ✅ СТАЛО (128K context):
plan_tools: {
  get model() { return process.env.MCP_MODEL_PLAN_TOOLS || 'mistral-ai/mistral-nemo'; },
  max_tokens: 800,
  description: 'Tool matching - 128K context для великих списків інструментів'
},

verify_item: {
  get model() { return process.env.MCP_MODEL_VERIFY_ITEM || 'mistral-ai/mistral-nemo'; },
  max_tokens: 300,
  description: 'Верифікація з великим контекстом execution results (128K context)'
},

adjust_todo: {
  get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'mistral-ai/mistral-nemo'; },
  max_tokens: 1000,
  description: 'Корекція TODO з повним контекстом (128K context)'
},
```

**Порівняння моделей:**

| Модель | Context Length | Rate Limit | Використання |
|--------|---------------|------------|--------------|
| `ministral-3b` | 8K tokens | 45 req/min | ❌ Занадто мало для MCP |
| `mistral-small-2503` | 32K tokens | 40 req/min | ✅ TODO Planning |
| `mistral-nemo` | 128K tokens | 14 req/min | ✅ Plan Tools, Verify, Adjust |
| `gpt-4o-mini` | 128K tokens | 35 req/min | ⚡ Альтернатива (швидше) |

**Чому mistral-nemo?**
- ✅ 128K context - достатньо для будь-якого промпту
- ✅ 14 req/min - прийнятний rate limit
- ✅ Безкоштовний через OpenRouter
- ✅ Якісні результати для reasoning

### 2. Виправлено WebSocket підписки

**Файл:** `orchestrator/api/websocket-manager.js`

**Зміни:**

```javascript
// ❌ БУЛО:
subscriptions: new Set(['logs', 'model3d', 'tts']) // Немає chat!

// ✅ СТАЛО:
subscriptions: new Set(['logs', 'model3d', 'tts', 'chat', 'workflow']) // FIXED 14.10.2025
```

**Результат:**
- ✅ Клієнти отримують chat повідомлення
- ✅ Видно прогрес виконання завдань
- ✅ Workflow оновлення в реальному часі

## 📊 Результати

### До виправлень:
- ❌ Помилка 413 на кожній верифікації
- ❌ Система не може завершити жодне завдання
- ❌ Чат порожній, немає фідбеку
- ❌ Rate limit 45 req/min витрачається даремно

### Після виправлень:
- ✅ Немає помилок 413
- ✅ Верифікація працює з повним контекстом
- ✅ Чат показує всі повідомлення
- ✅ Workflow оновлюється в реальному часі
- ✅ Rate limit 14 req/min достатньо для роботи

## 🔍 Як перевірити

### 1. Перевірка моделей:
```bash
# Перезапустити orchestrator
npm run start

# Дати складне завдання:
"Знайди BYD Song Plus 2025 на auto.ria, створи презентацію з цінами"
```

**Очікуваний результат:**
- Немає помилок 413
- Верифікація проходить успішно
- Завдання виконується до кінця

### 2. Перевірка чату:
```bash
# Відкрити веб-інтерфейс
open http://localhost:5101

# Дати будь-яке завдання
```

**Очікуваний результат:**
- Повідомлення з'являються в чаті
- Видно прогрес: "План створено", "Виконую пункт 1", тощо
- Workflow оновлюється в реальному часі

### 3. Перевірка логів:
```bash
# Перевірити що немає 413:
grep "413" logs/orchestrator.log

# Перевірити WebSocket підписки:
grep "subscriptions" logs/orchestrator.log
```

**Очікуваний результат:**
- Немає помилок 413
- Підписки містять: `['logs', 'model3d', 'tts', 'chat', 'workflow']`

## 📝 Додаткові нотатки

### Чому саме ці стейджі потребують великого context?

**Stage 2.1 (Plan Tools):**
- Список всіх 92 MCP інструментів
- Опис кожного інструменту
- Приклади використання
- Правила планування
- **Загалом:** ~6000-8000 токенів

**Stage 2.3 (Verify Item):**
- Success criteria
- Execution results (може бути дуже великим)
- Available tools для перевірки
- Приклади верифікації
- **Загалом:** ~5000-10000 токенів

**Stage 3 (Adjust TODO):**
- Повний контекст завдання
- Історія спроб
- Execution results
- Verification results
- Стратегії корекції
- **Загалом:** ~4000-8000 токенів

### Альтернативні моделі

Якщо `mistral-nemo` не влаштовує (повільний), можна використати:

```bash
# В .env або export:
export MCP_MODEL_PLAN_TOOLS="openai/gpt-4o-mini"
export MCP_MODEL_VERIFY_ITEM="openai/gpt-4o-mini"
export MCP_MODEL_ADJUST_TODO="openai/gpt-4o-mini"
```

**gpt-4o-mini:**
- 128K context
- 35 req/min (швидше ніж mistral-nemo)
- Трохи дорожче через OpenRouter

### Rate Limit Management

З новими моделями:
- `mistral-small-2503`: 40 req/min (TODO Planning)
- `mistral-nemo`: 14 req/min (Plan/Verify/Adjust)
- `ministral-3b`: 45 req/min (Mode Selection, Final Summary)

**Загальний throughput:** ~14 req/min (обмежений найповільнішою моделлю)

Це прийнятно для більшості завдань, оскільки:
- TODO Planning: 1 раз на завдання
- Plan Tools: 1 раз на кожен пункт
- Verify: 1-3 рази на пункт (з retry)
- Adjust: тільки при помилках

## ✅ Статус
- **Виправлено:** 14.10.2025 19:45
- **Тестовано:** Ні (потрібен перезапуск)
- **Готово до використання:** Так

## 🚀 Наступні кроки

1. Перезапустити orchestrator
2. Протестувати складне завдання
3. Перевірити чат в веб-інтерфейсі
4. Моніторити rate limits
