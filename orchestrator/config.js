/**
 * ORCHESTRATOR CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: 2025-10-10T23:09:13.016Z
 */

import GlobalConfig from '../config/global-config.js';

// Експортуємо серверні конфігурації
export const AGENTS = GlobalConfig.AGENTS;
export const WORKFLOW_STAGES = GlobalConfig.WORKFLOW_STAGES;
export const WORKFLOW_CONFIG = GlobalConfig.WORKFLOW_CONFIG;
export const API_ENDPOINTS = GlobalConfig.API_ENDPOINTS;
export const NETWORK_CONFIG = GlobalConfig.NETWORK_CONFIG;

// Серверні utility функції
export const getAgentConfig = GlobalConfig.getAgentConfig;
export const getWorkflowStage = GlobalConfig.getWorkflowStage;
export const getApiUrl = GlobalConfig.getApiUrl;
export const isServiceEnabled = GlobalConfig.isServiceEnabled;
export const getWebSocketUrl = GlobalConfig.getWebSocketUrl;
export const validateConfig = GlobalConfig.validateConfig;

// Налаштування середовища
export const ENV_CONFIG = GlobalConfig.ENV_CONFIG;
export const SECURITY_CONFIG = GlobalConfig.SECURITY_CONFIG;

export default GlobalConfig;