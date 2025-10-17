#!/usr/bin/env node

/**
 * ATLAS Grisha Vision Test - Direct Call
 * Прямий виклик Гріші для візуальної перевірки калькулятора
 *
 * Дата: 17.10.2025
 * Версія: 1.0.0
 */

import axios from 'axios';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const COLORS = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
console.log(`${COLORS.blue}   ATLAS - Прямий виклик Гріші для візуальної перевірки${COLORS.reset}`);
console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

async function testGrishaVision() {
    try {
        // КРОК 1: Відкрити калькулятор
        console.log(`${COLORS.cyan}📱 Відкриваю калькулятор...${COLORS.reset}`);
        execSync('open -a Calculator', { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Чекаємо 1.5 сек

        // КРОК 2: Ввести число 42
        console.log(`${COLORS.cyan}⌨️  Вводжу число 42...${COLORS.reset}`);
        execSync('osascript -e \'tell application "Calculator" to activate\'', { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Використовуємо AppleScript для введення
        execSync(`osascript -e 'tell application "System Events" to keystroke "4"'`, { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 200));
        execSync(`osascript -e 'tell application "System Events" to keystroke "2"'`, { stdio: 'ignore' });
        await new Promise(resolve => setTimeout(resolve, 500));

        // КРОК 3: Зробити скріншот калькулятора
        const screenshotPath = '/tmp/atlas_calculator_test.png';
        console.log(`${COLORS.cyan}📸 Роблю скріншот...${COLORS.reset}`);

        // Робимо скріншот всього екрану (калькулятор на передньому плані)
        execSync(`screencapture -x ${screenshotPath}`, { stdio: 'ignore' });

        if (!existsSync(screenshotPath)) {
            throw new Error('Screenshot не створено');
        }
        console.log(`${COLORS.green}✅ Screenshot збережено: ${screenshotPath}${COLORS.reset}`);        // КРОК 4: Викликати Грішу через orchestrator
        console.log(`\n${COLORS.yellow}👁️  Викликаю Грішу для візуальної перевірки...${COLORS.reset}\n`);

        // Використовуємо DI Container для прямого доступу до VisionAnalysisService
        const { DIContainer } = await import('../orchestrator/core/di-container.js');
        const { registerAllServices } = await import('../orchestrator/core/service-registry.js');

        const container = new DIContainer();
        await registerAllServices(container);
        await container.initialize();

        const visionService = container.resolve('visionAnalysis');

        const result = await visionService.analyzeScreenshot(
            screenshotPath,
            'На калькуляторі має бути відображено число 42',
            {
                action: 'Ввести число 42 в калькулятор',
                expectedResult: 'Число 42 відображається на дисплеї калькулятора'
            }
        );

        console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        console.log(`${COLORS.cyan}📊 РЕЗУЛЬТАТ ПЕРЕВІРКИ ГРІШІ:${COLORS.reset}\n`);

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
            console.log(`${COLORS.green}🎉 УСПІХ! Гриша підтвердив що число 42 відображається на калькуляторі!${COLORS.reset}\n`);
            return true;
        } else {
            console.log(`${COLORS.red}❌ ПОМИЛКА! Гриша НЕ підтвердив очікуваний результат${COLORS.reset}\n`);
            return false;
        }

    } catch (error) {
        console.error(`${COLORS.red}❌ Помилка під час тесту: ${error.message}${COLORS.reset}`);
        if (error.response) {
            console.error(`${COLORS.red}   Response: ${JSON.stringify(error.response.data, null, 2)}${COLORS.reset}`);
        }
        return false;
    } finally {
        // Закрити калькулятор
        try {
            execSync('osascript -e \'tell application "Calculator" to quit\'', { stdio: 'ignore' });
        } catch (e) {
            // Ignore
        }
    }
}

// Запуск тесту
testGrishaVision().then(success => {
    process.exit(success ? 0 : 1);
});
