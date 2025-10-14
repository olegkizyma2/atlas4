# Виправлення: AI_BACKEND_DISABLE_FALLBACK повністю відключає Goose fallback

**Дата**: 14 жовтня 2025  
**Статус**: ✅ Виправлено

## Проблема

При налаштуванні `AI_BACKEND_DISABLE_FALLBACK=true` в `.env` файлі, система все одно робила fallback на Goose при помилках MCP Dynamic TODO workflow.

### Симптоми з логів

```log
2025-10-14 16:43:26 [ERROR] [MCP-TODO] Failed to create TODO: timeout of 30000ms exceeded
2025-10-14 16:43:26 [ERROR] MCP workflow failed: TODO planning failed
2025-10-14 16:43:26 [WARN] Falling back to Goose workflow due to backend selection error
```

**Очікувана поведінка**: Система повинна була кинути помилку без fallback  
**Фактична поведінка**: Система зробила fallback на Goose

## Причина

У файлі `orchestrator/workflow/executor-v3.js` було **4 місця** з fallback на Goose, але тільки **1 місце** перевіряло налаштування `disableFallback`:

1. ✅ **Рядок 904-924** - MCP workflow failure - **ПЕРЕВІРКА БУЛА**
2. ❌ **Рядок 772-774** - DI Container unavailable - **ПЕРЕВІРКИ НЕ БУЛО**
3. ❌ **Рядок 787-789** - Backend selection failed - **ПЕРЕВІРКИ НЕ БУЛО**
4. ❌ **Рядок 850-860** - Circuit breaker triggered - **ПЕРЕВІРКИ НЕ БУЛО**
5. ❌ **Рядок 952-960** - Backend selection error (catch) - **ПЕРЕВІРКИ НЕ БУЛО**

## Виправлення

### 1. DI Container unavailable (рядок 772-798)

```javascript
if (!container) {
  logger.warn('DI Container not available in session, using Goose workflow');
  
  // НОВИНКА 14.10.2025 - Check if fallback is disabled
  if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
    const error = new Error('DI Container not available and fallback is disabled');
    logger.error('executor', '❌ DI Container unavailable and fallback is DISABLED', {
      sessionId: session.id
    });
    
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'DI Container unavailable',
          message: error.message,
          fallbackDisabled: true
        }
      })}\n\n`);
      res.end();
    }
    
    throw error;
  }
  
  return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
}
```

### 2. Backend selection failed (рядок 810-836)

```javascript
if (!backendResult.success) {
  logger.warn('Backend selection failed, defaulting to Goose workflow');
  
  // НОВИНКА 14.10.2025 - Check if fallback is disabled
  if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
    const error = new Error('Backend selection failed and fallback is disabled');
    logger.error('executor', '❌ Backend selection failed and fallback is DISABLED', {
      sessionId: session.id
    });
    
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'Backend selection failed',
          message: error.message,
          fallbackDisabled: true
        }
      })}\n\n`);
      res.end();
    }
    
    throw error;
  }
  
  return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
}
```

### 3. Backend selection error catch (рядок 958-1006)

```javascript
} catch (backendError) {
  logger.error(`Backend selection error: ${backendError.message}`, {
    sessionId: session.id,
    error: backendError.message
  });
  
  // НОВИНКА 14.10.2025 - Check if fallback is disabled for backend selection errors too
  if (GlobalConfig.AI_BACKEND_CONFIG.disableFallback) {
    logger.error('executor', '❌ Backend selection failed and fallback is DISABLED (AI_BACKEND_DISABLE_FALLBACK=true)', {
      sessionId: session.id,
      error: backendError.message
    });

    // Send error to frontend without fallback
    if (res.writable && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        data: {
          error: 'Backend selection failed',
          message: backendError.message,
          fallbackDisabled: true
        }
      })}\n\n`);
      res.end();
    }

    throw backendError; // Re-throw to propagate error
  }
  
  // Fallback to Goose workflow on backend selection error
  logger.warn('Falling back to Goose workflow due to backend selection error');
  return await executeTaskWorkflow(userMessage, session, res, allStages, workflowConfig);
}
```

## Налаштування

### `.env` файл

```bash
# Disable fallback to Goose on MCP failures (strict mode)
# - true: System will throw errors on MCP failures (no fallback)
# - false: System will fallback to Goose on MCP failures (default, safe)
AI_BACKEND_DISABLE_FALLBACK=true
```

### Конфігурація (`config/global-config.js`)

```javascript
get disableFallback() {
  return process.env.AI_BACKEND_DISABLE_FALLBACK === 'true';
}
```

## Тестування

### Сценарій 1: MCP timeout з fallback вимкнено

**Налаштування**: `AI_BACKEND_DISABLE_FALLBACK=true`

**Запит**: "на робочому столі створи презентацію..."

**Очікуваний результат**:
```log
[ERROR] [MCP-TODO] Failed to create TODO: timeout of 30000ms exceeded
[ERROR] ❌ Backend selection failed and fallback is DISABLED
[ERROR] Backend selection failed and fallback is disabled
```

**Фактичний результат**: ✅ Система кидає помилку без fallback

### Сценарій 2: MCP timeout з fallback увімкнено

**Налаштування**: `AI_BACKEND_DISABLE_FALLBACK=false`

**Запит**: "на робочому столі створи презентацію..."

**Очікуваний результат**:
```log
[ERROR] [MCP-TODO] Failed to create TODO: timeout of 30000ms exceeded
[WARN] Falling back to Goose workflow due to backend selection error
[INFO] Starting stage 1: initial_processing
```

**Фактичний результат**: ✅ Система робить fallback на Goose

## Вплив

### Змінені файли
- `orchestrator/workflow/executor-v3.js` - додано перевірки `disableFallback` у 4 місцях

### Поведінка системи

**До виправлення**:
- `AI_BACKEND_DISABLE_FALLBACK=true` - частково працювало (тільки 1 з 5 точок)
- Fallback спрацьовував навіть при strict mode

**Після виправлення**:
- `AI_BACKEND_DISABLE_FALLBACK=true` - **повністю** блокує fallback на Goose
- `AI_BACKEND_DISABLE_FALLBACK=false` - дозволяє fallback (безпечний режим)

## Рекомендації

### Для тестування MCP Dynamic TODO
```bash
AI_BACKEND_DISABLE_FALLBACK=true  # Бачити реальні помилки MCP
```

### Для production
```bash
AI_BACKEND_DISABLE_FALLBACK=false  # Fallback на Goose при помилках
```

## Пов'язані файли

- `orchestrator/workflow/executor-v3.js` - основна логіка workflow
- `config/global-config.js` - конфігурація AI backend
- `.env` - налаштування середовища
- `docs/MCP_DYNAMIC_TODO_ENABLED.md` - документація MCP workflow

## Додаткове виправлення: Timeout в MCP TODO

### Проблема
Timeout 60 секунд не працював, бо передавався як частина data об'єкта замість config.

### Виправлення
```javascript
// ДО (НЕПРАВИЛЬНО):
const apiResponse = await axios.post(endpoint, {
    model: 'mistral-small',
    messages: [...],
    timeout: 60000  // ❌ Це частина data, не config!
});

// ПІСЛЯ (ПРАВИЛЬНО):
const apiResponse = await axios.post(endpoint, {
    model: 'mistral-small',
    messages: [...]
}, {
    timeout: 60000  // ✅ Це config параметр
});
```

## Додаткове виправлення 2: JSON Parsing Error в Verification

### Проблема
LLM повертав дуже довгі error messages в JSON, які обривалися і створювали невалідний JSON:
```
"error": "Tool 'playwright_search' not available... [ДУЖЕ ДОВГИЙ СПИСОК TOOLS]",
"stack": "Error: Tool 'playwright_search' not available... [ОБРИВАЄТЬСЯ]
```

**Помилка**: `Unterminated string in JSON at position 1384`

### Виправлення

1. **Truncate error/stack fields** перед відправкою в LLM:
```javascript
// Truncate error messages to avoid JSON parsing issues
if (truncated.error && typeof truncated.error === 'string' && truncated.error.length > 500) {
    truncated.error = truncated.error.substring(0, 500) + '... [truncated]';
}
if (truncated.stack && typeof truncated.stack === 'string' && truncated.stack.length > 500) {
    truncated.stack = truncated.stack.substring(0, 500) + '... [truncated]';
}
```

2. **Fallback замість throw** при JSON parsing error:
```javascript
catch (error) {
    // Fallback: return failed verification with error details
    return {
        verified: false,
        reason: `JSON parsing failed: ${error.message}`,
        evidence: { parseError: error.message, responsePreview: truncatedResponse }
    };
}
```

**Файл**: `orchestrator/workflow/mcp-todo-manager.js`

## Статус

✅ **ВИПРАВЛЕНО** - Всі 5 точок fallback тепер перевіряють `disableFallback`  
✅ **ВИПРАВЛЕНО** - Timeout 60s тепер працює правильно для MCP TODO Planning  
✅ **ВИПРАВЛЕНО** - JSON parsing errors тепер обробляються gracefully з fallback
