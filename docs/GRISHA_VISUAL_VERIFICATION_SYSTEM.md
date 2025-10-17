# Grisha Visual Verification System

## Дата: 17.10.2025
## Версія: 5.0.0

---

## 📋 Огляд

**Grisha Visual Verification** - повністю переробл система верифікації, що використовує AI vision замість MCP інструментів для підтвердження виконання завдань.

### Ключові зміни:

#### ❌ Видалено (Стара система - MCP Tools):
- MCP tool selection для верифікації
- Залежність від playwright/filesystem/shell MCP servers
- Tool-based evidence collection
- Hardcoded списки доступних tools

#### ✅ Додано (Нова система - Visual AI):
- Continuous screenshot monitoring (VisualCaptureService)
- GPT-4 Vision AI analysis (VisionAnalysisService)
- Visual evidence-based verification
- Stuck state detection через візуальний моніторинг
- Dynamic feedback через візуальний аналіз

---

## 🏗️ Архітектура

### Компоненти системи:

```
┌─────────────────────────────────────────────────┐
│         Grisha Visual Verification              │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. VisualCaptureService                       │
│     ├─ captureScreenshot()                     │
│     ├─ startMonitoring()                       │
│     ├─ stopMonitoring()                        │
│     ├─ compareScreenshots()                    │
│     └─ detectChanges() (MD5 hash)             │
│                                                 │
│  2. VisionAnalysisService                      │
│     ├─ analyzeScreenshot() → GPT-4V           │
│     ├─ compareScreenshots()                    │
│     ├─ detectStuckState()                      │
│     └─ _callVisionAPI() → API                 │
│                                                 │
│  3. GrishaVerifyItemProcessor                  │
│     ├─ execute() - Main workflow              │
│     ├─ detectStuckState()                      │
│     ├─ _determineNextAction()                  │
│     └─ _generateVerificationSummary()          │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Візуальної Верифікації

### 1. Базовий Flow (Per TODO Item):

```javascript
// Grisha отримує завдання для верифікації
const context = {
    currentItem: { 
        id: 1, 
        action: "Відкрити калькулятор",
        success_criteria: "Калькулятор відкрито та активно" 
    },
    execution: { results: [...] }
};

// 1. Захоплення скріншоту
const screenshot = await visualCapture.captureScreenshot('item_1_verify');
// → Зберігає: /tmp/atlas_visual/screenshot_item_1_verify_1729124567890.png

// 2. AI Vision аналіз
const visionAnalysis = await visionAnalysis.analyzeScreenshot(
    screenshot.filepath,
    "Калькулятор відкрито та активно",
    { action: "Відкрити калькулятор", executionResults: [...] }
);

// 3. Результат аналізу
{
    verified: true,
    confidence: 95,
    reason: "Калькулятор чітко видно на скріншоті, програма активна",
    visual_evidence: {
        observed: "Програма Калькулятор відкрита на передньому плані",
        matches_criteria: true,
        details: "Вікно калькулятора займає центр екрану, всі елементи UI видимі"
    }
}

// 4. Рішення
if (visionAnalysis.verified && visionAnalysis.confidence >= 70) {
    return { verified: true, nextAction: 'continue' };
}
```

### 2. Stuck State Detection:

```javascript
// Запуск continuous monitoring
await visualCapture.startMonitoring(); // Screenshot кожні 2 сек

// Після 10+ секунд виконання
const stuckAnalysis = await grishaProcessor.detectStuckState(item, 10000);

// Результат
{
    stuck: true,
    confidence: 85,
    reason: "Процес виконання зависнув - візуальних змін не виявлено",
    visual_evidence: {
        progress_indicators: [],
        stuck_indicators: ["Spinner не обертається", "UI елементи не оновлюються"],
        last_change_detected: "8 секунд тому"
    },
    recommendation: "Перезапустити процес або змінити підхід"
}

// Динамічний feedback до Tetyana
if (stuckAnalysis.stuck) {
    await atlas.adjustTodoItem(item, stuckAnalysis.recommendation);
}
```

---

## 📸 VisualCaptureService

### Призначення:
Continuous screenshot monitoring та change detection

### Методи:

#### `async initialize()`
```javascript
await visualCapture.initialize();
// Створює /tmp/atlas_visual/ директорію
```

#### `async captureScreenshot(context, options)`
```javascript
const screenshot = await visualCapture.captureScreenshot('verify_item_1');
// Returns:
{
    filepath: "/tmp/atlas_visual/screenshot_verify_item_1_1729124567890.png",
    filename: "screenshot_verify_item_1_1729124567890.png",
    timestamp: 1729124567890,
    size: 524288, // bytes
    hash: "5d41402abc4b2a76b9719d911017c592", // MD5
    context: "verify_item_1",
    changed: true // порівняно з попереднім
}
```

#### `async startMonitoring()` / `async stopMonitoring()`
```javascript
// Запуск continuous monitoring (кожні 2 сек)
await visualCapture.startMonitoring();

// Зупинка
await visualCapture.stopMonitoring();
```

#### `getLatestScreenshot()`
```javascript
const latest = visualCapture.getLatestScreenshot();
// Returns: останній screenshot info object
```

#### `getScreenshotsSince(timestamp)`
```javascript
const recent = visualCapture.getScreenshotsSince(Date.now() - 10000);
// Returns: всі screenshots за останні 10 секунд
```

#### `async compareScreenshots(path1, path2)`
```javascript
const comparison = await visualCapture.compareScreenshots(
    '/tmp/atlas_visual/screenshot_1.png',
    '/tmp/atlas_visual/screenshot_2.png'
);
// Returns:
{
    identical: false,
    hash1: "abc123...",
    hash2: "def456...",
    diffBytes: 102400,
    diffPercentage: "19.53",
    significantChange: true // > 5% threshold
}
```

### Конфігурація:

```javascript
const config = {
    captureInterval: 2000,              // Інтервал monitoring (ms)
    screenshotDir: '/tmp/atlas_visual', // Директорія зберігання
    maxStoredScreenshots: 10,           // Максимум screenshots у queue
    changeDetectionThreshold: 0.05,     // 5% change для significant
    platform: 'darwin'                  // macOS (auto-detect)
};
```

### Platform Support:

- **macOS (darwin)**: `screencapture -x "/path/to/file.png"`
- **Linux**: `scrot "/path/to/file.png"` або `import -window root "/path/to/file.png"`

---

## 🤖 VisionAnalysisService

### Призначення:
AI-powered visual analysis через GPT-4 Vision API

### Методи:

#### `async analyzeScreenshot(path, successCriteria, context)`
```javascript
const analysis = await visionAnalysis.analyzeScreenshot(
    '/tmp/atlas_visual/screenshot.png',
    'Калькулятор показує результат 666',
    { action: 'Виконати розрахунок', executionResults: [...] }
);

// Returns:
{
    verified: true,
    confidence: 100,
    reason: "Калькулятор відкритий та показує правильний результат",
    visual_evidence: {
        observed: "Програма Калькулятор активна, на дисплеї '666'",
        matches_criteria: true,
        details: "Число 666 чітко видно на дисплеї калькулятора"
    },
    suggestions: null
}
```

#### `async compareScreenshots(path1, path2, expectedChange)`
```javascript
const comparison = await visionAnalysis.compareScreenshots(
    '/tmp/before.png',
    '/tmp/after.png',
    'Калькулятор має показати результат'
);

// Returns:
{
    changeDetected: true,
    matchesExpectedChange: true,
    confidence: 95,
    differences: ["Дисплей калькулятора змінився з '0' на '666'"],
    visual_evidence: "Результат обчислення відображається правильно",
    explanation: "Зміна відповідає очікуваній - результат з'явився"
}
```

#### `async detectStuckState(screenshotPaths, expectedActivity)`
```javascript
const detection = await visionAnalysis.detectStuckState(
    ['/tmp/shot1.png', '/tmp/shot2.png', '/tmp/shot3.png'],
    'Завантаження веб-сторінки'
);

// Returns:
{
    stuck: true,
    confidence: 90,
    reason: "Індикатор завантаження не змінюється між кадрами",
    visual_evidence: {
        progress_indicators: [],
        stuck_indicators: ["Spinner в одному положенні", "UI заморожений"],
        last_change_detected: "Більше 6 секунд тому"
    },
    recommendation: "Перезавантажити сторінку або перевірити з'єднання"
}
```

### GPT-4 Vision API Integration:

#### Request Format:
```javascript
POST http://localhost:4000/v1/chat/completions
{
    model: "gpt-4-vision-preview",
    messages: [{
        role: "user",
        content: [
            { type: "text", text: "System prompt + user prompt" },
            { 
                type: "image_url", 
                image_url: {
                    url: "data:image/png;base64,iVBORw0KGgoAAAANS...",
                    detail: "high"
                }
            }
        ]
    }],
    max_tokens: 1000,
    temperature: 0.2
}
```

#### Response Parsing:
```javascript
// Handles markdown-wrapped JSON
const content = response.data.choices[0].message.content;

// Cleans: ```json { ... } ``` → { ... }
const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const result = JSON.parse(cleaned);
```

### Конфігурація:

```javascript
const config = {
    visionModel: 'gpt-4-vision-preview',
    apiEndpoint: 'http://localhost:4000/v1/chat/completions',
    maxTokens: 1000,
    temperature: 0.2,           // Низька для точності
    imageDetailLevel: 'high',   // 'low', 'high', 'auto'
    timeout: 60000             // 60 секунд
};
```

---

## 🎯 GrishaVerifyItemProcessor

### Призначення:
Основний процесор візуальної верифікації для TODO items

### Нові методи:

#### `async execute(context)`
```javascript
const result = await grishaProcessor.execute({
    currentItem: { id: 1, action: "...", success_criteria: "..." },
    execution: { results: [...] },
    todo: { items: [...] }
});

// Returns:
{
    success: true,
    verified: true,
    verification: {
        verified: true,
        confidence: 95,
        reason: "...",
        visual_evidence: {...},
        screenshot_path: "/tmp/atlas_visual/...",
        from_visual_analysis: true
    },
    summary: "✅ Візуально підтверджено: ...",
    nextAction: "continue", // 'continue' | 'retry' | 'adjust'
    metadata: {
        itemId: 1,
        verified: true,
        confidence: 95,
        visualEvidence: true,
        verificationMethod: 'visual_ai'
    }
}
```

#### `async detectStuckState(item, durationMs)`
```javascript
const stuck = await grishaProcessor.detectStuckState(item, 10000);
// Автоматично:
// 1. Запускає monitoring якщо не активний
// 2. Збирає screenshots за 10 секунд
// 3. Аналізує через GPT-4 Vision
// 4. Повертає stuck detection result
```

#### `getStatus()`
```javascript
const status = grishaProcessor.getStatus();
// Returns:
{
    initialized: true,
    visualCapture: {
        isMonitoring: false,
        captureInterval: 2000,
        queueSize: 5,
        changeDetected: false
    },
    visionAnalysis: {
        initialized: true,
        visionModel: "gpt-4-vision-preview",
        apiEndpoint: "http://localhost:4000/v1/chat/completions"
    }
}
```

---

## 📝 Grisha Visual Prompt

**Файл:** `prompts/mcp/grisha_visual_verify_item.js`

### Структура промпту:

#### System Prompt:
```javascript
`Ти Гриша - візуальний верифікатор якості виконання.

**ТВОЯ РОЛЬ - ВІЗУАЛЬНИЙ АНАЛІТИК:**
Аналізуй SCREENSHOT для підтвердження виконання завдання.
Використовуй ТІЛЬКИ візуальні докази з зображення.

**КРИТЕРІЇ VERIFIED = TRUE:**
✅ Візуальні елементи успіху ПРИСУТНІ на скріншоті
✅ Success Criteria повністю виконано
✅ Впевненість >= 70%

**КРИТЕРІЇ VERIFIED = FALSE:**
❌ Візуальні елементи успіху ВІДСУТНІ
❌ Success Criteria НЕ виконано
❌ Видно помилки, неправильний стан

[5 детальних прикладів візуальної верифікації]
`
```

#### User Prompt:
```javascript
`**TODO Item:** {{item_action}}
**Success Criteria:** {{success_criteria}}
**Execution Results Summary:** {{execution_results}}

Analyze the screenshot and verify if the task was completed successfully.
Return ONLY raw JSON.`
```

#### Output Format:
```json
{
  "verified": true,
  "confidence": 95,
  "reason": "Калькулятор відкритий та показує правильний результат",
  "visual_evidence": {
    "observed": "Програма Калькулятор активна, на дисплеї '666'",
    "matches_criteria": true,
    "details": "Число 666 чітко видно на дисплеї калькулятора"
  },
  "suggestions": null
}
```

---

## 🧪 Тестування

### Unit Tests:

```bash
# Visual Capture Service
npm test tests/unit/visual-capture-service.test.js

# Vision Analysis Service  
npm test tests/unit/vision-analysis-service.test.js

# Grisha Processor
npm test tests/unit/grisha-verify-item-processor.test.js
```

### Integration Tests:

```bash
# Full visual verification workflow
npm test tests/integration/visual-verification.test.js
```

### Manual Testing:

```javascript
// 1. Запустити orchestrator
node orchestrator/server.js

// 2. Надіслати тестове завдання
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Відкрий калькулятор і виконай розрахунок 22 * 30.27",
    "sessionId": "test_visual"
  }'

// 3. Перевірити screenshots
ls -lh /tmp/atlas_visual/

// 4. Перевірити логи
tail -f logs/orchestrator.log | grep VISUAL-GRISHA
```

---

## 🚨 Troubleshooting

### Problem: Screenshot capture fails

**Symptom:** `Screenshot file is empty` або `screencapture command failed`

**Solution:**
```bash
# macOS: Перевірити дозволи Screen Recording
System Preferences → Security & Privacy → Screen Recording → Enable for Terminal/Node

# Linux: Встановити scrot або imagemagick
sudo apt-get install scrot imagemagick
```

### Problem: GPT-4 Vision API not available

**Symptom:** `Vision API endpoint not available`

**Solution:**
```bash
# Перевірити що API server запущений
curl http://localhost:4000/health

# Перевірити конфігурацію
grep VISION config/global-config.js
```

### Problem: Low confidence scores

**Symptom:** Всі verification results мають confidence < 70%

**Solution:**
1. Перевірити якість screenshots (розмір, чіткість)
2. Переконатись що success criteria чіткі та конкретні
3. Збільшити `imageDetailLevel` до 'high' в config
4. Перевірити що screenshot captured в правильний момент

---

## 📊 Performance Metrics

### Typical Timings:

- **Screenshot Capture**: 50-200ms (macOS screencapture)
- **GPT-4 Vision Analysis**: 2-5 seconds (API call + processing)
- **Total Verification Time**: 2-6 seconds per item

### Resource Usage:

- **Disk Space**: ~500KB per screenshot, max 10 stored = ~5MB
- **Memory**: ~50MB for visual services
- **API Calls**: 1 per verification + optional stuck detection

### Optimization Tips:

1. **Reuse screenshots**: Якщо два items перевіряють той самий стан
2. **Adjust capture interval**: Збільшити до 3-5 сек для less active tasks
3. **Use 'low' detail level**: Для simple UI verification (швидше)
4. **Batch stuck detection**: Перевіряти stuck state тільки після 3+ items failed

---

## 🔄 Migration from MCP Tools

### Before (MCP Tools):
```javascript
// Grisha використовував MCP tools
const verification = await mcpTodoManager.verifyItem(item, execution, {
    toolsSummary: mcpManager.getToolsSummary()
});

// Приклад: filesystem__read_file для перевірки
{
    verified: true,
    reason: "Файл містить правильний текст",
    evidence: { tool: "filesystem__read_file", ... }
}
```

### After (Visual AI):
```javascript
// Grisha використовує AI vision
const verification = await grishaProcessor.execute({
    currentItem: item,
    execution,
    todo
});

// Приклад: GPT-4 Vision аналізує screenshot
{
    verified: true,
    confidence: 95,
    reason: "Файл чітко видно на Desktop",
    visual_evidence: {
        observed: "Іконка файлу 'test.txt' присутня на Desktop",
        matches_criteria: true
    }
}
```

### Migration Checklist:

- [ ] Update `orchestrator/workflow/stages/grisha-verify-item-processor.js`
- [ ] Replace MCP tool calls with visual verification
- [ ] Update prompts to use `grisha_visual_verify_item.js`
- [ ] Register visual services in DI container
- [ ] Test verification accuracy
- [ ] Monitor API costs (GPT-4 Vision)
- [ ] Update documentation

---

## 📚 References

- **GPT-4 Vision API**: https://platform.openai.com/docs/guides/vision
- **macOS screencapture**: `man screencapture`
- **ATLAS Copilot Instructions**: `.github/copilot-instructions.md`

---

## 🎓 Best Practices

### ✅ DO:
- Always capture screenshots at verification time (not reuse old ones)
- Use specific success criteria (not vague descriptions)
- Set confidence threshold appropriate to task criticality
- Log visual evidence for debugging
- Handle API failures gracefully

### ❌ DON'T:
- Don't verify without visual evidence
- Don't use low detail level for complex UI
- Don't trust verification with confidence < 50%
- Don't skip error handling for API calls
- Don't store unlimited screenshots (manage queue size)

---

**Автор:** ATLAS Development Team  
**Версія документу:** 1.0  
**Останнє оновлення:** 17.10.2025
