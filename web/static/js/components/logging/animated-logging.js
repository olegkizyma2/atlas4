/**
 * ATLAS Animated Logging System - v4.0
 *
 * Модуль для відображення логів з вертикальним потоком (спадання вниз)
 * у синьо-зеленому стилі з анімаціями у хакерському стилі
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} level - Рівень лога (info, warn, error, debug, system)
 * @property {string} message - Повідомлення лога
 * @property {string} timestamp - Мітка часу
 * @property {string} source - Джерело повідомлення
 * @property {Object} metadata - Додаткові дані
 */

export class AnimatedLoggingSystem {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`Logging container with ID '${containerId}' not found`);
    }

    // Конфігурація з дефолтними значеннями
    this.config = {
      maxLogs: options.maxLogs || 1000,
      autoScroll: options.autoScroll !== false,
      showTimestamp: options.showTimestamp !== false,
      animationDuration: options.animationDuration || 300,
      fadeOutDelay: options.fadeOutDelay || 5000,
      enableGlow: options.enableGlow !== false,
      enableTypewriter: options.enableTypewriter !== false,
      typewriterSpeed: options.typewriterSpeed || 30,
      colors: {
        info: '#00ffff',      // Яскраво-синій
        warn: '#ffaa00',      // Помаранчевий
        error: '#ff4444',     // Червоний
        debug: '#44ff44',     // Зелений
        system: '#ff00ff',    // Пурпуровий
        success: '#00ff7f',   // Зелено-синій
        ...options.colors
      },
      ...options
    };

    this.logQueue = [];
    this.isProcessing = false;
    this.logHistory = [];
    this.filters = {
      levels: new Set(['info', 'warn', 'error', 'debug', 'system', 'success']),
      sources: new Set()
    };

    this.init();
  }

  init() {
    this.setupContainer();
    this.setupStyles();
    this.setupControls();
    this.startProcessingQueue();

    // Додаємо тестове повідомлення для демонстрації
    this.log('system', 'Animated Logging System v4.0 initialized', 'LoggingSystem');
  }

  setupContainer() {
    // Очищаємо контейнер та налаштовуємо його
    this.container.innerHTML = '';
    this.container.className = 'animated-logs-container';

    // Створюємо внутрішні елементи
    const header = document.createElement('div');
    header.className = 'logs-header';
    header.innerHTML = `
            <div class="logs-title">
                <span class="title-icon">▼</span>
                <span class="title-text">ATLAS SYSTEM LOGS</span>
                <span class="log-count">0</span>
            </div>
            <div class="logs-controls">
                <button class="log-btn" id="clear-logs" title="Очистити логи">⌫</button>
                <button class="log-btn" id="pause-logs" title="Пауза/Продовжити">⏸</button>
                <button class="log-btn" id="download-logs" title="Завантажити логи">⬇</button>
            </div>
        `;

    const content = document.createElement('div');
    content.className = 'logs-content';
    content.id = `${this.containerId}-content`;

    const footer = document.createElement('div');
    footer.className = 'logs-footer';
    footer.innerHTML = `
            <div class="logs-stats">
                <span class="stat">INFO: <span id="info-count">0</span></span>
                <span class="stat">WARN: <span id="warn-count">0</span></span>
                <span class="stat">ERROR: <span id="error-count">0</span></span>
            </div>
        `;

    this.container.appendChild(header);
    this.container.appendChild(content);
    this.container.appendChild(footer);

    this.contentContainer = content;
    this.setupEventListeners();
  }

  setupStyles() {
    // Додаємо CSS стилі якщо їх ще немає
    if (!document.getElementById('animated-logs-styles')) {
      const style = document.createElement('style');
      style.id = 'animated-logs-styles';
      style.textContent = `
                .animated-logs-container {
                    background: linear-gradient(135deg, 
                        rgba(0, 20, 30, 0.95) 0%, 
                        rgba(0, 40, 60, 0.92) 50%, 
                        rgba(0, 20, 40, 0.95) 100%);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    border-radius: 8px;
                    font-family: 'Courier New', 'Monaco', monospace;
                    font-size: 11px;
                    color: #00ffff;
                    height: 100%;
                    min-height: 100%;
                    max-height: 100%;
                    display: flex;
                    flex-direction: column;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                }
                
                .logs-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(0, 255, 255, 0.05);
                    border-bottom: 1px solid rgba(0, 255, 255, 0.2);
                    backdrop-filter: blur(5px);
                }
                
                .logs-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #00ff7f;
                    font-weight: bold;
                }
                
                .title-icon {
                    animation: pulse 2s infinite;
                }
                
                .log-count {
                    background: rgba(0, 255, 127, 0.2);
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                    min-width: 20px;
                    text-align: center;
                }
                
                .logs-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .log-btn {
                    background: rgba(0, 255, 255, 0.1);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    color: #00ffff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: all 0.3s ease;
                }
                
                .log-btn:hover {
                    background: rgba(0, 255, 255, 0.2);
                    box-shadow: 0 0 8px rgba(0, 255, 255, 0.4);
                    transform: scale(1.05);
                }
                
                .logs-content {
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    scroll-behavior: smooth;
                }
                
                .logs-content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .logs-content::-webkit-scrollbar-track {
                    background: rgba(0, 20, 30, 0.5);
                    border-radius: 4px;
                }
                
                .logs-content::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 255, 0.3);
                    border-radius: 4px;
                }
                
                .logs-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 255, 255, 0.5);
                }
                
                .log-entry {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    margin-bottom: 1px;
                    background: rgba(0, 20, 30, 0.3);
                    border-left: 3px solid transparent;
                    transition: all 0.3s ease;
                    animation: slideIn 0.3s ease-out;
                    position: relative;
                    overflow: visible;
                    flex-shrink: 0;
                    min-height: fit-content;
                }
                
                .log-entry:hover {
                    background: rgba(0, 40, 60, 0.4);
                    transform: translateX(2px);
                }
                
                .log-entry.level-info { border-left-color: #00ffff; }
                .log-entry.level-warn { border-left-color: #ffaa00; }
                .log-entry.level-error { border-left-color: #ff4444; }
                .log-entry.level-debug { border-left-color: #44ff44; }
                .log-entry.level-system { border-left-color: #ff00ff; }
                .log-entry.level-success { border-left-color: #00ff7f; }
                
                .log-timestamp {
                    font-size: 9px !important;
                    color: rgba(0, 255, 255, 0.6);
                    min-width: 60px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                
                .log-level {
                    font-size: 9px !important;
                    font-weight: bold;
                    min-width: 40px;
                    text-align: center;
                    padding: 1px 4px;
                    border-radius: 2px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }
                
                .log-level.info { 
                    background: rgba(0, 255, 255, 0.2); 
                    color: #00ffff; 
                }
                .log-level.warn { 
                    background: rgba(255, 170, 0, 0.2); 
                    color: #ffaa00; 
                }
                .log-level.error { 
                    background: rgba(255, 68, 68, 0.2); 
                    color: #ff4444; 
                }
                .log-level.debug { 
                    background: rgba(68, 255, 68, 0.2); 
                    color: #44ff44; 
                }
                .log-level.system { 
                    background: rgba(255, 0, 255, 0.2); 
                    color: #ff00ff; 
                }
                .log-level.success { 
                    background: rgba(0, 255, 127, 0.2); 
                    color: #00ff7f; 
                }
                
                .log-source {
                    font-size: 8px !important;
                    color: rgba(0, 255, 255, 0.5);
                    min-width: 50px;
                    text-align: left;
                    flex-shrink: 0;
                }
                
                .log-message {
                    flex: 1 1 auto;
                    min-width: 0;
                    color: #ffffff;
                    font-size: 11px !important;
                    line-height: 1.3 !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    white-space: pre-wrap;
                }
                
                .log-message.typewriter {
                    overflow: hidden;
                    border-right: 2px solid #00ffff;
                    animation: typewriter 2s steps(40, end), blink-caret 1s step-end infinite;
                }
                
                .logs-footer {
                    padding: 6px 12px;
                    background: rgba(0, 255, 255, 0.05);
                    border-top: 1px solid rgba(0, 255, 255, 0.2);
                    font-size: 9px;
                }
                
                .logs-stats {
                    display: flex;
                    gap: 12px;
                }
                
                .stat {
                    color: rgba(0, 255, 255, 0.7);
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes typewriter {
                    from { width: 0; }
                    to { width: 100%; }
                }
                
                @keyframes blink-caret {
                    from, to { border-color: transparent; }
                    50% { border-color: #00ffff; }
                }
                
                @keyframes glow {
                    0%, 100% { 
                        box-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
                    }
                    50% { 
                        box-shadow: 0 0 20px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.3);
                    }
                }
                
                .log-entry.glow {
                    animation: glow 2s ease-in-out infinite;
                }
                
                .paused .logs-content {
                    opacity: 0.6;
                }
                
                .paused .title-icon::after {
                    content: ' [PAUSED]';
                    color: #ffaa00;
                    font-size: 8px;
                }
            `;
      document.head.appendChild(style);
    }
  }

  setupEventListeners() {
    const clearBtn = document.getElementById('clear-logs');
    const pauseBtn = document.getElementById('pause-logs');
    const downloadBtn = document.getElementById('download-logs');

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadLogs());
    }
  }

  setupControls() {
    // Додаткові контроли можна додати тут
  }

  startProcessingQueue() {
    // Обробка черги логів
    setInterval(() => {
      if (!this.isProcessing && this.logQueue.length > 0) {
        this.processNextLog();
      }
    }, 50);
  }

  async processNextLog() {
    if (this.logQueue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const logEntry = this.logQueue.shift();

    await this.renderLog(logEntry);
    this.updateStats();

    this.isProcessing = false;
  }

  async renderLog(logEntry) {
    const logElement = document.createElement('div');
    logElement.className = `log-entry level-${logEntry.level}`;

    if (this.config.enableGlow) {
      logElement.classList.add('glow');
      setTimeout(() => logElement.classList.remove('glow'), 2000);
    }

    const timestamp = this.config.showTimestamp ?
      `<span class="log-timestamp">${logEntry.timestamp}</span>` : '';

    const source = logEntry.source ?
      `<span class="log-source">[${logEntry.source}]</span>` : '';

    logElement.innerHTML = `
            ${timestamp}
            <span class="log-level ${logEntry.level}">${logEntry.level}</span>
            ${source}
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;

    this.contentContainer.appendChild(logElement);

    // Typewriter effect
    if (this.config.enableTypewriter) {
      const messageElement = logElement.querySelector('.log-message');
      messageElement.classList.add('typewriter');
      await this.typewriterEffect(messageElement, logEntry.message);
    }

    // Автоскролл
    if (this.config.autoScroll) {
      this.contentContainer.scrollTop = this.contentContainer.scrollHeight;
    }

    // Видаляємо старі логи
    this.cleanupOldLogs();
  }

  async typewriterEffect(element, text) {
    element.textContent = '';
    element.classList.add('typewriter');

    for (let i = 0; i <= text.length; i++) {
      element.textContent = text.slice(0, i);
      await new Promise(resolve => setTimeout(resolve, this.config.typewriterSpeed));
    }

    element.classList.remove('typewriter');
  }

  cleanupOldLogs() {
    const entries = this.contentContainer.querySelectorAll('.log-entry');
    if (entries.length > this.config.maxLogs) {
      const toRemove = entries.length - this.config.maxLogs;
      for (let i = 0; i < toRemove; i++) {
        entries[i].remove();
      }
    }
  }

  updateStats() {
    const countElement = document.querySelector('.log-count');
    const infoCount = document.getElementById('info-count');
    const warnCount = document.getElementById('warn-count');
    const errorCount = document.getElementById('error-count');

    const entries = this.contentContainer.querySelectorAll('.log-entry');

    if (countElement) {
      countElement.textContent = entries.length;
    }

    if (infoCount) {
      infoCount.textContent = this.contentContainer.querySelectorAll('.level-info, .level-debug, .level-system, .level-success').length;
    }

    if (warnCount) {
      warnCount.textContent = this.contentContainer.querySelectorAll('.level-warn').length;
    }

    if (errorCount) {
      errorCount.textContent = this.contentContainer.querySelectorAll('.level-error').length;
    }
  }

  /**
     * Додає новий лог запис
     * @param {string} level - Рівень лога
     * @param {string} message - Повідомлення
     * @param {string} source - Джерело (опціонально)
     * @param {Object} metadata - Додаткові дані (опціонально)
     */
  log(level, message, source = '', metadata = {}) {
    const logEntry = {
      level: level.toLowerCase(),
      message,
      source,
      metadata,
      timestamp: new Date().toLocaleTimeString('uk-UA', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };

    this.logHistory.push(logEntry);
    this.logQueue.push(logEntry);
  }

  // Зручні методи для різних рівнів логування
  info(message, source = '') { this.log('info', message, source); }
  warn(message, source = '') { this.log('warn', message, source); }
  error(message, source = '') { this.log('error', message, source); }
  debug(message, source = '') { this.log('debug', message, source); }
  system(message, source = '') { this.log('system', message, source); }
  success(message, source = '') { this.log('success', message, source); }

  /**
     * Додає лог із готового об'єкта (для WebSocket повідомлень)
     * @param {Object} logEntry - Готовий об'єкт лога
     */
  addLog(logEntry) {
    if (!logEntry || typeof logEntry !== 'object') {
      this.warn('Invalid log entry received', 'AnimatedLoggingSystem');
      return;
    }

    // Переконуємося, що у нас є мінімальні необхідні поля
    const processedEntry = {
      level: logEntry.level || 'info',
      message: logEntry.message || JSON.stringify(logEntry),
      source: logEntry.source || logEntry.category || 'WebSocket',
      metadata: logEntry.metadata || logEntry.data || {},
      timestamp: logEntry.timestamp || new Date().toLocaleTimeString('uk-UA', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      id: logEntry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };

    this.logHistory.push(processedEntry);
    this.logQueue.push(processedEntry);
  }

  clear() {
    this.contentContainer.innerHTML = '';
    this.logHistory = [];
    this.updateStats();
    this.log('system', 'Logs cleared', 'LoggingSystem');
  }

  togglePause() {
    const isPaused = this.container.classList.toggle('paused');
    const pauseBtn = document.getElementById('pause-logs');
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? '▶' : '⏸';
      pauseBtn.title = isPaused ? 'Продовжити' : 'Пауза';
    }
    this.log('system', `Logging ${isPaused ? 'paused' : 'resumed'}`, 'LoggingSystem');
  }

  downloadLogs() {
    const logsText = this.logHistory.map(log =>
      `${log.timestamp} [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.log('system', 'Logs downloaded', 'LoggingSystem');
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Експорт за замовчуванням
export default AnimatedLoggingSystem;
