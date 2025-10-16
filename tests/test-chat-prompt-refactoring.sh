#!/bin/bash

# Test: Chat Prompt Refactoring Verification
# Verifies that chat prompt is correctly loaded from prompts directory
# Date: 2025-10-16

set -e  # Exit on error

echo "🧪 Testing Chat Prompt Refactoring..."
echo ""

# Test 1: Verify prompt file exists
echo "=== Test 1: Prompt File Exists ==="
if [ -f "prompts/mcp/atlas_chat.js" ]; then
    echo "✅ prompts/mcp/atlas_chat.js exists"
else
    echo "❌ prompts/mcp/atlas_chat.js NOT FOUND"
    exit 1
fi
echo ""

# Test 2: Verify prompt exports
echo "=== Test 2: Prompt Exports ==="
node -e "
import('./prompts/mcp/atlas_chat.js').then(m => {
  if (!m.SYSTEM_PROMPT) throw new Error('SYSTEM_PROMPT not exported');
  if (!m.USER_PROMPT) throw new Error('USER_PROMPT not exported');
  if (typeof m.buildUserPrompt !== 'function') throw new Error('buildUserPrompt not a function');
  if (!m.default) throw new Error('default export missing');
  console.log('✅ All exports present');
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
" || exit 1
echo ""

# Test 3: Verify MCP_PROMPTS includes ATLAS_CHAT
echo "=== Test 3: MCP_PROMPTS Integration ==="
node -e "
import('./prompts/mcp/index.js').then(m => {
  if (!m.MCP_PROMPTS) throw new Error('MCP_PROMPTS not exported');
  if (!m.MCP_PROMPTS.ATLAS_CHAT) throw new Error('ATLAS_CHAT not in MCP_PROMPTS');
  console.log('✅ ATLAS_CHAT integrated in MCP_PROMPTS');
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
" || exit 1
echo ""

# Test 4: Verify prompt content
echo "=== Test 4: Prompt Content Validation ==="
node -e "
import('./prompts/mcp/atlas_chat.js').then(m => {
  const prompt = m.SYSTEM_PROMPT;
  if (prompt.length < 1000) throw new Error('SYSTEM_PROMPT too short');
  if (!prompt.includes('Атлас')) throw new Error('Missing Atlas name');
  if (!prompt.includes('Олег')) throw new Error('Missing creator reference');
  if (!prompt.includes('контекст')) throw new Error('Missing context instructions');
  console.log('✅ Prompt content valid (', prompt.length, 'chars)');
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
" || exit 1
echo ""

# Test 5: Verify metadata
echo "=== Test 5: Metadata Validation ==="
node -e "
import('./prompts/mcp/atlas_chat.js').then(m => {
  const meta = m.default.metadata;
  if (!meta) throw new Error('metadata missing');
  if (meta.agent !== 'atlas') throw new Error('Wrong agent');
  if (meta.name !== 'atlas_chat') throw new Error('Wrong name');
  if (!meta.requiresContext) throw new Error('requiresContext should be true');
  console.log('✅ Metadata valid:', JSON.stringify(meta));
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
" || exit 1
echo ""

# Test 6: Verify buildUserPrompt function
echo "=== Test 6: buildUserPrompt Function ==="
node -e "
import('./prompts/mcp/atlas_chat.js').then(m => {
  const userPrompt = m.buildUserPrompt('Привіт!');
  if (userPrompt !== 'Привіт!') throw new Error('buildUserPrompt not working correctly');
  console.log('✅ buildUserPrompt works correctly');
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
" || exit 1
echo ""

# Test 7: Verify no hardcoded prompts in executor (check for specific string that was removed)
echo "=== Test 7: No Hardcoded Prompts ==="
if grep -q "ПАМ'ЯТИ ПРО КОНТЕКСТ ЗА ВСІМА" orchestrator/workflow/executor-v3.js; then
    echo "❌ Found hardcoded prompt in executor"
    exit 1
else
    echo "✅ No hardcoded chat prompts found in executor"
fi
echo ""

# Test 8: Verify executor loads from prompts directory
echo "=== Test 8: Executor Prompt Loading ==="
if grep -q "import('../../prompts/mcp/index.js')" orchestrator/workflow/executor-v3.js; then
    echo "✅ Executor imports from prompts directory"
else
    echo "❌ Executor does not import from prompts directory"
    exit 1
fi
echo ""

# Test 9: Verify executor uses chatPrompt.SYSTEM_PROMPT
echo "=== Test 9: Executor Uses Loaded Prompt ==="
if grep -q "chatPrompt.SYSTEM_PROMPT" orchestrator/workflow/executor-v3.js; then
    echo "✅ Executor uses chatPrompt.SYSTEM_PROMPT"
else
    echo "❌ Executor does not use chatPrompt.SYSTEM_PROMPT"
    exit 1
fi
echo ""

echo "════════════════════════════════════════"
echo "✅ ALL TESTS PASSED!"
echo "════════════════════════════════════════"
echo ""
echo "Summary:"
echo "- Chat prompt created in prompts/mcp/atlas_chat.js"
echo "- Prompt properly exported with metadata"
echo "- Integrated into MCP_PROMPTS"
echo "- No hardcoded prompts in executor"
echo "- Executor loads from prompts directory"
echo ""
echo "Chat mode refactoring: COMPLETE ✅"
