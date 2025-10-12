# ATLAS v4.0 - Goose Installation Fix Summary
**Fixed:** 12 жовтня 2025, день ~16:00

## Проблема що була вирішена
Користувач отримував помилку автентифікації при встановленні Goose через setup-macos.sh:
```bash
==> Tapping block/goose
Cloning into '/opt/homebrew/Library/Taps/block/homebrew-goose'...
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/block/homebrew-goose/'
Error: Failure while executing; `git clone https://github.com/block/homebrew-goose` exited with 128.
```

## Корінь проблеми
Homebrew tap `block/homebrew-goose` був видалений або переміщений (HTTP 404), що робило встановлення неможливим.

## Вирішення

### 1. Діагностика доступності
- ❌ `https://github.com/block/homebrew-goose` → 404 NOT FOUND
- ✅ `https://github.com/block/goose` → 200 OK
- ✅ `https://pypi.org/project/goose-ai/` → доступний
- ✅ GitHub releases → `goose-aarch64-apple-darwin.tar.bz2` доступний

### 2. Нова стратегія встановлення

**Старий порядок (НЕ працював):**
1. Desktop → CLI через команду → Homebrew tap + install

**Новий порядок (ПРАЦЮЄ):**
1. Desktop → CLI через команду → **GitHub binary** → pipx + Python 3.11 → manual

### 3. Ключові виправлення

#### A. Функція `install_goose()`:
- Зміна пріоритету: GitHub releases ПЕРЕД PyPI
- Python 3.11 requirement (Python 3.14 має dependency conflicts)
- Покращене error handling з fallbacks

#### B. Функція `install_goose_direct()`:
- Автоматичне визначення архітектури (arm64/x86_64)
- Fallback з sudo на home/bin якщо sudo недоступний
- Автоматичне додавання до PATH

#### C. Python compatibility fix:
- Python 3.14 → `ModuleNotFoundError: No module named 'langfuse.decorators'`
- Python 3.11 → стабільно працює з goose-ai

## Результати тестування

### GitHub Binary Method (ПРАЦЮЄ ✅):
```bash
curl -L https://github.com/block/goose/releases/download/v1.9.3/goose-aarch64-apple-darwin.tar.bz2
tar -xjf goose-aarch64-apple-darwin.tar.bz2
./goose --version  # 1.9.3
```

### PyPI Method (з обмеженнями):
```bash
# ❌ НЕ працює з Python 3.14
pipx install goose-ai  # dependency errors

# ✅ Працює з Python 3.11
pipx install --python python3.11 goose-ai
```

## Виправлені файли

1. **`setup-macos.sh`:**
   - `install_goose()` функція повністю переписана
   - `install_goose_direct()` додана нова функція
   - Python 3.11 requirement додано

2. **`docs/GOOSE_INSTALLATION_FIX_2025-10-12.md`:**
   - Повна документація проблеми та рішення

3. **`.github/copilot-instructions.md`:**
   - Додано до ключових особливостей системи

## Для майбутнього

### Рекомендації користувачам:
1. **Найкращий варіант:** Goose Desktop з https://github.com/block/goose/releases
2. **CLI варіант:** GitHub binary через setup-macos.sh 
3. **Розробка:** pipx з Python 3.11

### Критичні правила:
- ❌ НЕ використовуйте `brew tap block/goose`
- ✅ ЗАВЖДИ Python 3.11 для goose-ai
- ✅ GitHub releases надійніші за PyPI для цього пакунку
- ✅ Тестуйте setup script на чистій системі

## Статус
**✅ ВИРІШЕНО ПОВНІСТЮ** - setup-macos.sh тепер встановлює Goose без помилок автентифікації.