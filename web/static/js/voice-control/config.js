/**
 * VOICE CONTROL CONFIGURATION (browser-safe)
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: 2025-10-12T00:54:39.391Z
 */

export const VOICE_CONFIG = {
    "enabled": true,
    "activation": {
        "keywords": [
            "атлас",
            "atlas",
            "атлаз",
            "атлус",
            "атлес",
            "атлос",
            "атляс",
            "отлас",
            "отлаз",
            "отлус",
            "адлас",
            "адлаз",
            "атлась",
            "атласе",
            "атласо",
            "атлаша",
            "atlus",
            "atlass",
            "atlaz",
            "atlos",
            "adlas",
            "adlus",
            "atlash",
            "atlase",
            "ітлас",
            "ітлус",
            "етлас",
            "етлус",
            "атлаас",
            "атлаш",
            "атлач",
            "а́тлас",
            "атла́с",
            "тлас",
            "тлус",
            "тлаз",
            "ей атлас",
            "гей атлас",
            "слухай",
            "слухай атлас",
            "слухай",
            "слухай атлас",
            "гей",
            "ей",
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
            "коментуйте",
            "до зустрічі",
            "підписуйся на канал",
            "ставте лайк",
            "лайкніть",
            "до наступного відео",
            "вказуйте коментарях",
            "пишіть коментарях"
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
    },
    "ACTIVATION_KEYWORD": "атлас",
    "SPEECH_RECOGNITION": {
        "language": "uk-UA",
        "continuous": true,
        "interimResults": true,
        "maxAlternatives": 3,
        "confidenceThreshold": 0.5
    },
    "WHISPER_CONFIG": {
        "model": "whisper-1",
        "language": "uk",
        "response_format": "json",
        "temperature": 0.2,
        "apiUrl": "https://api.openai.com/v1/audio/transcriptions"
    },
    "STOP_KEYWORDS": [
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
    "BUTTON_STATES": {
        "IDLE": "idle",
        "GREEN_MODE": "green_mode",
        "BLUE_MODE": "blue_mode",
        "PROCESSING": "processing"
    },
    "BUTTON_ICONS": {
        "IDLE": "🎤",
        "GREEN_MODE": "🟢",
        "BLUE_MODE": "🔵",
        "PROCESSING": "⏳"
    },
    "POST_CHAT_CONFIG": {
        "enabled": true,
        "windowMs": 8000,
        "analysisInterval": 100,
        "confidenceThreshold": 0.7,
        "vadThreshold": 0.01,
        "minSpeechDuration": 500,
        "minSilenceMs": 3000
    },
    "POST_CHAT": {
        "enabled": true,
        "windowMs": 8000,
        "analysisInterval": 100,
        "confidenceThreshold": 0.7,
        "vadThreshold": 0.01,
        "minSpeechDuration": 500,
        "minSilenceMs": 3000
    },
    "BACKGROUND_PHRASE_FILTER": {
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
            "коментуйте",
            "до зустрічі",
            "підписуйся на канал",
            "ставте лайк",
            "лайкніть",
            "до наступного відео",
            "вказуйте коментарях",
            "пишіть коментарях"
        ]
    }
};

// TTS конфігурація
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

// API endpoints
export const API_ENDPOINTS = {
    "orchestrator": "http://localhost:5101",
    "frontend": "http://localhost:5001",
    "tts": "http://localhost:3001",
    "whisper": "http://localhost:3002",
    "goose": "http://localhost:3000",
    "recovery": "http://localhost:5102"
};

// Utility функції для голосового управління
export function isBackgroundPhrase(text) {
    if (!text || typeof text !== 'string') return true;
    
    const config = VOICE_CONFIG.BACKGROUND_PHRASE_FILTER;
    if (!config.enabled) return false;
    
    const cleanText = text.toLowerCase().trim();
    
    if (cleanText.length < config.minPhraseLength) return true;
    
    for (const ignoredPhrase of config.ignoredPhrases) {
        if (cleanText.includes(ignoredPhrase.toLowerCase())) {
            return true;
        }
    }
    
    if (cleanText.length <= config.maxBackgroundLength) {
        const commonBackgroundWords = [
            'так', 'ні', 'добре', 'гаразд', 'окей', 'ок', 'угу', 'ага',
            'хм', 'ем', 'ну', 'от', 'це', 'то', 'а', 'і', 'або', 'але',
            'дякую', 'спасибі', 'будь ласка', 'вибачте', 'пробачте'
        ];
        
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        if (words.length <= 2 && words.every(word => commonBackgroundWords.includes(word))) {
            return true;
        }
    }
    
    return false;
}

export function isUserCommand(text, confidence = 1.0) {
    if (isBackgroundPhrase(text)) return false;
    
    const config = VOICE_CONFIG.BACKGROUND_PHRASE_FILTER;
    
    if (confidence < config.commandConfidenceThreshold && text.length < 20) {
        return false;
    }
    
    const commandIndicators = [
        'що', 'як', 'де', 'коли', 'чому', 'хто', 'скільки', 'який', 'яка', 'яке', 'які',
        'зроби', 'створи', 'напиши', 'покажи', 'знайди', 'відкрий', 'закрий', 'запусти',
        'допоможи', 'поясни', 'розкажи', 'скажи', 'можеш', 'хочу', 'потрібно', 'треба'
    ];
    
    const lowerText = text.toLowerCase();
    const hasCommandIndicator = commandIndicators.some(indicator => lowerText.includes(indicator));
    
    if (hasCommandIndicator) return true;
    if (text.length > 30) return true;
    
    return confidence >= config.commandConfidenceThreshold;
}

export default VOICE_CONFIG;