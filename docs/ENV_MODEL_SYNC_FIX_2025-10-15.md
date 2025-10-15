# .ENV Model Synchronization Fix - 15.10.2025

## КРИТИЧНА ПРОБЛЕМА ВИЯВЛЕНА

**.env файл мав СТАРІ моделі** які **ПЕРЕКРИВАЛИ** наші виправлення в `global-config.js`!

---

## КОНФЛІКТ

### До виправлення:

```bash
# .env (СТАРЕ - генерував markdown wrappers)
MCP_MODEL_PLAN_TOOLS=microsoft/phi-4
MCP_MODEL_VERIFY_ITEM=Phi-3-small-128k-instruct
MCP_TEMP_PLAN_TOOLS=0.2
MCP_TEMP_VERIFY_ITEM=0.2
```

```javascript
// global-config.js (НОВЕ - але НЕ працювало!)
plan_tools: {
  get model() { 
    return process.env.MCP_MODEL_PLAN_TOOLS || 'mistral-ai/mistral-small-2503';
  },
  // ❌ ПРОБЛЕМА: process.env.MCP_MODEL_PLAN_TOOLS = 'microsoft/phi-4'
  // ❌ Fallback 'mistral-ai/mistral-small-2503' НІКОЛИ не використовувався!
}
```

**Результат:** Система використовувала `phi-4` замість `mistral-small-2503`! 😱

---

## ВИПРАВЛЕННЯ

### Після виправлення:

```bash
# .env (ОНОВЛЕНО 15.10.2025)
MCP_MODEL_PLAN_TOOLS=mistral-ai/mistral-small-2503    # FIXED: було phi-4
MCP_MODEL_VERIFY_ITEM=mistral-ai/mistral-small-2503   # FIXED: було Phi-3
MCP_TEMP_PLAN_TOOLS=0.15                              # FIXED: було 0.2
MCP_TEMP_VERIFY_ITEM=0.15                             # FIXED: було 0.2
```

Тепер **env vars** та **global-config.js** **СИНХРОНІЗОВАНІ**! ✅

---

## ЧОМУ ЦЕ КРИТИЧНО

### Priority Hierarchy:
```
1. process.env.MCP_MODEL_PLAN_TOOLS (HIGHEST)
   ↓
2. Fallback в global-config.js
   ↓
3. Default hardcoded
```

**Якщо env var встановлений → fallback ІГНОРУЄТЬСЯ!**

### Наслідки конфлікту:
- ❌ Phi-4 генерував ```json markdown wrappers → parse errors
- ❌ Temperature 0.2 замість 0.15 → менш детермінізм
- ❌ Наші виправлення в global-config.js **НЕ ПРАЦЮВАЛИ**!

---

## ПЕРЕВІРКА ПІСЛЯ ВИПРАВЛЕННЯ

```bash
# 1. Перевірити .env
grep "MCP_MODEL_PLAN_TOOLS" .env
# Має бути: MCP_MODEL_PLAN_TOOLS=mistral-ai/mistral-small-2503

grep "MCP_TEMP_PLAN_TOOLS" .env
# Має бути: MCP_TEMP_PLAN_TOOLS=0.15

# 2. Restart system (щоб env vars перечитались)
./restart_system.sh restart

# 3. Перевірити логи
grep "Planning tools with model" logs/orchestrator.log
# Має бути: mistral-ai/mistral-small-2503 (НЕ phi-4!)
```

---

## LESSON LEARNED

### ✅ ЗАВЖДИ:

1. **Синхронізуйте .env з config files**
   - Env vars мають найвищий пріоритет
   - Fallback НЕ спрацює якщо env var встановлений

2. **Перевіряйте .env після config змін**
   - Config може мати fallback
   - Але env var його перекриє

3. **Restart після .env змін**
   - Node.js читає env vars тільки при старті
   - Зміни НЕ підтягуються динамічно

### ❌ НІКОЛИ:

1. **НЕ змінюйте тільки config без .env**
   - Env vars перекриють зміни

2. **НЕ припускайте що fallback працює**
   - Перевіряйте env vars першими

3. **НЕ тестуйте без restart**
   - Старі env vars залишаються в пам'яті

---

## UPDATED FILES

```
✅ .env - моделі та temperature оновлено
✅ docs/ENV_MODEL_SYNC_FIX_2025-10-15.md - ця документація
```

**.env НЕ в git** (в .gitignore), тому commit не потрібен.

---

## CRITICAL REMINDER

**ЗАВЖДИ перевіряйте .env після змін в config files!**

```bash
# Quick check після config змін:
grep "MCP_MODEL" .env
grep "MCP_TEMP" .env

# Має співпадати з вашими виправленнями!
```

---

**FIXED:** 15.10.2025 ~05:30  
**IMPACT:** CRITICAL - без цього виправлення всі зміни в global-config НЕ працювали  
**STATUS:** ✅ Синхронізовано
