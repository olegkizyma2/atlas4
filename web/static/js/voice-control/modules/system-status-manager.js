/**
 * Voice Control System Status Manager - v4.0
 * Відповідає за моніторинг стану системи та надання статусної інформації
 */

export class SystemStatusManager {
  constructor(serviceManager, eventManager, logger) {
    this.serviceManager = serviceManager;
    this.eventManager = eventManager;
    this.logger = logger;

    // Стан системи
    this.isInitialized = false;
    this.isActive = false;
    this.initializationPromise = null;

    // Статистика системи
    this.systemStatistics = {
      startTime: null,
      uptime: 0,
      totalTranscriptions: 0,
      totalKeywordDetections: 0,
      totalErrors: 0,
      serviceRestarts: 0,
      lastActivity: null
    };

    // Помилки запуску
    this.startupErrors = [];

    // Callbacks
    this.onSystemReady = null;
  }

  /**
     * Встановлення статусу ініціалізації
     */
  setInitialized(status) {
    this.isInitialized = status;
    if (status) {
      this.systemStatistics.startTime = new Date();
    }
  }

  /**
     * Встановлення статусу активності
     */
  setActive(status) {
    this.isActive = status;
  }

  /**
     * Додавання помилки запуску
     */
  addStartupError(error, service = null, phase = 'unknown') {
    this.startupErrors.push({
      error,
      service,
      timestamp: new Date(),
      phase
    });
  }

  /**
     * Оновлення статистики
     */
  updateStatistics(updates) {
    Object.assign(this.systemStatistics, updates);
  }

  /**
     * Інкремент статистики
     */
  incrementStatistic(name) {
    if (this.systemStatistics.hasOwnProperty(name)) {
      this.systemStatistics[name]++;
    }
  }

  /**
     * Перевірка здоров'я системи
     */
  async checkSystemHealth() {
    if (!this.isInitialized) {
      return false;
    }

    // Перевірка критично важливих сервісів
    const criticalServices = ['whisper', 'microphone'];

    for (const serviceName of criticalServices) {
      const service = this.serviceManager.getService(serviceName);

      if (!service || !await service.checkHealth()) {
        this.logger.warn(`Critical service ${serviceName} is unhealthy`);
        return false;
      }
    }

    return true;
  }

  /**
     * Отримання повного статусу системи
     */
  async getSystemStatus() {
    const services = {};
    const servicesHealth = await this.serviceManager.checkServicesHealth();

    // Збираємо інформацію про кожен сервіс
    for (const [name, service] of this.serviceManager.getAllServices()) {
      services[name] = {
        initialized: !!service,
        healthy: servicesHealth.get(name) || false,
        type: service.constructor.name
      };
    }

    // Обчислюємо uptime
    if (this.systemStatistics.startTime) {
      this.systemStatistics.uptime = Date.now() - this.systemStatistics.startTime.getTime();
    }

    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      services,
      capabilities: this.getSystemCapabilities(),
      errors: this.startupErrors,
      statistics: { ...this.systemStatistics },
      health: await this.checkSystemHealth(),
      timestamp: new Date()
    };
  }

  /**
     * Отримання можливостей системи
     */
  getSystemCapabilities() {
    const services = this.serviceManager.getAllServices();

    return {
      transcription: services.has('whisper'),
      keywordDetection: services.has('keyword'),
      postChatAnalysis: services.has('postChat'),
      microphoneButton: services.has('microphone'),
      speechResults: services.has('results'),
      totalServices: services.size
    };
  }

  /**
     * Отримання спрощеного статусу
     */
  getSimpleStatus() {
    return {
      initialized: this.isInitialized,
      active: this.isActive,
      healthy: this.isInitialized && this.isActive,
      servicesCount: this.serviceManager.getAllServices().size,
      errors: this.startupErrors.length
    };
  }

  /**
     * Отримання статистики системи
     */
  getStatistics() {
    // Обчислюємо uptime
    if (this.systemStatistics.startTime) {
      this.systemStatistics.uptime = Date.now() - this.systemStatistics.startTime.getTime();
    }

    return { ...this.systemStatistics };
  }

  /**
     * Скидання статистики
     */
  resetStatistics() {
    const startTime = this.systemStatistics.startTime;
    this.systemStatistics = {
      startTime,
      uptime: 0,
      totalTranscriptions: 0,
      totalKeywordDetections: 0,
      totalErrors: 0,
      serviceRestarts: 0,
      lastActivity: null
    };
  }

  /**
     * Очищення помилок запуску
     */
  clearStartupErrors() {
    this.startupErrors = [];
  }

  /**
     * Встановлення callback готовності системи
     */
  setSystemReadyCallback(callback) {
    this.onSystemReady = callback;
  }

  /**
     * Виклик callback готовності системи
     */
  async triggerSystemReady() {
    if (this.onSystemReady) {
      try {
        const status = await this.getSystemStatus();
        this.onSystemReady(status);
      } catch (error) {
        this.logger.warn('Error in system ready callback', null, error);
      }
    }
  }

  /**
     * Форматування uptime для читання
     */
  getFormattedUptime() {
    const uptime = this.systemStatistics.uptime;
    if (!uptime) return '0s';

    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (seconds > 0) result += `${seconds}s`;

    return result.trim() || '0s';
  }

  /**
     * Отримання детального звіту
     */
  async getDetailedReport() {
    const status = await this.getSystemStatus();

    return {
      ...status,
      formattedUptime: this.getFormattedUptime(),
      serviceDetails: await this.getServiceDetails(),
      systemLoad: this.getSystemLoad(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
     * Отримання деталей сервісів
     */
  async getServiceDetails() {
    const details = {};

    for (const [name, service] of this.serviceManager.getAllServices()) {
      details[name] = {
        name: service.name || name,
        version: service.version || 'unknown',
        status: service.isInitialized ? 'initialized' : 'not-initialized',
        healthy: await service.checkHealth().catch(() => false)
      };
    }

    return details;
  }

  /**
     * Отримання навантаження системи (заглушка)
     */
  getSystemLoad() {
    // В браузері складно отримати точне навантаження CPU
    return {
      cpu: 'unavailable',
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : 'unavailable'
    };
  }

  /**
     * Отримання використання пам'яті
     */
  getMemoryUsage() {
    if (performance.memory) {
      const memory = performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
        percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      };
    }

    return null;
  }
}
