#!/usr/bin/env node
/**
 * Test MCP Manager in Orchestrator
 * Перевірка завантаження всіх MCP серверів
 * 
 * Usage: node test-mcp-orchestrator.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple logger
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`)
};

/**
 * Test individual MCP server
 */
async function testMCPServer(name, command, args) {
  logger.info(`Testing ${name} MCP server...`);
  
  return new Promise((resolve) => {
    const childProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';
    let responded = false;

    // Timeout після 5 секунд
    const timeout = setTimeout(() => {
      if (!responded) {
        childProcess.kill();
        logger.error(`${name}: Timeout (no response in 5s)`);
        resolve({ name, success: false, reason: 'timeout', tools: 0 });
      }
    }, 5000);

    let initDone = false;
    let toolsDone = false;

    childProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      
      // Перевіряємо чи є JSON response
      const lines = stdoutData.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const message = JSON.parse(line);
          
          // Initialize response
          if (message.result?.capabilities && !initDone) {
            initDone = true;
            responded = true;
            logger.success(`${name}: Initialized ✓`);
            
            // Запитуємо tools
            const toolsRequest = JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {}
            }) + '\n';
            
            childProcess.stdin.write(toolsRequest);
          }
          
          // Tools list response
          if (message.result?.tools && Array.isArray(message.result.tools) && !toolsDone) {
            toolsDone = true;
            const toolsCount = message.result.tools.length;
            logger.success(`${name}: ${toolsCount} tools loaded ✓`);
            
            clearTimeout(timeout);
            childProcess.kill();
            
            resolve({ 
              name, 
              success: true, 
              tools: toolsCount,
              toolNames: message.result.tools.slice(0, 5).map(t => t.name)
            });
          }
        } catch (e) {
          // Не JSON, пропускаємо
        }
      }
    });

    childProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      logger.error(`${name}: Process error - ${error.message}`);
      resolve({ name, success: false, reason: error.message, tools: 0 });
    });

    childProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (!responded) {
        logger.error(`${name}: Exited without response (code: ${code})`);
        if (stderrData) {
          logger.warn(`${name} stderr: ${stderrData.substring(0, 200)}`);
        }
        resolve({ name, success: false, reason: 'no_response', tools: 0 });
      }
    });

    // Відправляємо initialize
    const initMessage = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-orchestrator',
          version: '1.0.0'
        }
      }
    }) + '\n';

    childProcess.stdin.write(initMessage);
  });
}

/**
 * Main test
 */
async function main() {
  console.log('\n🧪 Testing MCP Servers in Orchestrator\n');
  console.log('=' .repeat(60));
  
  const servers = [
    { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
    { name: 'playwright', command: 'npx', args: ['-y', '@executeautomation/playwright-mcp-server'] },
    { name: 'shell', command: 'npx', args: ['-y', 'super-shell-mcp'] },
    { name: 'applescript', command: 'npx', args: ['-y', '@peakmojo/applescript-mcp'] },
    { name: 'git', command: 'npx', args: ['-y', '@cyanheads/git-mcp-server'] },
    { name: 'memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] }
  ];

  const results = [];
  
  for (const server of servers) {
    const result = await testMCPServer(server.name, server.command, server.args);
    results.push(result);
    console.log(''); // Пустий рядок між серверами
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('\n📊 Summary:\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    const sampleTools = r.toolNames ? ` (${r.toolNames.slice(0, 3).join(', ')}...)` : '';
    console.log(`   - ${r.name}: ${r.tools} tools${sampleTools}`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.name}: ${r.reason || 'unknown'}`);
    });
  }
  
  const totalTools = results.reduce((sum, r) => sum + r.tools, 0);
  console.log(`\n📦 Total tools available: ${totalTools}`);
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Exit code
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  logger.error(`Test failed: ${error.message}`);
  process.exit(1);
});
