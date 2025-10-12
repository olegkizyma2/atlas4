# Whisper Core ML Crash Fix - FINAL VERSION

**Дата:** 13 жовтня 2025, ніч ~02:06  
**Версія:** v4 (остаточне виправлення)  
**Статус:** ✅ FIXED

---

## 🎯 Проблема

**Симптом:**
- Quick-send режим НЕ працював - Whisper крашився з HTTP 500 при **кожній** транскрипції
- `POST /transcribe` → 500 INTERNAL SERVER ERROR × 4 retries
- Frontend: "Whisper API error: HTTP 500: INTERNAL SERVER ERROR"

**Логи:**
```
whisper_init_state: loading Core ML model from '.../ggml-large-v3-encoder.mlmodelc'
whisper_init_state: first run on a device may take a while ...
whisper_init_state: failed to load Core ML model from '.../ggml-large-v3-encoder.mlmodelc'
ggml_metal_free: deallocating
error: failed to initialize whisper context
```

---

## 🔍 Корінь проблеми (v1-v4 evolution)

### v1: Invalid Parameters (13.10.2025 ~01:10)
**Проблема:** `--no-coreml` параметр НЕ існує в whisper-cli  
**Симптом:** whisper-cli показував help message → JSON парсинг failing  

### v2: Environment Variables Mismatch (13.10.2025 ~01:50)
**Проблема:** Shell script (`restart_system.sh`) експортував **невалідні** параметри:
- `WHISPER_CPP_PATIENCE` ❌
- `WHISPER_CPP_LENGTH_PENALTY` ❌
- `WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD` ❌
- `WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT` ❌

**Результат:** Python код читав ці змінні з environment → передавав в whisper-cli → crash

### v3: Cleanup Python Code (13.10.2025 ~02:00)
**Проблема:** Невалідні параметри залишались в Python коді (читались з env)  
**Рішення:** Видалено з `whispercpp_service.py` (залишені тільки валідні)

### v4: Core ML Crash (13.10.2025 ~02:06) ⭐ FINAL
**Проблема:** whisper-cli за замовчуванням намагається завантажити **Core ML** модель  
**Симптом:** `failed to load Core ML model` → `error: failed to initialize whisper context`  
**Корінь:** Core ML модель (`ggml-large-v3-encoder.mlmodelc`) пошкоджена/відсутня  

---

## ✅ Рішення (v4 - остаточне)

### 1. Додано `--no-gpu` прапорець для whisper-cli

**Файл:** `services/whisper/whispercpp_service.py`

```python
# FIXED 13.10.2025 v4 - Вимикаємо Core ML для whisper-cli (використовуємо Metal замість)
# Core ML модель може бути пошкоджена → крашиться при завантаженні
# Metal стабільніший і швидший на Apple Silicon
if is_whisper_cli:
    cmd.append('--no-gpu')  # Вимкнути Core ML, використати Metal
```

**Логіка:**
- whisper-cli за замовчуванням: Core ML (Apple framework для ML)
- `--no-gpu`: вимикає Core ML → використовує **Metal** (Apple GPU framework)
- Metal працює НАБАГАТО стабільніше та швидше на M1/M2

### 2. Видалено невалідні параметри з shell script

**Файл:** `restart_system.sh` (рядки 516-527)

**Було:**
```bash
export WHISPER_CPP_PATIENCE=${WHISPER_CPP_PATIENCE:-1.0}
export WHISPER_CPP_LENGTH_PENALTY=${WHISPER_CPP_LENGTH_PENALTY:-1.0}
export WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD=${WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD:-2.4}
export WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT=${WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT:-true}
```

**Стало:**
```bash
# FIXED 13.10.2025 v3 - Тільки параметри що підтримує whisper-cli
# whisper-cli підтримує: -tp (temperature), -bo (best_of), -bs (beam_size), -nth (no_speech_threshold), --prompt
# НЕ підтримує: patience, length_penalty, compression_ratio_threshold, condition_on_previous_text
export WHISPER_CPP_TEMPERATURE=${WHISPER_CPP_TEMPERATURE:-0.0}
export WHISPER_CPP_BEST_OF=${WHISPER_CPP_BEST_OF:-5}
export WHISPER_CPP_BEAM_SIZE=${WHISPER_CPP_BEAM_SIZE:-5}
export WHISPER_CPP_NO_SPEECH_THRESHOLD=${WHISPER_CPP_NO_SPEECH_THRESHOLD:-0.6}
export WHISPER_CPP_INITIAL_PROMPT="${WHISPER_CPP_INITIAL_PROMPT:-Це українська мова з правильною орфографією, граматикою та пунктуацією. Олег Миколайович розмовляє з Атласом.}"
```

### 3. Видалено невалідні параметри з Python коду

**Файл:** `services/whisper/whispercpp_service.py` (рядки 43-53)

**Було:**
```python
WHISPER_CPP_PATIENCE = float(os.environ.get('WHISPER_CPP_PATIENCE', '1.0'))
WHISPER_CPP_LENGTH_PENALTY = float(os.environ.get('WHISPER_CPP_LENGTH_PENALTY', '1.0'))
WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD = float(os.environ.get('WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD', '2.4'))
WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT = os.environ.get('WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT', 'true').lower() == 'true'
```

**Стало:**
```python
# Покращені параметри для Large-v3 моделі (ТІЛЬКИ що підтримує whisper-cli)
# whisper-cli підтримує: -tp (temperature), -bo (best_of), -bs (beam_size), -nth (no_speech_threshold), --prompt
# НЕ підтримує: patience, length_penalty, compression_ratio_threshold, condition_on_previous_text
WHISPER_CPP_TEMPERATURE = float(os.environ.get('WHISPER_CPP_TEMPERATURE', '0.0'))
WHISPER_CPP_BEST_OF = int(os.environ.get('WHISPER_CPP_BEST_OF', '5'))
WHISPER_CPP_BEAM_SIZE = int(os.environ.get('WHISPER_CPP_BEAM_SIZE', '5'))
WHISPER_CPP_NO_SPEECH_THRESHOLD = float(os.environ.get('WHISPER_CPP_NO_SPEECH_THRESHOLD', '0.6'))
WHISPER_CPP_INITIAL_PROMPT = os.environ.get('WHISPER_CPP_INITIAL_PROMPT', '...')
```

---

## 📊 Результат

✅ **Quick-send працює БЕЗ помилок**  
✅ **Whisper-cli виконує транскрипцію успішно**  
✅ **Metal GPU працює автоматично (--no-gpu вимикає Core ML)**  
✅ **Текст з'являється в чаті після розпізнавання**  
✅ **Немає HTTP 500 помилок**

**Health endpoint:**
```json
{
  "backend": "whisper.cpp",
  "binary": ".../whisper-cli",
  "binary_type": "whisper-cli (GPU default)",
  "device": "metal",
  "model_path": ".../ggml-large-v3.bin",
  "ngl": "N/A (GPU enabled by default)",
  "status": "ok",
  "threads": 6
}
```

**Логи:** БЕЗ помилок Core ML, успішна ініціалізація Metal

---

## 🎯 Критичні правила

### whisper-cli параметри (підтримує):
✅ `-tp` (temperature) - точність розпізнавання  
✅ `-bo` (best_of) - кількість кандидатів  
✅ `-bs` (beam_size) - розмір пучка для beam search  
✅ `-nth` (no_speech_threshold) - поріг тиші  
✅ `--prompt` - initial prompt для контексту  
✅ `--no-gpu` - вимкнути Core ML, використати Metal  

### whisper-cli параметри (НЕ підтримує):
❌ `--patience` - тільки для Python Whisper  
❌ `--length-penalty` - тільки для Python Whisper  
❌ `--compression-ratio-threshold` - тільки для Python Whisper  
❌ `--no-condition-on-previous-text` - тільки для Python Whisper  
❌ `--no-coreml` - параметр НЕ існує (використовуйте `--no-gpu`)  
❌ `-ngl` - тільки для старого 'main' binary  

### Metal vs Core ML на Apple Silicon:
- **Core ML:** Apple framework для ML, потребує спеціальної моделі (`.mlmodelc`)
- **Metal:** Apple GPU framework, працює з стандартними GGML моделями
- **whisper-cli:** Core ML за замовчуванням → додайте `--no-gpu` для Metal
- **Старий 'main':** Metal через `-ngl > 0` прапорець

### Правильна команда whisper-cli:
```bash
whisper-cli \
  -m model.bin \
  -l uk \
  -t 6 \
  -oj \
  -of output \
  --no-gpu \         # Вимкнути Core ML
  -tp 0.0 \          # Temperature
  -bo 5 \            # Best of
  -bs 5 \            # Beam size
  -nth 0.6 \         # No speech threshold
  --prompt "..." \   # Initial prompt
  audio.wav          # Файл БЕЗ -f прапорця
```

---

## 🔄 Evolution of Fixes

1. **v1 (13.10.2025 ~01:10):** Спроба `--no-coreml` → параметр не існує → FAILED
2. **v2 (13.10.2025 ~01:50):** Видалено невалідні параметри з команди → помилка залишалась (env vars)
3. **v3 (13.10.2025 ~02:00):** Очищено shell script та Python код → виявлено Core ML crash
4. **v4 (13.10.2025 ~02:06):** Додано `--no-gpu` → Metal працює → ✅ **SUCCESS**

---

## 📚 Пов'язані документи

- `docs/WHISPER_CLI_PARAMS_FIX_2025-10-13.md` (v2) - невалідні параметри
- `docs/WHISPER_COREML_FIX_2025-10-13.md` (v1) - перша спроба (deprecated)
- `docs/WHISPER_QUALITY_IMPROVEMENTS_2025-10-12.md` - налаштування якості

---

## 🏷️ Tags
`#whisper` `#metal` `#coreml` `#mac-m1` `#quick-send` `#transcription` `#fix` `#audio` `#apple-silicon`

---

**КРИТИЧНО:**  
- ЗАВЖДИ використовуйте `--no-gpu` для whisper-cli на Apple Silicon
- Metal працює НАБАГАТО стабільніше за Core ML
- Core ML потребує окремої моделі (`.mlmodelc`), яку НЕ завжди є
- whisper-cli підтримує НАБАГАТО менше параметрів ніж Python Whisper
- Файл audio.wav передається В КІНЦІ команди БЕЗ `-f` прапорця

---

**Автор:** GitHub Copilot + Олег Кізима  
**Тестування:** Mac Studio M1 MAX, macOS 15.0, whisper-cli v1.5.5+
