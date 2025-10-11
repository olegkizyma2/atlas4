/**
 * TTS MANAGER MODULE
 * Винесена TTS логіка з intelligent-chat-manager.js
 */

import { logger } from '../core/logger.js';
import { TTS_CONFIG, AGENTS } from '../core/config.js';
import { ttsClient } from '../core/api-client.js';

export class TTSManager {
  constructor() {
    this.logger = new logger.constructor('TTS');
    this.enabled = TTS_CONFIG.enabled;
    this.currentAudio = null;
    this.queue = [];
    this.isProcessing = false;
    this.mode = localStorage.getItem('atlas_tts_mode') || 'standard';
    this.autoplayUnlocked = false;
    this._unlockHandlersAttached = false;
    this._pendingReplay = null; // {blob, agent}
    this.microphoneManager = null; // Буде встановлено ззовні
    this.ttsActive = false; // Трекінг активності TTS
    this._initialized = false;
    this._initPromise = null;
    /** @type {Map<string, Set<Function>>} */
    this._eventHandlers = new Map();
  }

  async init() {
    if (this._initialized) {
      this.logger.debug('TTS Manager already initialized, skipping...');
      return;
    }

    if (this._initPromise) {
      this.logger.debug('TTS Manager initialization already in progress, awaiting existing promise...');
      return this._initPromise;
    }

    this._initPromise = (async () => {
      try {
        this.logger.debug('Initializing TTSManager...');

        // Додаємо лог у веб-інтерфейс
        if (window.atlasLogger) {
          window.atlasLogger.info('🎵 Ініціалізація TTS System', 'TTS-System');
        }

        const { data } = await ttsClient.get('/health');
        this.logger.debug('TTS health check response:', data);
        this.enabled = data.status === 'ok' && data.tts_ready === true;
        this.logger.info(`TTS service ${this.enabled ? 'available' : 'unavailable'}`);

        // Додаємо лог у веб-інтерфейс
        if (window.atlasLogger) {
          if (this.enabled) {
            window.atlasLogger.success('✅ TTS сервіс готовий до озвучення', 'TTS-System');
          } else {
            window.atlasLogger.error('❌ TTS сервіс недоступний', 'TTS-System');
          }
        }
      } catch (error) {
        this.logger.error('TTS service initialization failed:', error.message);
        this.enabled = false;

        // Додаємо лог у веб-інтерфейс
        if (window.atlasLogger) {
          window.atlasLogger.error(`❌ TTS помилка: ${error.message}`, 'TTS-System');
        }
      }

      // Attach autoplay unlock on first user gesture
      this._attachAutoplayUnlockHandlers();

      // Підписка на події TTS
      this._subscribeToTTSEvents();
    })()
      .finally(() => {
        this._initialized = true;
        this._initPromise = null;
      });

    return this._initPromise;
  }

  /**
   * Підписка на події TTS
   * @private
   */
  _subscribeToTTSEvents() {
    // Відкладена підписка - eventManager може бути недоступний при ініціалізації
    const trySubscribe = () => {
      if (typeof window !== 'undefined' && window.eventManager) {
        const eventManager = window.eventManager;

        // Обробка запиту на озвучення (для activation responses)
        eventManager.on('TTS_SPEAK_REQUEST', async (event) => {
          const { text, agent, mode, priority, isActivationResponse } = event.payload || event;

          this.logger.info(`🔊 TTS_SPEAK_REQUEST received: "${text}" (agent: ${agent}, mode: ${mode}, activation: ${isActivationResponse})`);

          try {
            await this.speak(text, agent, {
              mode,
              priority,
              isActivationResponse
            });
          } catch (error) {
            this.logger.error('Failed to process TTS_SPEAK_REQUEST', null, error);
          }
        });

        this.logger.debug('✅ Subscribed to TTS events');
        return true;
      }
      return false;
    };

    // Спроба підписки зараз
    if (!trySubscribe()) {
      // Якщо не вдалося - спробуємо через 100ms
      this.logger.debug('⏳ EventManager not ready, retrying in 100ms...');
      setTimeout(() => {
        if (!trySubscribe()) {
          this.logger.warn('⚠️ EventManager not available after retry, TTS events disabled');
        }
      }, 100);
    }
  }

  setMode(mode) {
    if (TTS_CONFIG.modes[mode]) {
      this.mode = mode;
      localStorage.setItem('atlas_tts_mode', mode);
      this.logger.info(`TTS mode set to: ${mode}`);
    }
  }

  getMode() {
    return this.mode;
  }

  // Метод для встановлення зв'язку з мікрофон-менеджером
  setMicrophoneManager(micManager) {
    this.microphoneManager = micManager;
    this.logger.debug('Microphone manager connected to TTS');
  }

  addEventListener(event, handler) {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event).add(handler);
    return () => this.removeEventListener(event, handler);
  }

  removeEventListener(event, handler) {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (!handlers.size) {
      this._eventHandlers.delete(event);
    }
  }

  _emit(event, detail = {}) {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;

    const payload = { type: event, detail };
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        this.logger.warn(`TTS event handler error (${event})`, null, error);
      }
    });
  }

  isEnabled() {
    return this.enabled && localStorage.getItem('atlas_voice_enabled') !== 'false';
  }

  async synthesize(text, voice = TTS_CONFIG.defaultVoice, options = {}) {
    if (!this.enabled) {
      throw new Error('TTS service not available');
    }

    // Спеціальна обробка тексту для голосу mykyta
    let processedText = text;
    if (voice === 'mykyta') {
      // Покращена фільтрація для mykyta - зберігаємо більше українських знаків пунктуації
      processedText = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Видаляємо жирний текст
        .replace(/^\s*-\s*/gm, '')          // Видаляємо дефіси на початку рядків
        .replace(/#{1,6}\s*/g, '')          // Видаляємо заголовки markdown
        .replace(/`([^`]+)`/g, '$1')        // Видаляємо backticks
        .replace(/\n{3,}/g, '\n\n')         // Зменшуємо кількість переносів рядків
        .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // Видаляємо всі емодзі
        // Розширений regex що включає українські знаки пунктуації:
        // \u2010-\u2015: дефіси і тире (включає em dash —)
        // \u2026: три крапки (…)
        // \u2018-\u201F: лапки ("", '', ‚‛)
        .replace(/[^\u0400-\u04FF\u0020-\u007E\u00A0-\u00FF\u2010-\u2015\u2026\u2018-\u201F\s.,!?:;()"-]/g, '')
        .replace(/\s+/g, ' ')               // Нормалізуємо пробіли
        .trim();

      // Логування фільтрації для debugging
      if (processedText !== text) {
        this.logger.info(`[TTS] Text filtered for mykyta: "${text.substring(0, 50)}..." -> "${processedText.substring(0, 50)}..."`);
      }

      // Перевіряємо на порожній текст
      if (!processedText || processedText.length < 2) {
        processedText = 'Вибачте, не можу озвучити цей текст.';
        this.logger.warn(`[TTS] Text too short after filtering, using fallback`);
      }
    }

    try {
      // Адаптивний retry mechanism з polling замість статичного timeout
      let attempt = 0;
      const maxAttempts = 5;
      let lastError = null;

      while (attempt < maxAttempts) {
        attempt++;

        try {
          this.logger.info(`[TTS] Synthesis attempt ${attempt}/${maxAttempts} for voice ${voice}`);

          const { data } = await ttsClient.request('/tts', {
            method: 'POST',
            body: JSON.stringify({
              text: processedText,
              voice,
              return_audio: options.returnAudio || false,
              ...options
            }),
            responseType: options.return_audio || options.responseType === 'blob' ? 'blob' : undefined
          });

          // Успіх - повертаємо результат
          this.logger.info(`[TTS] Synthesis successful on attempt ${attempt}`);
          return data;

        } catch (error) {
          lastError = error;

          // Перевірка чи це tensor shape error (500)
          if (error.message?.includes('500') || error.message?.includes('INTERNAL SERVER ERROR')) {
            this.logger.warn(`[TTS] Attempt ${attempt} failed with tensor error, retrying...`);

            // Адаптивна затримка: ШВИДША ніж раніше (300ms базова замість 1000ms)
            // Attempt 1: 300ms, 2: 600ms, 3: 900ms, 4: 1200ms, 5: 1500ms
            const delay = Math.min(300 * attempt, 2000); // Максимум 2 секунди
            await new Promise(resolve => setTimeout(resolve, delay));

            // Якщо не остання спроба - продовжуємо
            if (attempt < maxAttempts) {
              continue;
            }
          }

          // Для інших помилок або останньої спроби - кидаємо помилку
          throw error;
        }
      }

      // Якщо всі спроби вичерпані
      this.logger.error(`[TTS] All ${maxAttempts} attempts failed for voice ${voice}`);
      throw lastError || new Error('TTS synthesis failed after all retries');

    } catch (error) {
      this.logger.error(`TTS synthesis failed for voice ${voice}`, error.message);
      throw error;
    }
  }

  async playAudio(audioBlob, agent = 'atlas') {
    // Ensure autoplay unlocking is armed
    this._attachAutoplayUnlockHandlers();

    // Отримуємо опції поточного TTS (mode, isActivationResponse)
    const ttsOptions = this._currentTTSOptions || {};

    return new Promise((resolve, reject) => {
      this.logger.info(`Creating audio URL for ${agent}, blob size: ${audioBlob?.size || 'unknown'}`);

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Встановлюємо максимальну гучність для забезпечення чутності
      audio.volume = 1.0;
      this.logger.info(`Audio volume set to: ${audio.volume}`);

      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.ttsActive = false;
        this.logger.info(`Audio playback completed for ${agent}`, ttsOptions);

        // Повідомляємо мікрофон-менеджер про завершення TTS
        if (this.microphoneManager && this.microphoneManager.onTTSEnded) {
          this.microphoneManager.onTTSEnded();
        }

        // Запускаємо пост-чат аналіз якщо це було в режимі чату
        this.triggerPostChatAnalysis(agent);

        // Emit DOM events about TTS completion (CRITICAL: включаємо isActivationResponse!)
        try {
          window.dispatchEvent(new CustomEvent('atlas-tts-completed', { 
            detail: { agent, ...ttsOptions } 
          }));
          window.dispatchEvent(new CustomEvent('atlas-tts-end', { 
            detail: { agent, ...ttsOptions } 
          }));
        } catch {
          // Ignore dispatch errors
        }

        // Emit через event handler (tts-end) для chat manager
        this._emit('tts-end', { agent, voice: agent, ...ttsOptions });

        // Очищаємо опції після використання
        this._currentTTSOptions = null;

        resolve();
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.logger.error(`Audio playback error for ${agent}:`, error);
        reject(error);
      };

      audio.onloadstart = () => {
        this.logger.info(`Audio loading started for ${agent}`);
      };

      audio.oncanplay = () => {
        this.logger.info(`Audio can play for ${agent}`);
      };

      // Запускаємо відтворення
      this.logger.info(`Starting audio playback for ${agent}`);
      this.ttsActive = true;

      // Повідомляємо мікрофон-менеджер про початок TTS
      if (this.microphoneManager && this.microphoneManager.onTTSStarted) {
        this.microphoneManager.onTTSStarted();
      }

      // Emit DOM events about TTS start
      try {
        window.dispatchEvent(new CustomEvent('atlas-tts-started', { detail: { agent } }));
        window.dispatchEvent(new CustomEvent('atlas-tts-start', { detail: { agent, audio } }));
      } catch {
        // Ignore dispatch errors
      }

      this.logger.info(`Attempting to play audio for ${agent}, autoplay unlocked: ${this.autoplayUnlocked}`);
      audio.play().catch((playError) => {
        // Handle autoplay restrictions gracefully
        const msg = String(playError);
        const notAllowed = /NotAllowedError|play\(\) failed because the user didn't interact/i.test(msg);
        this.logger.error(`Audio play failed for ${agent}: ${msg}`);
        if (notAllowed) {
          this.logger.warn(`Autoplay not allowed. Arming unlock and retry for ${agent}.`);
          // Queue replay on next user gesture
          this._pendingReplay = { blob: audioBlob, agent };
          this._awaitFirstUserGesture().then(async () => {
            try {
              // Retry once after unlock
              await this.playAudio(audioBlob, agent);
              resolve();
            } catch (e) {
              URL.revokeObjectURL(audioUrl);
              this.currentAudio = null;
              reject(e);
            }
          });
          return;
        }
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.logger.error(`Audio play failed for ${agent}:`, playError);
        reject(playError);
      });
    });
  }

  _attachAutoplayUnlockHandlers() {
    if (this._unlockHandlersAttached || typeof window === 'undefined') return;
    const unlock = async () => {
      try {
        // Try to resume WebAudio context as a generic unlock
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') await ctx.resume();
          // play a silent buffer
          const buffer = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(ctx.destination);
          src.start(0);
          // Stop quickly
          setTimeout(() => {
            try {
              src.stop();
              ctx.close();
            } catch {
              // Ignore cleanup errors
            }
          }, 10);
        }
        this.autoplayUnlocked = true;
        this.logger.info('Autoplay unlocked via user gesture');
      } catch (e) {
        this.logger.warn('Autoplay unlock attempt failed:', e?.message || e);
      } finally {
        this._detachAutoplayUnlockHandlers();
        // If there was a pending replay, trigger it
        if (this._pendingReplay) {
          const { blob, agent } = this._pendingReplay;
          this._pendingReplay = null;
          // Fire and forget; actual playAudio handles resolve/reject
          this.playAudio(blob, agent).catch(() => { });
        }
      }
    };
    this._unlockHandler = unlock;
    const types = ['click', 'pointerdown', 'touchstart', 'keydown'];
    types.forEach(t => window.addEventListener(t, unlock, { once: true, passive: true }));
    this._unlockHandlersAttached = true;
  }

  _detachAutoplayUnlockHandlers() {
    if (!this._unlockHandlersAttached || typeof window === 'undefined') return;
    const types = ['click', 'pointerdown', 'touchstart', 'keydown'];
    try {
      types.forEach(t => window.removeEventListener(t, this._unlockHandler, { once: true }));
    } catch {
      // Ignore detach errors
    }
    this._unlockHandlersAttached = false;
  }

  _awaitFirstUserGesture() {
    if (this.autoplayUnlocked) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { this.autoplayUnlocked = true; this._detachAutoplayUnlockHandlers(); resolve(); };
      const types = ['click', 'pointerdown', 'touchstart', 'keydown'];
      types.forEach(t => window.addEventListener(t, done, { once: true, passive: true }));
    });
  }

  async speak(text, agent = 'atlas', options = {}) {
    if (!this.isEnabled()) {
      this.logger.debug('TTS disabled, skipping speech');
      return;
    }

    // Зберігаємо isActivationResponse для передачі при завершенні
    const { isActivationResponse = false, mode = 'chat' } = options;
    
    // Зберігаємо в instance для доступу в playAudio
    this._currentTTSOptions = { isActivationResponse, mode, agent };

    // Визначаємо voice: якщо agent є голосом, використовуємо його, інакше отримуємо з конфігурації
    let voice;
    if (typeof agent === 'string' && !AGENTS[agent]) {
      // agent є голосом напряму
      voice = agent;
    } else if (AGENTS[agent]) {
      // agent є ім'ям агента, отримуємо voice з конфігурації
      voice = AGENTS[agent].voice;
    } else {
      // fallback до default voice
      voice = TTS_CONFIG.defaultVoice;
    }
    const defaultVoice = TTS_CONFIG.defaultVoice;
    let currentVoice = voice || defaultVoice;
    let fallbackUsed = false;

    const maxRetries = TTS_CONFIG.maxRetries || 3;
    let attempt = 0;
    let lastError = null;

    this.logger.info(`Speaking for ${agent} (${currentVoice}): ${text.substring(0, 80)}...`);
    const synthOptionsBase = { returnAudio: true, responseType: 'blob', ...options };

    while (attempt <= maxRetries) {
      try {
        // Генеруємо аудіо з поверненням blob
        this.logger.info(`Requesting TTS (attempt ${attempt + 1}/${maxRetries + 1}) using voice ${currentVoice}`);
        const audioBlob = await this.synthesize(text, currentVoice, synthOptionsBase);
        this.logger.info(`Received TTS blob, size: ${audioBlob?.size || 'unknown'}`);
        this._emit('tts-start', { agent, voice: currentVoice, text });
        // CRITICAL FIX: Pass agent (atlas/tetyana/grisha) NOT voice (mykyta/dmytro) for completion tracking
        await this.playAudio(audioBlob, agent);
        return; // success
      } catch (error) {
        lastError = error;
        const statusText = error?.message || '';
        const isServerError = /HTTP\s*5\d\d/i.test(statusText) || /Internal Server Error/i.test(statusText);
        const shouldRetry = isServerError && attempt < maxRetries;
        this.logger.error(`[TTS] Speech failed for ${agent} with voice ${currentVoice} ${statusText}`);

        // Спочатку пробуємо retry з тим самим голосом
        if (shouldRetry) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 6000) + Math.floor(Math.random() * 250);
          this.logger.info(`Retrying TTS with same voice ${currentVoice} in ${backoff}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoff));
          attempt++;
          continue;
        }

        // Тільки після всіх retry спроб переходимо на fallback voice
        const canFallback = !fallbackUsed && currentVoice !== defaultVoice;
        if (canFallback) {
          this.logger.warn(`[TTS] All retries failed. Falling back to default voice ${defaultVoice} after failure with ${currentVoice}`);
          currentVoice = defaultVoice;
          fallbackUsed = true;
          attempt = 0; // Скидуємо лічильник спроб для нового голосу
          continue;
        }
        break;
      }
    }

    // Фолбек: браузерний speechSynthesis, якщо доступний
    try {
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        this._emit('tts-start', { agent, voice: currentVoice, text });
        await new Promise((resolve) => {
          try {
            const utter = new SpeechSynthesisUtterance(text);
            const pickVoice = () => {
              const voices = window.speechSynthesis.getVoices();
              const ua = voices.find(v => (v.lang || '').toLowerCase().startsWith('uk'));
              const ru = voices.find(v => (v.lang || '').toLowerCase().startsWith('ru'));
              const en = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
              return ua || ru || en || voices[0];
            };
            const setVoice = () => {
              const v = pickVoice();
              if (v) utter.voice = v;
            };
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
              const once = () => { window.speechSynthesis.onvoiceschanged = null; setVoice(); };
              window.speechSynthesis.onvoiceschanged = once;
            }
            setVoice();
            utter.onend = () => resolve();
            utter.onerror = () => resolve();
            // Emit TTS started/completed around browser TTS too
            try {
              window.dispatchEvent(new CustomEvent('atlas-tts-started', { detail: { agent: currentVoice } }));
            } catch {
              // Ignore dispatch errors
            }
            this._emit('tts-start', { agent, voice: currentVoice, text });
            window.speechSynthesis.speak(utter);
            utter.onend = () => {
              try {
                window.dispatchEvent(new CustomEvent('atlas-tts-completed', { detail: { agent: currentVoice } }));
              } catch {
                // Ignore dispatch errors
              }
              this._emit('tts-end', { agent, voice: currentVoice });
              resolve();
            };
          } catch {
            resolve();
          }
        });
      }
    } catch {
      // Ignore browser TTS errors
    }

    // Пробрасываем последнюю ошибку для логики наверху, если нужно
    if (lastError) throw lastError;
  }

  segmentText(text, maxLength = TTS_CONFIG.chunking?.maxChunkSize || 500) {
    if (!text || text.length <= maxLength) {
      return [text];
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const segments = [];
    let currentSegment = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (currentSegment.length + trimmed.length + 1 <= maxLength) {
        currentSegment += (currentSegment ? '. ' : '') + trimmed;
      } else {
        if (currentSegment) {
          segments.push(currentSegment + '.');
        }
        currentSegment = trimmed;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment + '.');
    }

    // НЕ ОБРІЗАЄМО сегменти! Озвучуємо весь текст
    this.logger.info(`[TTS] Text segmented into ${segments.length} segments for TTS processing`);
    return segments;
  }

  async speakSegmented(text, agent = 'atlas', options = {}) {
    const segments = this.segmentText(text);
    this.logger.info(`[TTS] Starting segmented speech for ${agent}: ${segments.length} segments, total length: ${text.length} chars`);

    let successfulSegments = 0;
    let failedSegments = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      try {
        this.logger.debug(`[TTS] Playing segment ${i + 1}/${segments.length} for ${agent}: "${segment.substring(0, 50)}..."`);
        await this.speak(segment, agent, options);
        successfulSegments++;

        // Невелика пауза між сегментами для плавності
        if (i < segments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        failedSegments++;
        this.logger.error(`[TTS] Failed to play segment ${i + 1}/${segments.length} for ${agent}:`, error.message);

        // Продовжуємо з наступним сегментом, але логуємо помилку
        if (failedSegments >= 3) {
          this.logger.error(`[TTS] Too many failed segments (${failedSegments}), aborting segmented playback`);
          throw new Error(`Multiple TTS segment failures: ${failedSegments} failed out of ${i + 1}`);
        }
      }
    }

    this.logger.info(`[TTS] Segmented speech completed for ${agent}: ${successfulSegments} successful, ${failedSegments} failed`);

    if (failedSegments > 0) {
      this.logger.warn(`[TTS] Some segments failed during playback: ${failedSegments}/${segments.length}`);
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.queue = [];
    this.isProcessing = false;
    this.ttsActive = false;
    this._emit('tts-end', { agent: null });

    // Повідомляємо мікрофон-менеджер про зупинку TTS
    if (this.microphoneManager && this.microphoneManager.onTTSEnded) {
      this.microphoneManager.onTTSEnded();
    }
    this.isProcessing = false;
  }

  /**
     * Запуск пост-чат аналізу після завершення TTS в режимі чату
     */
  async triggerPostChatAnalysis(agent) {
    // Перевіряємо чи це Atlas: розширена перевірка
    const atlasVoice = (AGENTS && AGENTS['atlas'] && AGENTS['atlas'].voice) ? AGENTS['atlas'].voice : null;
    const isAtlas = agent === 'atlas' ||
      (atlasVoice && agent === atlasVoice) ||
      (typeof agent === 'string' && agent.toLowerCase().includes('atlas')) ||
      (typeof agent === 'string' && agent.toLowerCase().includes('tetiana')) || // Тетяна теж може викликати пост-чат
      (typeof agent === 'string' && agent.toLowerCase().includes('grisha')); // Гриша теж

    this.logger.debug(`TTS completed for agent: ${agent}, isAtlas: ${isAtlas}, atlasVoice: ${atlasVoice}`);

    if (isAtlas && this.microphoneManager && this.microphoneManager.startPostChatAnalysis) {
      try {
        this.logger.info(`🎧 Triggering post-chat analysis after ${agent} TTS completion`);
        await this.microphoneManager.startPostChatAnalysis();
      } catch (error) {
        this.logger.error('Failed to trigger post-chat analysis:', error);
      }
    } else {
      this.logger.debug(`Post-chat analysis not triggered: agent=${agent}, isAtlas=${isAtlas}, micManager=${!!this.microphoneManager}`);
    }
  }

  // Queue management for sequential playback
  async addToQueue(text, agent = 'atlas', options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        text,
        agent,
        options,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      try {
        const { text, agent, options } = item;

        // Визначаємо чи потрібно чанкування на основі режиму та довжини
        const isTaskMode = options.mode === 'task';
        const shouldChunk = isTaskMode && text.length > 500;

        this.logger.info(`Processing TTS queue item: agent=${agent}, mode=${options.mode || 'chat'}, chunking=${shouldChunk}, length=${text.length}`);

        if (shouldChunk) {
          await this.speakSegmented(text, agent, options);
        } else {
          await this.speak(text, agent, options);
        }

        item.resolve();
      } catch (error) {
        this.logger.error(`TTS queue processing failed:`, error);
        item.reject(error);
      }
    }

    this.isProcessing = false;
  }
}
