#!/bin/bash
# Verify MCP fixes

echo "🔍 VERIFYING MCP FIXES..."
echo ""

# Test 1: Check if files were modified
echo "1️⃣ Checking modified files..."
if grep -q "requestToolsList" orchestrator/ai/mcp-manager.js; then
    echo "   ✅ mcp-manager.js has requestToolsList()"
else
    echo "   ❌ mcp-manager.js missing requestToolsList()"
fi

if grep -q "this.ttsService && typeof this.ttsService.speak" orchestrator/workflow/tts-sync-manager.js; then
    echo "   ✅ tts-sync-manager.js has TTS null safety"
else
    echo "   ❌ tts-sync-manager.js missing TTS checks"
fi

# Test 2: Check ES6 exports
echo ""
echo "2️⃣ Checking ES6 exports..."
ES6_COUNT=0
for file in prompts/system/agent_descriptions.js prompts/system/workflow_stages.js prompts/voice/activation_responses.js prompts/voice/status_messages.js; do
    if grep -q "export default" "$file"; then
        ES6_COUNT=$((ES6_COUNT + 1))
    fi
done

if [ $ES6_COUNT -eq 4 ]; then
    echo "   ✅ All 4 files have ES6 exports"
else
    echo "   ⚠️ Only $ES6_COUNT/4 files have ES6 exports"
fi

# Test 3: Check for CommonJS remnants
echo ""
echo "3️⃣ Checking for CommonJS remnants..."
COMMONJS_COUNT=0
for file in prompts/system/agent_descriptions.js prompts/system/workflow_stages.js prompts/voice/activation_responses.js prompts/voice/status_messages.js; do
    if grep -q "module.exports" "$file"; then
        echo "   ⚠️ $file still has module.exports"
        COMMONJS_COUNT=$((COMMONJS_COUNT + 1))
    fi
done

if [ $COMMONJS_COUNT -eq 0 ]; then
    echo "   ✅ No CommonJS remnants found"
else
    echo "   ❌ Found $COMMONJS_COUNT files with CommonJS"
fi

echo ""
echo "✅ VERIFICATION COMPLETE!"
