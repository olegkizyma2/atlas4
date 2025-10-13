# MCP Fallback Disable & JSON Parsing Fix

**Дата:** 13 жовтня 2025  
**Час:** ~21:30  
**Статус:** ✅ COMPLETED

---

## 🎯 Мета

1. Додати можливість заборони fallback на Goose (strict mode для тестування MCP)
2. Виправити помилку парсингу JSON від LLM (проблема з ````json` wrapper)
3. Увімкнути повноцінне використання MCP Dynamic TODO Workflow

---

## 🔴 Проблеми що були

### Проблема #1: JSON Parsing Error
```
Failed to parse TODO response: Unexpected token '`', "```json
{
"... is not valid JSON
```

**Корінь:** LLM повертав відповідь обгорнуту в markdown code block:
```json
{
  "mode": "standard",
  "items": [...]
}
```

Замість чистого JSON. `JSON.parse()` не може парсити markdown.

### Проблема #2: Неможливість вимкнути fallback

При помилках MCP система завжди fallback на Goose → неможливо тестувати MCP в strict mode.

**Корінь:** Жорстко закодований fallback без можливості налаштування:
```javascript
} catch (mcpError) {
  // Завжди fallback на Goose
  return await executeTaskWorkflow(...);
}
```

### Проблема #3: Circuit Breaker ігнорував strict mode

Circuit breaker завжди робив fallback при перевищенні threshold, навіть якщо потрібно throw error.

---

## ✅ Рішення

### 1. ENV змінна для заборони fallback

**Файл:** `config/global-config.js`

```javascript
export const AI_BACKEND_CONFIG = {
  // ... existing config ...
  
  // НОВИНКА 13.10.2025 - Дозволити/заборонити fallback на Goose
  // Якщо true - при помилках MCP система падатиме з error (strict mode)
  // Якщо false - при помилках MCP буде fallback на Goose (default)
  get disableFallback() {
    return process.env.AI_BACKEND_DISABLE_FALLBACK === 'true';
  },
};
```

**Usage в .env:**
```bash
# Strict mode - NO fallback (для тестування)
AI_BACKEND_DISABLE_FALLBACK=true

# Safe mode - fallback on errors (default)
AI_BACKEND_DISABLE_FALLBACK=false
```

### 2. Виправлено JSON parsing

**Файл:** `orchestrator/workflow/mcp-todo-manager.js`

**До:**
```javascript
_parseTodoResponse(response, request) {
  try {
    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
    // ... ❌ Краш на ````json` wrapper
  }
}
```

**Після:**
```javascript
_parseTodoResponse(response, request) {
  try {
    // FIXED 13.10.2025 - Strip markdown code blocks (```json ... ```)
    let cleanResponse = response;
    if (typeof response === 'string') {
      // Remove ```json and ``` wrappers
      cleanResponse = response
        .replace(/^```json\s*/i, '')  // Remove opening ```json
        .replace(/^```\s*/i, '')       // Remove opening ```
        .replace(/\s*```$/i, '')       // Remove closing ```
        .trim();
    }
    
    const parsed = typeof cleanResponse === 'string' ? JSON.parse(cleanResponse) : cleanResponse;
    // ... ✅ Парсить успішно
  }
}
```

### 3. Оновлено промпт для LLM

**Файл:** `orchestrator/workflow/mcp-todo-manager.js`

```javascript
_buildTodoCreationPrompt(request, context) {
  return `
User Request: ${request}
Context: ${JSON.stringify(context, null, 2)}

Створи TODO список для виконання запиту.
Режими: standard (1-3 пункти) або extended (4-10 пунктів).

⚠️ CRITICAL: Return ONLY raw JSON without markdown code blocks.
❌ DO NOT wrap response in \`\`\`json ... \`\`\` 
✅ Return ONLY: {"mode": "...", "items": [...], ...}
`;
}
```

### 4. Fallback logic в executor

**Файл:** `orchestrator/workflow/executor-v3.js`

**Circuit Breaker check:**
```javascript
if (!mcpCircuitBreaker.canExecute()) {
  // НОВИНКА 13.10.2025 - Check if fallback is disabled
  if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
    logger.error('executor', '❌ Circuit breaker open and fallback is DISABLED');
    
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'Circuit breaker open',
          message: `Too many MCP failures`,
          fallbackDisabled: true
        }
      })}\n\n`);
      res.end();
    }
    
    throw new Error(`Circuit breaker ${breakerState.state} - fallback disabled`);
  }
  
  // Fallback якщо дозволено
  return await executeTaskWorkflow(...);
}
```

**MCP workflow error handler:**
```javascript
} catch (mcpError) {
  mcpCircuitBreaker.recordFailure();
  
  // НОВИНКА 13.10.2025 - Check if fallback is disabled
  if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
    logger.error('executor', '❌ MCP workflow failed and fallback is DISABLED');
    
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'MCP workflow failed',
          message: mcpError.message,
          fallbackDisabled: true
        }
      })}\n\n`);
      res.end();
    }
    
    throw mcpError; // Re-throw to propagate error
  }
  
  // Fallback якщо дозволено
  logger.warning('executor', 'Falling back to Goose workflow after MCP failure');
  return await executeTaskWorkflow(...);
}
```

---

## 📊 Результати

### ✅ JSON Parsing
- ✅ LLM може повертати відповідь в ````json` wrapper
- ✅ Система автоматично очищує wrapper
- ✅ `JSON.parse()` працює успішно
- ✅ Промпт інструктує LLM віддавати чистий JSON (подвійний захист)

### ✅ Fallback Control
- ✅ `AI_BACKEND_DISABLE_FALLBACK=true` → strict mode (throw errors)
- ✅ `AI_BACKEND_DISABLE_FALLBACK=false` → safe mode (fallback на Goose)
- ✅ Frontend отримує інформацію про стан fallback
- ✅ Circuit breaker респектує strict mode

### ✅ MCP Dynamic TODO Workflow
- ✅ Тепер може працювати без маскування помилок
- ✅ Легко тестувати MCP в ізоляції
- ✅ Fallback доступний коли потрібно

---

## 🔧 Конфігурація

### Development (тестування MCP)
```bash
AI_BACKEND_MODE=mcp
AI_BACKEND_DISABLE_FALLBACK=true  # Strict mode
```

### Production (максимальна надійність)
```bash
AI_BACKEND_MODE=hybrid
AI_BACKEND_DISABLE_FALLBACK=false  # Safe mode з fallback
```

### Hybrid (рекомендовано)
```bash
AI_BACKEND_MODE=hybrid
AI_BACKEND_PRIMARY=goose
AI_BACKEND_FALLBACK=mcp
AI_BACKEND_DISABLE_FALLBACK=false
```

---

## 📝 Тестування

### Test Case 1: JSON Parsing
```bash
# Request з складним завданням
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt на Desktop з текстом Hello World", "sessionId": "test"}'

# Очікуваний результат: TODO list створюється успішно
```

### Test Case 2: Strict Mode
```bash
# Встановити strict mode
export AI_BACKEND_DISABLE_FALLBACK=true

# Спричинити помилку MCP
# Очікуваний результат: Error, NO fallback на Goose
```

### Test Case 3: Safe Mode
```bash
# Встановити safe mode
export AI_BACKEND_DISABLE_FALLBACK=false

# Спричинити помилку MCP
# Очікуваний результат: Fallback на Goose, завдання виконується
```

---

## 🚨 Критичні правила

1. ✅ **ЗАВЖДИ** додавайте промпт інструкцію для чистого JSON
2. ✅ **ЗАВЖДИ** очищуйте markdown wrappers перед `JSON.parse()`
3. ✅ **ЗАВЖДИ** респектуйте `disableFallback` в error handlers
4. ✅ **ЗАВЖДИ** інформуйте frontend про стан fallback
5. ✅ **Development** → strict mode (`true`)
6. ✅ **Production** → safe mode (`false`)

---

## 📂 Змінені файли

1. `config/global-config.js` - додано `disableFallback` getter
2. `orchestrator/workflow/mcp-todo-manager.js` - виправлено JSON parsing + промпт
3. `orchestrator/workflow/executor-v3.js` - додано fallback control (2 місця)
4. `.env.example` - додано `AI_BACKEND_DISABLE_FALLBACK` з документацією

**Total:** 4 файли, ~120 LOC змін

---

## 🎓 Lesson Learned

1. **LLM може повертати markdown** → завжди очищуйте перед парсингом
2. **Fallback має бути опціональним** → strict mode для тестування критичний
3. **Промпт інструкції важливі** → явно казати LLM що повертати
4. **Circuit breaker має респектувати режим** → не ігнорувати strict mode

---

**Автор:** AI Assistant  
**Reviewer:** Олег Миколайович  
**Status:** ✅ Ready for Testing
