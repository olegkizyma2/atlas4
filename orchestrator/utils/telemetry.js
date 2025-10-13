/**
 * Модуль телеметрії для збору метрик та статистики
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const METRICS_PATH = path.join(__dirname, '../../logs/metrics');

// Створюємо директорію для метрик, якщо не існує
async function ensureMetricsDirectory() {
  try {
    await fs.mkdir(METRICS_PATH, { recursive: true });
  } catch (err) {
    logger.error('Помилка створення директорії для метрик', err);
  }
}

class Telemetry {
  constructor() {
    this.metricsBuffer = [];
    this.flushInterval = 60000; // Збереження метрик кожну хвилину
    this.startPeriodicFlush();
  }

  startPeriodicFlush() {
    setInterval(() => {
      this.flush().catch(err => {
        logger.error('Помилка при збереженні метрик', err);
      });
    }, this.flushInterval);
  }

  async flush() {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    await ensureMetricsDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(METRICS_PATH, `metrics-${timestamp}.json`);

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];
      await fs.writeFile(filePath, JSON.stringify(metrics, null, 2), 'utf-8');
      logger.info(`Метрики збережено: ${filePath} (${metrics.length} записів)`);
    } catch (err) {
      logger.error('Помилка при збереженні метрик', err);
      // Повертаємо метрики в буфер
      this.metricsBuffer = [...metrics, ...this.metricsBuffer];
    }
  }

  recordMetric(category, name, value, tags = {}) {
    const metric = {
      timestamp: new Date().toISOString(),
      category,
      name,
      value,
      tags
    };

    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= 1000) {
      // Асинхронно зберігаємо при досягненні порогового значення
      this.flush().catch(err => {
        logger.error('Помилка при збереженні метрик', err);
      });
    }

    return metric;
  }

  // Метрика виконання
  recordExecution(component, duration, success, details = {}) {
    return this.recordMetric('execution', component, duration, {
      success,
      ...details
    });
  }

  // Метрика продуктивності
  recordPerformance(component, value, details = {}) {
    return this.recordMetric('performance', component, value, details);
  }

  // Метрика використання ресурсів
  recordResourceUsage(resource, value, details = {}) {
    return this.recordMetric('resource', resource, value, details);
  }

  // Event emission для сумісності з DI Container
  emit(eventName, data = {}) {
    // Розбираємо event name на category та name
    const parts = eventName.split('.');
    const category = parts[0] || 'general';
    const name = parts.slice(1).join('.') || eventName;
    
    return this.recordMetric(category, name, data.value || 1, data);
  }
}

export default new Telemetry();
