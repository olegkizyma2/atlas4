# Mode Selection ChatThread Fix Report
**Date:** 10 жовтня 2025 17:10  
**Issue:** Mode selection не розпізнав task після chat розмови  
**Status:** ✅ ВИПРАВЛЕНО

## Проблема

Користувач повідомив, що система НЕ перейшла у режим task на запит:
```
16:55:08 [USER] відкрий мені калькулятор і набери там 888
16:55:10 [ATLAS] На жаль, я не можу відкрити калькулятор...
```

Замість переходу в stage 1 (task режим), система залишилась у chat mode та відповіла сама.

## Діагностика

### Корінь проблеми №1: Застаріле повідомлення в mode_selection

Логи показали що `buildContextForModeSelection` використовував **СТАРЕ** повідомлення:

```javascript
// Логи:
actualMessage":"Привіт"  // ❌ Це перший запит, НЕ актуальний!
userMessage: "відкрий мені калькулятор і набери там 888"  // ✅ Актуальний
```

**Причина:** `prompt.userPrompt` будувався з `userMessage` з контексту, але `buildUserPrompt` в prompt-registry використовував застарілий userMessage через неправильну передачу session.

### Корінь проблеми №2: ChatThread оновлювався ПІСЛЯ mode_selection

Послідовність викликів була неправильна:

```javascript
// ❌ БУЛО (неправильно):
1. executeWorkflowStages()
2. → executeModeSelection() // chatThread ще НЕ містить нове повідомлення!
3. → handleChatRoute()
4.   → chatThread.messages.push(userMessage) // Тепер додається, але пізно!
```

**Результат:** mode_selection аналізував тільки старі повідомлення, нове ще не було в chatThread.

## Виправлення

### Fix #1: Додати userMessage в chatThread ДО mode_selection

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
async function executeWorkflowStages(userMessage, session, res, allStages, workflowConfig) {
  // Initialize chat thread if needed
  if (!session.chatThread) {
    session.chatThread = { messages: [], lastTopic: undefined };
  }

  // CRITICAL FIX: Add user message to chatThread BEFORE mode selection
  // This ensures mode_selection can access current message for context-aware classification
  session.chatThread.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  });

  logger.info(`Workflow: Added user message to chatThread (total: ${session.chatThread.messages.length} messages)`);

  // Now execute mode selection with access to current message
  const modeStage = allStages.find(s => s.stage === 0 && s.agent === 'system');
  // ...
}
```

### Fix #2: Витягувати останнє повідомлення з chatThread

**Файл:** `orchestrator/workflow/stages/system-stage-processor.js`

```javascript
buildContextForModeSelection(session, prompt, userMessage) {
  const messages = [];

  // Add system prompt
  if (prompt.systemPrompt) {
    messages.push({
      role: 'system',
      content: prompt.systemPrompt
    });
  }

  // Include recent history (last 5 messages) for context-aware classification
  if (session.chatThread && session.chatThread.messages) {
    const historyMessages = session.chatThread.messages.slice(-5);
    
    historyMessages.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    logger.info(`Mode selection: included ${historyMessages.length} history messages`);
  }

  // Get the ACTUAL last user message from chatThread (not the stale one from context)
  const actualUserMessage = session.chatThread?.messages
    ?.filter(m => m.role === 'user')
    .pop()?.content || userMessage;

  // Add current user message with ACTUAL content
  const userPromptContent = `"${actualUserMessage}"`;
  messages.push({
    role: 'user',
    content: userPromptContent
  });

  logger.system('debug', 'Mode selection actual message:', {
    sessionId: session.id,
    actualMessage: actualUserMessage,
    contextMessageFromPrompt: prompt.userPrompt
  });

  return messages;
}
```

### Fix #3: Передати session в getStagePrompt

**Файл:** `orchestrator/workflow/stages/system-stage-processor.js`

```javascript
async executeModeSelection(userMessage, session, options) {
  try {
    const prompt = await this.config.getStagePrompt(
      this.stage,
      this.agent,
      this.name,
      { userMessage, session, agent: this.agent }  // FIXED: включили session
    );
    // ...
  }
}
```

### Fix #4: Запобігти дублюванню в handleChatRoute

**Файл:** `orchestrator/workflow/executor-v3.js`

```javascript
async function handleChatRoute(userMessage, session, res, allStages) {
  // ...

  // NOTE: chatThread was already initialized and user message added in executeWorkflowStages
  // Only add message if it's not already there (e.g., when called from stop_dispatch)
  if (!session.chatThread) {
    session.chatThread = { messages: [], lastTopic: undefined };
  }

  // Check if message already added
  const lastUserMessage = session.chatThread.messages
    .filter(m => m.role === 'user')
    .pop();
  
  if (!lastUserMessage || lastUserMessage.content !== userMessage) {
    session.chatThread.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });
  }
  // ...
}
```

## Тестування

### Тестовий сценарій:

```bash
./tests/test-mode-selection-fix.sh
```

```
Test 1: Привіт → chat mode ✅
Test 2: Розкажи анекдот → chat mode ✅  
Test 3: відкрий мені калькулятор і набери там 888 → task mode ✅
```

### Результати логів:

```
[SYSTEM] debug: Mode selection actual message:
actualMessage":"відкрий мені калькулятор і набери там 888"  ✅

[SYSTEM] ai: System API response received for mode_selection:
"content":"{\"mode\": \"task\", \"confidence\": 0.9}"  ✅

Mode selection: task  ✅
```

## Ключові зміни

1. **chatThread оновлюється ДО mode_selection** замість після
2. **buildContextForModeSelection** витягує **АКТУАЛЬНЕ** повідомлення з chatThread
3. **Історія розмови (5 повідомлень)** передається для контекстної класифікації
4. **session передається** в getStagePrompt для правильного контексту
5. **Запобігання дублювання** повідомлень в handleChatRoute

## Наслідки

- ✅ Mode selection тепер **контекстно-залежний**
- ✅ Розпізнає task навіть після chat розмов
- ✅ Використовує останні 5 повідомлень для кращої класифікації
- ✅ Немає дублювання повідомлень в chatThread
- ✅ Правильно переходить chat → task → stage 1

## Файли змінені

1. `orchestrator/workflow/executor-v3.js`
   - executeWorkflowStages: додано chatThread.push ПЕРЕД mode_selection
   - handleChatRoute: додано перевірку на дублювання

2. `orchestrator/workflow/stages/system-stage-processor.js`
   - buildContextForModeSelection: витягує останнє повідомлення з chatThread
   - executeModeSelection: передає session в getStagePrompt

3. `tests/test-mode-selection-fix.sh` (новий)
   - Автоматичний тест для верифікації виправлення

## Зв'язок з попередніми виправленнями

Це виправлення базується на:
- **Context & Memory Fix** (10.10.2025 ранок) - система тримає історію
- **Mode Selection Fix** (10.10.2025 вечір) - контекстна класифікація

І **завершує** роботу над контекстною системою - тепер все працює разом:
1. Система пам'ятає історію ✅
2. Chat mode відповідає з контекстом ✅
3. Mode selection розпізнає task після chat ✅

## Статус

**✅ ВИПРАВЛЕНО ТА ПРОТЕСТОВАНО**

Користувач тепер може:
1. Поспілкуватись з Atlas (chat mode)
2. Отримати анекдоти та розмови (chat mode)
3. Попросити виконати завдання (task mode) - система правильно перейде в stage 1 для виконання через Goose

---

**Автор:** GitHub Copilot  
**Дата:** 10 жовтня 2025, 17:10  
**Версія:** ATLAS v4.0
