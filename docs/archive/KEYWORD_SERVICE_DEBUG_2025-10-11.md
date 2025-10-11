# KeywordDetectionService Debug Logging - 11.10.2025 (~02:20)

## 🔍 Додано детальне логування

Щоб з'ясувати чому KeywordDetectionService НЕ ініціалізується, додано логи в:

### 1. service-manager.js
```javascript
// Line ~54
if (this.config.enableKeywordDetection) {
  this.logger.info('🔑 Creating Keyword Detection Service (enableKeywordDetection=true)');
  await this.createKeywordService(serviceConfigs.keyword);
} else {
  this.logger.warn('⚠️ Keyword Detection Service DISABLED (enableKeywordDetection=false)');
}

// createKeywordService()
console.log('[SERVICE-MANAGER] 🔑 Creating KeywordDetectionService with config:', {
  hasEventManager: !!this.eventManager,
  hasLogger: !!this.logger,
  config
});
```

### 2. keyword-detection-service.js
```javascript
constructor(config = {}) {
  console.log('[KEYWORD] 🏗️ Constructor called with config:', {
    hasEventManager: !!config.eventManager,
    hasLogger: !!config.logger,
    keywords: config.detection?.keywords || VOICE_CONFIG.activation.keywords
  });
  // ...
}
```

## 📊 Очікувані логи

### Якщо сервіс створюється:
```
[SERVICE-MANAGER] 🔑 Creating KeywordDetectionService with config: {hasEventManager: true, ...}
[KEYWORD] 🏗️ Constructor called with config: {hasEventManager: true, ...}
[KEYWORD] 🎬 Subscribing to conversation events...
[KEYWORD] ✅ EventManager available: object
```

### Якщо enableKeywordDetection=false:
```
⚠️ Keyword Detection Service DISABLED (enableKeywordDetection=false)
```

### Якщо помилка при ініціалізації:
```
Failed to initialize service keyword
Service keyword initialized successfully  // НЕ з'явиться
```

## 🎯 Мета

Визначити чи:
1. Сервіс взагалі не створюється (enableKeywordDetection=false)
2. Сервіс створюється але падає при ініціалізації
3. Сервіс створюється і ініціалізується але НЕ підписується на події

**Next:** Reload page та перевірити browser console
