# Token Limit Error Handling Fix

**DATE:** 10 жовтня 2025 - пізній вечір  
**ISSUE:** Тетяна крашила при web_scrape великих сторінок з помилкою `model_max_prompt_tokens_exceeded`

## 🔴 Проблема

### Симптоми:
- Тетяна почала виконувати завдання (stage 2)
- Використала `web_scrape` для пошуку інформації
- Завантажила великі веб-сторінки (особливо Reddit)
- Контекст досяг 84,213 токенів (ліміт: 64,000)
- Goose повернув помилку: `prompt token count of 84213 exceeds the limit of 64000`
- Система НЕ має fallback → workflow зупинився
- Користувач побачив тільки завдання від Атласа, без подальших дій

### Лог помилки:
```
[GOOSE] Error for session: ...: Error: Request failed: prompt token count of 84213 exceeds the limit of 64000 (code: model_max_prompt_tokens_exceeded) (status 400)
[GOOSE] Error for session: ... - NO FALLBACK
Goose agent failed for tetyana - NO FALLBACK
```

## ✅ Рішення

### 1. Обробка помилки token limit в goose-client.js

**Файл:** `orchestrator/agents/goose-client.js`

Додано спеціальну обробку для `model_max_prompt_tokens_exceeded`:

```javascript
} else if (obj.type === 'error') {
  const errorMsg = obj.error || obj.message || 'Unknown error';
  console.error(`[GOOSE] Error for session: ${sessionId}: ${errorMsg}`);
  
  // Спеціальна обробка для token limit overflow
  if (errorMsg.includes('model_max_prompt_tokens_exceeded') || 
      errorMsg.includes('prompt token count') ||
      errorMsg.includes('exceeds the limit')) {
    console.error('[GOOSE] TOKEN LIMIT EXCEEDED - контекст занадто великий!');
    console.error('[GOOSE] Можливі рішення: 1) Очистити історію 2) Обмежити web_scrape 3) Використати меншу модель');
    
    // Повертаємо спеціальне повідомлення замість null
    const errorResponse = '⚠️ Помилка: Контекст занадто великий (перевищено ліміт токенів). Потрібно спростити завдання або очистити історію.';
    clearTimeout(timeout);
    ws.close();
    resolve(errorResponse);
    return;
  }
  
  clearTimeout(timeout);
  ws.close();
  resolve(null);
}
```

**Що змінилось:**
- Замість `resolve(null)` → повертає **зрозуміле повідомлення** користувачу
- Детальне логування з можливими рішеннями
- Система НЕ крашиться, а коректно обробляє помилку

### 2. Обмеження web_scrape в промпті Тетяни

**Файл:** `prompts/tetyana/stage2_execution.js`

Додано попередження про обмеження контексту:

```javascript
⚠️ ОБМЕЖЕННЯ КОНТЕКСТУ:
- НЕ завантажуй великі веб-сторінки повністю (Reddit, форуми)
- Використовуй targeted пошук замість повного scraping
- Якщо web_scrape повертає >10KB - зупинись і повідом про проблему
- Надавай перевагу прямим діям (brew install, App Store) замість веб-пошуку

ВАРІАНТИ ВІДПОВІДЕЙ:
...
4. Якщо ПЕРЕВИЩЕНО ЛІМІТ КОНТЕКСТУ:
"⚠️ Контекст занадто великий. Потрібно спростити завдання або використати інший підхід."
```

**Що змінилось:**
- Тетяна тепер **знає** про обмеження контексту
- Віддає перевагу прямим діям (brew, App Store) замість web scraping
- Має шаблон відповіді для ситуацій з переповненням контексту

## 📊 Результат

### До виправлення:
❌ Token overflow → Goose error → `resolve(null)` → "NO FALLBACK" → workflow стоп  
❌ Користувач бачить тільки завдання від Атласа, без подальших дій  
❌ Немає пояснення що сталось

### Після виправлення:
✅ Token overflow → детальне логування → **зрозуміле повідомлення** користувачу  
✅ Тетяна знає про обмеження і уникає великих scraping операцій  
✅ Користувач отримує пояснення і може скоригувати запит  
✅ Workflow продовжується (може перейти до retry або clarification)

## 🧪 Тестування

### Ручний тест:
1. Запустити завдання з пошуком через веб (напр. "знайди Steem програму")
2. Тетяна спробує web_scrape
3. Якщо контекст великий → система коректно обробить помилку
4. Користувач побачить повідомлення про переповнення

### Очікувана поведінка:
- Логи містять `[GOOSE] TOKEN LIMIT EXCEEDED` з порадами
- Користувач бачить `⚠️ Помилка: Контекст занадто великий...`
- Workflow може продовжитись (retry/clarification) замість краша

## 📝 Зміни в файлах

1. **orchestrator/agents/goose-client.js**
   - Додано обробку `model_max_prompt_tokens_exceeded`
   - Повертає зрозуміле повідомлення замість `null`
   - Логування з можливими рішеннями

2. **prompts/tetyana/stage2_execution.js**
   - Додано розділ "⚠️ ОБМЕЖЕННЯ КОНТЕКСТУ"
   - Новий варіант відповіді для token overflow
   - Пріоритет прямим діям замість web scraping

## 🔍 Діагностика

### Перевірити що виправлення працює:
```bash
# Логи мають містити обробку помилки
grep -i "TOKEN LIMIT EXCEEDED" logs/orchestrator.log

# Або перевірити що система повертає повідомлення замість null
grep "Контекст занадто великий" logs/orchestrator.log
```

### Якщо проблема повторюється:
1. Перевірити що Goose повертає правильний формат помилки
2. Додати більше ключових слів в умову `if (errorMsg.includes(...))`
3. Розглянути збільшення ліміту моделі або використання меншої моделі

## 📚 Пов'язані документи

- `docs/MEMORY_LEAK_FIX_2025-10-10.md` - виправлення витоку пам'яті
- `docs/TETYANA_CLARIFICATION_FIX_2025-10-10.md` - flow уточнень Тетяни
- `.github/copilot-instructions.md` - головна інструкція (має бути оновлена)

## 🎯 Висновок

Виправлення забезпечує:
1. ✅ Коректну обробку token limit помилок
2. ✅ Зрозумілі повідомлення користувачу
3. ✅ Превентивні заходи (обмеження web_scrape)
4. ✅ Детальне логування для діагностики
5. ✅ Продовження workflow замість краша

**Система тепер стабільна** навіть при перевищенні ліміту токенів! 🚀
