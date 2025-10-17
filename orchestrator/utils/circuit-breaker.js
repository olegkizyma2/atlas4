/**
 * @fileoverview Circuit Breaker for Backend Services
 * Prevents cascading failures and enables graceful degradation
 * 
 * @version 1.0.0
 * @date 2025-10-17
 */

import logger from './logger.js';

/**
 * Circuit Breaker States
 */
export const CircuitState = {
  CLOSED: 'closed',       // Normal operation
  OPEN: 'open',           // Circuit open, requests blocked
  HALF_OPEN: 'half_open'  // Testing recovery
};

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = code;
  }
}

/**
 * Circuit Breaker for Backend Services
 */
export class CircuitBreaker {
  /**
   * @param {Object} config - Configuration
   * @param {string} config.name - Service name
   * @param {number} config.failureThreshold - Number of failures to open circuit (default: 5)
   * @param {number} config.recoveryTimeout - Time before half-open attempt (default: 30000ms)
   * @param {number} config.halfOpenMaxCalls - Max calls in half-open state (default: 3)
   * @param {number} config.timeout - Operation timeout (default: 60000ms)
   */
  constructor(config = {}) {
    this.name = config.name || 'Unknown';
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 30000,
      halfOpenMaxCalls: config.halfOpenMaxCalls || 3,
      timeout: config.timeout || 60000,
      ...config
    };

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = null;
    this.recoveryTimer = null;

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpenCount: 0,
      timeouts: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Execute operation through circuit breaker
   * @param {Function} operation - Async operation to execute
   * @param {...any} args - Operation arguments
   * @returns {Promise<any>} Operation result
   */
  async execute(operation, ...args) {
    const startTime = Date.now();
    this.metrics.totalCalls++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      this.metrics.circuitOpenCount++;
      throw new CircuitBreakerError(
        `Circuit breaker for ${this.name} is OPEN`,
        'CIRCUIT_OPEN'
      );
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerError(
        `Circuit breaker for ${this.name} HALF_OPEN limit exceeded`,
        'HALF_OPEN_LIMIT'
      );
    }

    try {
      // Execute with timeout
      const result = await this._executeWithTimeout(operation, ...args);

      // Success
      this._onSuccess(Date.now() - startTime);
      return result;

    } catch (error) {
      // Failure
      this._onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {...any} args - Arguments
   * @returns {Promise<any>} Result
   * @private
   */
  async _executeWithTimeout(operation, ...args) {
    return Promise.race([
      operation(...args),
      new Promise((_, reject) =>
        setTimeout(() => {
          this.metrics.timeouts++;
          reject(new CircuitBreakerError(
            `Operation timeout after ${this.config.timeout}ms`,
            'TIMEOUT'
          ));
        }, this.config.timeout)
      )
    ]);
  }

  /**
   * Handle successful operation
   * @param {number} responseTime - Response time in ms
   * @private
   */
  _onSuccess(responseTime) {
    this.metrics.successfulCalls++;
    this._updateAverageResponseTime(responseTime);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.halfOpenCallCount++;

      // Close circuit if enough successes
      if (this.successCount >= this.config.halfOpenMaxCalls) {
        this._transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   * @param {Error} error - Error that occurred
   * @param {number} responseTime - Response time in ms
   * @private
   */
  _onFailure(error, responseTime) {
    this.metrics.failedCalls++;
    this._updateAverageResponseTime(responseTime);

    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`[CircuitBreaker] ${this.name} failure ${this.failureCount}/${this.config.failureThreshold}`, {
      category: 'circuit-breaker',
      error: error.message
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Go back to open if failure in half-open
      this._transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Open circuit if threshold reached
      this._transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Transition to new state
   * @param {string} newState - New state
   * @private
   */
  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    logger.system('circuit-breaker', `[CircuitBreaker] ${this.name}: ${oldState} → ${newState}`);

    if (newState === CircuitState.OPEN) {
      this.failureCount = 0;
      this._scheduleRecovery();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.halfOpenCallCount = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  /**
   * Schedule recovery attempt
   * @private
   */
  _scheduleRecovery() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      logger.system('circuit-breaker', `[CircuitBreaker] ${this.name}: Attempting recovery (HALF_OPEN)`);
      this._transitionTo(CircuitState.HALF_OPEN);
    }, this.config.recoveryTimeout);
  }

  /**
   * Update average response time
   * @param {number} responseTime - Response time in ms
   * @private
   */
  _updateAverageResponseTime(responseTime) {
    const total = this.metrics.successfulCalls + this.metrics.failedCalls;
    this.metrics.averageResponseTime = Math.round(
      (this.metrics.averageResponseTime * (total - 1) + responseTime) / total
    );
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = null;

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    logger.system('circuit-breaker', `[CircuitBreaker] ${this.name}: Reset`);
  }

  /**
   * Get current metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      failureCount: this.failureCount,
      successRate: this.metrics.totalCalls > 0
        ? Math.round((this.metrics.successfulCalls / this.metrics.totalCalls) * 100)
        : 0
    };
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }
}

export default CircuitBreaker;
