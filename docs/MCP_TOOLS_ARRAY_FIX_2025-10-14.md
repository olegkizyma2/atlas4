# MCP Tools Array Fix - 14.10.2025 (ніч ~03:15)

## 🔴 Критична проблема

### Симптом:
```
Error: server.tools.some is not a function
```

Всі TODO виконання падали з помилкою при спробі викликати MCP tools. Success rate: 0%.

### Корінь проблеми:

1. **MCPServer.tools не завжди масив**
   - В `_handleMCPMessage()` встановлювалось: `this.tools = message.result.capabilities?.tools || []`
   - Але якщо `capabilities.tools` був `undefined`, то встановлювався `undefined` замість `[]`
   - Результат: `server.tools.some()` → TypeError

2. **Відсутні перевірки типів**
   - `findServerForTool()` викликав `.some()` без перевірки `Array.isArray()`
   - `getAvailableTools()` викликав `.map()` без перевірки
   - `getStatus()` викликав `.length` без перевірки

3. **Module type warning**
   - `prompts/package.json` не мав `"type": "module"`
   - Node.js парсив як CommonJS → performance overhead

## ✅ Виправлення

### 1. MCPServer._handleMCPMessage() - Array Guarantee
```javascript
// ❌ BEFORE
this.tools = message.result.capabilities?.tools || [];

// ✅ AFTER
const toolsData = message.result.capabilities?.tools;
this.tools = Array.isArray(toolsData) ? toolsData : [];
```

**Результат:** `tools` ЗАВЖДИ масив, навіть якщо MCP server повертає garbage.

### 2. MCPManager.findServerForTool() - Type Check
```javascript
// ✅ ADDED
if (!Array.isArray(server.tools)) {
  logger.warn('mcp-manager', `Server ${server.name} has invalid tools`);
  continue;
}
```

**Результат:** Пропускаємо некоректні servers замість crash.

### 3. MCPManager.getAvailableTools() - Type Check
```javascript
// ✅ ADDED
if (!Array.isArray(server.tools)) {
  logger.warn('mcp-manager', `Server ${server.name} has invalid tools`);
  continue;
}
```

### 4. MCPManager.getStatus() - Safe Length
```javascript
// ❌ BEFORE
tools: server.tools.length,

// ✅ AFTER
tools: Array.isArray(server.tools) ? server.tools.length : 0,
```

### 5. prompts/package.json - ES6 Module Type
```json
{
  "type": "module",
  "description": "ES6 modules for ATLAS prompts system"
}
```

**Результат:** Немає більше warning про typeless package.json.

## 📊 Очікувані результати

### До виправлення:
- ❌ Success rate: 0%
- ❌ Всі tool calls failing з TypeError
- ❌ `undefined tools` в логах
- ❌ Module type warning × 1 при старті

### Після виправлення:
- ✅ Success rate: очікується 70-90% (залежить від tool availability)
- ✅ Tool calls виконуються БЕЗ TypeError
- ✅ Graceful degradation при некоректних servers
- ✅ Немає module warnings

## 🔍 Виправлені файли

1. **orchestrator/ai/mcp-manager.js** (4 виправлення):
   - `_handleMCPMessage()` - Array.isArray() guard
   - `findServerForTool()` - Type check + warning
   - `getAvailableTools()` - Type check + warning
   - `getStatus()` - Safe length access

2. **prompts/package.json**:
   - Додано `"type": "module"`

## 🎯 Критично для майбутнього

### ЗАВЖДИ:
- ✅ Перевіряйте `Array.isArray()` перед `.some()`, `.map()`, `.filter()`
- ✅ Встановлюйте дефолтні значення як КОНКРЕТНІ типи, НЕ через `||`
- ✅ Додавайте `"type": "module"` в package.json для ES6 modules
- ✅ Логуйте warnings замість crashes при некоректних даних

### НІКОЛИ:
- ❌ НЕ довіряйте що external data (MCP response) має правильний тип
- ❌ НЕ викликайте array методи без перевірки типу
- ❌ НЕ використовуйте `|| []` для optional arrays - використовуйте тернарний оператор
- ❌ НЕ ігноруйте Node.js warnings про module type

## 📝 Тестування

```bash
# 1. Restart orchestrator
./restart_system.sh restart

# 2. Перевірити MCP initialization
tail -f logs/orchestrator.log | grep "MCP.*Initialized with.*tools"
# Має показати: "Initialized with N tools" (N = число, НЕ undefined)

# 3. Test TODO execution
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "відкрий калькулятор", "sessionId": "test"}'

# 4. Перевірити що немає TypeError
grep "tools.some is not a function" logs/orchestrator.log
# Має бути порожньо

# 5. Перевірити module warning
grep "MODULE_TYPELESS_PACKAGE_JSON" logs/orchestrator.log
# Має бути порожньо після рестарту
```

## 🔗 Пов'язані виправлення

- **MCP Initialization Timeout Fix** (14.10.2025 ~02:35) - Збільшено timeout
- **MCP JSON Parsing Fix** (13.10.2025 ~23:50) - Markdown cleaning
- **MCP TTS Safety Fix** (13.10.2025 ~22:40) - TTS graceful degradation

## 📌 Статус

✅ **FIXED** - 14.10.2025 ~03:15  
⏳ **NEEDS TESTING** - Очікується перезапуск системи для валідації

---

**ЗОЛОТЕ ПРАВИЛО:** External data може бути будь-якого типу. ЗАВЖДИ перевіряйте тип перед використанням type-specific методів.
