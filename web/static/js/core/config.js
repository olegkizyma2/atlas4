/**
 * CORE CONFIGURATION (browser-safe)
 * 🔄 Автоматично згенеровано Config Manager  
 * 📅 Останнє оновлення: 2025-10-10T23:09:13.017Z
 */

export const AGENTS = {
    "atlas": {
        "role": "strategist_coordinator",
        "name": "Атлас",
        "signature": "[ATLAS]",
        "color": "#00ff00",
        "voice": "mykyta",
        "priority": 1,
        "description": "Стратег-координатор, завжди починає першим",
        "enableTools": false,
        "model": "github-copilot",
        "maxRetries": 2,
        "timeout": 30000
    },
    "tetyana": {
        "role": "executor",
        "name": "Тетяна",
        "signature": "[ТЕТЯНА]",
        "color": "#00ffff",
        "voice": "tetiana",
        "priority": 2,
        "description": "Основний виконавець завдань",
        "enableTools": true,
        "model": "github-copilot",
        "maxRetries": 3,
        "timeout": 60000
    },
    "grisha": {
        "role": "verifier_finalizer",
        "name": "Гриша",
        "signature": "[ГРИША]",
        "color": "#ffff00",
        "voice": "dmytro",
        "priority": 3,
        "description": "Верифікатор результатів та фінальний контроль",
        "enableTools": true,
        "model": "github-copilot",
        "maxRetries": 2,
        "timeout": 45000
    },
    "system": {
        "role": "system_completion",
        "name": "System",
        "signature": "[SYSTEM]",
        "color": "#888888",
        "voice": null,
        "priority": 4,
        "description": "Системне завершення workflow",
        "enableTools": false,
        "model": null,
        "maxRetries": 1,
        "timeout": 10000
    },
    "tts-optimizer": {
        "role": "tts_optimization",
        "name": "стаже-3",
        "signature": "[TTS-OPT]",
        "color": "#ff6600",
        "voice": null,
        "priority": -3,
        "description": "Оптимізатор тексту для TTS озвучки",
        "enableTools": false,
        "model": "fallback-llm",
        "maxRetries": 2,
        "timeout": 15000
    }
};

export const USER_CONFIG = {
    "name": "Олег Миколайович",
    "title": "Творець",
    "role": "creator_admin",
    "formal_address": "Олег Миколайович",
    "casual_address": "творче",
    "description": "Творець системи ATLAS, божественний наставник",
    "permissions": [
        "all"
    ],
    "preferences": {
        "formal_communication": true,
        "detailed_responses": true,
        "technical_depth": "advanced"
    }
};

export const API_ENDPOINTS = {
    "orchestrator": "http://localhost:5101",
    "frontend": "http://localhost:5001",
    "tts": "http://localhost:3001",
    "whisper": "http://localhost:3002",
    "goose": "http://localhost:3000",
    "recovery": "http://localhost:5102"
};

export const TTS_CONFIG = {
    "enabled": true,
    "mode": "real",
    "defaultVoice": "mykyta",
    "supportedVoices": [
        "mykyta",
        "dmytro",
        "tetiana",
        "oleksa",
        "lada"
    ],
    "fallbackVoices": [
        "mykyta",
        "dmytro",
        "oleksa",
        "lada",
        "tetiana"
    ],
    "quality": {
        "sampleRate": 22050,
        "bitRate": 128,
        "format": "mp3",
        "speed": 1,
        "pitch": 0,
        "volume": 1
    },
    "maxRetries": 4,
    "retryDelay": 1000,
    "timeout": 30000,
    "chunking": {
        "enabled": true,
        "maxChunkSize": 500,
        "minChunkSize": 100,
        "sentenceSplit": true,
        "overlap": 20,
        "preserveWords": true,
        "continuousPlayback": true
    },
    "queue": {
        "enabled": true,
        "maxQueueSize": 50,
        "parallelProcessing": 3,
        "autoStart": true,
        "priorityByAgent": {
            "atlas": 1,
            "tetyana": 2,
            "grisha": 3,
            "system": 4
        }
    },
    "modes": {
        "quick": {
            "quality": "medium",
            "timeout": 15000,
            "cache": true,
            "chunking": {
                "maxChunkSize": 300
            }
        },
        "standard": {
            "quality": "high",
            "timeout": 30000,
            "cache": true,
            "chunking": {
                "maxChunkSize": 500
            }
        },
        "premium": {
            "quality": "highest",
            "timeout": 60000,
            "cache": false
        }
    },
    "cache": {
        "enabled": true,
        "maxSize": "500MB",
        "ttl": 86400000,
        "path": "./cache/tts"
    },
    "optimization": {
        "enabled": true,
        "characterLimit": {
            "enabled": true,
            "maxCharacters": 800,
            "warningThreshold": 600,
            "hardLimit": 1500,
            "customUserLimit": null
        },
        "sentences": {
            "maxSentences": 5,
            "minSentences": 3,
            "preferredSentences": 4
        },
        "length": {
            "maxLength": 500,
            "minLength": 20,
            "targetLength": 300
        },
        "fallback": {
            "onError": true,
            "preserveAgentTone": true,
            "simpleMode": false
        },
        "modes": {
            "chat": {
                "enabled": false,
                "maxCharacters": 1200
            },
            "task": {
                "enabled": true,
                "maxCharacters": 800,
                "aggressive": false
            }
        },
        "debug": {
            "enabled": true,
            "logOriginalLength": true,
            "logOptimizedLength": true,
            "logTimeTaken": true
        }
    }
};

export const VOICE_CONFIG = {
    "enabled": true,
    "activation": {
        "keywords": [
            "атлас",
            "atlas",
            "атлаз",
            "атлус",
            "атлес",
            "а́тлас",
            "атла́с",
            "ей атлас",
            "гей атлас",
            "слухай",
            "слухай атлас",
            "олег миколайович",
            "олеже миколайовичу"
        ],
        "confidence": 0.5,
        "language": "uk-UA",
        "timeout": 15000
    },
    "stopCommands": [
        "стоп",
        "зупинись",
        "зупини",
        "пауза",
        "почекай",
        "підожди",
        "замри",
        "зачекай",
        "стій",
        "припини",
        "halt",
        "freeze",
        "wait",
        "stop",
        "enough",
        "досить",
        "перервись",
        "cancel",
        "відміна",
        "скасувати"
    ],
    "recognition": {
        "language": "uk-UA",
        "continuous": true,
        "interimResults": true,
        "maxAlternatives": 3,
        "confidenceThreshold": 0.5
    },
    "recording": {
        "keywordMaxMs": 15000,
        "shortClickMaxMs": 15000,
        "silenceThresholdMs": 3000,
        "maxDuration": 60000
    },
    "whisper": {
        "model": "whisper-1",
        "language": "uk",
        "response_format": "json",
        "temperature": 0.2,
        "apiUrl": "https://api.openai.com/v1/audio/transcriptions"
    },
    "backgroundFilter": {
        "enabled": true,
        "minPhraseLength": 5,
        "maxBackgroundLength": 50,
        "confidenceThreshold": 0.6,
        "ignoredPhrases": [
            "дякую за перегляд",
            "дякую за увагу",
            "субтитрувальниця",
            "оля шор",
            "дякую!",
            "будь ласка",
            "до побачення",
            "підписуйтесь",
            "ставте лайки",
            "коментуйте"
        ]
    },
    "postChat": {
        "enabled": true,
        "windowMs": 8000,
        "analysisInterval": 100,
        "confidenceThreshold": 0.7,
        "vadThreshold": 0.01,
        "minSpeechDuration": 500,
        "minSilenceMs": 3000
    }
};

export const CHAT_CONFIG = {
    "maxMessages": 100,
    "messageRetention": 86400000,
    "autoScroll": true,
    "showTimestamps": true,
    "showAgentColors": true,
    "typing": {
        "showIndicator": true,
        "simulateDelay": true,
        "charactersPerSecond": 50
    },
    "persistence": {
        "enabled": true,
        "storageKey": "atlas_chat_history",
        "maxStorageSize": "10MB"
    }
};

export const WORKFLOW_STAGES = [
    {
        "stage": -3,
        "agent": "system",
        "name": "tts_optimization",
        "description": "Оптимізація відповіді для TTS озвучки",
        "required": false,
        "condition": "agent_response_for_tts",
        "maxRetries": 2,
        "timeout": 15000,
        "expectedStates": [
            "optimized",
            "fallback_used",
            "no_optimization_needed"
        ]
    },
    {
        "stage": -2,
        "agent": "system",
        "name": "post_chat_analysis",
        "description": "Пост-чат аналіз звернення користувача",
        "required": false,
        "condition": "atlas_chat_completed",
        "maxRetries": 0,
        "timeout": 5000,
        "expectedStates": [
            "continue_chat",
            "ignore",
            "clarify"
        ]
    },
    {
        "stage": 0,
        "agent": "system",
        "name": "mode_selection",
        "description": "Класифікація: чат або завдання",
        "required": true,
        "maxRetries": 0,
        "timeout": 10000,
        "expectedStates": [
            "chat",
            "task"
        ]
    },
    {
        "stage": 0,
        "agent": "atlas",
        "name": "stage0_chat",
        "description": "Atlas в режимі спілкування через API 4000",
        "required": false,
        "condition": "system_selected_chat",
        "maxRetries": 0,
        "timeout": 30000,
        "expectedStates": [
            "chat_response"
        ]
    },
    {
        "stage": 1,
        "agent": "atlas",
        "name": "initial_processing",
        "description": "Формалізація та структурування завдання",
        "required": true,
        "condition": "system_selected_task",
        "maxRetries": 1,
        "timeout": 45000,
        "expectedStates": [
            "task_processed",
            "needs_clarification"
        ]
    },
    {
        "stage": 2,
        "agent": "tetyana",
        "name": "execution",
        "description": "Виконання сформалізованого завдання",
        "required": true,
        "maxRetries": 2,
        "timeout": 180000,
        "expectedStates": [
            "completed",
            "incomplete",
            "blocked"
        ]
    },
    {
        "stage": 3,
        "agent": "atlas",
        "name": "clarification",
        "description": "Надання уточнень для Тетяни",
        "required": false,
        "maxRetries": 1,
        "timeout": 30000,
        "expectedStates": [
            "clarified",
            "not_clarified"
        ]
    },
    {
        "stage": 4,
        "agent": "tetyana",
        "name": "retry",
        "description": "Повторне виконання з уточненнями",
        "required": false,
        "maxRetries": 2,
        "timeout": 90000,
        "expectedStates": [
            "completed",
            "incomplete",
            "blocked"
        ]
    },
    {
        "stage": 5,
        "agent": "grisha",
        "name": "diagnosis",
        "description": "Діагностика причин блокування",
        "required": false,
        "condition": "tetyana_still_blocked",
        "maxRetries": 1,
        "timeout": 45000,
        "expectedStates": [
            "problem_identified",
            "cannot_identify"
        ]
    },
    {
        "stage": 6,
        "agent": "atlas",
        "name": "task_adjustment",
        "description": "Корекція завдання на основі діагностики",
        "required": false,
        "condition": "grisha_provided_diagnosis",
        "maxRetries": 1,
        "timeout": 30000,
        "expectedStates": [
            "adjusted_task",
            "not_adjusted"
        ]
    },
    {
        "stage": 7,
        "agent": "grisha",
        "name": "verification",
        "description": "Перевірка правильності виконання",
        "required": true,
        "maxRetries": 1,
        "timeout": 60000,
        "expectedStates": [
            "verification_passed",
            "verification_failed",
            "verification_blocked"
        ]
    },
    {
        "stage": 8,
        "agent": "system",
        "name": "completion",
        "description": "Системне завершення workflow",
        "required": true,
        "maxRetries": 0,
        "timeout": 10000,
        "expectedStates": [
            "success",
            "failed",
            "timeout_exceeded"
        ]
    },
    {
        "stage": 9,
        "agent": "atlas",
        "name": "retry_cycle",
        "description": "Ініціація нового циклу виконання",
        "required": false,
        "condition": "should_retry_cycle",
        "maxRetries": 2,
        "timeout": 30000,
        "expectedStates": [
            "new_strategy",
            "retry_limit_reached",
            "user_update",
            "auto_fix"
        ]
    }
];

// Utility функції
export function getAgentByName(name) {
    if (!name) return null;
    const key = String(name).toLowerCase();
    return (AGENTS && AGENTS[key]) || null;
}

export function getWorkflowStage(stageNumber) {
    if (!Array.isArray(WORKFLOW_STAGES)) return null;
    return WORKFLOW_STAGES.find(stage => stage.stage === stageNumber) || null;
}

export function getApiUrl(service, endpoint = '') {
    const baseUrl = API_ENDPOINTS && API_ENDPOINTS[service];
    if (!baseUrl) throw new Error(`Невідомий сервіс: ${service}`);
    return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
}

export function generateShortStatus(agent, stage, action) {
    const statusMessages = {
        atlas: {
            stage1_initial_processing: "Atlas аналізує запит та готує завдання",
            stage0_chat: "Atlas відповідає в режимі спілкування",
            stage3_clarification: "Atlas надає уточнення",
            stage6_task_adjustment: "Atlas коригує завдання",
            stage9_retry_cycle: "Atlas координує новий цикл"
        },
        tetyana: {
            stage2_execution: "Тетяна виконує завдання",
            stage4_retry: "Тетяна повторює з уточненнями"
        },
        grisha: {
            stage5_diagnosis: "Гриша діагностує проблеми",
            stage7_verification: "Гриша перевіряє результати"
        },
        system: {
            stage0_mode_selection: "Система визначає тип запиту",
            stage8_completion: "Системне завершення"
        }
    };
    return (statusMessages[agent]?.[stage]) || `${agent} виконує ${stage}`;
}

export default {
    AGENTS,
    USER_CONFIG,
    API_ENDPOINTS,
    TTS_CONFIG,
    VOICE_CONFIG,
    CHAT_CONFIG,
    WORKFLOW_STAGES,
    getAgentByName,
    getWorkflowStage,
    getApiUrl,
    generateShortStatus
};