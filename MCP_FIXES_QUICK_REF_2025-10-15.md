# MCP Fixes Quick Reference - 15.10.2025

## ЩО БУЛО ВИПРАВЛЕНО

### 1. Mistral-Small замість Phi-4 (CRITICAL!)
```javascript
// config/global-config.js
plan_tools: {
  model: 'mistral-ai/mistral-small-2503',  // Було: mistral-nemo
  temperature: 0.15,  // Було: 0.2
  max_tokens: 1200,  // Було: 800
}
verify_item: {
  model: 'mistral-ai/mistral-small-2503',  // Було: mistral-nemo
  temperature: 0.15,  // Було: 0.2
  max_tokens: 500,  // Було: 300
}
```

**Чому:**
- ✅ ЧИСТИЙ JSON (без ```json markdown)
- ✅ Реальні URLs (НЕ example.com)
- ✅ Детермінізм (T=0.15)

---

### 2. Safe API Response
```javascript
// orchestrator/workflow/mcp-todo-manager.js - Line ~778
if (!apiResponse.data?.choices?.[0]?.message?.content) {
    throw new Error('Invalid API response');
}
const response = apiResponse.data.choices[0].message.content;
```

**Чому:**
- ✅ NO undefined crashes
- ✅ Зрозумілі error messages

---

### 3. Промпти - Ідеологія > Приклади
```javascript
// prompts/mcp/tetyana_plan_tools_optimized.js

// БУЛО: 120 LOC прикладів
// СТАЛО: 60 LOC ідеології

ПРИНЦИПИ:
1. Мінімізація викликів
2. Точність parameters
3. Послідовність дій
4. Валідність tools
5. Реальність URLs
```

**Чому:**
- ✅ -50% token usage
- ✅ LLM розуміє ідеологію
- ✅ Реальні URLs а не examples

---

### 4. TTS Availability
**Стан:** ✅ УЖЕ ПРАЦЮЄ
- `_safeTTSSpeak()` викликається 16x
- Atlas, Tetyana, Grisha фази
- Graceful fallback якщо TTS unavailable

**Діагностика:**
```bash
grep "TTS check" logs/orchestrator.log
# Має: tts=true, speak=function
```

---

## ШВИДКИЙ ТЕСТ

```bash
# 1. Restart
./restart_system.sh restart

# 2. Відкрити: http://localhost:5001

# 3. Запит:
"на робочому столі створи гарну пропозицію з фото у вигляді презентації..."

# 4. Очікуване:
✅ Тетяна планує з РЕАЛЬНИМИ URLs
✅ JSON parsing БЕЗ помилок
✅ Grisha НЕ крашиться
✅ TTS озвучує кожен етап
```

---

## ПЕРЕВІРКА ЛОГІВ

```bash
# Модель
grep "Planning tools with model" logs/orchestrator.log
# → mistral-ai/mistral-small-2503

# JSON parsing
grep "Failed to parse" logs/orchestrator.log
# → EMPTY

# Verification crashes
grep "Cannot read properties" logs/orchestrator.log
# → EMPTY

# TTS availability
grep "TTS check" logs/orchestrator.log
# → tts=true, speak=function
```

---

## КРИТИЧНІ ПРАВИЛА

### ✅ ЗАВЖДИ:
1. mistral-small для JSON tasks
2. Temperature 0.15 для tool selection
3. Validate API response ПЕРЕД .content
4. Ідеологія в промптах > приклади
5. Log TTS availability

### ❌ НІКОЛИ:
1. Phi-4/Nemo для JSON
2. example.com в промптах
3. Direct .content access
4. Приклади × 4
5. Temperature > 0.2

---

**FILES:** 5 changed
**STATUS:** ✅ Ready
**DATE:** 15.10.2025 ~05:00
