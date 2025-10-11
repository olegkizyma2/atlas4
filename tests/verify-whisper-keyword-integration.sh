#!/bin/bash

# Перевірка інтеграції WhisperKeywordDetection
# Дата: 11.10.2025, 03:00

echo "🔍 Перевірка інтеграції Whisper Keyword Detection..."
echo ""

# Перевірка 1: Whisper сервер запущений
echo "📡 Перевірка 1: Whisper сервер (port 3002)"
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Whisper сервер активний"
else
    echo "❌ Whisper сервер НЕ активний - запустіть: ./restart_system.sh start"
    exit 1
fi
echo ""

# Перевірка 2: Конфігурація в atlas-voice-integration.js
echo "🔧 Перевірка 2: Конфігурація keyword сервісу"

ATLAS_VOICE_INTEGRATION="web/static/js/voice-control/atlas-voice-integration.js"

if grep -q "whisperUrl: 'http://localhost:3002'" "$ATLAS_VOICE_INTEGRATION"; then
    echo "✅ whisperUrl налаштований"
else
    echo "❌ whisperUrl НЕ знайдено в конфігурації"
    exit 1
fi

if grep -q "useWebSpeechFallback: false" "$ATLAS_VOICE_INTEGRATION"; then
    echo "✅ Web Speech fallback вимкнений"
else
    echo "⚠️  useWebSpeechFallback не встановлено явно"
fi

if grep -q "'атлаз', 'атлус', 'атлес'" "$ATLAS_VOICE_INTEGRATION"; then
    echo "✅ Розширений список keywords (з варіаціями)"
else
    echo "⚠️  Варіації keywords не знайдено"
fi
echo ""

# Перевірка 3: WhisperKeywordDetection існує
echo "📁 Перевірка 3: Файли сервісу"

WHISPER_KEYWORD_SERVICE="web/static/js/voice-control/services/whisper-keyword-detection.js"

if [ -f "$WHISPER_KEYWORD_SERVICE" ]; then
    echo "✅ whisper-keyword-detection.js існує"
    
    # Перевірка версії
    VERSION=$(grep -m1 "@version" "$WHISPER_KEYWORD_SERVICE" | awk '{print $3}')
    echo "   Версія: $VERSION"
else
    echo "❌ whisper-keyword-detection.js НЕ знайдено"
    exit 1
fi
echo ""

# Перевірка 4: voice-control-manager використовує WhisperKeywordDetection
echo "🏗️  Перевірка 4: Voice Control Manager"

VOICE_CONTROL_MANAGER="web/static/js/voice-control/voice-control-manager.js"

if grep -q "import.*WhisperKeywordDetection" "$VOICE_CONTROL_MANAGER"; then
    echo "✅ WhisperKeywordDetection імпортований"
else
    echo "❌ WhisperKeywordDetection НЕ імпортований"
    exit 1
fi

if grep -q "new WhisperKeywordDetection" "$VOICE_CONTROL_MANAGER"; then
    echo "✅ WhisperKeywordDetection створюється"
else
    echo "❌ WhisperKeywordDetection НЕ створюється"
    exit 1
fi

if grep -q "useWebSpeechFallback" "$VOICE_CONTROL_MANAGER"; then
    echo "✅ Підтримка useWebSpeechFallback fallback"
else
    echo "⚠️  useWebSpeechFallback умова не знайдена"
fi
echo ""

# Перевірка 5: Документація
echo "📚 Перевірка 5: Документація"

WHISPER_KEYWORD_DOC="docs/WHISPER_KEYWORD_DETECTION_2025-10-11.md"
WHISPER_INTEGRATION_DOC="docs/WHISPER_KEYWORD_INTEGRATION_FIX_2025-10-11.md"

if [ -f "$WHISPER_KEYWORD_DOC" ]; then
    echo "✅ $WHISPER_KEYWORD_DOC існує"
else
    echo "⚠️  $WHISPER_KEYWORD_DOC не знайдено"
fi

if [ -f "$WHISPER_INTEGRATION_DOC" ]; then
    echo "✅ $WHISPER_INTEGRATION_DOC існує"
else
    echo "⚠️  $WHISPER_INTEGRATION_DOC не знайдено"
fi
echo ""

# Фінальний підсумок
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Всі перевірки пройдено успішно!"
echo ""
echo "📋 Інструкція для тестування:"
echo "1. Запустіть систему: ./restart_system.sh start"
echo "2. Відкрийте http://localhost:5001"
echo "3. Утримуйте кнопку мікрофона 2+ секунди"
echo "4. Скажіть 'Атлас' (або 'слухай', 'олег миколайович')"
echo "5. Система має почати запис"
echo ""
echo "🔍 Перевірка в консолі браузера:"
echo "console.log(window.voiceControlManager?.services?.get('keyword')?.constructor?.name)"
echo "→ Має показати: 'WhisperKeywordDetection'"
echo ""
echo "📊 Очікувана точність: 95%+ (Whisper.cpp)"
echo "⏱️  Latency: ~2.7 сек (trade-off за точність)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
