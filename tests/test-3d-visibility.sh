#!/bin/bash
# Тест видимості 3D моделі після виправлень

echo "🔍 Перевірка 3D Model Visibility Fix..."
echo ""

# Перевірка що CSS файл існує
if [ ! -f "web/static/css/main.css" ]; then
    echo "❌ CSS файл не знайдено!"
    exit 1
fi

echo "✅ CSS файл знайдено"
echo ""

# Перевірка ключових змін у CSS
echo "📊 Перевірка CSS змін:"
echo ""

# 1. Перевірка opacity логів
if grep -q "rgba(0, 40, 20, 0.15)" web/static/css/main.css; then
    echo "✅ Logs opacity знижено до 0.15-0.30 (МАКСИМАЛЬНА видимість моделі)"
else
    echo "⚠️  Logs opacity може бути неправильним"
fi

# 2. Перевірка glow effect моделі
if grep -q "drop-shadow(0 0 80px rgba(0, 255, 127, 0.7))" web/static/css/main.css; then
    echo "✅ Glow effect МАКСИМАЛЬНО посилено до 80px (0.7)"
else
    echo "⚠️  Glow effect може бути слабким"
fi

# 3. Перевірка brightness
if grep -q "brightness(1.4)" web/static/css/main.css; then
    echo "✅ Brightness filter МАКСИМАЛЬНИЙ (1.4)"
else
    echo "⚠️  Brightness може бути недостатнім"
fi

# 4. Перевірка chat opacity
if grep -q "rgba(0, 0, 0, 0.35)" web/static/css/main.css; then
    echo "✅ Chat opacity збільшено до 0.35"
else
    echo "⚠️  Chat opacity може бути неправильним"
fi

# 5. Перевірка blur
if grep -q "backdrop-filter: blur(5px)" web/static/css/main.css; then
    echo "✅ Backdrop blur збільшено до 5px"
else
    echo "⚠️  Backdrop blur може бути слабким"
fi

echo ""
echo "📝 Статистика змін:"

# Підрахунок входжень ключових значень
echo "   - opacity 0.15-0.30 (logs): $(grep -c 'rgba(0, 40, 20, 0.15)\|rgba(0, 20, 12, 0.22)\|rgba(0, 8, 5, 0.30)' web/static/css/main.css) входжень"
echo "   - model opacity 0.95: $(grep -c 'opacity: 0.95' web/static/css/main.css) входжень"
echo "   - brightness 1.4: $(grep -c 'brightness(1.4)' web/static/css/main.css) входжень"
echo "   - webkit-backdrop-filter: $(grep -c '\-webkit-backdrop-filter' web/static/css/main.css) входжень"
echo "   - drop-shadow 80px: $(grep -c 'drop-shadow(0 0 80px' web/static/css/main.css) входжень"
echo "   - speaking state: $(grep -c 'model-viewer.speaking' web/static/css/main.css) входжень"
echo "   - listening state: $(grep -c 'model-viewer.listening' web/static/css/main.css) входжень"
echo "   - thinking state: $(grep -c 'model-viewer.thinking' web/static/css/main.css) входжень"

echo ""
echo "🎨 Z-index структура:"
grep -E "z-index:\s*[0-9]" web/static/css/main.css | head -10 | while read line; do
    echo "   $line"
done

echo ""
echo "📖 Документація:"
if [ -f "docs/3D_VISIBILITY_SAFARI_FIX_FINAL.md" ]; then
    echo "✅ Фінальна документація: docs/3D_VISIBILITY_SAFARI_FIX_FINAL.md"
else
    echo "⚠️  Фінальна документація не знайдена"
fi

if [ -f "docs/3D_MODEL_VISIBILITY_FIX_2025-10-11.md" ]; then
    echo "✅ Детальна документація: docs/3D_MODEL_VISIBILITY_FIX_2025-10-11.md"
else
    echo "⚠️  Детальна документація не знайдена"
fi

if [ -f "docs/3D_MODEL_VISIBILITY_FIX_SUMMARY.md" ]; then
    echo "✅ Короткий огляд: docs/3D_MODEL_VISIBILITY_FIX_SUMMARY.md"
else
    echo "⚠️  Короткий огляд не знайдений"
fi

echo ""
echo "🧪 Рекомендації для тестування:"
echo ""
echo "1. Запустити систему:"
echo "   ./restart_system.sh start"
echo ""
echo "2. Відкрити в браузері:"
echo "   open http://localhost:5001"
echo ""
echo "3. Перевірити візуально:"
echo "   • 3D шолом ДУЖЕ ЯСКРАВИЙ в центрі екрану"
echo "   • Зелений glow effect ІНТЕНСИВНИЙ (80px blur)"
echo "   • Модель brightness 1.4 - МАКСИМАЛЬНО виразна"
echo "   • Логи та чат ДУЖЕ ПРОЗОРІ (15-30%)"
echo "   • Модель реагує на TTS (ще яскравіше світиться)"
echo "   • Blur effects працюють в Safari/iOS"
echo ""
echo "4. Перевірити через DevTools:"
echo "   const viewer = document.getElementById('model-viewer');"
echo "   console.log('Opacity:', getComputedStyle(viewer).opacity); // 0.95"
echo "   console.log('Filter:', getComputedStyle(viewer).filter);   // brightness(1.4)"
echo ""
echo "✨ Очікуваний результат:"
echo "   Модель МАКСИМАЛЬНО ЯСКРАВА та ВИРАЗНА, панелі дуже прозорі"
echo ""
