# Mode Selection Quick Reference

**Date:** 16.10.2025  
**Version:** 5.0.0

## What Was Added

**Stage 0-MCP: Mode Selection** - LLM classifier that determines if user request is:
- 💬 **chat** - Simple conversation (future: direct Atlas response)
- 🔧 **task** - Requires MCP tools and multi-agent workflow

## User Experience

### Before
User sends "Відкрий калькулятор" → System starts TODO planning immediately

### After
User sends "Відкрий калькулятор" 
→ System shows: "Режим: 🔧 Завдання (впевненість: 95%)"
→ Then starts TODO planning

## In Chat

All messages now appear with timestamps and agent signatures:

```
13:25:54 [USER] відкрий калькулятора
13:25:55 [SYSTEM] Режим: 🔧 Завдання (впевненість: 95%)
13:25:56 [ATLAS] План з 3 пунктів створено
13:25:58 [ТЕТЯНА] Відкриваю калькулятор...
13:26:00 [ГРИША] ✅ Калькулятор відкрито
```

## TTS Vocalization

Every message is vocalized:
- **Atlas** → mykyta voice
- **Тетяна** → tetiana voice  
- **Гриша** → dmytro voice
- **System** → no voice (text only)

## Classification Patterns

### Chat Mode
- Conversational: "Привіт", "Як справи?"
- Questions: "Що", "Як", "Чому"
- Explanations: "Розкажи", "Поясни"
- Knowledge: "анекдот", "історія"

### Task Mode
- Actions: "Відкрий", "Запусти", "Створи"
- File/app ops: "калькулятор", "браузер", "файл"
- Commands: "Run", "Install", "Execute"

## Files Changed

### New Files (3)
1. `prompts/mcp/stage0_mode_selection.js` - Prompt
2. `orchestrator/workflow/stages/mode-selection-processor.js` - Processor
3. `tests/test-mode-selection-unit.sh` - Tests

### Modified Files (6)
1. `prompts/mcp/index.js` - Export
2. `orchestrator/workflow/stages/index.js` - Export
3. `orchestrator/core/service-registry.js` - DI registration
4. `orchestrator/workflow/executor-v3.js` - Workflow integration
5. `web/static/js/app-refactored.js` - WebSocket handlers
6. `web/static/js/core/websocket-client.js` - 'chat' subscription

## Testing

```bash
# Unit tests
./tests/test-mode-selection-unit.sh

# Manual test
./restart_system.sh start
# Open http://localhost:5001
# Try: "Привіт" (chat) vs "Відкрий калькулятор" (task)
```

## How It Works

```
User Message
    ↓
[Stage 0-MCP] Mode Selection (LLM classifier)
    ↓         ↓
  chat      task
    ↓         ↓
 (Future)  [Stage 1-MCP] TODO Planning
              ↓
           [Stage 2.x] Execution...
```

## WebSocket Message Flow

```
Backend: wsManager.broadcastToSubscribers('chat', 'agent_message', {...})
   ↓
WebSocket Server: broadcasts to all 'chat' subscribers
   ↓
Frontend: webSocket.on('agent-message', ...)
   ↓
ChatManager: handleAgentMessage() → display + TTS
```

## Critical Rules

✅ **ALWAYS** classify mode before TODO planning  
✅ **ALWAYS** send mode message to chat via WebSocket  
✅ **ALWAYS** use agent-specific voices for TTS  
✅ **DEFAULT** to task mode on classification error (safer)  

❌ **DON'T** skip mode selection  
❌ **DON'T** block chat messages  
❌ **DON'T** forget to subscribe to 'chat' channel  

## Common Issues

**Q:** Mode selection message not appearing in chat?  
**A:** Check WebSocket connection and 'chat' subscription

**Q:** TTS not playing?  
**A:** Already integrated in ChatManager.handleAgentMessage()

**Q:** Wrong mode classified?  
**A:** Check patterns in stage0_mode_selection.js, adjust if needed

## See Also

- Full docs: `docs/MODE_SELECTION_STAGE_IMPLEMENTATION.md`
- Copilot instructions: `.github/copilot-instructions.md`
- MCP workflow: `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md`
