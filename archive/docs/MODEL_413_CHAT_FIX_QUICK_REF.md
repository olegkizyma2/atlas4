# 🔧 Model 413 & Chat Fix - Quick Reference

## 🎯 Виправлені проблеми (14.10.2025 20:00)

### 1. ✅ Помилка 413: Request body too large
**Було:** `ministral-3b` (8K context) - занадто мало  
**Стало:** `mistral-nemo` (128K context) - достатньо для всього

**Змінені стейджі:**
- Stage 2.1 (Plan Tools)
- Stage 2.3 (Verify Item)  
- Stage 3 (Adjust TODO)

### 2. ✅ Timeout на API запитах
**Було:** 10s для mode_selection, 30s для chat - занадто мало  
**Стало:** 60s для всіх стейджів - достатньо для повільних моделей

### 3. ✅ Повідомлення не з'являються в чаті
**Було:** WebSocket підписки `['logs', 'model3d', 'tts']` - немає chat!  
**Стало:** `['logs', 'model3d', 'tts', 'chat', 'workflow']` - все працює

### 4. ✅ Додано логування розміру запитів
Тепер видно скільки KB відправляється до API для діагностики 413

## 📂 Змінені файли

```
config/
├── global-config.js                          ✅ Замінено моделі на mistral-nemo
└── workflow-config.js                        ✅ Збільшено timeout до 60s

orchestrator/api/
└── websocket-manager.js                      ✅ Додано chat та workflow підписки

orchestrator/workflow/stages/
├── system-stage-processor.js                 ✅ Timeout 60s + логування розміру
└── agent-stage-processor.js                  ✅ Timeout 60s + логування розміру
```

## 🚀 Як використовувати

### Перезапустити orchestrator:
```bash
npm run start
```

### Протестувати:
```
"Знайди BYD Song Plus 2025 на auto.ria, створи презентацію"
```

**Очікуваний результат:**
- ✅ Немає помилок 413
- ✅ Повідомлення з'являються в чаті
- ✅ Завдання виконується до кінця

## 📊 Порівняння моделей

| Модель | Context | Rate Limit | Використання |
|--------|---------|------------|--------------|
| `ministral-3b` | 8K | 45/min | Mode Selection, Summary |
| `mistral-small-2503` | 32K | 40/min | TODO Planning |
| `mistral-nemo` | 128K | 14/min | Plan/Verify/Adjust |

## 🔧 Альтернативна конфігурація

Якщо потрібно швидше (але дорожче):

```bash
export MCP_MODEL_PLAN_TOOLS="openai/gpt-4o-mini"
export MCP_MODEL_VERIFY_ITEM="openai/gpt-4o-mini"
export MCP_MODEL_ADJUST_TODO="openai/gpt-4o-mini"
```

## 📖 Детальна документація
Дивись: `docs/fixes/MODEL_413_CHAT_FIX_2025-10-14.md`
