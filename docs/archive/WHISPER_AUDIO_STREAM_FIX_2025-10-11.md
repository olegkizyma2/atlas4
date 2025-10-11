# Whisper Audio Stream Fix - 11.10.2025 ~04:10

## Проблема

Два критичних баги після спроби виправити audio loopback:

### Bug 1: Неправильний вибір мікрофона
```
[WHISPER_KEYWORD] 🎤 Selected microphone: Camo Microphone (Virtual)
```

**Корінь:** Логіка `find()` була НЕПРАВИЛЬНА:
```javascript
// ❌ НЕПРАВИЛЬНО:
const realMic = audioInputs.find(d =>
    d.label.toLowerCase().includes('airpods') ||
    d.label.toLowerCase().includes('macbook') ||
    d.label.toLowerCase().includes('built-in') ||
    d.label.toLowerCase().includes('microphone')  // <-- Знаходить "Camo Microphone"!
)
```

Перша умова `.includes('microphone')` ЗБІГАЄТЬСЯ з "Camo **Microphone** (Virtual)" → вибирає Camo!

### Bug 2: Missing audioStream Assignment
```
Error: No audio stream available
    at WhisperKeywordDetection.recordChunk
```

**Корінь:** `startListening()` записував в `this.stream`, але `recordChunk()` читав з `this.audioStream`:

```javascript
// startListening():
this.stream = await navigator.mediaDevices.getUserMedia(constraints);
// ❌ НЕ присвоєно this.audioStream!

// recordChunk():
if (!this.audioStream) {  // <-- this.audioStream === undefined!
    throw new Error('No audio stream available');
}
```

## Рішення

### Fix 1: Виправлена логіка вибору мікрофона

**Пріоритет 1:** Шукати ТІЛЬКИ AirPods/MacBook/Built-in БЕЗ "virtual":
```javascript
let realMic = audioInputs.find(d => {
    const label = d.label.toLowerCase();
    return (label.includes('airpods') || 
            label.includes('macbook') || 
            label.includes('built-in')) &&
           !label.includes('virtual');
});
```

**Пріоритет 2:** Якщо не знайдено - будь-який НЕ віртуальний:
```javascript
if (!realMic) {
    realMic = audioInputs.find(d => {
        const label = d.label.toLowerCase();
        return !label.includes('camo') &&
               !label.includes('blackhole') &&
               !label.includes('loopback') &&
               !label.includes('virtual');
    });
}
```

### Fix 2: Присвоєння audioStream

```javascript
this.stream = await navigator.mediaDevices.getUserMedia(constraints);
this.audioStream = this.stream; // ✅ FIX: Assign to audioStream for recordChunk()
```

## Результат

**Очікувана консоль після оновлення:**
```
[WHISPER_KEYWORD] 📋 Available audio inputs: [...]
[WHISPER_KEYWORD] 🎤 Selected microphone: Олег's AirPods
[WHISPER_KEYWORD] ✅ Forcing device: Олег's AirPods  
[WHISPER_KEYWORD] ✅ Got audio stream from: Олег's AirPods
```

**БЕЗ помилок** "No audio stream available"

## Критичний урок

❌ **НЕ використовувати загальні ключові слова** ("microphone") при фільтрації пристроїв  
✅ **Використовувати конкретні назви** ("airpods", "macbook") + виключення ("virtual")  
✅ **Перевіряти присвоєння змінних** - якщо метод використовує `this.audioStream`, то `startListening()` МУСИТЬ його присвоїти

## Файли

- `web/static/js/voice-control/services/whisper-keyword-detection.js` - виправлено логіку + присвоєння
