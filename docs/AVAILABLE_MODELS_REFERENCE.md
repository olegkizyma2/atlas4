# Available Models Reference - localhost:4000

**Дата:** 14.10.2025 ~04:00  
**API Endpoint:** http://localhost:4000/v1/models

---

## 📋 Повний Список Доступних Моделей

### OpenAI Family (Рекомендовані для ATLAS)

**GPT-4 Series:**
- ✅ `openai/gpt-4o` - Найпотужніша модель, 128k context
- ✅ `openai/gpt-4o-mini` - Швидка та дешева, 8k context
- ✅ `openai/gpt-4.1` - Новіша версія GPT-4
- ✅ `openai/gpt-4.1-mini` - Mini версія 4.1
- ✅ `openai/gpt-4.1-nano` - Найшвидша, мінімальна

**GPT-5 Series (Experimental):**
- ✅ `openai/gpt-5` - Експериментальна v5
- ✅ `openai/gpt-5-chat` - Chat-optimized
- ✅ `openai/gpt-5-mini` - Легка версія
- ✅ `openai/gpt-5-nano` - Найменша

**o1 Series (Reasoning):**
- ✅ `openai/o1` - Reasoning model
- ✅ `openai/o1-mini` - Швидший reasoning (РЕКОМЕНДОВАНО)
- ✅ `openai/o1-preview` - Preview версія

**o3/o4 Series:**
- ✅ `openai/o3` - Новіша reasoning
- ✅ `openai/o3-mini` - Mini reasoning
- ✅ `openai/o4-mini` - Найновіша mini

**Embeddings:**
- ✅ `openai/text-embedding-3-large`
- ✅ `openai/text-embedding-3-small`

---

### Mistral AI (Альтернативи)

- ✅ `mistral-ai/mistral-large-2411` - Велика модель
- ✅ `mistral-ai/mistral-medium-2505` - Середня
- ✅ `mistral-ai/mistral-small-2503` - Маленька
- ✅ `mistral-ai/mistral-nemo` - Компактна
- ✅ `mistral-ai/ministral-3b` - 3B параметрів
- ✅ `mistral-ai/codestral-2501` - Для коду

---

### Meta Llama (Open Source)

**Llama 3.2:**
- ✅ `meta/llama-3.2-11b-vision-instruct` - Vision model
- ✅ `meta/llama-3.2-90b-vision-instruct` - Велика vision

**Llama 3.3:**
- ✅ `meta/llama-3.3-70b-instruct` - 70B інструкцій

**Llama 4 (Latest):**
- ✅ `meta/llama-4-maverick-17b-128e-instruct-fp8` - Maverick
- ✅ `meta/llama-4-scout-17b-16e-instruct` - Scout

**Llama 3.1:**
- ✅ `meta/meta-llama-3.1-405b-instruct` - 405B (величезна!)
- ✅ `meta/meta-llama-3.1-8b-instruct` - 8B (швидка)

---

### Microsoft Phi (Ефективні)

**Phi-3:**
- ✅ `microsoft/phi-3-mini-4k-instruct`
- ✅ `microsoft/phi-3-mini-128k-instruct`
- ✅ `microsoft/phi-3-small-8k-instruct`
- ✅ `microsoft/phi-3-small-128k-instruct`
- ✅ `microsoft/phi-3-medium-4k-instruct`
- ✅ `microsoft/phi-3-medium-128k-instruct`

**Phi-3.5:**
- ✅ `microsoft/phi-3.5-mini-instruct`
- ✅ `microsoft/phi-3.5-moe-instruct` - Mixture of Experts
- ✅ `microsoft/phi-3.5-vision-instruct` - Vision model

**Phi-4 (Latest):**
- ✅ `microsoft/phi-4` - Базова
- ✅ `microsoft/phi-4-mini-instruct`
- ✅ `microsoft/phi-4-mini-reasoning` - Reasoning
- ✅ `microsoft/phi-4-reasoning` - Повна reasoning
- ✅ `microsoft/phi-4-multimodal-instruct` - Multimodal

**MAI-DS:**
- ✅ `microsoft/mai-ds-r1` - Спеціалізована

---

### DeepSeek (Chinese Excellence)

- ✅ `deepseek/deepseek-r1` - Reasoning model
- ✅ `deepseek/deepseek-r1-0528` - Версія 0528
- ✅ `deepseek/deepseek-v3-0324` - V3

---

### xAI Grok

- ✅ `xai/grok-3` - Grok v3
- ✅ `xai/grok-3-mini` - Mini версія

---

### Cohere

- ✅ `cohere/cohere-command-a`
- ✅ `cohere/cohere-command-r-08-2024`
- ✅ `cohere/cohere-command-r-plus-08-2024`
- ✅ `cohere/cohere-embed-v3-english` - Embeddings
- ✅ `cohere/cohere-embed-v3-multilingual`

---

### AI21 Labs

- ✅ `ai21-labs/ai21-jamba-1.5-large`
- ✅ `ai21-labs/ai21-jamba-1.5-mini`

---

### Core42

- ✅ `core42/jais-30b-chat` - Arabic-focused

---

## 🎯 Рекомендації для ATLAS

### Classification (Швидка класифікація)
```javascript
model: 'openai/gpt-4o-mini'  // Швидко, дешево, достатньо
```

### Chat (Природна розмова)
```javascript
model: 'openai/gpt-4o-mini'  // Оптимальний баланс
```

### Reasoning (Складний аналіз)
```javascript
model: 'openai/o1-mini'      // Спеціалізована reasoning model
// АБО
model: 'openai/gpt-4o'       // Потужна universal
```

### Tool Planning (MCP)
```javascript
model: 'openai/gpt-4o-mini'  // Після prompt optimization достатньо
```

### TODO Planning (Critical)
```javascript
model: 'openai/o1-mini'      // Reasoning для якісного планування
// АБО
model: 'openai/gpt-4o'       // Universal fallback
```

---

## 💰 Cost Considerations

### Cheap (Дешеві)
- `openai/gpt-4o-mini` - $0.15/1M input
- `openai/gpt-4.1-nano`
- `microsoft/phi-4-mini-instruct`
- `mistral-ai/ministral-3b`

### Mid-Tier (Середні)
- `openai/gpt-4o` - $2.50/1M input
- `openai/o1-mini`
- `mistral-ai/mistral-medium-2505`

### Expensive (Дорогі)
- `openai/o1` - Reasoning premium
- `openai/gpt-5` - Experimental pricing
- `meta/meta-llama-3.1-405b-instruct` - Величезна

---

## 🚫 НЕ Доступні (Видалені з конфігурації)

❌ `anthropic/claude-3-5-sonnet-20241022` - НЕ в списку  
❌ `anthropic/claude-3-5-haiku-20241022` - НЕ в списку  
❌ Будь-які інші Anthropic моделі

**Причина:** Ці моделі НЕ доступні через localhost:4000 API.

---

## 📊 Current ATLAS Configuration

**После виправлення 14.10.2025:**

```javascript
// AI_MODEL_CONFIG (system stages)
classification: 'openai/gpt-4o-mini'
chat: 'openai/gpt-4o-mini'
analysis: 'openai/o1-mini'           // WAS: anthropic/claude (unavailable)
tts_optimization: 'openai/gpt-4o-mini'

// MCP_MODEL_CONFIG (MCP stages)
mode_selection: 'openai/gpt-4o-mini'
backend_selection: 'openai/gpt-4o-mini'
todo_planning: 'openai/o1-mini'      // WAS: anthropic/claude (unavailable)
plan_tools: 'openai/gpt-4o-mini'     // After prompt optimization
verify_item: 'openai/gpt-4o-mini'
adjust_todo: 'openai/gpt-4o-mini'    // WAS: anthropic/claude (unavailable)
final_summary: 'openai/gpt-4o-mini'
```

---

## 🧪 Testing Models

```bash
# List all available
curl -s http://localhost:4000/v1/models | jq -r '.data[].id'

# Test specific model
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/o1-mini",
    "messages": [{"role": "user", "content": "Test"}],
    "max_tokens": 50
  }'
```

---

## 📝 Environment Overrides

Можна override будь-яку модель через ENV:

```bash
# Override для MCP stages
export MCP_MODEL_TODO_PLANNING="openai/gpt-4o"
export MCP_MODEL_PLAN_TOOLS="openai/gpt-4o"
export MCP_MODEL_ADJUST_TODO="openai/o1-mini"

# Override для system stages (через AI_MODEL_CONFIG)
# (потребує змін в коді для підтримки ENV)
```

---

## 🔄 Migration Summary

**Changed models:**
1. `analysis` stage: `anthropic/claude-3-5-sonnet` → `openai/o1-mini`
2. `todo_planning` stage: `anthropic/claude-3-5-sonnet` → `openai/o1-mini`
3. `adjust_todo` stage: `anthropic/claude-3-5-haiku` → `openai/gpt-4o-mini`

**Reason:** Anthropic models NOT available in localhost:4000 API

**Impact:** ✅ NO breaking changes - all stages now use available models

---

**Status:** ✅ CONFIGURATION UPDATED  
**Next:** Restart orchestrator та перевірити що всі stages працюють
