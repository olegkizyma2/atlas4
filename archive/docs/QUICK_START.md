# ATLAS v4.0 - Quick Start Guide

## 🚀 Установка за 3 команди

```bash
git clone https://github.com/olegkizyma2/atlas4.git
cd atlas4
chmod +x setup-macos.sh && ./setup-macos.sh
```

## 📋 Після установки

```bash
# Запустити систему
./restart_system.sh start

# Перевірити статус
./restart_system.sh status

# Переглядати логи
./restart_system.sh logs
```

## 🌐 Доступ до системи

- **Веб-інтерфейс:** http://localhost:5001
- **Orchestrator API:** http://localhost:5101
- **Goose Server:** http://localhost:3000
- **TTS Service:** http://localhost:3001
- **Whisper Service:** http://localhost:3002

## 🎮 Основні команди

```bash
# Управління системою
./restart_system.sh start      # Запустити
./restart_system.sh stop       # Зупинити
./restart_system.sh restart    # Перезапустити
./restart_system.sh status     # Статус
./restart_system.sh logs       # Логи
./restart_system.sh diagnose   # Діагностика
./restart_system.sh help       # Допомога

# Make команди (альтернатива)
make start                     # Запустити
make stop                      # Зупинити
make status                    # Статус
make logs                      # Логи
make help                      # Всі команди
```

## 🔧 Усунення проблем

### Порти зайняті:
```bash
export FORCE_FREE_PORTS=true
./restart_system.sh restart
```

### Goose не налаштовано:
```bash
goose configure
# або для Desktop:
/Applications/Goose.app/Contents/MacOS/goose configure
```

### Whisper модель відсутня:
```bash
mkdir -p models/whisper
cd models/whisper
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
cd ../..
```

### Python залежності:
```bash
source web/venv/bin/activate
pip install -r requirements.txt
deactivate
```

## 📊 Перевірка установки

```bash
# Швидка перевірка
./restart_system.sh diagnose

# Тести
npm test
bash tests/test-all-prompts.sh
bash tests/test-context.sh
```

## 💡 Корисні поради

### Для Apple Silicon (M1/M2/M3):
- ✅ Metal GPU автоматично активований
- ✅ MPS для TTS (5-10x швидше)
- ✅ Whisper Metal (15-20x швидше)
- ✅ 48kHz аудіо без downsample

### Перевірка оптимізації:
```bash
# Metal підтримка
./third_party/whisper.cpp.upstream/build/bin/whisper-cli --help | grep -i metal

# PyTorch MPS
python3 -c "import torch; print('MPS:', torch.backends.mps.is_available())"

# Архітектура
node -p "process.arch"  # arm64 для M1/M2/M3
```

## 📚 Додатково

- **Повний гід:** [docs/MACOS_DEPLOYMENT_GUIDE.md](docs/MACOS_DEPLOYMENT_GUIDE.md)
- **Архітектура:** [docs/ATLAS_SYSTEM_ARCHITECTURE.md](docs/ATLAS_SYSTEM_ARCHITECTURE.md)
- **Розробка:** [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **README:** [README.md](README.md)

## 🆘 Потрібна допомога?

```bash
./restart_system.sh help
make help
```

---

**ATLAS v4.0** - Adaptive Task and Learning Assistant System  
**Платформа:** macOS 11.0+ (Big Sur or newer)  
**Дата:** 12 жовтня 2025
