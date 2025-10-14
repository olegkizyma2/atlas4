# MCP Model Optimization - Rate Limit Fix
**Date**: 2025-10-14 15:54  
**Issue**: Rate limiting causing 60s timeouts  
**Solution**: Switch to models with better rate limits

---

## 🎯 Проблема

API на `localhost:4000` має rate limits, які блокують запити:

```
mistral-small-2503: 40/min  ← Використовувалася для всіх stages
gpt-4o-mini:        35/min  ← Використовувалася для tool planning
```

**Наслідок**: При 10 items в TODO → 10+ API calls → Rate limit exceeded → Timeout 60s

---

## ✅ Рішення: Оптимізація моделей

### Аналіз доступних моделей

**Топ моделі з найкращими rate limits (без помилок):**

| Модель | Rate Limit | Tier | Daily Requests | Errors |
|--------|-----------|------|----------------|--------|
| `mistral-ai/ministral-3b` | **45/min** | 3b | 0 | 0 |
| `openai/gpt-4.1-nano` | **45/min** | gpt-4.x-nano | 0 | 0 |
| `microsoft/phi-3-mini-4k-instruct` | 40/min | mini-4k | 0 | 0 |
| `mistral-ai/mistral-small-2503` | 40/min | small | 0 | 0 |
| `microsoft/phi-3.5-mini-instruct` | 38/min | 3.5-mini | 0 | 0 |
| `openai/gpt-4o-mini` | 35/min | gpt-4o-mini | 0 | 0 |

**Обрано**: `mistral-ai/ministral-3b` (45 req/min, швидка, підтримує українську)

---

## 📋 Нова конфігурація моделей

### `.env` (UPDATED)

```bash
# Stage-specific models
# OPTIMIZED 14.10.2025 - Використання моделей з найкращими rate limits (45/min)
MCP_MODEL_MODE_SELECTION=mistral-ai/ministral-3b
MCP_MODEL_BACKEND_SELECTION=mistral-ai/ministral-3b
MCP_MODEL_TODO_PLANNING=mistral-ai/mistral-small-2503
MCP_MODEL_PLAN_TOOLS=mistral-ai/ministral-3b
MCP_MODEL_VERIFY_ITEM=mistral-ai/ministral-3b
MCP_MODEL_ADJUST_TODO=mistral-ai/ministral-3b
MCP_MODEL_FINAL_SUMMARY=mistral-ai/ministral-3b
```

### Розподіл по stages

| Stage | Модель | Rate Limit | Обґрунтування |
|-------|--------|-----------|---------------|
| **0: Mode Selection** | `ministral-3b` | 45/min | Швидка класифікація |
| **0.5: Backend Selection** | `ministral-3b` | 45/min | Keyword routing |
| **1: TODO Planning** | `mistral-small-2503` | 40/min | Критичний reasoning |
| **2.1: Plan Tools** | `ministral-3b` | 45/min | Найбільше викликів |
| **2.3: Verify Item** | `ministral-3b` | 45/min | Проста верифікація |
| **3: Adjust TODO** | `ministral-3b` | 45/min | Швидка корекція |
| **8: Final Summary** | `ministral-3b` | 45/min | User-facing текст |

---

## 🧪 Тестування `ministral-3b`

### Запит
```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-ai/ministral-3b",
    "messages": [{"role": "user", "content": "Відповідь українською: що таке TODO список?"}],
    "max_tokens": 100
  }'
```

### Відповідь
```json
{
  "choices": [{
    "message": {
      "content": "TODO список — це список завдань, які потрібно зробити. 
                  В українській мові це може бути перекладено як \"Список завдань\". 
                  Цей список використовується для організації робіт, планування та 
                  відстеження прогресів..."
    }
  }],
  "model": "ministral-3b-2410",
  "usage": {
    "completion_tokens": 100,
    "prompt_tokens": 17,
    "total_tokens": 117
  }
}
```

**Результат**: ✅ Швидко, українською, якісно

---

## 📊 Очікувані покращення

### До оптимізації
- **Rate limit**: 35-40 req/min (gpt-4o-mini, mistral-small)
- **Timeout**: 60s на кожен item
- **10 items**: 180+ секунд зависання (3 спроби × 60s)

### Після оптимізації
- **Rate limit**: 45 req/min (ministral-3b)
- **Timeout**: Рідко (більший запас)
- **10 items**: ~20-30 секунд (без timeout)
- **Затримка між calls**: 2000ms (додатковий захист)

---

## 🔧 Файли змінено

1. **`.env`** - Оновлено всі `MCP_MODEL_*` змінні
2. **`config/global-config.js`** - Оновлено default значення для всіх stages
3. **`orchestrator/workflow/mcp-todo-manager.js`** - Додано логування моделей

---

## 🚀 Deployment

### 1. Перезапуск системи
```bash
pkill -f "node.*orchestrator"
node orchestrator/core/application.js > logs/orchestrator.log 2>&1 &
```

### 2. Перевірка логів
```bash
tail -f logs/orchestrator.log | grep -E "(Using model|Planning tools with model)"
```

### 3. Очікувані логи
```
[TODO] Using model: mistral-ai/mistral-small-2503 (temp: 0.3, max_tokens: 2000)
[TODO] Planning tools with model: mistral-ai/ministral-3b (temp: 0.2, max_tokens: 800)
```

---

## 📈 Метрики для моніторингу

### Rate Limit Usage
```bash
curl -s http://localhost:4000/v1/models | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = ['mistral-ai/ministral-3b', 'mistral-ai/mistral-small-2503']
for m in data['data']:
    if m['id'] in models:
        rl = m['rate_limit']
        print(f\"{m['id']:40} {rl['per_minute']}/min  requests:{rl['daily_requests']:3}  errors:{rl['daily_errors']}\")
"
```

### Очікуваний output
```
mistral-ai/ministral-3b                  45/min  requests:  0  errors:0
mistral-ai/mistral-small-2503            40/min  requests:  0  errors:0
```

---

## 🎯 Переваги нової конфігурації

1. ✅ **+12.5% більше запитів** (45 vs 40 req/min)
2. ✅ **Менше timeout errors** (більший запас)
3. ✅ **Швидша обробка** (легша модель)
4. ✅ **Підтримка української** (native)
5. ✅ **0 помилок** (перевірено в API)

---

## 📝 Рекомендації

### Моніторинг
- Перевіряти `daily_requests` та `daily_errors` кожні 2 години
- Якщо `daily_errors > 0` → збільшити `minApiDelay` до 3000ms

### Fallback стратегія
Якщо `ministral-3b` перевантажиться:
1. **Plan B**: `openai/gpt-4.1-nano` (45 req/min)
2. **Plan C**: `microsoft/phi-3-mini-4k-instruct` (40 req/min)

### Довгострокові покращення
1. **Batch planning**: Планувати всі items одразу (1 API call замість 10)
2. **Кешування**: Зберігати результати для схожих items
3. **Local LLM**: Розгорнути локальну модель (без rate limits)

---

## ✅ Checklist

- [x] Проаналізовано доступні моделі
- [x] Обрано оптимальні моделі
- [x] Оновлено `.env`
- [x] Оновлено `global-config.js`
- [x] Протестовано `ministral-3b`
- [x] Додано логування моделей
- [ ] Перезапустити систему
- [ ] Протестувати з реальним завданням
- [ ] Моніторити rate limits

---

## 📚 Додаткові ресурси

- **Rate Limits API**: `http://localhost:4000/v1/models`
- **Timeout Analysis**: `docs/MCP_TIMEOUT_ANALYSIS_2025-10-14.md`
- **Model Config**: `config/global-config.js`
