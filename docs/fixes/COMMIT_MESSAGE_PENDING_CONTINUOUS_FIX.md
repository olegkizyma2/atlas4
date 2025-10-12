fix: conversation mode pending continuous listening (PR #4)

КРИТИЧНЕ ВИПРАВЛЕННЯ: Conversation loop НЕ працював після озвучення Atlas

Проблема:
- После TTS відповіді Atlas діалог обривався
- Continuous listening НЕ запускався
- Користувач НЕ міг продовжити бесіду

Root Cause:
- Race condition: транскрипція приходить ДО завершення activation TTS
- Pending message відправляється, система робить return
- Чекає TTS_COMPLETED який НІКОЛИ не прийде (pending = дублікат)
- Deadlock - conversation loop зламаний

Рішення:
- Після відправки pending МИТТЄВО запускати continuous listening
- 500ms пауза для природності
- НЕ чекати новий TTS_COMPLETED (його не буде)

Результат:
✅ Conversation loop працює ЗАВЖДИ
✅ Pending message НЕ блокує діалог  
✅ Deadlock неможливий
✅ Користувач може говорити ОДРАЗУ після activation

Files:
- web/static/js/voice-control/conversation-mode-manager.js (handleTTSCompleted)
- docs/CONVERSATION_PENDING_CONTINUOUS_FIX_2025-10-12.md
- CONVERSATION_PENDING_CONTINUOUS_SUMMARY.md
- PR_4_PENDING_CONTINUOUS_SUMMARY.md
- verify-pending-continuous-fix.sh
- .github/copilot-instructions.md (updated)
