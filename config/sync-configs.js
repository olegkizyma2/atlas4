#!/usr/bin/env node

/**
 * SYNC CONFIGS - Скрипт для автоматичної синхронізації конфігурацій
 *
 * Цей скрипт можна викликати з будь-якого місця в проєкті для синхронізації
 * Використовується в npm scripts та CI/CD
 */

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Динамічний імпорт для сумісності
async function syncConfigurations() {
  try {
    console.log('🔄 Запуск синхронізації конфігурацій ATLAS...');

    // Імпортуємо config manager
    const { syncAllConfigs, validateGlobalConfig, createConfigBackup } = await import('./config-manager.js');

    // 1. Валідація глобальної конфігурації
    console.log('🔍 Валідуємо глобальну конфігурацію...');
    validateGlobalConfig();
    console.log('✅ Глобальна конфігурація валідна');

    // 2. Створюємо backup перед синхронізацією (опціонально)
    if (process.argv.includes('--backup')) {
      console.log('📦 Створюємо backup...');
      const backupPath = await createConfigBackup();
      console.log(`✅ Backup створено: ${backupPath}`);
    }

    // 3. Синхронізація
    console.log('🔄 Синхронізуємо всі конфігурації...');
    const results = await syncAllConfigs();

    // 4. Перевірка результатів
    if (results.errors.length > 0) {
      console.error(`❌ Виявлено ${results.errors.length} помилок при синхронізації:`);
      results.errors.forEach(err => {
        console.error(`   - ${err.name}: ${err.error}`);
      });
      process.exit(1);
    }

    console.log('🎉 Всі конфігурації синхронізовано успішно!');
    console.log(`   ✅ Успішно: ${results.success.length}`);

    return results;

  } catch (error) {
    console.error('❌ Критична помилка синхронізації:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Виконання при прямому виклику
if (import.meta.url === `file://${process.argv[1]}`) {
  syncConfigurations()
    .then((results) => {
      console.log('\n📊 Синхронізація завершена успішно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Синхронізація невдала:', error.message);
      process.exit(1);
    });
}

export default syncConfigurations;
