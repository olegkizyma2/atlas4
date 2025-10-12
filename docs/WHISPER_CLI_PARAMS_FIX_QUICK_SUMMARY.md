# Whisper CLI Invalid Parameters Fix - Quick Summary

**DATE:** 13.10.2025 ~01:50  
**STATUS:** ✅ FIXED  

---

## ❌ Проблема
Quick-send НЕ працював → Whisper 500 error × 4 retries → help message замість JSON

## 🔍 Корінь
whisper-cli НЕ підтримує параметри які ми передавали:
- ❌ `--patience` (тільки Python Whisper)
- ❌ `--length-penalty` (тільки Python Whisper)
- ❌ `--compression-ratio-threshold` (тільки Python Whisper)
- ❌ `--no-condition-on-previous-text` (тільки Python Whisper)
- ❌ `--no-coreml` (НЕ існує в whisper-cli!)

## ✅ Рішення
Використовуємо ТІЛЬКИ валідні параметри:
```bash
# ✅ ПІДТРИМУЮТЬСЯ whisper-cli:
-tp 0.0         # temperature
-bo 5           # best of
-bs 5           # beam size  
-nth 0.6        # no speech threshold
--prompt "..."  # initial prompt

# ❌ ВИДАЛЕНО (не підтримуються):
--patience, --length-penalty, --no-coreml, etc.
```

## 📊 Результат
- ✅ Quick-send працює БЕЗ 500 errors
- ✅ Транскрипція генерує JSON
- ✅ Текст з'являється в чаті
- ✅ Metal GPU автоматично

## 📝 Файли
- `services/whisper/whispercpp_service.py` (~15 LOC)
- `docs/WHISPER_CLI_PARAMS_FIX_2025-10-13.md` (детальний звіт)

## 🔗 Related
- `docs/WHISPER_COREML_FIX_2025-10-13.md` (попередній невірний fix)
