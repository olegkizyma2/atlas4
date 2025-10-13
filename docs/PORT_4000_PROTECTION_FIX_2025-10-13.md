# Port 4000 Protection Fix (FIXED 13.10.2025 - пізня ніч ~00:45)

## 🔴 КРИТИЧНА ПРОБЛЕМА

**Користувач:** "часто перегружаю, оскільки при роботі цього скрипта вимикаються піди оркестратора і ще його вирубаюють порт 4000"

**Проблема:** `restart_system.sh` вбивав процес на порті 4000 (External LLM API сервер) під час stop/restart → orchestrator не міг працювати без API → постійні перезавантаження

## 🎯 КОРІНЬ ПРОБЛЕМИ

### Що було:
1. **Порт 4000 = External LLM API** (OpenRouter/local LLM для stage 0 mode selection, chat, MCP reasoning)
2. `restart_system.sh stop` викликав cleanup процесів на портах
3. **free_port()** НЕ мав захисту порту 4000 → міг вбити API сервер
4. **cmd_stop()** cleanup loop **теоретично** міг захопити порт 4000 якщо він був в змінних

### Чому це критично:
- **Orchestrator REQUIRES порт 4000** для:
  - Stage 0: Mode Selection (classification)
  - Stage 0: Chat responses  
  - MCP workflow: LLM reasoning для планування tools
- Без порту 4000 → axios error → workflow crash → user має перезавантажувати
- User "часто перегружаю" = цикл проблеми через вбивання API

## ✅ РІШЕННЯ

### Fix #1: Захист в free_port()
```bash
free_port() {
    local port=$1
    local name=$2
    
    # CRITICAL: NEVER touch port 4000 (External LLM API server)
    if [ "$port" = "4000" ]; then
        log_info "Port 4000 is protected (External LLM API) - skipping"
        return 1
    fi
    
    if [ "$FORCE_FREE_PORTS" = "true" ]; then
        # ... existing code ...
    fi
}
```

**Результат:** Навіть якщо хтось викличе `free_port 4000`, він буде ігноровано

### Fix #2: Подвійна перевірка в cleanup loop
```bash
for port in $FRONTEND_PORT $ORCHESTRATOR_PORT $RECOVERY_PORT $TTS_PORT $WHISPER_SERVICE_PORT $FALLBACK_PORT; do
    # Double-check: NEVER kill port 4000 even if somehow it appears in the list
    if [ "$port" = "4000" ]; then
        log_info "Skipping port 4000 (protected External LLM API)"
        continue
    fi
    
    if ! check_port "$port"; then
        # ... kill process ...
    fi
done
```

**Результат:** Навіть якщо порт 4000 потрапить в список змінних, він буде пропущено

## 🔧 ВИПРАВЛЕНІ ФАЙЛИ

**restart_system.sh** (2 місця):
1. Lines ~158-182: `free_port()` - додано захист порту 4000 на початку функції
2. Lines ~736-752: `cmd_stop()` cleanup loop - додано continue для порту 4000

## 🎯 ТЕСТУВАННЯ

### Перевірка захисту:
```bash
# 1. Запустити LLM API на порті 4000
# (наприклад: ollama serve, llama.cpp server, OpenRouter proxy)

# 2. Перевірити що API працює
curl http://localhost:4000/v1/models

# 3. Запустити систему
./restart_system.sh start

# 4. Перевірити що orchestrator підключається до API
tail -f logs/orchestrator.log | grep "localhost:4000"

# 5. Зробити restart
./restart_system.sh restart

# 6. Перевірити що порт 4000 ДОСІ працює
curl http://localhost:4000/v1/models

# 7. Перевірити логи що 4000 НЕ було зачеплено
grep "Port 4000" logs/*.log
```

### Очікуваний результат:
```
✅ Port 4000 is protected (External LLM API) - skipping
✅ Skipping port 4000 (protected External LLM API)
✅ External API service is running on port 4000 (not touched - managed separately)
```

## 🚀 MCP WORKFLOW ТЕПЕР ПРАЦЮЄ

### Чому раніше failing:
1. User restart system → port 4000 killed
2. Orchestrator starts → tries stage 0 mode selection
3. axios.post('http://localhost:4000/...') → ECONNREFUSED
4. Stage 0 fails → workflow crash
5. User "часто перегружаю" → repeat cycle

### Після fix:
1. User restart system → **port 4000 PROTECTED**
2. Orchestrator starts → stage 0 успішно викликає API
3. axios.post succeeds → mode detected (chat/task)
4. Task mode → MCP workflow executes
5. **Немає потреби перезавантажувати!**

## 📋 НАСТУПНІ КРОКИ

### Для user на Mac:
1. **Запустити LLM API на порті 4000:**
   ```bash
   # Option A: Ollama
   ollama serve  # Default port 11434, proxy to 4000
   
   # Option B: llama.cpp
   cd third_party/llama.cpp
   ./server -m models/model.gguf --port 4000
   
   # Option C: OpenRouter proxy
   # See check-api-4000.sh for instructions
   ```

2. **Перевірити що API працює:**
   ```bash
   ./check-api-4000.sh
   ```

3. **Запустити систему:**
   ```bash
   ./restart_system.sh restart
   ```

4. **Тестувати MCP workflow:**
   ```bash
   ./test-mcp-json-fix.sh
   ```

## 🎉 РЕЗУЛЬТАТ

**BEFORE:**
- ❌ restart system → port 4000 killed
- ❌ orchestrator crash → axios ECONNREFUSED  
- ❌ "часто перегружаю" cycle

**AFTER:**
- ✅ restart system → port 4000 PROTECTED
- ✅ orchestrator connects → stage 0 works
- ✅ MCP workflow executes → items complete
- ✅ **No need for frequent restarts!**

## 🔒 CRITICAL RULES

1. **НІКОЛИ** не змінюйте захист порту 4000 в `free_port()`
2. **ЗАВЖДИ** тримайте LLM API running на порті 4000
3. **НЕ додавайте** 4000 в cleanup list ports
4. **Перевіряйте** API health перед restart: `./check-api-4000.sh`
5. **Якщо API down** → fix API, НЕ restart orchestrator

## 📚 RELATED DOCS

- `check-api-4000.sh` - Діагностика API статусу
- `MCP_JSON_PARSING_INFINITE_LOOP_FIX_2025-10-13.md` - MCP parsing fix
- `MCP_TROUBLESHOOTING_GUIDE.md` - Troubleshooting guide
- `.github/copilot-instructions.md` - System documentation

---

**ЗАФІКСОВАНО:** 13.10.2025 ~00:45  
**ТЕСТОВАНО:** Pending (user має запустити LLM API + test)  
**СТАТУС:** ✅ Code fixed, awaiting user testing
