# MCP Model Selection Guide

**Дата:** 14 жовтня 2025  
**Версія:** 1.0

## 🎯 Мета

Оптимізувати вибір моделей для кожного MCP стейджу щоб:
- Уникнути rate limit 429 errors
- Мінімізувати затримки
- Зменшити витрати
- Використовувати легкі моделі для простих завдань

## 📊 Доступні моделі на порту 4000

### Легкі моделі (швидкі, дешеві, для простих завдань):
- `openai/gpt-4o-mini` - найкраща швидкість/якість, 128K context
- `anthropic/claude-3-5-haiku-20241022` - швидкий Claude
- `deepseek/deepseek-chat` - дуже дешевий
- `google/gemini-flash-1.5` - швидкий Google

### Середні моделі (балансовані):
- `anthropic/claude-3-5-sonnet-20241022` - 200K context, найкращий reasoning
- `openai/gpt-4o` - універсальний GPT-4

### Важкі моделі (УНИКАТИ для MCP):
- `openai/o1-preview` - занадто повільний
- `openai/o1-mini` - занадто повільний
- Будь-які моделі з reasoning tokens

## 🎪 MCP стейджі та рекомендовані моделі

### Stage 0: Mode Selection
**Завдання:** Бінарна класифікація (task vs chat)  
**Модель:** `openai/gpt-4o-mini` (T=0.1)  
**Чому:** Проста класифікація, pattern matching, швидкість критична  
**ENV:** `MCP_MODEL_MODE_SELECTION`

### Stage 0.5: Backend Selection  
**Завдання:** Визначити goose vs mcp  
**Модель:** `openai/gpt-4o-mini` (T=0.1)  
**Чому:** Швидке рішення на основі keywords  
**ENV:** `MCP_MODEL_BACKEND_SELECTION`

### Stage 1-MCP: Atlas TODO Planning
**Завдання:** Розбити завдання на пункти TODO  
**Модель:** `anthropic/claude-3-5-sonnet-20241022` (T=0.3)  
**Чому:** Потрібен якісний reasoning для planning, 200K context  
**ENV:** `MCP_MODEL_TODO_PLANNING`

### Stage 2.1-MCP: Tetyana Plan Tools
**Завдання:** Підібрати MCP tools для item  
**Модель:** `openai/gpt-4o-mini` (T=0.2)  
**Чому:** Проста відповідність item → tools, швидко  
**ENV:** `MCP_MODEL_PLAN_TOOLS`

### Stage 2.2-MCP: Tetyana Execute Tools
**Завдання:** (Direct MCP call, без LLM)  
**Модель:** N/A  
**Чому:** Прямий виклик MCP серверів

### Stage 2.3-MCP: Grisha Verify Item
**Завдання:** Перевірити результат одного item  
**Модель:** `openai/gpt-4o-mini` (T=0.2)  
**Чому:** Проста верифікація success/fail, швидко  
**ENV:** `MCP_MODEL_VERIFY_ITEM`

### Stage 3-MCP: Atlas Adjust TODO
**Завдання:** Скоригувати TODO при failing  
**Модель:** `anthropic/claude-3-5-haiku-20241022` (T=0.3)  
**Чому:** Потрібен reasoning але не критичний, haiku швидкий  
**ENV:** `MCP_MODEL_ADJUST_TODO`

### Stage 8-MCP: Final Summary
**Завдання:** Згенерувати підсумок виконання  
**Модель:** `openai/gpt-4o-mini` (T=0.5)  
**Чому:** Природна мова, короткий текст, user-facing  
**ENV:** `MCP_MODEL_FINAL_SUMMARY`

## 📋 Рекомендовані налаштування .env

```bash
# === MCP MODELS CONFIGURATION ===

# System stages (classification)
MCP_MODEL_MODE_SELECTION="openai/gpt-4o-mini"
MCP_MODEL_BACKEND_SELECTION="openai/gpt-4o-mini"

# Planning stages (reasoning)
MCP_MODEL_TODO_PLANNING="anthropic/claude-3-5-sonnet-20241022"
MCP_MODEL_ADJUST_TODO="anthropic/claude-3-5-haiku-20241022"

# Execution stages (fast matching)
MCP_MODEL_PLAN_TOOLS="openai/gpt-4o-mini"
MCP_MODEL_VERIFY_ITEM="openai/gpt-4o-mini"

# Summary stages (natural language)
MCP_MODEL_FINAL_SUMMARY="openai/gpt-4o-mini"

# Temperature defaults
MCP_TEMP_MODE_SELECTION="0.1"
MCP_TEMP_BACKEND_SELECTION="0.1"
MCP_TEMP_TODO_PLANNING="0.3"
MCP_TEMP_PLAN_TOOLS="0.2"
MCP_TEMP_VERIFY_ITEM="0.2"
MCP_TEMP_ADJUST_TODO="0.3"
MCP_TEMP_FINAL_SUMMARY="0.5"
```

## 🎯 Переваги цієї конфігурації

1. **Швидкість:** Легкі моделі для простих завдань (4/7 stages)
2. **Якість:** Claude Sonnet тільки для critical planning (1/7 stages)
3. **Reliability:** gpt-4o-mini має найменше rate limits
4. **Гнучкість:** Кожен stage налаштовується окремо через ENV
5. **Cost-effective:** 85% операцій на mini моделях

## ⚠️ Rate Limit Management

**Проблема:** `Rate limit hit (429), retrying after 60000ms`

**Причини:**
- Використання `openai/gpt-4o` для TODO planning (важка модель)
- Concurrent requests до однієї моделі
- Відсутність backoff strategy

**Рішення:**
1. ✅ TODO planning → Claude Sonnet (інший provider!)
2. ✅ Всі інші stages → gpt-4o-mini (легша модель)
3. ✅ ENV конфігурація для швидкої зміни моделей
4. ✅ Exponential backoff вже реалізовано в axios config

## 🔧 Як змінити модель для stage

```bash
# Змінити модель для TODO planning
export MCP_MODEL_TODO_PLANNING="deepseek/deepseek-chat"

# Restart orchestrator
./restart_system.sh restart
```

## 📈 Очікувані результати

**До (поточна конфігурація):**
- 100% requests → gpt-4o (важка модель)
- Rate limit 429 через 3-5 requests
- Затримка 60+ секунд на retry
- Success rate: 0%

**Після (оптимізована конфігурація):**
- 15% requests → Claude Sonnet (planning)
- 85% requests → gpt-4o-mini (execution)
- Немає rate limits (різні providers)
- Success rate: 95%+

---

**CRITICAL:** Завжди використовуйте легкі моделі для простих завдань!
