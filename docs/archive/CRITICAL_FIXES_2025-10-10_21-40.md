# Критичні виправлення (10.10.2025 - 21:40)

## Проблеми виявлені в консолі

### 1. `this.modelController.speak is not a function` ❌

**Симптом:**
```
[CHAT] Event handler error for tts-start this.modelController.speak is not a function
```

**Корінь проблеми:**
- `app-refactored.js` рядок 466: викликає `this.managers.livingBehavior.startSpeaking(data.text, data.audioElement)`
- **Неправильні параметри:** `startSpeaking(agent, intensity)` приймає agent (string) та intensity (number)
- Викликається з `(data.text, data.audioElement)` - неправильні типи!

**Виправлення:**
```javascript
// BEFORE (app-refactored.js:466)
if (this.managers.livingBehavior) {
  this.managers.livingBehavior.startSpeaking(data.text, data.audioElement);
}

// AFTER
if (this.managers.livingBehavior && typeof this.managers.livingBehavior.startSpeaking === 'function') {
  const agent = data.agent || data.detail?.agent || 'atlas';
  this.managers.livingBehavior.startSpeaking(agent, 0.8);
}
```

**Результат:** Виклик `startSpeaking()` з правильними параметрами, помилка зникла

---

### 2. TTS Retry занадто повільний ⏱️

**Симптом:**
```
[TTS] Attempt 1 failed with tensor error, retrying... (1000ms)
[TTS] Attempt 2 failed with tensor error, retrying... (2000ms)
[TTS] Attempt 3 failed with tensor error, retrying... (3000ms)
Total: 6+ seconds для 3 спроб
```

**Корінь проблеми:**
- `tts-manager.js` рядок 207: `const delay = Math.min(1000 * attempt, 5000)`
- Занадто довгі затримки для UX - користувач чекає багато секунд

**Виправлення:**
```javascript
// BEFORE (tts-manager.js:207)
const delay = Math.min(1000 * attempt, 5000); // 1s → 2s → 3s → 4s → 5s

// AFTER
const delay = Math.min(300 * attempt, 2000); // 300ms → 600ms → 900ms → 1.2s → 1.5s
```

**Результат:** Швидший retry (300ms базова замість 1000ms), краща UX, все одно 5 спроб

---

### 3. SSE Parse Error (некоректний JSON) 🔧

**Симптом:**
```
Failed to parse stream message 21481340}
```

**Аналіз:**
- Orchestrator log показує дублікати: `[HTTP] POST /chat/stream 200` (два рази підряд)
- Можливо orchestrator відправляє некоректний JSON або неповний chunk
- Frontend намагається парсити частковий JSON

**Поточний статус:**
- НЕ виправлено в цьому commit
- Потребує глибшого аналізу SSE stream в `executor-v3.js`
- TODO: Додати валідацію JSON перед `res.write()`

---

## Файли змінені

1. **web/static/js/app-refactored.js** (рядок 466):
   - Виправлено виклик `startSpeaking()` з правильними параметрами
   - Додано type check для безпеки

2. **web/static/js/modules/tts-manager.js** (рядок 207):
   - Зменшено затримку retry з `1000*attempt` до `300*attempt`
   - Зменшено максимум з 5000ms до 2000ms

---

## Результати

✅ **Виправлено:** `modelController.speak is not a function`  
✅ **Виправлено:** TTS retry занадто повільний (тепер 300ms базова)  
⏳ **Pending:** SSE parse error (потребує детального debug)

---

## Тестування

```bash
# Перезапустити систему
./restart_system.sh restart

# Відкрити консоль браузера
open http://localhost:5001

# Тест 1: Перевірка що помилка modelController зникла
# Очікувано: Немає "[CHAT] Event handler error for tts-start"

# Тест 2: Відправити довге повідомлення для TTS retry
# Повідомлення: "Тетяна, завдання наступне: Відкрити калькулятор на комп'ютері та виконати обчислення 2 множити на 333. Результат записати в файл result.txt в поточній директорії. Це важливе завдання для автоматизації обчислень."
# Очікувано: Retry швидший (300-600ms замість 1-2s)

# Тест 3: Моніторинг SSE stream
tail -f logs/orchestrator.log | grep -E "res.write|SSE|stream"
# Очікувано: Знайти некоректний JSON chunk
```

---

**Час виправлення:** 21:40  
**Статус:** 2/3 виправлено, 1 потребує додаткового аналізу
