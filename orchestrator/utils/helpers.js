/**
 * UTILITY HELPERS
 * Допоміжні функції для оркестратора
 */

import logger from './logger.js';

// Helper functions
export const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Deprecated - use logger directly instead
export const logMessage = (level, message) => {
  logger[level] ? logger[level](message) : logger.info(message);
};


// Кінець файлу
