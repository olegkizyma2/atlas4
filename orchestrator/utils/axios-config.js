/**
 * Axios Configuration with Rate Limit Handling
 * 
 * Обробляє 429 помилки з Retry-After headers
 * Запобігає spam запитам при rate limiting
 */

import axios from 'axios';
import logger from './logger.js';

/**
 * Parse Retry-After header (seconds або timestamp)
 * @param {string|number} retryAfter - Retry-After header value
 * @returns {number} Delay in milliseconds
 */
function parseRetryAfter(retryAfter) {
    if (!retryAfter) return 5000; // Default 5 seconds

    // Якщо число - це секунди
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return Math.min(seconds * 1000, 60000); // Max 60 seconds
    }

    // Якщо HTTP date - парсимо як timestamp
    try {
        const retryDate = new Date(retryAfter);
        const now = new Date();
        const delay = retryDate.getTime() - now.getTime();
        return Math.max(Math.min(delay, 60000), 1000); // Min 1s, Max 60s
    } catch {
        return 5000; // Fallback 5 seconds
    }
}

/**
 * Exponential backoff з jitter
 * @param {number} attempt - Спроба (0-based)
 * @returns {number} Delay in milliseconds
 */
function getExponentialBackoff(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Random 0-1s jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep для async/await
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Configure Axios з retry logic для 429 помилок
 */
export function configureAxios() {
    // Response interceptor для обробки 429
    axios.interceptors.response.use(
        (response) => response, // Success - pass through
        async (error) => {
            const config = error.config;

            // Ігноруємо якщо НЕ 429 або вже retry
            if (error.response?.status !== 429) {
                return Promise.reject(error);
            }

            // Ініціалізуємо retry counter
            config.__retryCount = config.__retryCount || 0;
            const maxRetries = config.maxRetries || 3;

            // Якщо досягли максимуму - fail
            if (config.__retryCount >= maxRetries) {
                logger.error(`Rate limit retry failed after ${maxRetries} attempts`, {
                    url: config.url,
                    method: config.method,
                    retries: config.__retryCount
                });
                return Promise.reject(error);
            }

            // Інкрементуємо counter
            config.__retryCount++;

            // Отримуємо Retry-After header або використовуємо exponential backoff
            const retryAfter = error.response?.headers?.['retry-after'];
            const delay = retryAfter
                ? parseRetryAfter(retryAfter)
                : getExponentialBackoff(config.__retryCount - 1);

            logger.warn(`Rate limit hit (429), retrying after ${delay}ms (attempt ${config.__retryCount}/${maxRetries})`, {
                url: config.url,
                method: config.method,
                retryAfter: retryAfter || 'none',
                delay
            });

            // Чекаємо перед повторною спробою
            await sleep(delay);

            // Повторюємо запит
            return axios(config);
        }
    );

    // Request interceptor для логування (опціонально)
    axios.interceptors.request.use(
        (config) => {
            // Додаємо default timeout якщо не встановлено
            if (!config.timeout) {
                config.timeout = 30000; // 30 seconds default
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    logger.info('Axios configured with rate limit handling (429 + Retry-After)');
}

/**
 * Create axios instance з custom retry config
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.timeout - Request timeout (default: 30000ms)
 * @returns {AxiosInstance}
 */
export function createAxiosInstance(options = {}) {
    const instance = axios.create({
        timeout: options.timeout || 30000,
        maxRetries: options.maxRetries || 3,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Apply same interceptors
    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const config = error.config;

            if (error.response?.status !== 429) {
                return Promise.reject(error);
            }

            config.__retryCount = config.__retryCount || 0;
            const maxRetries = config.maxRetries || options.maxRetries || 3;

            if (config.__retryCount >= maxRetries) {
                logger.error(`Rate limit retry failed after ${maxRetries} attempts`, {
                    url: config.url,
                    method: config.method
                });
                return Promise.reject(error);
            }

            config.__retryCount++;

            const retryAfter = error.response?.headers?.['retry-after'];
            const delay = retryAfter
                ? parseRetryAfter(retryAfter)
                : getExponentialBackoff(config.__retryCount - 1);

            logger.warn(`Rate limit hit, retrying after ${delay}ms (${config.__retryCount}/${maxRetries})`, {
                url: config.url
            });

            await sleep(delay);
            return instance(config);
        }
    );

    return instance;
}

export default { configureAxios, createAxiosInstance, parseRetryAfter, sleep };
