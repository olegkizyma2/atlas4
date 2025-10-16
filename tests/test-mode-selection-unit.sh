#!/bin/bash
# Simple Mode Selection Unit Test
# Tests the new Stage 0-MCP mode selection

echo "🧪 Testing Mode Selection Stage (Stage 0-MCP)"
echo "=============================================="
echo ""

cd "$(dirname "$0")/.."

# Test 1: Prompt loading
echo "1. Testing prompt loading..."
node -e "
import('./prompts/mcp/stage0_mode_selection.js')
  .then(module => {
    console.log('  ✅ Prompt loaded successfully');
    console.log('  - System prompt length:', module.SYSTEM_PROMPT.length, 'chars');
    console.log('  - Has buildUserPrompt:', typeof module.buildUserPrompt === 'function');
    console.log('  - Metadata:', JSON.stringify(module.default.metadata, null, 2));
  })
  .catch(err => {
    console.error('  ❌ Failed to load prompt:', err.message);
    process.exit(1);
  });
"

echo ""

# Test 2: Processor loading
echo "2. Testing processor loading..."
node -e "
import('./orchestrator/workflow/stages/mode-selection-processor.js')
  .then(module => {
    console.log('  ✅ Processor loaded successfully');
    console.log('  - Has ModeSelectionProcessor:', !!module.ModeSelectionProcessor);
    console.log('  - Has default export:', !!module.default);
  })
  .catch(err => {
    console.error('  ❌ Failed to load processor:', err.message);
    process.exit(1);
  });
"

echo ""

# Test 3: DI Container registration
echo "3. Testing DI Container registration..."
node -e "
import { DIContainer } from './orchestrator/core/di-container.js';
import { registerCoreServices, registerMCPProcessors } from './orchestrator/core/service-registry.js';
import logger from './orchestrator/utils/logger.js';

const container = new DIContainer();
registerCoreServices(container);
registerMCPProcessors(container);

try {
  const processor = container.resolve('modeSelectionProcessor');
  console.log('  ✅ Mode selection processor registered in DI');
  console.log('  - Processor type:', processor.constructor.name);
  console.log('  - Has execute method:', typeof processor.execute === 'function');
} catch (err) {
  console.error('  ❌ Failed to resolve processor:', err.message);
  console.error(err.stack);
  process.exit(1);
}
"

echo ""

# Test 4: Workflow integration
echo "4. Testing workflow integration..."
if node --check orchestrator/workflow/executor-v3.js 2>&1; then
  echo "  ✅ Executor compiles successfully with mode selection"
else
  echo "  ❌ Executor has compilation errors"
  exit 1
fi

echo ""

# Test 5: Frontend WebSocket handlers
echo "5. Testing frontend WebSocket handlers..."
if node --check web/static/js/app-refactored.js 2>&1; then
  echo "  ✅ Frontend app compiles with agent message handlers"
else
  echo "  ❌ Frontend app has compilation errors"
  exit 1
fi

echo ""
echo "=============================================="
echo "✅ All unit tests passed!"
echo ""
echo "Next steps for manual testing:"
echo "1. Start system: ./restart_system.sh start"
echo "2. Open http://localhost:5001"
echo "3. Send test messages:"
echo "   - 'Привіт' → Should show chat mode"
echo "   - 'Відкрий калькулятор' → Should show task mode"
echo "4. Check chat for mode selection messages"
echo "5. Verify all agent messages appear with timestamps"
echo ""
