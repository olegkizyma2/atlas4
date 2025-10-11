# План рефакторингу Conversation Mode - 11.10.2025

## 🎯 Мета
Виправити другий режим (Conversation Mode) щоб він реагував на слово "Атлас"
та підтримував циклічну розмову з користувачем.

## 📋 Завдання

### Phase 1: Діагностика та логування ✅
**Мета:** Зрозуміти де саме ламається Event Flow

**Файли для модифікації:**
1. `web/static/js/voice-control/conversation-mode-manager.js`
2. `web/static/js/voice-control/services/keyword-detection-service.js`

**Зміни:**
- Додати детальне логування в `activateConversationMode()`
- Додати логи в `startListeningForKeyword()`
- Додати логи в `subscribeToConversationEvents()`
- Додати логи в `startDetection()`
- Логувати стан eventManager

### Phase 2: Виправлення Event Flow 🔧
**Мета:** Забезпечити надійну передачу подій

**Файли для модифікації:**
1. `web/static/js/voice-control/services/keyword-detection-service.js`
   - Перевірка eventManager на undefined
   - Throw error якщо не доступний
   
2. `web/static/js/voice-control/conversation-mode-manager.js`
   - Валідація результату emit
   - Retry механізм

### Phase 3: Hardcoded Responses 🗣️
**Мета:** Додати випадкові відповіді при детекції "Атлас"

**Нові можливості:**
- Масив відповідей: ["Слухаю", "Слухаю тебе", "Так", "Готовий", ...]
- Метод `getRandomActivationResponse()`
- Інтеграція з TTS для озвучування
- Ротація відповідей

### Phase 4: Циклічна розмова 🔄
**Мета:** Підтримка безперервного діалогу

**Логіка:**
1. Atlas відповідає → автоматичний запис
2. Детекція тиші користувача
3. Якщо тиша > 3-5 сек → повернення до keyword listening
4. Якщо продовжує говорити → нова ітерація

### Phase 5: Task Mode Integration 🛠️
**Мета:** Коректний перехід з chat в task mode

**Логіка:**
1. Conversation mode завжди chat (stage 0)
2. Якщо mode selection визначає task → перехід
3. В task mode - інші stop commands
4. Після task → повернення в conversation або exit

## 🔨 Деталі реалізації

### 1. Додавання логування

#### conversation-mode-manager.js
```javascript
async activateConversationMode() {
    console.log('[CONVERSATION] 🎬 Activating conversation mode...');
    this.logger.info('💬 Conversation mode activated');
    
    // ... existing code ...
    
    console.log('[CONVERSATION] ✅ Conversation mode activated successfully');
}

startListeningForKeyword() {
    console.log('[CONVERSATION] 🔍 Starting keyword listening...');
    this.logger.debug('Started listening for activation keyword');
    
    // ... existing code ...
    
    console.log('[CONVERSATION] 📡 Emitting START_KEYWORD_DETECTION event');
    const emitted = eventManager.emit(Events.START_KEYWORD_DETECTION, {
      keywords: [this.config.keywordForActivation],
      mode: 'conversation'
    });
    console.log(`[CONVERSATION] ${emitted ? '✅' : '❌'} Event emitted`);
}
```

#### keyword-detection-service.js
```javascript
subscribeToConversationEvents() {
    console.log('[KEYWORD] 🎬 Subscribing to conversation events...');
    
    if (!this.eventManager) {
      console.error('[KEYWORD] ❌ EventManager is undefined!');
      this.logger.error('EventManager not available in KeywordDetectionService');
      return;
    }
    
    console.log('[KEYWORD] ✅ EventManager available');
    
    this.eventManager.on('START_KEYWORD_DETECTION', async (event) => {
      console.log('[KEYWORD] 📨 Received START_KEYWORD_DETECTION', event.payload);
      // ... rest of handler ...
    });
    
    console.log('[KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION');
}

async startDetection() {
    console.log('[KEYWORD] 🎤 Starting detection...');
    
    if (!this.recognition) {
      console.error('[KEYWORD] ❌ Recognition not initialized!');
      return false;
    }
    
    try {
      console.log('[KEYWORD] 📞 Calling recognition.start()...');
      this.recognition.start();
      console.log('[KEYWORD] ✅ Recognition started successfully');
      return true;
    } catch (error) {
      console.error('[KEYWORD] ❌ Failed to start recognition:', error);
      return false;
    }
}
```

### 2. Hardcoded Responses

#### Додати в keyword-detection-service.js
```javascript
/**
 * Отримання випадкової відповіді на активацію
 * @returns {string} - Випадкова відповідь
 */
getRandomActivationResponse() {
  const responses = [
    'Слухаю',
    'Слухаю тебе',
    'Так',
    'Готовий',
    'Я тут',
    'Чим можу допомогти?',
    'Уважно слухаю',
    'Так, я слухаю'
  ];
  
  // Ротація для різноманітності
  const index = Math.floor(Math.random() * responses.length);
  return responses[index];
}

/**
 * Обробка виявлення ключового слова
 */
async handleKeywordDetection(transcript, confidence) {
    this.logger.info(`🎯 Keyword detected: "${transcript}"`);
    
    // Генерація випадкової відповіді
    const response = this.getRandomActivationResponse();
    
    // Емісія події з відповіддю
    await this.emit(Events.KEYWORD_DETECTED, {
      transcript,
      confidence,
      response,
      timestamp: new Date(),
      keywords: this.detectionConfig.keywords
    });
    
    // Відправка в TTS для озвучування
    if (this.eventManager) {
      this.eventManager.emit('PLAY_ACTIVATION_RESPONSE', {
        text: response,
        voice: 'mykyta',
        priority: 'high'
      });
    }
    
    this.logger.info(`🗣️ Playing response: "${response}"`);
}
```

### 3. Обробка TTS Response

#### Додати в conversation-mode-manager.js
```javascript
subscribeToSystemEvents() {
    // ... existing subscriptions ...
    
    // Відповідь на активацію
    eventManager.on('PLAY_ACTIVATION_RESPONSE', (event) => {
      this.handleActivationResponse(event.payload);
    });
}

handleActivationResponse(payload) {
    const { text, voice } = payload;
    this.logger.info(`🗣️ Playing activation response: "${text}"`);
    
    // Відправка в TTS
    eventManager.emit('TTS_SPEAK', {
      text,
      voice: voice || 'mykyta',
      mode: 'activation',
      callback: () => {
        // Після відповіді - запуск запису
        this.startConversationRecording();
      }
    });
}
```

### 4. Циклічна розмова

#### Модифікувати handleTTSCompleted
```javascript
handleTTSCompleted(event) {
    if (!this.isInConversation) return;
    
    this.logger.info('🔊 Atlas finished speaking');
    this.micButton.classList.remove('atlas-speaking');
    
    // Автоматичний запис після відповіді
    this.showConversationStatus('Ваша черга...');
    
    setTimeout(() => {
      if (this.isInConversation) {
        this.startConversationRecording();
        
        // Таймер тиші - 5 секунд
        this.silenceTimer = setTimeout(() => {
          this.onUserSilence();
        }, 5000);
      }
    }, 500);
}

onUserSilence() {
    this.logger.info('🤫 User silence detected - returning to keyword listening');
    this.showConversationStatus('Скажіть "Атлас" щоб продовжити...');
    this.startListeningForKeyword();
}
```

## ✅ Критерії успіху

### Після Phase 1:
- [ ] Логи показують активацію conversation mode
- [ ] Видно емісію START_KEYWORD_DETECTION
- [ ] Видно отримання події в KeywordDetectionService

### Після Phase 2:
- [ ] START_KEYWORD_DETECTION надійно доставляється
- [ ] Web Speech API успішно запускається
- [ ] Логи показують detection started

### Після Phase 3:
- [ ] При слові "Атлас" → випадкова відповідь через TTS
- [ ] Різні відповіді чергуються
- [ ] Після відповіді → запис користувача

### Після Phase 4:
- [ ] Циклічна розмова: користувач → Atlas → користувач
- [ ] При тиші → повернення до keyword listening
- [ ] Можливість вийти кліком на кнопку

### Після Phase 5:
- [ ] Conversation mode завжди chat
- [ ] Коректний перехід в task якщо потрібно
- [ ] Task mode має свої stop commands

## 🚀 Порядок виконання

1. **Крок 1:** Додати логування в обидва файли
2. **Крок 2:** Запустити систему, спробувати conversation mode
3. **Крок 3:** Аналіз логів у browser console
4. **Крок 4:** Виправлення виявленої проблеми
5. **Крок 5:** Додати hardcoded responses
6. **Крок 6:** Тестування відповідей
7. **Крок 7:** Реалізація циклічної розмови
8. **Крок 8:** Повне тестування

## 📝 Примітки

- Всі console.log мають префікс [CONVERSATION] або [KEYWORD]
- Використовувати emoji для легкого пошуку: 🎬 🔍 ✅ ❌ 📡 📨 🎤 🗣️
- Після успішного тестування - видалити debug console.log
- Зберегти важливі логи через this.logger
