/**
 * @fileoverview Whisper-based keyword detection for conversation mode
 * Забезпечує точне розпізнавання ключового слова "Атлас" через Whisper API
 *
 * @version 4.0.0
 * @date 2025-10-11 - 02:50 AM
 */

import { BaseService } from '../core/base-service.js';
import { API_ENDPOINTS } from '../core/config.js';
import { Events } from '../events/event-manager.js';
import { containsActivationKeyword, correctAtlasWord } from '../utils/voice-utils.js';

/**
 * Сервіс детекції ключових слів через Whisper
 * Працює в continuous режимі: слухає → 2-3 сек запис → Whisper → перевірка → repeat
 */
export class WhisperKeywordDetection extends BaseService {
    constructor(config = {}) {
        super({
            name: 'WHISPER_KEYWORD_DETECTION',
            version: '4.0.0',
            ...config
        });

        this.whisperUrl = config.whisperUrl || API_ENDPOINTS.whisper;
        this.keywords = config.keywords || ['атлас', 'atlas'];

        // Параметри continuous listening (OPTIMIZED 2025-10-11)
        this.chunkDuration = config.chunkDuration || 2000; // 2.0 сек (було 2.5) - швидша реакція
        this.pauseBetweenChunks = config.pauseBetweenChunks || 100; // 100ms (було 200ms) - менша затримка

        // Фільтр повторюваних фраз (фонові відео)
        this.recentTranscripts = []; // Останні 5 транскрипцій
        this.maxRecentTranscripts = 5;
        this.backgroundPhrases = [
            'дякую за перегляд',
            'підписуйся на канал',
            'ставте лайк',
            'субтитр',
            'кінець',
            'the end',
            'ending',
            'credits',
            // Додаткові фонові фрази (2025-10-11)
            'оля шор',
            'субтитрувальниця',
            'до зустрічі',
            'до побачення',
            'будь ласка',
            'дякую!',
            'дякую за увагу',
            'коментуйте',
            'підписуйтесь'
        ];

        // Стан
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.loopTimer = null;
        this.recordingTimer = null;
    }

    /**
                 * Ініціалізація
                 */
    async onInitialize() {
        try {
            // Підписка на події conversation mode
            this.subscribeToEvents();

            this.logger.info('Whisper keyword detection initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize Whisper keyword detection', null, error);
            return false;
        }
    }

    /**
                 * Підписка на події
                 */
    subscribeToEvents() {
        if (!this.eventManager) {
            this.logger.error('EventManager not available');
            return;
        }

        this.logger.info('🔗 Subscribing to START_KEYWORD_DETECTION event...');
        console.log('[WHISPER_KEYWORD] 🔗 Subscribing to START_KEYWORD_DETECTION event...', {
            eventManager: !!this.eventManager,
            eventManagerOn: typeof this.eventManager.on
        });

        // Запуск keyword listening
        this.eventManager.on('START_KEYWORD_DETECTION', async (event) => {
            const { keywords, mode } = event.payload || {};
            this.logger.info('🔍 Received START_KEYWORD_DETECTION event!', { keywords, mode });
            console.log('[WHISPER_KEYWORD] 🔍 Received START_KEYWORD_DETECTION event!', { keywords, mode, event });

            if (keywords && Array.isArray(keywords)) {
                this.keywords = keywords;
            }

            await this.startListening();
        });

        this.logger.info('✅ Subscribed to START_KEYWORD_DETECTION event');
        console.log('[WHISPER_KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION event');

        // Зупинка keyword listening
        this.eventManager.on('STOP_KEYWORD_DETECTION', async () => {
            this.logger.info('🛑 Stopping Whisper keyword detection');
            await this.stopListening();
        });
    }

    /**
                 * Початок continuous listening
                 */
    async startListening() {
        if (this.isListening) {
            console.log('[WHISPER_KEYWORD] Already listening');
            return;
        }

        try {
            console.log('[WHISPER_KEYWORD] 🎙️ Starting keyword listening...');

            // Get ALL available audio devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            console.log('[WHISPER_KEYWORD] 📋 Available audio inputs:', audioInputs);

            // Find REAL microphone (avoid Camo/BlackHole/Loopback virtual devices)
            // Priority 1: Explicitly look for AirPods or MacBook/Built-in mic
            let realMic = audioInputs.find(d => {
                const label = d.label.toLowerCase();
                return (label.includes('airpods') ||
                    label.includes('macbook') ||
                    label.includes('built-in')) &&
                    !label.includes('virtual');
            });

            // Priority 2: Any device that's NOT a virtual device
            if (!realMic) {
                realMic = audioInputs.find(d => {
                    const label = d.label.toLowerCase();
                    return !label.includes('camo') &&
                        !label.includes('blackhole') &&
                        !label.includes('loopback') &&
                        !label.includes('virtual');
                });
            }

            console.log('[WHISPER_KEYWORD] 🎤 Selected microphone:', realMic?.label || 'default');

            // Get microphone access with explicit device selection
            // ОПТИМІЗОВАНО (12.10.2025): Збільшено sample rate з 16kHz до 48kHz для кращої якості розпізнавання "Атлас"
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,        // ✅ 48 kHz high-quality (+200% від 16kHz)
                    sampleSize: 16,            // 16-bit samples
                    channelCount: 1            // Mono
                }
            };

            // Force specific device if found
            if (realMic?.deviceId) {
                constraints.audio.deviceId = { exact: realMic.deviceId };
                console.log('[WHISPER_KEYWORD] ✅ Forcing device:', realMic.label);
            } else {
                console.warn('[WHISPER_KEYWORD] ⚠️ No real microphone found, using default');
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.audioStream = this.stream; // ✅ FIX: Assign to audioStream for recordChunk()

            console.log('[WHISPER_KEYWORD] ✅ Got audio stream from:', this.stream.getAudioTracks()[0]?.label);

            this.isListening = true;
            this.startRecognitionLoop();

            this.logger.info('🎙️ Started keyword listening');

        } catch (error) {
            console.error('[WHISPER_KEYWORD] ❌ Error starting listening:', error);
            this.logger.error('Failed to start keyword listening', error);
            this.emit(Events.KEYWORD_DETECTION_ERROR, { error: error.message });
        }
    }

    /**
                 * Зупинка listening
                 */
    async stopListening() {
        this.isListening = false;

        // Зупинка таймерів
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
            this.recordingTimer = null;
        }

        // Зупинка запису
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Закриття audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Очищення історії транскрипцій
        this.recentTranscripts = [];

        this.logger.info('🛑 Stopped keyword listening');

        // Емісія події
        this.emit(Events.KEYWORD_DETECTION_STOPPED, {
            wasManual: true
        });
    }

    /**
                 * Цикл розпізнавання: запис → транскрипція → перевірка → repeat
                 */
    startRecognitionLoop() {
        if (!this.isListening) return;

        // Запис одного чанку
        this.recordChunk()
            .then(audioBlob => {
                if (!audioBlob || !this.isListening) return;

                // Відправка на Whisper
                return this.transcribeChunk(audioBlob);
            })
            .then(text => {
                if (!text || !this.isListening) return;

                // Перевірка на ключове слово
                this.checkForKeyword(text);
            })
            .catch(error => {
                this.logger.warn('Recognition loop error', null, error);
            })
            .finally(() => {
                // Пауза перед наступним чанком
                if (this.isListening) {
                    this.loopTimer = setTimeout(() => {
                        this.startRecognitionLoop();
                    }, this.pauseBetweenChunks);
                }
            });
    }

    /**
                 * Запис одного аудіо чанку
                 */
    async recordChunk() {
        return new Promise((resolve, reject) => {
            if (!this.audioStream) {
                reject(new Error('No audio stream available'));
                return;
            }

            this.audioChunks = [];

            // Створення MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.audioChunks = [];
                resolve(audioBlob);
            };

            this.mediaRecorder.onerror = (error) => {
                this.logger.error('MediaRecorder error', null, error);
                reject(error);
            };

            // Запуск запису
            this.mediaRecorder.start();

            // Зупинка після chunkDuration
            this.recordingTimer = setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, this.chunkDuration);
        });
    }

    /**
                 * Транскрипція аудіо чанку через Whisper
                 */
    async transcribeChunk(audioBlob) {
        try {
            // Конвертація в WAV для Whisper
            const wavBlob = await this.convertToWav(audioBlob);

            // Відправка на Whisper API
            const formData = new FormData();
            formData.append('audio', wavBlob, 'audio.wav');
            formData.append('language', 'uk');
            formData.append('temperature', '0.2');

            const response = await fetch(`${this.whisperUrl}/transcribe`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Whisper API error: ${response.status}`);
            }

            const result = await response.json();
            let text = result.text?.trim() || '';

            // ✅ FRONTEND КОРЕКЦІЯ (12.10.2025): Виправлення варіацій "Атлас"
            if (text) {
                text = correctAtlasWord(text);
            }

            this.logger.debug(`Whisper chunk: "${text}"`);
            console.log(`[WHISPER_KEYWORD] 📝 Transcribed: "${text}"`);
            return text;

        } catch (error) {
            this.logger.warn('Failed to transcribe chunk', null, error);
            return null;
        }
    }

    /**
                 * Конвертація webm → wav
                 */
    async convertToWav(webmBlob) {
        // Для Whisper потрібен WAV формат
        // Використовуємо той самий метод що і в WhisperService
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Отримання PCM даних
        const pcmData = audioBuffer.getChannelData(0);
        const wavBuffer = this.encodeWAV(pcmData, 16000);

        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    /**
                 * Кодування PCM → WAV
                 */
    encodeWAV(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // PCM samples
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    /**
                 * Запис string в DataView
                 */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
                 * Перевірка тексту на ключове слово
                 */
    checkForKeyword(text) {
        if (!text) {
            console.log('[WHISPER_KEYWORD] ⚠️ Empty text, skipping keyword check');
            return;
        }

        const textLower = text.toLowerCase();

        // ФІЛЬТР 1: Перевірка на фонові фрази (YouTube endings, credits)
        const isBackgroundPhrase = this.backgroundPhrases.some(phrase =>
            textLower.includes(phrase)
        );

        if (isBackgroundPhrase) {
            console.log('[WHISPER_KEYWORD] 🎬 Background phrase detected (YouTube/video ending), ignoring:', text);
            return;
        }

        // ФІЛЬТР 2: Перевірка на повторювану фразу (loop detection)
        this.recentTranscripts.push(textLower);
        if (this.recentTranscripts.length > this.maxRecentTranscripts) {
            this.recentTranscripts.shift(); // Видалити найстарішу
        }

        // Якщо фраза повторюється 3+ рази підряд = фоновий шум
        const repeatCount = this.recentTranscripts.filter(t => t === textLower).length;
        if (repeatCount >= 3) {
            console.log('[WHISPER_KEYWORD] 🔁 Repeated phrase detected (background loop), ignoring:', text);
            return;
        }

        // ФІЛЬТР 3: Перевірка довжини (фонові фрази часто довгі)
        if (textLower.length > 50) {
            console.log('[WHISPER_KEYWORD] 📏 Text too long (likely background), ignoring:', text);
            return;
        }

        console.log('[WHISPER_KEYWORD] 🔍 Checking for keyword in:', textLower, 'Keywords:', this.keywords);

        // Перевірка через voice-utils fuzzy matching
        const found = containsActivationKeyword(textLower, this.keywords);
        console.log('[WHISPER_KEYWORD] 🔍 Fuzzy match result:', found);

        if (found) {
            this.logger.info(`🎯 Keyword detected via Whisper: "${text}"`);
            console.log('[WHISPER_KEYWORD] 🎯 KEYWORD DETECTED!', text);

            // Генерація випадкової відповіді
            const response = this.getRandomActivationResponse();
            console.log('[WHISPER_KEYWORD] 🗣️ Generated response:', response);

            // Емісія події виявлення
            console.log('[WHISPER_KEYWORD] 📡 Emitting KEYWORD_DETECTED event...', {
                eventType: Events.KEYWORD_DETECTED,
                hasEventManager: !!this.eventManager,
                eventManager: this.eventManager
            });

            this.emit(Events.KEYWORD_DETECTED, {
                transcript: text,
                confidence: 0.95, // Whisper має високу точність
                keyword: this.keywords[0],
                response, // Додано відповідь для озвучення
                timestamp: new Date(),
                source: 'whisper',
                keywords: this.keywords
            });

            console.log('[WHISPER_KEYWORD] ✅ KEYWORD_DETECTED event emitted');

            // Зупинка listening після виявлення
            this.stopListening();
        } else {
            console.log('[WHISPER_KEYWORD] ❌ No keyword found in:', textLower);
        }
    }

    /**
       * Отримання відповіді на активацію з ротацією (БЕЗ повторів)
       * Використовує круговий буфер для гарантії різноманітності
       * @returns {string} - Наступна відповідь з ротації
       */
    getRandomActivationResponse() {
        // Ініціалізація ротаційного буфера при першому виклику
        if (!this._responseRotation) {
            this._responseRotation = {
                responses: [
                    'я уважно Вас слухаю Олег Миколайович',
                    'так творець, ви мене звали',
                    'весь в увазі',
                    'слухаю',
                    'так, Олег Миколайович',
                    'я тут, що потрібно?',
                    'готовий до роботи',
                    'на зв\'язку',
                    'слухаю уважно',
                    'так, творець',
                    'що бажаєте?',
                    'я готовий допомогти',
                    'у вашому розпорядженні',
                    'слухаю команди',
                    'готовий до виконання',
                    'так, шефе',
                    'активований та готовий',
                    'всі системи в нормі, слухаю',
                    'підключений, очікую інструкцій',
                    'готовий працювати, Олег Миколайович'
                ],
                currentPool: [], // Поточний пул доступних відповідей
                usedInSession: new Set(), // Використані в цій сесії
                lastUsed: null // Остання використана відповідь
            };
        }

        const rotation = this._responseRotation;

        // Якщо пул порожній - поповнюємо його (виключаючи останню використану)
        if (rotation.currentPool.length === 0) {
            rotation.currentPool = rotation.responses.filter(r => r !== rotation.lastUsed);
            this.logger.debug(`🔄 Response pool refreshed (${rotation.currentPool.length} responses)`);
        }

        // Вибираємо випадкову відповідь з пулу
        const randomIndex = Math.floor(Math.random() * rotation.currentPool.length);
        const selectedResponse = rotation.currentPool[randomIndex];

        // Видаляємо з пулу (не повториться до refresh)
        rotation.currentPool.splice(randomIndex, 1);

        // Зберігаємо як останню використану
        rotation.lastUsed = selectedResponse;
        rotation.usedInSession.add(selectedResponse);

        this.logger.debug(`🎲 Selected response: "${selectedResponse}" (pool: ${rotation.currentPool.length} left, session: ${rotation.usedInSession.size} unique)`);

        return selectedResponse;
    }

    /**
                 * Знищення сервісу
                 */
    async onDestroy() {
        await this.stopListening();
    }
}
