# AI Model Configuration - UPDATED 16.10.2025

**Статус:** ✅ Оптимізовано для порту 4000 з урахуванням доступних моделей
**Версія:** v5.0 Pure MCP Edition
**Last Updated:** 2025-10-16

---

## 📊 Таблиця моделей за стажами

### System Stages (stage0_*, stage-2, stage-3)

| Стадія                 | Змінна ENV                | Модель                          | Темп.    | Max Tokens | Rate Limit | Опис                                           |
| ---------------------- | ------------------------- | ------------------------------- | -------- | ---------- | ---------- | ---------------------------------------------- |
| **Mode Selection**     | `AI_MODEL_CLASSIFICATION` | `mistral-ai/ministral-3b`       | **0.05** | 50         | 45 req/min | Максимальна точність для бінарної класифікації |
| **Chat**               | `AI_MODEL_CHAT`           | `mistral-ai/mistral-small-2503` | **0.7**  | 500        | 40 req/min | Краща якість для креативних розмов             |
| **Post-Chat Analysis** | `AI_MODEL_ANALYSIS`       | `openai/gpt-4o-mini`            | **0.2**  | 1000       | 35 req/min | Якість аналізу + контекст                      |
| **TTS Optimization**   | `AI_MODEL_TTS_OPT`        | `mistral-ai/ministral-3b`       | **0.15** | 300        | 45 req/min | Стабільність для озвучки                       |

---

### MCP Stages (stage0-3, stage8-MCP)

| Стадія MCP                 | Змінна ENV (Model)            | Змінна ENV (Temp)            | Модель                          | Темп.    | Max Tokens | Rate Limit | Опис                                      |
| -------------------------- | ----------------------------- | ---------------------------- | ------------------------------- | -------- | ---------- | ---------- | ----------------------------------------- |
| **Mode Selection**         | `MCP_MODEL_MODE_SELECTION`    | `MCP_TEMP_MODE_SELECTION`    | `mistral-ai/ministral-3b`       | **0.05** | 50         | 45 req/min | Бінарна класифікація task vs chat         |
| **Backend Selection**      | `MCP_MODEL_BACKEND_SELECTION` | `MCP_TEMP_BACKEND_SELECTION` | `mistral-ai/ministral-3b`       | **0.05** | 50         | 45 req/min | Keyword routing (deprecated)              |
| **Stage 1: TODO Planning** | `MCP_MODEL_TODO_PLANNING`     | `MCP_TEMP_TODO_PLANNING`     | `mistral-ai/mistral-small-2503` | **0.3**  | 4000       | 40 req/min | Планування з балансом точності + креативу |
| **Stage 2.1: Plan Tools**  | `MCP_MODEL_PLAN_TOOLS`        | `MCP_TEMP_PLAN_TOOLS`        | `mistral-ai/mistral-small-2503` | **0.1**  | 2500       | 40 req/min | 🟢 ЧИСТИЙ JSON без markdown!               |
| **Stage 2.3: Verify Item** | `MCP_MODEL_VERIFY_ITEM`       | `MCP_TEMP_VERIFY_ITEM`       | `mistral-ai/mistral-small-2503` | **0.15** | 800        | 40 req/min | Точна верифікація з JSON                  |
| **Stage 3: Adjust TODO**   | `MCP_MODEL_ADJUST_TODO`       | `MCP_TEMP_ADJUST_TODO`       | `openai/gpt-4o-mini`            | **0.2**  | 1500       | 35 req/min | Якість корекції з аналізом                |
| **Stage 8: Final Summary** | `MCP_MODEL_FINAL_SUMMARY`     | `MCP_TEMP_FINAL_SUMMARY`     | `mistral-ai/ministral-3b`       | **0.5**  | 600        | 45 req/min | Природність резюме користувачу            |

---

## 🌡️ Температури за типом завдання

```
0.05 - МАКСИМАЛЬНА ТОЧНІСТЬ (бінарна класифікація, mode selection)
       └─ Для завдань де точність > креативність (1 правильна відповідь)

0.1  - JSON OUTPUT (план tools, верифікація)
       └─ Мінімальна варіативність для структурованого output

0.15-0.2 - АНАЛІЗ & ВЕРИФІКАЦІЯ
       └─ Точність + трохи креативу для різних підходів (Grisha, Atlas Adjust)

0.3  - ПЛАНУВАННЯ
       └─ Баланс точності (не розбіжні) + креативу (ідеї) - Atlas TODO

0.5  - РЕЗЮМЕ & SUMMARY
       └─ Природність, але не надмірна варіативність

0.7  - ЧАТ & РОЗМОВА
       └─ Максимальна креативність для природної комунікації
```

---

## 🔧 Як конфігурувати через .env

### Приклад 1: Замінити модель для Mode Selection

```bash
# За замовчуванням: mistral-ai/ministral-3b
# Замінити на більш потужну:
MCP_MODEL_MODE_SELECTION=openai/gpt-4o-mini
MCP_TEMP_MODE_SELECTION=0.03  # Ще більш точна
```

### Приклад 2: Побудити більш креативний chat

```bash
AI_MODEL_CHAT=meta/llama-3.3-70b-instruct
AI_TEMP_CHAT=0.9  # Ще креативніше
```

### Приклад 3: Більш точна верифікація

```bash
MCP_MODEL_VERIFY_ITEM=openai/gpt-4o  # Більш потужна
MCP_TEMP_VERIFY_ITEM=0.1  # Залишити точність
```

### Приклад 4: Швидше планування (speed mode)

```bash
MCP_MODEL_TODO_PLANNING=mistral-ai/ministral-3b  # 45 req/min замість 40
MCP_TEMP_TODO_PLANNING=0.25  # Трохи менше креативу
```

---

## 🎯 Вибір моделей за потребою

### Якщо потрібна МАКСИМАЛЬНА ЯКІСТЬ

```bash
# System stages
AI_MODEL_CLASSIFICATION=openai/gpt-4o-mini
AI_MODEL_CHAT=meta/llama-3.3-70b-instruct
AI_MODEL_ANALYSIS=cohere/cohere-command-r-plus-08-2024
AI_MODEL_TTS_OPT=openai/gpt-4o-mini

# MCP stages
MCP_MODEL_MODE_SELECTION=openai/gpt-4o-mini
MCP_MODEL_TODO_PLANNING=meta/llama-3.3-70b-instruct
MCP_MODEL_PLAN_TOOLS=openai/gpt-4o-mini
MCP_MODEL_VERIFY_ITEM=openai/gpt-4o-mini
MCP_MODEL_ADJUST_TODO=meta/llama-3.3-70b-instruct
MCP_MODEL_FINAL_SUMMARY=meta/llama-3.3-70b-instruct
```

**Недолік:** 2-6 req/min ліміти - повільна система!

### Якщо потрібна МАКСИМАЛЬНА ШВИДКІСТЬ

```bash
# System stages
AI_MODEL_CLASSIFICATION=mistral-ai/ministral-3b
AI_MODEL_CHAT=mistral-ai/ministral-3b
AI_MODEL_ANALYSIS=mistral-ai/ministral-3b
AI_MODEL_TTS_OPT=mistral-ai/ministral-3b

# MCP stages
MCP_MODEL_MODE_SELECTION=mistral-ai/ministral-3b
MCP_MODEL_TODO_PLANNING=mistral-ai/ministral-3b
MCP_MODEL_PLAN_TOOLS=mistral-ai/ministral-3b
MCP_MODEL_VERIFY_ITEM=mistral-ai/ministral-3b
MCP_MODEL_ADJUST_TODO=mistral-ai/mistral-small-2503
MCP_MODEL_FINAL_SUMMARY=mistral-ai/ministral-3b
```

**Вихід:** 40-45 req/min - ШВИДКА система!

### ✅ РЕКОМЕНДОВАНЕ: БАЛАНС ЯКІСТЬ + ШВИДКІСТЬ (за замовчуванням)

```bash
# Già налаштовано в .env - це оптимальний баланс!
# Не потрібно змінювати для більшості випадків
```

---

## 📈 Доступні моделі на порту 4000

### Швидкі (45 req/min)
- `mistral-ai/ministral-3b` ⭐ **Рекомендується** - швидко + якісно
- `meta/llama-3.2-11b-vision-instruct`
- `microsoft/phi-3.5-mini-instruct`

### Середні (35-40 req/min)
- `mistral-ai/mistral-small-2503` ⭐ **ЧИСТИЙ JSON для tool planning**
- `openai/gpt-4o-mini` ⭐ **Якість за доступну ціну**
- `meta/llama-3.1-8b-instruct`

### Потужні (10-18 req/min)
- `mistral-ai/mistral-medium-2505`
- `microsoft/phi-4`
- `cohere/cohere-command-r-08-2024`
- `meta/llama-3.3-70b-instruct` ⭐ **Найкраща якість, але повільна**

### Преміум (6-8 req/min, обмежено)
- `meta/meta-llama-3.1-405b-instruct`
- `microsoft/phi-4-reasoning`
- `openai/gpt-4.1`

---

## ⚠️ Важливі примітки

### 1. o1-mini ВИДАЛЕНО (16.10.2025)

Був: `openai/o1-mini` (reasoning model)  
Дозвіл: `openai/o1-mini` в списку на порту 4000  
**Видалено тому що:** 
- Коштує дорого (більше ніж потрібно)
- reasoning models мають особливу обробку та можуть спричинити rate limits
- Для ATLAS workflow нема потреби у reasoning на кожному кроці
- `gpt-4o-mini` дає 80% якості за 20% вартості

### 2. mistral-small-2503 генерує ЧИСТИЙ JSON

```javascript
// ✅ mistral-small-2503 - чистий JSON:
{"tool_calls": [...], "reasoning": "..."}

// ❌ phi-4, nemo - JSON у markdown:
```json
{"tool_calls": [...], "reasoning": "..."}
```
```

**Тому** `plan_tools` та `verify_item` використовують саме `mistral-small-2503`!

### 3. Rate limits критичні для production

- **45 req/min:** ministral-3b - швидкі short-lived задачі
- **40 req/min:** mistral-small-2503 - середні завдання
- **35 req/min:** gpt-4o-mini - якісні аналізи
- **4-6 req/min:** Llama 70B, GPT-4 - тільки для critical завдань!

### 4. Температури впливають на результат

```bash
# T=0.05: "Атлас. Атлас? Atlas." (максимально точно)
# T=0.3: "Атлас. Цей помічник. Atlas, творець." (варіювання)
# T=0.7: "Дивовижний Атлас! Творець світу!" (креативно)
```

---

## 🔄 Як перевірити конфігурацію

```bash
# 1. Переглянути що використовується
grep "MCP_MODEL\|AI_MODEL\|MCP_TEMP\|AI_TEMP" .env

# 2. Запустити систему з debug логами
LOG_LEVEL=debug npm start

# 3. В логах шукати яка модель використовується:
grep "Using model\|Model config\|temperature" logs/orchestrator.log

# 4. Тестувати конкретний стаж
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Привіт", "sessionId": "test"}'
```

---

## 📝 Історія змін

| Дата       | Зміна                     | Причина                                           |
| ---------- | ------------------------- | ------------------------------------------------- |
| 16.10.2025 | Видалено o1-mini          | Коштує дорого, нема потреби для ATLAS workflow    |
| 16.10.2025 | T=0.05 для classification | Максимальна точність для бінарної класифікації    |
| 16.10.2025 | T=0.1 для JSON output     | Мінімальна варіативність для структурованих даних |
| 16.10.2025 | Температури за типом      | Систематизація для кожного виду завдання          |
| 16.10.2025 | Усі змінні через ENV      | Гнучкість для швидкого експерименту               |

---

## 🚀 Наступні кроки

1. **Тестування:** Запустити систему з новою конфігурацією
2. **Метрики:** Відстежити latency та accuracy кожного стажу
3. **Оптимізація:** При необхідності штонути fine-tune температури
4. **Dokumentation:** Оновити окремо для особливих випадків

