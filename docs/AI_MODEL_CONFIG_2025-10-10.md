# Централізована конфігурація AI моделей (10.10.2025)

## Проблема

Раніше моделі для system stages були хардкоджені в `system-stage-processor.js`:
```javascript
// ❌ Хардкод:
model: 'openai/gpt-4o-mini',
temperature: 0.1,
max_tokens: 150
```

Це робило неможливим:
- Швидко змінювати моделі для різних стадій
- Експериментувати з температурою та параметрами
- Використовувати різні моделі для різних типів завдань
- Централізовано керувати AI конфігурацією

## Рішення

Створено централізовану систему конфігурації моделей в `config/global-config.js`:

### 1. AI_MODEL_CONFIG секція

```javascript
export const AI_MODEL_CONFIG = {
  // API endpoint для system stages
  apiEndpoint: 'http://localhost:4000/v1/chat/completions',
  
  // Моделі для різних типів завдань
  models: {
    classification: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 150,
      description: 'Швидка модель для класифікації'
    },
    chat: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500
    },
    analysis: {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      max_tokens: 1000
    },
    tts_optimization: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 300
    }
  },
  
  // Mapping стадій до моделей
  stageModels: {
    'stage0_mode_selection': 'classification',
    'stage0_chat': 'chat',
    'stage-2_post_chat_analysis': 'analysis',
    'stage-3_tts_optimization': 'tts_optimization'
  },
  
  defaultModel: 'classification'
};
```

### 2. Helper функції

```javascript
// Отримати конфігурацію моделі для стадії
export function getModelForStage(stageName) {
  const modelType = AI_MODEL_CONFIG.stageModels[stageName] 
    || AI_MODEL_CONFIG.defaultModel;
  return {
    endpoint: AI_MODEL_CONFIG.apiEndpoint,
    ...AI_MODEL_CONFIG.models[modelType]
  };
}

// Отримати модель за типом
export function getModelByType(type) {
  return AI_MODEL_CONFIG.models[type];
}
```

### 3. Оновлений SystemStageProcessor

```javascript
import { getModelForStage } from '../../../config/global-config.js';

async executeWithAIContext(contextMessages, session, options = {}) {
  // Get model configuration from central config
  const modelConfig = getModelForStage(this.name);
  
  const response = await axios.post(modelConfig.endpoint, {
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    max_tokens: modelConfig.max_tokens,
    messages: contextMessages
  }, ...);
}
```

## Переваги

### ✅ Централізація
- Вся конфігурація моделей в одному місці
- Легко змінювати для експериментів
- Єдине джерело істини для AI параметрів

### ✅ Гнучкість
- Різні моделі для різних завдань:
  - **Classification**: `gpt-4o-mini` - швидка для mode_selection
  - **Chat**: `gpt-4o-mini` T=0.7 - природна розмова
  - **Analysis**: `gpt-4o` - потужна для аналізу
  - **TTS**: `gpt-4o-mini` T=0.2 - оптимізація тексту

### ✅ Масштабованість
- Легко додати нові типи моделей
- Можна перемикати моделі без змін коду
- Підтримка 58+ моделей на API port 4000

### ✅ ТІЛЬКИ для System Stages
- НЕ впливає на Goose (Тетяна, Atlas tasks)
- Використовується тільки для:
  - `stage0_mode_selection`
  - `stage0_chat`
  - `stage-2_post_chat_analysis`
  - `stage-3_tts_optimization`

## Доступні моделі на API

На `localhost:4000` доступно 58 моделей, включаючи:

**OpenAI:**
- `openai/gpt-5`, `openai/gpt-5-mini`, `openai/gpt-5-nano`
- `openai/gpt-4.1`, `openai/gpt-4.1-mini`, `openai/gpt-4.1-nano`
- `openai/gpt-4o`, `openai/gpt-4o-mini`

**DeepSeek:**
- `deepseek/deepseek-r1`, `deepseek/deepseek-r1-0528`
- `deepseek/deepseek-v3-0324`

**Anthropic:**
- `anthropic/claude-...` (різні версії)

**Cohere:**
- `cohere/cohere-command-...`

**Та інші:** AI21, Meta LLaMA, Mistral, тощо.

## Як змінити модель для стадії

### Варіант 1: Змінити mapping
```javascript
// config/global-config.js
stageModels: {
  'stage0_mode_selection': 'analysis', // Використати потужнішу модель
  ...
}
```

### Варіант 2: Створити новий тип
```javascript
// config/global-config.js
models: {
  ...existing...,
  
  precise_classification: {
    model: 'openai/gpt-4o',  // Потужніша модель
    temperature: 0.05,        // Нижча температура
    max_tokens: 200,
    description: 'Точна класифікація з reasoning'
  }
},

stageModels: {
  'stage0_mode_selection': 'precise_classification',
  ...
}
```

### Варіант 3: Експеримент з параметрами
```javascript
// config/global-config.js
models: {
  classification: {
    model: 'deepseek/deepseek-r1',  // DeepSeek для reasoning
    temperature: 0.2,
    max_tokens: 250
  },
  ...
}
```

## Тестування

```bash
# Перезапустити orchestrator
./restart_system.sh restart

# Перевірити що працює
curl -s http://localhost:5101/health

# Спробувати mode selection
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test"}'

# Дивитись логи
tail -f logs/orchestrator.log | grep "model\|temperature"
```

## Модифіковані файли

1. ✅ `config/global-config.js` - додано `AI_MODEL_CONFIG` та функції
2. ✅ `orchestrator/workflow/stages/system-stage-processor.js` - використання конфігурації
3. ✅ `docs/AI_MODEL_CONFIG_2025-10-10.md` - ця документація

## Примітки

- Конфігурація **НЕ впливає** на Goose та Тетяну
- Використовується **ТІЛЬКИ** для system stages
- Можна безпечно експериментувати з моделями
- Fallback на `classification` якщо не знайдено mapping

---
**Дата:** 10 жовтня 2025  
**Статус:** ✅ Реалізовано  
**Тестування:** Потребує валідації з різними моделями
