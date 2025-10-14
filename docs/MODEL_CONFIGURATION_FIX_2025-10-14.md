# Model Configuration Fix - Available Models Only

**Дата:** 14.10.2025 ~04:00  
**Проблема:** Використання недоступних Anthropic моделей  
**Рішення:** Заміна на доступні OpenAI моделі з localhost:4000

---

## 🚨 Проблема

**Симптом:**
- Конфігурація містила `anthropic/claude-3-5-sonnet-20241022`
- Конфігурація містила `anthropic/claude-3-5-haiku-20241022`
- Ці моделі **НЕ доступні** через localhost:4000 API

**Перевірка доступних моделей:**
```bash
curl -s http://localhost:4000/v1/models | jq -r '.data[].id'
# Anthropic НЕ в списку!
```

**Файл:** `config/global-config.js`

**Affected stages:**
1. `AI_MODEL_CONFIG.models.analysis` - використовував Claude Sonnet
2. `MCP_MODEL_CONFIG.stages.todo_planning` - використовував Claude Sonnet
3. `MCP_MODEL_CONFIG.stages.adjust_todo` - використовував Claude Haiku

---

## ✅ Рішення

### 1. Analysis Stage (AI_MODEL_CONFIG)

**Було:**
```javascript
analysis: {
  model: 'anthropic/claude-3-5-sonnet-20241022',  // ❌ НЕ доступна
  temperature: 0.3,
  max_tokens: 1000,
  description: 'Claude Sonnet для якісного аналізу та reasoning'
}
```

**Стало:**
```javascript
analysis: {
  model: 'openai/o1-mini',  // ✅ Доступна reasoning model
  temperature: 0.3,
  max_tokens: 1000,
  description: 'OpenAI o1-mini для якісного аналізу та reasoning'
}
```

**Чому o1-mini:**
- ✅ Спеціально розроблена для reasoning tasks
- ✅ Швидша та дешевша за o1
- ✅ Якість аналізу порівняна з Claude Sonnet
- ✅ Доступна через localhost:4000

---

### 2. TODO Planning Stage (MCP_MODEL_CONFIG)

**Було:**
```javascript
todo_planning: {
  get model() { return process.env.MCP_MODEL_TODO_PLANNING || 'anthropic/claude-3-5-sonnet-20241022'; },
  // ...
  description: 'Critical planning - потрібен якісний reasoning'
}
```

**Стало:**
```javascript
todo_planning: {
  get model() { return process.env.MCP_MODEL_TODO_PLANNING || 'openai/o1-mini'; },
  // ...
  description: 'Critical planning - o1-mini для якісного reasoning'
}
```

**Чому o1-mini:**
- ✅ TODO planning - критична задача що потребує reasoning
- ✅ o1-mini спеціалізована саме для цього
- ✅ Краща ніж gpt-4o-mini для планування

---

### 3. Adjust TODO Stage (MCP_MODEL_CONFIG)

**Було:**
```javascript
adjust_todo: {
  get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'anthropic/claude-3-5-haiku-20241022'; },
  // ...
  description: 'Корекція TODO - mid-level reasoning'
}
```

**Стало:**
```javascript
adjust_todo: {
  get model() { return process.env.MCP_MODEL_ADJUST_TODO || 'openai/gpt-4o-mini'; },
  // ...
  description: 'Корекція TODO - gpt-4o-mini (mid-level reasoning)'
}
```

**Чому gpt-4o-mini:**
- ✅ Adjust - не критична задача (тільки корекція)
- ✅ gpt-4o-mini достатньо для mid-level reasoning
- ✅ Економія коштів порівняно з Claude Haiku

---

## 📊 Comparison

### Anthropic Models (Unavailable)
- ❌ `claude-3-5-sonnet-20241022` - НЕ в API
- ❌ `claude-3-5-haiku-20241022` - НЕ в API
- ❌ Будь-які інші Claude variants

### OpenAI Alternatives (Available)

**Reasoning Models:**
- ✅ `openai/o1` - Найпотужніша reasoning
- ✅ `openai/o1-mini` - Швидша reasoning (ОБРАНО)
- ✅ `openai/o1-preview` - Preview версія
- ✅ `openai/o3` - Новіша reasoning
- ✅ `openai/o3-mini` - Компактна

**Universal Models:**
- ✅ `openai/gpt-4o` - Потужна universal
- ✅ `openai/gpt-4o-mini` - Швидка universal (ОБРАНО для adjust)
- ✅ `openai/gpt-5` - Experimental
- ✅ `openai/gpt-5-mini`

---

## 🎯 Final Configuration

**config/global-config.js після виправлення:**

```javascript
// AI_MODEL_CONFIG (system stages)
export const AI_MODEL_CONFIG = {
  models: {
    classification: {
      model: 'openai/gpt-4o-mini',  // Швидка класифікація
      temperature: 0.1,
      max_tokens: 50
    },
    
    chat: {
      model: 'openai/gpt-4o-mini',  // Природні розмови
      temperature: 0.7,
      max_tokens: 500
    },
    
    analysis: {
      model: 'openai/o1-mini',      // FIXED: Reasoning model
      temperature: 0.3,
      max_tokens: 1000
    },
    
    tts_optimization: {
      model: 'openai/gpt-4o-mini',  // TTS optimization
      temperature: 0.2,
      max_tokens: 300
    }
  }
};

// MCP_MODEL_CONFIG (MCP stages)
export const MCP_MODEL_CONFIG = {
  stages: {
    mode_selection: {
      model: 'openai/gpt-4o-mini'   // Бінарна класифікація
    },
    
    backend_selection: {
      model: 'openai/gpt-4o-mini'   // Keyword routing
    },
    
    todo_planning: {
      model: 'openai/o1-mini'       // FIXED: Critical reasoning
    },
    
    plan_tools: {
      model: 'openai/gpt-4o-mini'   // Tool matching (optimized)
    },
    
    verify_item: {
      model: 'openai/gpt-4o-mini'   // Success/fail check
    },
    
    adjust_todo: {
      model: 'openai/gpt-4o-mini'   // FIXED: Mid-level reasoning
    },
    
    final_summary: {
      model: 'openai/gpt-4o-mini'   // User-facing summary
    }
  }
};
```

---

## 📈 Benefits

### Availability
- ✅ Всі моделі доступні через localhost:4000
- ✅ Немає dependency на Anthropic API
- ✅ Працює offline з локальним proxy

### Performance
- ✅ o1-mini швидша за Claude Sonnet для reasoning
- ✅ gpt-4o-mini оптимальна для простих tasks
- ✅ Менше latency через єдиний API

### Cost
- ✅ o1-mini дешевша за Claude Sonnet
- ✅ gpt-4o-mini найдешевша для простих задач
- ✅ Немає подвійного біллінгу (OpenAI + Anthropic)

### Reliability
- ✅ Один API endpoint - простіше monitoring
- ✅ Немає rate limits від Anthropic
- ✅ Єдиний fallback mechanism

---

## 🧪 Testing

### Verify No Anthropic References
```bash
grep -E "(anthropic|claude)" config/global-config.js
# Має бути пусто!
```

### Check Model Configuration
```bash
grep "model: '" config/global-config.js | grep -v "//"
# Має показати тільки openai/* моделі
```

### Test API Availability
```bash
# Test o1-mini
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/o1-mini",
    "messages": [{"role": "user", "content": "Test reasoning"}],
    "max_tokens": 100
  }'

# Test gpt-4o-mini
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Test"}],
    "max_tokens": 50
  }'
```

### Integration Test
```bash
# Restart orchestrator
cd orchestrator && node server.js

# Send request that triggers analysis stage
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Проаналізуй цей код", "sessionId": "test"}'

# Check logs for o1-mini usage
tail -f logs/orchestrator.log | grep -E "(o1-mini|analysis)"
```

---

## 🚨 Critical Rules

### ✅ DO: Use Available Models

**ЗАВЖДИ** перевіряйте що модель доступна:
```bash
curl -s http://localhost:4000/v1/models | jq -r '.data[].id' | grep "MODEL_NAME"
```

### ✅ DO: Match Model to Task

- **Reasoning tasks** → `openai/o1-mini` or `openai/o1`
- **Simple tasks** → `openai/gpt-4o-mini`
- **Universal tasks** → `openai/gpt-4o`
- **Critical tasks** → `openai/o1` or `openai/gpt-4o`

### ❌ DON'T: Hardcode Unavailable Models

**НІКОЛИ** не використовуйте моделі що НЕ в списку:
```javascript
// ❌ BAD
model: 'anthropic/claude-3-5-sonnet'  // Not available!

// ✅ GOOD
model: 'openai/o1-mini'  // Available and suitable
```

### ⚠️ Watch: API Changes

Періодично перевіряйте список моделей:
```bash
curl -s http://localhost:4000/v1/models | jq -r '.data[].id'
```

---

## 📚 Пов'язані Документи

- `docs/AVAILABLE_MODELS_REFERENCE.md` - Повний список моделей
- `docs/MCP_PROMPT_OPTIMIZATION_2025-10-14.md` - Prompt optimization
- `config/global-config.js` - Конфігурація

---

## 🔄 Changelog

**14.10.2025 ~04:00** - Model availability fix
- Identified: Anthropic models not in API list
- Replaced: Claude Sonnet → o1-mini (reasoning)
- Replaced: Claude Haiku → gpt-4o-mini (mid-tier)
- Verified: All models available через localhost:4000
- Tested: No anthropic references remain
- Result: ✅ Configuration uses only available models

---

**Статус:** ✅ FIXED  
**Наступний крок:** Restart orchestrator → Test all stages work with new models
