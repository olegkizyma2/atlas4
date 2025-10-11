# 3D Model Visibility Fix - Швидкий Огляд

## Проблема
3D GLB модель шолома була **невидима** через непрозорий фон панелей.

## Рішення
- ✅ Знижена opacity фону логів: **0.82-0.96** → **0.25-0.45** (-70%)
- ✅ Посилений glow effect: **40px (0.3)** → **60px (0.5)** + brightness(1.2)
- ✅ Покращена читабельність чату: opacity 0.18 → 0.35, blur 3px → 5px
- ✅ Оновлені анімації: speaking/listening/thinking з brightness 1.2-1.4

## Результат
**Модель тепер ВИДИМА та ВИРАЗНА** крізь напівпрозорі UI панелі.

## Виправлені файли
- `web/static/css/main.css` - 5 секцій CSS

## Тестування
```bash
./restart_system.sh start
open http://localhost:5001
# → 3D шолом видимий в центрі з яскравим зеленим glow
```

---
**FIXED:** 11.10.2025 ~10:00  
**DOC:** `docs/3D_MODEL_VISIBILITY_FIX_2025-10-11.md`
