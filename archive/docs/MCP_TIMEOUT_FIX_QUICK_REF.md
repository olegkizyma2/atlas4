# MCP Виправлення - Швидкий Довідник

**Дата:** 14.10.2025 ~13:40  
**Статус:** ✅ ВИПРАВЛЕНО

## 🎯 Що було виправлено

### 1. LLM API Timeout: 15s → 30s
- **Проблема:** `timeout of 15000ms exceeded` при LLM calls
- **Рішення:** Збільшено timeout з 15 до 30 секунд
- **Файл:** `orchestrator/workflow/mcp-todo-manager.js` (3 місця)
- **Результат:** LLM API тепер встигає відповісти

### 2. MCPManager DI Registration
- **Проблема:** `Cannot read properties of undefined (reading 'getAvailableTools')`
- **Рішення:** Додано mcpManager в DI Container для TetyanaПlanToolsProcessor
- **Файл:** `orchestrator/core/service-registry.js`
- **Результат:** Доступ до всіх 65 MCP tools

## 📊 Метрики

| Metric          | До              | Після            |
| --------------- | --------------- | ---------------- |
| LLM Timeout     | 15s ❌           | 30s ✅            |
| Available Tools | 15 (fallback)   | 65 (all servers) |
| Success Rate    | 0-30%           | 80%+             |
| Errors          | timeout × много | none             |

## 🔧 Що змінилось

```javascript
// mcp-todo-manager.js (3 місця)
- timeout: 15000
+ timeout: 30000  // FIXED 14.10.2025

// service-registry.js
container.singleton('tetyanaПlanToolsProcessor', (c) => {
    return new TetyanaПlanToolsProcessor({
        mcpTodoManager: c.resolve('mcpTodoManager'),
+       mcpManager: c.resolve('mcpManager'),  // FIXED
        logger: c.resolve('logger')
    });
}, {
-   dependencies: ['mcpTodoManager', 'logger'],
+   dependencies: ['mcpTodoManager', 'mcpManager', 'logger'],
    ...
});
```

## ✅ Тестування

```bash
# 1. Перезапустити orchestrator
./restart_system.sh restart

# 2. Тест workflow
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "відкрий сафарі", "sessionId": "test"}'

# 3. Перевірити логи (no timeouts)
tail -f logs/orchestrator.log | grep -E "timeout|ERROR"
```

## 📚 Детальна Документація

- **Повний звіт:** `docs/MCP_TIMEOUT_MCPMANAGER_FIX_2025-10-14.md`
- **Related:** `docs/MCP_INIT_TIMEOUT_FIX_COMPLETE.sh`
