#!/bin/bash

#
# PROJECT STRUCTURE MANAGEMENT
# Скрипт для реорганізації структури проєкту ATLAS
#

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Перевірка що ми в корені проєкту
if [ ! -f "config/global-config.js" ]; then
    echo -e "${RED}❌ Помилка: Запустіть скрипт з кореня проєкту ATLAS${NC}"
    exit 1
fi

print_info "🗂️ Реорганізація структури проєкту ATLAS для чищого кореня"

# Створюємо необхідні директорії якщо не існують
create_directories() {
    print_info "📁 Створюємо структуру директорій..."
    
    mkdir -p docs/configuration docs/voice docs/testing \
             scripts/deployment scripts/maintenance \
             tests/html services/tts services/whisper \
             data/models data/audio backup
    
    print_success "Директорії створені"
}

# Переміщення документації
move_documentation() {
    print_info "📄 Переміщуємо документацію..."
    
    # Конфігураційна документація
    [ -f "CONFIG_MANAGEMENT.md" ] && mv "CONFIG_MANAGEMENT.md" "docs/configuration/"
    
    # Голосова документація  
    [ -f "VOICE_CONTROL_GUIDE.md" ] && mv "VOICE_CONTROL_GUIDE.md" "docs/voice/"
    [ -f "README_whisper_backends.md" ] && mv "README_whisper_backends.md" "docs/voice/"
    
    # Звіти
    [ -f "MODERNIZATION_REPORT.md" ] && mv "MODERNIZATION_REPORT.md" "docs/"
    
    print_success "Документація переміщена"
}

# Переміщення тестових файлів
move_test_files() {
    print_info "🧪 Переміщуємо тестові файли..."
    
    [ -f "test_atlas_voice.html" ] && mv "test_atlas_voice.html" "tests/html/"
    [ -f "test_phrase_filter.html" ] && mv "test_phrase_filter.html" "tests/html/"
    [ -f "test_voice_system.html" ] && mv "test_voice_system.html" "tests/html/"
    
    print_success "Тестові файли переміщені"
}

# Переміщення сервісів
move_services() {
    print_info "⚙️ Переміщуємо сервіси..."
    
    [ -f "whisper_service.py" ] && mv "whisper_service.py" "services/whisper/"
    [ -f "whispercpp_service.py" ] && mv "whispercpp_service.py" "services/whisper/"
    [ -f "hello_atlas.py" ] && mv "hello_atlas.py" "services/"
    
    print_success "Сервіси переміщені"
}

# Переміщення даних та моделей
move_data_files() {
    print_info "💾 Переміщуємо дані та моделі..."
    
    [ -f "model.pth" ] && mv "model.pth" "data/models/"
    [ -f "feats_stats.npz" ] && mv "feats_stats.npz" "data/models/"
    [ -f "spk_xvector.ark" ] && mv "spk_xvector.ark" "data/models/"
    [ -f "silence_0_4s.wav" ] && mv "silence_0_4s.wav" "data/audio/"
    
    print_success "Дані та моделі переміщені"
}

# Переміщення скриптів
move_scripts() {
    print_info "📜 Переміщуємо скрипти..."
    
    [ -f "update-configs.sh" ] && mv "update-configs.sh" "scripts/maintenance/"
    
    print_success "Скрипти переміщені"
}

# Оновлення шляхів в конфігураціях
update_paths() {
    print_info "🔄 Оновлюємо шляхи в конфігураціях..."
    
    # Оновити package.json якщо потрібно
    if [ -f "package.json" ]; then
        sed -i.bak 's|"update-configs.sh"|"scripts/maintenance/update-configs.sh"|g' package.json
        rm -f package.json.bak
    fi
    
    # Оновити README.md посилання
    if [ -f "README.md" ]; then
        sed -i.bak 's|CONFIG_MANAGEMENT\.md|docs/configuration/CONFIG_MANAGEMENT.md|g' README.md
        sed -i.bak 's|VOICE_CONTROL_GUIDE\.md|docs/voice/VOICE_CONTROL_GUIDE.md|g' README.md
        rm -f README.md.bak
    fi
    
    print_success "Шляхи оновлені"
}

# Створення індексів директорій
create_indexes() {
    print_info "📋 Створюємо індекси директорій..."
    
    # Індекс документації
    cat > docs/README.md << 'EOF'
# 📚 ATLAS Documentation

## 📁 Структура документації:

- **configuration/** - Документація системи конфігурацій
- **voice/** - Документація голосового управління
- **testing/** - Тестування та QA
- **MODERNIZATION_REPORT.md** - Звіт про модернізацію системи

## 🔗 Швидкі посилання:

- [Система конфігурацій](configuration/CONFIG_MANAGEMENT.md)
- [Голосове управління](voice/VOICE_CONTROL_GUIDE.md)  
- [Whisper backends](voice/README_whisper_backends.md)
EOF

    # Індекс тестів
    cat > tests/README.md << 'EOF'
# 🧪 ATLAS Tests

## 📁 Структура тестів:

- **html/** - HTML тестові сторінки
- **config/** - Тести конфігураційної системи (в config/test-config.js)

## 🔬 Доступні тести:

### HTML тести:
- `html/test_atlas_voice.html` - Тестування голосової системи Atlas
- `html/test_phrase_filter.html` - Тестування фільтра фраз
- `html/test_voice_system.html` - Загальне тестування голосового управління

### Автоматичні тести:
- Запустіть: `cd config && npm test`
EOF

    # Індекс сервісів
    cat > services/README.md << 'EOF'
# ⚙️ ATLAS Services

## 📁 Структура сервісів:

- **tts/** - Text-to-Speech сервіси
- **whisper/** - Whisper транскрипційні сервіси
- **hello_atlas.py** - Простий тестовий сервіс

## 🚀 Запуск сервісів:

### Whisper сервіси:
```bash
python3 services/whisper/whisper_service.py
python3 services/whisper/whispercpp_service.py
```

### TTS сервіс:
Дивись ukrainian-tts/ директорію
EOF

    # Індекс даних
    cat > data/README.md << 'EOF'
# 💾 ATLAS Data

## 📁 Структура даних:

- **models/** - Машинні навчання моделі
- **audio/** - Аудіо файли та ресурси

## 📊 Файли моделей:

- `models/model.pth` - Основна модель
- `models/feats_stats.npz` - Статистики характеристик
- `models/spk_xvector.ark` - Speaker x-vectors

## 🔊 Аудіо ресурси:

- `audio/silence_0_4s.wav` - Файл тиші (0.4 секунди)
EOF

    print_success "Індекси створені"
}

# Основна функція
main() {
    case "${1:-all}" in
        "directories")
            create_directories
            ;;
        "docs")
            create_directories
            move_documentation
            ;;
        "tests")
            create_directories
            move_test_files
            ;;
        "services")
            create_directories
            move_services
            ;;
        "data")
            create_directories
            move_data_files
            ;;
        "scripts")
            create_directories
            move_scripts
            ;;
        "paths")
            update_paths
            ;;
        "indexes")
            create_indexes
            ;;
        "all")
            create_directories
            move_documentation
            move_test_files
            move_services
            move_data_files
            move_scripts
            update_paths
            create_indexes
            ;;
        "status")
            print_info "📊 Поточна структура кореня:"
            ls -la | head -20
            ;;
        *)
            echo "Використання: $0 [directories|docs|tests|services|data|scripts|paths|indexes|all|status]"
            echo ""
            echo "Команди:"
            echo "  directories  - Створити структуру директорій"
            echo "  docs        - Перемістити документацію"
            echo "  tests       - Перемістити тести"
            echo "  services    - Перемістити сервіси"
            echo "  data        - Перемістити дані та моделі"
            echo "  scripts     - Перемістити скрипти"
            echo "  paths       - Оновити шляхи в файлах"
            echo "  indexes     - Створити індекси директорій"
            echo "  all         - Виконати всі операції"
            echo "  status      - Показати поточну структуру"
            ;;
    esac
}

main "$@"
