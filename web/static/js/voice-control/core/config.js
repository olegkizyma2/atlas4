/**
 * VOICE CONTROL CORE CONFIGURATION
 * 🔄 Автоматично згенеровано Config Manager
 * 📅 Останнє оновлення: 2025-10-12T00:54:39.393Z
 * 
 * ⚠️ НЕ РЕДАГУЙТЕ ЦЕЙ ФАЙЛ ВРУЧНУ!
 * Всі зміни будуть перезаписані при наступній синхронізації.
 * Для змін використовуйте config/global-config.js
 */

// Експорт розширених конфігурацій для voice control core
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
        "confidenceThreshold": 0.5,
        "errorHandling": {
            "maxConsecutiveNoSpeech": 3,
            "maxNetworkErrors": 10,
            "networkBackoffBase": 2000,
            "networkBackoffMax": 60000,
            "networkExtendedCooldownAfter": 3,
            "extendedCooldownDuration": 30000
        }
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
        "temperature": 0.0,              // ENHANCED: 0.0 for maximum accuracy (було 0.2)
        "apiUrl": "https://api.openai.com/v1/audio/transcriptions",
        "timeout": 15000,                // ENHANCED: 15 sec (було 30 sec implicit)
        "retryAttempts": 3,
        "retryDelay": 300                // ENHANCED: 300ms швидкі retry
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
    }
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

export const API_ENDPOINTS = {
    "orchestrator": "http://localhost:5101",
    "frontend": "http://localhost:5001",
    "tts": "http://localhost:3001",
    "whisper": "http://localhost:3002",
    "goose": "http://localhost:3000",
    "recovery": "http://localhost:5102"
};

export const AUDIO_CONFIG = {
    "constraints": {
        "audio": {
            "echoCancellation": true,
            "noiseSuppression": true,
            "autoGainControl": true,
            "sampleRate": 48000,         // ENHANCED: 48kHz for better quality
            "channelCount": 1,
            "sampleSize": 16,            // NEW: 16-bit samples
            "latency": 0.01              // NEW: 10ms low latency
        }
    },
    "recording": {
        "maxDuration": 60000,            // ENHANCED: 60 sec (було 30 sec)
        "silenceTimeout": 1200,          // ENHANCED: 1.2 sec (було 2 sec) - швидша детекція
        "volumeThreshold": 0.01,
        "timeslice": 100,                // NEW: 100ms chunks - швидша передача
        "minDuration": 100               // NEW: 100ms мінімум
    },
    "mimeType": "audio/webm;codecs=opus",  // NEW: Opus codec
    "audioBitsPerSecond": 128000           // NEW: 128 kbps якісне кодування
};

// Utility функції
export function createAudioConstraints(config = AUDIO_CONFIG) {
    return {
        audio: {
            ...config.constraints.audio,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };
}

export function getVoiceErrorConfig() {
    return VOICE_CONFIG.recognition?.errorHandling || {};
}

export default VOICE_CONFIG;
