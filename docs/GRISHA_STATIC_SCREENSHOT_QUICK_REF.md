# Grisha Static Screenshot - Quick Reference

**Дата:** 17.10.2025  
**Версія:** 4.0.2

---

## 🎯 ГОЛОВНЕ ПРАВИЛО

**Гриша використовує ТІЛЬКИ статичний `screencapture` для screenshot верифікації.**

❌ **НЕ використовувати:** `playwright__screenshot` (динамічний, може впливати на стан)  
✅ **ВИКОРИСТОВУВАТИ:** `shell__execute_command` з macOS `screencapture` (статичний, пасивний)

---

## 📸 4 ВАРІАНТИ SCREENCAPTURE

### 1. Весь екран (default)
```bash
screencapture -x /tmp/grisha_verify_ITEMID.png
```
**Використовувати для:**
- Файли на Desktop
- Загальний стан системи
- Іконки Dock
- Multiple windows

### 2. Окрема програма/вікно
```bash
screencapture -l$(osascript -e 'tell application "Calculator" to id of window 1') /tmp/calc.png
```
**Використовувати для:**
- Результат в калькуляторі
- Конкретне вікно браузера
- Текст в TextEdit
- Одна програма

**Замінити:**
- `"Calculator"` → `"Safari"`, `"TextEdit"`, `"Notes"`

### 3. Головний дисплей
```bash
screencapture -xm /tmp/main_screen.png
```
**Використовувати для:**
- Multi-monitor setup (тільки primary)
- Економія місця (менший файл)

### 4. З курсором миші
```bash
screencapture -C /tmp/desktop.png
```
**Використовувати для:**
- Важливо де вказує користувач
- Hover effects
- Mouse position verification

---

## 🔧 JSON ПРИКЛАДИ

### Файл на Desktop
```json
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -x /tmp/verify_desktop.png"
      }
    }
  ]
}
```

### Калькулятор результат
```json
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -l$(osascript -e 'tell application \"Calculator\" to id of window 1') /tmp/calc.png"
      }
    }
  ]
}
```

### Браузер URL
```json
{
  "tool_calls": [
    {
      "server": "shell",
      "tool": "execute_command",
      "parameters": {
        "command": "screencapture -x /tmp/verify_browser.png"
      }
    }
  ]
}
```

---

## ✅ VERIFICATION OUTPUT

```json
{
  "verified": true,
  "reason": "Screenshot підтверджує виконання",
  "evidence": {
    "tool_used": "shell_screencapture",
    "command": "screencapture -x /tmp/verify.png",
    "visual_confirmed": true
  },
  "from_execution_results": false,
  "tts_phrase": "Підтверджено"
}
```

---

## 🛠️ ІНШІ MCP TOOLS (ВСІ ДОСТУПНІ)

Гриша може використовувати **ВСІ інші MCP tools** БЕЗ обмежень:

- ✅ `filesystem__read_file` - читання файлів
- ✅ `filesystem__list_directory` - список файлів
- ✅ `shell__execute_command` - будь-які shell команди (ps, cat, ls, grep)
- ✅ `git__status` - git стан
- ✅ `git__log` - git історія
- ✅ `memory__retrieve` - збережені дані
- ✅ `memory__search` - пошук в пам'яті

**Тільки screenshot** має бути через статичний `screencapture`, решта - без обмежень.

---

## 🚫 ЗАБОРОНЕНО

❌ `playwright__screenshot` - динамічний, може змінювати стан браузера  
❌ Будь-які динамічні інструменти для screenshot  

**Причина:** Верифікація має бути пасивною, БЕЗ впливу на систему.

---

## 📋 WORKFLOW

```
Atlas створює TODO
  ↓
Тетяна виконує (може використовувати playwright__screenshot)
  ↓
Гриша верифікує (ТІЛЬКИ static screencapture)
  ↓
verified=true/false
```

---

## 📚 ДОКУМЕНТАЦІЯ

- **Детально:** `docs/GRISHA_STATIC_SCREENSHOT_2025-10-17.md`
- **Промпт:** `prompts/mcp/grisha_verify_item_optimized.js`
- **Instructions:** `.github/copilot-instructions.md` (section "Grisha Static Screenshot Enhancement")

---

**КЛЮЧОВА ДУМКА:** Статичний screenshot гарантує чисту перевірку реального стану системи БЕЗ динамічного втручання.
