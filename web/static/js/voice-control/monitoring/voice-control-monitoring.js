/**
 * @fileoverview Система моніторингу та метрик для voice-control
 * Збирає, аналізує та надає детальні метрики роботи всіх компонентів
 */

/**
 * @typedef {Object} MetricData
 * @property {string} name - Назва метрики
 * @property {number} value - Значення метрики
 * @property {string} type - Тип метрики (counter, gauge, histogram)
 * @property {Object} labels - Мітки метрики
 * @property {Date} timestamp - Час збору
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} averageLatency - Середня латентність (мс)
 * @property {number} successRate - Показник успішності (%)
 * @property {number} errorRate - Показник помилок (%)
 * @property {number} throughput - Пропускна здатність (операцій/сек)
 * @property {Object} percentiles - Персентилі латентності
 */

/**
 * @typedef {Object} SystemHealthReport
 * @property {string} status - Загальний статус системи
 * @property {number} uptime - Час роботи (мс)
 * @property {Object} services - Статус кожного сервісу
 * @property {PerformanceMetrics} performance - Метрики продуктивності
 * @property {Array} alerts - Активні попередження
 * @property {Date} timestamp - Час формування звіту
 */

/**
 * Колектор метрик для voice-control системи
 */
export class MetricsCollector {
  constructor(config = {}) {
    this.config = {
      retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 години
      samplingRate: config.samplingRate || 1.0, // 100% за замовчуванням
      aggregationInterval: config.aggregationInterval || 60000, // 1 хвилина
      maxMetrics: config.maxMetrics || 10000,
      ...config
    };

    // Сховище метрик
    this.metrics = new Map();
    this.histograms = new Map();
    this.counters = new Map();
    this.gauges = new Map();

    // Кеш для агрегованих даних
    this.aggregatedCache = new Map();
    this.cacheExpiry = new Map();

    // Таймери для очищення та агрегації
    this.cleanupTimer = null;
    this.aggregationTimer = null;

    // Система алертів
    this.alertRules = new Map();
    this.activeAlerts = new Map();

    // Статистика колектора
    this.collectorStats = {
      totalMetrics: 0,
      droppedMetrics: 0,
      lastCleanup: null,
      startTime: new Date()
    };

    this.startPeriodicTasks();
  }

  /**
     * Запуск періодичних задач
     */
  startPeriodicTasks() {
    // Очищення старих метрик
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.aggregationInterval);

    // Агрегація метрик
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);
  }

  /**
     * Запис метрики
     * @param {string} name - Назва метрики
     * @param {number} value - Значення
     * @param {Object} [labels={}] - Мітки
     * @param {string} [type='gauge'] - Тип метрики
     */
  record(name, value, labels = {}, type = 'gauge') {
    // Sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    const metric = {
      name,
      value,
      type,
      labels: { ...labels },
      timestamp: new Date()
    };

    // Зберігання в основному сховищі
    const key = this.getMetricKey(name, labels);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricsList = this.metrics.get(key);
    metricsList.push(metric);

    // Обмеження розміру
    if (metricsList.length > 1000) {
      metricsList.shift();
    }

    // Спеціалізоване зберігання за типом
    this.storeByType(name, value, labels, type);

    this.collectorStats.totalMetrics++;

    // Перевірка алертів
    this.checkAlerts(name, value, labels);
  }

  /**
     * Збереження метрики за типом
     * @param {string} name - Назва метрики
     * @param {number} value - Значення
     * @param {Object} labels - Мітки
     * @param {string} type - Тип метрики
     */
  storeByType(name, value, labels, type) {
    const key = this.getMetricKey(name, labels);

    switch (type) {
    case 'counter':
      const current = this.counters.get(key) || 0;
      this.counters.set(key, current + value);
      break;

    case 'gauge':
      this.gauges.set(key, value);
      break;

    case 'histogram':
      if (!this.histograms.has(key)) {
        this.histograms.set(key, []);
      }
      const histogram = this.histograms.get(key);
      histogram.push({ value, timestamp: new Date() });

      // Обмеження розміру гістограми
      if (histogram.length > 1000) {
        histogram.shift();
      }
      break;
    }
  }

  /**
     * Генерація ключа метрики
     * @param {string} name - Назва метрики
     * @param {Object} labels - Мітки
     * @returns {string} - Унікальний ключ
     */
  getMetricKey(name, labels) {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');

    return sortedLabels ? `${name}{${sortedLabels}}` : name;
  }

  /**
     * Отримання метрик за назвою
     * @param {string} name - Назва метрики
     * @param {Object} [filters={}] - Фільтри по мітках
     * @returns {Array<MetricData>} - Масив метрик
     */
  getMetrics(name, filters = {}) {
    const results = [];

    for (const [key, metricsList] of this.metrics) {
      if (key.startsWith(name)) {
        // Фільтрація по мітках
        const filteredMetrics = metricsList.filter(metric =>
          this.matchesFilters(metric.labels, filters)
        );

        results.push(...filteredMetrics);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
     * Перевірка відповідності фільтрам
     * @param {Object} labels - Мітки метрики
     * @param {Object} filters - Фільтри
     * @returns {boolean} - Чи відповідає
     */
  matchesFilters(labels, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (labels[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
     * Отримання агрегованих метрик
     * @param {string} name - Назва метрики
     * @param {Object} [options={}] - Опції агрегації
     * @returns {Object} - Агреговані дані
     */
  getAggregated(name, options = {}) {
    const {
      timeRange = 3600000, // 1 година
      aggregation = 'avg',
      groupBy = []
    } = options;

    const cacheKey = `${name}_${timeRange}_${aggregation}_${groupBy.join('_')}`;

    // Перевірка кешу
    if (this.aggregatedCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        return this.aggregatedCache.get(cacheKey);
      }
    }

    // Обчислення агрегації
    const cutoff = new Date(Date.now() - timeRange);
    const metrics = this.getMetrics(name).filter(m => m.timestamp >= cutoff);

    const result = this.aggregateMetricsList(metrics, aggregation, groupBy);

    // Кешування результату
    this.aggregatedCache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + 60000); // 1 хвилина кешу

    return result;
  }

  /**
     * Агрегація списку метрик
     * @param {Array} metrics - Метрики для агрегації
     * @param {string} aggregation - Тип агрегації
     * @param {Array} groupBy - Поля для групування
     * @returns {Object} - Результат агрегації
     */
  aggregateMetricsList(metrics, aggregation, groupBy) {
    if (metrics.length === 0) {
      return { value: 0, count: 0, min: 0, max: 0 };
    }

    const values = metrics.map(m => m.value);

    const result = {
      count: metrics.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };

    switch (aggregation) {
    case 'sum':
      result.value = values.reduce((a, b) => a + b, 0);
      break;
    case 'avg':
      result.value = values.reduce((a, b) => a + b, 0) / values.length;
      break;
    case 'p50':
      result.value = this.percentile(values, 0.5);
      break;
    case 'p95':
      result.value = this.percentile(values, 0.95);
      break;
    case 'p99':
      result.value = this.percentile(values, 0.99);
      break;
    default:
      result.value = result.avg;
    }

    // Групування якщо потрібно
    if (groupBy.length > 0) {
      result.groups = this.groupMetrics(metrics, groupBy);
    }

    return result;
  }

  /**
     * Обчислення персентиля
     * @param {Array<number>} values - Масив значень
     * @param {number} percentile - Персентиль (0-1)
     * @returns {number} - Значення персентиля
     */
  percentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
     * Групування метрик
     * @param {Array} metrics - Метрики
     * @param {Array} groupBy - Поля групування
     * @returns {Object} - Згруповані дані
     */
  groupMetrics(metrics, groupBy) {
    const groups = {};

    for (const metric of metrics) {
      const key = groupBy.map(field => metric.labels[field] || 'unknown').join('|');

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(metric.value);
    }

    // Агрегація кожної групи
    const result = {};
    for (const [key, values] of Object.entries(groups)) {
      result[key] = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }

    return result;
  }

  /**
     * Додавання правила алерту
     * @param {string} name - Назва алерту
     * @param {Object} rule - Правило алерту
     */
  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      metric: rule.metric,
      condition: rule.condition, // 'gt', 'lt', 'eq'
      threshold: rule.threshold,
      duration: rule.duration || 60000, // 1 хвилина
      severity: rule.severity || 'warning',
      description: rule.description || '',
      ...rule
    });
  }

  /**
     * Перевірка алертів
     * @param {string} metricName - Назва метрики
     * @param {number} value - Значення метрики
     * @param {Object} labels - Мітки метрики
     */
  checkAlerts(metricName, value, labels) {
    for (const [alertName, rule] of this.alertRules) {
      if (rule.metric !== metricName) continue;

      const alertKey = `${alertName}_${this.getMetricKey(metricName, labels)}`;
      const shouldAlert = this.evaluateCondition(value, rule.condition, rule.threshold);

      if (shouldAlert) {
        if (!this.activeAlerts.has(alertKey)) {
          // Новий алерт
          this.activeAlerts.set(alertKey, {
            name: alertName,
            metric: metricName,
            value,
            labels,
            threshold: rule.threshold,
            severity: rule.severity,
            description: rule.description,
            startTime: new Date(),
            lastSeen: new Date()
          });
        } else {
          // Оновлення існуючого алерту
          const alert = this.activeAlerts.get(alertKey);
          alert.lastSeen = new Date();
          alert.value = value;
        }
      } else {
        // Алерт більше не активний
        this.activeAlerts.delete(alertKey);
      }
    }
  }

  /**
     * Оцінка умови алерту
     * @param {number} value - Значення
     * @param {string} condition - Умова
     * @param {number} threshold - Поріг
     * @returns {boolean} - Результат оцінки
     */
  evaluateCondition(value, condition, threshold) {
    switch (condition) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'neq': return value !== threshold;
    default: return false;
    }
  }

  /**
     * Отримання активних алертів
     * @returns {Array} - Масив активних алертів
     */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
     * Очищення старих метрик
     */
  cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    let cleaned = 0;

    for (const [key, metricsList] of this.metrics) {
      const filtered = metricsList.filter(m => m.timestamp >= cutoff);

      if (filtered.length !== metricsList.length) {
        cleaned += metricsList.length - filtered.length;

        if (filtered.length === 0) {
          this.metrics.delete(key);
        } else {
          this.metrics.set(key, filtered);
        }
      }
    }

    // Очищення кешу
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry) {
      if (expiry <= now) {
        this.aggregatedCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }

    this.collectorStats.lastCleanup = new Date();

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old metrics`);
    }
  }

  /**
     * Агрегація метрик
     */
  aggregateMetrics() {
    // Тут можна додати логіку для створення агрегованих метрик
    // наприклад, хвилинні, годинні агрегати тощо
  }

  /**
     * Експорт метрик у форматі Prometheus
     * @returns {string} - Метрики у форматі Prometheus
     */
  exportPrometheus() {
    const lines = [];

    // Counters
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    // Histograms (спрощено)
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b.value, 0);
        const count = values.length;

        lines.push(`${key}_sum ${sum}`);
        lines.push(`${key}_count ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
     * Отримання статистики колектора
     * @returns {Object} - Статистика
     */
  getStats() {
    return {
      ...this.collectorStats,
      uptime: Date.now() - this.collectorStats.startTime,
      metricsCount: this.metrics.size,
      countersCount: this.counters.size,
      gaugesCount: this.gauges.size,
      histogramsCount: this.histograms.size,
      activeAlertsCount: this.activeAlerts.size,
      cacheSize: this.aggregatedCache.size
    };
  }

  /**
     * Знищення колектора
     */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    this.metrics.clear();
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
    this.aggregatedCache.clear();
    this.cacheExpiry.clear();
    this.alertRules.clear();
    this.activeAlerts.clear();
  }
}

/**
 * Система моніторингу для voice-control
 */
export class VoiceControlMonitoring {
  constructor(config = {}) {
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      enableAlerts: config.enableAlerts !== false,
      metricsInterval: config.metricsInterval || 5000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      ...config
    };

    this.metricsCollector = new MetricsCollector(config.metrics || {});
    this.services = new Map();
    this.systemStartTime = new Date();

    // Таймери
    this.metricsTimer = null;
    this.healthTimer = null;

    // Callbacks
    this.onAlert = config.onAlert || null;
    this.onHealthChange = config.onHealthChange || null;

    this.setupDefaultAlerts();
    this.startMonitoring();
  }

  /**
     * Налаштування стандартних алертів
     */
  setupDefaultAlerts() {
    if (!this.config.enableAlerts) return;

    // Алерт на високу латентність транскрипції
    this.metricsCollector.addAlertRule('high_transcription_latency', {
      metric: 'whisper_transcription_duration',
      condition: 'gt',
      threshold: 5000, // 5 секунд
      severity: 'warning',
      description: 'Transcription taking too long'
    });

    // Алерт на високий рівень помилок
    this.metricsCollector.addAlertRule('high_error_rate', {
      metric: 'voice_control_error_rate',
      condition: 'gt',
      threshold: 0.1, // 10%
      severity: 'critical',
      description: 'High error rate detected'
    });

    // Алерт на низьку успішність розпізнавання
    this.metricsCollector.addAlertRule('low_recognition_success', {
      metric: 'speech_recognition_success_rate',
      condition: 'lt',
      threshold: 0.8, // 80%
      severity: 'warning',
      description: 'Low speech recognition success rate'
    });
  }

  /**
     * Початок моніторингу
     */
  startMonitoring() {
    if (!this.config.enableMetrics) return;

    // Періодичний збір метрик
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metricsInterval);

    // Перевірка здоров'я сервісів
    this.healthTimer = setInterval(() => {
      this.checkServicesHealth();
    }, this.config.healthCheckInterval);
  }

  /**
     * Реєстрація сервісу для моніторингу
     * @param {string} name - Назва сервісу
     * @param {Object} service - Об'єкт сервісу
     */
  registerService(name, service) {
    this.services.set(name, {
      service,
      lastHealthCheck: null,
      healthy: true,
      metrics: new Map()
    });
  }

  /**
     * Запис метрики
     * @param {string} name - Назва метрики
     * @param {number} value - Значення
     * @param {Object} labels - Мітки
     * @param {string} type - Тип метрики
     */
  recordMetric(name, value, labels = {}, type = 'gauge') {
    if (this.config.enableMetrics) {
      this.metricsCollector.record(name, value, labels, type);
    }
  }

  /**
     * Збір системних метрик
     */
  collectSystemMetrics() {
    try {
      // Uptime системи
      const uptime = Date.now() - this.systemStartTime;
      this.recordMetric('voice_control_uptime', uptime, {}, 'gauge');

      // Використання пам'яті (якщо доступно)
      if (performance && performance.memory) {
        this.recordMetric('voice_control_memory_used',
          performance.memory.usedJSHeapSize, {}, 'gauge');
        this.recordMetric('voice_control_memory_total',
          performance.memory.totalJSHeapSize, {}, 'gauge');
      }

      // Кількість зареєстрованих сервісів
      this.recordMetric('voice_control_services_count',
        this.services.size, {}, 'gauge');

      // Статистика метрик
      const stats = this.metricsCollector.getStats();
      this.recordMetric('voice_control_metrics_total',
        stats.totalMetrics, {}, 'counter');

    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  /**
     * Перевірка здоров'я сервісів
     */
  async checkServicesHealth() {
    for (const [name, serviceData] of this.services) {
      try {
        const service = serviceData.service;
        let healthy = true;

        // Перевірка здоров'я сервісу
        if (typeof service.checkHealth === 'function') {
          healthy = await service.checkHealth();
        } else if (typeof service.isHealthy === 'function') {
          healthy = service.isHealthy();
        } else {
          // Базова перевірка - чи ініціалізований сервіс
          healthy = service.isInitialized !== false;
        }

        // Запис метрики здоров'я
        this.recordMetric('service_health', healthy ? 1 : 0,
          { service: name }, 'gauge');

        // Перевірка зміни статусу
        if (serviceData.healthy !== healthy) {
          if (this.onHealthChange) {
            this.onHealthChange(name, healthy, serviceData.healthy);
          }

          serviceData.healthy = healthy;
        }

        serviceData.lastHealthCheck = new Date();

      } catch (error) {
        console.error(`Error checking health of service ${name}:`, error);
        this.recordMetric('service_health', 0,
          { service: name }, 'gauge');
      }
    }
  }

  /**
     * Генерація звіту про здоров'я системи
     * @returns {SystemHealthReport} - Звіт про здоров'я
     */
  generateHealthReport() {
    const services = {};
    let overallHealthy = true;

    // Статус кожного сервісу
    for (const [name, data] of this.services) {
      services[name] = {
        healthy: data.healthy,
        lastCheck: data.lastHealthCheck
      };

      if (!data.healthy) {
        overallHealthy = false;
      }
    }

    // Загальні метрики продуктивності
    const performance = {
      averageLatency: this.getAverageMetric('whisper_transcription_duration'),
      successRate: this.getAverageMetric('speech_recognition_success_rate'),
      errorRate: this.getAverageMetric('voice_control_error_rate'),
      throughput: this.calculateThroughput()
    };

    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      uptime: Date.now() - this.systemStartTime,
      services,
      performance,
      alerts: this.metricsCollector.getActiveAlerts(),
      timestamp: new Date()
    };
  }

  /**
     * Отримання середнього значення метрики
     * @param {string} metricName - Назва метрики
     * @returns {number} - Середнє значення
     */
  getAverageMetric(metricName) {
    try {
      const aggregated = this.metricsCollector.getAggregated(metricName, {
        timeRange: 300000, // 5 хвилин
        aggregation: 'avg'
      });

      return aggregated.value || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
     * Розрахунок пропускної здатності
     * @returns {number} - Операцій на секунду
     */
  calculateThroughput() {
    try {
      const transcriptions = this.metricsCollector.getAggregated('whisper_transcription_count', {
        timeRange: 60000, // 1 хвилина
        aggregation: 'sum'
      });

      return (transcriptions.value || 0) / 60; // операцій на секунду
    } catch (error) {
      return 0;
    }
  }

  /**
     * Експорт метрик
     * @param {string} format - Формат експорту
     * @returns {string|Object} - Експортовані дані
     */
  exportMetrics(format = 'json') {
    switch (format) {
    case 'prometheus':
      return this.metricsCollector.exportPrometheus();

    case 'json':
    default:
      return {
        system: this.generateHealthReport(),
        metrics: this.metricsCollector.getStats(),
        timestamp: new Date()
      };
    }
  }

  /**
     * Зупинка моніторингу
     */
  stopMonitoring() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
     * Знищення системи моніторингу
     */
  destroy() {
    this.stopMonitoring();
    this.metricsCollector.destroy();
    this.services.clear();
  }
}

export default VoiceControlMonitoring;
