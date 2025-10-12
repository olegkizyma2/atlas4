/**
 * LEGACY SHARED CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: 2025-10-12T00:54:39.393Z
 * 
 * ⚠️ Цей файл підтримується для зворотної сумісності
 * Рекомендується використовувати config/global-config.js
 */

// Імпорт з глобальної конфігурації
import GlobalConfig from './config/global-config.js';

// Експорт для зворотної сумісності
export const AGENTS = GlobalConfig.AGENTS;
export const WORKFLOW_STAGES = GlobalConfig.WORKFLOW_STAGES;
export const WORKFLOW_CONFIG = GlobalConfig.WORKFLOW_CONFIG;
export const API_ENDPOINTS = GlobalConfig.API_ENDPOINTS;
export const TTS_CONFIG = GlobalConfig.TTS_CONFIG;
export const VOICE_CONFIG = GlobalConfig.VOICE_CONFIG;
export const CHAT_CONFIG = GlobalConfig.CHAT_CONFIG;

// Utility функції
export function getAgentByName(name) {
    return GlobalConfig.getAgentConfig(name);
}

export function getWorkflowStage(stageNumber) {
    return GlobalConfig.getWorkflowStage(stageNumber);
}

export function getApiUrl(service, endpoint = '') {
    return GlobalConfig.getApiUrl(service, endpoint);
}

export function generateShortStatus(agent, stage, action) {
    return GlobalConfig.generateShortStatus(agent, stage, action);
}

// Експорт за замовчуванням
export default GlobalConfig;