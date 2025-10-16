#!/bin/bash

# AI Model Configuration - Quick Reference (16.10.2025)
# Швидкий посібник для переважки моделей та температур

# ============================================
# 🎯 СИСТЕМА СТАЖ (System Stages)
# ============================================

# Stage: Mode Selection (chat vs task)
# Змінна: AI_MODEL_CLASSIFICATION / AI_TEMP_CLASSIFICATION
# Тип: Бінарна класифікація
# Default: ministral-3b @ 0.05
# 
# Функція: Визначити чи це розмова чи завдання
# Поради: Низька T = точніше розпізнавання
export AI_MODEL_CLASSIFICATION=mistral-ai/ministral-3b
export AI_TEMP_CLASSIFICATION=0.05

# ============================================
# Stage: Chat (розмова)
# Змінна: AI_MODEL_CHAT / AI_TEMP_CHAT
# Тип: Вільна розмова
# Default: mistral-small-2503 @ 0.7 (краща якість для розмови!)
#
# Функція: Відповідь на чат повідомлення
# Поради: Висока T = креативніше, але менш логічне
export AI_MODEL_CHAT=mistral-ai/mistral-small-2503
export AI_TEMP_CHAT=0.7

# ============================================
# Stage: Post-Chat Analysis (аналіз)
# Змінна: AI_MODEL_ANALYSIS / AI_TEMP_ANALYSIS
# Тип: Аналіз та розуміння контексту
# Default: gpt-4o-mini @ 0.2
#
# Функція: Розібрати чат на дії (якщо потрібно)
# Поради: gpt-4o-mini - баланс якості та швидкості
export AI_MODEL_ANALYSIS=openai/gpt-4o-mini
export AI_TEMP_ANALYSIS=0.2

# ============================================
# Stage: TTS Optimization (оптимізація для озвучки)
# Змінна: AI_MODEL_TTS_OPT / AI_TEMP_TTS_OPT
# Тип: Оптимізація тексту
# Default: ministral-3b @ 0.15
#
# Функція: Підготувати текст для TTS
# Поради: Низька T = однаковий результат щоразу
export AI_MODEL_TTS_OPT=mistral-ai/ministral-3b
export AI_TEMP_TTS_OPT=0.15

# ============================================
# 🔧 MCP СТАЖІ (MCP Stages)
# ============================================

# Stage 0: Mode Selection (MCP version)
# Змінна: MCP_MODEL_MODE_SELECTION / MCP_TEMP_MODE_SELECTION
# Default: ministral-3b @ 0.05
export MCP_MODEL_MODE_SELECTION=mistral-ai/ministral-3b
export MCP_TEMP_MODE_SELECTION=0.05

# ============================================
# Stage 1: Atlas TODO Planning
# Змінна: MCP_MODEL_TODO_PLANNING / MCP_TEMP_TODO_PLANNING
# Default: mistral-small-2503 @ 0.3
# 
# Функція: Планування завдання на кроки
# Поради: T=0.3 дозволяє креативність у плануванні
export MCP_MODEL_TODO_PLANNING=mistral-ai/mistral-small-2503
export MCP_TEMP_TODO_PLANNING=0.3

# ============================================
# Stage 2.1: Tetyana Plan Tools
# Змінна: MCP_MODEL_PLAN_TOOLS / MCP_TEMP_PLAN_TOOLS
# Default: mistral-small-2503 @ 0.1
# ⭐ ВАЖЛИВО: mistral-small-2503 генерує ЧИСТИЙ JSON без markdown!
# 
# Функція: Визначити які tools потрібні для кожного кроку
# Поради: T=0.1 - мінімальна варіативність для JSON
export MCP_MODEL_PLAN_TOOLS=mistral-ai/mistral-small-2503
export MCP_TEMP_PLAN_TOOLS=0.1

# ============================================
# Stage 2.3: Grisha Verify Item
# Змінна: MCP_MODEL_VERIFY_ITEM / MCP_TEMP_VERIFY_ITEM
# Default: mistral-small-2503 @ 0.15
#
# Функція: Перевірити чи виконано кроку
# Поради: T=0.15 - точність з мінімальною варіативністю
export MCP_MODEL_VERIFY_ITEM=mistral-ai/mistral-small-2503
export MCP_TEMP_VERIFY_ITEM=0.15

# ============================================
# Stage 3: Atlas Adjust TODO
# Змінна: MCP_MODEL_ADJUST_TODO / MCP_TEMP_ADJUST_TODO
# Default: gpt-4o-mini @ 0.2
#
# Функція: Скоригувати план якщо щось не вийшло
# Поради: gpt-4o-mini - потужніша для аналізу помилок
export MCP_MODEL_ADJUST_TODO=openai/gpt-4o-mini
export MCP_TEMP_ADJUST_TODO=0.2

# ============================================
# Stage 8: Final Summary
# Змінна: MCP_MODEL_FINAL_SUMMARY / MCP_TEMP_FINAL_SUMMARY
# Default: ministral-3b @ 0.5
#
# Функція: Виконати резюме результату для користувача
# Поради: T=0.5 - природність без надмірної варіативності
export MCP_MODEL_FINAL_SUMMARY=mistral-ai/ministral-3b
export MCP_TEMP_FINAL_SUMMARY=0.5

# ============================================
# 💡 ПРИКЛАДИ КОНФІГУРАЦІЙ
# ============================================

# ПРИКЛАД 1: МАКСИМАЛЬНА ЯКІСТЬ (slow mode)
# Використовувати потужніші моделі навіть з низькими rate limit
quality_mode() {
    export AI_MODEL_CLASSIFICATION=openai/gpt-4o-mini
    export AI_MODEL_CHAT=meta/llama-3.3-70b-instruct
    export AI_MODEL_ANALYSIS=cohere/cohere-command-r-plus-08-2024
    export AI_MODEL_TTS_OPT=openai/gpt-4o-mini
    
    export MCP_MODEL_MODE_SELECTION=openai/gpt-4o-mini
    export MCP_MODEL_TODO_PLANNING=meta/llama-3.3-70b-instruct
    export MCP_MODEL_PLAN_TOOLS=openai/gpt-4o-mini
    export MCP_MODEL_VERIFY_ITEM=openai/gpt-4o-mini
    export MCP_MODEL_ADJUST_TODO=meta/llama-3.3-70b-instruct
    export MCP_MODEL_FINAL_SUMMARY=meta/llama-3.3-70b-instruct
    
    echo "✅ Quality mode: Max quality, slower (~2-6 req/min)"
}

# ПРИКЛАД 2: МАКСИМАЛЬНА ШВИДКІСТЬ (fast mode)
# Використовувати тільки швидкі моделі
speed_mode() {
    export AI_MODEL_CLASSIFICATION=mistral-ai/ministral-3b
    export AI_MODEL_CHAT=mistral-ai/ministral-3b
    export AI_MODEL_ANALYSIS=mistral-ai/ministral-3b
    export AI_MODEL_TTS_OPT=mistral-ai/ministral-3b
    
    export MCP_MODEL_MODE_SELECTION=mistral-ai/ministral-3b
    export MCP_MODEL_TODO_PLANNING=mistral-ai/mistral-small-2503
    export MCP_MODEL_PLAN_TOOLS=mistral-ai/ministral-3b
    export MCP_MODEL_VERIFY_ITEM=mistral-ai/ministral-3b
    export MCP_MODEL_ADJUST_TODO=mistral-ai/mistral-small-2503
    export MCP_MODEL_FINAL_SUMMARY=mistral-ai/ministral-3b
    
    echo "⚡ Speed mode: Max speed, medium quality (~40-45 req/min)"
}

# ПРИКЛАД 3: БАЛАНСОВАНО (default - уже налаштовано)
# Не робіть нічого - це default

# ПРИКЛАД 4: БІЛЬШ КРЕАТИВНИЙ ЧАТ
creative_chat_mode() {
    export AI_MODEL_CHAT=meta/llama-3.3-70b-instruct
    export AI_TEMP_CHAT=0.9
    echo "🎨 Creative chat mode: Llama 70B @ 0.9"
}

# ПРИКЛАД 5: БІЛЬШ ТОЧНА КЛАСИФІКАЦІЯ
strict_classification_mode() {
    export AI_TEMP_CLASSIFICATION=0.01  # Максимум точності
    export MCP_TEMP_MODE_SELECTION=0.01
    echo "🎯 Strict classification: T=0.01 (максимальна точність)"
}

# ============================================
# 📊 ЯК ПЕРЕВІРИТИ ЩО НАЛАШТОВАНО
# ============================================

check_models() {
    echo "=== SYSTEM STAGES ==="
    echo "Classification: $AI_MODEL_CLASSIFICATION @ $AI_TEMP_CLASSIFICATION"
    echo "Chat: $AI_MODEL_CHAT @ $AI_TEMP_CHAT"
    echo "Analysis: $AI_MODEL_ANALYSIS @ $AI_TEMP_ANALYSIS"
    echo "TTS: $AI_MODEL_TTS_OPT @ $AI_TEMP_TTS_OPT"
    
    echo ""
    echo "=== MCP STAGES ==="
    echo "Mode Selection: $MCP_MODEL_MODE_SELECTION @ $MCP_TEMP_MODE_SELECTION"
    echo "TODO Planning: $MCP_MODEL_TODO_PLANNING @ $MCP_TEMP_TODO_PLANNING"
    echo "Plan Tools: $MCP_MODEL_PLAN_TOOLS @ $MCP_TEMP_PLAN_TOOLS"
    echo "Verify Item: $MCP_MODEL_VERIFY_ITEM @ $MCP_TEMP_VERIFY_ITEM"
    echo "Adjust TODO: $MCP_MODEL_ADJUST_TODO @ $MCP_TEMP_ADJUST_TODO"
    echo "Final Summary: $MCP_MODEL_FINAL_SUMMARY @ $MCP_TEMP_FINAL_SUMMARY"
}

# ============================================
# 🚀 ВИКОРИСТАННЯ
# ============================================

# Щоб застосувати конфіг:
# 1. Скопіювати в .env:
#    cp ai-models-config.sh .env.models.sh
#    source .env.models.sh
#
# 2. Або запустити mode:
#    source ai-models-config.sh
#    speed_mode  # або quality_mode, creative_chat_mode, etc.
#    check_models
#
# 3. Перевірити:
#    grep "MODEL\|TEMP" .env

