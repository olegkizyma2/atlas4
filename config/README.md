# 🔧 ATLAS Configuration Management System

Централізована система управління конфігураціями для ATLAS Workflow System. Забезпечує узгодженість налаштувань у всьому проєкті та автоматичну синхронізацію локальних конфігурацій.

## 📋 Огляд

Система конфігурацій ATLAS вирішує проблему дублювання та неузгодженості налаштувань шляхом створення єдиного джерела правди (`global-config.js`) та автоматичної синхронізації всіх локальних конфігурацій.

### ✨ Основні можливості

- 🌍 **Єдине джерело правди** - всі конфігурації в одному файлі
- 🔄 **Автоматична синхронізація** - локальні конфігурації оновлюються автоматично
- 🎯 **Цільова синхронізація** - можна оновити конкретні модулі
- 📦 **Backup система** - автоматичне збереження перед змінами
- 🔍 **Валідація** - перевірка цілісності конфігурацій
- 👁️ **Моніторинг змін** - автоматичне відстеження оновлень
- 🛠️ **CLI інструменти** - зручне управління через командний рядок

## 📁 Структура

```
config/
├── global-config.js     # 🌍 Глобальна конфігурація (основний файл)
├── config-manager.js    # 🔄 Менеджер синхронізації
├── config-cli.js       # 🖥️ CLI утиліти
├── sync-configs.js     # ⚡ Швидка синхронізація
├── test-config.js      # 🧪 Тести системи
├── package.json        # 📦 Залежності CLI
├── README.md           # 📖 Ця документація
└── backups/            # 💾 Автоматичні backup (створюється автоматично)
    └── backup-YYYY-MM-DD/
```

## 🚀 Швидкий старт

### 1. Ініціалізація системи

```bash
# Перехід у директорію конфігурацій
cd config

# Встановлення залежностей
npm install

# Ініціалізація системи (створить backup та синхронізує все)
npm run init
```

### 2. Базове використання

```bash
# Синхронізація всіх конфігурацій
npm run sync

# Перевірка статусу
npm run status

# Валідація конфігурацій
npm run validate

# Створення backup
npm run backup

# Автоматичне слідкування за змінами
npm run watch
```

## 🔧 Детальне використання

### CLI Команди

```bash
# Синхронізація
atlas-config sync                    # Синхронізувати все
atlas-config sync --target frontend # Синхронізувати конкретну ціль
atlas-config sync --backup          # З backup перед синхронізацією

# Статус системи
atlas-config status                  # Базовий статус
atlas-config status --verbose       # Детальний статус

# Backup та відновлення
atlas-config backup                  # Створити backup
atlas-config restore <path> --force # Відновити з backup

# Валідація
atlas-config validate               # Базова валідація
atlas-config validate --strict     # Строга валідація

# Моніторинг
atlas-config watch                  # Слідкування за змінами
atlas-config watch --interval 10   # З кастомним інтервалом

# Очищення
atlas-config cleanup                # Очистити старі backup
atlas-config cleanup --keep 5      # Залишити 5 останніх

# Ініціалізація
atlas-config init                   # Повна ініціалізація системи
```

### Програматичне використання

```javascript
// Імпорт глобальної конфігурації
import GlobalConfig from './config/global-config.js';

// Отримання конфігурації агента
const atlasConfig = GlobalConfig.getAgentConfig('atlas');

// API URL
const orchestratorUrl = GlobalConfig.getApiUrl('orchestrator', '/api/chat');

// Workflow етап
const stage1 = GlobalConfig.getWorkflowStage(1);

// Використання конфігурацій
console.log(GlobalConfig.AGENTS.atlas.voice); // 'dmytro'
console.log(GlobalConfig.TTS_CONFIG.enabled); // true
```

```javascript
// Використання Config Manager
import { syncAllConfigs, getConfigStatus } from './config/config-manager.js';

// Синхронізація
const results = await syncAllConfigs();

// Статус
const status = getConfigStatus();
console.log(status.globalConfig.needsSync);
```

## 📄 Глобальна конфігурація

Файл `global-config.js` містить всі налаштування системи:

### Основні розділи

- **SYSTEM_INFO** - Інформація про версію та систему
- **AGENTS** - Конфігурація всіх агентів (Atlas, Тетяна, Гриша)
- **WORKFLOW_STAGES** - Етапи workflow та їх параметри
- **NETWORK_CONFIG** - Мережеві налаштування та сервіси
- **API_ENDPOINTS** - Автоматично генеровані API URL
- **TTS_CONFIG** - Налаштування синтезу мовлення
- **VOICE_CONFIG** - Конфігурація голосового управління
- **WORKFLOW_CONFIG** - Параметри workflow виконання
- **CHAT_CONFIG** - Налаштування чату
- **SECURITY_CONFIG** - Параметри безпеки

### Приклад конфігурації агента

```javascript
export const AGENTS = {
    atlas: {
        role: 'strategist_coordinator',
        name: 'Атлас',
        signature: '[ATLAS]',
        color: '#00ff00',
        voice: 'dmytro',
        priority: 1,
        description: 'Стратег-координатор',
        enableTools: false,
        model: 'github-copilot',
        maxRetries: 2,
        timeout: 30000
    }
    // ... інші агенти
};
```

## 🎯 Цілі синхронізації

Система автоматично синхронізує наступні конфігурації:

| Ціль | Файл | Опис |
|------|------|------|
| `frontend-web` | `web/static/js/shared-config.js` | Frontend конфігурація |
| `orchestrator` | `orchestrator/config.js` | Серверна конфігурація |
| `voice-control` | `web/static/js/voice-control/config.js` | Голосове управління |
| `core-config` | `web/static/js/core/config.js` | Базова конфігурація |
| `legacy-shared` | `shared-config.js` | Зворотна сумісність |

Кожна ціль має власний шаблон, який визначає які саме конфігурації експортувати та як їх структурувати.

## 🔄 Автоматична синхронізація

### Моніторинг змін

```bash
# Запуск спостереження (автоматично синхронізує при змінах)
atlas-config watch

# З кастомними налаштуваннями
atlas-config watch --interval 10 --no-auto-backup
```

### Інтеграція в проєкт

Додайте в `package.json` головного проєкту:

```json
{
  "scripts": {
    "config:sync": "cd config && npm run sync",
    "config:status": "cd config && npm run status",
    "config:watch": "cd config && npm run watch",
    "prestart": "npm run config:sync",
    "prebuild": "npm run config:sync"
  }
}
```

### Git hooks

Створіть `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Синхронізація конфігурацій перед коммітом
cd config && npm run sync
git add -A
```

## 🛠️ Розширення системи

### Додавання нової цілі синхронізації

```javascript
// В config-manager.js
this.addSyncTarget('my-service', {
    path: 'services/my-service/config.js',
    type: 'es6-module',
    exports: ['AGENTS', 'API_ENDPOINTS'],
    template: 'custom-template'
});
```

### Створення кастомного шаблону

```javascript
// Додайте новий генератор в config-manager.js
generateCustomTemplate(target) {
    const exports = this.getExportedConfigs(target.exports);
    return `
// Кастомна конфігурація
import GlobalConfig from '../config/global-config.js';

${exports.map(exp => `export const ${exp} = GlobalConfig.${exp};`).join('\n')}
    `;
}
```

## 🔍 Діагностика та налагодження

### Перевірка статусу

```bash
# Детальний статус всіх компонентів
atlas-config status --verbose

# Валідація з детальними перевірками
atlas-config validate --strict

# Тестування системи
npm test
```

### Часті проблеми

1. **Конфігурація не синхронізується**
   ```bash
   # Перевірте статус та помилки
   atlas-config status
   atlas-config validate
   
   # Форсована синхронізація
   atlas-config sync --force
   ```

2. **Помилки імпорту**
   ```bash
   # Перевірте структуру конфігурації
   node -e "import('./global-config.js').then(console.log)"
   ```

3. **Застарілі конфігурації**
   ```bash
   # Створіть backup та повна пересинхронізація
   atlas-config backup
   atlas-config init --force
   ```

## 📊 Моніторинг та логи

Система автоматично логує всі операції:

- ✅ Успішна синхронізація
- ❌ Помилки та їх деталі  
- 📦 Створення backup
- 🔍 Результати валідації

Для детального моніторингу використовуйте `--verbose` флаги.

## 🎛️ Налаштування середовища

Змінні оточення для конфігурації:

```bash
# .env файл
NODE_ENV=production
ENABLE_TTS=true
ENABLE_SIMULATION=false
LOG_LEVEL=info
CONFIG_AUTO_SYNC=true
```

## 🤝 Внесок у розвиток

1. Всі зміни в конфігураціях мають бути в `global-config.js`
2. Локальні конфігурації НЕ редагуються вручну
3. Нові сервіси додаються через config-manager
4. Тестуйте зміни через `npm test`

## 📞 Підтримка

При проблемах з конфігураціями:

1. Запустіть діагностику: `atlas-config validate --strict`
2. Перевірте логи синхронізації
3. Створіть issue з детальним описом проблеми
4. Додайте вивід команд діагностики

---

**Версія системи:** 2.0.0  
**Останнє оновлення:** 2025-09-23  
**Мова:** Українська/English
