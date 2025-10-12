# TTS Service Model Files Fix

**Дата:** 13.10.2025 ~00:20  
**Статус:** ✅ FIXED  
**Час виправлення:** ~20 хвилин

---

## 🎯 Проблема

TTS сервіс не ініціалізувався після restart - показував:
```json
{
  "status": "error",
  "tts_ready": false
}
```

**Симптоми:**
- Логи показували `[CHAT] TTS enabled` але TTS не працював
- UI показував червону кнопку (🔇) - вимкнено
- POST запити до `/tts` повертали `{"error":"TTS not initialized"}`

---

## 🔍 Діагностика

### Помилка в логах:
```python
FileNotFoundError: [Errno 2] No such file or directory: 'feats_stats.npz'
```

### Аналіз структури:
```bash
# TTS server запускається з директорії:
cd ukrainian-tts/
python tts_server.py  # поточна директорія: ukrainian-tts/

# Модель шукає файли в поточній директорії:
feats_stats.npz       # ❌ НЕ знайдено
model.pth             # ❌ НЕ знайдено
spk_xvector.ark       # ❌ НЕ знайдено
config.yaml           # ❌ НЕ знайдено

# Але файли знаходяться в:
../feats_stats.npz    # ✅ (корінь проекту)
../model.pth          # ✅
../spk_xvector.ark    # ✅
../config.yaml        # ✅
```

### Корінь проблеми:

**TTS Server ініціалізація:**
```python
# tts_server.py
self.tts = TTS(cache_folder="../", device=self.device)
```

**cache_folder="../"** вказує на корінь проекту для ЗАВАНТАЖЕННЯ файлів.

**АЛЕ!** Модель espnet2 шукає `feats_stats.npz` в **поточній директорії** (ukrainian-tts/):
```python
# espnet2/layers/global_mvn.py line 40
stats = np.load(stats_file)  # шукає в поточній директорії!
```

**Результат:** Race condition між `cache_folder` і `working directory`.

---

## ✅ Рішення

### Зміна #1: Копіювання файлів в restart_system.sh

**Файл:** `restart_system.sh`

```bash
# КРИТИЧНО: Копіюємо model files в ukrainian-tts/ якщо відсутні
cd "$REPO_ROOT"
for file in feats_stats.npz model.pth spk_xvector.ark config.yaml; do
    if [ -f "$file" ] && [ ! -f "ukrainian-tts/$file" ]; then
        log_info "Copying TTS model file: $file → ukrainian-tts/"
        cp "$file" "ukrainian-tts/"
    fi
done
```

**Що робить:**
- Перевіряє чи файли є в корені проекту
- Копіює їх в `ukrainian-tts/` якщо там відсутні
- Тепер модель знайде файли в поточній директорії

### Зміна #2: Emit event після TTS init

**Файл:** `web/static/js/modules/chat-manager.js`

```javascript
await this.ttsManager.init();
this.setupUI();
this.setupEventListeners();

// Встановлюємо дефолтний стан TTS якщо не встановлено
if (localStorage.getItem('atlas_voice_enabled') === null) {
  localStorage.setItem('atlas_voice_enabled', 'true');
  this.logger.info('TTS default state set to enabled');
}

// ✅ Emit event щоб UI оновився після ініціалізації TTS
this.emit('tts-state-changed', { 
  enabled: this.ttsManager.isEnabled(),
  initialized: true 
});
```

**Що робить:**
- Після успішної ініціалізації TTS викликає event
- UI автоматично оновлює кнопку TTS (🔊/🔇)
- Синхронізація стану між backend і frontend

---

## 📊 Результат

### До виправлення:
```
❌ TTS Service: ERROR
❌ tts_ready: false
❌ UI: 🔇 (червоний)
❌ Озвучення: НЕ працює
```

### Після виправлення:
```
✅ TTS Service: OK
✅ tts_ready: true
✅ UI: 🔊 (зелений)
✅ Device: mps (Metal GPU)
✅ Озвучення: ПРАЦЮЄ
```

### Health check:
```bash
curl http://localhost:3001/health
```
```json
{
  "status": "ok",
  "tts_ready": true,
  "device": "mps"
}
```

---

## 🔧 Виправлені файли

1. **`restart_system.sh`** (+11 LOC):
   - Додано копіювання model files перед запуском TTS
   - Автоматична перевірка наявності файлів
   - Логування копіювання

2. **`web/static/js/modules/chat-manager.js`** (+6 LOC):
   - Emit `tts-state-changed` після ініціалізації
   - UI автоматично синхронізується

**Змінено:** 2 файли, ~17 LOC

---

## 📁 Структура файлів TTS

### Після виправлення:
```
atlas4/
├── feats_stats.npz          # Original (корінь)
├── model.pth                # Original (корінь)
├── spk_xvector.ark          # Original (корінь)
├── config.yaml              # Original (корінь)
└── ukrainian-tts/
    ├── feats_stats.npz      # ✅ Копія для espnet2
    ├── model.pth            # ✅ Копія для espnet2
    ├── spk_xvector.ark      # ✅ Копія для espnet2
    ├── config.yaml          # ✅ Копія для espnet2
    └── tts_server.py        # TTS server
```

**Чому ДВА набори файлів:**
- Корінь проекту - для download/cache (`cache_folder="../"`)
- ukrainian-tts/ - для espnet2 model (working directory)

---

## 🧪 Тестування

### Сценарій #1: Перший запуск (немає файлів)
```bash
./restart_system.sh start
# → Копіює файли в ukrainian-tts/
# → TTS ініціалізується успішно
# → UI показує 🔊
```

### Сценарій #2: Restart (файли вже є)
```bash
./restart_system.sh restart
# → Пропускає копіювання (файли вже є)
# → TTS ініціалізується швидко
# → UI показує 🔊
```

### Сценарій #3: Озвучення
```bash
curl -X POST http://localhost:3001/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"привіт","voice":"mykyta"}'
# → Повертає аудіо файл
# → Озвучення працює ✅
```

### Перевірка в консолі браузера:
```javascript
// Перевірити стан TTS
window.atlasChat.ttsManager.isEnabled()  // true

// Перевірити localStorage
localStorage.getItem('atlas_voice_enabled')  // 'true'

// Перевірити UI
document.getElementById('tts-toggle').querySelector('.btn-text').textContent
// '🔊' (enabled)
```

---

## 🚨 Критично

### Завжди:
- ✅ **Копіювати model files** в ukrainian-tts/ перед запуском
- ✅ **Перевіряти health** після старту: `curl localhost:3001/health`
- ✅ **Emit event** після зміни стану TTS
- ✅ **Логувати** всі етапи ініціалізації

### Ніколи:
- ❌ НЕ видаляти файли з корня проекту (потрібні для cache)
- ❌ НЕ видаляти файли з ukrainian-tts/ (потрібні для espnet2)
- ❌ НЕ запускати TTS БЕЗ копіювання файлів
- ❌ НЕ ігнорувати `tts_ready: false` в health check

---

## 📚 Пов'язані виправлення

1. **TTS UI Indicator Fix** (13.10.2025 ~00:06):
   - Event-driven синхронізація UI
   - Дефолтний стан TTS enabled
   - Документація: `docs/TTS_UI_INDICATOR_FIX_2025-10-13.md`

2. **TTS Virtual Environment Fix** (12.10.2025 ~21:30):
   - Використання web/venv для ukrainian-tts
   - Документація: `docs/TTS_VENV_FIX_2025-10-12.md`

---

## 🔄 Workflow виправлення

1. 📋 **Діагностика** - `curl localhost:3001/health` → error
2. 🔍 **Аналіз логів** - FileNotFoundError: feats_stats.npz
3. 🛠️ **Виправлення** - копіювання файлів + emit event
4. ✅ **Тестування** - health OK, UI оновився, озвучення працює
5. 📚 **Документація** - цей файл

---

**Детально:** Цей файл  
**Версія системи:** ATLAS v4.0.0  
**TTS Engine:** Ukrainian TTS v6.0.0 (espnet2)  
**Device:** MPS (Metal GPU, Mac M1)  
**Автор виправлення:** GitHub Copilot  
**Час виправлення:** ~20 хвилин
