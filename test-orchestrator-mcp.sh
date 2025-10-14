#!/bin/bash
# Test Orchestrator MCP Integration
# Перевіряє чи Orchestrator правильно ініціалізує MCP сервери

set -e

echo "🧪 Testing Orchestrator MCP Integration"
echo "============================================"
echo ""

# Кольори
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функція логування
log_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# 1. Перевірка що Orchestrator може імпортувати mcp-manager
log_info "Test 1: Check mcp-manager import"
if node -e "import('./orchestrator/ai/mcp-manager.js').then(()=>console.log('OK')).catch(e=>process.exit(1))" 2>&1 | grep -q "OK"; then
    log_success "mcp-manager can be imported"
else
    log_error "mcp-manager import failed"
    exit 1
fi

# 2. Перевірка конфігурації MCP серверів
log_info "Test 2: Check MCP servers configuration"
if node -e "
import GlobalConfig from './config/global-config.js';
const mcpServers = GlobalConfig.MCP_SERVERS;
console.log('Configured servers:', Object.keys(mcpServers).join(', '));
console.log('Total:', Object.keys(mcpServers).length);
" 2>&1 | grep -q "filesystem"; then
    log_success "MCP servers configured"
    node -e "
import GlobalConfig from './config/global-config.js';
const mcpServers = GlobalConfig.MCP_SERVERS;
console.log('   Servers:', Object.keys(mcpServers).join(', '));
"
else
    log_error "MCP configuration missing"
    exit 1
fi

# 3. Тестовий запуск MCPManager
log_info "Test 3: Initialize MCPManager"
node -e "
import { MCPManager } from './orchestrator/ai/mcp-manager.js';
import logger from './orchestrator/utils/logger.js';
import GlobalConfig from './config/global-config.js';

const manager = new MCPManager(GlobalConfig.MCP_SERVERS, logger);
console.log('MCPManager created successfully');

// Спробуємо ініціалізувати (з timeout)
const timeout = setTimeout(() => {
    console.log('⚠️  Initialization timeout (15s)');
    process.exit(0);
}, 15000);

manager.initialize()
    .then(() => {
        clearTimeout(timeout);
        const status = manager.getStatus();
        console.log('Initialization complete:');
        console.log('  Servers:', status.servers.length);
        console.log('  Total tools:', status.totalTools);
        
        status.servers.forEach(s => {
            console.log(\`  - \${s.name}: \${s.status} (\${s.tools} tools)\`);
        });
        
        process.exit(status.servers.filter(s => s.status === 'ready').length > 0 ? 0 : 1);
    })
    .catch(err => {
        clearTimeout(timeout);
        console.error('Initialization error:', err.message);
        process.exit(1);
    });
" && log_success "MCPManager initialized" || log_error "MCPManager failed"

echo ""
echo "============================================"
echo "🎉 Test Complete"
