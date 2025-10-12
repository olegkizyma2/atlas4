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
      silenceDuration: config.silenceDuration || 1200, // 1.2 сек мовчання = кінець фрази (-20% від 1.5s, PR #3)
      minSpeechDuration: config.minSpeechDuration || 250, // Мінімум 250мс для валідної мови (-17% від 300ms, PR #3)
      noiseSuppression: config.noiseSuppression ?? true, // Придушення шуму
      adaptiveThreshold: config.adaptiveThreshold ?? true, // Адаптивний поріг (NEW)
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
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = now;
        this.onSpeechStart?.(now);
      }

      this.lastSpeechTime = now;
      this.silenceStartTime = null;
    } else if (this.isSpeaking) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = now;
      }

      const silenceDuration = now - this.silenceStartTime;
      const speechDuration = now - this.speechStartTime;

      if (silenceDuration >= this.config.silenceDuration && speechDuration >= this.config.minSpeechDuration) {
        this.isSpeaking = false;
        this.speechStartTime = null;
        this.silenceStartTime = null;

        const speechLevel = rms;
        this.onSpeechEnd?.({
          timestamp: now,
          speechDuration,
          speechLevel
        });

        this.onSilenceDetected?.({
          timestamp: now,
          silenceDuration,
          lastLevel: this.lastLevel
        });
      }
    }
  }

  stop() {
    this.isActive = false;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.lastSpeechTime = null;
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
