# Mode Selection Stage Implementation Guide

**Date:** 16.10.2025  
**Version:** 5.0.0  
**Status:** ✅ Implemented

## Overview

Implemented **Stage 0-MCP: Mode Selection** - a system prompt stage that determines whether a user request requires chat (simple conversation) or task (MCP tools execution) mode at the very beginning of the workflow.

## Problem Statement

The user requested:
1. Restore or create a stage with a system prompt that determines at the beginning if it's just chat or task execution
2. Ensure all agents are displayed in chat (like user messages with timestamps: `13:25:54 [USER] message`)
3. Ensure everything is vocalized by TTS

## Implementation

### 1. Mode Selection Prompt

**File:** `prompts/mcp/stage0_mode_selection.js`

- Binary classifier LLM prompt (chat vs task)
- Ukrainian and English action verb patterns
- Confidence-based classification (≥0.8 threshold)
- Structured JSON output with reasoning
- 1960 characters optimized prompt

**Key Patterns:**
- **Task:** "Відкрий", "Запусти", "Створи", "Open", "Launch", "Create"
- **Chat:** "Розкажи", "Поясни", "Tell me", "Explain"

### 2. Mode Selection Processor

**File:** `orchestrator/workflow/stages/mode-selection-processor.js`

- Stage processor class for DI Container
- Uses LLM API at `localhost:4000` (gpt-4o-mini, T=0.1)
- Fast classification (10s timeout)
- Graceful error handling (defaults to 'task' mode on error)
- JSON parsing with markdown wrapper removal

### 3. Workflow Integration

**File:** `orchestrator/workflow/executor-v3.js`

**Changes:**
- Added Stage 0-MCP before Stage 1-MCP (TODO Planning)
- Resolves `modeSelectionProcessor` from DI Container
- Sends mode selection to frontend via SSE (`mode_selected` event)
- Sends mode message to chat via WebSocket (`agent_message`)
- Placeholder for future chat mode handler

**Flow:**
```
User Message
    ↓
Stage 0-MCP: Mode Selection
    ↓
    ├─ chat mode → (Future: Simple Atlas response)
    └─ task mode → Stage 1-MCP: TODO Planning → ...
```

### 4. Agent Message Display

**Files:** 
- `web/static/js/app-refactored.js`
- `web/static/js/core/websocket-client.js`

**Changes:**
1. Added 'chat' to WebSocket subscriptions
2. Added handlers for `agent-message` and `chat-message` events
3. Connected to ChatManager's `handleAgentMessage()` method

**Message Flow:**
```
Backend (MCPTodoManager)
    ↓ wsManager.broadcastToSubscribers('chat', 'agent_message', {})
WebSocket Server
    ↓ Broadcast to 'chat' subscribers
Frontend WebSocket Client
    ↓ case 'agent_message': emit('agent-message', {})
App WebSocket Handlers
    ↓ webSocket.on('agent-message', () => chat.handleAgentMessage())
ChatManager
    ↓ addMessage(content, agent) + TTS trigger
UI Display
    ↓ Timestamp + [AGENT] + Message
```

### 5. TTS Integration

**Status:** ✅ Already working

TTS is automatically triggered in `ChatManager.handleAgentMessage()`:
- Extracts agent-specific voice (mykyta, tetiana, dmytro)
- Uses full text mode for complete message vocalization
- Removes agent signatures before TTS (e.g., `[ATLAS]`)
- Handles optimization and chunking

## Files Created

1. `prompts/mcp/stage0_mode_selection.js` - Mode selection prompt
2. `orchestrator/workflow/stages/mode-selection-processor.js` - Processor implementation
3. `tests/test-mode-selection-unit.sh` - Unit tests

## Files Modified

1. `prompts/mcp/index.js` - Added MODE_SELECTION export
2. `orchestrator/workflow/stages/index.js` - Added ModeSelectionProcessor export
3. `orchestrator/core/service-registry.js` - Registered modeSelectionProcessor in DI
4. `orchestrator/workflow/executor-v3.js` - Integrated Stage 0-MCP
5. `web/static/js/app-refactored.js` - Added WebSocket message handlers
6. `web/static/js/core/websocket-client.js` - Added 'chat' subscription

## Testing

### Unit Tests

Run: `./tests/test-mode-selection-unit.sh`

Tests:
- ✅ Prompt loading and structure
- ✅ Processor class loading
- ✅ DI Container registration
- ✅ Executor compilation
- ✅ Frontend compilation

### Manual Testing

1. Start system: `./restart_system.sh start`
2. Open: `http://localhost:5001`
3. Test messages:
   - **Chat:** "Привіт" → Should classify as chat mode
   - **Task:** "Відкрий калькулятор" → Should classify as task mode
4. Verify in chat:
   - Mode selection message appears: "Режим: 💬/🔧 (впевненість: X%)"
   - All agent messages show with timestamps: `13:25:54 [ATLAS] message`
   - TTS vocalizes all messages

## Architecture

### Stage 0-MCP Flow

```javascript
// 1. Execute mode selection
const modeResult = await modeProcessor.execute({
  userMessage,
  session
});

// 2. Get mode (chat or task)
const mode = modeResult.mode;
const confidence = modeResult.confidence;

// 3. Send to frontend via SSE
res.write(`data: ${JSON.stringify({
  type: 'mode_selected',
  data: { mode, confidence, reasoning }
})}\n\n`);

// 4. Send to chat via WebSocket
wsManager.broadcastToSubscribers('chat', 'agent_message', {
  content: `Режим: ${mode} (впевненість: ${confidence})`,
  agent: 'system',
  sessionId, timestamp
});

// 5. Route based on mode
if (mode === 'chat') {
  // Future: Simple Atlas response
} else {
  // Continue to Stage 1-MCP: TODO Planning
}
```

### Agent Message Display

```javascript
// Backend sends
wsManager.broadcastToSubscribers('chat', 'agent_message', {
  content: "Повідомлення",
  agent: 'tetyana',  // or 'atlas', 'grisha'
  sessionId,
  timestamp
});

// Frontend receives
webSocket.on('agent-message', (messageEvent) => {
  chat.handleAgentMessage(messageEvent.data);
});

// ChatManager displays
addMessage(content, agent);
// → Renders: 13:25:54 [ТЕТЯНА] Повідомлення

// ChatManager triggers TTS
ttsManager.speak(text, { voice: 'tetiana' });
```

## Configuration

### LLM Model
- **Endpoint:** `http://localhost:4000/v1/chat/completions`
- **Model:** `openai/gpt-4o-mini`
- **Temperature:** 0.1 (deterministic)
- **Max Tokens:** 150
- **Timeout:** 10s

### Agent Voices
- **Atlas:** mykyta (green #00ff00)
- **Tetyana:** tetiana (cyan #00ffff)
- **Grisha:** dmytro (yellow #ffff00)
- **System:** none (gray #888888)

## Future Enhancements

1. **Chat Mode Handler:** Implement simple Atlas response for chat mode (currently falls through to task)
2. **Context-Aware Classification:** Use conversation history for better mode detection
3. **Confidence Threshold Adjustment:** Tune threshold based on production usage
4. **Multi-Language Support:** Add more language patterns beyond Ukrainian/English

## Related Documents

- `.github/copilot-instructions.md` - System architecture
- `docs/AI_BACKEND_MODULAR_SYSTEM.md` - Backend architecture
- `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md` - MCP workflow details

## Summary

✅ **All requirements met:**
1. ✅ System prompt determines chat vs task at the beginning (Stage 0-MCP)
2. ✅ All agents display in chat with timestamps like user messages
3. ✅ Everything vocalized by TTS (already integrated)

**Impact:**
- Better user experience with explicit mode indication
- More accurate task routing
- Consistent agent message display
- Full TTS integration for all messages
