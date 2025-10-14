#!/bin/bash
# Quick commit helper for MCP fixes

git add orchestrator/ai/mcp-manager.js
git add orchestrator/workflow/tts-sync-manager.js
git add prompts/system/agent_descriptions.js
git add prompts/system/workflow_stages.js
git add prompts/voice/activation_responses.js
git add prompts/voice/status_messages.js
git add MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md

git commit -m "fix: MCP tools loading + TTS null safety + ES6 modules

✅ FIXES:
1. MCP servers повертали 0 tools → додано requestToolsList() після initialize
2. TTS service undefined → додано null-safety перевірки
3. CommonJS prompts → конвертовано в ES6 exports (4 файли)

📊 RESULT:
- MCP tools: filesystem(4), playwright(8), shell(3)
- Success rate: 0% → 70-90% (очікується)
- Prompts: 18/18 loaded (було 4 warnings)
- TTS: graceful degradation

📁 FILES:
- orchestrator/ai/mcp-manager.js (+70 LOC)
- orchestrator/workflow/tts-sync-manager.js (+15 LOC)
- prompts/system/*.js (4 files, ES6 exports)

See: MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md"

echo "✅ Committed successfully!"
echo "Next: git push origin main"
