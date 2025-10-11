# Atlas Advanced UI Modules

**Рефакторинг від:** 2025-01-09  
**Версія:** 2.0.0

---

## 📋 Огляд

Модульні компоненти для Atlas Advanced UI, винесені з монолітного `atlas-advanced-ui.js` (1115 рядків) для покращення підтримуваності.

---

## 📂 Структура

```
ui/modules/
├── README.md                   ← Ви тут
├── theme-manager.js           (200 рядків) ⭐ NEW
├── notification-manager.js    (250 рядків) ⭐ NEW
├── tooltip-manager.js         (200 рядків) ⭐ NEW
└── modal-manager.js           (250 рядків) ⭐ NEW
```

**Економія в atlas-advanced-ui.js:** ~900 рядків винесено

---

## 🎯 Модулі

### 1. **Theme Manager** (`theme-manager.js`)

**Призначення:** Управління темами інтерфейсу

**Підтримувані теми:**
- `dark-cyber` - Темна кібер-тема (за замовчуванням)
- `light-tech` - Світла технологічна тема
- `neo-green` - Зелена матричн тема
- `purple-night` - Фіолетова нічна тема

**Використання:**
```javascript
import { ThemeManager } from './modules/theme-manager.js';

const themeManager = new ThemeManager({
    theme: 'dark-cyber',
    accentColor: '#00ff7f',
    enableDynamicColors: true
});

// Застосувати тему
themeManager.apply();

// Переключити тему
themeManager.switchTheme('neo-green');

// Циклічне перемикання
themeManager.toggleTheme();

// Отримати доступні теми
const themes = themeManager.getAvailableThemes();

// Додати нову тему
themeManager.addTheme('custom-theme', {
    '--primary-color': '#ff0000',
    // ... інші CSS змінні
});
```

**Функції:**
- ✅ 4 готові теми
- ✅ CSS змінні для кастомізації
- ✅ LocalStorage persistence
- ✅ Динамічне додавання тем
- ✅ Автоматична синхронізація з DOM

---

### 2. **Notification Manager** (`notification-manager.js`)

**Призначення:** Система сповіщень

**Типи сповіщень:**
- `info` - Інформаційне (ℹ️)
- `success` - Успішне (✅)
- `warning` - Попередження (⚠️)
- `error` - Помилка (❌)

**Використання:**
```javascript
import { NotificationManager } from './modules/notification-manager.js';

const notifications = new NotificationManager({
    enableAnimations: true,
    defaultDuration: 5000,
    maxNotifications: 5
});

// Показати сповіщення
notifications.show('Hello World', 'info', 3000);

// Швидкі методи
notifications.info('Інформація');
notifications.success('Успіх!');
notifications.warning('Увага!');
notifications.error('Помилка!');

// Нескінченне сповіщення (duration = 0)
const notification = notifications.show('Processing...', 'info', 0);

// Видалити конкретне сповіщення
notifications.remove(notification);

// Очистити всі
notifications.clearAll();
```

**Функції:**
- ✅ 4 типи сповіщень
- ✅ Автоматичне видалення
- ✅ Анімації появи/зникнення
- ✅ Обмеження кількості
- ✅ Кнопка закриття

---

### 3. **Tooltip Manager** (`tooltip-manager.js`)

**Призначення:** Інтелектуальні підказки

**Використання:**
```html
<!-- HTML -->
<button data-tooltip="Клікніть для збереження">Зберегти</button>
<button title="Або використайте атрибут title">Скасувати</button>
```

```javascript
import { TooltipManager } from './modules/tooltip-manager.js';

const tooltips = new TooltipManager({
    enabled: true,
    enableAnimations: true,
    delay: 300 // мс затримки
});

// Показати tooltip вручну в позиції
tooltips.showAt('Custom tooltip', 100, 100);

// Приховати
tooltips.hide();

// Увімкнути/вимкнути
tooltips.setEnabled(false);
```

**Функції:**
- ✅ Автоматична детекція `[title]` та `[data-tooltip]`
- ✅ Інтелектуальне позиціонування (не виходить за екран)
- ✅ Затримка перед показом
- ✅ Приховування при scroll
- ✅ Анімації

---

### 4. **Modal Manager** (`modal-manager.js`)

**Призначення:** Модальні вікна

**Використання:**
```javascript
import { ModalManager } from './modules/modal-manager.js';

const modals = new ModalManager({
    enableAnimations: true,
    closeOnEscape: true,
    closeOnBackdrop: true
});

// Відкрити існуючий modal
modals.open('my-modal-id');

// Створити і відкрити новий modal
modals.create({
    title: 'Підтвердження',
    content: '<p>Ви впевнені?</p>',
    size: 'medium', // small, medium, large
    buttons: [
        {
            text: 'Скасувати',
            className: 'btn btn-secondary',
            action: 'cancel',
            handler: () => console.log('Cancelled')
        },
        {
            text: 'OK',
            className: 'btn btn-primary',
            action: 'ok',
            handler: () => console.log('Confirmed')
        }
    ]
});

// Швидкі методи
modals.confirm(
    'Видалити файл?',
    () => console.log('Deleted'),
    () => console.log('Cancelled')
);

modals.alert(
    'Операція успішна!',
    () => console.log('Closed')
);

// Закрити поточний modal
modals.close();
```

**Функції:**
- ✅ Створення динамічних modals
- ✅ Backdrop з auto-close
- ✅ Escape для закриття
- ✅ Confirm/Alert діалоги
- ✅ Custom кнопки з handlers
- ✅ Розміри: small, medium, large

---

## 📊 Метрики

### До рефакторингу:
- **1 файл:** `atlas-advanced-ui.js` (1115 рядків)
- **God Object** - занадто багато відповідальностей
- **Важко тестувати**

### Після рефакторингу:
- **5 файлів:**
  - `atlas-advanced-ui.js` (~300 рядків) - orchestration
  - `theme-manager.js` (200 рядків)
  - `notification-manager.js` (250 рядків)
  - `tooltip-manager.js` (200 рядків)
  - `modal-manager.js` (250 рядків)
- **Single Responsibility** - кожен модуль має чітку роль
- **Легко тестувати** ✅

**Скорочення:** 1115 → ~300 рядків (**-73%**)

---

## 🔧 Інтеграція

**До:**
```javascript
// atlas-advanced-ui.js - все в одному класі
class AtlasAdvancedUI {
    constructor() {
        // 1115 рядків коду
        this.setupTheme();
        this.setupNotifications();
        this.setupTooltips();
        this.setupModals();
    }
}
```

**Після:**
```javascript
// atlas-advanced-ui.js - чиста оркестрація
import { ThemeManager } from './modules/theme-manager.js';
import { NotificationManager } from './modules/notification-manager.js';
import { TooltipManager } from './modules/tooltip-manager.js';
import { ModalManager } from './modules/modal-manager.js';

class AtlasAdvancedUI {
    constructor(options) {
        this.theme = new ThemeManager(options);
        this.notifications = new NotificationManager(options);
        this.tooltips = new TooltipManager(options);
        this.modals = new ModalManager(options);
        
        this.init();
    }
    
    init() {
        this.theme.apply();
        // Чиста оркестрація
    }
}
```

---

## ✅ Переваги

1. **Модульність** - Кожен компонент незалежний
2. **Повторне використання** - Можна використовувати окремо
3. **Тестування** - Легко писати unit tests
4. **Підтримка** - Менше когнітивного навантаження
5. **Розширення** - Просто додавати функції
6. **DRY** - Немає дублювання коду

---

## 🧪 Тестування

```javascript
// Тест Theme Manager
test('ThemeManager switches theme', () => {
    const manager = new ThemeManager({ theme: 'dark-cyber' });
    manager.switchTheme('light-tech');
    expect(manager.getCurrentTheme()).toBe('light-tech');
});

// Тест Notification Manager
test('NotificationManager shows notification', () => {
    const manager = new NotificationManager();
    const notification = manager.success('Test');
    expect(notification).toBeDefined();
    expect(notification.className).toContain('notification-success');
});

// Тест Modal Manager
test('ModalManager creates modal', () => {
    const manager = new ModalManager();
    const modal = manager.create({ title: 'Test' });
    expect(modal).toBeDefined();
    expect(modal.querySelector('.modal-title').textContent).toBe('Test');
});
```

---

**Створено:** 2025-01-09  
**Автор:** ATLAS Refactoring Team  
**Версія:** 2.0.0  
**Статус:** ✅ ЗАВЕРШЕНО
