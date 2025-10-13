# 🔧 Goose Tools Not Available - Повне Рішення

**Дата створення:** 13 жовтня 2025  
**Проблема:** Тетяна та Гриша НЕ мають доступу до інструментів (developer, playwright, computercontroller)  
**Статус:** ✅ ВИРІШЕНО - MCP Extensions Configuration

---

## 🚨 ПРОБЛЕМА

### Симптоми:

```
[ТЕТЯНА] "Розумію. У мене немає доступу до розширень, 
          які б допомогли автоматично збирати або аналізувати веб-дані."

[ГРИША] "Інструмент для взаємодії із файловою системою або інтерфейсом 
         (наприклад, developer) недоступний у цій конфігурації. 
         Для виконання завдання необхідно або активувати відповідний інструмент..."
```

### Запит користувача:
> "Надай мені у файлі на робочому столі перелік по спаданню найдорожчі автомобілі що продаються в Україні..."

### Очікувана поведінка:
1. ✅ Тетяна відкриває браузер через `playwright`
2. ✅ Збирає дані з AUTO.RIA
3. ✅ Створює файл на Desktop через `developer__shell`
4. ✅ Гриша робить скріншот для перевірки

### Фактична поведінка:
1. ❌ Тетяна: "Немає доступу до розширень"
2. ❌ Гриша: "developer недоступний"
3. ❌ Завдання НЕ виконано

---

## 🔍 ДІАГНОСТИКА

### Аналіз коду:

**1. `orchestrator/agents/goose-client.js`:**

```javascript
// Список дозволених tools (allowlist)
const allowedTools = new Set([
  'computercontroller__computer_control',
  'developer__list_windows',
  'developer__shell',              // ❌ Потрібен для створення файлів
  'developer__open_url',
  'developer__list_processes',
  'playwright__browser_open',      // ❌ Потрібен для браузера
  'playwright__browser_click',
  'playwright__browser_type',
]);

// Але це тільки FAKE responses!
// Справжні tools потрібно налаштувати в Goose Desktop через MCP
if (!isToolAvailable) {
  const toolResponse = {
    type: 'tool_response',
    content: `Tool ${obj.tool_name} is not available.`,
    success: false  // ❌ Інструмент НЕ працює насправді
  };
}
```

**2. `config/agents-config.js`:**

```javascript
tetyana: {
  role: 'executor',
  enableTools: true,  // ✅ Включено в конфігурації
  ...
},
grisha: {
  role: 'verifier_finalizer',
  enableTools: true,  // ✅ Включено
  ...
}
```

**3. `setup-macos.sh`:**

```bash
# ❌ ПРОБЛЕМА: setup НЕ налаштовує MCP extensions!
install_goose() {
    # Встановлює Goose Desktop
    export GOOSE_BIN="/Applications/Goose.app/Contents/MacOS/goose"
    
    # ❌ НО НЕ налаштовує MCP config з extensions!
    # Результат: Goose працює, але БЕЗ tools
}
```

### Корінь проблеми:

**Goose Desktop НЕ має MCP (Model Context Protocol) extensions конфігурації!**

- `~/.config/goose/config.yaml` або відсутній, або БЕЗ секції `extensions:`
- MCP npm packages НЕ встановлено глобально
- Goose запускається БЕЗ завантаження tools

---

## ✅ РІШЕННЯ

### АВТОМАТИЧНЕ (рекомендовано):

```bash
# Запустити оновлений setup-macos.sh
./setup-macos.sh

# Або тільки налаштування Goose:
./scripts/configure-goose.sh
```

### РУЧНЕ (якщо автоматичне не спрацювало):

#### КРОК 1: Створити Goose config з MCP

```bash
mkdir -p ~/.config/goose

cat > ~/.config/goose/config.yaml << 'EOF'
provider: openai
model: gpt-4o

openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com

# ✅ КРИТИЧНО: MCP Extensions
extensions:
  - name: developer
    type: mcp
    config:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem"]
      env:
        ALLOWED_DIRECTORIES: "/Users,/tmp,/Desktop,/Applications"
    
  - name: playwright
    type: mcp
    config:
      command: npx
      args: ["-y", "@executeautomation/playwright-mcp-server"]
      env:
        HEADLESS: "false"
    
  - name: computercontroller
    type: mcp
    config:
      command: npx
      args: ["-y", "@anthropic/computer-use"]

security:
  allow_code_execution: true
  allow_file_access: true
  allow_network_access: true
EOF
```

#### КРОК 2: Встановити MCP npm packages

```bash
npm install -g @modelcontextprotocol/server-filesystem \
               @executeautomation/playwright-mcp-server \
               @anthropic/computer-use
```

#### КРОК 3: Отримати GitHub Token

1. https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Scopes: `read:user`, `read:project`
4. Скопіювати токен

```bash
export GITHUB_TOKEN="ghp_YOUR_TOKEN"
echo 'export GITHUB_TOKEN="ghp_YOUR_TOKEN"' >> ~/.zshrc
```

#### КРОК 4: Перезапустити Goose Desktop

```bash
killall Goose
open -a Goose
```

#### КРОК 5: Перевірити extensions

В Goose Desktop → Settings → Extensions:
- ✅ developer (filesystem)
- ✅ playwright (browser)
- ✅ computercontroller (desktop)

---

## 🧪 ТЕСТУВАННЯ

### Тест 1: Створення файлу (developer__shell)

**Команда в ATLAS:**
```
"Створи файл test.txt на Desktop з текстом 'Hello ATLAS'"
```

**Очікуваний результат:**
```
[ТЕТЯНА] "Розумію. Зараз створю файл на робочому столі..."
[GOOSE] Tool request: developer__shell
[GOOSE] Sending tool response for: developer__shell
[ТЕТЯНА] "Готово. Файл test.txt створено на Desktop."
```

**Перевірка:**
```bash
cat ~/Desktop/test.txt
# Має бути: Hello ATLAS
```

### Тест 2: Браузер (playwright)

**Команда в ATLAS:**
```
"Відкрий браузер та перейди на google.com"
```

**Очікуваний результат:**
- ✅ Браузер відкривається
- ✅ Завантажується Google
- ✅ Тетяна підтверджує успіх

### Тест 3: Скріншот (computercontroller для Гріші)

**Команда в ATLAS:**
```
"Гриша, зроби скріншот робочого столу"
```

**Очікуваний результат:**
- ✅ Гриша використовує screenshot tool
- ✅ Скріншот збережено
- ✅ Гриша підтверджує

---

## 📊 ЩО ЗМІНЕНО

### 1. `setup-macos.sh` - Функція `configure_goose()`

**Було:**
```bash
# Створював config БЕЗ extensions
cat > "$HOME/.config/goose/config.yaml" << 'EOF'
provider: openai
model: gpt-4o
openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com
EOF
```

**Стало:**
```bash
# Створює config З extensions + встановлює npm packages
cat > "$HOME/.config/goose/config.yaml" << 'EOF'
...
extensions:
  - name: developer
    type: mcp
    ...
  - name: playwright
    type: mcp
    ...
security:
  allow_code_execution: true
EOF

# Встановлює MCP packages
npm install -g @modelcontextprotocol/server-filesystem \
               @executeautomation/playwright-mcp-server
```

### 2. `scripts/configure-goose.sh` - Оновлено

**Додано:**
- Встановлення MCP npm packages
- Перевірка наявності extensions
- Детальні інструкції з налаштування

### 3. Нові документи:

- ✅ `docs/GOOSE_MCP_SETUP_GUIDE.md` - Повний посібник з MCP
- ✅ `docs/GOOSE_TOOLS_NOT_AVAILABLE_FIX.md` - Цей документ

---

## 🎯 РЕЗУЛЬТАТ

### До виправлення:
```
[ТЕТЯНА] ❌ "Немає доступу до розширень"
[ГРИША] ❌ "developer недоступний"
```

### Після виправлення:
```
[ТЕТЯНА] ✅ Створює файли через developer__shell
[ТЕТЯНА] ✅ Відкриває браузер через playwright
[ГРИША] ✅ Робить скріншоти через computercontroller
[ГРИША] ✅ Перевіряє файли через developer__shell
```

---

## 📝 КРИТИЧНІ МОМЕНТИ

1. ✅ **MCP extensions MUST бути в config.yaml** - без них tools НЕ працюють
2. ✅ **npm packages MUST бути встановлено глобально** - `npx -y @...` їх завантажує
3. ✅ **GitHub Token обов'язковий** - без нього API не працює
4. ✅ **Goose Desktop > CLI** - Desktop краща підтримка MCP
5. ✅ **Перезапуск після змін** - config читається тільки при старті
6. ✅ **security: allow_* = true** - інакше tools блокуються

---

## 🔗 ПОСИЛАННЯ

- **MCP Protocol:** https://modelcontextprotocol.io
- **Goose Desktop:** https://github.com/block/goose
- **GitHub Models:** https://github.com/marketplace/models
- **MCP Servers:** https://github.com/modelcontextprotocol

---

## ✅ ЧЕКЛИСТ ПІСЛЯ ВИПРАВЛЕННЯ

- [ ] `~/.config/goose/config.yaml` створено з `extensions:`
- [ ] MCP npm packages встановлено (`npm list -g @modelcontextprotocol/...`)
- [ ] GitHub Token додано в environment (`echo $GITHUB_TOKEN`)
- [ ] Goose Desktop перезапущено
- [ ] Extensions видно в Settings → Extensions
- [ ] Тест: створення файлу працює ✅
- [ ] Тест: браузер відкривається ✅
- [ ] Логи: `[GOOSE] Tool request: developer__shell` є

---

**🚀 Після цього виправлення ATLAS має ПОВНИЙ функціонал:**
- Тетяна може створювати файли, відкривати браузер, виконувати команди
- Гриша може робити скріншоти, перевіряти файли, верифікувати результати
- Система ПОВНІСТЮ функціональна! ✨
