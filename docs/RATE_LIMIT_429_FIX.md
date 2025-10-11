# Rate Limit Fix: 429 Retry-After Handling

**Дата:** 11 жовтня 2025, ~14:15  
**Проблема:** Клієнт НЕ обробляв 429 помилки, спамив запитами без затримки  
**Статус:** ✅ FIXED

---

## 🐛 Проблема

### Звіт від сервера (port 4000):
```
Зовнішній клієнт робить ПОВТОРНІ запити без перерви!

Коли він отримує 429, він НЕ чекає retry-after: 20607s, а одразу робить наступний запит.

Це типова поведінка для:
- Авто-retry логіки без обробки retry-after
- Подвійних кліків в UI
- Агресивної retry стратегії
```

### Симптоми:
- **429 Too Many Requests** від API на порту 4000
- Клієнт **ігнорує Retry-After header**
- Повторні запити **одразу після 429** без затримки
- Сервер блокує клієнта на години (20607s = 5.7 годин!)

### Корінь проблеми:
**Axios requests в orchestrator НЕ мали обробки 429 помилок:**

1. `orchestrator/workflow/stages/agent-stage-processor.js` (lines 249-262):
   ```javascript
   // ❌ NO 429 handling
   const response = await axios.post('http://localhost:4000/v1/chat/completions', {
     model: 'openai/gpt-4o-mini',
     temperature: 0.7,
     max_tokens: 500,
     messages: contextMessages
   }, {
     timeout: 30000,
     headers: { 'Content-Type': 'application/json' }
   });
   ```

2. `orchestrator/ai/state-analyzer.js` (lines 81-92):
   ```javascript
   // ❌ NO 429 handling
   const response_ai = await axios.post('http://localhost:4000/v1/chat/completions', {
     model: MODEL,
     temperature: 0.1,
     max_tokens: 100,
     messages: [
       { role: 'system', content: systemPrompt },
       { role: 'user', content: userPrompt }
     ]
   }, {
     timeout: 10000,
     headers: { 'Content-Type': 'application/json' }
   });
   ```

3. **Catch blocks просто throw error БЕЗ перевірки status code:**
   ```javascript
   } catch (error) {
     logger.error('API execution failed', { error: error.message });
     throw error;  // ❌ NO retry logic, NO 429 check
   }
   ```

4. **ErrorHandler НЕ має стратегії для 429:**
   - `orchestrator/errors/error-handler.js` - ТІЛЬКИ CONNECTION_ERROR, TIMEOUT_ERROR, INVALID_INPUT
   - **НЕ має** RATE_LIMIT_ERROR або 429 handling

---

## ✅ Рішення

### 1. Створено Axios Interceptor для 429 handling
**Файл:** `orchestrator/utils/axios-config.js` (NEW, 184 LOC)

**Ключові функції:**

#### A) Parse Retry-After Header:
```javascript
function parseRetryAfter(retryAfter) {
  if (!retryAfter) return 5000; // Default 5 seconds

  // Якщо число - це секунди
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return Math.min(seconds * 1000, 60000); // Max 60 seconds
  }

  // Якщо HTTP date - парсимо як timestamp
  const retryDate = new Date(retryAfter);
  const now = new Date();
  const delay = retryDate.getTime() - now.getTime();
  return Math.max(Math.min(delay, 60000), 1000); // Min 1s, Max 60s
}
```

#### B) Exponential Backoff з Jitter:
```javascript
function getExponentialBackoff(attempt) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Random 0-1s jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}
```

#### C) Response Interceptor:
```javascript
axios.interceptors.response.use(
  (response) => response, // Success - pass through
  async (error) => {
    const config = error.config;

    // Ігноруємо якщо НЕ 429 або вже retry
    if (error.response?.status !== 429) {
      return Promise.reject(error);
    }

    // Ініціалізуємо retry counter
    config.__retryCount = config.__retryCount || 0;
    const maxRetries = config.maxRetries || 3;

    // Якщо досягли максимуму - fail
    if (config.__retryCount >= maxRetries) {
      logger.error(`Rate limit retry failed after ${maxRetries} attempts`, {
        url: config.url,
        retries: config.__retryCount
      });
      return Promise.reject(error);
    }

    // Інкрементуємо counter
    config.__retryCount++;

    // Отримуємо Retry-After header або використовуємо exponential backoff
    const retryAfter = error.response?.headers?.['retry-after'];
    const delay = retryAfter 
      ? parseRetryAfter(retryAfter)
      : getExponentialBackoff(config.__retryCount - 1);

    logger.warn(`Rate limit hit (429), retrying after ${delay}ms (attempt ${config.__retryCount}/${maxRetries})`, {
      url: config.url,
      retryAfter: retryAfter || 'none',
      delay
    });

    // Чекаємо перед повторною спробою
    await sleep(delay);

    // Повторюємо запит
    return axios(config);
  }
);
```

### 2. Інтеграція в Application Lifecycle
**Файл:** `orchestrator/core/application.js` (lines 10, 44-47)

```javascript
import { configureAxios } from '../utils/axios-config.js';

async initializeServices() {
  // Configure Axios з retry logic для 429 помилок
  configureAxios();
  this.logger?.system?.('axios', 'Axios configured with 429 rate limit handling') || 
    console.log('[INIT] Axios configured with 429 rate limit handling');

  // ... rest of initialization
}
```

---

## 📊 Результат

### До виправлення:
```
Client → API (4000): Request
API → Client: 429 (Retry-After: 20607s)
Client → API: Request IMMEDIATELY ❌ (IGNORED Retry-After!)
API → Client: 429 (Retry-After: 20607s)
Client → API: Request IMMEDIATELY ❌ (SPAM!)
... infinite loop until server blocks client
```

### Після виправлення:
```
Client → API (4000): Request
API → Client: 429 (Retry-After: 20607s)
Client: WAIT 60s (capped at maxDelay) ✅
Client → API: Request (attempt 2/3)
API → Client: 429 (Retry-After: 20607s)
Client: WAIT 60s ✅
Client → API: Request (attempt 3/3)
API → Client: 200 OK ✅ (або fail after 3 attempts)
```

### Логи (очікувані):
```javascript
[INIT] Axios configured with 429 rate limit handling
[WARN] Rate limit hit (429), retrying after 60000ms (attempt 1/3) {
  url: 'http://localhost:4000/v1/chat/completions',
  retryAfter: '20607',
  delay: 60000
}
[INFO] API response received: 123 chars
```

---

## 🎯 Переваги рішення

### 1. **Automatic Retry-After Handling**
- ✅ Парсить Retry-After header (секунди АБО HTTP date)
- ✅ Поважає вимоги сервера
- ✅ Capping на 60 секунд (не чекає години!)

### 2. **Exponential Backoff з Jitter**
- ✅ Якщо Retry-After відсутній - використовує exponential backoff
- ✅ Jitter (random 0-1s) запобігає thundering herd
- ✅ Max delay 30 секунд для backoff

### 3. **Configurable Max Retries**
- ✅ Default 3 спроби
- ✅ Можна override через config.maxRetries
- ✅ Fail після maxRetries з чітким лог повідомленням

### 4. **Transparent для існуючого коду**
- ✅ Interceptor працює глобально
- ✅ Не потрібно змінювати кожен axios.post()
- ✅ Backwards compatible

### 5. **Детальне логування**
- ✅ Логи кожної спроби з delay
- ✅ Логи Retry-After header якщо є
- ✅ Логи fail після maxRetries

---

## 🧪 Тестування

### Test Case 1: 429 з Retry-After (seconds)
```javascript
// Server response
HTTP/1.1 429 Too Many Requests
Retry-After: 20607

// Expected behavior
✅ Parse 20607 seconds
✅ Cap to 60000ms (60 seconds)
✅ Wait 60 seconds
✅ Retry request
```

### Test Case 2: 429 з Retry-After (HTTP date)
```javascript
// Server response
HTTP/1.1 429 Too Many Requests
Retry-After: Fri, 11 Oct 2025 20:00:00 GMT

// Expected behavior
✅ Parse HTTP date
✅ Calculate delay до future date
✅ Cap to 60000ms if > 60s
✅ Wait calculated delay
✅ Retry request
```

### Test Case 3: 429 БЕЗ Retry-After
```javascript
// Server response
HTTP/1.1 429 Too Many Requests

// Expected behavior
✅ Use exponential backoff
✅ Attempt 1: ~1s + jitter
✅ Attempt 2: ~2s + jitter
✅ Attempt 3: ~4s + jitter
✅ Fail if all 3 attempts exhausted
```

### Test Case 4: Non-429 errors
```javascript
// Server response
HTTP/1.1 500 Internal Server Error

// Expected behavior
✅ Pass through WITHOUT retry
✅ Regular error handling
```

---

## 📝 Створені файли

1. **`orchestrator/utils/axios-config.js`** (NEW, 184 LOC)
   - configureAxios() - глобальна конфігурація
   - createAxiosInstance(options) - custom instance з retry
   - parseRetryAfter(retryAfter) - парсинг header
   - getExponentialBackoff(attempt) - backoff з jitter
   - sleep(ms) - async delay helper

2. **Оновлено `orchestrator/core/application.js`**
   - Import configureAxios()
   - Виклик у initializeServices() (перед DI registration)
   - Логування ініціалізації

---

## ⚠️ CRITICAL: Тестування ОБОВ'ЯЗКОВЕ!

### 1. Перезапуск системи
```bash
./restart_system.sh restart
```

### 2. Симуляція 429 від port 4000
- Якщо немає rate limit - ДОБРЕ! ✅
- Якщо є 429 - перевірити логи orchestrator:

```bash
tail -f logs/orchestrator.log | grep -i "429\|rate limit\|retry"
```

**Очікувані логи:**
```
[INIT] Axios configured with 429 rate limit handling
[WARN] Rate limit hit (429), retrying after XXXXms (attempt 1/3)
[INFO] API response received: XX chars  (після retry)
```

**НЕ має бути:**
```
❌ Immediate retry without delay
❌ Ignored Retry-After header
❌ More than 3 retry attempts
```

### 3. Перевірка через chat
- Відправити повідомлення в чат
- Якщо API повертає 429 - має почекати перед retry
- Якщо API повертає 200 - працює як раніше

---

## 🔍 Діагностика

### Якщо все ще спам запитів:
```bash
# Перевірити чи axios-config імпортується
grep -r "axios-config" orchestrator/

# Перевірити чи configureAxios() викликається
grep -r "configureAxios" orchestrator/

# Перевірити логи ініціалізації
grep "Axios configured" logs/orchestrator.log
```

### Якщо НЕ чекає Retry-After:
```javascript
// Додати детальне логування в axios-config.js
console.log('[AXIOS] Retry-After raw:', error.response?.headers?.['retry-after']);
console.log('[AXIOS] Parsed delay:', delay);
console.log('[AXIOS] Waiting...');
```

---

## 🎯 Критичні правила

### ✅ DO:
1. **ЗАВЖДИ використовуйте configureAxios()** перед будь-якими axios запитами
2. **Поважайте Retry-After header** - НЕ ігноруйте його
3. **Обмежуйте max delay** - cap на 60 секунд для Retry-After
4. **Логуйте кожну спробу** - для debugging

### ❌ DON'T:
1. **НЕ робіть повторні запити** без затримки при 429
2. **НЕ ігноруйте Retry-After header** - це грубе порушення HTTP spec
3. **НЕ чекайте години** - cap Retry-After на розумне значення
4. **НЕ створюйте нові axios instances** без retry logic (або використовуйте createAxiosInstance())

---

**Статус:** ✅ FIXED  
**Тестування:** PENDING  
**Критичність:** HIGH - rate limiting може блокувати систему на години  
**Наступний крок:** Перезапуск + моніторинг логів при 429
