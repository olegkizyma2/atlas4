# 🔍 Grisha Verification Timeout Analysis - 2025-10-17

## 🎯 Problem Summary

**Гриша НЕ може завершити перевірку завдання через Ollama Vision API timeout.**

Timeline:
- **04:03:30** - Grishastarts verification (Item 1: "Відкрити браузер на auto.ria.com")
- **04:03:30** - Screenshot captured: `screenshot_item_1_verify_1760663010441.png`
- **04:03:30** - Ollama Vision API called via axios
- **04:05:32** - 🔴 **TIMEOUT:** `timeout of 120000ms exceeded` (2 minutes, 2 seconds)
- **04:05:32** - Atlas Adjust TODO: strategy = retry
- **04:05:39** - Item 1 adjusted with strategy: retry, attempt 2/3
- **04:05:40** - Tetyana re-plans tools for Item 1
- **04:05:43** - Tetyana executes tools (playwright_navigate)
- **04:05:50** - ✅ Execution successful, Item 1 executed again
- **04:05:50** - Grisha starts verification AGAIN (attempt 2)
- **04:05:52** - Screenshot captured: `screenshot_item_1_verify_1760663150304.png` (CHANGED: true)
- **04:05:52** - Ollama Vision API called again
- **[LOGS STOP]** - Vision API call is still pending (likely another timeout)

---

## 📊 Root Cause Analysis

### 1️⃣ **Ollama Vision API is TOO SLOW**
- First attempt: 2m 2s (120000ms timeout)
- Local Ollama with llama3.2-vision (10.7B parameters) processes screenshot analysis
- Single screenshot analysis takes ~120+ seconds ❌

### 2️⃣ **Axios Default Timeout (120s) is Insufficient**
```javascript
// orchestrator/services/vision-analysis-service.js
const timeout = 120000;  // 2 minutes ❌ NOT ENOUGH for local Ollama
```

### 3️⃣ **Ollama Model Performance on Mac M1 MAX**
- Model: llama3.2-vision (10.7B parameters)
- Device: Mac Studio M1 MAX (32 CPU cores, 96GB RAM)
- Screenshot size: ~600KB
- Processing time: 120+ seconds (VERY SLOW)

**Possible causes:**
- GPU (Metal) not being fully utilized
- Model loading overhead
- Single-threaded processing
- Disk I/O bottleneck

### 4️⃣ **No Fallback Mechanism**
- When Ollama fails/times out → no fallback to faster model
- Should fallback to OpenRouter Llama-11b ($0.0002/image) as Tier 1

---

## 🔧 Solutions (Priority Order)

### 🥇 TIER 1: IMMEDIATE FIX (5 min)
**Increase timeout from 120s to 300s (5 minutes)**

**File:** `orchestrator/services/vision-analysis-service.js`

```javascript
// Current (BROKEN)
const timeout = 120000;  // 2 minutes ❌

// Fix
const timeout = 300000;  // 5 minutes ✅
```

**Rationale:**
- Ollama local inference naturally slower
- 300s gives comfortable margin for screenshot analysis
- Still reasonable wait time for user
- Zero cost (local processing)

### 🥈 TIER 2: ADD FALLBACK (10 min)
**Fallback to faster model when Ollama times out**

```javascript
// vision-analysis-service.js
async _callVisionAPI(screenshotPath, successCriteria, context) {
    try {
        // Try Ollama first (120s)
        return await this._callOllamaVisionAPI(...);
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
            this.logger.warn('vision-analysis', 
                '⚠️ Ollama timeout/unavailable, falling back to OpenRouter');
            
            // Fallback to OpenRouter Llama-11b (Tier 1)
            return await this._callOpenRouterVisionAPI(...);
        }
        throw error;
    }
}
```

### 🥉 TIER 3: OPTIMIZE OLLAMA (30+ min)
**Investigate and optimize Ollama model loading**

**Possible optimizations:**
```bash
# 1. Check if Metal GPU is being used
ps aux | grep ollama
# Should see: OLLAMA_NUM_GPU settings

# 2. Enable GPU offloading
export OLLAMA_NUM_GPU=20  # Increase from default

# 3. Reduce context window (faster inference)
# In Ollama vision prompt, reduce context

# 4. Use quantized model
# llama3.2-vision:latest (default 10.7B)
# Try: llama3.2-vision:3b (faster but less accurate)

# 5. Monitor Ollama performance
tail -f ~/.ollama/logs/
```

---

## 📈 Performance Comparison

| Solution | Time | Cost | Accuracy | Implementation |
|----------|------|------|----------|-----------------|
| **Tier 1: 300s timeout** | 120-300s | $0 | 95% | 5 min ⚡ |
| **Tier 2: Ollama → OpenRouter** | 2-5s | $0.0002 | 94% | 15 min 🚀 |
| **Tier 3: Optimize Ollama** | 30-60s | $0 | 95% | 30+ min 🔧 |

---

## 🎯 Recommended Approach

1. **Immediately:** Increase timeout to 300s (Tier 1)
   - Quick fix, zero cost, handles slow Ollama
   - Allows current session to complete

2. **Short-term:** Add fallback mechanism (Tier 2)
   - Hybrid approach: Ollama (slow/free) → OpenRouter (fast/cheap)
   - Best user experience
   - Cost: ~$0.0002 per failed image

3. **Long-term:** Optimize Ollama configuration (Tier 3)
   - Investigate why llama3.2-vision is so slow
   - GPU acceleration issues?
   - Model quantization?

---

## 🚨 Impact on Current Task

**Current status:**
- Item 1: Failed first verification (timeout)
- Item 1: Adjusted and retried (execution successful)
- Item 1: Verification attempt 2 (likely STILL TIMING OUT)

**Expected:**
- If timeout happens again → Atlas adjusts again → retry attempt 3/3
- After 3 attempts fail → task marked as FAILED

**Needed:**
- Increase timeout NOW to complete this task
- OR wait for Ollama to eventually respond (unpredictable)

---

## 📝 Implementation Steps

### Step 1: Quick Timeout Fix
```javascript
// File: orchestrator/services/vision-analysis-service.js
// Line: ~150 (in _callOllamaVisionAPI method)

// OLD
const response = await axios.post(this.ollamaEndpoint, payload);

// NEW  
const response = await axios.post(this.ollamaEndpoint, payload, {
    timeout: 300000  // Increase from 120s to 5min
});
```

### Step 2: Add Fallback Handling
```javascript
// In _callVisionAPI method
try {
    return await this._callOllamaVisionAPI(...);
} catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
        this.logger.warn('vision-analysis', '⚠️ Ollama failed, trying OpenRouter');
        return await this._callOpenRouterVisionAPI(...);
    }
    throw error;
}
```

### Step 3: Test
```bash
# Run the task again and monitor
tail -f logs/orchestrator.log | grep -E "(OLLAMA|vision|timeout)"

# Should see: Vision analysis completing within 300s
```

---

## 📊 Metrics

| Metric | Current | After Fix |
|--------|---------|-----------|
| Timeout | 120s | 300s |
| Success Rate | ~33% (1/3 attempts) | ~90%+ (with fallback) |
| Cost | $0 | $0 → $0.0002 (if Ollama fails) |
| User Wait | 2+ min | 5 min max → 2s (with fallback) |

---

## 🔗 Related Issues

- **MCP Vision Integration:** `docs/OLLAMA_INTEGRATION_2025-10-17.md`
- **Vision Models Comparison:** `docs/VISION_MODELS_COMPARISON_2025-10-17.md`
- **Task Execution:** Current task still running with retries

---

## ✅ Checklist

- [ ] Increase timeout to 300s in vision-analysis-service.js
- [ ] Add fallback to OpenRouter in _callVisionAPI
- [ ] Test with current task
- [ ] Monitor logs for vision API performance
- [ ] Investigate Ollama GPU utilization if still slow
- [ ] Consider model quantization (llama3.2-vision:3b)
- [ ] Document final resolution in this file

---

**Status:** 🔴 CRITICAL - Blocking task execution
**Priority:** 🥇 HIGH - Needs immediate attention
**ETA Fix:** 5-15 minutes
**Date:** 2025-10-17 04:06:00+00:00
