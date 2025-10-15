# Grisha Active Verification Fix

**Date**: 2025-10-16  
**Status**: ✅ Implemented  
**Priority**: Critical

## Problem

Grisha (верифікатор) тільки **аналізував текстові результати** від Тетяни, але **НЕ виконував власні MCP інструменти** для перевірки. Це призводило до:

1. **Неможливість візуальної перевірки**: Гріша не робив screenshot для підтвердження
2. **Відсутність доказів**: Завдання виконувалися, але не підтверджувалися
3. **Неправильні повідомлення в чаті**: Всі повідомлення йшли від SYSTEM, а не від агентів (Тетяна/Гріша)
4. **TTS не працював**: TTS реагує на імена агентів, але вони не вказувалися

### Приклад проблеми з логів:

```
00:03:07 ✅ Виконано: "Ввести 333 в калькулятор"
00:03:08 ⚠️ Не підтверджено: "Ввести 333 в калькулятор"
         Причина: Немає доказів, що 333 введено в калькулятор
```

**Проблема**: Гріша каже "немає доказів", але **НЕ РОБИТЬ screenshot** щоб перевірити!

## Solution

### Архітектурна зміна: Гріша тепер виконує 3 етапи

**До (пасивна верифікація):**
```
Tetyana executes → Grisha analyzes text → Decision
```

**Після (активна верифікація):**
```
Tetyana executes → Grisha plans tools → Grisha executes tools → Grisha analyzes evidence → Decision
```

### 1. Новий метод `_planVerificationTools()` (NEW)

Гріша планує які інструменти використати для перевірки:

```javascript
async _planVerificationTools(item, execution, options = {}) {
    // Grisha decides which MCP tools to use
    // Screenshot is MANDATORY for visual verification
    
    const planPrompt = `Ти Гриша - верифікатор. 
    ⚠️ ОБОВ'ЯЗКОВО: ЗАВЖДИ включай screenshot для візуальної перевірки!
    
    TODO Item: ${item.action}
    Success Criteria: ${item.success_criteria}
    Tetyana's Execution Results: ${execution.results}
    
    Обери МІНІМАЛЬНИЙ набір інструментів. Screenshot ОБОВ'ЯЗКОВИЙ.
    
    Return ONLY JSON:
    {
      "tool_calls": [
        {"server": "shell", "tool": "run_shell_command", 
         "parameters": {"command": "screencapture -x /tmp/verify.png"}}
      ],
      "reasoning": "...",
      "tts_phrase": "Перевіряю докази"
    }`;
    
    // LLM generates verification plan
    const plan = this._parseToolPlan(response);
    return plan;
}
```

**Приклади планів:**
- "Відкрити калькулятор" → `screencapture` для візуальної перевірки
- "Створити файл" → `filesystem__read_file` + `screencapture`
- "Ввести текст" → `screencapture` калькулятора

### 2. Новий метод `_executeVerificationTools()` (NEW)

Гріша виконує заплановані інструменти:

```javascript
async _executeVerificationTools(plan, item) {
    const results = [];
    
    for (const toolCall of plan.tool_calls) {
        const result = await this.mcpManager.executeTool(
            toolCall.server,
            toolCall.tool,
            toolCall.parameters
        );
        
        results.push({
            tool: toolCall.tool,
            success: true,
            result
        });
    }
    
    return { results, all_successful: true };
}
```

### 3. Новий метод `_analyzeVerificationResults()` (NEW)

Гріша аналізує докази та робить висновок:

```javascript
async _analyzeVerificationResults(item, execution, verificationResults, options = {}) {
    const analysisPrompt = `Ти Гриша - верифікатор. 
    Проаналізуй докази та визнач чи виконано завдання.
    
    Tetyana's Execution Results: ${execution.results}
    Grisha's Verification Evidence (screenshot, file checks): ${verificationResults.results}
    
    Return ONLY JSON:
    {
      "verified": boolean,
      "reason": "чітке пояснення",
      "evidence": {...},
      "tts_phrase": "Підтверджено" або "Не підтверджено"
    }`;
    
    const verification = this._parseVerification(response);
    return verification;
}
```

### 4. Оновлений метод `verifyItem()` (REDESIGNED)

Тепер викликає всі 3 етапи:

```javascript
async verifyItem(item, execution, options = {}) {
    this._sendChatMessage(`🔍 Перевіряю: "${item.action}"`, 'grisha');
    
    // STEP 1: Plan verification tools (screenshot mandatory)
    const verificationPlan = await this._planVerificationTools(item, execution, options);
    this._sendChatMessage(`[GRISHA] ${verificationPlan.tts_phrase}`, 'agent');
    
    // STEP 2: Execute verification tools
    const verificationResults = await this._executeVerificationTools(verificationPlan, item);
    
    // STEP 3: Analyze evidence and make decision
    const verification = await this._analyzeVerificationResults(item, execution, verificationResults, options);
    
    // Send result from Grisha
    if (verification.verified) {
        this._sendChatMessage(`✅ Перевірено: "${item.action}"\nПідтвердження: ${verification.reason}`, 'grisha');
    } else {
        this._sendChatMessage(`⚠️ Не підтверджено: "${item.action}"\nПричина: ${verification.reason}`, 'grisha');
    }
    
    return verification;
}
```

### 5. Повідомлення від імені агентів

**Тетяна (виконання):**
```javascript
this._sendChatMessage(`✅ Виконано: "${item.action}"`, 'tetyana');
```

**Гріша (перевірка):**
```javascript
this._sendChatMessage(`🔍 Перевіряю: "${item.action}"`, 'grisha');
this._sendChatMessage(`✅ Перевірено: "${item.action}"`, 'grisha');
```

**Atlas (коригування):**
```javascript
this._sendChatMessage(`🔄 Коригую стратегію`, 'atlas');
```

## Files Modified

1. **orchestrator/workflow/mcp-todo-manager.js**
   - Redesigned `verifyItem()` - Lines 706-771 (3-step verification)
   - Added `_planVerificationTools()` - Lines 1549-1624 (NEW method)
   - Added `_executeVerificationTools()` - Lines 1626-1683 (NEW method)
   - Added `_analyzeVerificationResults()` - Lines 1685-1784 (NEW method)
   - Updated `executeItemWithRetry()` - Removed duplicate messages

2. **docs/fixes/GRISHA_ACTIVE_VERIFICATION_FIX_2025-10-16.md**
   - This documentation file

## Testing

### Before Fix
```
00:03:07 ✅ Виконано: "Ввести 333 в калькулятор"
00:03:08 ⚠️ Не підтверджено: "Ввести 333 в калькулятор"
         Причина: Немає доказів, що 333 введено в калькулятор
         
❌ Grisha НЕ робить screenshot
❌ Grisha НЕ перевіряє візуально
❌ Завдання не підтверджуються
```

### After Fix (Expected)
```
00:03:07 [TETYANA] ✅ Виконано: "Ввести 333 в калькулятор"
00:03:08 [GRISHA] 🔍 Перевіряю: "Ввести 333 в калькулятор"
00:03:09 [GRISHA] Перевіряю докази
00:03:10 [GRISHA] 🔧 Executing screencapture -x /tmp/verify_calc.png
00:03:11 [GRISHA] ✅ Перевірено: "Ввести 333 в калькулятор"
         Підтвердження: Screenshot підтверджує що 333 введено в калькулятор
         
✅ Grisha РОБИТЬ screenshot
✅ Grisha ПЕРЕВІРЯЄ візуально
✅ Завдання підтверджуються з доказами
```

### Test Command
```bash
# Restart orchestrator
./restart_system.sh restart

# Test calculator request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Відкрий калькулятор і перемнож 333 на 2, результат запиши в файл УРА на робочому столі"}'

# Monitor logs for Grisha's verification
tail -f logs/orchestrator.log | grep -E "(Grisha|GRISHA|🔍|screenshot)"
```

## Benefits

### 1. Візуальна верифікація
- Гріша робить screenshot кожного кроку
- Підтверджує виконання через візуальні докази
- Працює навіть з багатьма екранами

### 2. Докази виконання
- Кожна перевірка має конкретні докази (screenshot, file content, etc)
- `verification.evidence` містить результати MCP інструментів
- Можна відстежити ЩО саме Гріша перевірив

### 3. Правильні повідомлення
- Тетяна: виконання завдань
- Гріша: перевірка та підтвердження
- Atlas: коригування стратегії
- TTS працює з правильними голосами

### 4. Підвищена надійність
- Менше false negatives (завдання виконано, але не підтверджено)
- Більше true positives (завдання виконано І підтверджено)
- Краща діагностика помилок

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TODO Item Execution                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2.1: Tetyana Plans Tools                             │
│  - Determines which MCP tools to use                        │
│  - Returns: {tool_calls: [...], reasoning: "..."}           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2.2: Tetyana Executes Tools                          │
│  - Runs MCP tools (applescript, filesystem, etc)            │
│  - Returns: {results: [...], all_successful: true/false}    │
│  - Chat: "[TETYANA] ✅ Виконано"                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2.3: Grisha Verifies (NEW 3-STEP PROCESS)           │
│                                                              │
│  Step 1: Plan Verification Tools                            │
│  - Grisha decides which tools to use (screenshot mandatory) │
│  - Returns: {tool_calls: [...], tts_phrase: "..."}          │
│  - Chat: "[GRISHA] 🔍 Перевіряю"                            │
│                                                              │
│  Step 2: Execute Verification Tools                         │
│  - Grisha runs MCP tools (screencapture, read_file, etc)    │
│  - Returns: {results: [...], all_successful: true/false}    │
│  - Chat: "[GRISHA] Перевіряю докази"                        │
│                                                              │
│  Step 3: Analyze Evidence                                   │
│  - Grisha analyzes Tetyana's + own results                  │
│  - Returns: {verified: true/false, reason: "...", evidence} │
│  - Chat: "[GRISHA] ✅ Перевірено" or "⚠️ Не підтверджено"  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────┴─────────┐
                    │                   │
                verified=true      verified=false
                    │                   │
                    ▼                   ▼
            ✅ Item Complete    🔄 Atlas Adjusts TODO
```

## Success Criteria

- [x] Grisha plans verification tools (screenshot mandatory)
- [x] Grisha executes verification tools
- [x] Grisha analyzes evidence and makes decision
- [x] Chat messages show agent names (Tetyana/Grisha)
- [x] TTS receives agent names for voice selection
- [ ] Calculator test completes with 100% verification rate
- [ ] Screenshots are created in /tmp/ directory
- [ ] Verification evidence includes screenshot results

## Restart Required

⚠️ **YES** - Major architectural changes require restart:
```bash
./restart_system.sh restart
```

## Monitoring

Watch for these patterns in logs:

**Good signs:**
```
🔍 Grisha planning verification tools
📋 Grisha planned 1 verification tools
🔧 Grisha executing verification tools
✅ Grisha tool run_shell_command succeeded
🧠 Grisha analyzing verification evidence
✅ VERIFIED
```

**Warning signs:**
```
⚠️ Grisha tool failed
❌ NOT VERIFIED
Verification tool planning failed
```

## Notes

- Screenshot є обов'язковим для кожної перевірки
- Гріша використовує ті ж MCP інструменти що і Тетяна
- Температура для Гріші нижча (0.2-0.3) для точності
- Truncation застосовується до всіх результатів (300 chars)
- Rate limiting працює для всіх API викликів Гріші
