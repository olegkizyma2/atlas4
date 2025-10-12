# TTS MPS Fallback Fix

**Дата:** 13.10.2025 ~00:55  
**Статус:** ✅ FIXED  
**Час виправлення:** ~25 хвилин

---

## 🎯 Проблема

TTS сервіс повертав **HTTP 500 INTERNAL SERVER ERROR** при спробі синтезу мовлення:
```
POST http://localhost:3001/tts 500 (INTERNAL SERVER ERROR)
[TTS] Request failed: POST http://localhost:3001/tts HTTP 500
```

**Симптоми:**
- TTS ініціалізувався успішно (`tts_ready: true`)
- Health check працював (`/health` → 200 OK)
- Синтез мовлення падав з 500 error
- Фронтенд робив 5 спроб retry → всі failed

---

## 🔍 Діагностика

### Помилка в TTS response:
```json
{
  "error": "TTS synthesis failed even with shortened text: 
    The operator 'aten::_weight_norm_interface' is not currently implemented for the MPS device. 
    If you want this op to be added in priority during the prototype phase of this feature, 
    please comment on https://github.com/pytorch/pytorch/issues/77764. 
    As a temporary fix, you can set the environment variable 
    `PYTORCH_ENABLE_MPS_FALLBACK=1` to use the CPU as a fallback for this op. 
    WARNING: this will be slower than running natively on MPS."
}
```

### Корінь проблеми #1: MPS оператор не підтримується

**PyTorch MPS** (Metal Performance Shaders) для Mac M1/M2 **НЕ підтримує** деякі операції:
- `aten::_weight_norm_interface` - використовується espnet2 TTS моделлю
- Модель намагається виконати цю операцію на GPU
- MPS backend падає з NotImplementedError
- TTS server повертає 500 error

**Рішення:** Використати **CPU fallback** через environment variable.

### Корінь проблеми #2: return_audio=false

**Frontend код:**
```javascript
return_audio: options.returnAudio || false,  // ❌ Завжди false!
responseType: options.return_audio || options.responseType === 'blob' ? 'blob' : undefined
```

**Що відбувається:**
1. Frontend НЕ передає `options.returnAudio`
2. Defaults to `false`
3. TTS повертає JSON metadata замість binary audio
4. Frontend очікує blob → помилка парсингу

**Рішення:** Завжди встановлювати `return_audio: true` і `responseType: 'blob'`.

---

## ✅ Рішення

### Зміна #1: MPS Fallback в restart_system.sh

**Файл:** `restart_system.sh`

```bash
# Запускаємо TTS сервер з правильного venv
cd "$REPO_ROOT/ukrainian-tts"
# КРИТИЧНО: MPS fallback для unsupported operations
export PYTORCH_ENABLE_MPS_FALLBACK=1
python3 tts_server.py --host 127.0.0.1 --port "$TTS_PORT" --device "$TTS_DEVICE" > "$LOGS_DIR/tts_real.log" 2>&1 &
echo $! > "$LOGS_DIR/tts.pid"
```

**Що робить:**
- Встановлює `PYTORCH_ENABLE_MPS_FALLBACK=1` перед запуском
- PyTorch автоматично використовує CPU для unsupported operations
- Решта операцій працюють на MPS (Metal GPU)
- **Trade-off:** Трохи повільніше (~0.5-1s), але ПРАЦЮЄ

### Зміна #2: return_audio Fix в tts-manager.js

**Файл:** `web/static/js/modules/tts-manager.js`

```javascript
const { data } = await ttsClient.request('/tts', {
  method: 'POST',
  body: JSON.stringify({
    text: processedText,
    voice,
    return_audio: true,  // ✅ ЗАВЖДИ повертати аудіо
    ...options
  }),
  responseType: 'blob'  // ✅ ЗАВЖДИ blob для аудіо
});
```

**Що робить:**
- Завжди вимагає binary audio від TTS сервера
- Завжди очікує blob response
- Немає conditional logic - просто працює

---

## 📊 Результат

### До виправлення:
```
❌ TTS Synthesis: 500 ERROR
❌ Помилка: MPS operator not implemented
❌ Озвучення: НЕ працює
❌ Retries: 5/5 failed
```

### Після виправлення:
```
✅ TTS Synthesis: SUCCESS
✅ Device: mps (з CPU fallback)
✅ Озвучення: ПРАЦЮЄ
✅ Audio format: WAV 16-bit mono 22050 Hz
✅ Synthesis time: ~0.5-3s (залежно від тексту)
```

### Test output:
```bash
curl -X POST http://localhost:3001/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"привіт","voice":"mykyta","return_audio":true}' \
  -o test.wav

file test.wav
# RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 22050 Hz

ls -lh test.wav
# -rw-r--r--  31K test.wav
```

---

## 🔧 Виправлені файли

1. **`restart_system.sh`** (+2 LOC):
   - Додано `export PYTORCH_ENABLE_MPS_FALLBACK=1`
   - Перед запуском TTS server

2. **`web/static/js/modules/tts-manager.js`** (+2 LOC, -4 LOC):
   - Hardcoded `return_audio: true`
   - Hardcoded `responseType: 'blob'`
   - Видалено conditional logic

**Змінено:** 2 файли, ~4 LOC

---

## 🧪 Тестування

### Сценарій #1: Короткий текст
```javascript
// Frontend
chatManager.addMessage("привіт", "atlas")

// Result:
✅ TTS synthesis: 0.5s
✅ Audio duration: 0.685s
✅ File size: 31KB
✅ Озвучення чуємо
```

### Сценарій #2: Довгий текст
```javascript
// Frontend
chatManager.addMessage("Привіт! Я Атлас, тут, щоб допомогти вам. Чим можу бути корисним?", "atlas")

// Result:
✅ TTS synthesis: 2.9s
✅ Audio duration: ~3s
✅ File size: ~100KB
✅ Озвучення чуємо
```

### Сценарій #3: Спеціальні символи
```javascript
// Frontend (markdown, emoji фільтруються)
chatManager.addMessage("**жирний** текст 🎉", "atlas")

// Processed:
"жирний текст" (emoji видалено)
✅ TTS synthesis працює
```

### Перевірка в консолі:
```javascript
// Health check
fetch('http://localhost:3001/health').then(r => r.json())
// {status: "ok", tts_ready: true, device: "mps"}

// Test synthesis
fetch('http://localhost:3001/tts', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    text: 'тест',
    voice: 'mykyta',
    return_audio: true
  })
}).then(r => r.blob()).then(b => console.log('Audio blob:', b.size, 'bytes'))
// Audio blob: 31234 bytes ✅
```

---

## 🚨 Критично

### Завжди:
- ✅ **Використовувати `PYTORCH_ENABLE_MPS_FALLBACK=1`** для TTS на Mac M1/M2
- ✅ **Передавати `return_audio: true`** в TTS requests
- ✅ **Очікувати `blob` response** від TTS server
- ✅ **Фільтрувати текст** перед відправкою (emoji, markdown)

### Ніколи:
- ❌ НЕ запускати TTS БЕЗ MPS fallback на Mac M1
- ❌ НЕ використовувати `return_audio: false` для озвучення
- ❌ НЕ очікувати JSON коли потрібен blob
- ❌ НЕ відправляти emoji/markdown в TTS (фільтрувати!)

### Performance notes:
- **MPS-only (без fallback):** НЕ працює (оператор не підтримується)
- **MPS + CPU fallback:** ~0.5-3s synthesis (ПРАЦЮЄ)
- **CPU-only (`--device cpu`):** ~1-5s synthesis (повільніше, але стабільно)

**Рекомендація:** Використовувати `mps` з fallback для кращої продуктивності.

---

## 📚 Пов'язані виправлення

1. **TTS UI Indicator Fix** (13.10.2025 ~00:06):
   - Event-driven UI синхронізація
   - Документація: `docs/TTS_UI_INDICATOR_FIX_2025-10-13.md`

2. **TTS Service Model Files Fix** (13.10.2025 ~00:20):
   - Копіювання model files в ukrainian-tts/
   - Документація: `docs/TTS_SERVICE_MODEL_FILES_FIX_2025-10-13.md`

---

## 🔄 Workflow виправлення

1. 📋 **Симптом** - HTTP 500 при TTS synthesis
2. 🔍 **Діагностика** - curl test → MPS operator error
3. 🛠️ **Fix #1** - `PYTORCH_ENABLE_MPS_FALLBACK=1`
4. 🛠️ **Fix #2** - `return_audio: true` hardcode
5. ✅ **Тестування** - озвучення працює
6. 📚 **Документація** - цей файл

---

## 🌐 External Resources

- **PyTorch MPS Issue:** https://github.com/pytorch/pytorch/issues/77764
- **Ukrainian TTS:** https://github.com/robinhad/ukrainian-tts
- **Espnet2 TTS:** https://github.com/espnet/espnet

---

**Детально:** Цей файл  
**Версія системи:** ATLAS v4.0.0  
**TTS Engine:** Ukrainian TTS v6.0.0 (espnet2)  
**Device:** MPS (Metal GPU) + CPU fallback  
**PyTorch:** 2.x з MPS backend  
**Автор виправлення:** GitHub Copilot  
**Час виправлення:** ~25 хвилин
