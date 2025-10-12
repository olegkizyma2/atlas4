# 🔧 Whisper Core ML Crash - Quick Fix Summary

**Date:** 13 жовтня 2025, ~01:10-01:30  
**Status:** ✅ ВИПРАВЛЕНО  
**Severity:** 🔴 CRITICAL (повна неможливість транскрипції)

---

## 📋 Що було зламано

**Quick-send режим** - користувач натискає кнопку мікрофона, говорить, але текст **НЕ з'являється** в чаті.

**Помилка Stage 1 (Core ML):**
```
whisper_init_state: failed to load Core ML model from 'ggml-large-v3-encoder.mlmodelc'
error: failed to initialize whisper context
```

**Помилка Stage 2 (Command Format):**
```
whisper.cpp JSON parse failed. stdout=, stderr=(help menu tail)
Transcription error: whisper.cpp did not produce JSON output
```

---

## 🔍 Корінь проблеми

### Проблема #1: Core ML
1. **whisper-cli намагався використати Core ML** автоматично
2. **Core ML модель НЕ існує** в `models/whisper/`
3. **Краш при ініціалізації** → 500 error

### Проблема #2: Command Format
1. **Whisper-cli очікує файл БЕЗ `-f`** в кінці команди
2. **Ми передавали:** `-f /path/to/file.wav` (неправильно!)
3. **Має бути:** `/path/to/file.wav` (файл останнім, без -f)
4. **Whisper-cli показував help** замість транскрипції

---

## ✅ Швидке рішення

**Fix #1:** Додано `--no-coreml` для whisper-cli
**Fix #2:** Виправлено формат команди

```python
# BEFORE (неправильно)
cmd = [..., '-f', wav_path, ...]

# AFTER (правильно)
is_whisper_cli = 'whisper-cli' in bin_name
if not is_whisper_cli:
    cmd += ['-f', wav_path]  # Старий main використовує -f
    
cmd += ['--no-coreml']  # Fix #1
cmd.append(wav_path)     # Fix #2 - файл останнім для whisper-cli
```

---

## 🎯 Результат

- ✅ **Whisper service запускається** БЕЗ помилок Core ML
- ✅ **Whisper-cli отримує правильну команду** (файл в кінці)
- ✅ **Транскрипція працює** через Metal GPU напряму
- ✅ **Quick-send режим працює** з першого разу

---

## 🧪 Як перевірити

1. Перезапустити систему: `./restart_system.sh restart`
2. Відкрити http://localhost:5001
3. Натиснути 🎤 → сказати щось → дочекатись автостопу
4. Перевірити що текст з'явився в чаті ✅

**Логи:**
```bash
tail -f logs/whisper.log | grep "Running whisper"
# Має бути: ... --no-coreml /var/folders/.../tmpXXX.wav
# (файл ОСТАННІМ без -f)
```

---

## 📊 Технічні деталі

| До виправлення | Після виправлення |
|----------------|-------------------|
| Core ML модель потрібна ❌ | Core ML НЕ потрібен ✅ |
| 500 error × 4 retries | Транскрипція працює |
| `-f /path/file.wav` ❌ | `/path/file.wav` ✅ |
| Whisper-cli показує help | Whisper-cli працює |

---

## ⚠️ КРИТИЧНО

- **Core ML - опціональна оптимізація**, НЕ обов'язкова
- **Whisper-cli ≠ main binary** - різний формат команди!
- **Файл ЗАВЖДИ останнім** для whisper-cli (БЕЗ `-f`)
- **Metal GPU працює автоматично** на Mac M1/M2

---

**Детально:** `docs/WHISPER_COREML_FIX_2025-10-13.md`
