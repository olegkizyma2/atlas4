#!/bin/bash

# Тест синхронізації TTS та Workflow
# Перевіряє що озвучки НЕ накладаються

echo "🧪 Тестування синхронізації TTS та Workflow"
echo "==========================================="
echo ""

# Перевіряємо що система запущена
if ! pgrep -f "node.*orchestrator" > /dev/null; then
    echo "❌ Orchestrator не запущений!"
    echo "Запустіть: ./restart_system.sh start"
    exit 1
fi

echo "✅ Orchestrator запущений"
echo ""

# Очищаємо старі логи TTS
> logs/tts_sync_test.log

echo "📝 Моніторинг TTS синхронізації (Ctrl+C для зупинки)..."
echo ""
echo "Очікувані події:"
echo "  1. [atlas] tts_wait - Atlas чекає на TTS"
echo "  2. [atlas] tts_complete - Atlas TTS завершено"
echo "  3. [tetyana] tts_wait - Tetyana чекає на TTS"
echo "  4. [tetyana] tts_complete - Tetyana TTS завершено"
echo ""
echo "⚠️  Якщо [tetyana] tts_wait з'являється ПЕРЕД [atlas] tts_complete - є проблема!"
echo ""
echo "Логи:"
echo "------"

# Моніторимо логи з фільтром TTS подій
tail -f logs/orchestrator.log | grep --line-buffered -E "tts_wait|tts_complete|Processing TTS queue|TTS completed for" | while read -r line; do
    timestamp=$(date +"%H:%M:%S")
    
    # Виділяємо різні типи подій кольорами (якщо підтримується)
    if echo "$line" | grep -q "tts_wait"; then
        echo "[$timestamp] 🔄 $line"
    elif echo "$line" | grep -q "tts_complete"; then
        echo "[$timestamp] ✅ $line"
    elif echo "$line" | grep -q "Processing TTS queue"; then
        echo "[$timestamp] 📋 $line"
    else
        echo "[$timestamp] 📝 $line"
    fi
    
    # Зберігаємо в лог файл
    echo "[$timestamp] $line" >> logs/tts_sync_test.log
done
