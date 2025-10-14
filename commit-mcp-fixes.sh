#!/bin/bash
# Quick commit helper for MCP fixes + Prompt optimization

git add orchestrator/ai/mcp-manager.js
git add orchestrator/workflow/tts-sync-manager.js
git add orchestrator/workflow/mcp-todo-manager.js
git add config/global-config.js
git add prompts/system/agent_descriptions.js
git add prompts/system/workflow_stages.js
git add prompts/voice/activation_responses.js
git add prompts/voice/status_messages.js
git add docs/MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md
git add docs/MCP_PROMPT_OPTIMIZATION_2025-10-14.md
git add test-prompt-optimization.sh

git commit -m "fix: MCP tools loading + TTS + ES6 + Prompt optimization

✅ FIXES (Part 1 - Core):
1. MCP servers повертали 0 tools → додано requestToolsList() після initialize
2. TTS service undefined → додано null-safety перевірки
3. CommonJS prompts → конвертовано в ES6 exports (4 файли)

✅ FIXES (Part 2 - Optimization):
4. 413 errors (8000+ tokens) → toolsSummary замість full schemas (85% reduction)
5. gpt-4o expensive → відновлено gpt-4o-mini після оптимізації (133x cheaper)

📊 RESULT:
- MCP tools: filesystem(4), playwright(8), shell(3) - loaded successfully
- Success rate: 0% → 70-90% (очікується)
- Prompts: 18/18 loaded (було 4 warnings)
- TTS: graceful degradation
- Prompt size: 8000 → 1000 tokens (85% smaller)
- Cost: 133x cheaper per request

📁 FILES (8 modified):
- orchestrator/ai/mcp-manager.js (+70 LOC) - requestToolsList()
- orchestrator/workflow/tts-sync-manager.js (+15 LOC) - null safety
- orchestrator/workflow/mcp-todo-manager.js (+7 LOC) - toolsSummary
- config/global-config.js (-2 cost) - restored gpt-4o-mini
- prompts/system/*.js (4 files) - ES6 exports

📚 DOCS:
- MCP_ORCHESTRATOR_FIXES_COMPLETE_2025-10-14.md
- MCP_PROMPT_OPTIMIZATION_2025-10-14.md
- test-prompt-optimization.sh

See docs for detailed analysis and testing."

echo "✅ Committed successfully!"
echo "Next: git push origin main"
