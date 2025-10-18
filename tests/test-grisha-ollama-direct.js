#!/usr/bin/env node

/**
 * ATLAS Grisha Vision Test - Direct Vision API Call
 * Прямий виклик Vision API на localhost:4000 для візуальної перевірки
 *
 * Дата: 17.10.2025
 * Версія: 1.0.0
 */

import axios from 'axios';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const COLORS = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
console.log(`${COLORS.blue}   ATLAS - Гриша перевіряє калькулятор (Vision API)${COLORS.reset}`);
console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

async function testGrishaVision() {
    try {
        // КРОК 1: Відкрити калькулятор
        console.log(`${COLORS.cyan}📱 Відкриваю калькулятор...${COLORS.reset}`);
        execSync('open -a Calculator', { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // КРОК 2: Ввести число 42
        console.log(`${COLORS.cyan}⌨️  Вводжу число 42...${COLORS.reset}`);
        execSync('osascript -e \'tell application "Calculator" to activate\'', { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 500));

        execSync(`osascript -e 'tell application "System Events" to keystroke "4"'`, { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 200));
        execSync(`osascript -e 'tell application "System Events" to keystroke "2"'`, { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 500));

        // КРОК 3: Зробити скріншот
        const screenshotPath = '/tmp/atlas_calculator_test.png';
        console.log(`${COLORS.cyan}📸 Роблю скріншот...${COLORS.reset}`);
        execSync(`screencapture -x ${screenshotPath}`, { stdio: 'ignore' });

        if (!existsSync(screenshotPath)) {
            throw new Error('Screenshot не створено');
        }
        console.log(`${COLORS.green}✅ Screenshot збережено: ${screenshotPath}${COLORS.reset}`);

        // КРОК 3.5: Стиснути зображення для Vision API
        console.log(`${COLORS.cyan}🔧 Стискаю зображення для Vision API...${COLORS.reset}`);
        const compressedPath = '/tmp/atlas_calculator_compressed.jpg';

        try {
            // Спроба 1: Sharp (найкраще стискання)
            const sharp = (await import('sharp')).default;
            await sharp(screenshotPath)
                .resize(512, 512, { fit: 'inside' })  // Max 512x512 для менших токенів
                .jpeg({ quality: 70, progressive: true })  // JPEG 70%
                .toFile(compressedPath);
            console.log(`${COLORS.green}✅ Стиснуто через Sharp${COLORS.reset}`);
        } catch (sharpError) {
            // Fallback: sips (macOS built-in)
            console.log(`${COLORS.yellow}⚠️  Sharp недоступний, використовую sips...${COLORS.reset}`);
            execSync(`sips -s format jpeg -s formatOptions 70 -Z 512 ${screenshotPath} --out ${compressedPath}`, { stdio: 'ignore' });
            console.log(`${COLORS.green}✅ Стиснуто через sips${COLORS.reset}`);
        }

        // КРОК 4: Конвертувати в base64
        const imageBuffer = readFileSync(compressedPath);
        const base64Image = imageBuffer.toString('base64');
        console.log(`${COLORS.cyan}🔄 Base64 розмір: ${Math.round(base64Image.length / 1024)}KB${COLORS.reset}`);

        // Call Port 4000 Vision API with compressed image
        console.log('\n🔍 Calling Port 4000 Vision API (copilot-gpt-4o)...');
        const startTime = Date.now();
        const response = await axios.post('http://localhost:4000/v1/chat/completions', {
            model: 'copilot-gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Analyze this screenshot. Is the number "42" visible on macOS Calculator?

CRITICAL: Your response MUST be ONLY valid JSON. No markdown, no explanations, no text before or after.

Response format:
{"verified":true,"confidence":95,"reason":"Number 42 visible on calculator display","visual_evidence":{"observed":"Calculator showing 42","matches_criteria":true,"details":"Display clearly shows digits 4 and 2"},"suggestions":null}

Now analyze the image and respond with JSON only:`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.0,
            max_tokens: 500
        });

        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`${COLORS.cyan}⏱️  Vision API відповів за ${duration} сек${COLORS.reset}`);

        const content = response.data.choices[0].message.content;

        // Парсинг JSON відповіді
        let result;
        try {
            // Очистити markdown wrappers
            let cleanContent = content;
            if (typeof content === 'string') {
                cleanContent = content
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim();
            }
            result = JSON.parse(cleanContent);
        } catch (parseError) {
            console.error(`${COLORS.red}❌ Помилка парсингу JSON: ${parseError.message}${COLORS.reset}`);
            console.error(`${COLORS.yellow}Raw response:\n${content}${COLORS.reset}`);
            throw parseError;
        }

        // Вивід результатів
        console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        console.log(`${COLORS.cyan}📊 ВЕРДИКТ ГРІШІ:${COLORS.reset}\n`);

        console.log(`${COLORS.yellow}Верифіковано:${COLORS.reset} ${result.verified ? COLORS.green + '✅ ТАК' : COLORS.red + '❌ НІ'}${COLORS.reset}`);
        console.log(`${COLORS.yellow}Впевненість:${COLORS.reset} ${result.confidence}%`);
        console.log(`${COLORS.yellow}Причина:${COLORS.reset} ${result.reason}`);

        if (result.visual_evidence) {
            console.log(`\n${COLORS.yellow}Візуальні докази:${COLORS.reset}`);
            console.log(`  • Спостережено: ${result.visual_evidence.observed}`);
            console.log(`  • Відповідає критеріям: ${result.visual_evidence.matches_criteria ? '✅' : '❌'}`);
            console.log(`  • Деталі: ${result.visual_evidence.details}`);
        }

        if (result.suggestions) {
            console.log(`\n${COLORS.yellow}💡 Пропозиції:${COLORS.reset} ${result.suggestions}`);
        }

        console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

        // Фінальний результат
        if (result.verified && result.confidence >= 70) {
            console.log(`${COLORS.green}🎉 УСПІХ! Гриша підтвердив що число 42 на калькуляторі!${COLORS.reset}\n`);
            return true;
        } else {
            console.log(`${COLORS.red}❌ ПОМИЛКА! Гриша НЕ підтвердив очікуваний результат${COLORS.reset}\n`);
            return false;
        }

    } catch (error) {
        console.error(`${COLORS.red}❌ Помилка під час тесту: ${error.message}${COLORS.reset}`);
        if (error.response) {
            console.error(`${COLORS.red}   Status: ${error.response.status}${COLORS.reset}`);
            console.error(`${COLORS.red}   Data: ${JSON.stringify(error.response.data, null, 2)}${COLORS.reset}`);
        }
        return false;
    } finally {
        // Закрити калькулятор
        try {
            execSync('osascript -e \'tell application "Calculator" to quit\'', { stdio: 'ignore' });
        } catch {
            // Ignore
        }
    }
}

// Запуск тесту
testGrishaVision().then(success => {
    process.exit(success ? 0 : 1);
});
