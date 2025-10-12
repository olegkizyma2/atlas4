# Goose + GitHub Models Integration

**Date:** 12 жовтня 2025, вечір ~21:00  
**Provider:** GitHub Models (безкоштовний доступ до AI моделей)

---

## 🎯 Що змінилось

ATLAS тепер використовує **GitHub Models API** замість OpenRouter/OpenAI:

- ✅ **Безкоштовний доступ** до GPT-4o, Llama, Mistral та інших моделей
- ✅ **Через GitHub Token** (не потрібні окремі API ключі)
- ✅ **58+ моделей** доступні одразу
- ✅ **Інтеграція з GitHub** workflow

---

## 🚀 Швидкий старт

### 1. Отримати GitHub Token

```bash
# Відкрити в браузері
open https://github.com/settings/tokens

# Або вручну:
# 1. GitHub Settings → Developer settings → Personal access tokens
# 2. Generate new token (classic)
# 3. Виберіть scopes:
#    ✓ read:user
#    ✓ read:project
# 4. Generate → Скопіюйте token (ghp_...)
```

### 2. Налаштувати Goose

**Варіант A: Інтерактивний скрипт (РЕКОМЕНДОВАНО)**
```bash
./scripts/configure-goose.sh
```

**Варіант B: Вручну**
```bash
# Додати token в environment
export GITHUB_TOKEN='ghp_...'
echo 'export GITHUB_TOKEN="ghp_..."' >> ~/.zshrc
source ~/.zshrc

# Config створюється автоматично при ./setup-macos.sh
# Або вручну:
mkdir -p ~/.config/goose
cat > ~/.config/goose/config.yaml << 'EOF'
provider: openai
model: gpt-4o

openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com
EOF
```

### 3. Перевірити конфігурацію

```bash
# Перевірити token
echo $GITHUB_TOKEN
# Має показати: ghp_...

# Перевірити config
cat ~/.config/goose/config.yaml
# Має містити: provider: openai, base_url: ...azure.com

# Тест Goose
goose run 'echo Hello from GitHub Models'
```

### 4. Запустити ATLAS

```bash
./restart_system.sh start
```

---

## 📊 Доступні моделі

GitHub Models надає безкоштовний доступ до:

### OpenAI Models:
- **gpt-4o** - найновіша GPT-4 Omni (рекомендовано)
- **gpt-4o-mini** - швидка версія GPT-4o
- **gpt-4-turbo** - GPT-4 Turbo

### Meta Llama Models:
- **Meta-Llama-3.1-405B-Instruct** - найбільша Llama модель
- **Meta-Llama-3.1-70B-Instruct**
- **Meta-Llama-3.1-8B-Instruct**
- **Llama-3.2-90B-Vision-Instruct** - з vision
- **Llama-3.2-11B-Vision-Instruct**

### Mistral Models:
- **Mistral-large-2407**
- **Mistral-large**
- **Mistral-Nemo**
- **Mistral-small**

### Microsoft Phi Models:
- **Phi-3.5-mini-instruct**
- **Phi-3.5-MoE-instruct**

### Cohere Models:
- **Cohere-command-r-plus**
- **Cohere-command-r**

### AI21 Jamba Models:
- **AI21-Jamba-1.5-Large**
- **AI21-Jamba-1.5-Mini**

**Повний список:** https://github.com/marketplace/models

---

## ⚙️ Конфігурація

### Структура config файлу

```yaml
# ~/.config/goose/config.yaml

provider: openai  # GitHub Models використовує OpenAI-compatible API
model: gpt-4o     # Модель за замовчуванням

openai:
  api_key: ${GITHUB_TOKEN}  # GitHub Token з environment
  base_url: https://models.inference.ai.azure.com  # GitHub Models endpoint
```

### Зміна моделі

Відредагуйте `~/.config/goose/config.yaml`:

```yaml
# Швидка модель
model: gpt-4o-mini

# Потужна модель
model: Meta-Llama-3.1-405B-Instruct

# Mistral
model: Mistral-large-2407
```

Або через environment variable:
```bash
export GOOSE_MODEL='Meta-Llama-3.1-70B-Instruct'
```

---

## 🔒 Безпека

### ✅ Що РОБИТИ:
- ✅ Зберігайте `GITHUB_TOKEN` в environment variables
- ✅ Додайте `.env` до `.gitignore` (вже додано)
- ✅ Використовуйте tokens з обмеженими scopes (read:user, read:project)
- ✅ Регулярно оновлюйте tokens

### ❌ Що НЕ РОБИТИ:
- ❌ НЕ комітьте tokens в Git
- ❌ НЕ діліться tokens публічно
- ❌ НЕ використовуйте tokens з широкими scopes (repo, admin)
- ❌ НЕ hardcode tokens в коді

---

## 🧪 Тестування

### Базова перевірка:
```bash
# 1. Token в environment
[ -n "$GITHUB_TOKEN" ] && echo "✅ Token є" || echo "❌ Token відсутній"

# 2. Config існує
[ -f ~/.config/goose/config.yaml ] && echo "✅ Config є" || echo "❌ Config відсутній"

# 3. Goose доступний
command -v goose &> /dev/null && echo "✅ Goose є" || echo "❌ Goose відсутній"

# 4. Тест виклику
goose run 'echo Test successful'
```

### Тест різних моделей:
```bash
# GPT-4o
goose run 'echo "Testing GPT-4o"'

# Llama 3.1
GOOSE_MODEL='Meta-Llama-3.1-70B-Instruct' goose run 'echo "Testing Llama"'

# Mistral
GOOSE_MODEL='Mistral-large-2407' goose run 'echo "Testing Mistral"'
```

---

## 📚 Документація

### ATLAS Docs:
- `docs/GOOSE_CONFIGURATION_FIX_2025-10-12.md` - original fix
- `docs/COMPLETE_SETUP_FIX_2025-10-12.md` - повний setup guide
- `.github/copilot-instructions.md` - Copilot інструкції

### GitHub Models:
- **Marketplace:** https://github.com/marketplace/models
- **API Docs:** https://docs.github.com/en/github-models
- **Rate Limits:** https://docs.github.com/en/github-models/prototyping-with-ai-models

### Goose AI:
- **GitHub:** https://github.com/block/goose
- **Docs:** https://block.github.io/goose/

---

## ❓ FAQ

**Q: Чому GitHub Models замість OpenRouter/OpenAI?**  
A: Безкоштовний доступ до GPT-4o та інших топ моделей через один GitHub Token.

**Q: Які ліміти використання?**  
A: GitHub Models має rate limits для безкоштовних акаунтів. Детальніше: https://docs.github.com/en/github-models/prototyping-with-ai-models

**Q: Чи можна повернутись на OpenRouter?**  
A: Так, відредагуйте `~/.config/goose/config.yaml` або запустіть `goose configure`.

**Q: Чи працює з GitHub Actions?**  
A: Так, використовуйте `secrets.GITHUB_TOKEN` в workflows.

**Q: Що робити якщо token expired?**  
A: Згенеруйте новий token на https://github.com/settings/tokens та оновіть environment.

---

**Готово! ATLAS тепер працює з GitHub Models! 🚀**
