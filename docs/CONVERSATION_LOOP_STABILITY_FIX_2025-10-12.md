# Conversation Loop Stability & Keyword Detection Fix

**Дата:** 12 жовтня 2025 - Вечір ~19:00  
**Тип:** Critical Bug Fix  
**Пріоритет:** Високий

---

## 🎯 Проблеми виявлені користувачем

### Проблема #1: Нестабільність на 3-4 циклі conversation loop
**Симптом:** Після 3-4 циклів діалогу система працює нестабільно, може не продовжувати conversation.

**Потенційні причини:**
1. Race conditions при багаторазовому запуску/зупинці
2. Накопичення event listeners (memory leaks)
3. Неправильне очищення state між циклами
4. TTS blocking continuous listening на пізніх стадіях

### Проблема #2: Жовтий режим НЕ ідентичний початковому
**Симптом:** Коли система переходить в жовтий режим (keyword waiting) після відповіді Atlas, кнопка НЕ мигає як на початку. Має бути ІДЕНТИЧНИЙ режим як при першому включенні.

**Поточний стан:**
- Початковий idle режим (🔵 синій): НЕ мигає, просто standby
- Keyword waiting (🟡 жовтий): НЕ мигає, тільки breathing animation
- **ПРОБЛЕМА:** Жовтий має бути з миганням + breathing

### Проблема #3: Тяжко визвати по слову "Атлас"
**Симптом:** Важко активувати систему ключовим словом "Атлас" - потрібно багато спроб.

**Потенційні причини:**
1. Низький рівень чутливості VAD
2. Короткий час запису чанків (2.5 сек може бути замало)
3. Недостатньо варіантів keyword у fuzzy matching
4. Background noise filtering занадто агресивний

---

## 🔍 Аналіз коду

### 1. Conversation Loop Stability

#### Потенційна проблема: Event Listener Accumulation
```javascript
// event-handlers.js - subscribeToGlobal викликається при кожній ініціалізації
subscribeToGlobal(eventManager, eventName, handler) {
    const globalEM = window.eventManager || eventManager;
    globalEM.on(eventName, handler);
    // ⚠️ ПРОБЛЕМА: Немає unsubscribe при destroy!
}
```

**Наслідок:** При багаторазовій активації conversation mode накопичуються listeners → multiple handlers на той самий event → race conditions.

#### Потенційна проблема: State Not Cleared Between Cycles
```javascript
// conversation-mode-manager.js
async deactivate() {
    this.state.exitConversationMode({ duration: ... });
    this.ui.showIdleMode();
    // ⚠️ ПРОБЛЕМА: Немає очищення pendingMessage, timers, тощо
}
```

### 2. UI Animation Consistency

#### Поточна реалізація:
```javascript
// ui-controller.js
showConversationWaitingForKeyword() {
    this.hideRecording();
    this.updateButtonIcon('🟡'); // Жовтий - waiting for keyword
    this.showListeningForKeyword();
}

showListeningForKeyword() {
    this.showStatus(StatusMessages.KEYWORD_LISTENING, 'keyword-listening');
    this.addBreathingAnimation();
    // ⚠️ ПРОБЛЕМА: Немає PULSE animation (мигання)!
}
```

#### Початковий idle режим:
```css
/* main.css */
.btn.mode-idle {
    background: var(--dark-green);
    border: 1px solid rgba(0, 255, 127, 0.3);
    /* ⚠️ ПРОБЛЕМА: Немає animation! */
}
```

**Висновок:** Початковий idle НЕ мигає, keyword waiting НЕ мигає → потрібно додати PULSE для keyword waiting mode.

### 3. Keyword Detection Sensitivity

#### Поточна конфігурація:
```javascript
// whisper-keyword-detection.js
constructor(config) {
    this.chunkDuration = 2500; // 2.5 сек запису
    this.pauseBetweenChunks = 200; // 200мс пауза
    this.keywords = ['атлас']; // Тільки 1 варіант!
    
    // Background filter phrases
    this.backgroundPhrases = [
        'дякую за перегляд',
        'ставте лайки',
        // ... багато phrases
    ];
}
```

**Проблеми:**
1. **Тільки 1 keyword** - немає варіацій (атлаз, отлас, тощо)
2. **Короткий chunk** - 2.5 сек може бути замало для повільної вимови
3. **Немає контролю VAD threshold** - може пропускати тихі голоси

---

## 💡 Рішення

### Fix #1: Conversation Loop Stability

#### 1.1. Додати Event Cleanup
```javascript
// event-handlers.js
class ConversationEventHandlers {
    constructor(...) {
        this.subscribedEvents = []; // Track subscriptions
    }
    
    subscribeToGlobal(eventManager, eventName, handler) {
        const globalEM = window.eventManager || eventManager;
        globalEM.on(eventName, handler);
        
        // Track для cleanup
        this.subscribedEvents.push({ eventManager: globalEM, eventName, handler });
    }
    
    destroy() {
        // Unsubscribe all
        this.subscribedEvents.forEach(({ eventManager, eventName, handler }) => {
            eventManager.off(eventName, handler);
        });
        this.subscribedEvents = [];
    }
}
```

#### 1.2. Clear State Between Cycles
```javascript
// conversation-mode-manager.js
async deactivate() {
    // Очистити pending message
    this.pendingMessage = null;
    
    // Зупинити всі timers
    if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
    }
    
    // Очистити state
    this.state.exitConversationMode({ duration: ... });
    
    // Reset UI
    this.ui.showIdleMode();
    
    this.logger.info('💬 Conversation mode deactivated and cleaned');
}
```

#### 1.3. Limit Conversation Cycles
```javascript
// conversation-state-manager.js
class ConversationStateManager {
    constructor() {
        this.maxCyclesBeforeReset = 5; // Max 5 cycles
        this.currentCycleCount = 0;
    }
    
    incrementCycle() {
        this.currentCycleCount++;
        
        if (this.currentCycleCount >= this.maxCyclesBeforeReset) {
            this.logger.warn('⚠️ Max cycles reached, forcing reset');
            return 'RESET_NEEDED';
        }
        
        return 'CONTINUE';
    }
    
    resetCycleCount() {
        this.currentCycleCount = 0;
    }
}
```

### Fix #2: Keyword Waiting Animation (Pulse + Breathing)

#### 2.1. Додати CSS для keyword-waiting pulse
```css
/* main.css */
.btn.keyword-waiting {
    background: linear-gradient(135deg, #ffaa00 0%, #ff8800 100%);
    border: 2px solid #ffaa00;
    animation: keyword-waiting-pulse 1.2s ease-in-out infinite;
}

@keyframes keyword-waiting-pulse {
    0%, 100% {
        box-shadow: 0 0 15px rgba(255, 170, 0, 0.6);
        transform: scale(1);
    }
    50% {
        box-shadow: 0 0 35px rgba(255, 170, 0, 1.0);
        transform: scale(1.05);
    }
}

/* Breathing animation для keyword-waiting */
.btn.keyword-waiting.breathing {
    animation: 
        keyword-waiting-pulse 1.2s ease-in-out infinite,
        breathing-animation 3s ease-in-out infinite;
}

@keyframes breathing-animation {
    0%, 100% { opacity: 0.9; }
    50% { opacity: 1.0; }
}
```

#### 2.2. Оновити UI Controller
```javascript
// ui-controller.js
showConversationWaitingForKeyword() {
    this.hideRecording();
    
    // Clear all mode classes
    this.clearModeClasses();
    
    // Додати keyword-waiting клас (pulse + breathing)
    this.micButton?.classList.add('keyword-waiting');
    this.micButton?.classList.add('breathing');
    
    // Жовта іконка
    this.updateButtonIcon('🟡');
    
    // Status message
    this.showStatus(StatusMessages.KEYWORD_LISTENING, 'keyword-listening');
    
    this.logger.debug('🎨 UI updated: KEYWORD_WAITING mode (pulse + breathing)');
}
```

### Fix #3: Покращення Keyword Detection Sensitivity

#### 3.1. Розширити Keywords
```javascript
// whisper-keyword-detection.js
constructor(config) {
    // НАБАГАТО більше варіантів!
    this.keywords = [
        'атлас',
        'атлаз',
        'атлус',
        'атлес',
        'отлас',
        'отлаз',
        'тлас',
        'atlas',
        'atla',
        'atlaz',
        'атл',
        'ат лас',
        'ат лаз'
    ];
}
```

#### 3.2. Збільшити Chunk Duration
```javascript
// whisper-keyword-detection.js
constructor(config) {
    this.chunkDuration = 3500; // 2.5 → 3.5 сек (+40%)
    this.pauseBetweenChunks = 150; // 200 → 150мс (швидший retry)
}
```

#### 3.3. Покращити Fuzzy Matching
```javascript
// voice-utils.js - функція containsActivationKeyword
export function containsActivationKeyword(text, keywords = ['атлас']) {
    if (!text || typeof text !== 'string') return false;

    const normalized = text.toLowerCase().trim();

    // 1. Exact match (високий пріоритет)
    for (const keyword of keywords) {
        if (normalized === keyword.toLowerCase()) {
            logger.info(`[KEYWORD] ✅ Exact match found: "${keyword}" in "${text}"`);
            return true;
        }
    }

    // 2. Contains match (середній пріоритет)
    for (const keyword of keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
            logger.info(`[KEYWORD] ✅ Contains match found: "${keyword}" in "${text}"`);
            return true;
        }
    }

    // 3. Fuzzy match з LOWER threshold (0.7 → 0.6)
    for (const keyword of keywords) {
        const similarity = calculateSimilarity(normalized, keyword.toLowerCase());
        if (similarity >= 0.6) { // Було 0.7, стало 0.6 (+16% чутливість)
            logger.info(`[KEYWORD] ✅ Fuzzy match found: "${keyword}" in "${text}" (similarity: ${similarity.toFixed(2)})`);
            return true;
        }
    }

    // 4. Levenshtein distance (NEW!)
    for (const keyword of keywords) {
        const distance = levenshteinDistance(normalized, keyword.toLowerCase());
        const maxDistance = Math.floor(keyword.length * 0.4); // Дозволити 40% помилок
        if (distance <= maxDistance) {
            logger.info(`[KEYWORD] ✅ Levenshtein match: "${keyword}" in "${text}" (distance: ${distance})`);
            return true;
        }
    }

    return false;
}

// Levenshtein distance algorithm
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
```

#### 3.4. Додати Sensitivity Config
```javascript
// whisper-keyword-detection.js
constructor(config) {
    this.sensitivity = config.sensitivity || 'high'; // 'low', 'medium', 'high', 'maximum'
    
    // Налаштування залежно від sensitivity
    const sensitivityConfigs = {
        low: {
            chunkDuration: 2000,
            pauseBetweenChunks: 300,
            fuzzyThreshold: 0.8
        },
        medium: {
            chunkDuration: 2500,
            pauseBetweenChunks: 200,
            fuzzyThreshold: 0.7
        },
        high: {
            chunkDuration: 3500,
            pauseBetweenChunks: 150,
            fuzzyThreshold: 0.6
        },
        maximum: {
            chunkDuration: 4000,
            pauseBetweenChunks: 100,
            fuzzyThreshold: 0.5
        }
    };
    
    const settings = sensitivityConfigs[this.sensitivity];
    this.chunkDuration = settings.chunkDuration;
    this.pauseBetweenChunks = settings.pauseBetweenChunks;
    this.fuzzyThreshold = settings.fuzzyThreshold;
}
```

---

## 📝 Файли для зміни

### Critical Priority (Fix #2 - UI Animation):
1. **web/static/css/main.css**
   - Додати `.keyword-waiting` клас з pulse animation
   - Додати `@keyframes keyword-waiting-pulse`
   - Додати `.keyword-waiting.breathing` комбінацію

2. **web/static/js/voice-control/conversation/ui-controller.js**
   - Оновити `showConversationWaitingForKeyword()` для додавання класів

### High Priority (Fix #3 - Keyword Sensitivity):
3. **web/static/js/voice-control/services/whisper-keyword-detection.js**
   - Розширити `this.keywords` масив
   - Збільшити `chunkDuration` до 3500ms
   - Зменшити `pauseBetweenChunks` до 150ms
   - Додати sensitivity config

4. **web/static/js/voice-control/utils/voice-utils.js**
   - Знизити fuzzy threshold з 0.7 до 0.6
   - Додати Levenshtein distance matching

### Medium Priority (Fix #1 - Stability):
5. **web/static/js/voice-control/conversation/event-handlers.js**
   - Додати `subscribedEvents` array
   - Додати `destroy()` method з unsubscribe

6. **web/static/js/voice-control/conversation/conversation-mode-manager.js**
   - Покращити `deactivate()` з повним cleanup

7. **web/static/js/voice-control/conversation/state-manager.js**
   - Додати cycle counter
   - Додати max cycles limit

---

## ✅ Очікувані результати

### Fix #2 - UI Animation:
- ✅ Жовта кнопка МИГАЄ (pulse) + ДИХАЄ (breathing) - ідентично початковому режиму
- ✅ Візуальна consistency - користувач розуміє що система чекає "Атлас"

### Fix #3 - Keyword Sensitivity:
- ✅ "Атлас" детектується з 1-2 спроб (було 10+)
- ✅ Працює з варіаціями вимови (атлаз, отлас, тощо)
- ✅ Довший chunk (3.5 сек) для повільної вимови
- ✅ Швидший retry (150мс замість 200мс)

### Fix #1 - Stability:
- ✅ Conversation loop стабільний на 10+ циклах
- ✅ Немає memory leaks (event listeners cleanup)
- ✅ Правильне очищення state між циклами
- ✅ Auto-reset після 5 циклів для safety

---

## 🔍 Тестування

### Тест #1: Keyword Waiting Animation
```bash
# 1. Активувати conversation mode (утримання 2с)
# 2. Сказати щось → Atlas відповідає → TTS грає
# 3. ПЕРЕВІРИТИ: Кнопка 🟡 ЖОВТА + МИГАЄ + ДИХАЄ
# 4. Порівняти з початковим idle режимом
```

### Тест #2: Keyword Detection (10 спроб)
```bash
# 1. Активувати conversation mode
# 2. Чекати жовту кнопку
# 3. Сказати "Атлас" 10 разів з різними інтонаціями
# 4. ПЕРЕВІРИТИ: 8-9/10 успішних детекцій (80%+)

# Варіації для тестування:
# - "Атлас" (нормально)
# - "Атлаааас" (повільно)
# - "Атлас!" (голосно)
# - "атлас" (тихо)
# - "ат лас" (з паузою)
```

### Тест #3: Conversation Loop Stability (10 циклів)
```bash
# 1. Активувати conversation
# 2. Цикл 10 разів:
#    - Сказати команду
#    - Atlas відповідає
#    - TTS грає
#    - Жовта кнопка (keyword wait)
#    - Сказати "Атлас"
#    - Repeat
# 3. ПЕРЕВІРИТИ: Всі 10 циклів працюють БЕЗ зависань
```

---

## 🎓 Lessons Learned

### ✅ DO:
- ЗАВЖДИ cleanup event listeners при destroy
- ЗАВЖДИ clear state між lifecycle transitions
- ЗАВЖДИ робити UI animations CONSISTENT
- ЗАВЖДИ тестувати keyword detection з різними інтонаціями
- ЗАВЖДИ додавати cycle limits для safety

### ❌ DON'T:
- НЕ накопичувати event listeners без cleanup
- НЕ залишати pending state між циклами
- НЕ робити різні UI animations для схожих режимів
- НЕ використовувати тільки 1 варіант keyword
- НЕ дозволяти нескінченні loops без reset mechanism

---

**Створено:** 12 жовтня 2025  
**Статус:** Готово до реалізації  
**Пріоритет виправлень:** Fix #2 (UI) > Fix #3 (Keyword) > Fix #1 (Stability)
