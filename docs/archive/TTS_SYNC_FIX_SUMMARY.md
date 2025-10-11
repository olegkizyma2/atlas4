# TTS та Workflow Синхронізація - Короткий Звіт

**Дата:** 10 жовтня 2025 - вечір ~20:15  
**Статус:** ✅ ВИПРАВЛЕНО

## Проблема

Атлас ще озвучує завдання (TTS), а Тетяна вже починає його виконувати та озвучувати результат. Озвучки накладаються одна на одну.

## Корінь проблеми

1. **Frontend:** TTS виклики йшли паралельно, минаючи чергу
2. **Backend:** Orchestrator не чекав завершення TTS перед наступним stage

## Виправлення

### Frontend (3 файли)

1. **chat-manager.js** - використання черги TTS
   - ❌ ДО: Прямі виклики `speak()` та `speakSegmented()`
   - ✅ ПІСЛЯ: `await this.ttsManager.addToQueue(textForTTS, agent, ttsOptions)`

2. **tts-manager.js** - покращена черга
   - Підтримка `options` (mode, chunking)
   - Автоматичне визначення chunking для task mode
   - Послідовне виконання через `processQueue()`

### Backend (1 файл)

3. **agent-stage-processor.js** - очікування TTS
   - Імпорт `sendToTTSAndWait` з helpers
   - Очікування завершення TTS перед поверненням response
   - Очищення сигнатури `[ATLAS]` перед відправкою на TTS

## Результат

**ДО:**
```
Atlas говорить → Tetyana починає → обидва говорять одночасно ❌
```

**ПІСЛЯ:**
```
Atlas говорить → завершує TTS → Tetyana виконує → Tetyana говорить ✅
```

## Синхронізація

1. Stage виконується → відповідь готова
2. AgentStageProcessor → `sendToTTSAndWait()` → чекає події
3. Frontend → `addToQueue()` → черга TTS
4. TTS завершується → `/tts/completed` → розблокування
5. Наступний stage починається

## Тестування

```bash
./restart_system.sh restart
# Дати завдання → перевірити що озвучки НЕ накладаються
tail -f logs/orchestrator.log | grep tts
```

## Документація

- Детальний звіт: `docs/TTS_WORKFLOW_SYNC_FIX_2025-10-10.md`
- Оновлені інструкції: `.github/copilot-instructions.md`

---

**Змінені файли:**
- web/static/js/modules/chat-manager.js
- web/static/js/modules/tts-manager.js  
- orchestrator/workflow/stages/agent-stage-processor.js
