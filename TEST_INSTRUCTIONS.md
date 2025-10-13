# 🧪 ATLAS v4.0 - Інструкція для тестування

## 📋 Доступні скрипти

### 1. `./cleanup.sh` - Очищення середовища

Видаляє всі згенеровані файли та середовища перед тестом.

**Що видаляється:**

- ✗ `web/venv/` - Python віртуальне середовище
- ✗ `node_modules/` - Node.js залежності (всі теки)
- ✗ `third_party/whisper.cpp.upstream/build/` - Whisper компіляція
- ✗ `.env` - конфігурація
- ✗ `setup-test.log` - логи

**Що ЗБЕРІГАЄТЬСЯ:**

- ✓ `models/whisper/ggml-large-v3.bin` - модель Whisper (~3GB)
- ✓ `web/static/assets/DamagedHelmet.glb` - 3D модель (~3.6MB)
- ✓ Вихідний код проекту

**Використання:**

```bash
./cleanup.sh
```

---

### 2. `./test-setup.sh` - Повний тест установки

Запускає `./setup-macos.sh` з логуванням і валідацією.

**Що робить:**
1. Запускає повну установку (17 кроків)
2. Логує все в `setup-test.log`
3. Вимірює час виконання
4. Перевіряє результат установки
5. Показує підсумковий звіт

**Очікуваний час:** 5-10 хвилин (залежно від швидкості інтернету)

**Використання:**
```bash
./test-setup.sh
```

**Вивід:**
```
╔════════════════════════════════════════════════════════════════╗
║          🚀 ATLAS v4.0 - Тест установки                       ║
╚════════════════════════════════════════════════════════════════╝

⏱️  Початок: 04:45:23
📝 Лог файл: setup-test.log

... (процес установки) ...

╔════════════════════════════════════════════════════════════════╗
║          ✅ УСТАНОВКА ЗАВЕРШЕНА                                ║
╚════════════════════════════════════════════════════════════════╝

⏱️  Початок:    04:45:23
⏱️  Завершення: 04:50:15
⏱️  Тривалість: 4м 52с

🔍 Перевірка установки...

✅ Python venv створено
   Python 3.11.13
✅ Ukrainian TTS встановлено
✅ Node.js залежності встановлено
✅ Whisper.cpp зібрано
✅ .env файл створено
✅ Goose config створено

📊 Детальний лог: setup-test.log
📊 Розмір логу: 1247 рядків
```

---

### 3. `./check-status.sh` - Швидка перевірка стану
Перевіряє поточний стан системи БЕЗ установки.

**Що перевіряє:**
- 🐍 Python Virtual Environment
- 📦 Node.js Dependencies
- 🎤 Whisper.cpp build & model
- ⚙️  Configuration files (.env, Goose)
- 🎨 3D Assets

**Використання:**
```bash
./check-status.sh
```

**Вивід:**
```
╔════════════════════════════════════════════════════════════════╗
║          🔍 ATLAS v4.0 - Перевірка стану                      ║
╚════════════════════════════════════════════════════════════════╝

🐍 Python Virtual Environment:
   ✓ venv створено
   ✓ Python 3.11.13
   ✓ Встановлено пакетів: 156
   ✓ Ukrainian TTS
   ✓ ESPnet
   ✓ PyTorch

📦 Node.js Dependencies:
   ✓ node_modules/
   ✓ Встановлено пакетів: 847
   ✓ config/node_modules/
   ✓ orchestrator/node_modules/

🎤 Whisper.cpp:
   ✓ build/ директорія існує
   ✓ whisper-cli зібрано
   ✓ Розмір: 2.1M
   ✓ Модель Large-v3 (2.9G)

⚙️  Configuration:
   ✓ .env файл створено
   ✓ Whisper Metal GPU enabled
   ✓ TTS MPS device enabled
   ✓ Goose config створено

🎨 3D Assets:
   ✓ DamagedHelmet.glb (3.6M)

╔════════════════════════════════════════════════════════════════╗
║          ✅ Система готова до запуску                          ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 🚀 Швидкий старт (рекомендований workflow)

### Перший раз:
```bash
# 1. Очистити середовище
./cleanup.sh

# 2. Запустити повний тест
./test-setup.sh

# 3. Перевірити результат
./check-status.sh
```

### Повторне тестування:
```bash
# 1. Очистити
./cleanup.sh

# 2. Перезапустити setup
./test-setup.sh
```

### Просто перевірка:
```bash
# Швидка перевірка стану
./check-status.sh
```

---

## 📊 Логування

Всі логи зберігаються в `setup-test.log`:

```bash
# Подивитись останні 50 рядків
tail -50 setup-test.log

# Подивитись весь лог
less setup-test.log

# Знайти помилки
grep -i "error\|failed" setup-test.log

# Знайти успішні кроки
grep "✅" setup-test.log
```

---

## ⚠️ Важливо

1. **Python 3.11** - обов'язково! НЕ 3.9/3.10/3.12+
2. **Інтернет** - потрібен для завантаження пакетів
3. **Місце на диску** - мінімум 5GB вільного
4. **Час** - перша установка ~10 хвилин (завантаження моделей)
5. **Homebrew** - має бути встановлений (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

---

## 🐛 Troubleshooting

### Помилка: "Python 3.11 not found"
```bash
# Встановити через pyenv
brew install pyenv
pyenv install 3.11.13
pyenv global 3.11.13
```

### Помилка: "Whisper compilation failed"
```bash
# Перевірити Xcode Command Line Tools
xcode-select --install
```

### Помилка: "Ukrainian TTS installation failed"
```bash
# Перезапустити з чистого venv
rm -rf web/venv
./test-setup.sh
```

---

## 📝 Що тестується

Скрипт `test-setup.sh` перевіряє всі **17 кроків** setup-macos.sh:

1. ✅ Системні вимоги (macOS, пам'ять, диск)
2. ✅ Homebrew
3. ✅ Python 3.11
4. ✅ Node.js 18+
5. ✅ Git
6. ✅ Системні залежності (wget, curl, ffmpeg, cmake)
7. ✅ Goose Desktop
8. ✅ Python віртуальне середовище + залежності
9. ✅ Node.js залежності
10. ✅ Whisper.cpp компіляція (Metal GPU)
11. ✅ Whisper моделі (Large-v3)
12. ✅ Створення директорій
13. ✅ 3D моделі
14. ✅ .env конфігурація
15. ✅ Goose конфігурація
16. ✅ Тестування компонентів
17. ✅ Фіналізація

---

## 📈 Метрики якості

Після успішної установки очікується:

- ✅ Python packages: **150+**
- ✅ Node.js packages: **800+** (root: 97, config: 18, orchestrator: 107)
- ✅ Whisper binary: **~2MB**
- ✅ Whisper model: **~3GB**
- ✅ Total time: **5-10 minutes**
- ✅ Disk usage: **~5GB**

---

## 🔧 Швидке виправлення (якщо щось не встановилось)

### Проблема: `orchestrator/node_modules/` відсутні

```bash
# Швидкий скрипт (рекомендовано)
./fix-orchestrator-deps.sh

# Або вручну
cd orchestrator && npm install && cd ..
```

### Проблема: Будь-які інші залежності

```bash
# Повна переустановка
./cleanup.sh
./test-setup.sh
```

---

**Автор:** ATLAS v4.0 Setup System  
**Дата:** 13.10.2025  
**Версія:** 1.0.0
