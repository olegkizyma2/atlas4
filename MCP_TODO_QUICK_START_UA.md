# 🚀 MCP Dynamic TODO - Швидкий Старт

## ⚡ Для Нетерплячих

```bash
# 1. Запустити систему
./restart_system.sh start

# 2. Перевірити статус
./restart_system.sh status

# 3. Верифікувати MCP (має показати 6/6 ✅)
./verify-mcp-servers.sh

# 4. Тестувати
curl -X POST http://localhost:5101/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message": "Створи файл test.txt на Desktop", "sessionId": "test"}'
```

**Очікуваний результат:** Система створює TODO, Тетяна виконує через MCP filesystem, Гриша перевіряє, все озвучується українською.

---

## 📊 Конфігурація (6/6 Servers, 92 Tools)

### MCP Сервери

| Server | Tools | Що робить |
|--------|-------|-----------|
| **filesystem** | 14 | Файли та директорії |
| **playwright** | 32 | Web автоматизація, scraping |
| **shell** | 9 | Системні команди |
| **applescript** | 1 | macOS GUI automation |
| **git** | 27 | Версійний контроль |
| **memory** | 9 | Пам'ять між сесіями |

### Агенти з TTS

- **Atlas** (~1.5s) - Планує TODO
- **Тетяна** (~1s) - Виконує tasks
- **Гриша** (~0.5s) - Перевіряє результат

---

## 🎯 Режими Роботи (.env)

### Поточний: Pure MCP (Рекомендований)

```bash
AI_BACKEND_MODE=mcp
AI_BACKEND_DISABLE_FALLBACK=true
```

**Коли використовувати:** Production, testing, development

### Альтернатива: Hybrid

```bash
AI_BACKEND_MODE=hybrid
AI_BACKEND_DISABLE_FALLBACK=false
```

**Коли використовувати:** Якщо потрібен fallback на Goose

### Альтернатива: Goose Only

```bash
AI_BACKEND_MODE=goose
AI_BACKEND_PRIMARY=goose
```

**Коли використовувати:** Якщо MCP не працює або потрібен Goose Desktop

---

## ✅ Checklist Запуску

### Перед Стартом

- [ ] LLM API running (port 4000) - **КРИТИЧНО!**
  ```bash
  lsof -i :4000  # Має показати процес
  ```

- [ ] MCP packages installed (6 servers)
  ```bash
  npm list -g | grep -E "filesystem|playwright|shell|applescript|git|memory"
  ```

- [ ] Goose Desktop running (якщо hybrid/goose mode)
  ```bash
  ps aux | grep Goose
  ```

### Після Старту

- [ ] All services green
  ```bash
  ./restart_system.sh status
  # Очікуємо 4× ✅ RUNNING
  ```

- [ ] MCP verification passed
  ```bash
  ./verify-mcp-servers.sh
  # Очікуємо: ✅ ALL CHECKS PASSED (6/6)
  ```

- [ ] Test workflow successful
  ```bash
  # Curl команда вище
  # Очікуємо: TODO → execution → verification → summary
  ```

- [ ] TTS working
  ```bash
  curl http://localhost:3001/health
  # Очікуємо: {"status": "ok", "device": "mps"}
  ```

---

## 🔧 Troubleshooting (Швидкі Фікси)

### 1. LLM API Not Running ⚠️

**Симптом:** `connect ECONNREFUSED 127.0.0.1:4000`

**Фікс:**
```bash
lsof -i :4000                # Check
./start-llm-api-4000.sh      # Start if needed
```

### 2. MCP Server Timeout

**Симптом:** `Initialization timeout after 15s`

**Фікс:**
```bash
npm install -g @modelcontextprotocol/server-filesystem  # Reinstall
# Increase timeout in config/global-config.js if needed
```

### 3. TTS Not Speaking

**Симптом:** `device not available`

**Фікс:**
```bash
./restart_system.sh stop tts
./restart_system.sh start tts

# Check MPS device
python3 -c "import torch; print(torch.backends.mps.is_available())"
# Має бути: True
```

### 4. AppleScript Fails

**Симптом:** `execute_applescript not available`

**Фікс:**
```bash
npm uninstall -g @mseep/applescript-mcp      # Remove wrong package
npm install -g @peakmojo/applescript-mcp     # Install correct package
```

### 5. GitHub Server Crashes System

**Симптом:** Orchestrator exits with code 1 during init

**Рішення:** GitHub server вимкнено (SDK mismatch), використовуємо 6/6 без нього

---

## 📝 Logs & Monitoring

### Watch Logs

```bash
# Всі логи разом
./restart_system.sh logs

# Або окремо:
tail -f logs/orchestrator.log | grep -E 'MCP|TODO|STAGE'
tail -f logs/tts.log
tail -f logs/whisper.log
```

### Check Errors

```bash
# MCP errors
grep -i error logs/orchestrator.log | grep -i mcp | tail -20

# Last 50 lines
tail -50 logs/orchestrator.log
```

---

## 📚 Документація

### Швидкі Посилання

- **Повний гайд:** `MCP_TODO_SETUP_COMPLETE_2025-10-14.md`
- **Верифікація:** `MCP_SERVERS_VERIFICATION_2025-10-14.md`
- **Changelog:** `MCP_SERVER_UPDATE_COMPLETE.md`
- **Summary:** `MCP_UPDATE_SUMMARY.txt`

### Конфігурація

- **Environment:** `.env`
- **Master Config:** `config/global-config.js`
- **Prompts:** `prompts/mcp/*.js` (3 files)
- **Setup Script:** `scripts/setup-mcp-todo-system.sh`

---

## 🎭 Приклади Використання

### Приклад 1: Створення Файлу

```bash
curl -X POST http://localhost:5101/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Створи файл test.txt на Desktop з текстом Hello World",
    "sessionId": "test-001"
  }'
```

**Workflow:**
1. Atlas: TODO з 3 пунктів (create → write → verify)
2. Тетяна: `filesystem.write_file` → success
3. Гриша: `filesystem.read_file` → verified
4. Summary: "✅ Файл створено успішно"

### Приклад 2: Web Scraping

```bash
curl -X POST http://localhost:5101/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Відкрий google.com та зроби скріншот",
    "sessionId": "test-002"
  }'
```

**Workflow:**
1. Atlas: TODO з 4 пунктів (navigate → wait → screenshot → save)
2. Тетяна: `playwright.navigate`, `playwright.screenshot`
3. Гриша: Перевіряє скріншот існує
4. Summary: "✅ Скріншот збережено"

### Приклад 3: Git Operations

```bash
curl -X POST http://localhost:5101/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Зроби commit змін в репозиторії",
    "sessionId": "test-003"
  }'
```

**Workflow:**
1. Atlas: TODO (status → add → commit → push)
2. Тетяна: `git.status`, `git.add`, `git.commit`
3. Гриша: `git.log` → verified
4. Summary: "✅ Зміни закоммічено"

---

## 🎯 Performance Tips

### 1. Model Selection (для швидкості)

```bash
# Edit .env
MCP_MODEL_PLAN_TOOLS=openai/gpt-4o-mini      # Швидкий
MCP_MODEL_VERIFY_ITEM=openai/gpt-4o-mini     # Швидкий
MCP_MODEL_TODO_PLANNING=mistral-ai/mistral-small-2503  # Більш потужний
```

### 2. Temperature (для точності)

```bash
# Lower = more deterministic
MCP_TEMP_PLAN_TOOLS=0.1      # Було 0.2
MCP_TEMP_VERIFY_ITEM=0.1     # Було 0.2
```

### 3. TTS Speed

```bash
# Edit ukrainian-tts/tts_server.py
rate = 1.2  # Швидше (default 1.0)
rate = 0.8  # Повільніше для чіткості
```

### 4. Whisper GPU

```bash
# Edit .env (якщо є проблеми з Metal)
WHISPER_CPP_NGL=20           # GPU layers (default)
WHISPER_CPP_NGL=0            # CPU only (якщо GPU crash)
WHISPER_CPP_DISABLE_GPU=true # Повністю вимкнути GPU
```

---

## 🔐 Security Notes

### GitHub Token (Optional)

```bash
# Edit .env якщо потрібен GitHub access
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE

# Або через environment
export GITHUB_TOKEN="ghp_..."
```

**NOTE:** GitHub MCP server наразі вимкнено через SDK issue, але Goose GitHub extension працює.

### Permissions

```bash
# MCP tools можуть виконувати:
# - Filesystem operations (read/write/delete)
# - Shell commands (execute arbitrary code)
# - Web automation (browser control)
# - AppleScript (GUI automation)

# РЕКОМЕНДАЦІЯ: Запускати з обмеженими правами в production
```

---

## 📞 Support & Resources

### Verification Tools

```bash
./verify-mcp-servers.sh          # MCP config check
./restart_system.sh status       # Services status
./check-status.sh                # Quick status
./check-mcp-packages.sh          # npm packages check
```

### Common Locations

```bash
# Logs
logs/orchestrator.log
logs/tts.log
logs/whisper.log
logs/web.log

# Config
.env
config/global-config.js
config/agents-config.js
config/workflow-config.js

# Prompts
prompts/mcp/tetyana_plan_tools.js
prompts/mcp/grisha_verify_item.js
prompts/mcp/atlas_todo_planning.js
```

### Quick Commands

```bash
# Start everything
./restart_system.sh start

# Stop everything
./restart_system.sh stop

# Restart everything
./restart_system.sh restart

# View all logs
./restart_system.sh logs

# Status check
./restart_system.sh status
```

---

## 🎉 Success Indicators

**Система працює правильно, якщо:**

✅ All services status green (4×)  
✅ MCP verification passed (6/6)  
✅ LLM API responding (port 4000)  
✅ TTS speaking Ukrainian  
✅ Test workflow completed  
✅ No errors in logs  
✅ Agents working (Atlas → Тетяна → Гриша)  
✅ TODO execution successful  

---

**Version:** 1.0  
**Date:** 14.10.2025  
**Language:** Українська 🇺🇦  
**Status:** PRODUCTION READY ✅

**Команда:** ATLAS Team  
**Platform:** Mac Studio M1 Max  
**Mode:** Pure Dynamic TODO MCP
