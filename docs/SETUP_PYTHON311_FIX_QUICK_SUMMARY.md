# Python 3.11 Setup Fix - Короткий підсумок

**Дата:** 12 жовтня 2025, вечір ~20:30  
**Статус:** ✅ ВИПРАВЛЕНО

---

## 🎯 Проблема

```
ERROR: ResolutionImpossible: Cannot install -r requirements.txt (line 22) 
and av==10.0.0 because these package versions have conflicting dependencies
```

Setup script дозволяв Python 3.9+, але залежності потребували саме 3.11.

---

## ✅ Рішення

### 1. **Явна перевірка Python 3.11** (setup-macos.sh)
```bash
# Перевірка чи це 3.11.x
if [[ "$python_version" == 3.11.* ]]; then
    log_success "Python 3.11 вже встановлено"
fi
```

### 2. **Smart venv management**
- Автоматично видаляє старе venv з неправильною версією
- Використовує `python3.11` явно

### 3. **Поетапне встановлення**
```bash
pip install Flask requests aiohttp  # Core
pip install torch==2.1.0  # PyTorch
pip install -r requirements.txt  # Решта
```

### 4. **Виправлені залежності** (requirements.txt)
- ❌ Видалено: `av==10.0.0`, `TTS`, `openai-whisper`
- ✅ Додано: `PyAudio==0.2.13`, конкретні версії
- ✅ `torch==2.1.0` замість діапазону `2.0.0-2.3.0`

---

## 📊 Результат

- ✅ Setup перевіряє саме Python 3.11.x
- ✅ Автоматичне видалення несумісного venv
- ✅ Fallback механізм для критичних пакетів
- ✅ Без конфліктів ResolutionImpossible

---

## 🧪 Тестування

```bash
# Перевірка версії
python3 --version  # Має бути 3.11.x

# Запуск тесту
./tests/test-python311-setup.sh

# Повний setup
./setup-macos.sh
```

---

## 📝 Виправлені файли

1. **setup-macos.sh** - функції `install_python()` та `setup_python_venv()`
2. **requirements.txt** - видалено конфлікти, конкретні версії
3. **tests/test-python311-setup.sh** - NEW тестовий скрипт
4. **.github/copilot-instructions.md** - оновлено LAST UPDATED + новий fix

---

## ⚠️ Критично

**ЗАВЖДИ:**
- ✅ Використовуйте Python 3.11 (НЕ 3.9/3.10/3.12+)
- ✅ Видаляйте старе venv при зміні версії Python
- ✅ Встановлюйте залежності поетапно

**НІКОЛИ:**
- ❌ НЕ використовуйте `av` пакет (конфлікт з 3.11+)
- ❌ НЕ використовуйте `TTS` пакет (dependency hell)
- ❌ НЕ використовуйте діапазони версій для PyTorch

---

**Детально:** `docs/SETUP_PYTHON311_FIX_2025-10-12.md`
