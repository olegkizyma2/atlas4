# Playwright Browser Reuse - Quick Reference (17.10.2025)

## TL;DR
**ЗАВЖДИ передавай `browser_id` для всіх операцій ПІСЛЯ першого запуску браузера**

## Правильний паттерн

```javascript
// Дія 1: Запуск браузера
{
  "server": "playwright",
  "tool": "playwright_browser_open",
  "parameters": { "browser": "chromium" }
}
// Response: { browser_id: "12345" }

// Дія 2-N: Все інше - ПЕРЕВАЖАЙ браузер
{
  "server": "playwright",
  "tool": "playwright_navigate",
  "parameters": {
    "browser_id": "12345",  // ← КЛЮЧОВО!
    "url": "https://google.com"
  }
}
```

## ❌ НЕПРАВИЛЬНО (множинні браузери)
```javascript
{
  "server": "playwright",
  "tool": "playwright_navigate",
  "parameters": { "url": "https://google.com" }
  // ❌ Без browser_id → новий браузер!
}
```

## ✅ ПРАВИЛЬНО (один браузер)
```javascript
{
  "server": "playwright",
  "tool": "playwright_navigate",
  "parameters": {
    "browser_id": "12345",  // ✅ З browser_id
    "url": "https://google.com"
  }
}
```

## Всі операції які потребують browser_id
- `playwright_navigate` - перейти на URL
- `playwright_fill` - заповнити поле
- `playwright_click` - клік по елементу
- `playwright_screenshot` - скріншот
- `playwright_get_visible_text` - отримати текст
- `playwright_search` - пошук на сторінці
- `playwright_wait` - чекати на елемент

## Результат
- ⚡ 5x прискорення (1 браузер vs 5)
- 💾 5x менше пам'яті
- ✅ Менше помилок і конфліктів

---
**Файл:** `prompts/mcp/tetyana_plan_tools_optimized.js`  
**Приклад:** Приклад 7 (Lines 169-207)
