# Goose Configuration Fix

**Date:** 12 жовтня 2025, вечір ~20:45  
**Status:** ✅ FIXED  
**Impact:** Critical - Goose required for ATLAS task execution

---

## 🎯 Проблема

**Симптом:**
```
[ERROR] Goose process died during startup
[ERROR] Last log lines:
  No provider configured. Run 'goose configure' first
```

**Деталі:**
- Goose запускався але одразу крашився
- Provider НЕ налаштований (немає API ключа)
- Користувач НЕ знав як налаштувати Goose
- Setup script НЕ створював автоматичну конфігурацію

---

## 🔍 Корінь проблеми

### 1. **Відсутня автоматична конфігурація**
Setup script перевіряв тільки існування `config.yaml`, але НЕ перевіряв чи provider налаштований.

### 2. **Немає інструкцій для користувача**
Користувач отримував помилку, але НЕ знав:
- Які providers підтримуються
- Де отримати API ключ
- Як налаштувати через environment variables

### 3. **Немає швидкого способу налаштування**
Тільки інтерактивний `goose configure`, що не зручно для автоматизації.

---

## ✅ Рішення

### 1. **Покращена функція setup** (setup-macos.sh)

```bash
# Перевірка чи provider налаштований
if grep -q "provider:" "$HOME/.config/goose/config.yaml" 2>/dev/null; then
    log_success "Goose вже налаштовано"
    return 0
fi

# Створити базовий config з OpenRouter
cat > "$HOME/.config/goose/config.yaml" << 'GOOSE_CONFIG'
provider: openrouter
model: openai/gpt-4o-mini

openrouter:
  api_key: ${OPENROUTER_API_KEY}
  base_url: https://openrouter.ai/api/v1
GOOSE_CONFIG

# Перевірка API ключа в environment
if [ -n "$OPENROUTER_API_KEY" ]; then
    log_success "✅ OPENROUTER_API_KEY знайдено"
else
    log_warn "⚠️  Додайте API ключ:"
    log_warn "   export OPENROUTER_API_KEY='your-key-here'"
fi
```

**Переваги:**
- ✅ Автоматично створює конфігурацію
- ✅ Підтримує environment variables
- ✅ Дає чіткі інструкції користувачу

### 2. **Швидкий скрипт конфігурації** (scripts/configure-goose.sh)

```bash
#!/bin/bash
# Інтерактивне налаштування Goose з вибором provider

# 1. Створює config.yaml
# 2. Перевіряє API ключі
# 3. Пропонує додати ключ інтерактивно
# 4. Автоматично оновлює ~/.zshrc
```

**Можливості:**
- ✅ Вибір provider (OpenRouter/OpenAI/Anthropic)
- ✅ Інтерактивне додавання API ключа
- ✅ Автоматичне оновлення shell config
- ✅ Перевірка існуючої конфігурації

### 3. **Підтримка трьох providers**

**OpenRouter (рекомендовано):**
```bash
export OPENROUTER_API_KEY='sk-or-v1-...'
# Отримати: https://openrouter.ai/keys
# Переваги: Підтримка багатьох моделей, один API ключ
```

**OpenAI:**
```bash
export OPENAI_API_KEY='sk-...'
# Отримати: https://platform.openai.com/api-keys
# Переваги: Нативна підтримка, GPT-4
```

**Anthropic Claude:**
```bash
export ANTHROPIC_API_KEY='sk-ant-...'
# Отримати: https://console.anthropic.com/
# Переваги: Claude 3 Opus, довгий контекст
```

---

## 📊 Результат

### До виправлення:
- ❌ Goose крашився без provider
- ❌ Користувач НЕ знав як налаштувати
- ❌ Немає автоматичної конфігурації
- ❌ Немає інструкцій

### Після виправлення:
- ✅ Setup автоматично створює config
- ✅ Чіткі інструкції для API ключа
- ✅ Швидкий скрипт конфігурації
- ✅ Підтримка 3 providers
- ✅ Environment variables support

---

## 🧪 Тестування

### Автоматична конфігурація (через setup):
```bash
# Встановити API ключ
export OPENROUTER_API_KEY='your-key-here'

# Запустити setup
./setup-macos.sh

# Setup автоматично створить config
```

### Інтерактивна конфігурація:
```bash
# Запустити швидкий скрипт
./scripts/configure-goose.sh

# Вибрати provider
# Ввести API ключ
# Готово!
```

### Перевірка конфігурації:
```bash
# Показати config
cat ~/.config/goose/config.yaml

# Тест Goose
goose run 'echo Hello from Goose'

# Запустити ATLAS
./restart_system.sh start
```

---

## 🎯 Критичні правила

### ✅ ЗАВЖДИ:
1. **Налаштуйте provider** перед запуском ATLAS
2. **Використовуйте environment variables** для API ключів (НЕ hardcode!)
3. **Перевіряйте config** після setup: `cat ~/.config/goose/config.yaml`

### 🔒 БЕЗПЕКА:
1. **НЕ комітьте API ключі** в Git
2. **Використовуйте .env файли** для локальних ключів
3. **Додавайте до .gitignore**: `.env`, `*.key`

### 📝 РЕКОМЕНДАЦІЇ:
1. **OpenRouter** - найкращий вибір для ATLAS (багато моделей)
2. **Додайте ключ в ~/.zshrc** для постійного використання
3. **Тестуйте Goose** перед запуском ATLAS

---

## 📝 Виправлені файли

1. **setup-macos.sh** - функція налаштування Goose (КРОК 14)
   - Автоматичне створення config
   - Перевірка provider
   - Інструкції для API ключа

2. **scripts/configure-goose.sh** - NEW інтерактивний скрипт
   - Вибір provider
   - Додавання API ключа
   - Оновлення shell config

---

## 🚀 Швидкий старт

### Якщо Goose НЕ налаштований:

```bash
# Варіант 1: Швидкий інтерактивний скрипт
./scripts/configure-goose.sh

# Варіант 2: Вручну
export OPENROUTER_API_KEY='your-key-here'
echo 'export OPENROUTER_API_KEY="your-key-here"' >> ~/.zshrc
./setup-macos.sh  # Автоматично створить config

# Варіант 3: Офіційний Goose CLI
goose configure
```

### Після налаштування:

```bash
# Перезавантажити shell
source ~/.zshrc

# Запустити ATLAS
./restart_system.sh start
```

---

## ❓ FAQ

**Q: Який provider вибрати?**  
A: OpenRouter - підтримує багато моделей, один API ключ, доступні ціни.

**Q: Де зберігається конфігурація?**  
A: `~/.config/goose/config.yaml` - стандартне місце для Goose.

**Q: Як змінити provider?**  
A: Відредагуйте `~/.config/goose/config.yaml` або запустіть `./scripts/configure-goose.sh`

**Q: Чи потрібен API ключ для розробки?**  
A: Так, Goose використовується для task execution в ATLAS.

**Q: Скільки коштує API?**  
A: OpenRouter: від $0.001 за 1K токенів. OpenAI: від $0.01 за 1K токенів.

---

**Статус:** ✅ Production Ready  
**Тестування:** ✅ Перевірено з OpenRouter  
**Документація:** ✅ Повна інструкція в цьому файлі
