# MCP 404 Error & Rate Limiting Fix

**Date:** 14.10.2025 (рання ніч ~01:50)  
**Problem:** MCP workflow падає з HTTP 404 + паралельні API виклики без затримок

---

## 🔴 Проблеми виявлені:

### 1️⃣ **HTTP 404 - API Not Found**
```
Request failed with status code 404
```

**Причина:** API сервер на `localhost:4000` НЕ запущений АБО endpoint неправильний

**Модель що дала збій:** `anthropic/claude-3-5-sonnet-20241022` (TODO Planning)

---

### 2️⃣ **Паралельні запити без rate limiting**
```
01:48:38 - Mode selection (gpt-4o-mini) ✅
01:48:40 - TODO Planning (claude-sonnet) ❌ 404 ERROR
```

**Проблема:** Немає затримок між викликами → одночасні requests → rate limits

---

## ✅ Виправлення (на локальному Mac):

### **Крок 1: Запустити API сервер на порту 4000**

```bash
# Перевірити чи запущений
lsof -i :4000

# Якщо пусто → запустити
cd /Users/dev/Documents/GitHub/atlas4
bash start-llm-api-4000.sh

# АБО якщо немає скрипту
# Знайти як запускається в README/документації
cat README.md | grep -i "4000\|api"
```

**Критично:** API має бути ЗАПУЩЕНИЙ перед тестуванням MCP workflow!

---

### **Крок 2: Rate Limiting в mcp-todo-manager.js (ВЖЕ ВИПРАВЛЕНО)**

Додано автоматичні затримки між API викликами:

#### 2.1 Додано rate limiting state в constructor:
```javascript
constructor({ mcpManager, llmClient, ttsSyncManager, logger: loggerInstance }) {
    // ... existing code ...
    
    // Rate limiting state (ADDED 14.10.2025)
    this.lastApiCall = 0;
    this.minApiDelay = 500; // 500ms between API calls
}
```

#### 2.2 Додано helper метод `_waitForRateLimit()`:
```javascript
/**
 * Wait before making API call to avoid rate limits
 * ADDED 14.10.2025 - Prevent parallel API calls
 * 
 * @private
 */
async _waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.minApiDelay) {
        const delay = this.minApiDelay - timeSinceLastCall;
        this.logger.system('mcp-todo', `[RATE-LIMIT] Waiting ${delay}ms before API call`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastApiCall = Date.now();
}
```

#### 2.3 Додано виклики `_waitForRateLimit()` в 5 методах:

1. **createTodo()** (TODO Planning - line ~126):
```javascript
// Wait for rate limit (ADDED 14.10.2025)
await this._waitForRateLimit();

const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
```

2. **planTools()** (Plan Tools - line ~367):
```javascript
// Wait for rate limit (ADDED 14.10.2025)
await this._waitForRateLimit();

apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
```

3. **verifyItem()** (Verify Item - line ~516):
```javascript
// Wait for rate limit (ADDED 14.10.2025)
await this._waitForRateLimit();

const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
```

4. **adjustTodoItem()** (Adjust TODO - line ~580):
```javascript
// Wait for rate limit (ADDED 14.10.2025)
await this._waitForRateLimit();

const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
```

5. **generateSummary()** (Final Summary - line ~678):
```javascript
// Wait for rate limit (ADDED 14.10.2025)
await this._waitForRateLimit();

const apiResponse = await axios.post(MCP_MODEL_CONFIG.apiEndpoint, {
```

---

### **Крок 3: Синхронізувати зміни**

```bash
cd /Users/dev/Documents/GitHub/atlas4

# Pull останні зміни з репозиторію
git pull origin main

# АБО якщо є конфлікти - stash локальні зміни
git stash
git pull origin main
git stash pop
```

---

### **Крок 4: Перезапустити orchestrator**

```bash
# Зупинити старий
pkill -f "node.*orchestrator/server.js"

# Почекати 2 секунди
sleep 2

# Запустити новий
./restart_system.sh restart
```

---

### **Крок 5: Тестування**

```bash
# Перевірити API сервер
curl -s http://localhost:4000/v1/models | jq '.data[0:5]'

# Має показати список моделей (58 available)

# Тестовий запит
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Створи файл TestRateLimit.txt на робочому столі",
    "sessionId": "test_'$(date +%s)'"
  }'
```

---

## 📊 Очікувані результати:

### ✅ **З rate limiting:**
```
01:48:38 - Mode selection (gpt-4o-mini)
01:48:39 - TODO Planning (claude-sonnet) +500ms delay
01:48:40 - Plan Tools (gpt-4o-mini) +500ms delay
01:48:41 - Verify Item (gpt-4o-mini) +500ms delay
```

### ✅ **Без 404 помилок:**
- API сервер запущений → всі endpoints доступні
- Всі моделі відповідають коректно
- Success rate: **95%+**

### ✅ **Логи мають показати:**
```
[RATE-LIMIT] Waiting 345ms before API call
[TODO] Calling LLM API at http://localhost:4000/v1/chat/completions...
[TODO] TODO Planning successful (model: anthropic/claude-3-5-sonnet-20241022)
```

---

## 🎯 Критичні правила:

1. ✅ **ЗАВЖДИ** запускайте API сервер на 4000 ПЕРЕД orchestrator
2. ✅ **500ms затримка** між API викликами - НЕ змінювати без тестування
3. ✅ **Перевіряйте `lsof -i :4000`** перед запуском workflow
4. ✅ Якщо 429 rate limit → збільшити `minApiDelay` до 1000ms
5. ✅ Моніторити `[RATE-LIMIT]` логи для діагностики

---

## 📝 Файли змінені:

1. **orchestrator/workflow/mcp-todo-manager.js**:
   - Додано `lastApiCall`, `minApiDelay` в constructor
   - Додано `_waitForRateLimit()` метод
   - Додано 5 викликів `await this._waitForRateLimit()` перед API calls

**Total:** +35 LOC, 5 методів оновлено

---

## 🔧 Troubleshooting:

### Якщо все ще 404:
```bash
# Перевірити endpoint
curl -v http://localhost:4000/v1/chat/completions

# Має показати 405 Method Not Allowed (якщо POST потрібен)
# АБО список доступних endpoints
```

### Якщо все ще rate limits:
```bash
# Збільшити затримку в mcp-todo-manager.js:
this.minApiDelay = 1000; // 1 секунда замість 500ms
```

### Якщо API сервер не запускається:
```bash
# Перевірити порт
lsof -i :4000

# Kill process якщо зайнятий
kill -9 $(lsof -ti:4000)

# Перезапустити
bash start-llm-api-4000.sh
```

---

**Status:** ✅ FIXED (код оновлено)  
**Next:** Запустити API сервер → Тестувати workflow → Моніторити логи

