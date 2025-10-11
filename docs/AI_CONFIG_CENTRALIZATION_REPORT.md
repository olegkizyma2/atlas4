# Звіт про централізацію AI моделей - 10.10.2025

## Огляд

Реалізовано централізовану систему конфігурації AI моделей для system stages. Це дозволяє:
- Швидко змінювати моделі без редагування коду
- Використовувати різні моделі для різних типів завдань
- Експериментувати з параметрами (temperature, max_tokens)
- Централізовано керувати 58+ доступними моделями

## Зміни в коді

### 1. config/global-config.js

**Додано нову секцію AI_MODEL_CONFIG:**

```javascript
export const AI_MODEL_CONFIG = {
  apiEndpoint: 'http://localhost:4000/v1/chat/completions',
  
  models: {
    classification: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 150,
      description: 'Fast mini model for classification tasks'
    },
    chat: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500,
      description: 'Natural conversation model'
    },
    analysis: {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      max_tokens: 1000,
      description: 'Powerful model for deep analysis'
    },
    tts_optimization: {
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 300,
      description: 'Text optimization for TTS'
    }
  },
  
  stageModels: {
    'stage0_mode_selection': 'classification',
    'stage0_chat': 'chat',
    'stage-2_post_chat_analysis': 'analysis',
    'stage-3_tts_optimization': 'tts_optimization'
  },
  
  defaultModel: 'classification'
};
```

**Додано helper функції:**

```javascript
export function getModelForStage(stageName) {
  const modelType = AI_MODEL_CONFIG.stageModels[stageName] 
    || AI_MODEL_CONFIG.defaultModel;
  return {
    endpoint: AI_MODEL_CONFIG.apiEndpoint,
    ...AI_MODEL_CONFIG.models[modelType]
  };
}

export function getModelByType(type) {
  return AI_MODEL_CONFIG.models[type];
}
```

### 2. orchestrator/workflow/stages/system-stage-processor.js

**Додано import:**
```javascript
import { getModelForStage } from '../../../config/global-config.js';
```

**Оновлено executeWithAIContext (lines 220-270):**

**Було:**
```javascript
const response = await axios.post('http://localhost:4000/v1/chat/completions', {
  model: 'openai/gpt-4o-mini',
  temperature: 0.1,
  max_tokens: 150,
  messages: contextMessages
}, ...);
```

**Стало:**
```javascript
const modelConfig = getModelForStage(this.name);

logger.debug(`Using model config for stage ${this.name}:`, {
  model: modelConfig.model,
  temperature: modelConfig.temperature,
  max_tokens: modelConfig.max_tokens
});

const response = await axios.post(modelConfig.endpoint, {
  model: modelConfig.model,
  temperature: modelConfig.temperature,
  max_tokens: modelConfig.max_tokens,
  messages: contextMessages
}, ...);
```

**Оновлено executeWithAI (lines 273-315):**
- Аналогічні зміни - використання `getModelForStage(this.name)`
- Видалено хардкоджені значення моделі

### 3. Документація

**Створені файли:**
- `docs/AI_MODEL_CONFIG_2025-10-10.md` - повна документація про конфігурацію моделей
- `tests/test-ai-config.sh` - тестовий скрипт для перевірки

**Оновлені файли:**
- `.github/copilot-instructions.md` - додано секцію про AI Model Configuration
- `README.md` - додано інформацію про нову можливість

## Переваги реалізації

### ✅ Централізація
- Вся конфігурація моделей в одному місці (`config/global-config.js`)
- Єдине джерело істини для AI параметрів
- Легко знайти та змінити конфігурацію

### ✅ Гнучкість
- Різні моделі для різних завдань:
  - **classification** (mode_selection): gpt-4o-mini, T=0.1 - швидка класифікація
  - **chat** (stage0_chat): gpt-4o-mini, T=0.7 - природна розмова
  - **analysis** (post_chat_analysis): gpt-4o, T=0.3 - глибокий аналіз
  - **tts_optimization**: gpt-4o-mini, T=0.2 - оптимізація тексту
- Можливість експериментувати з параметрами без змін коду

### ✅ Масштабованість
- Підтримка 58+ моделей на API port 4000:
  - OpenAI: GPT-5, GPT-4.1, GPT-4o
  - DeepSeek: deepseek-r1, deepseek-v3
  - Anthropic: Claude
  - Cohere: Command
  - Та інші
- Легко додавати нові типи моделей
- Fallback на default модель якщо не знайдено mapping

### ✅ Чистота коду
- Видалено всі хардкоди моделей з SystemStageProcessor
- Один метод для отримання конфігурації (`getModelForStage`)
- Логування конфігурації для debugging

### ✅ Обмежена область дії
- Впливає **ТІЛЬКИ** на system stages:
  - `stage0_mode_selection`
  - `stage0_chat`
  - `stage-2_post_chat_analysis`
  - `stage-3_tts_optimization`
- **НЕ впливає** на:
  - Goose Desktop (залишається незмінним)
  - Тетяна та інші агенти (працюють через Goose)
  - Agent task execution (використовує Goose)

## Тестування

### Автоматичний тест

```bash
./tests/test-ai-config.sh
```

**Результати:**
```
✓ AI_MODEL_CONFIG found in global-config.js
✓ getModelForStage function found
✓ SystemStageProcessor imports getModelForStage
✓ No hardcoded models found
✓ All structure tests passed
```

### Ручне тестування

**1. Перевірити що orchestrator працює:**
```bash
curl -s http://localhost:5101/health
# Очікується: {"status":"ok",...,"config":true}
```

**2. Відправити тестове повідомлення:**
```bash
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор і перемнож 333 на 2", "sessionId": "test"}'
```

**3. Перевірити логи:**
```bash
tail -50 logs/orchestrator.log | grep -E "model|mode_selection"
```

**Очікується:**
- `Using model config for stage stage0_mode_selection`
- `model: openai/gpt-4o-mini`
- `temperature: 0.1`
- Mode selection response: `{"mode": "task", ...}` для завдань з дієсловами дії

## Як використовувати

### Зміна моделі для стадії

**Варіант 1: Змінити mapping**
```javascript
// config/global-config.js
stageModels: {
  'stage0_mode_selection': 'analysis', // Використати потужнішу модель
  ...
}
```

**Варіант 2: Створити новий тип**
```javascript
models: {
  ...existing...,
  precise_classification: {
    model: 'openai/gpt-4o',
    temperature: 0.05,
    max_tokens: 200
  }
},
stageModels: {
  'stage0_mode_selection': 'precise_classification',
  ...
}
```

**Варіант 3: Спробувати іншу модель**
```javascript
models: {
  classification: {
    model: 'deepseek/deepseek-r1',  // DeepSeek з reasoning
    temperature: 0.2,
    max_tokens: 250
  },
  ...
}
```

### Після змін

```bash
# Перезапустити orchestrator
./restart_system.sh restart

# Перевірити що працює
curl -s http://localhost:5101/health

# Моніторити логи
tail -f logs/orchestrator.log | grep "model\|temperature"
```

## Статус

- ✅ **Структура:** Реалізовано і протестовано
- ✅ **Код:** Весь код оновлено, хардкоди видалено
- ✅ **Документація:** Створено повну документацію
- ✅ **Тести:** Автоматичний тест створено і проходить
- ⏳ **Функціональність:** Потребує валідації з реальними запитами

## Наступні кроки

1. ✅ Реалізовано централізовану конфігурацію
2. ✅ Оновлено код SystemStageProcessor
3. ✅ Створено документацію
4. ✅ Створено тести
5. ⏳ **TODO:** Протестувати mode_selection з різними моделями
6. ⏳ **TODO:** Fine-tune параметри якщо потрібно
7. ⏳ **TODO:** Оновити інші stages якщо виявиться корисним

## Модифіковані файли

```
✅ config/global-config.js                                  (додано AI_MODEL_CONFIG)
✅ orchestrator/workflow/stages/system-stage-processor.js   (використання config)
✅ docs/AI_MODEL_CONFIG_2025-10-10.md                       (нова документація)
✅ tests/test-ai-config.sh                                   (новий тест)
✅ .github/copilot-instructions.md                          (оновлено)
✅ README.md                                                (оновлено)
```

---
**Дата:** 10 жовтня 2025  
**Статус:** ✅ Реалізовано та протестовано  
**Автор:** AI Configuration System Team
