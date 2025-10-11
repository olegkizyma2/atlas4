# ATLAS Prompts & Workflow System# Стандарт промптів ATLAS4



Централізована система промптів та workflow конфігурації для ATLAS v4.0.## Структура промптів



## 📁 СтруктураВсі промпти повинні відповідати єдиному формату для забезпечення сумісності та зручності підтримки.



```### Простий формат (експорт рядка)

prompts/

├── atlas/              # Промпти координатора Atlas```javascript

├── tetyana/            # Промпти виконавця Тетяниmodule.exports = `

├── grisha/             # Промпти верифікатора ГришіВи помічник по задачі {{taskName}}.

└── system/             # Системні промптиКонтекст: {{context}}



config/Будь ласка, виконайте наступну дію:

├── workflow-config.js  # Конфігурація етапів workflow{{action}}

├── agents-config.js    # Конфігурація агентів`;

└── global-config.js    # Глобальна конфігурація```

```

### Розширений формат (експорт об'єкта)

## 🚀 Швидкий старт

```javascript

### Валідація системи:module.exports = {

```bash  // Метадані промпту

# Швидка перевірка  name: 'Назва промпту',

./scripts/validate-prompts.sh  description: 'Опис промпту та його призначення',

  version: '1.0.0',

# Окремі команди:  author: 'Ім\'я автора',

node scripts/audit-prompts.js              # Структура  

node scripts/analyze-prompts-quality.js    # Якість  // Функція для динамічної генерації промпту

bash tests/test-all-prompts.sh             # Тести  getPrompt: (data) => {

```    return `

    Ви помічник по задачі ${data.taskName}.

## 📊 Статистика    Контекст: ${data.context}



- **13 стейджів** в workflow    Будь ласка, виконайте наступну дію:

- **21/21 тестів** проходять ✅    ${data.action}

- **92% якості** промптів    `;

  },

## 📚 Документація  

  // Або статичний шаблон

- [Повний звіт аудиту](../docs/PROMPTS_WORKFLOW_AUDIT_REPORT.md)  template: `

- [Workflow конфігурація](../config/workflow-config.js)  Ви помічник по задачі {{taskName}}.

  Контекст: {{context}}

**Статус:** 🟢 READY FOR PRODUCTION

  Будь ласка, виконайте наступну дію:
  {{action}}
  `
};
```

## Використання промптів

Для використання промптів у коді, використовуйте PromptManager:

```javascript
const promptManager = require('./prompt-manager');

// Отримання та заповнення промпту
const filledPrompt = promptManager.preparePrompt('atlas/stage1_initial_processing', {
  taskName: 'Обробка даних',
  context: 'Дані користувача',
  action: 'Проаналізуйте дані'
});
```

## Структура директорій

- `/atlas/` - промпти для загальної логіки обробки задач
- `/grisha/` - промпти для діагностики та верифікації
- `/tetyana/` - промпти для виконання та повторних спроб
- `/system/` - системні промпти для аналізу стану та службових задач

## Правила іменування

- Використовуйте змістовні назви файлів: `stage1_initial_processing.js`
- Включайте номер стадії для правильного порядку виконання
- Використовуйте англійські назви файлів для сумісності

## Приклади використання

### Базове використання
```javascript
const prompt = promptManager.preparePrompt('atlas/stage1_initial_processing', {
  userQuery: 'Допоможіть з аналізом даних',
  context: 'Файл CSV з продажами'
});
```

### Використання з метаданими
```javascript
const promptModule = promptManager.getPrompt('system/state_analysis_prompts');
if (promptModule.version) {
  console.log(`Використовується промпт версії: ${promptModule.version}`);
}
```