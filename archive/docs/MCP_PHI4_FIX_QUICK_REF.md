# 🔧 Швидка Довідка: Виправлення Phi-4 Reasoning Model

## 🎯 Проблема
**100% провал MCP workflow** - phi-4-reasoning генерує `<think>` tags замість JSON

## ✅ Рішення (3 кроки)

### 1. Змінити .env (3 рядки)
```bash
# Замінити reasoning model на JSON-focused
MCP_MODEL_PLAN_TOOLS=mistral-ai/mistral-nemo
MCP_MODEL_VERIFY_ITEM=mistral-ai/mistral-nemo
MCP_MODEL_ADJUST_TODO=mistral-ai/mistral-nemo
```

### 2. Оновлені Парсери
✅ `_parseToolPlan()` - ultra-aggressive `<think>` removal  
✅ `_parseVerification()` - ultra-aggressive `<think>` removal  
✅ `_parseAdjustment()` - ultra-aggressive `<think>` removal  

**Логіка:** cut at `<think>` → clean markdown → extract JSON → fallback if needed

### 3. Промпти Покращені
✅ `tetyana_plan_tools.js` - "NO <think> tags" rules  
✅ `grisha_verify_item.js` - "NO <think> tags" rules  
✅ `atlas_adjust_todo.js` - "NO <think> tags" rules  

## 🧪 Тестування на Mac

```bash
# 1. Перевірити .env
grep "MCP_MODEL_" .env

# 2. Restart
./restart_system.sh restart

# 3. Моніторити
tail -f logs/orchestrator.log | grep -E "(parseToolPlan|<think>)"

# 4. Тест з веб-інтерфейсу
# "Відкрий калькулятор на Mac і введи 22 помножити на 30.27"
```

## 📊 Очікувані Результати

| Metric | Before | After |
|--------|--------|-------|
| JSON parsing | 0% | 95-100% ✅ |
| `<think>` tags | 100% | 0% ✅ |
| TODO success | 0/10 | 9-10/10 ✅ |

## 🚨 Що Шукати в Логах

**✅ УСПІХ:**
```
[TODO] Successfully parsed tool plan: 3 tool calls
[STAGE-2.2-MCP] Executing tools for item 1
```

**❌ ПРОВАЛ (не має бути):**
```
Failed to parse tool plan: No JSON object found
<think>User message: ...
```

## 📁 Змінені Файли

1. `.env` - 3 моделі замінено
2. `orchestrator/workflow/mcp-todo-manager.js` - 3 методи оновлено
3. `prompts/mcp/tetyana_plan_tools.js` - додано JSON rules
4. `prompts/mcp/grisha_verify_item.js` - додано JSON rules
5. `prompts/mcp/atlas_adjust_todo.js` - додано JSON rules

## ✅ Статус
- [x] Всі виправлення завершено
- [x] Syntax перевірено (`node -c` OK)
- [x] Готово до тестування на Mac
- [ ] **НАСТУПНИЙ КРОК: Тестування з веб-інтерфейсу**

## 💡 Критичне
- **НІКОЛИ** НЕ використовуйте reasoning models (phi-4, o1) для JSON tasks
- **ЗАВЖДИ** використовуйте mistral-nemo для MCP stages
- **ЗАВЖДИ** моніторте логи на `<think>` tags (має бути 0)

---
📄 **Детальний звіт:** `MCP_PHI4_REASONING_FIX_COMPLETE.md`  
✅ **Готовність:** 100%
