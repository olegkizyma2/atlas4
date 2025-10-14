/**
 * @fileoverview TTS Synchronization Manager for MCP Dynamic TODO Workflow
 * Manages 3-level TTS queue system (quick/normal/detailed) with stage-aware
 * synchronization and smart phrase skipping for optimal tempo.
 * 
 * @version 4.0.0
 * @date 2025-10-13
 */

import logger from '../utils/logger.js';

/**
 * @typedef {Object} TTSQueueItem
 * @property {string} phrase - Text to speak
 * @property {'quick'|'normal'|'detailed'} mode - TTS mode
 * @property {number} duration - Max duration in milliseconds
 * @property {number} priority - Priority (1=highest, 10=lowest)
 * @property {string} stage - Stage that queued this phrase
 * @property {number} timestamp - Queue timestamp
 * @property {Function} [resolve] - Promise resolve callback
 * @property {Function} [reject] - Promise reject callback
 */

/**
 * TTS Synchronization Manager
 * 
 * Features:
 * - 3-level queue system (quick/normal/detailed)
 * - Stage-aware synchronization
 * - Smart skipping for quick phrases when queue is full
 * - Maximum duration enforcement
 * - Priority-based ordering
 */
export class TTSSyncManager {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.ttsService - TTS service instance
     * @param {Object} dependencies.logger - Logger instance
     */
    constructor({ ttsService, logger: loggerInstance }) {
        this.ttsService = ttsService;
        this.logger = loggerInstance || logger;
        
        this.queue = []; // TTS queue
        this.isProcessing = false; // Processing flag
        this.currentStage = null; // Current workflow stage
        this.currentPhrase = null; // Currently speaking phrase
        
        // Configuration
        this.config = {
            maxQueueSize: 5,
            skipQuickIfQueueFull: true,
            modes: {
                quick: {
                    maxDuration: 200,
                    priority: 1,
                    examples: ['✅ Виконано', '❌ Помилка', 'Перевіряю...']
                },
                normal: {
                    maxDuration: 1000,
                    priority: 5,
                    examples: ['Файл створено на Desktop', 'Дані зібрано']
                },
                detailed: {
                    maxDuration: 3000,
                    priority: 10,
                    examples: ['План з 5 пунктів, починаю виконання']
                }
            }
        };

        this.logger.system('tts-sync', '[TTS-SYNC] Initialized with 3-level queue system');
    }

    /**
     * Speak phrase with mode and duration
     * 
     * @param {string} phrase - Text to speak
     * @param {Object} options - Speech options
     * @param {'quick'|'normal'|'detailed'} [options.mode='normal'] - TTS mode
     * @param {number} [options.duration] - Max duration (overrides mode default)
     * @param {number} [options.priority] - Custom priority (overrides mode default)
     * @param {boolean} [options.skipIfBusy=false] - Skip if queue is full (for quick mode)
     * @returns {Promise<void>}
     */
    async speak(phrase, options = {}) {
        const {
            mode = 'normal',
            duration,
            priority,
            skipIfBusy = false
        } = options;

        // Validate mode
        if (!this.config.modes[mode]) {
            this.logger.error(`[TTS-SYNC] Invalid mode: ${mode}, defaulting to normal`, { category: 'tts-sync', component: 'tts-sync' });
            mode = 'normal';
        }

        const modeConfig = this.config.modes[mode];
        const finalDuration = duration || modeConfig.maxDuration;
        const finalPriority = priority || modeConfig.priority;

        // Smart skipping for quick phrases when queue is full
        if (mode === 'quick' && this.config.skipQuickIfQueueFull && this.queue.length >= 2) {
            this.logger.system('tts-sync', `[TTS-SYNC] ⏭️ Skipping quick phrase (queue busy): "${phrase}"`);
            return Promise.resolve();
        }

        // Skip if queue is full and skipIfBusy is true
        if (skipIfBusy && this.queue.length >= this.config.maxQueueSize) {
            this.logger.system('tts-sync', `[TTS-SYNC] ⏭️ Skipping phrase (queue full): "${phrase}"`);
            return Promise.resolve();
        }

        // Create queue item
        const queueItem = {
            phrase,
            mode,
            duration: finalDuration,
            priority: finalPriority,
            stage: this.currentStage,
            timestamp: Date.now()
        };

        // Create promise for synchronization
        const promise = new Promise((resolve, reject) => {
            queueItem.resolve = resolve;
            queueItem.reject = reject;
        });

        // Add to queue (maintain priority order)
        this._addToQueue(queueItem);

        this.logger.system('tts-sync', `[TTS-SYNC] 📝 Queued [${mode}] "${phrase}" (priority: ${finalPriority}, duration: ${finalDuration}ms, queue: ${this.queue.length})`);

        // Start processing if not already
        if (!this.isProcessing) {
            this._processQueue();
        }

        return promise;
    }

    /**
     * Set current workflow stage
     * 
     * @param {string} stage - Stage name (e.g., 'stage2.1-mcp', 'stage2.2-mcp')
     */
    setCurrentStage(stage) {
        const previousStage = this.currentStage;
        this.currentStage = stage;
        
        if (previousStage !== stage) {
            this.logger.system('tts-sync', `[TTS-SYNC] Stage changed: ${previousStage} → ${stage}`);
        }
    }

    /**
     * Wait for current stage to complete TTS
     * Blocks until all TTS for current stage is finished
     * 
     * @param {number} [timeout=10000] - Maximum wait time in ms
     * @returns {Promise<void>}
     */
    async waitForStageCompletion(timeout = 10000) {
        const startTime = Date.now();
        const currentStage = this.currentStage;

        this.logger.system('tts-sync', `[TTS-SYNC] Waiting for stage ${currentStage} TTS completion...`);

        while (this.isProcessing || this._hasStageItemsInQueue(currentStage)) {
            // Check timeout
            if (Date.now() - startTime > timeout) {
                this.logger.warn(`[TTS-SYNC] ⚠️ Stage completion wait timeout after ${timeout}ms`, { category: 'tts-sync', component: 'tts-sync' });
                break;
            }

            // Wait 50ms and check again
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.logger.system('tts-sync', `[TTS-SYNC] ✅ Stage ${currentStage} TTS completed`);
    }

    /**
     * Clear queue for specific stage or all
     * 
     * @param {string} [stage] - Stage to clear (if not specified, clear all)
     */
    clearQueue(stage) {
        if (stage) {
            const before = this.queue.length;
            this.queue = this.queue.filter(item => item.stage !== stage);
            this.logger.system('tts-sync', `[TTS-SYNC] Cleared ${before - this.queue.length} items for stage ${stage}`);
        } else {
            const count = this.queue.length;
            this.queue = [];
            this.logger.system('tts-sync', `[TTS-SYNC] Cleared entire queue (${count} items)`);
        }
    }

    /**
     * Get queue status
     * 
     * @returns {Object} Queue statistics
     */
    getQueueStatus() {
        return {
            size: this.queue.length,
            isProcessing: this.isProcessing,
            currentStage: this.currentStage,
            currentPhrase: this.currentPhrase,
            byMode: {
                quick: this.queue.filter(i => i.mode === 'quick').length,
                normal: this.queue.filter(i => i.mode === 'normal').length,
                detailed: this.queue.filter(i => i.mode === 'detailed').length
            },
            items: this.queue.map(i => ({
                phrase: i.phrase,
                mode: i.mode,
                stage: i.stage,
                priority: i.priority
            }))
        };
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Add item to queue maintaining priority order
     * Higher priority (lower number) goes first
     * 
     * @param {TTSQueueItem} item - Item to add
     * @private
     */
    _addToQueue(item) {
        // Find insertion point based on priority
        let insertIndex = this.queue.length;
        
        for (let i = 0; i < this.queue.length; i++) {
            if (item.priority < this.queue[i].priority) {
                insertIndex = i;
                break;
            }
        }

        // Insert at calculated position
        this.queue.splice(insertIndex, 0, item);

        // Enforce max queue size (remove lowest priority items)
        while (this.queue.length > this.config.maxQueueSize) {
            const removed = this.queue.pop();
            this.logger.warn(`[TTS-SYNC] ⚠️ Queue overflow, removed: "${removed.phrase}"`, { category: 'tts-sync', component: 'tts-sync' });
            if (removed.reject) {
                removed.reject(new Error('Queue overflow'));
            }
        }
    }

    /**
     * Process TTS queue
     * 
     * @private
     */
    async _processQueue() {
        if (this.isProcessing) {
            return; // Already processing
        }

        this.isProcessing = true;
        this.logger.system('tts-sync', '[TTS-SYNC] 🔊 Started queue processing');

        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                this.currentPhrase = item.phrase;

                const startTime = Date.now();

                try {
                    this.logger.system('tts-sync', `[TTS-SYNC] 🗣️ Speaking [${item.mode}]: "${item.phrase}"`);

                    // FIXED: Перевірка наявності TTS service
                    if (this.ttsService && typeof this.ttsService.speak === 'function') {
                        // Call TTS service
                        await this.ttsService.speak(item.phrase, {
                            maxDuration: item.duration
                        });

                        const actualDuration = Date.now() - startTime;
                        this.logger.system('tts-sync', `[TTS-SYNC] ✅ Completed in ${actualDuration}ms [${item.mode}]: "${item.phrase}"`);
                    } else {
                        // TTS service not available - skip gracefully
                        this.logger.warn(`[TTS-SYNC] ⚠️ TTS service not available, skipping: "${item.phrase}"`, { category: 'tts-sync', component: 'tts-sync' });
                    }

                    // Resolve promise
                    if (item.resolve) {
                        item.resolve();
                    }

                } catch (error) {
                    this.logger.error(`[TTS-SYNC] ❌ Failed to speak: ${error.message}`, { category: 'tts-sync', component: 'tts-sync' });

                    // Reject promise
                    if (item.reject) {
                        item.reject(error);
                    }
                }

                this.currentPhrase = null;

                // Small gap between phrases for natural flow
                if (this.queue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

        } finally {
            this.isProcessing = false;
            this.logger.system('tts-sync', '[TTS-SYNC] ⏸️ Queue processing completed');
        }
    }

    /**
     * Check if queue has items for specific stage
     * 
     * @param {string} stage - Stage to check
     * @returns {boolean}
     * @private
     */
    _hasStageItemsInQueue(stage) {
        return this.queue.some(item => item.stage === stage);
    }

    /**
     * Destroy manager and cleanup
     */
    destroy() {
        this.clearQueue();
        this.isProcessing = false;
        this.currentPhrase = null;
        this.logger.system('tts-sync', '[TTS-SYNC] Manager destroyed');
    }
}

export default TTSSyncManager;
