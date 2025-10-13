#!/usr/bin/env node
/**
 * Test DI Container - MCP Services Registration
 * 
 * Перевіряє що всі MCP сервіси та processors зареєстровано
 * та можуть бути resolved через DI контейнер
 */

import { DIContainer } from '../orchestrator/core/di-container.js';
import { registerAllServices } from '../orchestrator/core/service-registry.js';

async function testMCPServices() {
    console.log('🧪 Testing DI Container - MCP Services Registration\n');

    try {
        // 1. Створити контейнер
        const container = new DIContainer();
        console.log('✅ DIContainer created');

        // 2. Зареєструвати всі сервіси
        registerAllServices(container);
        console.log('✅ All services registered');

        // 3. Ініціалізувати контейнер
        await container.initialize();
        console.log('✅ Container initialized\n');

        // 4. Перевірити core сервіси
        console.log('📦 Core Services:');
        const logger = container.resolve('logger');
        console.log('  - logger:', logger ? '✅' : '❌');
        
        const config = container.resolve('config');
        console.log('  - config:', config ? '✅' : '❌');

        // 5. Перевірити MCP workflow сервіси
        console.log('\n📦 MCP Workflow Services:');
        const ttsSyncManager = container.resolve('ttsSyncManager');
        console.log('  - ttsSyncManager:', ttsSyncManager ? '✅' : '❌');
        
        const mcpTodoManager = container.resolve('mcpTodoManager');
        console.log('  - mcpTodoManager:', mcpTodoManager ? '✅' : '❌');

        // 6. Перевірити MCP processors
        console.log('\n📦 MCP Stage Processors:');
        const processors = [
            'backendSelectionProcessor',
            'atlasTodoPlanningProcessor',
            'tetyanaПlanToolsProcessor',
            'tetyanaExecuteToolsProcessor',
            'grishaVerifyItemProcessor',
            'atlasAdjustTodoProcessor',
            'mcpFinalSummaryProcessor'
        ];

        let processorCount = 0;
        for (const name of processors) {
            const processor = container.resolve(name);
            const status = processor ? '✅' : '❌';
            console.log(`  - ${name}: ${status}`);
            if (processor) processorCount++;
        }

        // 7. Підсумок
        console.log('\n📊 Summary:');
        console.log(`  Total services: ${container.getServices().length}`);
        console.log(`  MCP processors: ${processorCount}/7`);

        if (processorCount === 7 && ttsSyncManager && mcpTodoManager) {
            console.log('\n✅ All MCP services registered successfully!');
            process.exit(0);
        } else {
            console.log('\n❌ Some services missing!');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMCPServices();
