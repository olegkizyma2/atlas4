/**
 * Media Manager
 *
 * Управління медіа-записом для мікрофону
 * Винесено з microphone-button-service.js для модульності
 * UPDATED (11.10.2025 - 17:20): Додано Voice Activity Detection (VAD)
 */

import { SimpleVAD } from './simple-vad.js';

export class MediaManager {
  constructor(config = {}) {
    this.logger = config.logger;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.isActive = false;

    // VAD для автоматичного визначення кінця фрази
    this.vad = null;
    this.vadEnabled = config.vadEnabled ?? true;
    this.audioLevel = 0;
    this.speechActive = false;

    // Конфігурація MediaRecorder - ОПТИМІЗОВАНО (PR #3)
    this.recordingConfig = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000  // 128 kbps high-quality encoding (+100% від 64kbps)
    };

    // Fallback mime types
    this.mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];
  }

  /**
     * Ініціалізація медіа менеджера
     */
  async initialize() {
    // Вибір підтримуваного MIME типу
    for (const mimeType of this.mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        this.recordingConfig.mimeType = mimeType;
        this.logger?.debug(`Selected MIME type: ${mimeType}`);
        break;
      }
    }
  }

  /**
   * Початок запису
   * @param {Object} options - Опції запису
   * @returns {Promise<void>}
   */
  async startRecording(options = {}) {
    try {
      this.audioLevel = 0;
      this.speechActive = false;

      // Отримання доступу до мікрофону - ОПТИМІЗОВАНО для якості (PR #3)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,        // 48 kHz high-quality sampling (+8% від 44.1kHz)
          sampleSize: 16,            // 16-bit samples
          channelCount: 1,
          latency: 0.01              // 10ms low-latency mode
        }
      });

      // Створення MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, this.recordingConfig);
      this.audioChunks = [];

      // Event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        this.logger?.error('MediaRecorder error', null, event.error);
        options.onError?.(event.error);
      };

      // Початок запису
      this.mediaRecorder.start(100); // Chunks кожні 100мс
      this.isActive = true;

      // НОВИНКА (11.10.2025 - 17:20): Ініціалізація VAD для автоматичного визначення кінця
      // ОПТИМІЗОВАНО (12.10.2025 - PR #3): Зменшено latency для швидшої реакції
      if (this.vadEnabled) {
        this.vad = new SimpleVAD({
          silenceThreshold: 0.01,
          silenceDuration: 1200,        // 1.2 сек тиші = кінець фрази (-20%)
          minSpeechDuration: 250,       // Мінімум 250мс для валідної мови (-17%)
          onSpeechStart: (data) => {
            this.speechActive = true;
            this.logger?.debug('VAD: Speech started', data);
          },
          onSpeechEnd: (data) => {
            this.speechActive = false;
            this.logger?.debug('VAD: Speech ended', data);
          },
          onSilenceDetected: (data) => {
            this.logger?.info(`VAD: Silence detected (${data.silenceDuration}ms) - triggering auto-stop`);
            options.onSilenceDetected?.();
          },
          onAudioLevel: ({ rms, isSpeech, timestamp }) => {
            this.audioLevel = rms;
            options.onAudioData?.({
              level: rms,
              hasVoiceActivity: isSpeech,
              timestamp
            });
          }
        });

        await this.vad.initialize(this.audioStream);
        this.logger?.debug('VAD initialized for automatic speech detection');
      }

      this.logger?.debug('Media recording started');

    } catch (error) {
      let errorMessage = 'Failed to start media recording';

      switch (error?.name) {
        case 'NotFoundError':
          errorMessage = 'Microphone not found. Please connect a microphone device.';
          break;
        case 'NotAllowedError':
          errorMessage = 'Microphone permission denied. Please allow microphone access in browser settings.';
          break;
        case 'NotReadableError':
          errorMessage = 'Microphone is already in use by another application.';
          break;
        case 'OverconstrainedError':
          errorMessage = 'Microphone does not support required audio settings.';
          break;
        default:
          break;
      }

      this.logger?.error(errorMessage, null, error);
      await this.cleanup();
      throw new Error(errorMessage);
    }
  }  /**
     * Зупинка запису
     * @returns {Promise<Blob>} - Аудіо дані
     */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isActive) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.recordingConfig.mimeType
          });

          this.cleanup();
          resolve(audioBlob);

        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.isActive = false;
    });
  }

  /**
     * Перевірка чи активний запис
     * @returns {boolean} - Стан запису
     */
  isRecording() {
    return this.isActive && this.mediaRecorder?.state === 'recording';
  }

  /**
   * Очищення ресурсів
   */
  async cleanup() {
    this.audioLevel = 0;
    this.speechActive = false;

    // Зупинка VAD
    if (this.vad) {
      this.vad.stop();
      this.vad = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isActive = false;
  }

  /**
   * Примусова зупинка без очікування подій MediaRecorder
   * @returns {Promise<Blob|null>}
   */
  async forceStop() {
    try {
      if (this.mediaRecorder && this.isActive) {
        return await this.stopRecording();
      }

      await this.cleanup();
      return null;
    } catch (error) {
      this.logger?.warn('Force stop recording failed', { error: error.message });
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Знищення менеджера
   */
  destroy() {
    this.cleanup();
  }
}

export default MediaManager;
