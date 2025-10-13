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
      this.stdoutBuffer += data.toString();
      this._processStdoutBuffer();
    });

    // stderr - логи
    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.debug('mcp-server', `[MCP ${this.name}] stderr: ${message}`);
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
    // Initialize response
    if (message.method === 'initialize' && message.result) {
      this.tools = message.result.capabilities?.tools || [];
      this.ready = true;
      logger.system('mcp-server', `[MCP ${this.name}] ✅ Initialized with ${this.tools.length} tools`);
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

    const initMessage = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'initialize',
      params: {
        protocolVersion: '1.0',
        capabilities: {
          tools: { listChanged: true }
        },
        clientInfo: {
          name: 'atlas-orchestrator',
          version: '4.0.0'
        }
      }
    };

    this.process.stdin.write(JSON.stringify(initMessage) + '\n');

    // Чекати на initialize response (timeout 5s)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.ready) {
          reject(new Error(`${this.name} initialization timeout`));
        }
      }, 5000);

      const checkReady = setInterval(() => {
        if (this.ready) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });

    logger.system('mcp-server', `[MCP ${this.name}] ✅ Ready`);
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

      // Timeout 30s
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(new Error(`Tool ${toolName} timeout`));
        }
      }, 30000);
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
   * Запустити всі MCP servers
   */
  async initialize() {
    logger.system('mcp-manager', '[MCP Manager] Starting MCP servers...');

    const startPromises = [];

    for (const [name, config] of Object.entries(this.config)) {
      startPromises.push(this.startServer(name, config));
    }

    await Promise.all(startPromises);

    logger.system('mcp-manager', `[MCP Manager] ✅ ${this.servers.size} servers started`);
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
      const process = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Створити MCP server wrapper
      const server = new MCPServer(name, config, process);
      
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
   * 
   * @param {string} toolName - Назва tool (напр. "filesystem__createFile")
   * @param {Object} parameters - Параметри для tool
   * @returns {Promise<Object>} Результат виконання
   */
  async executeTool(toolName, parameters) {
    // Знайти server який має цей tool
    const server = this.findServerForTool(toolName);

    if (!server) {
      throw new Error(`Tool ${toolName} not available in any MCP server`);
    }

    logger.debug('mcp-manager', `[MCP Manager] Executing ${toolName} on ${server.name}`);

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
        tools: server.tools.length,
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
