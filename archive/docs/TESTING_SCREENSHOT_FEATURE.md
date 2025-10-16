# 🧪 Screenshot Feature - Quick Testing Guide

## Як протестувати нову функцію

### Тест 1: Програма вже відкрита ✅
**Мета:** Перевірити що Тетяна пропускає зайві кроки

**Підготовка:**
1. Відкрийте Calculator вручну
2. Залишіть його відкритим на екрані

**Команда Атласу:**
"Обчисли 22 помножити на 30.27 через калькулятор"

**Очікувана поведінка:**
1. Атлас створює TODO (3 пункти)
2. Тетяна планує tools
3. **🆕 Тетяна робить скріншот**
4. Тетяна бачить: Calculator вже відкритий
5. Тетяна каже: **"Коригую план"** 🎤
6. Скоригований план: пропустити "відкрити", залишити тільки "ввести числа" + "screenshot"
7. Тетяна виконує скоригований plan
8. Гриша перевіряє результат

**Що перевірити:**
- [ ] Чути TTS "Коригую план"
- [ ] В логах: `[TODO] 🔧 Plan adjusted: ...`
- [ ] Calculator НЕ закривається і НЕ відкривається знову
- [ ] Одразу вводяться числа

---

### Тест 2: Чистий стан ✅
**Мета:** Перевірити що корекція НЕ відбувається коли не потрібна

**Підготовка:**
1. Закрийте всі програми
2. Чистий desktop

**Команда Атласу:**
"Відкрий VSCode та створи новий файл"

**Очікувана поведінка:**
1. Атлас створює TODO
2. Тетяна планує tools
3. **🆕 Тетяна робить скріншот**
4. Тетяна бачить: чистий desktop, VSCode НЕ відкритий
5. Тетяна каже: **"Скрін готовий"** 🎤 (БЕЗ корекції!)
6. Тетяна виконує ORIGINAL plan (without changes)
7. VSCode відкривається

**Що перевірити:**
- [ ] Чути TTS "Скрін готовий"
- [ ] В логах: `needs_adjustment: false`
- [ ] План виконується БЕЗ змін
- [ ] VSCode успішно відкривається

---

### Тест 3: Браузер вже готовий ✅
**Мета:** Перевірити корекцію web tasks

**Підготовка:**
1. Відкрийте Chrome/Safari
2. Перейдіть на google.com
3. Залишіть вкладку відкритою

**Команда Атласу:**
"Знайди новини про Tesla в Google"

**Очікувана поведінка:**
1. Атлас створює TODO
2. Тетяна планує: navigate google.com → fill search → click
3. **🆕 Тетяна робить скріншот**
4. Тетяна бачить: браузер вже на google.com
5. Тетяна каже: **"Браузер готовий, шукаю"** 🎤
6. Скоригований план: пропустити navigate, одразу fill search
7. Тетяна виконує скоригований plan

**Що перевірити:**
- [ ] Чути TTS з custom фразою
- [ ] В логах: adjusted_plan without navigate
- [ ] Браузер НЕ переходить на google.com знову
- [ ] Одразу заповнюється search field

---

### Тест 4: Screenshot failure (error handling) ✅
**Мета:** Перевірити graceful degradation

**Підготовка:**
1. Тимчасово вимкніть Playwright server (якщо є)
2. Або заблокуйте shell screencapture

**Команда Атласу:**
Будь-яка команда

**Очікувана поведінка:**
1. Атлас створює TODO
2. Тетяна планує tools
3. **🆕 Тетяна пробує screenshot → FAILING**
4. В логах: `Screenshot failed, using original plan`
5. Тетяна ПРОДОВЖУЄ з original plan (БЕЗ краша!)
6. Завдання виконується успішно

**Що перевірити:**
- [ ] Система НЕ крашиться
- [ ] Warning в логах про screenshot failure
- [ ] План виконується БЕЗ змін
- [ ] Завдання успішно завершується

---

## 📋 Логи для перевірки

### Успішний screenshot + adjustment:
```
[TODO] 📸 Taking screenshot and analyzing plan for item 1
[TODO] 📸 Screenshot saved via playwright: /tmp/atlas_task_1_before.png
[TODO] Analyzing screenshot with model: ...
[TODO] 🔧 Plan adjustment needed: Calculator already open
[TODO] ✅ Plan approved, proceeding with execution
```

### Успішний screenshot БЕЗ adjustment:
```
[TODO] 📸 Taking screenshot and analyzing plan for item 1
[TODO] 📸 Screenshot saved via shell: /tmp/atlas_task_1_before.png
[TODO] ✅ Plan approved, proceeding with execution
```

### Screenshot failure:
```
[TODO] 📸 Taking screenshot and analyzing plan for item 1
[MCP-TODO] Playwright screenshot failed: ...
[MCP-TODO] Screenshot failed, using original plan
[TODO] Continuing with original plan despite screenshot failure
```

---

## 🔍 Як знайти screenshot файли

Screenshots зберігаються в `/tmp/`:
```bash
ls -lh /tmp/atlas_task_*_before.png
```

Перегляд:
```bash
open /tmp/atlas_task_1_before.png
```

---

## ✅ Чеклист успішного тесту

- [ ] Тест 1 пройдено (програма відкрита → корекція)
- [ ] Тест 2 пройдено (чистий стан → без корекції)
- [ ] Тест 3 пройдено (браузер готовий → корекція)
- [ ] Тест 4 пройдено (помилка → graceful fallback)
- [ ] TTS фрази озвучуються правильно
- [ ] Логи містять debug інформацію
- [ ] Screenshots створюються у /tmp/
- [ ] Система НЕ крашиться при помилках

---

## 🐛 Якщо щось не працює

### Screenshot не створюється:
1. Перевірте Playwright server: `curl http://localhost:...`
2. Перевірте shell доступ: `screencapture -x /tmp/test.png`
3. Логи: `grep "screenshot" logs/orchestrator.log`

### Корекція не відбувається:
1. Перевірте LLM response: `grep "Screenshot analysis" logs/orchestrator.log`
2. Перевірте JSON parsing: `grep "parseScreenshotAdjustment" logs/orchestrator.log`
3. Перевірте temperature model: має бути 0.2

### TTS не озвучує:
1. Перевірте TTS service: `curl http://localhost:3001/health`
2. Логи TTS: `grep "tts_phrase" logs/orchestrator.log`
3. Перевірте agent: має бути 'tetyana'

---

**Happy Testing!** 🚀
