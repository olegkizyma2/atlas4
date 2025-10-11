fix: 3D model visibility & Safari backdrop-filter compatibility

ПРОБЛЕМИ:
1. 3D GLB шолом НЕ видимий - схований за непрозорими панелями
2. Safari warnings - 8 місць без -webkit-backdrop-filter префіксу

РІШЕННЯ:
1. Збільшено яскравість моделі:
   - opacity: 0.8 → 0.95 (+19%)
   - brightness: 1.2 → 1.4 (+17%)
   - glow: 60px (0.5) → 80px (0.7) (+40%)

2. Зменшено opacity панелей логів на 40%:
   - rgba opacity: 0.25-0.45 → 0.15-0.30
   - Панелі тепер ДУЖЕ прозорі

3. Додано -webkit-backdrop-filter для Safari:
   - 8 місць у web/static/css/main.css
   - Blur effects тепер працюють в Safari/iOS

РЕЗУЛЬТАТ:
✅ Модель МАКСИМАЛЬНО ЯСКРАВА (brightness 1.4)
✅ Панелі ДУЖЕ ПРОЗОРІ (opacity 0.15-0.30)
✅ Safari/iOS ПОВНА ПІДТРИМКА blur effects
✅ Всі CSS warnings виправлені

ВИПРАВЛЕНІ ФАЙЛИ:
- web/static/css/main.css (12 секцій)
- .github/copilot-instructions.md
- docs/3D_VISIBILITY_SAFARI_FIX_FINAL.md (NEW)
- tests/test-3d-visibility.sh

ТЕСТУВАННЯ:
./tests/test-3d-visibility.sh - ✅ All checks pass

Co-authored-by: GitHub Copilot <copilot@github.com>
