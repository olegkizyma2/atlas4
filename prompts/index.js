/**
 * Центральний реєстр всіх промптів системи
 * Оновлено для підтримки нового ESM prompt-registry.js
 */

// Legacy CommonJS підтримка
const fs = require('fs');
const path = require('path');

// Функція завантаження промптів з директорії (legacy)
function loadPromptsFromDirectory(directory) {
  const promptsPath = path.join(__dirname, directory);

  // Перевіряємо, чи існує директорія
  if (!fs.existsSync(promptsPath)) {
    console.warn(`Директорія промптів не знайдена: ${promptsPath}`);
    return {};
  }

  const promptFiles = fs.readdirSync(promptsPath)
    .filter(file => file.endsWith('.js'));

  const prompts = {};

  promptFiles.forEach(file => {
    try {
      const promptModule = require(path.join(promptsPath, file));
      const promptName = file.replace('.js', '');
      prompts[promptName] = promptModule;
    } catch (error) {
      console.error(`Помилка завантаження промпту ${file}:`, error);
    }
  });

  return prompts;
}

// Завантажуємо промпти з усіх директорій (legacy)
const atlasPrompts = loadPromptsFromDirectory('atlas');
const grishaPrompts = loadPromptsFromDirectory('grisha');
const tetyanaPrompts = loadPromptsFromDirectory('tetyana');
const systemPrompts = loadPromptsFromDirectory('system');
const voicePrompts = loadPromptsFromDirectory('voice');

// Об'єднуємо всі промпти в єдиний реєстр (legacy)
const allPrompts = {
  atlas: atlasPrompts,
  grisha: grishaPrompts,
  tetyana: tetyanaPrompts,
  system: systemPrompts,
  voice: voicePrompts
};

// Legacy CommonJS експорт
module.exports = allPrompts;

// НОВЕ: ESM експорт для майбутнього використання
// Для імпорту нового registry використовуйте:
// import PromptRegistry from './prompt-registry.js';
module.exports.PromptRegistry = null; // Буде замінено на динамічний імпорт при потребі
