# 🔧 MCP Tools Fix - Quick Reference

## 🎯 Виправлені проблеми (14.10.2025)

### 1. ✅ Playwright інструменти
**Було:** `playwright_search`, `playwright_scrape`, `browser_open` (НЕ ІСНУЮТЬ)  
**Стало:** `playwright_navigate`, `playwright_fill`, `playwright_get_visible_text`

### 2. ✅ AppleScript сервер
**Було:** `server: "applescript_execute"` (ПОМИЛКА)  
**Стало:** `server: "applescript"` + `tool: "applescript_execute"`

### 3. ✅ TTS сервіс
**Було:** Обов'язковий, сотні попереджень  
**Стало:** Опціональний, одне попередження при старті

## 📂 Змінені файли

```
prompts/mcp/
├── tetyana_plan_tools.js      ✅ Виправлено Playwright + AppleScript
├── atlas_todo_planning.js     ✅ Виправлено приклади
├── atlas_adjust_todo.js       ✅ Виправлено приклади
└── grisha_verify_item.js      ✅ Виправлено Playwright

orchestrator/workflow/
└── tts-sync-manager.js        ✅ TTS тепер опціональний
```

## 🚀 Наступні кроки

1. **Перезапустити orchestrator:**
   ```bash
   npm run start
   ```

2. **Протестувати браузерні завдання:**
   ```
   "Відкрий google.com та зроби скріншот"
   "Знайди BYD Song Plus на auto.ria"
   ```

3. **Протестувати AppleScript:**
   ```
   "Відкрий калькулятор"
   ```

## 📖 Детальна документація
Дивись: `docs/fixes/MCP_TOOLS_FIX_2025-10-14.md`
