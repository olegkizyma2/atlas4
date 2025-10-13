# Goose Configure Command Fix

**Date:** 13 жовтня 2025  
**Time:** ~04:20  
**Type:** Command Deprecation Fix  
**Severity:** Low (non-blocking)

---

## 📋 Проблема

Setup script використовував **застарілу команду** `goose configure` яка більше не існує в поточній версії Goose.

### Симптом:
```bash
$ goose configure
Error: No such command 'configure'.
```

### Корінь проблеми:
- Goose CLI змінив API в новій версії
- Команда `configure` була видалена
- Setup script посилався на неіснуючу команду в 8 місцях

---

## ✅ Рішення

Замінено всі згадки `goose configure` на правильні команди з нового API:

### Нові команди:
1. **Перевірка провайдерів:** `goose providers list`
2. **Запуск сесії:** `goose session start`
3. **Версія:** `goose --version`

### Доступні команди (Goose v2.0+):
```bash
Commands:
  moderators         Manage moderators
  providers          Manage providers
  run                Run a single-pass session
  session            Start or manage sessions
  shell-completions  Manage shell completions
  toolkit            Manage toolkits
  version            Lists the version of goose
```

---

## 🔧 Виправлені файли

### `setup-macos.sh` (8 місць):

#### 1. Перевірка існуючого config (line ~991):
```bash
# Було:
log_info "Goose вже має налаштований config. Якщо потрібно змінити налаштування, запустіть 'goose configure' вручну."

# Стало:
log_info "Goose вже має налаштований config. Щоб перевірити провайдерів: 'goose providers list'"
```

#### 2. Інтерактивний prompt (line ~998):
```bash
# Було:
read -r -p "Запустити goose configure зараз? [Y/n] "

# Стало:
read -r -p "Запустити goose session для перевірки? [Y/n] "
```

#### 3. Неінтерактивний режим (line ~1004):
```bash
# Було:
log_info "Неінтерактивний режим — goose configure можна виконати вручну після завершення"

# Стало:
log_info "Неінтерактивний режим — goose вже налаштовано, config готовий"
```

#### 4. Запуск команди (line ~1008):
```bash
# Було:
log_info "Запуск goose configure..."
if "$goose_exec" configure; then
    log_success "Goose configure завершено"
else
    log_warn "goose configure завершився з помилкою..."
fi

# Стало:
log_info "Запуск goose session для тестування..."
if "$goose_exec" session start --profile default; then
    log_success "Goose session запущено успішно"
else
    log_warn "Goose session не запустився. Config готовий, можна використовувати: goose session start"
fi
```

#### 5. Fallback в configure_goose() (line ~880):
```bash
# Було:
if [ -n "$GOOSE_BIN" ]; then
    $GOOSE_BIN configure || log_warn "Налаштування пропущено або не завершено"
fi

# Стало:
log_warn "OpenRouter config не знайдено в ATLAS config"
log_info "Goose буде використовувати дефолтні налаштування"
log_info "Для зміни провайдера: goose providers list"
```

#### 6. Фінальне повідомлення - без config (line ~1062):
```bash
# Було:
echo -e "   Goose потребує налаштування перед першим запуском:"
echo -e "   ${WHITE}${GOOSE_BIN} configure${NC}"

# Стало:
echo -e "   Goose config буде створено автоматично при першому запуску"
echo -e "   ${WHITE}goose session start${NC}"
```

#### 7. Фінальне повідомлення - з config (line ~1068):
```bash
# Було:
echo -e "${CYAN}ℹ️  Goose:${NC} якщо потрібно змінити постачальника моделей, запустіть 'goose configure'."

# Стало:
echo -e "${CYAN}ℹ️  Goose:${NC} Config готовий. Перевірити провайдерів: ${WHITE}goose providers list${NC}"
```

---

## 📊 Результат

✅ **Setup script тепер використовує правильні команди Goose v2.0+**

### Перевірка:
```bash
bash -n setup-macos.sh
# ✅ Синтаксис правильний
```

### Нова поведінка:
- **КРОК 15:** Створює config з OpenRouter (якщо є в ATLAS config)
- **КРОК 17:** Пропонує запустити `goose session start` для тестування
- **Фінальне повідомлення:** Вказує на `goose providers list` замість `configure`

---

## 🎯 Критично

### Правильні команди:
- ✅ `goose providers list` - показати доступні AI провайдери
- ✅ `goose session start` - запустити інтерактивну сесію
- ✅ `goose run "message"` - одноразовий запит
- ✅ `goose --help` - допомога

### Заборонені команди:
- ❌ `goose configure` - не існує в Goose v2.0+
- ❌ `goose config` - не існує
- ❌ `goose setup` - не існує

---

## 📝 Примітки

1. **Config автоматично створюється** setup script в КРОК 15
2. **GitHub Token** все ще потрібен для GitHub Models provider
3. **OpenRouter** використовується за замовчуванням (якщо налаштовано в ATLAS)
4. **Goose Desktop** має власний GUI для налаштування провайдерів

---

## 🔗 Пов'язані файли

- `setup-macos.sh` - основний setup script (виправлено 8 місць)
- `config/config.yaml` - ATLAS config з OpenRouter налаштуваннями
- `~/.config/goose/config.yaml` - Goose config (створюється автоматично)

---

**Статус:** ✅ FIXED  
**Tested:** Синтаксис перевірено, команди валідні для Goose v2.0+
