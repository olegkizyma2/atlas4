/**
 * ATLAS ORCHESTRATOR SERVER v4.0
 * Bootstrap Entry Point - Minimal Server Initialization
 * 
 * Refactored 11.10.2025: Модульна архітектура з чіткою separation of concerns
 */

import Application from './core/application.js';

// Створюємо та запускаємо додаток
const app = new Application();

try {
  await app.start();
} catch (error) {
  console.error('❌ Failed to start ATLAS Orchestrator:', error);
  process.exit(1);
}

// Експортуємо для тестування
export default app;
