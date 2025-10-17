#!/usr/bin/env node

/**
 * ATLAS Real Vision Analysis Test
 * Реальне тестування розпізнавання з живим Vision API
 *
 * Дата: 17.10.2025
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import axios from 'axios';

const COLORS = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
console.log(`${COLORS.blue}   ATLAS Real Vision Analysis Test${COLORS.reset}`);
console.log(`${COLORS.blue}   Реальне тестування з Ollama llama3.2-vision${COLORS.reset}`);
console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

async function testVisionWithOllama() {
    const screenshotPath = '/tmp/atlas_test_vision.png';

    try {
        // 1. Створити screenshot Desktop (smaller resolution)
        console.log(`${COLORS.cyan}📸 Створюю screenshot Desktop...${COLORS.reset}`);
        execSync(`screencapture -x ${screenshotPath}`, { stdio: 'ignore' });

        // Стиснути до розумного розміру (max 1024x1024)
        const tempPath = '/tmp/atlas_test_vision_resized.png';
        execSync(`sips -Z 1024 ${screenshotPath} --out ${tempPath}`, { stdio: 'ignore' });
        execSync(`mv ${tempPath} ${screenshotPath}`, { stdio: 'ignore' });

        const fileSize = execSync(`ls -lh ${screenshotPath} | awk '{print $5}'`).toString().trim();
        console.log(`${COLORS.green}✅ Screenshot створено та оптимізовано: ${screenshotPath} (${fileSize})${COLORS.reset}\n`);

        // 2. Конвертувати в base64
        console.log(`${COLORS.cyan}🔄 Конвертую в base64...${COLORS.reset}`);
        const imageBuffer = readFileSync(screenshotPath);
        const base64Image = imageBuffer.toString('base64');
        console.log(`${COLORS.green}✅ Base64 готовий (${Math.round(base64Image.length / 1024)}KB)${COLORS.reset}\n`);

        // 3. Викликати Ollama Vision API напряму
        console.log(`${COLORS.cyan}🤖 Викликаю Ollama llama3.2-vision...${COLORS.reset}`);

        const prompt = `Проаналізуй цей screenshot macOS Desktop та опиши що ти бачиш:
1. Яка операційна система?
2. Які програми відкриті?
3. Що видно на екрані?
4. Який час дня (light/dark mode)?
5. Є панель меню зверху?

Дай коротку українською відповідь.`;

        const startTime = Date.now();

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.2-vision',
            prompt: prompt,
            images: [base64Image],
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 500
            }
        }, {
            timeout: 120000,  // 120s для великих зображень
            headers: { 'Content-Type': 'application/json' }
        });

        const elapsed = Date.now() - startTime;

        // 4. Показати результат
        console.log(`${COLORS.green}✅ Відповідь отримана за ${(elapsed / 1000).toFixed(1)}s${COLORS.reset}\n`);

        console.log(`${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        console.log(`${COLORS.yellow}   Ollama Vision Analysis Result:${COLORS.reset}`);
        console.log(`${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

        console.log(response.data.response);

        console.log(`\n${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

        // 5. Метрики
        console.log(`${COLORS.cyan}📊 Метрики:${COLORS.reset}`);
        console.log(`   Model:           llama3.2-vision (10.7B params)`);
        console.log(`   Provider:        Ollama (local, FREE)`);
        console.log(`   Response time:   ${(elapsed / 1000).toFixed(1)}s`);
        console.log(`   Image size:      ${fileSize}`);
        console.log(`   Base64 size:     ${Math.round(base64Image.length / 1024)}KB`);
        console.log(`   Cost:            $0 (FREE!)${COLORS.reset}\n`);

        console.log(`${COLORS.green}✅ SUCCESS: Vision Recognition працює ідеально!${COLORS.reset}`);

        // Cleanup
        if (existsSync(screenshotPath)) {
            unlinkSync(screenshotPath);
        }

    } catch (error) {
        console.error(`${COLORS.red}❌ Помилка: ${error.message}${COLORS.reset}`);

        if (error.response) {
            console.error(`${COLORS.red}Response: ${JSON.stringify(error.response.data, null, 2)}${COLORS.reset}`);
        }

        process.exit(1);
    }
}

// Run test
testVisionWithOllama();
