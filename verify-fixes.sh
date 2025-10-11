#!/bin/bash

# ATLAS v4.0 - Фінальна перевірка після виправлень
# Дата: 10 жовтня 2025

echo "🔍 ATLAS v4.0 - Перевірка системи після виправлень"
echo "=================================================="
echo ""

# 1. Перевірка структури
echo "📁 1. Перевірка структури проекту..."
echo ""

echo "   ✅ Корінь проекту (має бути чистим):"
ls -1 /Users/dev/Documents/GitHub/atlas4/*.md /Users/dev/Documents/GitHub/atlas4/*.sh 2>/dev/null | sed 's/.*\//   - /'
echo ""

echo "   ✅ Тести:"
ls -1 /Users/dev/Documents/GitHub/atlas4/tests/*.sh 2>/dev/null | sed 's/.*\//   - /' || echo "   ⚠️  Немає тестових скриптів"
echo ""

echo "   ✅ Документація про контекст:"
ls -1 /Users/dev/Documents/GitHub/atlas4/docs/CONTEXT*.md /Users/dev/Documents/GitHub/atlas4/docs/*ORGANIZATION*.md /Users/dev/Documents/GitHub/atlas4/docs/COMPLETE*.md 2>/dev/null | sed 's/.*\//   - /'
echo ""

# 2. Перевірка виправлених файлів
echo "🔧 2. Перевірка виправлених файлів..."
echo ""

files=(
  "orchestrator/workflow/executor-v3.js"
  "orchestrator/workflow/stages/system-stage-processor.js"
  "orchestrator/workflow/stages/agent-stage-processor.js"
  "prompts/atlas/stage0_chat.js"
)

for file in "${files[@]}"; do
  if [ -f "/Users/dev/Documents/GitHub/atlas4/$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file - НЕ ЗНАЙДЕНО!"
  fi
done
echo ""

# 3. Перевірка створених файлів
echo "📝 3. Перевірка нових файлів..."
echo ""

new_files=(
  "tests/test-context.sh"
  "docs/CONTEXT_FIX_SUMMARY.md"
  "docs/CONTEXT_SYSTEM_FIX_REPORT.md"
  "docs/ORGANIZATION_REPORT_2025-10-10.md"
  "docs/COMPLETE_FIX_REPORT_2025-10-10.md"
)

for file in "${new_files[@]}"; do
  if [ -f "/Users/dev/Documents/GitHub/atlas4/$file" ]; then
    size=$(ls -lh "/Users/dev/Documents/GitHub/atlas4/$file" | awk '{print $5}')
    echo "   ✅ $file ($size)"
  else
    echo "   ❌ $file - НЕ ЗНАЙДЕНО!"
  fi
done
echo ""

# 4. Перевірка системи
echo "🚀 4. Перевірка запущеної системи..."
echo ""

# Перевірка портів
ports=(5101 5001 3001 3002)
port_names=("Orchestrator" "Frontend" "TTS" "Whisper")

for i in "${!ports[@]}"; do
  port=${ports[$i]}
  name=${port_names[$i]}
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "   ✅ $name (port $port) - запущено"
  else
    echo "   ⚠️  $name (port $port) - НЕ запущено"
  fi
done
echo ""

# 5. Рекомендації
echo "💡 5. Наступні кроки:"
echo ""
echo "   1. Перезапустити систему:"
echo "      ./restart_system.sh restart"
echo ""
echo "   2. Запустити тест контексту:"
echo "      ./tests/test-context.sh"
echo ""
echo "   3. Перевірити логи:"
echo "      tail -f logs/orchestrator.log | grep -i 'context\\|chat mode'"
echo ""
echo "   4. Тестувати через веб:"
echo "      http://localhost:5001"
echo ""

# 6. Документація
echo "📚 6. Документація:"
echo ""
echo "   Швидкий огляд:"
echo "   - docs/CONTEXT_FIX_SUMMARY.md"
echo ""
echo "   Детальний звіт:"
echo "   - docs/CONTEXT_SYSTEM_FIX_REPORT.md"
echo ""
echo "   Організація проекту:"
echo "   - docs/ORGANIZATION_REPORT_2025-10-10.md"
echo ""
echo "   Повний звіт:"
echo "   - docs/COMPLETE_FIX_REPORT_2025-10-10.md"
echo ""

echo "✅ Перевірка завершена!"
echo "=================================================="
