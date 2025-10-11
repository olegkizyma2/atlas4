# ATLAS 3D Living System v4.0

## 🧬 Опис системи

**Atlas GLB Living System** - це повноцінна жива система для 3D моделі шолома, яка реагує на всі події інтелектуальної системи Atlas як справжня жива істота.

## ✨ Ключові особливості

### 1. 🫁 Природні анімації
- **Дихання** - плавні коливання моделі, синхронізовані з мовленням
- **Micro-movements** - невеликі випадкові рухи для життєвості
- **Idle анімації** - періодичні рухи при бездіяльності

### 2. 👁️ Відстеження користувача
- Шолом "дивиться" за мишкою користувача
- Реагує на швидкість руху курсора
- Розпізнає позицію на екрані (центр, краї)

### 3. 🎭 Емоційна система
- **Базові емоції**: neutral, joy, curious, focused, alert, excited, thinking
- **Контекстні емоції**: listening, speaking, satisfied, contemplative, peaceful
- **Реакції на агентів**: різні емоції для Atlas, Тетяни, Гриші

### 4. 🎤 Синхронізація з TTS
- Інтенсивне "дихання" під час мовлення
- Різні візуальні ефекти для кожного агента
- Динамічні рухи синхронізовані з голосом

### 5. 🧠 Інтелектуальна поведінка
- Пам'ять емоційних станів
- Адаптивне навчання
- Контекстуальні реакції

## 🎯 Емоції та їх візуалізація

### Atlas (зелений)
```javascript
{
    color: 'rgba(0, 255, 127, 0.8)',
    glow: '#00ff7f',
    personality: 'wise'
}
```

### Тетяна (синій)
```javascript
{
    color: 'rgba(31, 156, 255, 0.8)',
    glow: '#1f9cff',
    personality: 'energetic'
}
```

### Гриша (помаранчевий)
```javascript
{
    color: 'rgba(255, 170, 51, 0.8)',
    glow: '#ffaa33',
    personality: 'focused'
}
```

## 📖 Використання

### Базова ініціалізація

```javascript
const livingSystem = new AtlasGLBLivingSystem('#model-viewer', {
    enableBreathing: true,
    enableEyeTracking: true,
    enableEmotions: true,
    enableTTSSync: true,
    enableIntelligence: true
});
```

### Встановлення емоції

```javascript
// Проста емоція
livingSystem.setEmotion('joy', 0.8, 2000);

// Через головний додаток
window.atlasApp.setAtlasEmotion('excited', 0.9, 1500);
```

### Реакція на події

```javascript
// Пряме викликання
livingSystem.reactToEvent('message-sent');
livingSystem.reactToEvent('keyword-detected', { keyword: 'Атлас' });

// Через головний додаток
window.atlasApp.atlasReactToEvent('agent-thinking', { agent: 'tetyana' });
```

### Мовлення агентів

```javascript
// Початок мовлення
livingSystem.startSpeaking('atlas', 0.8);

// Через головний додаток
window.atlasApp.atlasStartSpeaking('grisha', 0.9);

// Зупинка
window.atlasApp.atlasStopSpeaking();
```

## 🔄 Події системи

Система автоматично реагує на такі події:

| Подія | Емоція | Тривалість | Опис |
|-------|--------|------------|------|
| `message-sent` | listening | 1500ms | Користувач відправив повідомлення |
| `agent-thinking` | thinking | 2000ms | Агент обробляє запит |
| `agent-response` | excited | 1200ms | Агент відповідає |
| `error` | alert | 800ms | Помилка в системі |
| `keyword-detected` | alert → excited | 600ms | Виявлено ключове слово |
| `recording-start` | focused | 99999ms | Початок запису голосу |
| `recording-stop` | processing | 1500ms | Кінець запису |

## ⚙️ Конфігурація

### Параметри анімації

```javascript
{
    breathingSpeed: 4000,        // мс на цикл дихання
    eyeTrackingSpeed: 0.15,      // швидкість відстеження (0-1)
    rotationSmoothness: 0.1,     // плавність повороту (0-1)
    emotionIntensity: 1.0,       // інтенсивність емоцій (0-1)
    ttsGlowIntensity: 1.5,       // інтенсивність підсвічування при TTS
    ttsRotationAmplitude: 3      // амплітуда руху при мовленні
}
```

### Особистість

```javascript
{
    personality: {
        curiosity: 0.9,      // Цікавість
        friendliness: 0.95,  // Дружелюбність
        playfulness: 0.7,    // Ігривість
        focus: 0.85          // Зосередженість
    }
}
```

## 🎨 CSS стани моделі

Система автоматично додає CSS класи для візуальних ефектів:

```css
/* Мовлення */
model-viewer.speaking {
    filter: drop-shadow(0 0 60px rgba(0, 255, 127, 0.8));
    animation: pulse-glow 2s ease-in-out infinite;
}

/* Прослуховування */
model-viewer.listening {
    filter: drop-shadow(0 0 50px rgba(0, 136, 255, 0.6));
}

/* Обдумування */
model-viewer.thinking {
    filter: drop-shadow(0 0 55px rgba(255, 136, 0, 0.7));
    animation: thinking-pulse 1.5s ease-in-out infinite;
}

/* Фокус */
model-viewer.focused {
    filter: drop-shadow(0 0 45px rgba(136, 0, 255, 0.6));
}
```

## 🔧 API методи

### Емоції

```javascript
setEmotion(emotion, intensity, duration)
```
- `emotion` - назва емоції (string)
- `intensity` - інтенсивність 0-1 (number)
- `duration` - тривалість в мс (number)

### Мовлення

```javascript
startSpeaking(agent, intensity)
stopSpeaking()
```

### Реакції

```javascript
reactToEvent(eventType, data)
```

### Знищення

```javascript
destroy()
```

## 🧪 Тестування

### Консольні команди

```javascript
// Встановити емоцію
atlasApp.setAtlasEmotion('joy', 0.9, 2000);

// Початок мовлення Atlas
atlasApp.atlasStartSpeaking('atlas', 0.8);

// Реакція на подію
atlasApp.atlasReactToEvent('keyword-detected');

// Зупинка мовлення
atlasApp.atlasStopSpeaking();
```

### Швидкий тест всіх емоцій

```javascript
const emotions = ['joy', 'curious', 'focused', 'alert', 'excited', 'thinking', 'satisfied'];
let i = 0;
setInterval(() => {
    atlasApp.setAtlasEmotion(emotions[i % emotions.length], 0.8, 2000);
    i++;
}, 2500);
```

## 📊 Моніторинг стану

```javascript
// Доступ до живого стану
const state = atlasApp.managers.glbLivingSystem.livingState;

console.log('Поточна емоція:', state.currentEmotion);
console.log('Рівень уваги:', state.attentionLevel);
console.log('Чи говорить:', state.isSpeaking);
console.log('Поточний агент:', state.currentAgent);
```

## 🚀 Інтеграція

### З Chat Manager

```javascript
chatManager.on('agent-response-start', (data) => {
    atlasApp.atlasStartSpeaking(data.agent, 0.8);
});

chatManager.on('agent-response-complete', () => {
    atlasApp.atlasStopSpeaking();
});
```

### З Voice Control

```javascript
eventManager.on(VoiceEvents.KEYWORD_DETECTED, () => {
    atlasApp.setAtlasEmotion('excited', 0.9, 1200);
});
```

### З TTS Manager

```javascript
ttsManager.on('speaking-start', (agent) => {
    atlasApp.atlasStartSpeaking(agent, 0.8);
});

ttsManager.on('speaking-end', () => {
    atlasApp.atlasStopSpeaking();
});
```

## 💡 Поради

1. **Інтенсивність емоцій**: Використовуйте 0.6-0.9 для природності
2. **Тривалість**: 1000-2000ms для більшості емоцій
3. **Мовлення**: Завжди викликайте `stopSpeaking()` після завершення
4. **Події**: Використовуйте `reactToEvent()` для контекстуальних реакцій

## 🐛 Відлагодження

```javascript
// Увімкнути детальне логування
atlasApp.managers.glbLivingSystem.config.enableIntelligence = true;

// Переглянути емоційну пам'ять
console.log(atlasApp.managers.glbLivingSystem.livingState.emotionalMemory);

// Переглянути історію взаємодій
console.log(atlasApp.managers.glbLivingSystem.livingState.interactionHistory);
```

## 📝 Changelog

### v4.0 (поточна версія)
- ✨ Повністю переписана система для GLB моделі
- 🎭 Покращена емоційна система
- 🎤 Синхронізація з TTS агентів
- 🧠 Інтелектуальна поведінка з навчанням
- 👁️ Природне відстеження користувача

### v3.0
- AtlasLivingBehavior з базовою поведінкою

### v2.0
- Atlas3DModelController з основними анімаціями

---

**Розробник**: ATLAS Team  
**Версія**: 4.0  
**Дата**: 2025  
**Статус**: ✅ Production Ready
