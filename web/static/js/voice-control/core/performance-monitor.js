/**
 * @fileoverview Real-time Performance Monitoring System для ATLAS Voice Services
 * Забезпечує збір метрик, аналіз bottlenecks та автоматичні alerts
 * Реалізує patterns: Observer + Metrics Aggregator + Alert Manager + Performance Observer
 */

import { VoiceLogger } from '../utils/voice-logger.js';
import { Events } from '../events/event-manager.js';
import { BaseService } from './base-service.js';

/**
 * @typedef {Object} PerformanceMetric
 * @property {string} name - Назва метрики
 * @property {number} value - Значення метрики
 * @property {string} unit - Одиниця вимірювання
 * @property {number} timestamp - Час збору метрики
 * @property {Object} metadata - Додаткові дані
 */

/**
 * @typedef {Object} AlertRule
 * @property {string} metric - Назва метрики
 * @property {number} threshold - Поріг для alert
 * @property {'above'|'below'|'equals'} condition - Умова
 * @property {'critical'|'warning'|'info'} severity - Рівень критичності
 * @property {Function} action - Дія при спрацьовуванні
 */

/**
 * Circular Buffer для ефективного зберігання метрик
 */
class CircularBuffer {
  constructor(size) {
    this.buffer = new Array(size);
    this.size = size;
    this.index = 0;
    this.count = 0;
  }

  add(item) {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  getAll() {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }

    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }

  getLast(n = 1) {
    const all = this.getAll();
    return all.slice(-n);
  }

  clear() {
    this.index = 0;
    this.count = 0;
  }
}

/**
 * Metrics Collector для збору performance метрик
 */
export class MetricsCollector {
  constructor(config = {}) {
    this.config = {
      bufferSize: 1000,
      aggregationWindow: 5000,
      sampleRate: 100, // мс між зборами
      ...config
    };

    this.metrics = new Map();
    this.aggregatedMetrics = new Map();
    this.collectors = new Map();
    this.isRunning = false;

    this.logger = new VoiceLogger('MetricsCollector');
  }

  /**
     * Реєстрація збирача метрик
     */
  registerCollector(name, collector) {
    this.collectors.set(name, {
      collect: collector,
      buffer: new CircularBuffer(this.config.bufferSize),
      lastCollection: 0
    });

    this.logger.debug('Collector registered', { name });
  }

  /**
     * Запуск збору метрик
     */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.collectMetrics();

    this.logger.info('Metrics collection started');
  }

  /**
     * Зупинка збору метрик
     */
  stop() {
    this.isRunning = false;
    this.logger.info('Metrics collection stopped');
  }

  /**
     * Основний цикл збору метрик
     * @private
     */
  async collectMetrics() {
    if (!this.isRunning) return;

    const now = performance.now();

    // Збір метрик від усіх зареєстрованих collectors
    for (const [name, collectorInfo] of this.collectors) {
      try {
        const metric = await collectorInfo.collect();
        if (metric !== null && metric !== undefined) {
          collectorInfo.buffer.add({
            ...metric,
            timestamp: now,
            collectorName: name
          });
          collectorInfo.lastCollection = now;
        }
      } catch (error) {
        this.logger.warn('Metric collection failed', {
          collector: name,
          error: error.message
        });
      }
    }

    // Планування наступного збору
    setTimeout(() => this.collectMetrics(), this.config.sampleRate);
  }

  /**
     * Отримання останніх метрик
     */
  getRecentMetrics(collectorName, count = 10) {
    const collector = this.collectors.get(collectorName);
    if (!collector) return [];

    return collector.buffer.getLast(count);
  }

  /**
     * Отримання агрегованих метрик
     */
  getAggregatedMetrics(collectorName, windowMs = this.config.aggregationWindow) {
    const collector = this.collectors.get(collectorName);
    if (!collector) return null;

    const now = performance.now();
    const metrics = collector.buffer.getAll()
      .filter(metric => now - metric.timestamp <= windowMs);

    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      windowMs,
      timestamp: now
    };
  }

  /**
     * Обчислення перцентилів
     * @private
     */
  percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Alert Manager для обробки попереджень
 */
export class AlertManager {
  constructor(config = {}) {
    this.config = {
      alertCooldown: 30000, // 30 секунд між однаковими alerts
      maxAlertsPerMinute: 10,
      ...config
    };

    this.rules = new Map();
    this.alertHistory = new CircularBuffer(1000);
    this.lastAlerts = new Map();
    this.alertCount = new Map();

    this.logger = new VoiceLogger('AlertManager');
  }

  /**
     * Додавання правила alert
     */
  addRule(id, rule) {
    this.rules.set(id, {
      ...rule,
      id,
      createdAt: Date.now(),
      triggerCount: 0
    });

    this.logger.debug('Alert rule added', { id, rule });
  }

  /**
     * Видалення правила alert
     */
  removeRule(id) {
    this.rules.delete(id);
    this.lastAlerts.delete(id);
    this.alertCount.delete(id);

    this.logger.debug('Alert rule removed', { id });
  }

  /**
     * Перевірка метрики на відповідність правилам
     */
  checkMetric(metricName, value, metadata = {}) {
    const now = Date.now();

    for (const [ruleId, rule] of this.rules) {
      if (rule.metric !== metricName) continue;

      const shouldAlert = this.evaluateCondition(rule, value);
      if (!shouldAlert) continue;

      // Перевірка cooldown
      const lastAlert = this.lastAlerts.get(ruleId);
      if (lastAlert && (now - lastAlert) < this.config.alertCooldown) {
        continue;
      }

      // Перевірка rate limiting
      if (this.isRateLimited(ruleId, now)) {
        continue;
      }

      this.triggerAlert(ruleId, rule, value, metadata);
    }
  }

  /**
     * Оцінка умови правила
     * @private
     */
  evaluateCondition(rule, value) {
    switch (rule.condition) {
    case 'above':
      return value > rule.threshold;
    case 'below':
      return value < rule.threshold;
    case 'equals':
      return value === rule.threshold;
    default:
      return false;
    }
  }

  /**
     * Перевірка rate limiting
     * @private
     */
  isRateLimited(ruleId, now) {
    const count = this.alertCount.get(ruleId) || 0;
    const windowStart = now - 60000; // 1 хвилина

    const recentAlerts = this.alertHistory.getAll()
      .filter(alert =>
        alert.ruleId === ruleId &&
                alert.timestamp >= windowStart
      );

    return recentAlerts.length >= this.config.maxAlertsPerMinute;
  }

  /**
     * Спрацьовування alert
     * @private
     */
  triggerAlert(ruleId, rule, value, metadata) {
    const now = Date.now();

    const alert = {
      ruleId,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      severity: rule.severity,
      metadata,
      timestamp: now
    };

    // Збереження в історії
    this.alertHistory.add(alert);
    this.lastAlerts.set(ruleId, now);

    // Оновлення лічильників
    rule.triggerCount++;
    const count = this.alertCount.get(ruleId) || 0;
    this.alertCount.set(ruleId, count + 1);

    this.logger.warn('Alert triggered', alert);

    // Виклик action якщо є
    if (typeof rule.action === 'function') {
      try {
        rule.action(alert);
      } catch (error) {
        this.logger.error('Alert action failed', {
          ruleId,
          error: error.message
        });
      }
    }

    // Емісія події
    Events.emit('performanceMonitor:alert', alert);
  }

  /**
     * Отримання статистики alerts
     */
  getAlertStats() {
    const recentAlerts = this.alertHistory.getAll()
      .filter(alert => Date.now() - alert.timestamp <= 300000); // 5 хвилин

    const severityCount = {};
    const metricCount = {};

    recentAlerts.forEach(alert => {
      severityCount[alert.severity] = (severityCount[alert.severity] || 0) + 1;
      metricCount[alert.metric] = (metricCount[alert.metric] || 0) + 1;
    });

    return {
      total: recentAlerts.length,
      bySeverity: severityCount,
      byMetric: metricCount,
      rules: this.rules.size
    };
  }
}

/**
 * Головний Performance Monitor
 */
export class VoicePerformanceMonitor extends BaseService {
  constructor(config = {}) {
    super({
      name: 'VOICE_PERFORMANCE_MONITOR',
      version: '1.0.0',
      healthCheckInterval: 10000,
      ...config
    });

    this.metricsCollector = new MetricsCollector(config.metrics);
    this.alertManager = new AlertManager(config.alerts);

    this.realTimeObserver = null;
    this.dashboardUpdateInterval = null;

    this._setupDefaultCollectors();
    this._setupDefaultAlerts();
    this._setupPerformanceObserver();
  }

  /**
     * Ініціалізація сервісу
     */
  async onInitialize() {
    this.metricsCollector.start();
    this._startDashboardUpdates();

    this.logger.info('Voice Performance Monitor initialized');
    return true;
  }

  /**
     * Налаштування стандартних збирачів метрик
     * @private
     */
  _setupDefaultCollectors() {
    // Memory usage
    this.metricsCollector.registerCollector('memory', () => {
      if (performance.memory) {
        return {
          value: performance.memory.usedJSHeapSize / (1024 * 1024), // MB
          unit: 'MB',
          metadata: {
            total: performance.memory.totalJSHeapSize / (1024 * 1024),
            limit: performance.memory.jsHeapSizeLimit / (1024 * 1024)
          }
        };
      }
      return null;
    });

    // CPU usage (approximation)
    this.metricsCollector.registerCollector('cpu', () => {
      const start = performance.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        Math.random();
      }

      const duration = performance.now() - start;
      const cpuLoad = Math.min((duration / 10) * 100, 100); // Approximation

      return {
        value: cpuLoad,
        unit: '%',
        metadata: { iterations, duration }
      };
    });

    // Audio context state
    this.metricsCollector.registerCollector('audioContext', () => {
      // Отримання AudioContext з voice services
      const audioContexts = this._getAudioContexts();

      return {
        value: audioContexts.length,
        unit: 'count',
        metadata: {
          states: audioContexts.map(ctx => ctx.state),
          sampleRates: audioContexts.map(ctx => ctx.sampleRate)
        }
      };
    });

    // Service health
    this.metricsCollector.registerCollector('serviceHealth', () => {
      const healthyServices = this._getServiceHealthScores();
      const avgHealth = healthyServices.length > 0 ?
        healthyServices.reduce((a, b) => a + b, 0) / healthyServices.length : 0;

      return {
        value: avgHealth,
        unit: 'score',
        metadata: {
          services: healthyServices.length,
          scores: healthyServices
        }
      };
    });
  }

  /**
     * Налаштування стандартних alerts
     * @private
     */
  _setupDefaultAlerts() {
    // High memory usage
    this.alertManager.addRule('high_memory', {
      metric: 'memory',
      threshold: 100, // 100MB
      condition: 'above',
      severity: 'warning',
      action: (alert) => this._handleHighMemoryUsage(alert)
    });

    // High CPU usage
    this.alertManager.addRule('high_cpu', {
      metric: 'cpu',
      threshold: 80, // 80%
      condition: 'above',
      severity: 'warning',
      action: (alert) => this._handleHighCPUUsage(alert)
    });

    // Low service health
    this.alertManager.addRule('low_service_health', {
      metric: 'serviceHealth',
      threshold: 0.5, // 50%
      condition: 'below',
      severity: 'critical',
      action: (alert) => this._handleLowServiceHealth(alert)
    });
  }

  /**
     * Налаштування Performance Observer
     * @private
     */
  _setupPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.realTimeObserver = new PerformanceObserver((list) => {
        this._processPerformanceEntries(list.getEntries());
      });

      try {
        this.realTimeObserver.observe({
          entryTypes: ['measure', 'navigation', 'resource']
        });
      } catch (error) {
        this.logger.warn('PerformanceObserver setup failed', {
          error: error.message
        });
      }
    }
  }

  /**
     * Обробка Performance API entries
     * @private
     */
  _processPerformanceEntries(entries) {
    entries.forEach(entry => {
      if (entry.name.startsWith('voice-')) {
        this.alertManager.checkMetric(
          `latency.${entry.name}`,
          entry.duration,
          { entryType: entry.entryType }
        );
      }
    });
  }

  /**
     * Запуск оновлень dashboard
     * @private
     */
  _startDashboardUpdates() {
    this.dashboardUpdateInterval = setInterval(() => {
      const metrics = this._gatherDashboardMetrics();
      Events.emit('performanceMonitor:dashboardUpdate', metrics);
    }, 5000); // Кожні 5 секунд
  }

  /**
     * Збір метрик для dashboard
     * @private
     */
  _gatherDashboardMetrics() {
    return {
      memory: this.metricsCollector.getAggregatedMetrics('memory'),
      cpu: this.metricsCollector.getAggregatedMetrics('cpu'),
      audioContext: this.metricsCollector.getAggregatedMetrics('audioContext'),
      serviceHealth: this.metricsCollector.getAggregatedMetrics('serviceHealth'),
      alerts: this.alertManager.getAlertStats(),
      timestamp: Date.now()
    };
  }

  /**
     * Отримання AudioContext від voice services
     * @private
     */
  _getAudioContexts() {
    const contexts = [];

    // Спроба отримати context від зареєстрованих сервісів
    if (window.voiceServices) {
      Object.values(window.voiceServices).forEach(service => {
        if (service.audioContext) {
          contexts.push(service.audioContext);
        }
      });
    }

    return contexts;
  }

  /**
     * Отримання показників здоров'я сервісів
     * @private
     */
  _getServiceHealthScores() {
    const scores = [];

    if (window.voiceServices) {
      Object.values(window.voiceServices).forEach(service => {
        if (typeof service.getHealthScore === 'function') {
          try {
            scores.push(service.getHealthScore());
          } catch (error) {
            scores.push(0); // Сервіс недоступний
          }
        }
      });
    }

    return scores;
  }

  /**
     * Обробка високого використання пам'яті
     * @private
     */
  _handleHighMemoryUsage(alert) {
    this.logger.warn('High memory usage detected', alert);

    // Спроба garbage collection якщо доступно
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
        this.logger.info('Manual garbage collection triggered');
      } catch (error) {
        this.logger.warn('Manual GC failed', { error: error.message });
      }
    }

    // Сповіщення сервісів про необхідність очищення
    Events.emit('performanceMonitor:memoryPressure', {
      level: 'high',
      usage: alert.value,
      threshold: alert.threshold
    });
  }

  /**
     * Обробка високого використання CPU
     * @private
     */
  _handleHighCPUUsage(alert) {
    this.logger.warn('High CPU usage detected', alert);

    Events.emit('performanceMonitor:cpuPressure', {
      level: 'high',
      usage: alert.value,
      threshold: alert.threshold
    });
  }

  /**
     * Обробка низького здоров'я сервісів
     * @private
     */
  _handleLowServiceHealth(alert) {
    this.logger.error('Low service health detected', alert);

    Events.emit('performanceMonitor:serviceHealthCritical', {
      averageHealth: alert.value,
      threshold: alert.threshold
    });
  }

  /**
     * Вимірювання latency для voice операцій
     */
  measureVoiceLatency(operation) {
    return {
      start: (operationId) => {
        const markName = `voice-${operation}-start-${operationId}`;
        performance.mark(markName);
        return operationId;
      },

      end: (operationId) => {
        const startMark = `voice-${operation}-start-${operationId}`;
        const endMark = `voice-${operation}-end-${operationId}`;
        const measureName = `voice-${operation}-${operationId}`;

        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);

        const measure = performance.getEntriesByName(measureName)[0];

        // Очищення performance entries
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);

        return measure ? measure.duration : null;
      }
    };
  }

  /**
     * Автоматичне виявлення bottlenecks
     */
  async detectBottlenecks() {
    const bottlenecks = [];

    // Аналіз latency метрик
    const latencyMetrics = ['memory', 'cpu', 'serviceHealth'];

    for (const metric of latencyMetrics) {
      const aggregated = this.metricsCollector.getAggregatedMetrics(metric);
      if (!aggregated) continue;

      // Високі p95/p99 latency
      if (aggregated.p95 > aggregated.avg * 2) {
        bottlenecks.push({
          component: metric,
          issue: 'high-latency-variance',
          recommendation: `Optimize ${metric} performance - high variance detected`,
          severity: aggregated.p99 > aggregated.avg * 3 ? 'high' : 'medium',
          metrics: aggregated
        });
      }
    }

    return bottlenecks;
  }

  /**
     * Отримання comprehensive metrics
     */
  getComprehensiveMetrics() {
    return {
      collectors: Array.from(this.metricsCollector.collectors.keys()),
      aggregated: this._gatherDashboardMetrics(),
      alerts: this.alertManager.getAlertStats(),
      bottlenecks: this.detectBottlenecks(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
     * Знищення сервісу
     */
  async onDestroy() {
    this.metricsCollector.stop();

    if (this.dashboardUpdateInterval) {
      clearInterval(this.dashboardUpdateInterval);
    }

    if (this.realTimeObserver) {
      this.realTimeObserver.disconnect();
    }

    this.logger.info('Voice Performance Monitor destroyed');
  }
}

/**
 * Глобальний експорт singleton instance
 */
export const voicePerformanceMonitor = new VoicePerformanceMonitor();
