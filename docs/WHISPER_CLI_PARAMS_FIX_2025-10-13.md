# Whisper CLI Invalid Parameters Fix

**DATE:** 13 жовтня 2025 - Ніч ~01:50  
**VERSION:** 4.0.0  
**PRIORITY:** 🔴 CRITICAL  
**STATUS:** ✅ FIXED

---

## 🚨 Проблема

### Симптом
Quick-send режим НЕ працював - Whisper service крашився з HTTP 500 при кожній транскрипції:
```
POST /transcribe 500 INTERNAL SERVER ERROR
whisper.cpp did not produce JSON output: Expecting value: line 1 column 1 (char 0)
```

### Логи
```bash
# Whisper виводив help message замість JSON:
stderr=-vspd N,   --vad-min-speech-duration-ms  N [250    ] VAD min speech duration
      -vsd N,    --vad-min-silence-duration-ms N [100    ] VAD min silence duration
      ...
      
# Команда яка запускалась:
whisper-cli -m model.bin -l uk -t 6 -oj -of /tmp/out \
  --best-of 5 --beam-size 5 \
  --patience 1.0 \                    ❌ НЕ підтримується
  --length-penalty 1.0 \              ❌ НЕ підтримується  
  --compression-ratio-threshold 2.4 \ ❌ НЕ підтримується
  --no-speech-threshold 0.6 \         ❌ Невірний формат
  --no-condition-on-previous-text \   ❌ НЕ підтримується
  --no-coreml \                       ❌ НЕ підтримується
  audio.wav
```

### Корінь проблеми
**whisper-cli НЕ підтримує багато параметрів** які ми передавали:

1. ❌ `--patience` - параметр відсутній (є тільки в Python Whisper)
2. ❌ `--length-penalty` - параметр відсутній
3. ❌ `--compression-ratio-threshold` - є альтернатива `--entropy-thold`
4. ❌ `--no-condition-on-previous-text` - параметр відсутній
5. ❌ `--no-coreml` - **додано в попередньому fix але НЕ існує в whisper-cli!**
6. ❌ `--no-speech-threshold` - **ПРАВИЛЬНИЙ формат: `-nth` АБО `--no-speech-thold`**

**Наслідок:** Невалідні параметри → whisper-cli показував help message → stderr містив VAD параметри → JSON парсинг failing → 500 error

---

## ✅ Рішення

### Виправлено параметри командного рядка
Використовуємо **ТІЛЬКИ** параметри які підтримує whisper-cli:

```python
# ✅ CORRECT: Підтримувані параметри
cmd = [
    whisper-cli,
    '-m', model_path,
    '-l', 'uk',
    '-t', '6',
    '-oj',
    '-of', output_base,
]

# Додаємо ТІЛЬКИ валідні параметри
if WHISPER_CPP_TEMPERATURE >= 0:
    cmd += ['-tp', str(WHISPER_CPP_TEMPERATURE)]  # ✅ -tp підтримується

if WHISPER_CPP_BEST_OF > 1:
    cmd += ['-bo', str(WHISPER_CPP_BEST_OF)]      # ✅ -bo підтримується
    
if WHISPER_CPP_BEAM_SIZE > 1:
    cmd += ['-bs', str(WHISPER_CPP_BEAM_SIZE)]    # ✅ -bs підтримується
    
if WHISPER_CPP_NO_SPEECH_THRESHOLD != 0.6:
    cmd += ['-nth', str(WHISPER_CPP_NO_SPEECH_THRESHOLD)]  # ✅ -nth підтримується

if WHISPER_CPP_INITIAL_PROMPT:
    cmd += ['--prompt', WHISPER_CPP_INITIAL_PROMPT]  # ✅ --prompt підтримується

cmd.append(wav_path)  # Файл в кінці для whisper-cli
```

### Видалено невалідні параметри
```python
# ❌ REMOVED: Не підтримуються whisper-cli
# --patience
# --length-penalty  
# --compression-ratio-threshold
# --no-condition-on-previous-text
# --no-coreml
```

---

## 📋 Whisper-CLI Supported Parameters

### Audio Processing
- ✅ `-t, --threads N` - кількість потоків (дефолт: 4)
- ✅ `-l, --language LANG` - мова (uk, en, auto)
- ✅ `-m, --model FNAME` - шлях до моделі
- ✅ `-oj, --output-json` - вивід JSON
- ✅ `-of, --output-file FNAME` - базове ім'я файлу виводу

### Decoding Quality
- ✅ `-bo, --best-of N` - кількість кандидатів (дефолт: 5)
- ✅ `-bs, --beam-size N` - розмір beam search (дефолт: 5)
- ✅ `-tp, --temperature N` - температура sampling (дефолт: 0.0)
- ✅ `-nth, --no-speech-thold N` - поріг без мови (дефолт: 0.60)

### Context & Prompting
- ✅ `--prompt PROMPT` - початковий промпт (max n_text_ctx/2 токенів)
- ✅ `--carry-initial-prompt` - завжди додавати промпт

### GPU & Performance
- ✅ `-ng, --no-gpu` - вимкнути GPU (використовувати CPU)
- ✅ `-fa, --flash-attn` - увімкнути flash attention (дефолт: true)
- ✅ `-nfa, --no-flash-attn` - вимкнути flash attention

### **НЕ підтримується:**
- ❌ `--patience` - відсутній
- ❌ `--length-penalty` - відсутній
- ❌ `--compression-ratio-threshold` - є `--entropy-thold` замість
- ❌ `--no-condition-on-previous-text` - відсутній
- ❌ `--no-coreml` - відсутній (Core ML НЕ використовується whisper-cli)

---

## 🔍 Діагностика

### Перевірка команди
```bash
# Показує повну команду яка виконується
tail -5 logs/whisper.log | grep "Running whisper.cpp"

# ✅ CORRECT output (після fix):
# whisper-cli -m model.bin -l uk -t 6 -oj -of /tmp/out -tp 0.0 -bo 5 -bs 5 -nth 0.6 --prompt "Олег Миколайович..." audio.wav

# ❌ WRONG output (до fix):
# whisper-cli ... --patience 1.0 --no-coreml audio.wav  # Невалідні параметри
```

### Перевірка помилок
```bash
# Шукаємо JSON parse errors
grep "JSON parse failed" logs/whisper.log

# ✅ ПІСЛЯ FIX: Немає помилок
# ❌ ДО FIX: JSON parse failed × 4 retries
```

### Тест транскрипції
```bash
# Записати аудіо через Quick-send
# Перевірити що НЕ має 500 errors в браузері

# ✅ CORRECT: POST /transcribe 200 OK
# ❌ WRONG: POST /transcribe 500 INTERNAL SERVER ERROR
```

---

## 📊 Результат

### ДО виправлення:
- ❌ Quick-send НЕ працював
- ❌ HTTP 500 × 4 retries при кожній транскрипції
- ❌ stderr містив help message замість транскрипції
- ❌ JSON парсинг failing
- ❌ Невалідні параметри: `--patience`, `--no-coreml`, etc.

### ПІСЛЯ виправлення:
- ✅ Quick-send працює БЕЗ помилок
- ✅ POST /transcribe 200 OK
- ✅ JSON з транскрипцією генерується
- ✅ Використовуються ТІЛЬКИ валідні параметри whisper-cli
- ✅ Metal GPU працює автоматично (без --no-coreml)
- ✅ Текст з'являється в чаті після розпізнавання

---

## 🚀 Критично для розуміння

### whisper-cli vs main binary
```bash
# Старий 'main' binary:
main -f audio.wav -m model.bin -ngl 30 ...  # -f для файлу, -ngl для GPU

# Новий 'whisper-cli' binary:
whisper-cli -m model.bin ... audio.wav      # Файл В КІНЦІ БЕЗ -f, -ngl НЕ підтримується
```

### Metal GPU
- whisper-cli використовує Metal **автоматично** на Mac M1/M2
- НЕ потрібно передавати `-ngl` (тільки для старого 'main')
- НЕ існує `--no-coreml` (Core ML НЕ використовується взагалі)
- Для CPU: `-ng, --no-gpu`

### Параметри якості
```python
# ✅ ПІДТРИМУЮТЬСЯ:
-tp 0.0          # temperature (точність)
-bo 5            # best of (кандидати)
-bs 5            # beam size (пучок)
-nth 0.6         # no speech threshold

# ❌ НЕ ПІДТРИМУЮТЬСЯ (Python Whisper only):
--patience
--length-penalty
--compression-ratio-threshold
--no-condition-on-previous-text
```

---

## 📝 Виправлені файли

### 1. `services/whisper/whispercpp_service.py`
**Змінено:** Видалено невалідні параметри, виправлено формат валідних
**LOC:** ~15 змінених рядків (lines 175-210)
**Результат:** whisper-cli запускається БЕЗ help message, генерує JSON

---

## 🎯 Follow-up Actions

### Наступні кроки:
1. ✅ Restart Whisper service
2. ✅ Перевірити що транскрипція працює
3. ✅ Оновити `.github/copilot-instructions.md`
4. ⏳ Commit з детальним описом

### Commit message:
```
fix(whisper): Remove invalid whisper-cli parameters causing 500 errors

Problem:
- Quick-send НЕ працював - Whisper crashing з HTTP 500
- whisper-cli показував help message замість транскрипції
- Невалідні параметри: --patience, --no-coreml, --compression-ratio-threshold

Root cause:
- whisper-cli НЕ підтримує багато параметрів Python Whisper
- --no-coreml додано в попередньому fix але НЕ існує
- Невалідні параметри → help output → JSON parse fail → 500

Solution:
- Використовуємо ТІЛЬКИ валідні параметри whisper-cli
- Видалено: --patience, --length-penalty, --no-coreml, etc.
- Виправлено формат: --no-speech-threshold → -nth
- Metal GPU працює автоматично БЕЗ спеціальних флагів

Result:
✅ Quick-send працює БЕЗ 500 errors
✅ JSON транскрипція генерується
✅ Текст з'являється в чаті

Files:
- services/whisper/whispercpp_service.py (~15 LOC changed)
- docs/WHISPER_CLI_PARAMS_FIX_2025-10-13.md (NEW)

Related: WHISPER_COREML_FIX_2025-10-13.md (попередній fix з --no-coreml)
```

---

## 🔗 Пов'язані документи

- `docs/WHISPER_COREML_FIX_2025-10-13.md` - Попередній fix (невірний)
- `docs/VAD_CONVERSATION_IMPROVEMENTS_2025-10-12.md` - Whisper quality settings
- `.github/copilot-instructions.md` - Оновити з новим fix

---

**REMEMBER:**
- ✅ whisper-cli підтримує: `-tp`, `-bo`, `-bs`, `-nth`, `--prompt`
- ❌ whisper-cli НЕ підтримує: `--patience`, `--length-penalty`, `--no-coreml`
- ✅ Metal GPU працює автоматично на Mac M1/M2
- ✅ Файл в кінці команди БЕЗ `-f` прапорця
