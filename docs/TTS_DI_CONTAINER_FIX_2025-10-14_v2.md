# 🔊 TTS DI Container Fix - Complete v2 Implementation

**ДАТА:** 14 жовтня 2025 - Ніч ~23:30  
**ВЕРСІЯ:** v2 (DI Container Fix)  
**СТАТУС:** ✅ COMPLETE - Ready for Testing  
**ПОПЕРЕДНЯ ВЕРСІЯ:** v1 (WebSocket delivery) - Incomplete due to DI issue

---

## 🎯 Executive Summary

### Версія історії виправлень:

**v1 (23:00):**
- ✅ Implemented WebSocket TTS delivery in TTSSyncManager.speak()
- ✅ Added agent voice parameters (atlas/tetyana/grisha)
- ❌ FAILED: DI Container didn't inject wsManager → TTS skipped

**v2 (23:30 - THIS FIX):**
- ✅ Fixed DI Container to inject wsManager into TTSSyncManager
- ✅ Changed TTSSyncManager to use `this.wsManager` instead of parameter
- ✅ Removed wsManager passing from MCPTodoManager._safeTTSSpeak
- ✅ Complete end-to-end TTS delivery pipeline

---

## 📊 Problem Discovery Timeline

### Step 1: Initial Test (v1 fix applied)

**User дія:**
```bash
./restart_system.sh restart
# Sent test message: "на робочому столі створи файл test.txt"
# Provided logs from local Mac
```

**Очікуваний результат:**
```
[TTS-SYNC] 🔊 Sending TTS to frontend: "План створено..." (agent: atlas)
[TTS-SYNC] ✅ TTS sent successfully
```

**Реальний результат:**
```bash
[2025-10-14T...] [SYSTEM] [startup] [TTS-SYNC] ⚠️ TTS service not provided - all TTS calls will be skipped
# ... workflow executes ...
# ❌ ZERO TTS logs - no "🔊 Sending TTS" messages
# ❌ NO audio played
```

### Step 2: Log Analysis

**Critical Warning Found:**
```javascript
// orchestrator.log line 6
[SYSTEM] [startup] [TTS-SYNC] ⚠️ TTS service not provided - all TTS calls will be skipped
```

**Conclusion:**
- TTSSyncManager initialized WITHOUT wsManager
- Constructor received `ttsService: null`
- DI Container NOT injecting wsManager

---

## 🔍 Root Cause Analysis

### DI Container Configuration Error

**File:** `orchestrator/core/service-registry.js`

**BEFORE (v1 - BROKEN):**
```javascript
// Line 184-199
container.singleton('ttsSyncManager', (c) => {
    return new TTSSyncManager({
        ttsService: null,  // ❌ NO wsManager injection!
        logger: c.resolve('logger')
    });
}, {
    dependencies: ['logger'],  // ❌ Missing 'wsManager' in dependencies
    metadata: { 
        category: 'workflow', 
        priority: 60 
    },
    lifecycle: {
        onInit: async function() {
            this.logger.system('startup', '[TTS-SYNC] TTSSyncManager initialized');
            // ❌ Message misleading - initialized WITHOUT wsManager!
        }
    }
});
```

**Why it failed:**
1. `ttsService: null` → Constructor received no WebSocket Manager
2. `dependencies: ['logger']` → DI Container didn't know to inject wsManager
3. Constructor: `this.wsManager = ttsService` → `this.wsManager = null`
4. `speak()` method: `if (this.wsManager)` → FALSE → TTS skipped

---

## ✅ Solution Implementation

### Fix #1: DI Container Registration

**File:** `orchestrator/core/service-registry.js` (Lines 184-199)

**AFTER (v2 - FIXED):**
```javascript
container.singleton('ttsSyncManager', (c) => {
    return new TTSSyncManager({
        ttsService: c.resolve('wsManager'),  // ✅ Inject wsManager!
        logger: c.resolve('logger')
    });
}, {
    dependencies: ['wsManager', 'logger'],  // ✅ Declare wsManager dependency
    metadata: { 
        category: 'workflow', 
        priority: 60 
    },
    lifecycle: {
        onInit: async function() {
            this.logger.system('startup', '[TTS-SYNC] TTSSyncManager initialized with WebSocket TTS');
            // ✅ Accurate message
        }
    }
});
```

**Changes:**
- ✅ `ttsService: c.resolve('wsManager')` - Inject wsManager from DI Container
- ✅ `dependencies: ['wsManager', 'logger']` - Declare dependency explicitly
- ✅ Updated lifecycle log message for clarity

---

### Fix #2: TTSSyncManager Constructor

**File:** `orchestrator/workflow/tts-sync-manager.js` (Lines 1-80)

**BEFORE:**
```javascript
constructor({ ttsService = null, logger }) {
    this.logger = logger;
    this.ttsService = ttsService;  // Generic name
    
    if (!this.ttsService) {
        this.logger.warning('tts-sync', '[TTS-SYNC] ⚠️ TTS service not provided - all TTS calls will be skipped');
    }
}
```

**AFTER:**
```javascript
constructor({ ttsService = null, logger }) {
    this.logger = logger;
    // Rename ttsService → wsManager for semantic clarity
    // ttsService parameter name kept for DI Container compatibility
    this.wsManager = ttsService;
    
    if (!this.wsManager) {
        this.logger.warning('tts-sync', '[TTS-SYNC] ⚠️ TTS service not provided - all TTS calls will be skipped');
    } else {
        this.logger.system('tts-sync', '[TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery');
    }
}
```

**Changes:**
- ✅ `this.wsManager = ttsService` - Rename for semantic clarity (it's WebSocket Manager)
- ✅ Added success log when wsManager connected
- ✅ Parameter name `ttsService` kept for backward compatibility with DI Container

**Why rename?**
- `ttsService` too generic - could be confused with actual TTS engine
- `wsManager` semantically correct - it's the WebSocket Manager for frontend delivery
- Internal renaming doesn't break DI Container (parameter name unchanged)

---

### Fix #3: speak() Method - Use this.wsManager

**File:** `orchestrator/workflow/tts-sync-manager.js` (Lines 86-170)

**BEFORE:**
```javascript
async speak(phrase, options = {}) {
    const {
        mode = 'normal',
        duration,
        priority,
        skipIfBusy = false,
        wsManager = null,  // ❌ Takes as parameter instead of using this.wsManager
        agent = 'tetyana'
    } = options;
    
    // ...validation...
    
    if (wsManager) {  // ❌ Checks parameter, not this.wsManager
        wsManager.broadcastToSubscribers('chat', 'agent_message', {
            // ...TTS data...
        });
    }
}
```

**AFTER:**
```javascript
async speak(phrase, options = {}) {
    const {
        mode = 'normal',
        duration,
        priority,
        skipIfBusy = false,
        // ✅ Removed wsManager from options - use this.wsManager instead
        agent = 'tetyana'
    } = options;
    
    // ...validation...
    
    if (this.wsManager) {  // ✅ Use internal wsManager from DI Container
        this.logger.system('tts-sync', `[TTS-SYNC] 🔊 Sending TTS to frontend: "${phrase}" (agent: ${agent}, mode: ${validMode})`);
        this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
            content: phrase,
            agent: agent,
            ttsContent: phrase,
            mode: validMode,
            messageId: `tts_${Date.now()}`
        });
        
        // Simulate delay for synchronization
        const estimatedDuration = Math.min(phrase.length * 50, finalDuration);
        await new Promise(resolve => setTimeout(resolve, estimatedDuration));
        
        this.logger.system('tts-sync', `[TTS-SYNC] ✅ TTS sent successfully (estimated: ${estimatedDuration}ms)`);
        return Promise.resolve();
    }
    
    // Fallback to queue if wsManager not available
}
```

**Changes:**
- ✅ Removed `wsManager = null` from options destructuring
- ✅ Changed `if (wsManager)` → `if (this.wsManager)`
- ✅ Changed `wsManager.broadcast...` → `this.wsManager.broadcast...`
- ✅ Now uses DI-injected wsManager instead of parameter

---

### Fix #4: Remove wsManager from _safeTTSSpeak

**File:** `orchestrator/workflow/mcp-todo-manager.js` (Lines 1370-1385)

**BEFORE:**
```javascript
async _safeTTSSpeak(phrase, options = {}) {
    // FIXED 14.10.2025 NIGHT - Always pass wsManager to TTS for frontend delivery
    const ttsOptions = {
        ...options,
        wsManager: this.wsManager,  // ❌ Unnecessary - TTSSyncManager has it internally
        agent: options.agent || 'tetyana'
    };
    
    if (this.tts && typeof this.tts.speak === 'function') {
        await this.tts.speak(phrase, ttsOptions);
    }
}
```

**AFTER:**
```javascript
async _safeTTSSpeak(phrase, options = {}) {
    // FIXED 14.10.2025 NIGHT v2 - TTSSyncManager has wsManager internally now
    const ttsOptions = {
        ...options,
        // ✅ No need to pass wsManager - TTSSyncManager has it from DI Container
        agent: options.agent || 'tetyana'
    };
    
    if (this.tts && typeof this.tts.speak === 'function') {
        this.logger.system('mcp-todo', `[TODO] 🔊 Requesting TTS: "${phrase}" (agent: ${ttsOptions.agent})`);
        await this.tts.speak(phrase, ttsOptions);
    }
}
```

**Changes:**
- ✅ Removed `wsManager: this.wsManager` from ttsOptions
- ✅ TTSSyncManager now gets wsManager from DI Container, not from parameters
- ✅ Simplified parameter passing

---

## 🔄 Complete TTS Flow (v2)

### Initialization (DI Container):
```
orchestrator startup
    ↓
DI Container.initialize()
    ↓
Resolve 'wsManager' (priority 60)
    ↓
Resolve 'ttsSyncManager' (priority 60)
    ↓ dependencies: ['wsManager', 'logger']
    ↓
new TTSSyncManager({
    ttsService: wsManager,  // ✅ Injected!
    logger: logger
})
    ↓
this.wsManager = ttsService  // ✅ wsManager stored
    ↓
Log: "[TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery"
```

### Runtime (TTS Call):
```
MCPTodoManager.createTodo()
    ↓
_safeTTSSpeak("План створено з 5 пунктів", { agent: 'atlas', mode: 'detailed' })
    ↓
TTSSyncManager.speak(phrase, { agent: 'atlas', mode: 'detailed' })
    ↓
if (this.wsManager)  // ✅ TRUE (from DI Container)
    ↓
this.wsManager.broadcastToSubscribers('chat', 'agent_message', {
    content: "План створено з 5 пунктів",
    agent: 'atlas',
    ttsContent: "План створено з 5 пунктів",
    mode: 'detailed',
    messageId: 'tts_1728933456789'
})
    ↓
WebSocket → Frontend TTS Manager
    ↓
🔊 AUDIO PLAYED with Atlas voice
```

---

## 📝 Testing Instructions

### 1. Restart System

```bash
cd /workspaces/atlas4
./restart_system.sh restart
```

### 2. Check Logs for Success Messages

**Expected in orchestrator.log:**
```
[SYSTEM] [startup] [TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery
```

**NOT expected:**
```
[SYSTEM] [startup] [TTS-SYNC] ⚠️ TTS service not provided  # ❌ Should NOT appear
```

### 3. Send Test Message

```bash
# Via curl
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "на робочому столі створи файл test.txt", "sessionId": "test-tts-v2"}'
```

**Or via web interface:**
```
Open http://localhost:5001
Send: "на робочому столі створи файл test.txt"
```

### 4. Expected Logs (orchestrator.log)

```bash
# Stage 1: TODO Creation (Atlas)
[TODO] 📋 Creating TODO for request...
[TODO] 🔊 Requesting TTS: "План створено з 3 пунктів" (agent: atlas)
[TTS-SYNC] 🔊 Sending TTS to frontend: "План створено з 3 пунктів" (agent: atlas, mode: detailed)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 1500ms)

# Stage 2.1: Tool Planning (Tetyana)
[TODO] 🔊 Requesting TTS: "Планую виконання пункту 1" (agent: tetyana)
[TTS-SYNC] 🔊 Sending TTS to frontend: "Планую виконання пункту 1" (agent: tetyana, mode: quick)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 800ms)

# Stage 2.2: Tool Execution (Tetyana)
[TODO] 🔊 Requesting TTS: "Виконую пункт 1" (agent: tetyana)
[TTS-SYNC] 🔊 Sending TTS to frontend: "Виконую пункт 1" (agent: tetyana, mode: normal)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 600ms)

# Stage 2.3: Verification (Grisha)
[TODO] 🔊 Requesting TTS: "Перевіряю результат" (agent: grisha)
[TTS-SYNC] 🔊 Sending TTS to frontend: "Перевіряю результат" (agent: grisha, mode: normal)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 700ms)

# Final Summary (Atlas)
[TODO] 🔊 Requesting TTS: "Завдання виконано. Успішність: 100%" (agent: atlas)
[TTS-SYNC] 🔊 Sending TTS to frontend: "Завдання виконано..." (agent: atlas, mode: detailed)
[TTS-SYNC] ✅ TTS sent successfully (estimated: 1800ms)
```

### 5. Expected Frontend Behavior

**Browser Console:**
```javascript
[TTS Manager] Received agent_message: "План створено з 3 пунктів" (agent: atlas)
[TTS Manager] Playing TTS with voice: atlas
🔊 Audio playing...
[TTS Manager] TTS playback complete
```

**User Experience:**
- ✅ Atlas announces plan with authoritative voice
- ✅ Tetyana voices execution with energetic tone
- ✅ Grisha confirms verification with precise voice
- ✅ All TTS synchronized with workflow stages

---

## 🔍 Debugging Guide

### Issue: "TTS service not provided" warning still appears

**Check:**
```bash
grep "TTS service not provided" logs/orchestrator.log
```

**If warning appears:**
1. Verify service-registry.js has `dependencies: ['wsManager', 'logger']`
2. Verify `ttsService: c.resolve('wsManager')` in registration
3. Check wsManager initialized before ttsSyncManager (priority <= 60)

### Issue: No TTS logs in orchestrator

**Check:**
```bash
grep "Requesting TTS" logs/orchestrator.log
```

**If missing:**
1. MCPTodoManager not calling _safeTTSSpeak
2. TTSSyncManager.speak() not being invoked
3. Check MCPTodoManager has `this.tts` reference

**If "Requesting TTS" appears but no "Sending TTS":**
1. `this.wsManager` is null in TTSSyncManager
2. DI Container injection failed
3. Check DI Container initialization order

### Issue: TTS logs present but no audio

**Check:**
```bash
grep "TTS sent successfully" logs/orchestrator.log
```

**If "TTS sent successfully" appears:**
- ✅ Backend working correctly
- ❌ Frontend TTS Manager not receiving events
- Check WebSocket connection: `grep "WebSocket" logs/orchestrator.log`
- Check frontend TTS Manager event subscription

---

## 📋 Summary

### Changes Made (v2):

1. **service-registry.js:**
   - Added `wsManager` to ttsSyncManager dependencies
   - Injected `c.resolve('wsManager')` as ttsService parameter
   - Updated lifecycle log message

2. **tts-sync-manager.js:**
   - Constructor: Renamed `this.ttsService` → `this.wsManager` for clarity
   - Constructor: Added success log when wsManager connected
   - speak(): Removed `wsManager` from options parameter
   - speak(): Changed `if (wsManager)` → `if (this.wsManager)`
   - speak(): Changed `wsManager.broadcast...` → `this.wsManager.broadcast...`

3. **mcp-todo-manager.js:**
   - _safeTTSSpeak(): Removed `wsManager: this.wsManager` from ttsOptions
   - Simplified parameter passing (TTSSyncManager has wsManager internally)

### Result:

✅ **TTS Delivery Pipeline:**
```
DI Container → wsManager injected → TTSSyncManager.speak() → 
WebSocket.broadcast → Frontend TTS Manager → Audio Playback
```

✅ **Agent Voice Differentiation:**
- Atlas: Authoritative, detailed announcements
- Tetyana: Energetic, businesslike execution
- Grisha: Restrained, precise verification

✅ **Synchronization:**
- TTS delay estimation based on phrase length (50ms/char)
- Prevents TTS overlap between agents
- Maintains workflow stage timing

---

**СТАТУС:** ✅ READY FOR TESTING
**ОЧІКУВАНИЙ РЕЗУЛЬТАТ:** Всі 3 агенти озвучують свої дії через frontend TTS
**ТЕСТУВАННЯ:** User запускає на Mac та надає логи

---

**NEXT:** Await user test results and iterate if needed
