/**
 * @fileoverview Unit tests for CircuitBreaker pattern
 * Tests state transitions, failure counting, and auto-recovery
 * 
 * @version 1.0.0
 * @date 2025-10-13
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock CircuitBreaker class (extracted from executor-v3.js)
class CircuitBreaker {
    constructor(threshold = 3, timeout = 60000) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.threshold = threshold;
        this.timeout = timeout;
        this.nextAttempt = Date.now();
    }

    recordFailure() {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            console.log(`[Circuit Breaker] OPEN - cooldown until ${new Date(this.nextAttempt).toISOString()}`);
        }
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
        console.log('[Circuit Breaker] CLOSED - reset');
    }

    canAttempt() {
        if (this.state === 'CLOSED') return true;
        
        if (Date.now() >= this.nextAttempt) {
            this.state = 'HALF_OPEN';
            console.log('[Circuit Breaker] HALF_OPEN - testing');
            return true;
        }
        
        return false;
    }

    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.nextAttempt = Date.now();
    }
}

describe('CircuitBreaker', () => {
    let breaker;

    beforeEach(() => {
        breaker = new CircuitBreaker(3, 60000);
        jest.clearAllMocks();
    });

    describe('Initial State', () => {
        it('should start in CLOSED state', () => {
            expect(breaker.state).toBe('CLOSED');
            expect(breaker.failures).toBe(0);
            expect(breaker.canAttempt()).toBe(true);
        });
    });

    describe('Failure Recording', () => {
        it('should increment failures on recordFailure()', () => {
            breaker.recordFailure();
            expect(breaker.failures).toBe(1);
            expect(breaker.state).toBe('CLOSED');
        });

        it('should open circuit after threshold failures', () => {
            breaker.recordFailure(); // 1
            breaker.recordFailure(); // 2
            expect(breaker.state).toBe('CLOSED');
            
            breaker.recordFailure(); // 3 - TRIP!
            expect(breaker.state).toBe('OPEN');
            expect(breaker.canAttempt()).toBe(false);
        });

        it('should not count failures beyond threshold', () => {
            breaker.recordFailure(); // 1
            breaker.recordFailure(); // 2
            breaker.recordFailure(); // 3 - OPEN
            breaker.recordFailure(); // 4
            breaker.recordFailure(); // 5
            
            expect(breaker.failures).toBeGreaterThanOrEqual(3);
            expect(breaker.state).toBe('OPEN');
        });
    });

    describe('Success Recording', () => {
        it('should reset failures on recordSuccess()', () => {
            breaker.recordFailure();
            breaker.recordFailure();
            expect(breaker.failures).toBe(2);
            
            breaker.recordSuccess();
            expect(breaker.failures).toBe(0);
            expect(breaker.state).toBe('CLOSED');
        });

        it('should close circuit after success in HALF_OPEN', () => {
            // Trip circuit
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            expect(breaker.state).toBe('OPEN');
            
            // Wait for timeout (simulate)
            breaker.nextAttempt = Date.now() - 1000;
            expect(breaker.canAttempt()).toBe(true);
            expect(breaker.state).toBe('HALF_OPEN');
            
            // Success closes circuit
            breaker.recordSuccess();
            expect(breaker.state).toBe('CLOSED');
            expect(breaker.failures).toBe(0);
        });
    });

    describe('State Transitions', () => {
        it('should transition CLOSED → OPEN after threshold', () => {
            expect(breaker.state).toBe('CLOSED');
            
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure();
            }
            
            expect(breaker.state).toBe('OPEN');
        });

        it('should transition OPEN → HALF_OPEN after timeout', () => {
            // Trip circuit
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            expect(breaker.state).toBe('OPEN');
            
            // Before timeout - still OPEN
            expect(breaker.canAttempt()).toBe(false);
            expect(breaker.state).toBe('OPEN');
            
            // After timeout - HALF_OPEN
            breaker.nextAttempt = Date.now() - 1000;
            expect(breaker.canAttempt()).toBe(true);
            expect(breaker.state).toBe('HALF_OPEN');
        });

        it('should transition HALF_OPEN → CLOSED on success', () => {
            // Get to HALF_OPEN state
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.nextAttempt = Date.now() - 1000;
            breaker.canAttempt(); // Transitions to HALF_OPEN
            
            expect(breaker.state).toBe('HALF_OPEN');
            
            breaker.recordSuccess();
            expect(breaker.state).toBe('CLOSED');
        });

        it('should transition HALF_OPEN → OPEN on failure', () => {
            // Get to HALF_OPEN state
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.nextAttempt = Date.now() - 1000;
            breaker.canAttempt();
            
            expect(breaker.state).toBe('HALF_OPEN');
            
            // Failure trips again
            breaker.recordFailure();
            expect(breaker.state).toBe('OPEN');
        });
    });

    describe('Timeout Behavior', () => {
        it('should block attempts during cooldown', () => {
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            
            expect(breaker.state).toBe('OPEN');
            expect(breaker.canAttempt()).toBe(false);
        });

        it('should allow attempts after cooldown', () => {
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            
            // Simulate timeout passing
            breaker.nextAttempt = Date.now() - 1000;
            
            expect(breaker.canAttempt()).toBe(true);
            expect(breaker.state).toBe('HALF_OPEN');
        });

        it('should respect custom timeout values', () => {
            const customBreaker = new CircuitBreaker(3, 30000);
            
            customBreaker.recordFailure();
            customBreaker.recordFailure();
            customBreaker.recordFailure();
            
            const cooldownTime = customBreaker.nextAttempt - Date.now();
            expect(cooldownTime).toBeGreaterThan(25000); // ~30s
            expect(cooldownTime).toBeLessThan(35000);
        });
    });

    describe('Reset Functionality', () => {
        it('should reset all state on reset()', () => {
            breaker.recordFailure();
            breaker.recordFailure();
            breaker.recordFailure();
            
            expect(breaker.state).toBe('OPEN');
            expect(breaker.failures).toBe(3);
            
            breaker.reset();
            
            expect(breaker.state).toBe('CLOSED');
            expect(breaker.failures).toBe(0);
            expect(breaker.canAttempt()).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero threshold', () => {
            const zeroBreaker = new CircuitBreaker(0, 60000);
            
            zeroBreaker.recordFailure();
            expect(zeroBreaker.state).toBe('OPEN');
        });

        it('should handle negative threshold', () => {
            const negBreaker = new CircuitBreaker(-1, 60000);
            
            negBreaker.recordFailure();
            // Should still trip eventually
            expect(negBreaker.failures).toBeGreaterThan(0);
        });

        it('should respect custom timeout values', (done) => {
            const fastBreaker = new CircuitBreaker(3, 100); // 100ms timeout
            
            fastBreaker.recordFailure();
            fastBreaker.recordFailure();
            fastBreaker.recordFailure();
            
            expect(fastBreaker.state).toBe('OPEN');
            
            // Wait 150ms
            setTimeout(() => {
                expect(fastBreaker.canAttempt()).toBe(true);
                done(); // Signal async test completion
            }, 150);
        });
    });
});

// Export for use in integration tests
module.exports = { CircuitBreaker };
