# Виправлення: Тетяна → Atlas Clarification Flow
**Дата:** 10 жовтня 2025 (пізній вечір)  
**Проблема:** Коли Тетяна просить уточнення, система йде до Гриші замість Atlas

## 🔴 Проблема

### Поточна поведінка (НЕПРАВИЛЬНА):
```
User: "найди steem программа для ігор для цього мак і заінсталюй його"
  ↓
Atlas (stage 1): "Тетяна, знайди Steam..."
  ↓
Tetyana (stage 2): "Atlas, не вдалося... можу продовжити пошук альтернативними способами або уточнити ваш запит."
  ↓
❌ Grisha (stage 7): "Будь ласка, поясніть завдання..." (НЕ РОЗУМІЄ ЩО ПЕРЕВІРЯТИ!)
```

### Очікувана поведінка (ПРАВИЛЬНА):
```
User: "найди steem программа для ігор для цього мак і заінсталюй його"
  ↓
Atlas (stage 1): "Тетяна, знайди Steam..."
  ↓
Tetyana (stage 2): "Atlas, не вдалося... можу продовжити пошук або уточнити запит."
  ↓
✅ Atlas (stage 3): "Тетяна, ось уточнення: [конкретні інструкції]..."
  ↓
Tetyana (stage 4): "Готово. Використала уточнення..."
  ↓
Grisha (stage 7): "Завдання виконано. Перевірено..."
```

## 🔍 Корінь проблеми

### 1. Недостатня кількість keywords для розпізнавання запитів Тетяни

**Старий код** (`executor-v3.js`, case 2):
```javascript
case 2:
  if (response.content.toLowerCase().includes('уточнен') ||
      response.content.toLowerCase().includes('не можу')) {
    return 3; // Tetyana → Atlas clarification
  }
  return 7; // Tetyana → Grisha verification
```

**Проблема:** Тетяна каже:
- "не вдалося" ❌ (а шукали "не можу")
- "уточнити" ❌ (а шукали "уточнен")  
- "можу продовжити пошук" ❌ (не шукали взагалі)
- "Atlas, ..." ❌ (звертання до Atlas ігнорується)

### 2. Відсутня обробка контексту для stage 4 та 7

**Старий код** (`prompt-registry.js`, buildUserPrompt):
```javascript
case 3: // Atlas clarification
  // ✅ Правильно отримує відповідь Тетяни
  const tetyanaResponse = session?.history?.filter(r => r.agent === 'tetyana').pop()?.content;
  return userPromptFn(tetyanaResponse, originalTask, userMessage);

// ❌ Відсутній case 4!
// ❌ Відсутній case 7!

case 5: // Grisha diagnosis
  // ...
```

**Наслідок:**
- Stage 4 (Tetyana retry) НЕ отримує уточнення від Atlas
- Stage 7 (Grisha) НЕ отримує правильні параметри для перевірки

## ✅ Виправлення

### 1. Розширені keywords для розпізнавання (executor-v3.js)

```javascript
case 2:
  // Analyze if Tetyana needs clarification or asks questions
  const tetyanaContent = response.content.toLowerCase();
  
  const needsClarification = tetyanaContent.includes('уточни') ||
    tetyanaContent.includes('не можу') ||
    tetyanaContent.includes('не вдалос') ||          // ✅ ДОДАНО
    tetyanaContent.includes('потрібно уточн') ||     // ✅ ДОДАНО
    tetyanaContent.includes('прошу уточн') ||        // ✅ ДОДАНО
    tetyanaContent.includes('можу продовж') ||       // ✅ ДОДАНО
    tetyanaContent.includes('можу опрацюват') ||     // ✅ ДОДАНО
    tetyanaContent.includes('альтернативн') ||       // ✅ ДОДАНО
    tetyanaContent.includes('уточнити') ||           // ✅ ДОДАНО
    tetyanaContent.includes('помилк') ||             // ✅ ДОДАНО
    tetyanaContent.includes('atlas,');               // ✅ ДОДАНО - звертання до Atlas
  
  logger.info(`Stage 2 decision: Tetyana needs clarification=${needsClarification}`, {
    contentPreview: tetyanaContent.substring(0, 100),
    nextStage: needsClarification ? 3 : 7
  });
  
  if (needsClarification) {
    return 3; // Tetyana → Atlas clarification
  }
  return 7; // Tetyana → Grisha verification
```

**Розпізнає тепер:**
- ✅ "не вдалося отримати результат"
- ✅ "можу продовжити пошук"
- ✅ "Atlas, мені потрібно уточнити"
- ✅ "потрібно уточнення"
- ✅ "помилка завантаження"

### 2. Додано обробку stage 4 (prompt-registry.js)

```javascript
case 4: // Tetyana retry with Atlas guidance
  const lastAtlasGuidance = session?.history?.filter(r => r.agent === 'atlas').pop();
  const atlasGuidance = lastAtlasGuidance ? lastAtlasGuidance.content : '';
  const originalTask4 = session?.history?.filter(r => r.agent === 'atlas')[0]?.content || '';
  const previousAttempt = session?.history?.filter(r => r.agent === 'tetyana')[0]?.content || '';
  return userPromptFn(atlasGuidance, originalTask4, previousAttempt);
```

**Що передається Тетяні (stage 4):**
- `atlasGuidance` - останнє уточнення від Atlas (stage 3)
- `originalTask4` - перше завдання від Atlas (stage 1)
- `previousAttempt` - перша спроба Тетяни (stage 2)

### 3. Додано обробку stage 7 (prompt-registry.js)

```javascript
case 7: // Grisha verification
  const originalRequest7 = userMessage; // Оригінальний запит користувача
  const executionResults = session?.history?.filter(r => r.agent === 'tetyana').pop()?.content || '';
  const expectedOutcome = session?.history?.filter(r => r.agent === 'atlas')[0]?.content || '';
  return userPromptFn(originalRequest7, executionResults, expectedOutcome);
```

**Що передається Гріші (stage 7):**
- `originalRequest7` - оригінальний запит користувача
- `executionResults` - останній результат Тетяни
- `expectedOutcome` - очікуваний результат від Atlas (stage 1)

## 📋 Виправлені файли

1. **orchestrator/workflow/executor-v3.js**
   - Розширено keywords для розпізнавання запитів Тетяни (case 2)
   - Додано детальне логування рішення

2. **prompts/prompt-registry.js**
   - Додано обробку stage 4 (Tetyana retry) в buildUserPrompt
   - Додано обробку stage 7 (Grisha verification) в buildUserPrompt
   - Правильна передача параметрів у промпти

3. **tests/test-tetyana-clarification.sh** (новий)
   - Автоматичний тест для перевірки workflow
   - Перевіряє що Тетяна → Atlas (stage 3), а НЕ → Grisha (stage 7)

## 🧪 Тестування

```bash
# Запустити тест
./tests/test-tetyana-clarification.sh

# Очікуваний результат:
# ✅ Workflow correctly went to Stage 3 (Atlas clarification)
# ✅ TEST PASSED
```

**Перевірка в логах:**
```bash
# Має показати:
# Stage 2 decision: Tetyana needs clarification=true
# Starting stage 3: clarification
# Starting stage 4: retry_execution
# Starting stage 7: verification (після успішного retry)
```

## 🔄 Новий flow

### Сценарій 1: Тетяна просить уточнення
```
Stage 1 (Atlas): "Тетяна, знайди Steam..."
  ↓
Stage 2 (Tetyana): "Atlas, не вдалося... можу уточнити запит."
  ↓ (розпізнано "не вдалося" + "atlas," + "уточнити")
Stage 3 (Atlas): "Тетяна, ось уточнення: перейди на store.steampowered.com..."
  ↓
Stage 4 (Tetyana): "Готово. Використала уточнення. Завантажила Steam.dmg..."
  ↓
Stage 7 (Grisha): "Завдання виконано. Скріншот підтверджує..."
  ↓
Stage 8 (Completion): Фінальна відповідь користувачу
```

### Сценарій 2: Тетяна виконує без уточнень
```
Stage 1 (Atlas): "Тетяна, знайди Steam..."
  ↓
Stage 2 (Tetyana): "Готово. Завантажила і встановила Steam."
  ↓ (НЕ розпізнано keywords → прямо до Grisha)
Stage 7 (Grisha): "Завдання виконано. Перевірено..."
  ↓
Stage 8 (Completion): Фінальна відповідь користувачу
```

## 📝 Важливі нотатки

1. **НЕ використовуємо хардкод** - всі промпти через prompt-registry
2. **Логування рішень** - кожне рішення про перехід логується
3. **Контекст зберігається** - session.history передається правильно
4. **Параметри динамічні** - buildUserPrompt витягує з історії сесії

## ✅ Результат

- ✅ Тетяна може просити уточнення → Atlas відповідає (stage 3)
- ✅ Atlas надає конкретні інструкції → Тетяна виконує (stage 4)
- ✅ Тільки після виконання → Гриша перевіряє (stage 7)
- ✅ Немає зациклення на Гріші без виконання завдання
- ✅ Повний контекст на кожному етапі

---

**Статус:** ✅ ВИПРАВЛЕНО  
**Тестовано:** Очікується запуск тесту після перезапуску системи
