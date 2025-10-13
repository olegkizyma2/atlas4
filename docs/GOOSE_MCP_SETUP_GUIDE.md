# 🦢 Налаштування Goose Desktop з MCP Extensions для ATLAS

**Дата створення:** 13 жовтня 2025  
**Автор:** Atlas System  
**Версія:** 1.0.0

---

## 🚨 ПРОБЛЕМА

Тетяна та Гриша **НЕ МАЮТЬ ДОСТУПУ** до реальних інструментів (`developer`, `playwright`, `computercontroller`), бо Goose Desktop **НЕ налаштований з MCP servers**.

### Симптоми:
```
[ТЕТЯНА] "Розумію. У мене немає доступу до розширень..."
[ГРИША] "Інструмент для взаємодії із файловою системою або інтерфейсом 
         (наприклад, developer) недоступний у цій конфігурації."
```

### Корінь проблеми:
- `setup-macos.sh` встановлює Goose Desktop, але **НЕ налаштовує MCP extensions**
- `goose-client.js` відправляє **fake tool responses**, але справжніх tools немає
- Goose працює через WebSocket, але extensions НЕ завантажені

---

## ✅ РІШЕННЯ: Налаштування MCP Extensions

### КРОК 1: Встановити Goose Desktop

```bash
# Якщо ще не встановлено:
brew install --cask goose

# Або завантажити з:
# https://github.com/block/goose/releases
```

### КРОК 2: Створити конфігурацію MCP

Створіть файл `~/.config/goose/config.yaml`:

```yaml
# Goose Desktop Configuration для ATLAS
provider: openai
model: gpt-4o

# GitHub Models API (безкоштовні моделі)
openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com

# MCP Extensions для ATLAS агентів
extensions:
  # Developer Tools (файли, команди, процеси)
  - name: developer
    type: mcp
    config:
      command: npx
      args:
        - -y
        - "@modelcontextprotocol/server-filesystem"
      env:
        ALLOWED_DIRECTORIES: "/Users,/tmp,/Desktop"
    
  # Playwright (браузер automation)
  - name: playwright
    type: mcp
    config:
      command: npx
      args:
        - -y
        - "@executeautomation/playwright-mcp-server"
      env:
        HEADLESS: "false"
    
  # Computer Controller (mouse, keyboard, screenshots)
  - name: computercontroller
    type: mcp
    config:
      command: npx
      args:
        - -y
        - "@anthropic/computer-use"
      env:
        DISPLAY_NUM: ":0"

# Налаштування безпеки
security:
  allow_code_execution: true
  allow_file_access: true
  allow_network_access: true
```

### КРОК 3: Отримати GitHub Token

1. Відкрийте: https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Виберіть scopes:
   - ✅ `read:user`
   - ✅ `read:project`
4. Скопіюйте токен (починається з `ghp_`)

### КРОК 4: Додати токен в environment

```bash
# Додайте до ~/.zshrc або ~/.bash_profile:
export GITHUB_TOKEN="ghp_ВАШ_ТОКЕН_ТУТ"

# Перезавантажте shell:
source ~/.zshrc
```

### КРОК 5: Запустити Goose Desktop

```bash
# Відкрийте Goose Desktop app
open -a Goose

# Або через CLI:
/Applications/Goose.app/Contents/MacOS/goose session start
```

### КРОК 6: Перевірити extensions

В Goose Desktop:

1. Відкрийте Settings → Extensions
2. Переконайтесь що завантажені:
   - ✅ `developer` (file system, shell)
   - ✅ `playwright` (browser automation)
   - ✅ `computercontroller` (desktop control)

---

## 🔍 АЛЬТЕРНАТИВНИЙ МЕТОД: MCP через CLI

Якщо використовуєте Goose CLI (не Desktop):

```bash
# Встановити MCP CLI
npm install -g @modelcontextprotocol/cli

# Запустити з extensions
goose session start --extensions developer,playwright,computercontroller
```

---

## 🧪 ТЕСТУВАННЯ

### Тест 1: Перевірити developer tools

В ATLAS чаті напишіть:
```
"Створи файл test.txt на робочому столі з текстом 'Hello ATLAS'"
```

**Очікуваний результат:**
- ✅ Тетяна використовує `developer__shell` 
- ✅ Файл з'являється на Desktop
- ✅ Немає помилки "інструмент недоступний"

### Тест 2: Перевірити playwright

В ATLAS чаті напишіть:
```
"Відкрий браузер та перейди на google.com"
```

**Очікуваний результат:**
- ✅ Браузер відкривається через Playwright
- ✅ Завантажується Google
- ✅ Тетяна звітує про успіх

### Тест 3: Перевірити computercontroller (для Гріші)

В ATLAS чаті напишіть:
```
"Гриша, зроби скріншот робочого столу"
```

**Очікуваний результат:**
- ✅ Гриша використовує screenshot tool
- ✅ Скріншот збережено
- ✅ Гриша підтверджує виконання

---

## 📊 ДІАГНОСТИКА ПРОБЛЕМ

### Проблема 1: "Tool not available"

**Причина:** MCP server не запущений або не в config  
**Рішення:** 
```bash
# Перевірити Goose config
cat ~/.config/goose/config.yaml

# Перезапустити Goose Desktop
killall Goose
open -a Goose
```

### Проблема 2: "Permission denied"

**Причина:** Відсутні дозволи для extensions  
**Рішення:**
```yaml
# В config.yaml додати:
security:
  allow_code_execution: true
  allow_file_access: true
```

### Проблема 3: "Extension failed to load"

**Причина:** npm package не встановлено  
**Рішення:**
```bash
# Встановити MCP packages глобально:
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @executeautomation/playwright-mcp-server
npm install -g @anthropic/computer-use
```

---

## 🚀 АВТОМАТИЗАЦІЯ

Додайте до `setup-macos.sh`:

```bash
# Функція configure_goose_mcp
configure_goose_mcp() {
    log_step "КРОК X: Налаштування Goose MCP Extensions"
    
    local goose_config="$HOME/.config/goose/config.yaml"
    
    # Створити config з MCP extensions
    cat > "$goose_config" << 'EOF'
provider: openai
model: gpt-4o

openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com

extensions:
  - name: developer
    type: mcp
    config:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem"]
      
  - name: playwright
    type: mcp
    config:
      command: npx
      args: ["-y", "@executeautomation/playwright-mcp-server"]

security:
  allow_code_execution: true
  allow_file_access: true
EOF
    
    log_success "Goose MCP config створено"
    
    # Встановити MCP packages
    log_info "Встановлення MCP extensions..."
    npm install -g @modelcontextprotocol/server-filesystem \
                   @executeautomation/playwright-mcp-server
    
    log_success "MCP extensions встановлено"
}
```

---

## 📝 КРИТИЧНІ МОМЕНТИ

1. ✅ **Goose Desktop > CLI** - Desktop версія має кращу підтримку MCP
2. ✅ **GitHub Token обов'язковий** - без нього не працює API
3. ✅ **Extensions MUST бути в config.yaml** - інакше tools не завантажаться
4. ✅ **Перезапуск після змін** - config читається тільки при старті
5. ✅ **ATLAS очікує WebSocket** - НЕ HTTP API, тільки WS на port 3000

---

## 🔗 КОРИСНІ ПОСИЛАННЯ

- Goose Desktop: https://github.com/block/goose
- MCP Protocol: https://modelcontextprotocol.io
- GitHub Models: https://github.com/marketplace/models
- MCP Servers: https://github.com/modelcontextprotocol

---

## ✅ ЧЕКЛИСТ

- [ ] Goose Desktop встановлено
- [ ] GitHub Token створено і додано в `.zshrc`
- [ ] `~/.config/goose/config.yaml` створено з extensions
- [ ] MCP npm packages встановлено глобально
- [ ] Goose Desktop перезапущено
- [ ] Extensions відображаються в Settings
- [ ] Тестове завдання (створити файл) працює
- [ ] ATLAS бачить tools (перевірити логи `[GOOSE] Tool request:`)

---

**Після виконання цих кроків Тетяна зможе:**
- ✅ Створювати/редагувати файли через `developer__shell`
- ✅ Відкривати браузер через `playwright__browser_open`
- ✅ Виконувати команди через `developer__shell`

**Гриша зможе:**
- ✅ Робити скріншоти через `computercontroller`
- ✅ Перевіряти файли через `developer__shell`
- ✅ Верифікувати результати

🚀 **Після налаштування система стане ПОВНІСТЮ функціональною!**
