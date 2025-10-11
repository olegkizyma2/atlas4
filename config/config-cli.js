#!/usr/bin/env node

/**
 * CONFIG CLI - Утиліта командного рядка для управління конфігураціями ATLAS
 *
 * Використання:
 *   node config/config-cli.js sync          # Синхронізувати всі конфігурації
 *   node config/config-cli.js status        # Показати статус конфігурацій
 *   node config/config-cli.js backup        # Створити backup
 *   node config/config-cli.js restore <path> # Відновити з backup
 *   node config/config-cli.js validate      # Валідувати конфігурації
 *   node config/config-cli.js watch         # Слідкувати за змінами та автосинк
 */

import { program } from 'commander';
import { watch } from 'chokidar';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

// Імпорт конфігураційного менеджера
import configManagerDefault, {
  syncAllConfigs,
  syncConfig,
  createConfigBackup,
  restoreConfigBackup,
  getConfigStatus,
  validateGlobalConfig
} from './config-manager.js';

const configManager = configManagerDefault;

// Налаштування CLI
program
  .name('atlas-config')
  .description('Утиліта управління конфігураціями ATLAS')
  .version('4.0.0');

/**
 * Команда синхронізації
 */
program
  .command('sync')
  .description('Синхронізувати всі конфігурації з глобальної')
  .option('-t, --target <name>', 'Синхронізувати конкретну ціль')
  .option('-f, --force', 'Форсувати синхронізацію навіть якщо не потрібно')
  .option('--backup', 'Створити backup перед синхронізацією')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔄 Початок синхронізації конфігурацій ATLAS'));

      // Створюємо backup якщо потрібно
      if (options.backup) {
        console.log(chalk.yellow('📦 Створюємо backup...'));
        const backupPath = await createConfigBackup();
        console.log(chalk.green(`✅ Backup створено: ${backupPath}`));
      }

      // Синхронізація
      if (options.target) {
        console.log(chalk.cyan(`🎯 Синхронізуємо ціль: ${options.target}`));
        await syncConfig(options.target);
      } else {
        console.log(chalk.cyan('🌐 Синхронізуємо всі конфігурації'));
        const results = await syncAllConfigs();

        if (results.errors.length > 0) {
          console.log(chalk.red(`\n❌ Виявлено ${results.errors.length} помилок!`));
          process.exit(1);
        }
      }

      console.log(chalk.green('✅ Синхронізація завершена успішно!'));

    } catch (error) {
      console.error(chalk.red('❌ Помилка синхронізації:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда статусу
 */
program
  .command('status')
  .description('Показати статус конфігурацій')
  .option('-v, --verbose', 'Докладний вивід')
  .action(async (options) => {
    try {
      const status = getConfigStatus();

      console.log(chalk.blue('📊 Статус конфігурацій ATLAS\n'));

      // Глобальна конфігурація
      console.log(chalk.bold('🌍 Глобальна конфігурація:'));
      console.log(`   Хеш: ${status.globalConfig.hash.substring(0, 12)}...`);
      console.log(`   Потребує синхронізації: ${status.globalConfig.needsSync ? chalk.red('ТАК') : chalk.green('НІ')}\n`);

      // Цілі синхронізації
      console.log(chalk.bold('🎯 Цілі синхронізації:'));

      for (const [name, target] of Object.entries(status.targets)) {
        const exists = target.exists ? chalk.green('✓') : chalk.red('✗');
        const synced = target.lastSync ? chalk.green(new Date(target.lastSync).toLocaleString('uk-UA')) : chalk.gray('Ніколи');

        console.log(`   ${exists} ${chalk.bold(name)}`);
        if (options.verbose) {
          console.log(`      Шлях: ${target.path}`);
          console.log(`      Останній синк: ${synced}`);
          if (target.checksum) {
            console.log(`      Чексума: ${target.checksum.substring(0, 8)}...`);
          }
        }
      }

      // Підсумок
      const totalTargets = Object.keys(status.targets).length;
      const existingTargets = Object.values(status.targets).filter(t => t.exists).length;
      const syncedTargets = Object.values(status.targets).filter(t => t.lastSync).length;

      console.log(`\n📈 Підсумок:`);
      console.log(`   Всього цілей: ${totalTargets}`);
      console.log(`   Існуючих файлів: ${existingTargets}/${totalTargets}`);
      console.log(`   Синхронізованих: ${syncedTargets}/${totalTargets}`);

    } catch (error) {
      console.error(chalk.red('❌ Помилка отримання статусу:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда backup
 */
program
  .command('backup')
  .description('Створити backup поточних конфігурацій')
  .option('-d, --dir <directory>', 'Директорія для backup (за замовчуванням config/backups)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📦 Створюємо backup конфігурацій...'));

      const backupPath = await createConfigBackup();

      console.log(chalk.green(`✅ Backup створено успішно!`));
      console.log(chalk.gray(`   Шлях: ${backupPath}`));

    } catch (error) {
      console.error(chalk.red('❌ Помилка створення backup:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда відновлення
 */
program
  .command('restore <backup-path>')
  .description('Відновити конфігурації з backup')
  .option('-f, --force', 'Форсувати відновлення без підтвердження')
  .action(async (backupPath, options) => {
    try {
      if (!existsSync(backupPath)) {
        console.error(chalk.red(`❌ Backup не знайдено: ${backupPath}`));
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.yellow('⚠️ Це перезапише поточні конфігурації!'));
        console.log(chalk.gray('   Використайте --force для пропуску підтвердження'));
        return;
      }

      console.log(chalk.blue(`🔄 Відновлюємо конфігурації з: ${backupPath}`));

      await restoreConfigBackup(backupPath);

      console.log(chalk.green('✅ Конфігурації відновлено успішно!'));

    } catch (error) {
      console.error(chalk.red('❌ Помилка відновлення:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда валідації
 */
program
  .command('validate')
  .description('Валідувати глобальну конфігурацію')
  .option('--strict', 'Строга валідація')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Валідуємо глобальну конфігурацію...'));

      validateGlobalConfig();

      console.log(chalk.green('✅ Конфігурація валідна!'));

      // Додаткові перевірки у строгому режимі
      if (options.strict) {
        console.log(chalk.cyan('🔬 Виконуємо строгу валідацію...'));

        const status = getConfigStatus();
        const issues = [];

        // Перевіряємо чи всі цілі існують
        for (const [name, target] of Object.entries(status.targets)) {
          if (!target.exists) {
            issues.push(`Відсутній файл: ${name} (${target.path})`);
          }
          if (!target.lastSync) {
            issues.push(`Ніколи не синхронізувався: ${name}`);
          }
        }

        if (issues.length > 0) {
          console.log(chalk.yellow('⚠️ Знайдено проблеми:'));
          issues.forEach(issue => console.log(`   - ${issue}`));
          console.log(chalk.gray('\nВиконайте "atlas-config sync" для виправлення'));
        } else {
          console.log(chalk.green('✅ Строга валідація пройшла успішно!'));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Помилка валідації:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда слідкування
 */
program
  .command('watch')
  .description('Слідкувати за змінами глобальної конфігурації та автоматично синхронізувати')
  .option('-i, --interval <seconds>', 'Інтервал перевірки в секундах', '5')
  .option('--no-auto-backup', 'Не створювати автоматичні backup')
  .action(async (options) => {
    try {
      console.log(chalk.blue('👁️ Запускаємо спостереження за конфігураціями...'));
      console.log(chalk.gray('   Натисніть Ctrl+C для зупинки'));

      const globalConfigPath = resolve('config/global-config.js');

      // Слідкування за файлом глобальної конфігурації
      const watcher = watch(globalConfigPath, {
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('change', async () => {
        try {
          console.log(chalk.yellow('\n🔄 Виявлено зміни в глобальній конфігурації...'));

          // Створюємо backup якщо потрібно
          if (options.autoBackup !== false) {
            await createConfigBackup();
            console.log(chalk.green('📦 Backup створено'));
          }

          // Синхронізуємо
          await syncAllConfigs();
          console.log(chalk.green('✅ Конфігурації синхронізовано\n'));

        } catch (error) {
          console.error(chalk.red('❌ Помилка автосинхронізації:'), error.message);
        }
      });

      watcher.on('error', (error) => {
        console.error(chalk.red('❌ Помилка спостереження:'), error.message);
      });

      // Перевірка статусу кожні N секунд
      const interval = parseInt(options.interval) * 1000;
      const statusTimer = setInterval(async () => {
        if (configManager.needsSync()) {
          console.log(chalk.yellow('🔄 Виявлено необхідність синхронізації...'));
          try {
            await syncAllConfigs();
            console.log(chalk.green('✅ Автосинхронізація завершена'));
          } catch (error) {
            console.error(chalk.red('❌ Помилка автосинхронізації:'), error.message);
          }
        }
      }, interval);

      // Обробка завершення
      process.on('SIGINT', () => {
        console.log(chalk.blue('\n👋 Зупиняємо спостереження...'));
        clearInterval(statusTimer);
        watcher.close();
        process.exit(0);
      });

    } catch (error) {
      console.error(chalk.red('❌ Помилка запуску спостереження:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда очищення
 */
program
  .command('cleanup')
  .description('Очистити застарілі backup та тимчасові файли')
  .option('-k, --keep <count>', 'Кількість backup для збереження', '10')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🧹 Очищуємо застарілі файли...'));

      await configManager.cleanupBackups(parseInt(options.keep));

      console.log(chalk.green('✅ Очищення завершено!'));

    } catch (error) {
      console.error(chalk.red('❌ Помилка очищення:'), error.message);
      process.exit(1);
    }
  });

/**
 * Команда init для ініціальної настройки
 */
program
  .command('init')
  .description('Ініціалізувати централізовану систему конфігурацій')
  .option('--force', 'Перезаписати існуючі конфігурації')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Ініціалізуємо централізовану систему конфігурацій...'));

      // Створюємо backup існуючих конфігурацій
      console.log(chalk.yellow('📦 Створюємо backup існуючих конфігурацій...'));
      const backupPath = await createConfigBackup();
      console.log(chalk.green(`✅ Backup збережено: ${backupPath}`));

      // Валідуємо глобальну конфігурацію
      console.log(chalk.cyan('🔍 Валідуємо глобальну конфігурацію...'));
      validateGlobalConfig();
      console.log(chalk.green('✅ Глобальна конфігурація валідна'));

      // Синхронізуємо всі конфігурації
      console.log(chalk.cyan('🔄 Синхронізуємо всі конфігурації...'));
      const results = await syncAllConfigs();

      if (results.errors.length > 0) {
        console.log(chalk.red(`❌ Виявлено ${results.errors.length} помилок при синхронізації!`));
        results.errors.forEach(err => {
          console.log(chalk.red(`   - ${err.name}: ${err.error}`));
        });
        process.exit(1);
      }

      console.log(chalk.green('🎉 Централізована система конфігурацій успішно ініціалізована!'));
      console.log(chalk.gray('\nТепер всі конфігурації синхронізуються з config/global-config.js'));
      console.log(chalk.gray('Використовуйте "atlas-config watch" для автоматичної синхронізації'));

    } catch (error) {
      console.error(chalk.red('❌ Помилка ініціалізації:'), error.message);
      process.exit(1);
    }
  });

// Запуск CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
