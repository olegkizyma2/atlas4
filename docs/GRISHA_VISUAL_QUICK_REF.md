# Grisha Visual Verification - Quick Reference

## Дата: 17.10.2025

---

## 🚀 Quick Start

### 1. Базове використання

```javascript
// Grisha automatically uses visual verification
const result = await grishaProcessor.execute({
    currentItem: {
        id: 1,
        action: "Відкрити калькулятор",
        success_criteria: "Калькулятор відкрито та активно"
    },
    execution: { results: [...] }
});

console.log(result.verified); // true/false
console.log(result.verification.confidence); // 0-100
console.log(result.verification.visual_evidence);
```

### 2. Continuous monitoring для stuck detection

```javascript
// Запуск monitoring
await visualCapture.startMonitoring(); // Screenshots кожні 2 сек

// Виконання завдання...
// ...

// Перевірка stuck state
const stuck = await grishaProcessor.detectStuckState(item, 10000);
if (stuck.stuck) {
    console.log('⚠️ Execution stuck:', stuck.recommendation);
}

// Зупинка monitoring
await visualCapture.stopMonitoring();
```

---

## 📸 Screenshot Capture

### One-time screenshot
```javascript
const screenshot = await visualCapture.captureScreenshot('my_context');
// → /tmp/atlas_visual/screenshot_my_context_1729124567890.png
```

### Get latest screenshot
```javascript
const latest = visualCapture.getLatestScreenshot();
console.log(latest.filepath, latest.changed);
```

### Compare screenshots
```javascript
const comparison = await visualCapture.compareScreenshots(path1, path2);
if (comparison.significantChange) {
    console.log('🔄 Significant change detected:', comparison.diffPercentage + '%');
}
```

---

## 🤖 AI Vision Analysis

### Analyze screenshot
```javascript
const analysis = await visionAnalysis.analyzeScreenshot(
    '/path/to/screenshot.png',
    'Success criteria text',
    { action: 'Task action', executionResults: [...] }
);

console.log('Verified:', analysis.verified);
console.log('Confidence:', analysis.confidence + '%');
console.log('Evidence:', analysis.visual_evidence.observed);
```

### Detect stuck state
```javascript
const paths = ['/path/to/shot1.png', '/path/to/shot2.png', '/path/to/shot3.png'];
const stuck = await visionAnalysis.detectStuckState(paths, 'Expected activity');

if (stuck.stuck) {
    console.log('🛑 Stuck:', stuck.reason);
    console.log('💡 Recommendation:', stuck.recommendation);
}
```

---

## ⚙️ Configuration

### Visual Capture Config
```javascript
{
    captureInterval: 2000,              // 2 seconds
    screenshotDir: '/tmp/atlas_visual',
    maxStoredScreenshots: 10,
    changeDetectionThreshold: 0.05      // 5% change
}
```

### Vision Analysis Config
```javascript
{
    visionModel: 'gpt-4-vision-preview',
    apiEndpoint: 'http://localhost:4000/v1/chat/completions',
    temperature: 0.2,
    imageDetailLevel: 'high',           // 'low' | 'high' | 'auto'
    maxTokens: 1000
}
```

---

## 🎯 Verification Result Structure

```javascript
{
    verified: true,                     // Boolean
    confidence: 95,                     // 0-100
    reason: "Калькулятор відкритий...", // String
    visual_evidence: {
        observed: "...",                // Що видно на screenshot
        matches_criteria: true,         // Boolean
        details: "..."                  // Детальний опис
    },
    suggestions: null,                  // String | null
    screenshot_path: "/tmp/...",        // String
    from_visual_analysis: true          // Boolean
}
```

---

## 🚨 Common Issues & Solutions

### Screenshot empty
```bash
# macOS: Enable Screen Recording permissions
System Preferences → Security & Privacy → Screen Recording
```

### API not available
```bash
# Check API server
curl http://localhost:4000/health

# Check logs
tail -f logs/orchestrator.log | grep VISUAL
```

### Low confidence
```javascript
// Increase image detail level
config.imageDetailLevel = 'high';

// Make success criteria more specific
success_criteria: "Calculator app is visible with result 666 on display"
```

---

## 📊 Decision Making

### Verification Threshold
```javascript
const CONFIDENCE_THRESHOLD = 70; // Minimum for verified=true
if (analysis.confidence >= CONFIDENCE_THRESHOLD) {
    return { verified: true };
}
```

### Next Action Logic
```javascript
if (verified) return 'continue';
if (currentAttempt >= maxAttempts) return 'adjust';
if (temporaryFailure) return 'retry';
if (structuralFailure) return 'adjust';
if (confidence < 50) return 'adjust';
return 'adjust'; // Default
```

---

## 🧪 Testing Commands

```bash
# Screenshot capture test
node -e "
const {VisualCaptureService} = require('./orchestrator/services/visual-capture-service.js');
const logger = require('./orchestrator/utils/logger.js');
const service = new VisualCaptureService({logger});
await service.initialize();
const shot = await service.captureScreenshot('test');
console.log(shot);
"

# Vision analysis test (requires screenshot)
node tests/manual/test-vision-analysis.js

# Full workflow test
npm test tests/integration/visual-verification.test.js
```

---

## 📈 Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Screenshot capture | 50-200ms | macOS screencapture |
| Vision AI analysis | 2-5s | GPT-4 Vision API call |
| Total verification | 2-6s | Per TODO item |
| Stuck detection | 5-10s | Multi-screenshot analysis |

---

## 🔗 Related Files

- **Processor**: `orchestrator/workflow/stages/grisha-verify-item-processor.js`
- **Services**: `orchestrator/services/visual-capture-service.js`, `vision-analysis-service.js`
- **Prompt**: `prompts/mcp/grisha_visual_verify_item.js`
- **Config**: Visual config passed via DI container
- **Docs**: `docs/GRISHA_VISUAL_VERIFICATION_SYSTEM.md`

---

## 💡 Tips & Tricks

### Optimize API costs
```javascript
// Use 'low' detail for simple UI
config.imageDetailLevel = 'low'; // Faster, cheaper

// Batch verifications
// - Group similar items
// - Reuse screenshots when possible
```

### Improve accuracy
```javascript
// Be specific in success criteria
❌ "Browser is open"
✅ "Chrome browser showing google.com homepage with search box visible"

// Capture at right moment
await page.waitForLoadState('networkidle'); // Wait for page load
const screenshot = await visualCapture.captureScreenshot('after_load');
```

### Debug verification
```javascript
// Enable detailed logging
process.env.LOG_LEVEL = 'debug';

// Check raw screenshots
ls -lh /tmp/atlas_visual/

// Review vision API responses
tail -f logs/orchestrator.log | grep "\[VISUAL\]"
```

---

**Версія:** 5.0.0  
**Останнє оновлення:** 17.10.2025
