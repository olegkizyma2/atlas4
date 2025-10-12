/**
* Simple Voice Activity Detection (VAD)
*
* Аналізує аудіо рівень для виявлення коли користувач говорить або мовчить
* Created: 2025-10-11 17:15
*/

export class SimpleVAD {
  constructor(config = {}) {
    this.config = {
      silenceThreshold: config.silenceThreshold || 0.01, // Поріг тиші (RMS)
      silenceDuration: config.silenceDuration || 3000, // ✅ 3.0 сек тиші = кінець фрази (БУЛО 1.2s - занадто швидко!)
      minSpeechDuration: config.minSpeechDuration || 400, // ✅ Мінімум 400мс для валідної мови (фільтр коротких звуків)
      noiseSuppression: config.noiseSuppression ?? true, // Придушення шуму
      adaptiveThreshold: config.adaptiveThreshold ?? true, // Адаптивний поріг
      continueOnPause: config.continueOnPause ?? true, // ✅ NEW: продовжувати слухати якщо користувач робить паузу
      pauseGracePeriod: config.pauseGracePeriod || 3000, // ✅ NEW: додаткові 3 сек після першої тиші (дати час подумати)
      ...config
    };

    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isActive = false;

    // Стан виявлення
    this.isSpeaking = false;
    this.lastSpeechTime = null;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    
    // ✅ NEW: Multi-pause tracking (дозволяє паузи в мові)
    this.pauseCount = 0;
    this.firstSilenceTime = null;
    this.hasSpokenRecently = false;

    // Адаптивний поріг (NEW 2025-10-11)
    this.baselineNoiseLevel = 0;
    this.noiseHistory = [];
    this.maxNoiseHistory = 50;

    // Callbacks
    this.onSpeechStart = config.onSpeechStart || null;
    this.onSpeechEnd = config.onSpeechEnd || null;
    this.onSilenceDetected = config.onSilenceDetected || null;
    this.onAudioLevel = config.onAudioLevel || null;

    this.lastLevel = 0;
  }

  async initialize(stream) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.isActive = true;
    this.startMonitoring();
  }

  startMonitoring() {
    if (!this.isActive) {
      return;
    }

    const checkAudioLevel = () => {
      if (!this.isActive) {
        return;
      }

      const rms = this.calculateRMS();

      // Update adaptive threshold (NEW 2025-10-11)
      if (this.config.adaptiveThreshold) {
        this.updateAdaptiveThreshold(rms);
      }

      // Use adaptive or fixed threshold
      const threshold = this.config.adaptiveThreshold
        ? this.getAdaptiveThreshold()
        : this.config.silenceThreshold;

      const isSpeech = rms > threshold;

      this.lastLevel = rms;
      this.processAudioLevel(isSpeech, rms);

      if (this.onAudioLevel) {
        this.onAudioLevel({
          level: rms,
          isSpeech,
          threshold,
          timestamp: Date.now()
        });
      }

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  /**
   * Update adaptive noise threshold (NEW 2025-10-11)
   */
  updateAdaptiveThreshold(rms) {
    // Track noise levels when not speaking
    if (!this.isSpeaking) {
      this.noiseHistory.push(rms);

      if (this.noiseHistory.length > this.maxNoiseHistory) {
        this.noiseHistory.shift();
      }

      // Calculate baseline noise as median of history
      if (this.noiseHistory.length >= 10) {
        const sorted = [...this.noiseHistory].sort((a, b) => a - b);
        this.baselineNoiseLevel = sorted[Math.floor(sorted.length / 2)];
      }
    }
  }

  /**
   * Get adaptive threshold based on current noise level (NEW 2025-10-11)
   */
  getAdaptiveThreshold() {
    if (this.baselineNoiseLevel === 0) {
      return this.config.silenceThreshold;
    }

    // Threshold is 2.5x the baseline noise
    return Math.max(this.config.silenceThreshold, this.baselineNoiseLevel * 2.5);
  }

  calculateRMS() {
    if (!this.analyser || !this.dataArray) {
      return 0;
    }

    this.analyser.getByteTimeDomainData(this.dataArray);

    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i += 1) {
      const normalizedValue = (this.dataArray[i] - 128) / 128;
      sumSquares += normalizedValue * normalizedValue;
    }

    return Math.sqrt(sumSquares / this.dataArray.length);
  }

  processAudioLevel(isSpeech, rms) {
    const now = Date.now();

    if (isSpeech) {
      // Користувач говорить
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = now;
        this.onSpeechStart?.(now);
      }

      this.lastSpeechTime = now;
      this.hasSpokenRecently = true;
      
      // ✅ Скинути silence tracking - користувач продовжує говорити
      this.silenceStartTime = null;
      this.firstSilenceTime = null;
      this.pauseCount = 0;
      
    } else if (this.isSpeaking || this.hasSpokenRecently) {
      // Тиша після мови
      if (!this.silenceStartTime) {
        this.silenceStartTime = now;
        
        // Track first silence moment
        if (!this.firstSilenceTime) {
          this.firstSilenceTime = now;
        }
      }

      const silenceDuration = now - this.silenceStartTime;
      const totalSilenceDuration = now - (this.firstSilenceTime || this.silenceStartTime);
      const speechDuration = this.speechStartTime ? (now - this.speechStartTime) : 0;

      // ✅ SMART LOGIC: Двохетапна детекція
      // Етап 1: Перша тиша 3 сек → не зупиняти, дати ще шанс
      // Етап 2: Друга тиша 3 сек (загалом 6 сек) → зупинити
      
      const isFirstSilence = this.pauseCount === 0;
      const shouldWaitMore = this.config.continueOnPause && isFirstSilence && totalSilenceDuration < this.config.pauseGracePeriod;
      
      if (silenceDuration >= this.config.silenceDuration && speechDuration >= this.config.minSpeechDuration) {
        if (shouldWaitMore) {
          // ✅ Перша пауза - дати шанс продовжити
          this.pauseCount++;
          this.silenceStartTime = null; // Reset silence counter для наступної паузи
          console.log(`[VAD] 🕐 First pause detected (${Math.round(silenceDuration)}ms), waiting for continuation...`);
        } else {
          // ✅ Фінальна зупинка - або друга пауза, або минув grace period
          this.isSpeaking = false;
          this.hasSpokenRecently = false;
          this.speechStartTime = null;
          this.silenceStartTime = null;
          this.firstSilenceTime = null;
          this.pauseCount = 0;

          const speechLevel = rms;
          this.onSpeechEnd?.({
            timestamp: now,
            speechDuration,
            speechLevel
          });

          this.onSilenceDetected?.({
            timestamp: now,
            silenceDuration: totalSilenceDuration,
            lastLevel: this.lastLevel
          });
          
          console.log(`[VAD] 🛑 Final silence detected after ${this.pauseCount > 0 ? 'pause' : 'initial'} (${Math.round(totalSilenceDuration)}ms)`);
        }
      }
    }
  }

  stop() {
    this.isActive = false;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.lastSpeechTime = null;
    this.firstSilenceTime = null;
    this.pauseCount = 0;
    this.hasSpokenRecently = false;
  }

  destroy() {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
  }
}
