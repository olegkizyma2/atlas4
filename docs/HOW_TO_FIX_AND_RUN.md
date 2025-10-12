# 🚀 Інструкція: Виправлення Setup та Запуск ATLAS

**Дата оновлення:** 12 жовтня 2025, вечір ~20:30

---

## ✅ Що було виправлено

Проблема з конфліктами Python залежностей **ВИПРАВЛЕНА**:
- ✅ Setup тепер перевіряє саме Python 3.11
- ✅ Автоматичне видалення старого venv
- ✅ Поетапне встановлення залежностей
- ✅ Виправлені конфлікти в `requirements.txt`

---

## 📋 Швидкий старт (для нових користувачів)

### 1. Клонування репозиторію
```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
```

### 2. Запуск setup
```bash
chmod +x setup-macos.sh
./setup-macos.sh
```

Setup автоматично:
- ✅ Перевірить та встановить Python 3.11
- ✅ Встановить всі залежності (Homebrew, Node.js, etc.)
- ✅ Створить віртуальне середовище з Python 3.11
- ✅ Встановить Python пакети без конфліктів
- ✅ Скомпілює Whisper.cpp з Metal GPU

### 3. Перевірка setup
```bash
./tests/test-python311-setup.sh
```

Має показати:
```
✅ PASS - Python 3.11 встановлено
✅ PASS - venv створено з Python 3.11
✅ PASS - Всі критичні пакети встановлено
🎉 ATLAS Python 3.11 Setup - ВСІ ТЕСТИ ПРОЙШЛИ!
```

### 4. Запуск системи
```bash
./restart_system.sh start
```

### 5. Відкрити веб-інтерфейс
```bash
open http://localhost:5001
```

---

## 🔧 Виправлення існуючої інсталяції

Якщо у вас вже є старий setup з Python 3.9:

### 1. Видалити старе віртуальне середовище
```bash
cd /Users/olegkizyma/Documents/GitHub/atlas4
rm -rf web/venv
```

### 2. Оновити Git репозиторій
```bash
git pull origin main
```

### 3. Запустити setup знову
```bash
./setup-macos.sh
```

Setup автоматично:
- Встановить Python 3.11 (якщо потрібно)
- Створить нове venv з правильною версією
- Встановить залежності БЕЗ конфліктів

### 4. Перевірити що все працює
```bash
# Перевірка версії Python
python3 --version
# Має показати: Python 3.11.x

# Перевірка venv
source web/venv/bin/activate
python --version
# Має показати: Python 3.11.x

# Тест залежностей
python -c "import torch; print(torch.__version__)"
python -c "import Flask; print(Flask.__version__)"
python -c "import faster_whisper; print('✅ faster-whisper OK')"

deactivate
```

---

## 🧪 Діагностика проблем

### Проблема: "ERROR: ResolutionImpossible"

**Рішення:**
```bash
# 1. Видалити старе venv
rm -rf web/venv

# 2. Запустити setup знову
./setup-macos.sh
```

### Проблема: Python 3.9 замість 3.11

**Рішення:**
```bash
# Встановити Python 3.11 через Homebrew
brew install python@3.11

# Додати до PATH
export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"

# Запустити setup
./setup-macos.sh
```

### Проблема: "Cannot find python3.11"

**Рішення:**
```bash
# Перевірити встановлення
brew list python@3.11

# Якщо відсутній - встановити
brew install python@3.11

# Перевірити версію
python3.11 --version
```

### Проблема: Пакети не встановлюються

**Рішення:**
```bash
# Активувати venv
source web/venv/bin/activate

# Оновити pip
pip install --upgrade pip setuptools wheel

# Встановити залежності вручну (поетапно)
pip install Flask==2.3.3 Flask-CORS==4.0.0
pip install torch==2.1.0 torchaudio==2.1.0
pip install faster-whisper==0.10.0
pip install -r requirements.txt

deactivate
```

---

## 📊 Перевірка системи

### Швидка перевірка
```bash
# Запустити автоматичний тест
./tests/test-python311-setup.sh
```

### Детальна перевірка
```bash
# Версія Python
python3 --version

# venv версія
web/venv/bin/python --version

# Критичні пакети
source web/venv/bin/activate
pip list | grep -E "torch|Flask|faster-whisper"
deactivate

# PyTorch MPS
python3 -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"

# Node.js
node --version

# Goose
goose --version
```

---

## 🎯 Очікувані результати

Після успішного setup:

### Python
```
$ python3 --version
Python 3.11.x
```

### Virtual Environment
```
$ source web/venv/bin/activate
$ python --version
Python 3.11.x
```

### Критичні пакети
```
$ pip list | grep -E "torch|Flask|faster-whisper"
Flask                 2.3.3
Flask-CORS            4.0.0
torch                 2.1.0
torchaudio            2.1.0
faster-whisper        0.10.0
```

### PyTorch MPS (для M1/M2/M3)
```
$ python -c "import torch; print(torch.backends.mps.is_available())"
True
```

---

## 📚 Документація

- **Детальний звіт:** `docs/SETUP_PYTHON311_FIX_2025-10-12.md`
- **Короткий підсумок:** `docs/SETUP_PYTHON311_FIX_QUICK_SUMMARY.md`
- **Тестовий скрипт:** `tests/test-python311-setup.sh`
- **Інструкції Copilot:** `.github/copilot-instructions.md` (LAST UPDATED: 12.10.2025)

---

## ❓ Питання та підтримка

Якщо виникають проблеми:

1. Перевірте версію Python: `python3 --version` (має бути 3.11.x)
2. Запустіть тест: `./tests/test-python311-setup.sh`
3. Видаліть venv та запустіть setup знову: `rm -rf web/venv && ./setup-macos.sh`
4. Перегляньте логи: `tail -50 logs/orchestrator.log`

---

**Система готова до використання! 🚀**
