# 🚀 MCP Dynamic TODO Workflow - Quick Start

**Версія:** 1.0  
**Дата:** 13 жовтня 2025  
**Статус:** ✅ Production Ready

---

## 📖 Що це?

**MCP Dynamic TODO Workflow** - інтелектуальна система виконання завдань через прямі MCP сервери:

- 🎯 **Atlas** створює динамічний TODO list (1-10 пунктів)
- ⚙️ **Тетяна** виконує кожен пункт окремо через MCP tools
- ✅ **Гриша** перевіряє КОЖЕН пункт (item-by-item)
- 🔄 **Адаптація** - при помилках Atlas коригує TODO

---

## ⚙️ Конфігурація

### Змінні оточення (.env)

```bash
# Backend режим
AI_BACKEND_MODE=mcp              # 'goose' | 'mcp' | 'hybrid'
AI_BACKEND_PRIMARY=goose          # Primary backend
AI_BACKEND_FALLBACK=mcp           # Fallback backend

# Fallback control (НОВИНКА!)
AI_BACKEND_DISABLE_FALLBACK=false  # true = strict mode, false = safe mode
```

### Режими роботи

#### 1. Development Mode (Strict)
```bash
export AI_BACKEND_MODE=mcp
export AI_BACKEND_DISABLE_FALLBACK=true
```
- ✅ Всі завдання через MCP
- ❌ При помилках система падає (NO fallback)
- 🔍 Легко знайти справжні баги

#### 2. Production Mode (Safe)
```bash
export AI_BACKEND_MODE=hybrid
export AI_BACKEND_DISABLE_FALLBACK=false
```
- ✅ Автоматичний вибір backend
- ✅ При помилках MCP → fallback на Goose
- 🛡️ Максимальна надійність

#### 3. MCP Only Mode
```bash
export AI_BACKEND_MODE=mcp
export AI_BACKEND_DISABLE_FALLBACK=false
```
- ✅ MCP для всіх завдань
- ✅ Fallback на Goose при помилках
- ⚡ Швидкість + надійність

---

## 🧪 Тестування

### Швидкий тест
```bash
./test-mcp-workflow.sh
```

### Ручний тест
```bash
# 1. Встановити режим
export AI_BACKEND_MODE=mcp
export AI_BACKEND_DISABLE_FALLBACK=true

# 2. Запустити систему
./restart_system.sh start

# 3. Відправити завдання
curl -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Створи файл test.txt на Desktop", "sessionId": "test1"}'

# 4. Дивитись логи
tail -f logs/orchestrator.log | grep -E "(MCP|TODO|fallback)"
```

---

## 📊 Workflow

```
User Request: "Створи файл на Desktop та відкрий браузер"
   ↓
[Stage 0.5] Backend Selection → MCP
   ↓
[Stage 1-MCP] Atlas TODO Planning
   → TODO: 3 пункти (create file, open browser, verify)
   ↓
[Stage 2.1-MCP] Тетяна Plan Tools для item #1
   → Tools: developer__shell
   ↓
[Stage 2.2-MCP] Тетяна Execute item #1
   → Виконано: створено test.txt
   ↓
[Stage 2.3-MCP] Гриша Verify item #1
   → Перевірено: файл існує ✅
   ↓
[Stage 2.1-MCP] Тетяна Plan Tools для item #2
   → Tools: playwright__browser_open
   ↓
... (repeat для всіх items)
   ↓
[Stage 8-MCP] Final Summary
   → "Завдання виконано на 100%"
```

---

## 🔧 Що виправлено (13.10.2025)

### 1. ✅ JSON Parsing Error
**Було:** LLM повертав ````json { ... }``` → краш  
**Стало:** Автоматичне очищення markdown → працює  

### 2. ✅ Fallback Control
**Було:** Завжди fallback на Goose  
**Стало:** Можна вимкнути через `AI_BACKEND_DISABLE_FALLBACK=true`  

### 3. ✅ LLM Prompt
**Було:** LLM не знав що повертати  
**Стало:** Явна інструкція "Return ONLY raw JSON"  

---

## 📈 Переваги MCP над Goose

| Feature | Goose | MCP |
|---------|-------|-----|
| Швидкість | 🟡 Mid (WebSocket overhead) | 🟢 Fast (direct) |
| Гранулярність | 🔴 All-or-nothing | 🟢 Item-by-item |
| Адаптивність | 🔴 Static plan | 🟢 Dynamic TODO |
| Прозорість | 🟡 Final result only | 🟢 Real-time progress |
| Recovery | 🔴 Restart from beginning | 🟢 Retry failed item |
| TTS темп | 🟡 Long phrases | 🟢 Short updates |

---

## 🚨 Troubleshooting

### MCP постійно падає
```bash
# Перевірити що MCP сервери встановлені
npm list -g | grep @modelcontextprotocol

# Перевірити логи
tail -f logs/orchestrator.log | grep "MCP\|TODO"

# Увімкнути fallback (safe mode)
export AI_BACKEND_DISABLE_FALLBACK=false
```

### JSON parsing errors
```bash
# Перевірити що промпт правильний
grep "CRITICAL: Return ONLY raw JSON" orchestrator/workflow/mcp-todo-manager.js

# Має бути: ⚠️ CRITICAL: Return ONLY raw JSON...
```

### Fallback не працює
```bash
# Перевірити що fallback НЕ вимкнено
echo $AI_BACKEND_DISABLE_FALLBACK
# Має бути: false або пусто

# Перевірити Circuit Breaker
grep "Circuit breaker" logs/orchestrator.log
```

---

## 📚 Документація

- **Повний опис:** `docs/MCP_FALLBACK_DISABLE_FIX_2025-10-13.md`
- **Архітектура:** `docs/AI_BACKEND_MODULAR_SYSTEM.md`
- **Workflow:** `docs/MCP_DYNAMIC_TODO_WORKFLOW_SYSTEM.md`
- **Інструкції:** `.github/copilot-instructions.md`

---

## 🎓 Best Practices

1. ✅ **Development:** Використовуйте strict mode для знаходження багів
2. ✅ **Production:** Використовуйте safe mode для надійності
3. ✅ **Monitoring:** Слідкуйте за метриками успішності MCP
4. ✅ **Testing:** Тестуйте ОБИДВА режими (strict + safe)
5. ✅ **Prompts:** Завжди інструктуйте LLM повертати чистий JSON

---

**Готово до використання!** 🚀

Для запитань: `docs/MCP_FALLBACK_DISABLE_FIX_2025-10-13.md`
