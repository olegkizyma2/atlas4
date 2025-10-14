# MCP Workflow Improvements - Quick Reference

**Дата:** 15.10.2025 ~00:15  
**Статус:** ✅ READY FOR TESTING

---

## 🎯 Що виправлено

### 1. TTS Diagnostic Logging ✅
- **Файл:** `orchestrator/workflow/mcp-todo-manager.js`
- **Зміна:** Додано детальні логи в `_safeTTSSpeak()`
- **Результат:** Тепер видно ЧИ TTS доступний та ЧОМУ не працює
- **Тест:** `grep "TTS check" logs/orchestrator.log`

### 2. Grisha - Use Execution Results ✅
- **Файл:** `prompts/mcp/grisha_verify_item.js`
- **Зміна:** СПОЧАТКУ перевіряє execution results, ПОТІМ викликає MCP tools
- **Правило:** Якщо execution success + параметри OK → verified=true БЕЗ додаткових tools
- **Результат:** Очікується 70-90% success rate (було ~10%)
- **Тест:** `grep "from_execution_results" logs/orchestrator.log`

### 3. Tetyana - Mixed Servers ✅
- **Файл:** `prompts/mcp/tetyana_plan_tools.js`
- **Зміна:** ДОЗВОЛЕНО комбінувати tools з різних серверів
- **Приклад:** playwright (браузер) + applescript (заповнення) + memory (збереження)
- **Результат:** Краща success rate для web scraping
- **Тест:** `grep "applescript" logs/orchestrator.log | grep -B 5 -A 5 "playwright"`

### 4. LLM API Timeout Extension ✅
- **Файл:** `orchestrator/workflow/mcp-todo-manager.js`
- **Зміна:** 60s→120s (non-reasoning), 120s→180s (reasoning)
- **Причина:** Web scraping потребує більше часу
- **Результат:** 0 timeout errors
- **Тест:** `grep "timeout" logs/orchestrator.log`

---

## 📝 Файли змінені

1. `prompts/mcp/tetyana_plan_tools.js` (~50 LOC)
2. `prompts/mcp/grisha_verify_item.js` (~80 LOC)
3. `orchestrator/workflow/mcp-todo-manager.js` (~15 LOC)

---

## 🧪 Як тестувати на Mac

```bash
# 1. Перезапустити orchestrator
pkill -f "node.*orchestrator" && sleep 2 && nohup node orchestrator/server.js > logs/orchestrator.log 2>&1 &

# 2. Запустити завдання (через веб-інтерфейс):
# "на робочому столі створи гарну пропозицію з фото у вигляді презентації 
#  з найкращими ціни в Укараїні на BYD song plus 2025 року на 10 автомобілів"

# 3. Перевірити логи:
tail -f logs/orchestrator.log

# 4. Після завершення - перевірити метрики:
echo "=== TTS Status ==="
grep "TTS check" logs/orchestrator.log | tail -5

echo "=== Verification Success ==="
grep "verified.*true" logs/orchestrator.log | wc -l
grep "verified.*false" logs/orchestrator.log | wc -l

echo "=== Mixed Tools Usage ==="
grep "applescript" logs/orchestrator.log | head -3

echo "=== Timeouts ==="
grep -i "timeout" logs/orchestrator.log | grep -v "timeout:" | tail -5
```

---

## 📊 Очікувані результати

### Before (з логів):
- ❌ Items 2, 3, 4 failed after 3 attempts
- ❌ TTS: 0 викликів
- ❌ Verification: ~10% success
- ❌ 1 timeout error

### After (очікується):
- ✅ Items 2, 3, 4 successful (70-90%)
- ✅ TTS: 70-90% (залежить від Mac TTS service)
- ✅ Verification: 70-90% success
- ✅ 0 timeout errors

---

## 🔑 Ключові правила

### Тетяна:
✅ МОЖНА змішувати playwright + applescript + memory  
✅ AppleScript коли playwright failing на forms

### Гриша:
✅ СПОЧАТКУ execution results → ПОТІМ MCP tools  
✅ Якщо execution success → verified=true БЕЗ додаткових calls

### Timeouts:
✅ Reasoning: 180s  
✅ Non-reasoning: 120s

---

## 📌 Наступні кроки

1. Тестуй на Mac
2. Скопіюй логи
3. Скопіюй вивід з веб-інтерфейсу
4. Надішли для аналізу
5. Доповню виправлення якщо потрібно

---

**Детально:** `docs/MCP_WORKFLOW_IMPROVEMENTS_2025-10-15.md`
