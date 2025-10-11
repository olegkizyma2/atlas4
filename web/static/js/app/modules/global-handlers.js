/**
 * ATLAS Global Handlers - v4.0
 * Відповідає за обробку глобальних подій та помилок
 */

import { logger } from '../core/logger.js';

export class GlobalHandlers {
  constructor(managers, uiManager) {
    this.logger = new logger.constructor('GLOBAL-HANDLERS');
    this.managers = managers;
    this.uiManager = uiManager;
  }

  setupGlobalHandlers() {
    this.logger.info('🛡️ Setting up global handlers...');

    // Захист від випадкових перезавантажень
    this.setupUnloadProtection();

    // Глобальний обробник помилок
    this.setupErrorHandlers();

    // Обробка втрати з'єднання
    this.setupConnectionHandlers();

    this.logger.info('✅ Global handlers setup complete');
  }

  setupUnloadProtection() {
    window.addEventListener('beforeunload', (e) => {
      const pageAge = Date.now() - performance.timing.navigationStart;
      const isStreaming = this.managers.chat && this.managers.chat.isStreaming;
      const isRecentLoad = pageAge < 10000;

      if (isStreaming || isRecentLoad) {
        this.logger.warn(`Preventing reload: streaming=${isStreaming}, recentLoad=${isRecentLoad}`);

        const message = isStreaming ?
          'Зачекайте завершення обробки повідомлення...' :
          'Зачекайте кілька секунд...';

        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    });
  }

  setupErrorHandlers() {
    window.addEventListener('error', (e) => {
      this.logger.error('Global error', e.error?.message || 'Unknown error');
      this.uiManager.showErrorMessage(`Помилка: ${e.error?.message || 'Невідома помилка'}`);
    });

    window.addEventListener('unhandledrejection', (e) => {
      // Ігноруємо AbortError як некритичні помилки
      if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('aborted')) {
        this.logger.debug('Ignoring AbortError from timeout/user action');
        e.preventDefault(); // Prevent console error
        return;
      }

      this.logger.error('Unhandled promise rejection', e.reason?.message || 'Unknown reason');
      this.uiManager.showErrorMessage(`Promise помилка: ${e.reason?.message || 'Невідома причина'}`);
    });
  }

  setupConnectionHandlers() {
    window.addEventListener('online', () => {
      this.logger.info('Connection restored');
      this.uiManager.showSuccessMessage('З\'єднання відновлено');
    });

    window.addEventListener('offline', () => {
      this.logger.warn('Connection lost');
      this.uiManager.showErrorMessage('З\'єднання втрачено');
    });
  }
}
