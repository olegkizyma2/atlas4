#!/usr/bin/env node

/**
 * Test script for JSON parsing with trailing commas
 * Verifies that _sanitizeJsonString handles all edge cases
 */

import { MCPTodoManager } from './orchestrator/workflow/mcp-todo-manager.js';

// Create a mock manager just to test _sanitizeJsonString
const mockLogger = {
    system: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { }
};

const mockConfig = {
    AGENTS: { atlas: {}, tetyana: {}, grisha: {} },
    MCP: {
        SERVERS: {},
        TOOLS: {}
    }
};

const manager = new MCPTodoManager(mockLogger, mockConfig, {});

// Test cases with trailing commas
const testCases = [
    {
        name: 'Trailing comma before closing bracket',
        input: '{"tool_calls": [{"server": "applescript", "tool": "test",},]}',
        shouldPass: true
    },
    {
        name: 'Trailing comma with newlines (AppleScript)',
        input: `{
  "tool_calls": [
    {
      "server": "applescript",
      "tool": "applescript_execute",
      "parameters": {
        "code_snippet": "tell application \\"Calculator\\"\\n  delay 0.5\\n  keystroke \\"4\\"\\n  keystroke \\"*\\n  keystroke \\"5\\"\\n  keystroke return\\nend tell",
        "language": "applescript",
      }
    },
  ],
  "reasoning": "Test"
}`,
        shouldPass: true
    },
    {
        name: 'Multiple trailing commas',
        input: '{"tool_calls": [{"server": "test",,,},],}',
        shouldPass: true
    },
    {
        name: 'Trailing comma with escaped quotes',
        input: '{"tool_calls": [{"parameters": {"code": "\\"test\\"",}}]}',
        shouldPass: true
    },
    {
        name: 'Valid JSON without trailing commas',
        input: '{"tool_calls": [{"server": "test"}], "reasoning": "ok"}',
        shouldPass: true
    }
];

let passed = 0;
let failed = 0;

console.log('🧪 Testing trailing comma JSON sanitization...\n');

for (const testCase of testCases) {
    try {
        const result = manager._sanitizeJsonString(testCase.input);
        JSON.parse(result);  // Verify it's valid JSON

        console.log(`✅ ${testCase.name}`);
        passed++;
    } catch (error) {
        if (testCase.shouldPass) {
            console.log(`❌ ${testCase.name}`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Input: ${testCase.input.substring(0, 100)}...`);
            failed++;
        } else {
            console.log(`✅ ${testCase.name} (correctly failed)`);
            passed++;
        }
    }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed');
    process.exit(1);
}
