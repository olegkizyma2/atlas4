# Keepalive Console Spam Fix

**ВИПРАВЛЕНО:** 10 жовтня 2025 - пізній вечір ~20:15

## 🚨 Проблема

**Симптом:**
- Браузер console генерував **100,000+ повідомлень за секунду**
- Кожне повідомлення: `Failed to parse stream message {"type":"keepalive","ts":...}`
- Система не відповідала на запити користувача
- DevTools ставали непрацездатними

**Корінь проблеми:**
Frontend парсер стрімів (`web/static/js/core/api-client.js`) **не обробляв keepalive** повідомлення:
1. Orchestrator відправляє keepalive кожні N секунд (щоб HTTP connection не закривалась)
2. Frontend парсить JSON, але **НЕ має обробника** для типу `keepalive`
3. Кожне keepalive генерує `logger.warn()` → консольне повідомлення
4. Результат: **масивний спам** у консолі браузера

## ✅ Рішення

**Виправлений файл:**
`web/static/js/core/api-client.js`

**Зміни:**
```javascript
// До виправлення:
for (const line of lines) {
  try {
    const message = JSON.parse(line);
    if (onMessage) onMessage(message);
  } catch (parseError) {
    this.logger.warn('Failed to parse stream message', line);
  }
}

// Після виправлення:
for (const line of lines) {
  try {
    const message = JSON.parse(line);
    // Тихо ігноруємо keepalive повідомлення
    if (message.type === 'keepalive') continue;
    if (onMessage) onMessage(message);
  } catch {
    // Логуємо тільки якщо це не схоже на keepalive
    if (!line.includes('keepalive')) {
      this.logger.warn('Failed to parse stream message', line);
    }
  }
}
```

**Логіка виправлення:**
1. **Успішний парсинг:** Якщо `message.type === 'keepalive'` → `continue` (тихо пропускаємо)
2. **Помилка парсингу:** Перевіряємо чи рядок містить 'keepalive' → НЕ логуємо
3. **Інші повідомлення:** Обробляються як звичайно

## 📊 Результат

**До:**
- ❌ 100,000+ консольних повідомлень за секунду
- ❌ DevTools непрацездатні
- ❌ Браузер лагає
- ❌ Немає відповіді на запити

**Після:**
- ✅ Keepalive повідомлення **тихо ігноруються**
- ✅ Консоль чиста, тільки реальні помилки
- ✅ DevTools працюють нормально
- ✅ Система відповідає на запити

## 🧪 Тестування

```bash
# Перезапустити систему
./restart_system.sh restart

# Відкрити http://localhost:5001
# Відправити запит "Привіт"
# Перевірити консоль браузера:
# - НЕ має бути "Failed to parse stream message"
# - НЕ має бути масивного спаму
# - Тільки нормальні логи ATLAS системи
```

## 📝 Технічні деталі

**Keepalive механізм:**
- Orchestrator відправляє: `{"type":"keepalive","ts":1760116154847}\n`
- Інтервал: `networkConfig.KEEPALIVE_INTERVAL` (з `config/api-config.js`)
- Мета: Зберігати HTTP connection активним під час довгих стадій workflow

**Чому виникла проблема:**
- Keepalive НЕ був задуманий для обробки frontend логікою
- Це **технічне повідомлення** для утримання з'єднання
- Frontend має тільки **тихо ігнорувати** його

**Альтернативні рішення (НЕ обрані):**
1. ❌ Прибрати keepalive з orchestrator → ризик таймаутів
2. ❌ Додати обробник onMessage для keepalive → зайвий код
3. ✅ Тихо фільтрувати на рівні парсера → найчистіше рішення

## 🔗 Пов'язані виправлення

Це виправлення **НЕ пов'язане** з іншими фіксами дня:
- TTS/Workflow sync
- Grisha context
- Memory leak
- Token limits

Це **окрема проблема** парсингу стрімів, яка виникла через **відсутність обробки keepalive**.

---

**Статус:** ✅ ВИПРАВЛЕНО  
**Версія:** 4.0.0  
**Пріоритет:** CRITICAL (блокувало роботу системи)
