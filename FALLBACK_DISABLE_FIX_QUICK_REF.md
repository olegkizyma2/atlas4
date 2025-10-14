# 🔧 Виправлення AI_BACKEND_DISABLE_FALLBACK - Швидкий довідник

**Дата**: 14.10.2025  
**Статус**: ✅ Виправлено

## Проблема

❌ `AI_BACKEND_DISABLE_FALLBACK=true` не працювало повністю  
❌ Fallback на Goose спрацьовував навіть при strict mode

## Виправлення

✅ Додано перевірку `disableFallback` у **всіх 5 точках** fallback:

1. ✅ MCP workflow failure
2. ✅ DI Container unavailable  
3. ✅ Backend selection failed
4. ✅ Circuit breaker triggered
5. ✅ Backend selection error (catch)

## Налаштування

### Тестування MCP (бачити реальні помилки)
```bash
AI_BACKEND_DISABLE_FALLBACK=true
```

### Production (безпечний режим з fallback)
```bash
AI_BACKEND_DISABLE_FALLBACK=false
```

## Поведінка

### `AI_BACKEND_DISABLE_FALLBACK=true`
- ❌ MCP помилка → **ERROR** (без fallback)
- ❌ Backend selection failed → **ERROR** (без fallback)
- ❌ Circuit breaker → **ERROR** (без fallback)

### `AI_BACKEND_DISABLE_FALLBACK=false`
- ✅ MCP помилка → **Fallback на Goose**
- ✅ Backend selection failed → **Fallback на Goose**
- ✅ Circuit breaker → **Fallback на Goose**

## Перевірка

```bash
# Перевірити налаштування
grep AI_BACKEND_DISABLE_FALLBACK .env

# Перезапустити orchestrator
npm run restart-orchestrator

# Перевірити логи
tail -f logs/orchestrator.log | grep -i fallback
```

## Додаткове виправлення

✅ **Timeout в MCP TODO Planning** - виправлено передачу timeout параметра  
- Було: timeout в data об'єкті (не працював)
- Стало: timeout в config об'єкті (працює)

## Файли

- `orchestrator/workflow/executor-v3.js` - виправлено fallback перевірки
- `orchestrator/workflow/mcp-todo-manager.js` - виправлено timeout
- `docs/fixes/FALLBACK_DISABLE_FIX_2025-10-14.md` - повна документація
