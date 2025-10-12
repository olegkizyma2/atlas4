# Whisper Core ML → Metal Fix - QUICK SUMMARY

**Дата:** 13.10.2025, ніч ~02:06  
**Версія:** v4 (FINAL)  
**Статус:** ✅ FIXED

---

## 🎯 Що було зламано

Quick-send режим НЕ працював - **HTTP 500** при кожній транскрипції:
```
POST /transcribe → 500 INTERNAL SERVER ERROR
whisper_init_state: failed to load Core ML model
error: failed to initialize whisper context
```

---

## 🔍 Корінь (v1→v4 evolution)

| Версія | Час | Проблема | Статус |
|--------|-----|----------|--------|
| v1 | ~01:10 | `--no-coreml` НЕ існує | ❌ Невірний fix |
| v2 | ~01:50 | Невалідні env vars | ✅ Частковий fix |
| v3 | ~02:00 | Python код читає env vars | ✅ Cleanup |
| **v4** | **~02:06** | **Core ML модель пошкоджена** | ✅ **FINAL** |

---

## ✅ Рішення v4

### 1. Додано `--no-gpu` для whisper-cli
**Файл:** `services/whisper/whispercpp_service.py`
```python
if is_whisper_cli:
    cmd.append('--no-gpu')  # Вимкнути Core ML → Metal
```

### 2. Видалено невалідні env vars
**Файл:** `restart_system.sh`
```bash
# ❌ Видалено (НЕ підтримує whisper-cli):
- WHISPER_CPP_PATIENCE
- WHISPER_CPP_LENGTH_PENALTY  
- WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD
- WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT

# ✅ Залишені (підтримує):
+ WHISPER_CPP_TEMPERATURE
+ WHISPER_CPP_BEST_OF
+ WHISPER_CPP_BEAM_SIZE
+ WHISPER_CPP_NO_SPEECH_THRESHOLD
+ WHISPER_CPP_INITIAL_PROMPT
```

### 3. Очищено Python код
Видалено читання невалідних env vars з `whispercpp_service.py`

---

## 📊 Результат

✅ Quick-send працює БЕЗ помилок  
✅ Metal GPU працює автоматично  
✅ Whisper-cli виконує транскрипцію успішно  
✅ Текст з'являється в чаті  

**Health:**
```json
{
  "device": "metal",
  "status": "ok"
}
```

---

## 🎯 Критичні правила

### whisper-cli підтримує:
✅ `-tp` (temperature)  
✅ `-bo` (best_of)  
✅ `-bs` (beam_size)  
✅ `-nth` (no_speech_threshold)  
✅ `--prompt` (initial prompt)  
✅ `--no-gpu` ⭐ **вимкнути Core ML**  

### whisper-cli НЕ підтримує:
❌ `--patience`  
❌ `--length-penalty`  
❌ `--compression-ratio-threshold`  
❌ `--condition-on-previous-text`  
❌ `--no-coreml` (параметр НЕ існує!)  

### Metal vs Core ML:
- **Core ML:** потребує `.mlmodelc` файл → може крашитись
- **Metal:** працює з `.bin` GGML моделями → стабільніший
- **whisper-cli:** Core ML за замовчуванням → додайте `--no-gpu`

---

## 📚 Детальна документація

`docs/WHISPER_COREML_NOGPU_FIX_2025-10-13.md`

---

**ONE-LINER:**  
Додано `--no-gpu` для whisper-cli → Metal замість Core ML → транскрипція працює ✅
