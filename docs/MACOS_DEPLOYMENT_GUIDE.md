# ATLAS v4.0 - Повний гід з розгортання на macOS

**Дата:** 12 жовтня 2025  
**Версія:** 4.0  
**Платформа:** macOS 11.0+ (Big Sur або новіше)

---

## 📋 Зміст

1. [Швидкий старт](#швидкий-старт)
2. [Системні вимоги](#системні-вимоги)
3. [Автоматична установка](#автоматична-установка)
4. [Ручна установка](#ручна-установка)
5. [Перевірка установки](#перевірка-установки)
6. [Запуск системи](#запуск-системи)
7. [Усунення проблем](#усунення-проблем)
8. [Оптимізація для Apple Silicon](#оптимізація-для-apple-silicon)

---

## 🚀 Швидкий старт

### Найпростіший спосіб (3 команди):

```bash
# 1. Клонувати репозиторій
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4

# 2. Зробити скрипт виконуваним та запустити
chmod +x setup-macos.sh
./setup-macos.sh

# 3. Після завершення установки запустити систему
./restart_system.sh start
```

Або використовуючи Make:

```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
make install
make start
```

### Доступ до системи:

- **Веб-інтерфейс:** http://localhost:5001
- **Orchestrator API:** http://localhost:5101
- **Goose Server:** http://localhost:3000
- **TTS Service:** http://localhost:3001
- **Whisper Service:** http://localhost:3002

---

## 💻 Системні вимоги

### Мінімальні вимоги:

- **macOS:** 11.0 (Big Sur) або новіше
- **Процесор:** Intel Core i5 або Apple Silicon (M1/M2/M3)
- **RAM:** 8 GB (рекомендовано 16 GB)
- **Вільне місце:** 10 GB (для моделей та даних)
- **Інтернет:** Для завантаження залежностей та моделей

### Рекомендована конфігурація:

- **macOS:** 13.0 (Ventura) або новіше
- **Процесор:** Apple Silicon (M1/M2/M3) для Metal GPU
- **RAM:** 16 GB або більше
- **Вільне місце:** 20 GB
- **Інтернет:** Швидкісний (для швидшого завантаження моделей)

### Переваги Apple Silicon (M1/M2/M3):

✅ **Metal GPU Acceleration** для Whisper (20x швидше)  
✅ **MPS (Metal Performance Shaders)** для Ukrainian TTS  
✅ **48kHz аудіо** без втрат якості  
✅ **Beam Search** з beam_size >= 5  
✅ **Енергоефективність** (довший час роботи на батареї)

---

## 🤖 Автоматична установка

Скрипт `setup-macos.sh` автоматично виконує всі необхідні кроки:

### Що робить скрипт:

1. **Перевіряє системні вимоги**
   - Версія macOS
   - Архітектура процесора (Intel / Apple Silicon)
   - Доступна пам'ять та місце на диску

2. **Встановлює Homebrew** (якщо не встановлено)
   - Менеджер пакетів для macOS

3. **Встановлює Python 3.9+**
   - Python 3.11 через Homebrew
   - Перевіряє існуючу версію

4. **Встановлює Node.js 18+**
   - Node.js 20 LTS через Homebrew
   - npm та управління пакетами

5. **Встановлює системні залежності**
   - Git, wget, curl, jq
   - portaudio, ffmpeg, cmake
   - Xcode Command Line Tools (для Metal)

6. **Встановлює Goose AI**
   - Desktop версія (рекомендовано) або CLI
   - Інтерактивне налаштування

7. **Створює Python віртуальне середовище**
   - Ізольоване від системного Python
   - Встановлює всі залежності з requirements.txt

8. **Встановлює Node.js залежності**
   - npm пакети для orchestrator
   - Модулі для frontend

9. **Компілює Whisper.cpp з Metal**
   - Клонує офіційний репозиторій
   - Компілює з GPU підтримкою для M1/M2/M3
   - Налаштовує CPU режим для Intel

10. **Завантажує Whisper моделі**
    - Large-v3 модель (~3GB) для української мови
    - Оптимізована для точності

11. **Створює необхідні директорії**
    - logs/, models/, data/
    - Goose конфігурація

12. **Налаштовує систему**
    - Створює .env файл
    - Конфігурує Goose
    - Встановлює змінні середовища

13. **Тестує установку**
    - Перевіряє всі компоненти
    - Виявляє потенційні проблеми

### Використання:

```bash
cd atlas4
chmod +x setup-macos.sh
./setup-macos.sh
```

Скрипт показує прогрес кожного кроку та зупиняється при помилках.

---

## 🔧 Ручна установка

Якщо потрібен повний контроль над процесом:

### Крок 1: Встановити Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Для Apple Silicon додати до PATH:
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Крок 2: Встановити базові інструменти

```bash
brew install python@3.11 node@20 git wget curl jq
brew install portaudio ffmpeg cmake
```

### Крок 3: Встановити Goose

**Варіант A: Desktop (рекомендовано)**

1. Завантажити з https://github.com/block/goose/releases
2. Встановити в `/Applications/`
3. Додати до PATH або використовувати повний шлях

**Варіант B: CLI**

```bash
brew tap block/goose
brew install goose

# Налаштувати
goose configure
```

### Крок 4: Клонувати репозиторій

```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
```

### Крок 5: Python віртуальне середовище

```bash
python3 -m venv web/venv
source web/venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Крок 6: Node.js залежності

```bash
npm install

# Config модулі
cd config
npm install
cd ..
```

### Крок 7: Компіляція Whisper.cpp

**Для Apple Silicon (M1/M2/M3):**

```bash
mkdir -p third_party
cd third_party
git clone https://github.com/ggerganov/whisper.cpp.git whisper.cpp.upstream
cd whisper.cpp.upstream
mkdir build
cd build
cmake .. -DWHISPER_METAL=ON -DWHISPER_COREML=ON
make -j$(sysctl -n hw.ncpu)
cd ../../..
```

**Для Intel:**

```bash
mkdir -p third_party
cd third_party
git clone https://github.com/ggerganov/whisper.cpp.git whisper.cpp.upstream
cd whisper.cpp.upstream
make -j$(sysctl -n hw.ncpu)
cd ../..
```

### Крок 8: Завантажити Whisper модель

```bash
mkdir -p models/whisper
cd models/whisper
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
cd ../..
```

### Крок 9: Створити директорії

```bash
mkdir -p logs logs/archive
mkdir -p models/whisper models/tts
mkdir -p data
mkdir -p ~/.local/share/goose/sessions
mkdir -p ~/.config/goose
```

### Крок 10: Налаштувати .env

```bash
cat > .env << 'EOF'
# ATLAS System Configuration
NODE_ENV=production
FORCE_FREE_PORTS=true

# Goose
GOOSE_SERVER_PORT=3000
GOOSE_DISABLE_KEYRING=1

# TTS (mps для M1/M2/M3, cpu для Intel)
REAL_TTS_MODE=true
TTS_DEVICE=mps
TTS_PORT=3001

# Whisper (metal для M1/M2/M3, cpu для Intel)
WHISPER_BACKEND=cpp
WHISPER_DEVICE=metal
WHISPER_PORT=3002
WHISPER_CPP_NGL=20

# Ports
FRONTEND_PORT=5001
ORCHESTRATOR_PORT=5101
EOF
```

### Крок 11: Налаштувати Goose

```bash
# Якщо Desktop:
/Applications/Goose.app/Contents/MacOS/goose configure

# Якщо CLI:
goose configure
```

---

## ✅ Перевірка установки

### Автоматична діагностика:

```bash
./restart_system.sh diagnose
```

### Ручна перевірка:

```bash
# Python
python3 --version  # Має бути >= 3.9

# Node.js
node --version     # Має бути >= 16

# Goose
goose --version    # Або перевірити Desktop app

# Whisper binary (для M1/M2/M3)
./third_party/whisper.cpp.upstream/build/bin/whisper-cli --help

# Whisper модель
ls -lh models/whisper/ggml-large-v3.bin

# PyTorch MPS
python3 -c "import torch; print('MPS available:', torch.backends.mps.is_available())"

# Metal для Whisper
./third_party/whisper.cpp.upstream/build/bin/whisper-cli --help | grep -i metal
```

### Очікувані результати:

```
Python: 3.11.x
Node.js: v20.x.x
Goose: доступний
Whisper binary: виконуваний
Whisper model: ~3GB
PyTorch MPS: True (для M1/M2/M3)
Metal: supported (для M1/M2/M3)
```

---

## 🚀 Запуск системи

### Використання restart_system.sh:

```bash
# Запустити всі сервіси
./restart_system.sh start

# Перевірити статус
./restart_system.sh status

# Переглядати логи в реальному часі
./restart_system.sh logs

# Зупинити систему
./restart_system.sh stop

# Перезапустити
./restart_system.sh restart
```

### Використання Make:

```bash
make start      # Запустити
make status     # Статус
make logs       # Логи
make stop       # Зупинити
make restart    # Перезапустити
```

### Очікуваний вивід при старті:

```
╔════════════════════════════════════════════════════════════════╗
║               ATLAS INTELLIGENT SYSTEM MANAGER                 ║
╚════════════════════════════════════════════════════════════════╝

[INFO] Starting ATLAS system...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Starting Ukrainian TTS Service...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TTS Service started (PID: xxxxx)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Starting Whisper Service...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Whisper Service started (PID: xxxxx)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Starting Orchestrator...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Orchestrator started (PID: xxxxx)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Starting Flask Frontend...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Flask Frontend started (PID: xxxxx)

✅ All services started successfully!

🌐 Access Points:
   • Web Interface:     http://localhost:5001
   • Orchestrator API:  http://localhost:5101
   • Goose Server:      http://localhost:3000
   • TTS Service:       http://localhost:3001
   • Whisper Service:   http://localhost:3002
```

---

## 🛠️ Усунення проблем

### Проблема: Порти зайняті

**Симптом:**
```
[ERROR] Port 5001 is in use
```

**Рішення:**
```bash
# Автоматично звільнити порти
export FORCE_FREE_PORTS=true
./restart_system.sh restart

# Або вручну
lsof -ti:5001,5101,3000,3001,3002 | xargs kill
```

### Проблема: Goose не налаштовано

**Симптом:**
```
[WARN] Goose configuration issues detected
```

**Рішення:**
```bash
# Desktop
/Applications/Goose.app/Contents/MacOS/goose configure

# CLI
goose configure

# Потім перезапустити
./restart_system.sh restart
```

### Проблема: Whisper модель не завантажена

**Симптом:**
```
[ERROR] Whisper model not found
```

**Рішення:**
```bash
mkdir -p models/whisper
cd models/whisper
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
cd ../..
./restart_system.sh restart
```

### Проблема: Python залежності

**Симптом:**
```
ModuleNotFoundError: No module named 'flask'
```

**Рішення:**
```bash
source web/venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
./restart_system.sh restart
```

### Проблема: Node.js залежності

**Симптом:**
```
Error: Cannot find module 'express'
```

**Рішення:**
```bash
npm install
cd config && npm install && cd ..
./restart_system.sh restart
```

### Проблема: Metal GPU не працює

**Симптом:**
```
[WARN] Metal GPU acceleration not available
```

**Рішення (тільки для M1/M2/M3):**
```bash
# Перевірити архітектуру
uname -m  # Має бути arm64

# Переконфігурувати Whisper
cd third_party/whisper.cpp.upstream
rm -rf build
mkdir build
cd build
cmake .. -DWHISPER_METAL=ON -DWHISPER_COREML=ON
make -j$(sysctl -n hw.ncpu)
cd ../../..

# Перевірити Metal підтримку
./third_party/whisper.cpp.upstream/build/bin/whisper-cli --help | grep -i metal

# Перезапустити
./restart_system.sh restart
```

### Проблема: PyTorch MPS не працює

**Симптом:**
```
MPS available: False
```

**Рішення:**
```bash
source web/venv/bin/activate
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio

# Перевірити
python3 -c "import torch; print(torch.backends.mps.is_available())"

deactivate
./restart_system.sh restart
```

### Проблема: Сервіси не запускаються

**Симптом:**
```
[ERROR] Service failed to start
```

**Рішення:**
```bash
# Повна діагностика
./restart_system.sh diagnose

# Переглянути логи
./restart_system.sh logs

# Або окремі логи
tail -f logs/orchestrator.log
tail -f logs/frontend.log
tail -f logs/tts.log
tail -f logs/whisper.log

# Очистити та перезапустити
./restart_system.sh clean
./restart_system.sh restart
```

---

## ⚡ Оптимізація для Apple Silicon

### Whisper.cpp Metal optimization:

```bash
# Компіляція з максимальною оптимізацією
cd third_party/whisper.cpp.upstream
rm -rf build
mkdir build
cd build

# Metal + CoreML + Accelerate framework
cmake .. \
  -DWHISPER_METAL=ON \
  -DWHISPER_COREML=ON \
  -DWHISPER_ACCELERATE=ON \
  -DCMAKE_BUILD_TYPE=Release

make -j$(sysctl -n hw.ncpu)
```

### Конфігурація в .env:

```bash
# Максимальна оптимізація для M1/M2/M3
WHISPER_BACKEND=cpp
WHISPER_DEVICE=metal
WHISPER_CPP_NGL=20        # Metal GPU layers (більше = швидше)
WHISPER_CPP_THREADS=6     # CPU threads для preprocessing

TTS_DEVICE=mps            # Metal Performance Shaders
```

### Перевірка оптимізації:

```bash
# 1. Metal підтримка
./third_party/whisper.cpp.upstream/build/bin/whisper-cli --help | grep -i metal
# Очікується: "use Metal" або подібне

# 2. PyTorch MPS
python3 -c "import torch; print('MPS:', torch.backends.mps.is_available())"
# Очікується: MPS: True

# 3. Процесорна архітектура
node -p "process.arch"
# Очікується: arm64

# 4. Кількість ядер
sysctl -n hw.ncpu
# Використовуйте це значення для WHISPER_CPP_THREADS
```

### Очікувані покращення продуктивності:

- **Whisper transcription:** 15-20x швидше (Metal vs CPU)
- **TTS synthesis:** 5-10x швидше (MPS vs CPU)
- **Beam search:** можливість beam_size >= 5 без затримок
- **48kHz audio:** обробка без downsample
- **Енергоефективність:** 3-5x менше споживання батареї

---

## 📊 Метрики успішної установки

### Checklist:

- [ ] macOS 11.0 або новіше
- [ ] Python 3.9+ встановлено
- [ ] Node.js 16+ встановлено
- [ ] Goose налаштовано
- [ ] Whisper.cpp скомпільовано
- [ ] Whisper Large-v3 модель завантажена (~3GB)
- [ ] Python venv створено та активовано
- [ ] Python залежності встановлено
- [ ] Node.js залежності встановлено
- [ ] Всі директорії створено
- [ ] .env файл налаштовано
- [ ] Metal GPU доступний (для M1/M2/M3)
- [ ] PyTorch MPS працює (для M1/M2/M3)
- [ ] Всі порти вільні (5001, 5101, 3000, 3001, 3002)
- [ ] Система запускається без помилок
- [ ] Веб-інтерфейс доступний

### Команди для швидкої перевірки:

```bash
# Швидкий тест
./verify-fixes.sh

# Повна діагностика
./restart_system.sh diagnose

# Тести
npm test
bash tests/test-all-prompts.sh
bash tests/test-context.sh
```

---

## 📚 Додаткові ресурси

### Документація:

- **README.md** - Загальна інформація
- **docs/ATLAS_SYSTEM_ARCHITECTURE.md** - Архітектура системи
- **.github/copilot-instructions.md** - Правила розробки
- **docs/CONVERSATION_MODE_SYSTEM.md** - Голосове управління

### Конфігурація:

- **config/global-config.js** - Головний конфіг (єдине джерело істини)
- **config/agents-config.js** - Налаштування агентів
- **config/workflow-config.js** - Workflow стадії
- **config/api-config.js** - API endpoints

### Скрипти:

- **restart_system.sh** - Управління системою
- **setup-macos.sh** - Автоматична установка
- **verify-fixes.sh** - Перевірка коректності
- **Makefile** - Make команди

### Тести:

- **tests/test-context.sh** - Тест контексту
- **tests/test-mode-selection.sh** - Тест режимів
- **tests/test-all-prompts.sh** - Тест промптів
- **scripts/validate-prompts.sh** - Валідація

---

## 🎯 Підсумок

### Автоматична установка (рекомендовано):

```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
chmod +x setup-macos.sh
./setup-macos.sh
./restart_system.sh start
```

### Або через Make:

```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
make install
make start
```

### Доступ:

- http://localhost:5001 - Веб-інтерфейс

### Допомога:

```bash
./restart_system.sh help
make help
```

---

**Створено:** 12 жовтня 2025  
**Версія документа:** 1.0  
**ATLAS Version:** 4.0
