# 🧩 AI Backend Modular System - Архітектурний план

**Дата:** 13 жовтня 2025  
**Автор:** Atlas System  
**Версія:** 1.0.0

---

## 🎯 КОНЦЕПЦІЯ

Створити **модульну систему AI backends** з можливістю:
- ✅ Переключення між **Goose** та **прямими MCP серверами**
- ✅ Конфігурація через **central config** (`global-config.js`)
- ✅ Окремий **MCP Manager** модуль для управління серверами
- ✅ Уніфікований **AI Provider Interface** для всіх backends

---

## 📊 ПОТОЧНА АРХІТЕКТУРА (є проблеми)

```
┌─────────────────────────┐
│  AgentStageProcessor    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  callGooseAgent()       │ ❌ Hardcoded Goose
│  (goose-client.js)      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Goose Desktop WS       │
│  Port 3000              │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  MCP Extensions         │ ⚠️ Через Goose
│  (developer, playwright)│
└─────────────────────────┘
```

**Проблеми:**
- ❌ **Жорстка прив'язка** до Goose (`callGooseAgent` в коді)
- ❌ **Неможливо переключитись** на прямі MCP сервери
- ❌ **MCP через Goose** - додатковий overhead
- ❌ **Немає fallback** якщо Goose недоступний

---

## ✅ НОВА МОДУЛЬНА АРХІТЕКТУРА

```
┌──────────────────────────────────────────────────┐
│           global-config.js                       │
│  AI_BACKEND_CONFIG:                              │
│    mode: 'goose' | 'mcp' | 'hybrid'             │
│    primary: 'goose'                              │
│    fallback: 'mcp'                               │
│    providers: { goose: {...}, mcp: {...} }       │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         AI Provider Interface                    │
│  (orchestrator/ai/ai-provider-interface.js)      │
│                                                  │
│  execute(prompt, context, options)               │
│  → routes to configured backend                  │
└────────┬────────────────────────────┬────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────┐    ┌─────────────────────┐
│  Goose Backend      │    │  MCP Backend        │
│  (goose-client.js)  │    │  (mcp-client.js)    │
└──────────┬──────────┘    └──────────┬──────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│  Goose Desktop WS   │    │  Direct MCP Servers │
│  + MCP Extensions   │    │  (filesystem, etc)  │
└─────────────────────┘    └─────────────────────┘
```

**Переваги:**
- ✅ **Flexibility** - легко переключити backend
- ✅ **Hybrid mode** - Goose для складних завдань, MCP для простих
- ✅ **Fallback** - автоматичний перехід при недоступності
- ✅ **Performance** - прямий MCP швидший
- ✅ **Testing** - легко тестувати різні backends

---

## 📋 КОМПОНЕНТИ СИСТЕМИ

### 1. **AI Backend Configuration** (global-config.js)

```javascript
export const AI_BACKEND_CONFIG = {
  // Режим роботи
  mode: 'hybrid',  // 'goose' | 'mcp' | 'hybrid'
  
  // Primary backend для task execution
  primary: 'goose',
  
  // Fallback при недоступності primary
  fallback: 'mcp',
  
  // Retry налаштування
  retry: {
    maxAttempts: 2,
    timeoutMs: 30000,
    switchToFallbackOnTimeout: true
  },
  
  // Provider конфігурації
  providers: {
    goose: {
      enabled: true,
      type: 'websocket',
      url: 'ws://localhost:3000/ws',
      apiKey: '${GITHUB_TOKEN}',
      model: 'gpt-4o',
      
      // MCP extensions через Goose
      extensions: ['developer', 'playwright', 'computercontroller'],
      
      // Коли використовувати
      useFor: ['complex_tasks', 'multi_step', 'reasoning']
    },
    
    mcp: {
      enabled: true,
      type: 'direct',
      
      // Direct MCP server connections
      servers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {
            ALLOWED_DIRECTORIES: '/Users,/tmp,/Desktop,/Applications'
          }
        },
        
        playwright: {
          command: 'npx',
          args: ['-y', '@executeautomation/playwright-mcp-server'],
          env: {
            HEADLESS: 'false'
          }
        },
        
        computercontroller: {
          command: 'npx',
          args: ['-y', '@anthropic/computer-use'],
          env: {}
        }
      },
      
      // LLM для MCP mode (використовується для reasoning)
      llm: {
        provider: 'openai',
        apiEndpoint: 'http://localhost:4000/v1/chat/completions',
        model: 'openai/gpt-4o-mini',
        temperature: 0.3
      },
      
      // Коли використовувати
      useFor: ['file_operations', 'browser_automation', 'screenshots']
    }
  },
  
  // Routing rules (коли який backend)
  routing: {
    // Якщо prompt містить ці ключові слова → використовувати MCP
    mcpKeywords: [
      'створи файл', 'create file', 'save file',
      'відкрий браузер', 'open browser',
      'скріншот', 'screenshot'
    ],
    
    // Якщо prompt містить ці → Goose
    gooseKeywords: [
      'проаналізуй', 'analyze', 'порівняй', 'compare',
      'поясни', 'explain', 'розкажи', 'tell'
    ]
  }
};
```

### 2. **AI Provider Interface** (orchestrator/ai/ai-provider-interface.js)

```javascript
/**
 * Уніфікований інтерфейс для всіх AI backends
 */
export class AIProviderInterface {
  constructor(config) {
    this.config = config;
    this.providers = {};
    
    // Ініціалізувати backends
    if (config.providers.goose.enabled) {
      this.providers.goose = new GooseBackend(config.providers.goose);
    }
    
    if (config.providers.mcp.enabled) {
      this.providers.mcp = new MCPBackend(config.providers.mcp);
    }
  }
  
  /**
   * Виконати запит через відповідний backend
   */
  async execute(prompt, context, options = {}) {
    // Визначити який backend використовувати
    const backend = this.selectBackend(prompt, options);
    
    try {
      // Спроба через primary backend
      return await this.providers[backend].execute(prompt, context, options);
      
    } catch (error) {
      // Fallback якщо primary failed
      if (this.config.fallback && this.config.fallback !== backend) {
        logger.warn(`${backend} failed, switching to ${this.config.fallback}`);
        return await this.providers[this.config.fallback].execute(prompt, context, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Вибрати backend на основі prompt та config
   */
  selectBackend(prompt, options) {
    // Якщо явно вказано
    if (options.forceBackend) {
      return options.forceBackend;
    }
    
    // Перевірити routing rules
    const mcpMatches = this.config.routing.mcpKeywords.some(kw => 
      prompt.toLowerCase().includes(kw)
    );
    
    if (mcpMatches && this.providers.mcp) {
      return 'mcp';
    }
    
    // Default: primary backend
    return this.config.primary;
  }
}
```

### 3. **MCP Backend** (orchestrator/ai/backends/mcp-backend.js)

```javascript
/**
 * Direct MCP Server backend
 */
export class MCPBackend {
  constructor(config) {
    this.config = config;
    this.mcpManager = new MCPManager(config.servers);
    this.llm = new LLMClient(config.llm);
  }
  
  async execute(prompt, context, options) {
    // 1. Розпізнати який tool потрібен
    const toolPlan = await this.planTools(prompt, context);
    
    // 2. Виконати tools через MCP servers
    const toolResults = await this.executeTools(toolPlan);
    
    // 3. LLM генерує фінальну відповідь на основі результатів
    const response = await this.llm.generate({
      prompt,
      context,
      toolResults
    });
    
    return response;
  }
  
  async planTools(prompt, context) {
    // Використати LLM для визначення які tools викликати
    const plan = await this.llm.generate({
      systemPrompt: 'You are a tool planner. Analyze the prompt and determine which tools to call.',
      userPrompt: prompt,
      availableTools: this.mcpManager.getAvailableTools()
    });
    
    return JSON.parse(plan);
  }
  
  async executeTools(toolPlan) {
    const results = [];
    
    for (const toolCall of toolPlan.tools) {
      const result = await this.mcpManager.executeTool(
        toolCall.name,
        toolCall.parameters
      );
      
      results.push(result);
    }
    
    return results;
  }
}
```

### 4. **MCP Manager** (orchestrator/ai/mcp-manager.js)

```javascript
/**
 * Управління MCP серверами
 */
export class MCPManager {
  constructor(serversConfig) {
    this.servers = new Map();
    this.config = serversConfig;
  }
  
  async initialize() {
    // Запустити всі MCP servers
    for (const [name, config] of Object.entries(this.config)) {
      const server = await this.startServer(name, config);
      this.servers.set(name, server);
    }
  }
  
  async startServer(name, config) {
    const { spawn } = await import('child_process');
    
    const process = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Встановити stdio-based communication
    return new MCPServer(process, name);
  }
  
  async executeTool(toolName, parameters) {
    // Знайти який server має цей tool
    const server = this.findServerForTool(toolName);
    
    if (!server) {
      throw new Error(`Tool ${toolName} not available`);
    }
    
    // Виконати через MCP protocol
    return await server.call(toolName, parameters);
  }
  
  getAvailableTools() {
    const tools = [];
    
    for (const server of this.servers.values()) {
      tools.push(...server.getTools());
    }
    
    return tools;
  }
}
```

### 5. **Goose Backend** (orchestrator/ai/backends/goose-backend.js)

```javascript
/**
 * Goose Desktop backend (обгортка над існуючим goose-client)
 */
export class GooseBackend {
  constructor(config) {
    this.config = config;
  }
  
  async execute(prompt, context, options) {
    // Використовує існуючий goose-client.js
    return await callGooseAgent(prompt, context.sessionId, {
      agent: options.agent,
      enableTools: options.enableTools
    });
  }
}
```

---

## 🔄 INTEGRATION В ІСНУЮЧУ СИСТЕМУ

### Зміни в `agent-stage-processor.js`:

```javascript
// Замість:
const gooseResponse = await callGooseAgent(...);

// Стає:
const aiProvider = container.resolve('aiProvider');
const response = await aiProvider.execute(prompt, context, {
  agent: this.agent,
  enableTools: agentConfig.enableTools,
  sessionId: session.id
});
```

### Оновлення DI Container:

```javascript
// В service-registry.js
container.singleton('aiProvider', (c) => {
  const config = c.resolve('config');
  return new AIProviderInterface(config.AI_BACKEND_CONFIG);
}, {
  dependencies: ['config'],
  metadata: { category: 'ai', priority: 60 },
  lifecycle: {
    onInit: async function() {
      await this.initialize();
    }
  }
});

container.singleton('mcpManager', (c) => {
  const config = c.resolve('config');
  return new MCPManager(config.AI_BACKEND_CONFIG.providers.mcp.servers);
}, {
  dependencies: ['config'],
  metadata: { category: 'ai', priority: 65 }
});
```

---

## 📊 ПРИКЛАДИ ВИКОРИСТАННЯ

### Сценарій 1: Створення файлу (автоматичний routing до MCP)

```javascript
// Prompt містить "створи файл" → router вибирає MCP
const result = await aiProvider.execute(
  "Створи файл test.txt на Desktop з текстом Hello",
  { sessionId: 'xxx' }
);

// Flow:
// 1. Router → MCP (matching keyword "створи файл")
// 2. MCP Manager → filesystem server
// 3. Tool execution: createFile('/Users/.../Desktop/test.txt', 'Hello')
// 4. LLM generates response: "Файл створено на Desktop"
```

### Сценарій 2: Складний аналіз (автоматичний routing до Goose)

```javascript
// Prompt містить "проаналізуй" → router вибирає Goose
const result = await aiProvider.execute(
  "Проаналізуй тенденції ринку автомобілів в Україні",
  { sessionId: 'xxx' }
);

// Flow:
// 1. Router → Goose (matching keyword "проаналізуй")
// 2. Goose Desktop → LLM reasoning
// 3. Response з детальним аналізом
```

### Сценарій 3: Hybrid (MCP для дій, Goose для reasoning)

```javascript
// Prompt: "Знайди інформацію про Tesla Model S та створи файл з результатами"

// Flow:
// 1. Router → Goose (складна задача)
// 2. Goose → планує: web_scrape + createFile
// 3. MCP Manager виконує tools
// 4. Goose генерує summary
```

---

## ✅ ПЕРЕВАГИ МОДУЛЬНОЇ СИСТЕМИ

| Аспект | До | Після |
|--------|-------|--------|
| **Flexibility** | ❌ Hardcoded Goose | ✅ Switchable backends |
| **Performance** | ⚠️ Overhead через Goose | ✅ Direct MCP = швидше |
| **Reliability** | ❌ No fallback | ✅ Auto fallback |
| **Testing** | ❌ Потрібен Goose Desktop | ✅ Mock backends |
| **Cost** | ⚠️ Все через LLM | ✅ Simple tasks → MCP (без LLM) |
| **Configuration** | ❌ Hardcoded | ✅ Central config |

---

## 📋 ПЛАН ІМПЛЕМЕНТАЦІЇ

### Phase 1: Infrastructure (1-2 дні)
- [ ] Створити `AI_BACKEND_CONFIG` в `global-config.js`
- [ ] Створити `AIProviderInterface` base class
- [ ] Створити `MCPManager` для управління серверами
- [ ] Додати до DI Container

### Phase 2: Backends (2-3 дні)
- [ ] Рефакторити `goose-client.js` → `GooseBackend`
- [ ] Створити `MCPBackend` з direct MCP calls
- [ ] Створити `LLMClient` для MCP mode
- [ ] Тестування обох backends окремо

### Phase 3: Integration (1-2 дні)
- [ ] Замінити `callGooseAgent()` на `aiProvider.execute()`
- [ ] Оновити `agent-stage-processor.js`
- [ ] Додати routing logic
- [ ] Тестування hybrid mode

### Phase 4: Testing & Optimization (1 день)
- [ ] E2E тести для всіх modes
- [ ] Performance benchmarks
- [ ] Документація
- [ ] Приклади конфігурацій

**Total:** ~5-8 днів розробки

---

## 🎯 КРИТИЧНІ РІШЕННЯ

### 1. **MCP Communication Protocol**
- **Варіант A:** stdio-based (standard MCP)
- **Варіант B:** HTTP endpoints
- **Вибрано:** stdio-based (стандарт MCP)

### 2. **LLM для MCP Mode**
- **Варіант A:** Використовувати той самий endpoint (port 4000)
- **Варіант B:** Окремий lightweight LLM
- **Вибрано:** Port 4000 з gpt-4o-mini (швидкий + дешевий)

### 3. **Routing Strategy**
- **Варіант A:** Static rules (keywords)
- **Варіант B:** LLM classifier
- **Вибрано:** Hybrid (keywords + fallback to LLM)

---

## 📚 ПРИКЛАД КОНФІГУРАЦІЇ

```javascript
// .env
AI_BACKEND_MODE=hybrid
AI_BACKEND_PRIMARY=goose
AI_BACKEND_FALLBACK=mcp
GITHUB_TOKEN=ghp_xxx

// global-config.js автоматично читає
export const AI_BACKEND_CONFIG = {
  mode: process.env.AI_BACKEND_MODE || 'hybrid',
  primary: process.env.AI_BACKEND_PRIMARY || 'goose',
  fallback: process.env.AI_BACKEND_FALLBACK || 'mcp',
  ...
};
```

**Переключення режиму:**
```bash
# Тільки Goose
export AI_BACKEND_MODE=goose

# Тільки MCP
export AI_BACKEND_MODE=mcp

# Hybrid (автоматичний вибір)
export AI_BACKEND_MODE=hybrid
```

---

## 🚀 РЕЗУЛЬТАТ

**Після імплементації система матиме:**
- ✅ **3 режими**: `goose`, `mcp`, `hybrid`
- ✅ **Автоматичний routing** на основі prompt
- ✅ **Fallback mechanism** при збоях
- ✅ **Performance gain** для простих завдань
- ✅ **Easy testing** через mock backends
- ✅ **Central configuration** в one place

**Це робить ATLAS:**
- 🎯 **Flexible** - легко додати нові backends
- ⚡ **Fast** - прямий MCP без overhead
- 🛡️ **Reliable** - автоматичний fallback
- 🧪 **Testable** - mock backends для tests
- 📊 **Monitorable** - metrics для кожного backend

**ЦЕ ПРАВИЛЬНИЙ НАПРЯМОК! 🚀**
