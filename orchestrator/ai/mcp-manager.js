/**
 * @fileoverview MCP Manager - управління прямими MCP серверами
 * Запускає та керує lifecycle MCP серверів через stdio protocol
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import { spawn } from 'child_process';
import logger from '../utils/logger.js';

/**
 * Представляє один MCP server process
 */
class MCPServer {
  constructor(name, config, process) {
    this.name = name;
    this.config = config;
    this.process = process;
    this.tools = [];
    this.ready = false;
    this.messageId = 0;

    // Buffers для stdio communication
    this.stdoutBuffer = '';
    this.stderrBuffer = '';

    this._setupStreams();
  }

  /**
   * Налаштувати stdio streams для MCP protocol
   * @private
   */
  _setupStreams() {
    // stdout - MCP JSON-RPC messages
    this.process.stdout.on('data', (data) => {
      const chunk = data.toString();
      this.stdoutBuffer += chunk;
      logger.debug('mcp-server', `[MCP ${this.name}] stdout: ${chunk.substring(0, 200)}`);
      this._processStdoutBuffer();
    });

    // stderr - логи (зберігаємо для діагностики)
    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      this.stderrBuffer += message + '\n';

      if (message) {
        // Показуємо npm warnings та errors
        if (message.includes('warn') || message.includes('error') || message.includes('ERR')) {
          logger.warn('mcp-server', `[MCP ${this.name}] stderr: ${message}`);
        } else {
          logger.debug('mcp-server', `[MCP ${this.name}] stderr: ${message}`);
        }
      }
    });

    // Process events
    this.process.on('error', (error) => {
      logger.error('mcp-server', `[MCP ${this.name}] ❌ Process error: ${error.message}`);
    });

    this.process.on('exit', (code, signal) => {
      logger.warn('mcp-server', `[MCP ${this.name}] Process exited (code: ${code}, signal: ${signal})`);
      this.ready = false;
    });
  }

  /**
   * Обробити накопичений stdout buffer
   * @private
   */
  _processStdoutBuffer() {
    // MCP protocol: JSON-RPC messages розділені newline
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() || ''; // Залишити неповну лінію в buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this._handleMCPMessage(message);
      } catch (error) {
        logger.error('mcp-server', `[MCP ${this.name}] ❌ Invalid JSON: ${line}`);
      }
    }
  }

  /**
   * Обробити MCP protocol message
   * @private
   */
  _handleMCPMessage(message) {
    logger.debug('mcp-server', `[MCP ${this.name}] Received message:`, message);

    // Initialize response (підтримка різних SDK версій)
    // Новий формат: message.result.capabilities (SDK 1.x)
    // Старий формат: message.capabilities (SDK 0.6.x)
    const capabilities = message.result?.capabilities || message.capabilities;

    if (capabilities) {
      // FIXED 14.10.2025: capabilities.tools - це metadata {listChanged: true}, НЕ список tools
      // Справжні tools приходять окремо через tools/list request
      // Просто позначаємо що ініціалізація завершена, tools прийдуть окремо
      this.ready = true;
      logger.system('mcp-server', `[MCP ${this.name}] ✅ Initialized, waiting for tools list...`);
      return;
    }

    // Error response
    if (message.error) {
      logger.error('mcp-server', `[MCP ${this.name}] Error: ${JSON.stringify(message.error)}`);
    }

    // Tool execution response
    if (message.id && this.pendingRequests?.has(message.id)) {
      const resolver = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        resolver.reject(new Error(message.error.message || 'MCP tool error'));
      } else {
        resolver.resolve(message.result);
      }
    }
  }

  /**
   * Ініціалізувати MCP server (handshake)
   */
  async initialize() {
    logger.system('mcp-server', `[MCP ${this.name}] Initializing...`);
    logger.debug('mcp-server', `[MCP ${this.name}] Command: ${this.config.command} ${this.config.args.join(' ')}`);

    const initMessage = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',  // FIXED: MCP standard protocol version (було '1.0')
        capabilities: {
          tools: { listChanged: true }
        },
        clientInfo: {
          name: 'atlas-orchestrator',
          version: '4.0.0'
        }
      }
    };

    try {
      this.process.stdin.write(JSON.stringify(initMessage) + '\n');
      logger.debug('mcp-server', `[MCP ${this.name}] Initialize message sent, waiting for response...`);
    } catch (error) {
      logger.error('mcp-server', `[MCP ${this.name}] Failed to send initialize message: ${error.message}`);
      throw error;
    }

    // Чекати на initialize response (timeout 15s для Mac M1 + npx)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.ready) {
          logger.error('mcp-server', `[MCP ${this.name}] ❌ Initialization timeout after 15s`);
          logger.debug('mcp-server', `[MCP ${this.name}] Stdout buffer: ${this.stdoutBuffer}`);
          logger.debug('mcp-server', `[MCP ${this.name}] Stderr buffer: ${this.stderrBuffer}`);
          reject(new Error(`${this.name} initialization timeout`));
        }
      }, 15000); // Збільшено з 5s до 15s

      const checkReady = setInterval(() => {
        if (this.ready) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });

    logger.system('mcp-server', `[MCP ${this.name}] ✅ Ready`);

    // FIXED: Після ініціалізації запитати список tools
    await this.requestToolsList();
  }

  /**
   * Запитати список доступних tools у MCP server
   * @private
   */
  async requestToolsList() {
    logger.debug('mcp-server', `[MCP ${this.name}] Requesting tools list...`);

    const messageId = ++this.messageId;
    const listMessage = {
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/list',
      params: {}
    };

    // Створити pending request для tools/list
    if (!this.pendingRequests) {
      this.pendingRequests = new Map();
    }

    const toolsPromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(messageId, {
        resolve: (result) => {
          // Витягти tools з response
          if (result && Array.isArray(result.tools)) {
            this.tools = result.tools;
            logger.system('mcp-server', `[MCP ${this.name}] ✅ Loaded ${this.tools.length} tools`);
            if (this.tools.length > 0) {
              logger.debug('mcp-server', `[MCP ${this.name}] Tools: ${this.tools.map(t => t.name).join(', ')}`);
            }
          } else {
            logger.warn('mcp-server', `[MCP ${this.name}] ⚠️ No tools returned`);
            this.tools = [];
          }
          resolve();
        },
        reject
      });

      // Timeout 20s (INCREASED 14.10.2025 - some MCP servers are slow to list tools)
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          logger.warn('mcp-server', `[MCP ${this.name}] ⚠️ Tools list request timeout after 20s`);
          logger.debug('mcp-server', `[MCP ${this.name}] This may indicate the MCP server doesn't support tools/list or is too slow`);
          this.tools = []; // Fallback на пустий масив
          resolve(); // НЕ reject - сервер може працювати без tools
        }
      }, 20000);
    });

    try {
      this.process.stdin.write(JSON.stringify(listMessage) + '\n');
      await toolsPromise;
    } catch (error) {
      logger.warn('mcp-server', `[MCP ${this.name}] ⚠️ Failed to get tools list: ${error.message}`);
      this.tools = []; // Fallback
    }
  }

  /**
   * Викликати tool через MCP protocol
   * 
   * @param {string} toolName - Назва tool
   * @param {Object} parameters - Параметри для tool
   * @returns {Promise<Object>} Результат виконання
   */
  async call(toolName, parameters) {
    if (!this.ready) {
      throw new Error(`MCP server ${this.name} not ready`);
    }

    const messageId = ++this.messageId;

    const request = {
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters
      }
    };

    logger.debug('mcp-server', `[MCP ${this.name}] Calling tool: ${toolName}`, parameters);

    // Створити pending request
    if (!this.pendingRequests) {
      this.pendingRequests = new Map();
    }

    const resultPromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(messageId, { resolve, reject });

      // Timeout 60s (INCREASED 14.10.2025 - playwright operations can be slow)
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          logger.error('mcp-server', `[MCP ${this.name}] ❌ Tool ${toolName} timeout after 60s`);
          reject(new Error(`Tool ${toolName} timeout after 60s`));
        }
      }, 60000);
    });

    // Відправити request
    this.process.stdin.write(JSON.stringify(request) + '\n');

    return resultPromise;
  }

  /**
   * Отримати список доступних tools
   * @returns {Array} Список tool definitions
   */
  getTools() {
    return this.tools;
  }

  /**
   * Зупинити MCP server
   */
  async shutdown() {
    logger.system('mcp-server', `[MCP ${this.name}] Shutting down...`);

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');

      // Чекати на graceful exit (timeout 3s)
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!this.process.killed) {
            logger.warn('mcp-server', `[MCP ${this.name}] Force killing...`);
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        this.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    logger.system('mcp-server', `[MCP ${this.name}] ✅ Stopped`);
  }
}

/**
 * Менеджер для управління множиною MCP серверів
 */
export class MCPManager {
  /**
   * @param {Object} serversConfig - Конфігурація серверів з AI_BACKEND_CONFIG
   */
  constructor(serversConfig) {
    this.config = serversConfig;
    this.servers = new Map();
  }

  /**
   * Повертає список всіх доступних tools з усіх MCP серверів
   * @returns {Array<string>} Масив назв tools
   */
  listTools() {
    const allTools = [];
    for (const server of this.servers.values()) {
      if (Array.isArray(server.tools)) {
        allTools.push(...server.tools);
      }
    }
    return allTools;
  }

  /**
   * Запустити всі MCP servers
   */
  async initialize() {
    logger.system('mcp-manager', '[MCP Manager] Starting MCP servers...');

    const startPromises = [];
    const errors = [];

    for (const [name, config] of Object.entries(this.config)) {
      // Запускаємо кожен сервер окремо з error handling
      startPromises.push(
        this.startServer(name, config).catch((error) => {
          logger.error('mcp-manager', `[MCP Manager] ❌ ${name} failed: ${error.message}`);
          errors.push({ name, error: error.message });
          return null; // Продовжуємо з іншими серверами
        })
      );
    }

    await Promise.all(startPromises);

    const successCount = this.servers.size;
    const failedCount = errors.length;

    if (successCount === 0) {
      logger.error('mcp-manager', '[MCP Manager] ❌ No MCP servers started successfully');
      throw new Error('All MCP servers failed to initialize');
    }

    if (failedCount > 0) {
      logger.warn('mcp-manager', `[MCP Manager] ⚠️ ${failedCount} server(s) failed to start: ${errors.map(e => e.name).join(', ')}`);
    }

    logger.system('mcp-manager', `[MCP Manager] ✅ ${successCount}/${successCount + failedCount} servers started`);
  }

  /**
   * Запустити один MCP server
   * 
   * @param {string} name - Назва server (filesystem, playwright, etc)
   * @param {Object} config - Конфігурація { command, args, env }
   */
  async startServer(name, config) {
    logger.system('mcp-manager', `[MCP Manager] Starting ${name}...`);

    try {
      // Spawn process
      const childProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Створити MCP server wrapper
      const server = new MCPServer(name, config, childProcess);

      // Ініціалізувати (handshake)
      await server.initialize();

      this.servers.set(name, server);

      logger.system('mcp-manager', `[MCP Manager] ✅ ${name} started (${server.tools.length} tools)`);

    } catch (error) {
      logger.error('mcp-manager', `[MCP Manager] ❌ Failed to start ${name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Викликати tool на відповідному server
   * FIXED 14.10.2025 - Changed signature to accept (serverName, toolName, parameters)
   * instead of using findServerForTool which was causing issues
   * 
   * @param {string} serverName - Назва server (напр. "filesystem")
   * @param {string} toolName - Назва tool (напр. "createFile")
   * @param {Object} parameters - Параметри для tool
   * @returns {Promise<Object>} Результат виконання
   */
  async executeTool(serverName, toolName, parameters) {
    // Знайти server за назвою
    const server = this.servers.get(serverName);

    if (!server) {
      // FIXED 14.10.2025 - Better error message with list of available servers
      const availableServers = Array.from(this.servers.keys()).join(', ');
      throw new Error(`MCP server '${serverName}' not found. Available servers: ${availableServers}`);
    }

    if (!server.ready) {
      throw new Error(`MCP server ${serverName} not ready`);
    }

    // Check if tool exists on server
    if (!Array.isArray(server.tools) || !server.tools.some(t => t.name === toolName)) {
      // FIXED 14.10.2025 - Better error message with list of available tools
      const availableTools = Array.isArray(server.tools)
        ? server.tools.map(t => t.name).join(', ')
        : 'none';
      throw new Error(`Tool '${toolName}' not available on server '${serverName}'. Available tools: ${availableTools}`);
    }

    logger.debug('mcp-manager', `[MCP Manager] Executing ${toolName} on ${serverName}`);

    const result = await server.call(toolName, parameters);

    logger.debug('mcp-manager', `[MCP Manager] ✅ ${toolName} completed`);

    return result;
  }

  /**
   * Знайти server який має вказаний tool
   * @private
   */
  findServerForTool(toolName) {
    for (const server of this.servers.values()) {
      // FIXED: Додано перевірку що tools існує і є масивом
      if (!Array.isArray(server.tools)) {
        logger.warn('mcp-manager', `[MCP Manager] Server ${server.name} has invalid tools (not array)`);
        continue;
      }

      const hasTool = server.tools.some(tool =>
        tool.name === toolName || toolName.includes(server.name)
      );

      if (hasTool) {
        return server;
      }
    }

    return null;
  }

  /**
   * Отримати всі доступні tools з усіх servers
   * @returns {Array} Список всіх tool definitions
   */
  getAvailableTools() {
    const allTools = [];

    for (const server of this.servers.values()) {
      // FIXED: Переконуємось що tools є масивом перед map
      if (!Array.isArray(server.tools)) {
        logger.warn('mcp-manager', `[MCP Manager] Server ${server.name} has invalid tools`);
        continue;
      }

      const serverTools = server.getTools().map(tool => ({
        ...tool,
        server: server.name
      }));
      allTools.push(...serverTools);
    }

    return allTools;
  }

  /**
   * Отримати статус всіх servers
   * @returns {Object} Статус кожного server
   */
  getStatus() {
    const status = {};

    for (const [name, server] of this.servers.entries()) {
      status[name] = {
        ready: server.ready,
        tools: Array.isArray(server.tools) ? server.tools.length : 0,
        pid: server.process.pid
      };
    }

    return status;
  }

  /**
   * Зупинити всі MCP servers
   */
  async shutdown() {
    logger.system('mcp-manager', '[MCP Manager] Shutting down all servers...');

    const shutdownPromises = [];

    for (const server of this.servers.values()) {
      shutdownPromises.push(server.shutdown());
    }

    await Promise.all(shutdownPromises);

    this.servers.clear();

    logger.system('mcp-manager', '[MCP Manager] ✅ All servers stopped');
  }
}

export default MCPManager;
