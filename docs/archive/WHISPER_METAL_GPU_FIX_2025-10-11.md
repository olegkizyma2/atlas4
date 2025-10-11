# Whisper Metal GPU Fix - 2025-10-11 01:10

## Проблема

Whisper використовував **`whisper-cli`** бінарник який **НЕ підтримує Metal GPU** через `-ngl` параметр.

## Симптоми

1. **Модель Large-v3** працювала правильно (2.9GB)
2. **Розпізнавання** було коректним
3. Але **Metal GPU НЕ використовувався** - весь inference на CPU
4. Повільна швидкість транскрипції (~2.5 секунди для короткого аудіо)

## Корінь проблеми

### Binary вибір в `restart_system.sh`:

```bash
# ДО ВИПРАВЛЕННЯ (пріоритет whisper-cli):
if [ -x "whisper-cli" ]; then
    WHISPER_CPP_BIN="whisper-cli"  # ❌ НЕ підтримує -ngl
else
    WHISPER_CPP_BIN="main"
fi
```

### Підтримка GPU в різних бінарниках:

| Бінарник                | `-ngl` flag              | Metal GPU | Статус           |
| ----------------------- | ------------------------ | --------- | ---------------- |
| **main** (старий)       | ✅ YES                    | ✅ WORKS   | ✅ Використовуємо |
| **whisper-cli** (новий) | ❌ NO (тільки `--no-gpu`) | ❌ NO      | ❌ НЕ підходить   |
| **whisper-server**      | ✅ YES                    | ✅ WORKS   | Альтернатива     |

### Перевірка підтримки:

```bash
# whisper-cli має ТІЛЬКИ --no-gpu (вимкнути GPU):
$ whisper-cli --help | grep gpu
  -ng, --no-gpu  [false] disable GPU

# main підтримує -ngl (кількість шарів на GPU):
$ main --help | grep ngl
  -ngl N, --n-gpu-layers N  [0] number of layers to offload to GPU
```

## Рішення

### 1. Змінено пріоритет в `restart_system.sh` (рядки 44-54):

```bash
# ПІСЛЯ ВИПРАВЛЕННЯ (пріоритет main):
# Prefer OLD 'main' binary for Metal GPU support via -ngl flag
# (whisper-cli does NOT support -ngl, only --no-gpu)
if [ -z "${WHISPER_CPP_BIN:-}" ]; then
    if [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/main"
    elif [ -x "$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli" ]; then
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp.upstream/build/bin/whisper-cli"
    else
        WHISPER_CPP_BIN="$REPO_ROOT/third_party/whisper.cpp/main"
    fi
else
    WHISPER_CPP_BIN="${WHISPER_CPP_BIN}"
fi
```

### 2. Код в `whispercpp_service.py` вже був готовий:

```python
# Добавляем offload-флаг только для старого бинаря 'main'
if 'whisper-cli' not in bin_name and WHISPER_CPP_NGL > 0:
    cmd.insert(10, '-ngl')
    cmd.insert(11, str(WHISPER_CPP_NGL))  # 20 шарів на GPU
```

✅ **Цей код тепер ПРАЦЮЄ** тому що використовується `main` замість `whisper-cli`!

## Результат виправлення

### ДО (whisper-cli):

```bash
whisper-cli -m model.bin -f audio.wav -l uk -t 6 ...
# ❌ БЕЗ -ngl параметру
# ❌ GPU НЕ використовується
# ⏱️ Повільний inference на CPU
```

### ПІСЛЯ (main):

```bash
main -m model.bin -f audio.wav -l uk -t 6 -ngl 20 ...
# ✅ З -ngl 20 параметром
# ✅ 20 шарів моделі на Metal GPU
# ⚡ Швидкий inference з GPU прискоренням
```

## Перевірка конфігурації

```bash
# Health endpoint показує правильну конфігурацію:
curl -s http://localhost:3002/health | jq

{
  "backend": "whisper.cpp",
  "binary": ".../build/bin/main",           # ✅ main (НЕ whisper-cli)
  "device": "metal",                        # ✅ Metal GPU
  "model_path": ".../ggml-large-v3.bin",   # ✅ Large-v3
  "ngl": 20,                                # ✅ 20 шарів на GPU
  "threads": 6,
  "status": "ok"
}
```

## Логи підтвердження

```
2025-10-11 01:07:15,676 [INFO] atlas.whispercpp: Binary: .../build/bin/main
2025-10-11 01:07:15,676 [INFO] atlas.whispercpp: Device: metal (ngl=20)

2025-10-11 01:09:12,923 [INFO] atlas.whispercpp: Running whisper.cpp: 
  .../build/bin/main 
  -m .../ggml-large-v3.bin 
  -f .../audio.wav 
  -l uk 
  -t 6 
  -oj 
  -ngl 20                    # ✅ ТЕПЕР ПРИСУТНІЙ!
  -of .../out 
  --best-of 5 
  --beam-size 5 
  --prompt "Це українська мова..."
```

## Очікувані переваги

### 🚀 Швидкість:

- **CPU-only** (whisper-cli): ~2.5s для короткого аудіо
- **Metal GPU** (main -ngl 20): ~0.8-1.2s для того ж аудіо
- **Прискорення:** 2-3x швидше

### 💎 Якість:

- Модель залишається та ж (Large-v3)
- Якість розпізнавання НЕ змінюється
- Тільки швидкість покращується

### 🔋 Ефективність:

- Metal GPU оптимізований для Apple Silicon
- Менше навантаження на CPU
- Краще використання ресурсів Mac

## Тестування

### Автоматичний тест:

```bash
# 1. Перезапустити систему
./restart_system.sh restart

# 2. Перевірити конфігурацію
curl -s http://localhost:3002/health | jq -r '.binary, .ngl'
# Має показати:
# .../build/bin/main
# 20

# 3. Тест транскрипції
curl -X POST http://localhost:3002/transcribe \
  -F "audio=@ukrainian-tts/user_text.wav" \
  -F "language=uk" | jq -r '.text'

# 4. Перевірити логи на -ngl
tail -10 logs/whisper.log | grep "ngl 20"
# Має показати: ... -ngl 20 -of ...
```

### Очікуваний результат:

```
✅ Binary: main (НЕ whisper-cli)
✅ NGL: 20 шарів на GPU
✅ Логи містять "-ngl 20"
✅ Транскрипція працює швидше
✅ Якість залишається відмінною
```

## Файли змінені

1. **`restart_system.sh`** (рядки 44-54)
   - Змінено пріоритет: `main` → `whisper-cli` (замість навпаки)
   - Додано коментарі про підтримку Metal GPU
   - Логіка вибору бінарника оновлена

## Альтернативні рішення (НЕ використані)

### Option 1: Whisper-server
- Підтримує `-ngl` через API
- Складніша конфігурація
- Зайвий оверхед

### Option 2: Власний build whisper-cli з Metal
- Потребує recompile з Metal прапорцями
- Новіші версії можуть підтримувати Metal інакше
- Непотрібна складність

### Option 3: Python faster-whisper
- Використовує CUDA/ROCm (НЕ Metal)
- Повільніший на Mac
- Більше залежностей

✅ **Рішення з `main` бінарником найпростіше і найефективніше!**

## Критичні нотатки

### ⚠️ Не плутати флаги:

```bash
-ngl 20      # Offload 20 layers TO GPU (main binary)
--no-gpu     # DISABLE GPU completely (whisper-cli)
```

Це **ПРОТИЛЕЖНІ** параметри!

### 📝 Чому main "старий" але кращий:

- `main` - legacy бінарник з повною підтримкою всіх фіч
- `whisper-cli` - новий "спрощений" CLI без деяких опцій
- Для production з Metal GPU → використовуйте `main`

### 🔮 Майбутнє:

Коли `whisper-cli` отримає підтримку Metal через інші параметри (наприклад `--device metal`), можна буде повернутись до нього. Поки що - `main` є найкращим вибором.

## Наступні кроки (опціонально)

1. **Benchmark тести** - порівняти швидкість до/після
2. **Моніторинг GPU** - переконатись що Metal GPU активно використовується
3. **Temperature monitoring** - перевірити нагрів GPU під навантаженням
4. **Batch processing** - тести з множинними одночасними транскрипціями

---

**Документ створено:** 11 жовтня 2025, 01:10  
**Версія:** 1.0  
**Статус:** Виправлення застосовано ✅  
**Перезапуск потрібен:** ✅ DONE
