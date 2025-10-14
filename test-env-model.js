#!/usr/bin/env node
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: join(__dirname, '.env') });

console.log('=== ENV MODEL CHECK ===');
console.log('MCP_MODEL_TODO_PLANNING:', process.env.MCP_MODEL_TODO_PLANNING);
console.log('MCP_TEMP_TODO_PLANNING:', process.env.MCP_TEMP_TODO_PLANNING);
console.log('AI_BACKEND_MODE:', process.env.AI_BACKEND_MODE);
console.log('AI_BACKEND_DISABLE_FALLBACK:', process.env.AI_BACKEND_DISABLE_FALLBACK);

// Test config getter
import { MCP_MODEL_CONFIG } from './config/global-config.js';
const config = MCP_MODEL_CONFIG.getStageConfig('todo_planning');
console.log('\n=== CONFIG GETTER ===');
console.log('Model:', config.model);
console.log('Temperature:', config.temperature);
console.log('Max tokens:', config.max_tokens);
