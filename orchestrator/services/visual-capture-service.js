/**
 * @fileoverview Visual Capture Service
 * Continuous screenshot monitoring for visual verification
 * 
 * Provides:
 * - Continuous screenshot capture (configurable interval)
 * - Frame comparison for change detection
 * - Screenshot queue management
 * - Visual evidence storage
 * 
 * @version 5.0.0
 * @date 2025-10-17
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

/**
 * Visual Capture Service
 * Manages continuous screenshot capture and monitoring
 */
export class VisualCaptureService {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logger - Logger instance
     * @param {Object} dependencies.config - Configuration
     */
    constructor({ logger, config = {} }) {
        this.logger = logger;
        this.config = {
            captureInterval: config.captureInterval || 2000, // 2 seconds default
            screenshotDir: config.screenshotDir || '/tmp/atlas_visual',
            maxStoredScreenshots: config.maxStoredScreenshots || 10,
            changeDetectionThreshold: config.changeDetectionThreshold || 0.05, // 5% change
            platform: config.platform || process.platform
        };

        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.screenshotQueue = [];
        this.lastScreenshotHash = null;
        this.changeDetected = false;
    }

    /**
     * Initialize visual capture service
     */
    async initialize() {
        this.logger.system('visual-capture', '[VISUAL] Initializing Visual Capture Service...');

        // Create screenshot directory
        try {
            await fs.mkdir(this.config.screenshotDir, { recursive: true });
            this.logger.system('visual-capture', `[VISUAL] Screenshot directory created: ${this.config.screenshotDir}`);
        } catch (error) {
            this.logger.error(`[VISUAL] Failed to create screenshot directory: ${error.message}`, {
                category: 'visual-capture',
                component: 'visual-capture'
            });
            throw error;
        }

        this.logger.system('visual-capture', '[VISUAL] ✅ Visual Capture Service initialized');
    }

    /**
     * Start continuous monitoring
     * Takes screenshots at regular intervals and detects changes
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            this.logger.warn('[VISUAL] Monitoring already active', {
                category: 'visual-capture',
                component: 'visual-capture'
            });
            return;
        }

        this.isMonitoring = true;
        this.logger.system('visual-capture', `[VISUAL] 📹 Starting continuous monitoring (interval: ${this.config.captureInterval}ms)`);

        // Take initial screenshot
        await this.captureScreenshot('monitoring_start');

        // Start monitoring interval
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.captureScreenshot('monitoring');
            } catch (error) {
                this.logger.error(`[VISUAL] Monitoring capture failed: ${error.message}`, {
                    category: 'visual-capture',
                    component: 'visual-capture'
                });
            }
        }, this.config.captureInterval);
    }

    /**
     * Stop continuous monitoring
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.logger.system('visual-capture', '[VISUAL] ⏹️  Stopped continuous monitoring');
    }

    /**
     * Capture a single screenshot
     * 
     * @param {string} context - Context identifier for the screenshot
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Screenshot info
     */
    async captureScreenshot(context = 'manual', options = {}) {
        const timestamp = Date.now();
        const filename = `screenshot_${context}_${timestamp}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);

        try {
            // Platform-specific screenshot command
            let command;
            if (this.config.platform === 'darwin') {
                // macOS - use screencapture
                command = `screencapture -x "${filepath}"`;
            } else if (this.config.platform === 'linux') {
                // Linux - use scrot or import
                command = `scrot "${filepath}" || import -window root "${filepath}"`;
            } else {
                throw new Error(`Unsupported platform: ${this.config.platform}`);
            }

            // Execute screenshot command
            await execAsync(command);

            // Verify screenshot was created
            const stats = await fs.stat(filepath);
            
            if (stats.size === 0) {
                throw new Error('Screenshot file is empty');
            }

            // Calculate hash for change detection
            const fileBuffer = await fs.readFile(filepath);
            const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

            // Detect changes
            let changed = false;
            if (this.lastScreenshotHash && this.lastScreenshotHash !== hash) {
                changed = true;
                this.changeDetected = true;
            }
            this.lastScreenshotHash = hash;

            const screenshotInfo = {
                filepath,
                filename,
                timestamp,
                size: stats.size,
                hash,
                context,
                changed
            };

            // Add to queue
            this.screenshotQueue.push(screenshotInfo);

            // Cleanup old screenshots
            await this._cleanupOldScreenshots();

            this.logger.system('visual-capture', `[VISUAL] 📸 Screenshot captured: ${filename} (${(stats.size / 1024).toFixed(1)}KB, changed: ${changed})`);

            return screenshotInfo;

        } catch (error) {
            this.logger.error(`[VISUAL] Screenshot capture failed: ${error.message}`, {
                category: 'visual-capture',
                component: 'visual-capture',
                context,
                command: command || 'unknown'
            });
            throw error;
        }
    }

    /**
     * Get latest screenshot from queue
     * 
     * @returns {Object|null} Latest screenshot info
     */
    getLatestScreenshot() {
        return this.screenshotQueue.length > 0
            ? this.screenshotQueue[this.screenshotQueue.length - 1]
            : null;
    }

    /**
     * Get all screenshots since a timestamp
     * 
     * @param {number} since - Timestamp
     * @returns {Array<Object>} Screenshots
     */
    getScreenshotsSince(since) {
        return this.screenshotQueue.filter(s => s.timestamp >= since);
    }

    /**
     * Check if visual changes detected since start
     * 
     * @returns {boolean} True if changes detected
     */
    hasChangesDetected() {
        return this.changeDetected;
    }

    /**
     * Reset change detection flag
     */
    resetChangeDetection() {
        this.changeDetected = false;
        this.logger.system('visual-capture', '[VISUAL] Change detection reset');
    }

    /**
     * Get screenshot comparison report
     * 
     * @param {string} screenshot1Path - First screenshot path
     * @param {string} screenshot2Path - Second screenshot path
     * @returns {Promise<Object>} Comparison result
     */
    async compareScreenshots(screenshot1Path, screenshot2Path) {
        try {
            // Read both screenshots
            const [file1, file2] = await Promise.all([
                fs.readFile(screenshot1Path),
                fs.readFile(screenshot2Path)
            ]);

            // Calculate hashes
            const hash1 = crypto.createHash('md5').update(file1).digest('hex');
            const hash2 = crypto.createHash('md5').update(file2).digest('hex');

            const identical = hash1 === hash2;
            
            // Simple byte-level difference calculation
            let diffBytes = 0;
            const minLength = Math.min(file1.length, file2.length);
            for (let i = 0; i < minLength; i++) {
                if (file1[i] !== file2[i]) {
                    diffBytes++;
                }
            }
            diffBytes += Math.abs(file1.length - file2.length);

            const diffPercentage = (diffBytes / Math.max(file1.length, file2.length)) * 100;

            return {
                identical,
                hash1,
                hash2,
                file1Size: file1.length,
                file2Size: file2.length,
                diffBytes,
                diffPercentage: diffPercentage.toFixed(2),
                significantChange: diffPercentage > this.config.changeDetectionThreshold
            };

        } catch (error) {
            this.logger.error(`[VISUAL] Screenshot comparison failed: ${error.message}`, {
                category: 'visual-capture',
                component: 'visual-capture'
            });
            throw error;
        }
    }

    /**
     * Cleanup old screenshots to manage storage
     * 
     * @private
     */
    async _cleanupOldScreenshots() {
        if (this.screenshotQueue.length <= this.config.maxStoredScreenshots) {
            return;
        }

        const toRemove = this.screenshotQueue.length - this.config.maxStoredScreenshots;
        const removed = this.screenshotQueue.splice(0, toRemove);

        // Delete files
        for (const screenshot of removed) {
            try {
                await fs.unlink(screenshot.filepath);
                this.logger.system('visual-capture', `[VISUAL] 🗑️  Cleaned up old screenshot: ${screenshot.filename}`);
            } catch (error) {
                this.logger.warn(`[VISUAL] Failed to delete old screenshot: ${error.message}`, {
                    category: 'visual-capture',
                    component: 'visual-capture'
                });
            }
        }
    }

    /**
     * Get current monitoring status
     * 
     * @returns {Object} Status info
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            captureInterval: this.config.captureInterval,
            queueSize: this.screenshotQueue.length,
            maxStoredScreenshots: this.config.maxStoredScreenshots,
            changeDetected: this.changeDetected,
            lastScreenshot: this.getLatestScreenshot()
        };
    }

    /**
     * Cleanup and shutdown
     */
    async destroy() {
        await this.stopMonitoring();
        
        // Cleanup all screenshots
        for (const screenshot of this.screenshotQueue) {
            try {
                await fs.unlink(screenshot.filepath);
            } catch (error) {
                // Ignore errors during cleanup
            }
        }

        this.screenshotQueue = [];
        this.logger.system('visual-capture', '[VISUAL] Visual Capture Service destroyed');
    }
}

export default VisualCaptureService;
