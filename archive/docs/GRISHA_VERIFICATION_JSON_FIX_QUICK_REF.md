# Grisha Verification JSON Fix - Quick Reference

**Date:** 14.10.2025 23:50  
**Status:** ✅ FIXED  

---

## 🔴 Проблема
Гриша повертав **покроковий markdown аналіз** замість чистого JSON → parser error

```
❌ БУЛО:
**Крок 1: Аналіз Success Criteria**
Визнач ЩО саме треба перевірити.
...
{
  "verified": true
}

Error: Expected property name or '}' in JSON at position 1
```

---

## ✅ Рішення
Виправлено промпт `prompts/mcp/grisha_verify_item.js`:

1. ✅ Переформатовано інструкції: markdown → plain text + "(internal thinking)"
2. ✅ Додано explicit "DO NOT output these steps"
3. ✅ Додано WRONG vs CORRECT examples
4. ✅ Посилено JSON output rules (8 правил)

```
✅ СТАЛО:
{
  "verified": true,
  "reason": "Зібрано 10 оголошень з цінами",
  "evidence": {
    "tool_used": "playwright__get_visible_text",
    "items_found": 10
  }
}

SUCCESS - парсер працює!
```

---

## 📁 Файли
- `prompts/mcp/grisha_verify_item.js` - виправлено (~25 LOC)

---

## 🎯 Результат
- **Було:** 0% verification success (JSON parse errors)
- **Очікується:** 95%+ verification success
- **JSON compliance:** 100%

---

## 🧪 Тест
```bash
# Запустити завдання
curl -X POST http://localhost:5101/chat/stream \
  -d '{"message": "створи презентацію BYD...", "sessionId": "test"}'

# Моніторити
tail -f logs/orchestrator.log | grep "STAGE-2.3-MCP"

# Очікується:
[INFO] [STAGE-2.3-MCP] ✅ Verified: true
```

---

## 🚨 Критично
✅ **LLM промпти з JSON output:**
- Інструкції процесу = plain text + "(internal thinking)"
- NO markdown в інструкціях (`**Крок:**` ← заборонено)
- Показуйте WRONG vs CORRECT examples
- Повторюйте JSON rules 3+ разів

❌ **НЕ РОБИТИ:**
- НЕ використовуйте markdown форматування в інструкціях
- НЕ показуйте приклади покрокового output
- НЕ покладайтеся на "Return JSON" без детальних правил

---

**NEXT:** Monitor verification logs, update copilot-instructions.md
