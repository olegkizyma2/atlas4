#!/bin/bash

#
# ATLAS CONFIG UPDATE SCRIPT
# Скрипт для оновлення конфігурацій ATLAS системи
#

set -e  # Вихід при першій помилці

# Кольори для виводу
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функції виводу
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Перевірка чи знаходимося в правильній директорії
if [ ! -f "config/global-config.js" ]; then
    print_error "Глобальна конфігурація не знайдена. Переконайтесь що ви в корені проєкту ATLAS."
    exit 1
fi

print_info "🚀 Оновлення конфігурацій ATLAS системи"

# Перевірка та встановлення залежностей
if [ ! -d "config/node_modules" ]; then
    print_info "📦 Встановлюємо залежності для config manager..."
    cd config
    npm install --silent
    cd ..
    print_success "Залежності встановлені"
fi

# Опції командного рядка
BACKUP=false
FORCE=false
WATCH=false
VALIDATE=false

# Парсинг аргументів
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup)
            BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --status)
            print_info "📊 Статус конфігурацій:"
            node config/config-cli.js status --verbose
            exit 0
            ;;
        --help|-h)
            echo "Використання: $0 [опції]"
            echo ""
            echo "Опції:"
            echo "  --backup     Створити backup перед синхронізацією"
            echo "  --force      Форсувати синхронізацію"
            echo "  --watch      Запустити спостереження за змінами"
            echo "  --validate   Тільки валідувати без синхронізації"
            echo "  --status     Показати статус конфігурацій"
            echo "  --help       Показати цю довідку"
            exit 0
            ;;
        *)
            print_error "Невідома опція: $1"
            echo "Використайте --help для довідки"
            exit 1
            ;;
    esac
done

# Валідація
if [ "$VALIDATE" = true ]; then
    print_info "🔍 Валідація глобальної конфігурації..."
    node config/config-cli.js validate --strict
    exit 0
fi

# Backup
if [ "$BACKUP" = true ]; then
    print_info "📦 Створюємо backup поточних конфігурацій..."
    BACKUP_PATH=$(node config/config-cli.js backup | grep "Шлях:" | cut -d' ' -f3)
    print_success "Backup створено: $BACKUP_PATH"
fi

# Синхронізація
if [ "$FORCE" = true ]; then
    print_info "🔄 Форсована синхронізація всіх конфігурацій..."
    node config/config-cli.js sync --force
else
    print_info "🔄 Синхронізація конфігурацій..."
    node config/config-cli.js sync
fi

print_success "Конфігурації оновлені успішно!"

# Спостереження за змінами
if [ "$WATCH" = true ]; then
    print_info "👁️  Запускаємо спостереження за змінами..."
    print_info "Натисніть Ctrl+C для зупинки"
    node config/config-cli.js watch
fi

# Підсумок
print_info "📋 Поточний статус:"
node config/config-cli.js status

print_success "🎉 Оновлення конфігурацій завершено!"
print_info "💡 Додаткові команди:"
print_info "   ./update-configs.sh --status    # Статус конфігурацій"
print_info "   ./update-configs.sh --watch     # Автоматичне спостереження"  
print_info "   ./update-configs.sh --validate  # Валідація без змін"
