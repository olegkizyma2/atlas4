# TTS та Workflow Синхронізація - Виправлення (10.10.2025 - вечір)

## 🎯 Проблема

**Симптом:** Атлас ще говорить завдання (TTS), а Тетяна вже починає його виконувати. Озвучка Тетяни накладається на озвучку Атласа.

**Корінь проблеми:**
1. **Frontend:** TTS НЕ використовував чергу - виклики `speak()` йшли паралельно
2. **Backend:** Orchestrator НЕ чекав завершення TTS перед переходом до наступного stage
3. **Результат:** Stage 1 (Atlas) → відправка відповіді → одразу Stage 2 (Tetyana), навіть якщо Atlas ще озвучує

## 🔧 Виправлення

### 1. Frontend: Черга TTS (web/static/js/modules/chat-manager.js)

**ДО:**
```javascript
// Прямі виклики без черги
if (shouldChunk) {
  await this.ttsManager.speakSegmented(textForTTS, agent, ttsOptions);
} else {
  await this.ttsManager.speak(textForTTS, agent, ttsOptions);
}
```

**ПІСЛЯ:**
```javascript
// ВИКОРИСТАННЯ ЧЕРГИ - TTS виконується послідовно
const ttsOptions = { mode: mode || 'chat' };
await this.ttsManager.addToQueue(textForTTS, agent, ttsOptions);
```

**Що змінилось:**
- ✅ Всі TTS запити йдуть через `addToQueue()` замість прямих викликів
- ✅ `processQueue()` виконує озвучення **ПОСЛІДОВНО** (один за одним)
- ✅ Наступна озвучка починається ТІЛЬКИ після завершення попередньої

### 2. Frontend: Покращена черга TTS (web/static/js/modules/tts-manager.js)

**ДО:**
```javascript
async addToQueue(text, agent = 'atlas') {
  // Проста черга без підтримки options
  this.queue.push({ text, agent, resolve, reject });
  this.processQueue();
}

async processQueue() {
  // Завжди викликає speak(), ігнорує chunking
  await this.speak(item.text, item.agent);
}
```

**ПІСЛЯ:**
```javascript
async addToQueue(text, agent = 'atlas', options = {}) {
  // Підтримка mode та options
  this.queue.push({ text, agent, options, resolve, reject });
  this.processQueue();
}

async processQueue() {
  // Визначає chunking на основі mode та довжини
  const isTaskMode = options.mode === 'task';
  const shouldChunk = isTaskMode && text.length > 500;

  if (shouldChunk) {
    await this.speakSegmented(text, agent, options);
  } else {
    await this.speak(text, agent, options);
  }
}
```

**Що змінилось:**
- ✅ Черга тепер підтримує `options` (mode, chunking)
- ✅ Автоматичне визначення chunking для task mode
- ✅ Правильне логування процесу черги

### 3. Backend: Очікування TTS (orchestrator/workflow/stages/agent-stage-processor.js)

**ДО:**
```javascript
async execute(userMessage, session, res, options = {}) {
  // ... виконання stage ...
  
  logger.agent(this.agent, 'complete', `Completed stage ${this.stage}`);
  return response; // ❌ ОДРАЗУ повертається, не чекає TTS
}
```

**ПІСЛЯ:**
```javascript
import { sendToTTSAndWait } from '../../utils/helpers.js';

async execute(userMessage, session, res, options = {}) {
  // ... виконання stage ...
  
  logger.agent(this.agent, 'complete', `Completed stage ${this.stage}`);

  // ✅ КРИТИЧНЕ ВИПРАВЛЕННЯ: Чекаємо завершення TTS перед наступним stage
  if (response && response.content) {
    try {
      const voice = agentConfig.voice || 'dmytro';
      const contentForTTS = response.content.replace(/^\[.*?\]\s*/, '').trim();
      
      logger.agent(this.agent, 'tts_wait', `Waiting for TTS (voice: ${voice})...`);
      await sendToTTSAndWait(contentForTTS, voice);
      logger.agent(this.agent, 'tts_complete', `TTS completed`);
    } catch (ttsError) {
      logger.agent(this.agent, 'tts_error', `TTS failed - continuing workflow`);
    }
  }

  return response;
}
```

**Що змінилось:**
- ✅ Orchestrator ЧЕКАЄ на завершення TTS через `sendToTTSAndWait()`
- ✅ Видаляється сигнатура агента `[ATLAS]` перед відправкою на TTS
- ✅ Workflow НЕ продовжується до наступного stage поки не завершиться озвучка
- ✅ При помилці TTS workflow продовжується (graceful degradation)

## 📋 Механізм синхронізації

### Повний ланцюг подій:

1. **Stage 1 (Atlas):** Генерує відповідь "Зараз відкрию калькулятор"
2. **AgentStageProcessor:** Відправляє `agent_message` на frontend
3. **Frontend (chat-manager):** Отримує повідомлення → додає в чергу TTS
4. **Frontend (tts-manager):** Починає озвучення (якщо черга порожня)
5. **Frontend (tts-manager):** При завершенні audio викликає `notifyPlaybackCompleted()`
6. **Backend (orchestrator):** Отримує `/tts/completed` → розблокує `sendToTTSAndWait()`
7. **AgentStageProcessor:** Продовжує виконання → переходить до Stage 2 (Tetyana)
8. **Stage 2 (Tetyana):** Починає виконання ТІЛЬКИ ПІСЛЯ завершення озвучки Atlas

### Використовувані інструменти:

- **sendToTTSAndWait()** - backend утиліта (orchestrator/utils/helpers.js)
  - Створює Promise для очікування події завершення TTS
  - Відправляє текст на TTS генерацію (без повернення аудіо)
  - Чекає на POST `/tts/completed` від frontend
  - Розблокує workflow тільки після отримання події

- **addToQueue()** - frontend черга (web/static/js/modules/tts-manager.js)
  - Додає TTS запит в чергу з Promise
  - Викликає `processQueue()` для запуску обробки
  - Resolve Promise тільки після завершення speak/speakSegmented

- **processQueue()** - frontend обробка черги
  - Перевіряє `isProcessing` флаг (блокує паралельне виконання)
  - Обробляє елементи черги ПОСЛІДОВНО (while loop)
  - Визначає chunking на основі mode та довжини тексту
  - Розблокує `isProcessing` після завершення

## ✅ Результат

**ДО виправлення:**
```
[Time 0s]  Atlas: "Зараз відкрию калькулятор" → TTS почав
[Time 1s]  Tetyana: починає виконання → TTS почав (накладання!)
[Time 2s]  Atlas TTS: ще говорить
[Time 3s]  Tetyana TTS: говорить одночасно
```

**ПІСЛЯ виправлення:**
```
[Time 0s]  Atlas: "Зараз відкрию калькулятор" → TTS почав
[Time 3s]  Atlas TTS: завершився → подія /tts/completed
[Time 3s]  Workflow: розблокувався → Stage 2
[Time 4s]  Tetyana: починає виконання → TTS почав
[Time 7s]  Tetyana TTS: завершився → подія /tts/completed
```

**Переваги:**
- ✅ Немає накладання озвучок між агентами
- ✅ Workflow синхронізований з TTS
- ✅ Користувач чує ВСЕ повністю послідовно
- ✅ Зрозуміла логіка виконання: Atlas говорить → Tetyana виконує → Tetyana говорить

## 🧪 Тестування

```bash
# Запустити систему
./restart_system.sh restart

# Тест: Дати завдання яке потребує виконання
# Очікуваний результат:
# 1. Atlas озвучує завдання повністю
# 2. ТІЛЬКИ ПІСЛЯ завершення озвучки Atlas починається виконання Tetyana
# 3. Tetyana озвучує результат БЕЗ накладання на попередню озвучку

# Перевірити логи синхронізації
tail -f logs/orchestrator.log | grep -E "tts_wait|tts_complete|TTS"

# Має показати:
# [agent] atlas tts_wait: Waiting for TTS (voice: dmytro, length: 50 chars)...
# [agent] atlas tts_complete: TTS completed for atlas
# [agent] tetyana tts_wait: Waiting for TTS (voice: lesya, length: 80 chars)...
# [agent] tetyana tts_complete: TTS completed for tetyana
```

## 📄 Змінені файли

1. **web/static/js/modules/chat-manager.js**
   - Використання `addToQueue()` замість прямих викликів TTS
   - Передача `options` з mode для правильного chunking

2. **web/static/js/modules/tts-manager.js**
   - Підтримка `options` в `addToQueue()`
   - Покращена логіка `processQueue()` з визначенням chunking

3. **orchestrator/workflow/stages/agent-stage-processor.js**
   - Імпорт `sendToTTSAndWait`
   - Очікування TTS в методі `execute()` перед поверненням response

## 🔍 Діагностика проблем

**Якщо TTS все ще накладаються:**
1. Перевірити що черга працює: `grep "Processing TTS queue" logs/orchestrator.log`
2. Переконатись що `isProcessing` не залишається true
3. Перевірити події `/tts/completed`: `grep "POST /tts/completed" logs/orchestrator.log`

**Якщо workflow зависає:**
1. Можливо TTS сервіс не працює: `curl http://localhost:3001/health`
2. Перевірити timeout в `sendToTTSAndWait` (60 секунд)
3. Переглянути помилки TTS: `tail -30 logs/tts.log`

---

**Автор:** AI Assistant  
**Дата:** 10 жовтня 2025 - вечір  
**Версія:** 1.0
