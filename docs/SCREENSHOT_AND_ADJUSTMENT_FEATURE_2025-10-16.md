# Screenshot and Adjustment Feature - Tetyana Stage 2.1.5

**Дата:** 16 жовтня 2025  
**Версія:** 4.2.0  
**Автор:** Tetyana AI Agent

## 📋 Огляд

Додано новий крок у MCP Dynamic TODO Workflow: **Stage 2.1.5 - Screenshot and Adjustment**. Тепер перед виконанням кожного завдання Тетяна:

1. 📸 **Робить скріншот** поточного стану системи
2. 🔍 **Аналізує ситуацію** - чи відповідає реальність плану
3. 🔧 **Коригує план якщо потрібно** - або залишає як є

## 🎯 Мета

**Проблема:** Tetyana планувала дії "всліпу", не знаючи реального стану системи. Це призводило до:
- Відкриття вже відкритих програм
- Виконання зайвих кроків
- Помилок через неочікуваний стан UI

**Рішення:** Перед виконанням завжди робити скріншот та адаптувати план до реальності.

## 🔄 Workflow (оновлений)

```
Stage 2.0: Server Selection (system)
  ↓
Stage 2.1: Plan Tools (Tetyana) - планування tools
  ↓
🆕 Stage 2.1.5: Screenshot and Adjust (Tetyana) - скрін + корекція
  ↓
Stage 2.2: Execute Tools (Tetyana) - виконання (potentially adjusted plan)
  ↓
Stage 2.3: Verify Item (Grisha) - перевірка
```

## 📄 Файли

### 1. Новий промпт
**Файл:** `prompts/mcp/tetyana_screenshot_and_adjust.js`

**Структура:**
- `SYSTEM_PROMPT` - інструкції для LLM (JSON-only API)
- `USER_PROMPT` - шаблон з placeholder'ами
- Metadata (version, stage, agent, etc.)

**Ключові правила промпту:**
- ✅ Завжди робити скріншот (playwright або shell)
- ✅ Аналізувати що видно на екрані
- ✅ Вирішувати чи потрібна корекція
- ✅ Повертати ТІЛЬКИ чистий JSON (no markdown, no explanations)

**Коли корекція ПОТРІБНА:**
- 🔴 Програма вже відкрита (пропустити "відкрити")
- 🔴 Елементи UI інші ніж очікувалось
- 🔴 Потрібні додаткові кроки (діалоги)
- 🔴 Деякі кроки вже виконані

**Коли корекція НЕ ПОТРІБНА:**
- ✅ План точний і виконуваний
- ✅ Скріншот показує очікуваний стан
- ✅ Немає перешкод

### 2. Оновлено індекс промптів
**Файл:** `prompts/mcp/index.js`

Додано експорт:
```javascript
import tetyanaScreenshotAndAdjust from './tetyana_screenshot_and_adjust.js';

export const MCP_PROMPTS = {
    // ...
    TETYANA_SCREENSHOT_AND_ADJUST: tetyanaScreenshotAndAdjust,
    // ...
};
```

### 3. Оновлено workflow manager
**Файл:** `orchestrator/workflow/mcp-todo-manager.js`

**Додані методи:**
- `screenshotAndAdjust(plan, item)` - головний метод (150 LOC)
- `_takeShellScreenshot(itemId)` - helper для shell screenshot
- `_parseScreenshotAdjustment(response)` - парсинг JSON відповіді

**Логіка:**
```javascript
// 1. Спробувати playwright screenshot (краще - captures window)
if (hasPlaywright) {
    await mcpManager.executeTool('playwright', 'playwright_screenshot', {...});
}
// 2. Fallback на shell (macOS screencapture)
else if (hasShell) {
    await mcpManager.executeTool('shell', 'execute_command', {
        command: 'screencapture -x /tmp/...'
    });
}

// 3. Викликати LLM для аналізу
const adjustment = await LLM.analyze(screenshot, plan, item);

// 4. Повернути adjusted або original plan
return adjustment.needs_adjustment 
    ? adjustment.adjusted_plan 
    : original_plan;
```

**Інтеграція у executeItemWithRetry:**
```javascript
// Stage 2.1: Plan Tools
const plan = await this.planTools(item, todo, {...});

// 🆕 Stage 2.1.5: Screenshot and Adjust
const screenshotResult = await this.screenshotAndAdjust(plan, item);
const finalPlan = screenshotResult.plan;

// Stage 2.2: Execute Tools (using finalPlan)
const execution = await this.executeTools(finalPlan, item);
```

## 🎤 TTS Integration

**TTS фрази:**
- "Скрін готовий" - якщо корекція не потрібна (100ms)
- "Коригую план" - якщо корекція потрібна (200ms)
- Або custom фраза з LLM response

**Агент:** `tetyana` (Тетяна голос)

## 📊 Output Format

```json
{
  "screenshot_taken": true,
  "screenshot_analysis": "Калькулятор вже відкритий",
  "needs_adjustment": true,
  "adjustment_reason": "Програма вже відкрита, пропускаємо крок 1",
  "adjusted_plan": {
    "tool_calls": [
      {
        "server": "shell",
        "tool": "execute_command",
        "parameters": {...},
        "reasoning": "..."
      }
    ],
    "reasoning": "Пропустили зайві кроки"
  },
  "tts_phrase": "Коригую план"
}
```

**Якщо needs_adjustment = false:**
```json
{
  "screenshot_taken": true,
  "screenshot_analysis": "Чистий desktop",
  "needs_adjustment": false,
  "tts_phrase": "Скрін готовий"
}
```

## 🛡️ Error Handling

**Graceful degradation:**
- Screenshot failing → продовжуємо з original plan (не блокуємо task)
- JSON parsing failing → fallback до original plan
- LLM API timeout → використовуємо original plan

**Логування:**
```javascript
this.logger.warn('[MCP-TODO] Screenshot failed, using original plan', {...});
```

**Результат:** Система ЗАВЖДИ продовжує виконання, навіть якщо screenshot крашиться.

## 🧪 Тестування

**Приклад 1: Програма вже відкрита**
```
Task: "Відкрити калькулятор та ввести 5+5"
Screenshot: Калькулятор вже відкритий
Adjustment: Пропустити "відкрити", залишити тільки "ввести 5+5"
```

**Приклад 2: Браузер готовий**
```
Task: "Відкрити браузер → google.com → шукати"
Screenshot: Браузер вже на google.com
Adjustment: Пропустити navigate, одразу fill search
```

**Приклад 3: Чистий стан**
```
Task: "Відкрити VSCode та створити файл"
Screenshot: Чистий desktop, жодних програм
Adjustment: НЕ потрібна, план коректний
```

## 📈 Performance Impact

**Додатковий час:**
- Screenshot: ~100-300ms (playwright) або ~50-100ms (shell)
- LLM аналіз: ~1-2 секунди (temperature=0.2, fast model)
- **Total overhead:** ~1.5-2.5 секунди per item

**Переваги:**
- ✅ Менше failed attempts (швидше overall)
- ✅ Точніше виконання (менше retries)
- ✅ Розумна адаптація до стану системи

**Net impact:** Позитивний - економія часу через менше помилок.

## 🔧 Configuration

**Model:** Використовує ту саму модель що й `plan_tools` stage
```javascript
const modelConfig = MCP_MODEL_CONFIG.getStageConfig('plan_tools');
```

**Temperature:** 0.2 (нижче ніж планування - точніший аналіз)

**Max tokens:** 2000 (достатньо для adjusted_plan)

**Timeout:** 120s (як інші LLM calls)

## 📝 Changelog

**16.10.2025 - v4.2.0**
- ✅ Створено промпт `tetyana_screenshot_and_adjust.js`
- ✅ Додано метод `screenshotAndAdjust()` в mcp-todo-manager
- ✅ Додано helper `_takeShellScreenshot()`
- ✅ Додано parser `_parseScreenshotAdjustment()`
- ✅ Інтегровано у workflow між Stage 2.1 та 2.2
- ✅ Додано TTS feedback
- ✅ Документація створена

## 🎓 Критичні правила

1. ✅ **ЗАВЖДИ робити screenshot** перед виконанням (no exceptions)
2. ✅ **Аналізувати real state** - не планувати всліпу
3. ✅ **Коригувати тільки якщо потрібно** - не вигадувати проблеми
4. ✅ **Graceful fallback** - якщо screenshot failing, продовжуємо з original plan
5. ✅ **JSON-only output** - no markdown, no explanations
6. ✅ **Playwright preferred** - краща якість screenshots ніж shell

## 🚀 Next Steps

**Можливі покращення:**
- [ ] Vision model аналіз (GPT-4V) замість текстового опису
- [ ] Кеш screenshots для швидших retries
- [ ] Automatic UI element detection (CV)
- [ ] Screenshot diff між before/after
- [ ] Metrics: % adjustments, success rate improvement

---

**Статус:** ✅ IMPLEMENTED AND READY  
**Тестування:** Pending user validation  
**Документація:** Complete
