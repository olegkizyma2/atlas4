# Виправлення: Обробка запитів на уточнення від Гриші (Stage 7)

**Дата:** 10 жовтня 2025  
**Проблема:** Система не обробляла запити Гриші на уточнення після stage 7 (verification)  
**Статус:** ✅ ВИПРАВЛЕНО

---

## 🔴 Проблема

### Симптоми:
1. Після виконання завдання Тетяною (stage 2), Гриша перевіряє результат (stage 7)
2. Якщо Гриша просить уточнення (наприклад: "потрібно уточнити декілька речей"), система **НЕ переходить до наступного стейджу**
3. Користувач бачить запит Гриші на уточнення, але **workflow зупиняється** без відправки відповіді користувачу

### Приклад з логів:
```
17:07:34 [ТЕТЯНА] "Готово. Кліп 'Смарагдове небо' відкрито на YouTube..."
17:07:49 [ГРИША] "Смарагдове небо" — це назва... потрібно уточнити декілька речей...
[WORKFLOW] Stage 7 completed
[HTTP] POST /chat/stream 200 (21231ms)  ← Stream закрився БЕЗ stage 8!
```

### Корінь проблеми:

В `orchestrator/workflow/executor-v3.js` функція `determineNextStage()` мала **спрощену логіку** для обробки відповіді Гриші:

```javascript
case 7:
  // Grisha verification result
  if (response.content.toLowerCase().includes('неуспішн') ||
      response.content.toLowerCase().includes('потреб')) {
    return 9; // → New cycle
  }
  return 8; // → Completion  // ❌ За замовчуванням завжди completion
```

**Проблеми цієї логіки:**
1. ❌ Слово "потреб" спрацьовувало для "потрібно уточнити" → stage 9 (retry_cycle)
2. ❌ Stage 9 має condition `should_retry_cycle`, яка НЕ виконувалась (бо stage 8 ще не завершився)
3. ❌ Workflow зупинявся без відправки фінальної відповіді

---

## ✅ Рішення

### Виправлення 1: Покращена логіка розпізнавання відповіді Гриші

**Файл:** `orchestrator/workflow/executor-v3.js`  
**Функція:** `determineNextStage()`

```javascript
case 7:
  // Grisha verification result
  const content = response.content.toLowerCase();
  
  // Check if Grisha asks for clarification (verification blocked)
  if (content.includes('уточни') || 
      content.includes('уточнен') ||
      (content.includes('потрібно') && content.includes('уточни'))) {
    return 3; // → Atlas clarification (to provide guidance to Tetyana)
  }
  
  // Check if verification failed (task incomplete/incorrect)
  if (content.includes('не виконано') ||
      content.includes('неуспішн') ||
      content.includes('частково')) {
    return 9; // → New cycle (retry from Atlas)
  }
  
  // Check if verification passed
  if (content.includes('виконано') || 
      content.includes('перевірено') ||
      content.includes('готово')) {
    return 8; // → Completion
  }
  
  // Default: if unclear, assume needs retry
  return 9; // → New cycle
```

**Логіка:**
1. ✅ **Уточнення від Гриші** → stage 3 (Atlas clarification)
2. ✅ **Завдання не виконано** → stage 9 (retry cycle)
3. ✅ **Завдання виконано** → stage 8 (completion)
4. ✅ **Незрозуміла відповідь** → stage 9 (retry для безпеки)

### Виправлення 2: Stage 8 тепер виконується через SystemStageProcessor

**Проблема:** Раніше при переході до stage 8 викликався тільки `completeWorkflow()` без виконання SystemStageProcessor.

**Виправлення:**
```javascript
if (nextStage === 8) { // 8 is the completion stage
  // Execute stage 8 through SystemStageProcessor instead of just closing stream
  const completionStage = allStages.find(s => s.stage === 8 && s.name === 'completion');
  if (completionStage) {
    logger.workflow('stage', 'system', `Starting stage 8: completion`, { sessionId: session.id });
    const completionResponse = await executeConfiguredStage(completionStage, userMessage, session, res);
    
    if (completionResponse && res.writable && !res.writableEnded) {
      res.write(JSON.stringify({ type: 'agent_message', data: completionResponse }) + '\n');
    }
    
    session.history.push(completionResponse);
  }
  
  await completeWorkflow(session, res);
  return;
}
```

**Результат:**
- ✅ Stage 8 виконується як нормальний стейдж
- ✅ Відправляється фінальна відповідь з підсумком
- ✅ Потім закривається stream

---

## 📊 Workflow Stages (оновлено)

### Можливі шляхи після Stage 7 (Grisha verification):

```
Stage 7: Grisha Verification
    ↓
    ├─→ [УТОЧНЕННЯ] → Stage 3: Atlas Clarification
    │                     ↓
    │                Stage 4: Tetyana Retry
    │                     ↓
    │                Stage 7: Grisha Verification (знову)
    │
    ├─→ [НЕ ВИКОНАНО] → Stage 9: Retry Cycle
    │                      ↓
    │                 Stage 1: Atlas Initial Processing (знову)
    │
    └─→ [ВИКОНАНО] → Stage 8: System Completion
                        ↓
                   Відправка фінальної відповіді користувачу
```

### Приклад сценарію:

1. **Користувач:** "Відкрий кліп Смарагдове небо"
2. **Stage 1 (Atlas):** Формалізує завдання
3. **Stage 2 (Тетяна):** Відкриває кліп на YouTube
4. **Stage 7 (Гриша):** "Потрібно уточнити: це конкретний відео?"
5. **Stage 3 (Atlas):** Дає уточнення Тетяні (на основі контексту/очікувань)
6. **Stage 4 (Тетяна):** Повторює з уточненнями
7. **Stage 7 (Гриша):** "Завдання виконано. Кліп відтворюється."
8. **Stage 8 (System):** Відправляє фінальний підсумок користувачу

---

## 🧪 Тестування

### Тест 1: Уточнення від Гриші
```bash
# Запустити систему
./restart_system.sh restart

# Відправити завдання що потребує уточнення
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий кліп на все вікно: смарагдове небо", "sessionId": "test"}'

# Очікуваний результат:
# 1. Stage 1 (Atlas) - формалізація
# 2. Stage 2 (Тетяна) - виконання
# 3. Stage 7 (Гриша) - "потрібно уточнити..."
# 4. Stage 3 (Atlas) - надання уточнень
# 5. Stage 4 (Тетяна) - повторне виконання
# 6. Stage 7 (Гриша) - верифікація
# 7. Stage 8 (System) - фінальна відповідь
```

### Тест 2: Успішна верифікація
```bash
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор", "sessionId": "test2"}'

# Очікуваний результат:
# 1. Stage 1 (Atlas)
# 2. Stage 2 (Тетяна)
# 3. Stage 7 (Гриша) - "Завдання виконано"
# 4. Stage 8 (System) - фінальна відповідь
```

### Перевірка логів:
```bash
# Перевірити що stage 3 викликається після уточнення Гриші
tail -100 logs/orchestrator.log | grep -E "stage.*3.*clarification"

# Перевірити що stage 8 виконується
tail -100 logs/orchestrator.log | grep -E "stage.*8.*completion"

# Перевірити весь flow
tail -200 logs/orchestrator.log | grep "Starting stage"
```

---

## 📝 Додаткові покращення

### Ідеї для майбутнього:

1. **AI-based next stage detection:** Використовувати LLM для аналізу відповіді Гриші замість keyword matching
2. **Structured responses:** Гриша має відповідати в JSON форматі з чітким статусом
3. **User confirmation:** Для уточнень запитувати користувача напряму, якщо Atlas не може дати відповідь
4. **Retry limits:** Обмежити кількість циклів уточнення (максимум 3)

---

## ✅ Підсумок

**Виправлено:**
- ✅ Розпізнавання запитів на уточнення від Гриші
- ✅ Правильний перехід до stage 3 (Atlas clarification)
- ✅ Виконання stage 8 через SystemStageProcessor
- ✅ Відправка фінальної відповіді користувачу

**Файли:**
- `orchestrator/workflow/executor-v3.js` - покращена логіка `determineNextStage()`
- `docs/GRISHA_CLARIFICATION_FIX_2025-10-10.md` - документація виправлення

**Тестування:** Перезапустити систему та перевірити сценарії з уточненнями.
