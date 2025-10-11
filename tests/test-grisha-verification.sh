#!/bin/bash

# Тест верифікації Гриші - перевірка використання інструментів
# Дата: 10 жовтня 2025

echo "🧪 Тест верифікації Гриші з інструментами"
echo "=========================================="
echo ""

SESSION_ID="test_grisha_$(date +%s)"

echo "📝 Відправка завдання: Відкрий калькулятор і напиши 777"
echo "Session ID: $SESSION_ID"
echo ""

# Відправити запит
curl -s -X POST http://localhost:5101/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Відкрий калькулятор і напиши 777\", \"sessionId\": \"$SESSION_ID\"}" \
  > /tmp/grisha_test_response.txt &

CURL_PID=$!

# Чекаємо 30 секунд на виконання
sleep 30

# Перевіряємо логи
echo "🔍 Перевірка логів Гриші:"
echo "========================"
echo ""

echo "1. Перевірка використання інструментів:"
tail -200 logs/orchestrator.log | grep -i "grisha" | grep -E "playwright|screenshot|browser_take|computercontrol|developer" | tail -5

if [ $? -eq 0 ]; then
    echo "✅ Гриша використовував інструменти!"
else
    echo "❌ Гриша НЕ використовував інструменти"
fi

echo ""
echo "2. Перевірка вердикту Гриші:"
tail -100 logs/orchestrator.log | grep -A 2 "ГРИША\|grisha.*complete" | tail -10

echo ""
echo "3. Перевірка stage 8 (completion):"
tail -100 logs/orchestrator.log | grep -i "stage.*8\|completion" | tail -5

if [ $? -eq 0 ]; then
    echo "✅ Stage 8 виконався!"
else
    echo "⚠️ Stage 8 можливо не виконався"
fi

echo ""
echo "📊 Повний відповідь:"
cat /tmp/grisha_test_response.txt | grep -E "ГРИША|ТЕТЯНА|АТЛАС|SYSTEM" | tail -10

echo ""
echo "✅ Тест завершено. Перевірте чи Гриша використовував інструменти вище."
