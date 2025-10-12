# Goose Installation Fix (2025-10-12, день ~16:00)

## Проблема
Homebrew tap `block/homebrew-goose` недоступний (404 error), що спричиняє помилку автентифікації під час встановлення.

**Симптом:**
```bash
==> Tapping block/goose
Cloning into '/opt/homebrew/Library/Taps/block/homebrew-goose'...
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/block/homebrew-goose/'
Error: Failure while executing; `git clone https://github.com/block/homebrew-goose` exited with 128.
```

## Діагностика

### Перевірка доступності репозиторіїв:
```bash
curl -s -I https://github.com/block/homebrew-goose
# HTTP/2 404 - НЕДОСТУПНИЙ

curl -s -I https://github.com/block/goose
# HTTP/2 200 - ДОСТУПНИЙ
```

### Альтернативні методи встановлення:

1. **PyPI (goose-ai)** - ✅ ДОСТУПНИЙ
   ```bash
   pipx install goose-ai
   ```

2. **Прямі релізи GitHub** - ✅ ДОСТУПНИЙ
   - `goose-aarch64-apple-darwin.tar.bz2` (Apple Silicon)
   - `goose-x86_64-apple-darwin.tar.bz2` (Intel Mac)
   - `Goose_intel_mac.zip` (Desktop версія)

3. **Download CLI script** - ✅ ДОСТУПНИЙ
   ```bash
   curl -sSL https://github.com/block/goose/releases/download/v1.9.3/download_cli.sh | bash
   ```

## Рішення

Оновлено `setup-macos.sh` з кількома методами встановлення:

1. **Пріоритет PyPI** (найнадійніший)
2. **Fallback GitHub releases** (якщо PyPI недоступний)
3. **Manual download instructions** (як останній варіант)

### Структура нової функції `install_goose()`:

```bash
install_goose() {
    # 1. Перевірка Desktop версії (найкраща)
    if [ -x "/Applications/Goose.app/Contents/MacOS/goose" ]; then
        log_success "Goose Desktop already installed"
        return 0
    fi
    
    # 2. Перевірка CLI через команду
    if check_command goose; then
        log_success "Goose CLI already available"
        return 0
    fi
    
    # 3. Встановлення через PyPI (основний метод)
    log_info "Installing Goose via PyPI (pipx)..."
    if ! check_command pipx; then
        brew install pipx
        pipx ensurepath
    fi
    pipx install goose-ai
    
    # 4. Fallback: прямий download
    if ! check_command goose; then
        install_goose_direct
    fi
    
    # 5. Рекомендації для Desktop
    log_warn "For better performance, consider Goose Desktop:"
    log_warn "Download from: https://github.com/block/goose/releases"
}
```

## Переваги нового підходу

1. **Надійність**: PyPI стабільніший за Homebrew taps
2. **Швидкість**: pipx швидший за компіляцію з джерел
3. **Фallback**: кілька опцій якщо один метод не працює
4. **Cross-platform**: PyPI працює на всіх платформах
5. **Автоматичність**: pipx автоматично створює virtual env

## Виправлені файли

- `setup-macos.sh`: повністю переписана функція `install_goose()`
- Додано функцію `install_goose_direct()` для GitHub releases
- Покращене error handling та logging

## Результат

✅ **Успішно виправлено проблему встановлення Goose**

### Виправлений setup script:

1. **Зміна пріоритетів встановлення:**
   - GitHub releases (найнадійніший) → pipx + Python 3.11 → fallback methods
   
2. **Python 3.11 requirement:**
   - Python 3.14 має проблеми сумісності з goose-ai (langfuse.decorators)
   - Python 3.11 стабільніший для goose-ai залежностей
   
3. **Flexible installation:**
   - Спочатку GitHub binary (швидко, без dependency issues)
   - Fallback: pipx з Python 3.11 (стандартний метод)
   - Graceful degradation з чіткими інструкціями

### Протестовано:

```bash
# GitHub binary method (працює)
curl -L https://github.com/block/goose/releases/download/v1.9.3/goose-aarch64-apple-darwin.tar.bz2
goose --version  # 1.9.3 ✅

# PyPI method (потребує Python 3.11)
pipx install --python python3.11 goose-ai  # може мати dependency issues
```

### Оновлені функції в setup-macos.sh:

- `install_goose()`: зміна пріоритету GitHub → pipx
- `install_goose_direct()`: покращена обробка помилок, home/bin fallback
- Python 3.11 requirement доданий

## Тестування

```bash
# Видалити існуючі установки
brew uninstall goose 2>/dev/null || true
pipx uninstall goose-ai 2>/dev/null || true

# Запустити новий setup
./setup-macos.sh

# Перевірити що працює
goose --version
```

## Критично

- **НЕ використовуйте** `brew tap block/goose` - він недоступний
- **Використовуйте** `pipx install goose-ai` як основний метод
- **Завжди** рекомендуйте Desktop версію для кращої продуктивності
- **Додавайте** fallback методи для надійності