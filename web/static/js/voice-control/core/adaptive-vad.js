/**
 * @fileoverview Adaptive Voice Activity Detection з ML можливостями
 * Реалізує адаптивні алгоритми VAD з environmental adaptation та user personalization
 * Patterns: Strategy + Adapter + Observer + ML Pipeline + Feature Engineering
 */

import { VoiceLogger } from '../utils/voice-logger.js';
import { Events } from '../events/event-manager.js';

/**
 * @typedef {Object} AudioFeatures
 * @property {number} rms - Root Mean Square енергії
 * @property {number} snr - Signal-to-Noise Ratio
 * @property {number} spectralCentroid - Спектральний центроїд
 * @property {number} zeroCrossingRate - Швидкість перетину нуля
 * @property {number} spectralRolloff - Спектральний rolloff
 * @property {Float32Array} mfcc - Mel-frequency cepstral coefficients
 * @property {Float32Array} spectralFlux - Спектральний flux
 */

/**
 * @typedef {Object} VADResult
 * @property {boolean} isVoiceActive - Чи активний голос
 * @property {number} confidence - Впевненість [0-1]
 * @property {string} method - Метод детекції
 * @property {AudioFeatures} features - Витягнуті ознаки
 * @property {Object} reasoning - Пояснення рішення
 */

/**
 * Feature Extractor для аудіо сигналу
 */
export class AudioFeatureExtractor {
  constructor(config = {}) {
    this.config = {
      sampleRate: 44100,
      fftSize: 2048,
      melBands: 13,
      ...config
    };

    this.logger = new VoiceLogger('AudioFeatureExtractor');
  }

  /**
     * Витягування комплексних ознак з аудіо буфера
     */
  extractFeatures(audioBuffer, audioContext = null) {
    const features = {};

    try {
      // Базові статистичні ознаки
      features.rms = this.calculateRMS(audioBuffer);
      features.zeroCrossingRate = this.calculateZeroCrossingRate(audioBuffer);

      // Спектральні ознаки (потребують FFT)
      if (audioContext) {
        const spectrum = this.performFFT(audioBuffer, audioContext);
        features.spectralCentroid = this.calculateSpectralCentroid(spectrum);
        features.spectralRolloff = this.calculateSpectralRolloff(spectrum);
        features.spectralFlux = this.calculateSpectralFlux(spectrum);
        features.mfcc = this.calculateMFCC(spectrum);
      }

      // SNR обчислення (потребує baseline noise)
      features.snr = this.calculateSNR(audioBuffer, features.rms);

      return features;

    } catch (error) {
      this.logger.error('Feature extraction failed', { error: error.message });
      return this.getDefaultFeatures();
    }
  }

  /**
     * Обчислення RMS енергії
     * @private
     */
  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
     * Обчислення Zero Crossing Rate
     * @private
     */
  calculateZeroCrossingRate(buffer) {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (buffer.length - 1);
  }

  /**
     * Виконання FFT для спектрального аналізу
     * @private
     */
  performFFT(buffer, audioContext) {
    // Простий FFT використовуючи AnalyserNode
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = this.config.fftSize;

    const spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(spectrum);

    return spectrum;
  }

  /**
     * Обчислення спектрального центроїда
     * @private
     */
  calculateSpectralCentroid(spectrum) {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const magnitude = Math.abs(spectrum[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
     * Обчислення спектрального rolloff
     * @private
     */
  calculateSpectralRolloff(spectrum, threshold = 0.85) {
    const totalEnergy = spectrum.reduce((sum, val) => sum + Math.abs(val), 0);
    const targetEnergy = totalEnergy * threshold;

    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += Math.abs(spectrum[i]);
      if (cumulativeEnergy >= targetEnergy) {
        return i / spectrum.length;
      }
    }

    return 1.0;
  }

  /**
     * Обчислення спектрального flux
     * @private
     */
  calculateSpectralFlux(spectrum, previousSpectrum = null) {
    if (!previousSpectrum) {
      return new Float32Array(spectrum.length);
    }

    const flux = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      const diff = Math.abs(spectrum[i]) - Math.abs(previousSpectrum[i]);
      flux[i] = Math.max(0, diff); // Тільки позитивні різниці
    }

    return flux;
  }

  /**
     * Спрощене обчислення MFCC
     * @private
     */
  calculateMFCC(spectrum) {
    const melBands = this.config.melBands;
    const mfcc = new Float32Array(melBands);

    // Спрощена версія MFCC - логарифм mel-scale фільтрів
    const melFilterBank = this.createMelFilterBank(spectrum.length, melBands);

    for (let i = 0; i < melBands; i++) {
      let energy = 0;
      for (let j = 0; j < spectrum.length; j++) {
        energy += Math.abs(spectrum[j]) * melFilterBank[i][j];
      }
      mfcc[i] = Math.log(Math.max(energy, 1e-10));
    }

    return mfcc;
  }

  /**
     * Створення Mel filter bank
     * @private
     */
  createMelFilterBank(spectrumLength, numBands) {
    const filterBank = [];
    const melMin = this.hzToMel(0);
    const melMax = this.hzToMel(this.config.sampleRate / 2);
    const melStep = (melMax - melMin) / (numBands + 1);

    for (let i = 0; i < numBands; i++) {
      const filter = new Float32Array(spectrumLength);
      const leftMel = melMin + i * melStep;
      const centerMel = melMin + (i + 1) * melStep;
      const rightMel = melMin + (i + 2) * melStep;

      const leftHz = this.melToHz(leftMel);
      const centerHz = this.melToHz(centerMel);
      const rightHz = this.melToHz(rightMel);

      for (let j = 0; j < spectrumLength; j++) {
        const freq = j * this.config.sampleRate / (2 * spectrumLength);

        if (freq >= leftHz && freq <= centerHz) {
          filter[j] = (freq - leftHz) / (centerHz - leftHz);
        } else if (freq > centerHz && freq <= rightHz) {
          filter[j] = (rightHz - freq) / (rightHz - centerHz);
        }
      }

      filterBank.push(filter);
    }

    return filterBank;
  }

  /**
     * Перетворення Hz в Mel
     * @private
     */
  hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
     * Перетворення Mel в Hz
     * @private
     */
  melToHz(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
     * Обчислення SNR
     * @private
     */
  calculateSNR(buffer, rms) {
    // Спрощене обчислення SNR
    const noiseFloor = 0.01; // Базовий поріг шуму
    return rms > 0 ? 20 * Math.log10(rms / noiseFloor) : -Infinity;
  }

  /**
     * Повернення стандартних ознак при помилці
     * @private
     */
  getDefaultFeatures() {
    return {
      rms: 0,
      snr: -Infinity,
      spectralCentroid: 0,
      zeroCrossingRate: 0,
      spectralRolloff: 0,
      spectralFlux: new Float32Array(0),
      mfcc: new Float32Array(this.config.melBands)
    };
  }
}

/**
 * Environment Profile для адаптації до умов оточення
 */
export class EnvironmentProfile {
  constructor() {
    this.profile = {
      baselineNoise: 0,
      averageRMS: 0,
      averageSNR: 0,
      spectralCharacteristics: new Float32Array(13),
      adaptationRate: 0.01,
      sampleCount: 0
    };

    this.logger = new VoiceLogger('EnvironmentProfile');
  }

  /**
     * Оновлення профілю оточення
     */
  updateProfile(features) {
    const rate = this.profile.adaptationRate;

    // Exponential moving average для адаптації
    this.profile.averageRMS = this.exponentialMovingAverage(
      this.profile.averageRMS,
      features.rms,
      rate
    );

    this.profile.averageSNR = this.exponentialMovingAverage(
      this.profile.averageSNR,
      features.snr,
      rate
    );

    // Оновлення спектральних характеристик
    if (features.mfcc && features.mfcc.length === this.profile.spectralCharacteristics.length) {
      for (let i = 0; i < features.mfcc.length; i++) {
        this.profile.spectralCharacteristics[i] = this.exponentialMovingAverage(
          this.profile.spectralCharacteristics[i],
          features.mfcc[i],
          rate
        );
      }
    }

    this.profile.sampleCount++;

    // Адаптація швидкості навчання
    if (this.profile.sampleCount > 1000) {
      this.profile.adaptationRate = Math.max(0.001, this.profile.adaptationRate * 0.99);
    }
  }

  /**
     * Exponential moving average
     * @private
     */
  exponentialMovingAverage(current, newValue, rate) {
    if (isNaN(newValue) || !isFinite(newValue)) return current;
    return current * (1 - rate) + newValue * rate;
  }

  /**
     * Отримання адаптивних порогів
     */
  getAdaptiveThresholds() {
    const baseRMSThreshold = Math.max(0.01, this.profile.averageRMS * 2);
    const baseSNRThreshold = Math.max(-20, this.profile.averageSNR - 10);

    return {
      rmsThreshold: baseRMSThreshold,
      snrThreshold: baseSNRThreshold,
      adaptationConfidence: Math.min(1.0, this.profile.sampleCount / 1000)
    };
  }

  /**
     * Отримання профілю оточення
     */
  getProfile() {
    return { ...this.profile };
  }
}

/**
 * User Profile для персоналізації під користувача
 */
export class UserProfile {
  constructor() {
    this.voiceCharacteristics = {
      averagePitch: 0,
      voiceEnergy: 0,
      speechRate: 0,
      spectralSignature: new Float32Array(13),
      sampleCount: 0
    };

    this.logger = new VoiceLogger('UserProfile');
  }

  /**
     * Оновлення характеристик голосу користувача
     */
  updateVoiceCharacteristics(features, isVoice = true) {
    if (!isVoice) return; // Оновлюємо тільки при детекції голосу

    const rate = 0.05; // Повільніша адаптація для користувача

    this.voiceCharacteristics.voiceEnergy = this.exponentialMovingAverage(
      this.voiceCharacteristics.voiceEnergy,
      features.rms,
      rate
    );

    // Оновлення спектральної сигнатури
    if (features.mfcc && features.mfcc.length === this.voiceCharacteristics.spectralSignature.length) {
      for (let i = 0; i < features.mfcc.length; i++) {
        this.voiceCharacteristics.spectralSignature[i] = this.exponentialMovingAverage(
          this.voiceCharacteristics.spectralSignature[i],
          features.mfcc[i],
          rate
        );
      }
    }

    this.voiceCharacteristics.sampleCount++;
  }

  /**
     * Exponential moving average
     * @private
     */
  exponentialMovingAverage(current, newValue, rate) {
    if (isNaN(newValue) || !isFinite(newValue)) return current;
    return current * (1 - rate) + newValue * rate;
  }

  /**
     * Обчислення схожості з профілем користувача
     */
  calculateVoiceSimilarity(features) {
    if (this.voiceCharacteristics.sampleCount < 10) {
      return 0.5; // Недостатньо даних для порівняння
    }

    let similarity = 0;
    let comparisons = 0;

    // Порівняння енергії
    if (features.rms > 0 && this.voiceCharacteristics.voiceEnergy > 0) {
      const energyRatio = Math.min(features.rms, this.voiceCharacteristics.voiceEnergy) /
                              Math.max(features.rms, this.voiceCharacteristics.voiceEnergy);
      similarity += energyRatio;
      comparisons++;
    }

    // Порівняння спектральної сигнатури (спрощене)
    if (features.mfcc && features.mfcc.length === this.voiceCharacteristics.spectralSignature.length) {
      let spectralSimilarity = 0;
      let validComparisons = 0;

      for (let i = 0; i < features.mfcc.length; i++) {
        if (!isNaN(features.mfcc[i]) && !isNaN(this.voiceCharacteristics.spectralSignature[i])) {
          const diff = Math.abs(features.mfcc[i] - this.voiceCharacteristics.spectralSignature[i]);
          spectralSimilarity += Math.exp(-diff); // Gaussian-like similarity
          validComparisons++;
        }
      }

      if (validComparisons > 0) {
        similarity += spectralSimilarity / validComparisons;
        comparisons++;
      }
    }

    return comparisons > 0 ? similarity / comparisons : 0.5;
  }
}

/**
 * Adaptive Voice Activity Detection
 */
export class AdaptiveVAD {
  constructor(config = {}) {
    this.config = {
      traditionWeight: 0.4,
      spectralWeight: 0.3,
      temporalWeight: 0.2,
      userWeight: 0.1,
      confidenceThreshold: 0.7,
      adaptationEnabled: true,
      ...config
    };

    this.featureExtractor = new AudioFeatureExtractor(config.features);
    this.environmentProfile = new EnvironmentProfile();
    this.userProfile = new UserProfile();

    this.previousSpectrum = null;
    this.detectionHistory = [];

    this.logger = new VoiceLogger('AdaptiveVAD');
  }

  /**
     * Основна функція детекції голосової активності
     */
  detectVoiceActivity(audioBuffer, audioContext = null) {
    try {
      // Витягування ознак
      const features = this.featureExtractor.extractFeatures(audioBuffer, audioContext);

      // Оновлення профілів середовища
      if (this.config.adaptationEnabled) {
        this.environmentProfile.updateProfile(features);
      }

      // Multi-modal детекція
      const results = {
        traditional: this.traditionalVAD(features),
        spectral: this.spectralVAD(features),
        temporal: this.temporalVAD(features),
        user: this.userBasedVAD(features)
      };

      // Ensemble підхід
      const confidence = this.calculateEnsembleConfidence(results);
      const isActive = confidence > this.config.confidenceThreshold;

      // Оновлення профілю користувача
      if (isActive) {
        this.userProfile.updateVoiceCharacteristics(features, true);
      }

      // Збереження історії
      this.updateDetectionHistory(isActive, confidence, features);

      const vadResult = {
        isActive,
        confidence,
        method: 'adaptive_ensemble',
        features,
        breakdown: results,
        adaptation: this.getAdaptationMetrics(),
        reasoning: this.generateReasoning(results, confidence, isActive)
      };

      this.logger.debug('VAD result', {
        isActive,
        confidence: Math.round(confidence * 100) / 100,
        breakdown: Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, Math.round(v * 100) / 100])
        )
      });

      return vadResult;

    } catch (error) {
      this.logger.error('VAD detection failed', { error: error.message });
      return this.getDefaultVADResult();
    }
  }

  /**
     * Традиційний VAD на основі RMS та SNR
     * @private
     */
  traditionalVAD(features) {
    const thresholds = this.environmentProfile.getAdaptiveThresholds();

    const rmsActive = features.rms > thresholds.rmsThreshold;
    const snrActive = features.snr > thresholds.snrThreshold;

    // Комбінований результат
    let confidence = 0;
    if (rmsActive) confidence += 0.6;
    if (snrActive) confidence += 0.4;

    return Math.min(1.0, confidence);
  }

  /**
     * Спектральний VAD
     * @private
     */
  spectralVAD(features) {
    let confidence = 0;

    // Спектральний центроїд (голос зазвичай має вищий центроїд)
    if (features.spectralCentroid > 0.3) {
      confidence += 0.4;
    }

    // Zero crossing rate (голос має помірний ZCR)
    if (features.zeroCrossingRate > 0.05 && features.zeroCrossingRate < 0.3) {
      confidence += 0.3;
    }

    // Спектральний rolloff
    if (features.spectralRolloff > 0.2 && features.spectralRolloff < 0.8) {
      confidence += 0.3;
    }

    return Math.min(1.0, confidence);
  }

  /**
     * Темпоральний VAD
     * @private
     */
  temporalVAD(features) {
    // Аналіз спектрального flux для виявлення змін
    if (!features.spectralFlux || features.spectralFlux.length === 0) {
      return 0.5;
    }

    const avgFlux = features.spectralFlux.reduce((a, b) => a + b, 0) / features.spectralFlux.length;

    // Голос зазвичай має помірний flux
    if (avgFlux > 0.1 && avgFlux < 1.0) {
      return 0.8;
    } else if (avgFlux > 0.05) {
      return 0.6;
    }

    return 0.2;
  }

  /**
     * User-based VAD використовуючи профіль користувача
     * @private
     */
  userBasedVAD(features) {
    const similarity = this.userProfile.calculateVoiceSimilarity(features);

    // Високе similarity означає схожість з голосом користувача
    return similarity;
  }

  /**
     * Обчислення ensemble confidence
     * @private
     */
  calculateEnsembleConfidence(results) {
    const weights = {
      traditional: this.config.traditionWeight,
      spectral: this.config.spectralWeight,
      temporal: this.config.temporalWeight,
      user: this.config.userWeight
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [method, confidence] of Object.entries(results)) {
      const weight = weights[method] || 0;
      weightedSum += confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
     * Оновлення історії детекції
     * @private
     */
  updateDetectionHistory(isActive, confidence, features) {
    this.detectionHistory.push({
      isActive,
      confidence,
      timestamp: Date.now(),
      rms: features.rms
    });

    // Обмеження розміру історії
    if (this.detectionHistory.length > 100) {
      this.detectionHistory = this.detectionHistory.slice(-50);
    }
  }

  /**
     * Генерація пояснення рішення
     * @private
     */
  generateReasoning(results, confidence, isActive) {
    const dominantMethod = Object.entries(results)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      decision: isActive ? 'voice_detected' : 'no_voice',
      confidence: confidence,
      dominantMethod: dominantMethod[0],
      dominantConfidence: dominantMethod[1],
      factors: {
        traditional: results.traditional > 0.5 ? 'positive' : 'negative',
        spectral: results.spectral > 0.5 ? 'positive' : 'negative',
        temporal: results.temporal > 0.5 ? 'positive' : 'negative',
        user: results.user > 0.5 ? 'positive' : 'negative'
      }
    };
  }

  /**
     * Отримання метрик адаптації
     */
  getAdaptationMetrics() {
    const envProfile = this.environmentProfile.getProfile();
    const thresholds = this.environmentProfile.getAdaptiveThresholds();

    return {
      environmentalAdaptation: {
        sampleCount: envProfile.sampleCount,
        baselineNoise: envProfile.baselineNoise,
        adaptationRate: envProfile.adaptationRate,
        currentThresholds: thresholds
      },
      userAdaptation: {
        voiceSamples: this.userProfile.voiceCharacteristics.sampleCount,
        hasProfile: this.userProfile.voiceCharacteristics.sampleCount > 10
      },
      recentHistory: this.detectionHistory.slice(-10).map(h => ({
        isActive: h.isActive,
        confidence: Math.round(h.confidence * 100) / 100
      }))
    };
  }

  /**
     * Стандартний результат при помилці
     * @private
     */
  getDefaultVADResult() {
    return {
      isActive: false,
      confidence: 0.0,
      method: 'default_fallback',
      features: this.featureExtractor.getDefaultFeatures(),
      breakdown: {
        traditional: 0,
        spectral: 0,
        temporal: 0,
        user: 0
      },
      adaptation: this.getAdaptationMetrics(),
      reasoning: {
        decision: 'error_fallback',
        confidence: 0,
        dominantMethod: 'none',
        factors: {}
      }
    };
  }

  /**
     * Скидання адаптації
     */
  resetAdaptation() {
    this.environmentProfile = new EnvironmentProfile();
    this.userProfile = new UserProfile();
    this.detectionHistory = [];
    this.previousSpectrum = null;

    this.logger.info('Adaptation profiles reset');
  }

  /**
     * Експорт профілів для збереження
     */
  exportProfiles() {
    return {
      environment: this.environmentProfile.getProfile(),
      user: this.userProfile.voiceCharacteristics,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
     * Імпорт профілів
     */
  importProfiles(profileData) {
    try {
      if (profileData.environment) {
        this.environmentProfile.profile = { ...profileData.environment };
      }

      if (profileData.user) {
        this.userProfile.voiceCharacteristics = { ...profileData.user };
      }

      this.logger.info('Profiles imported successfully');
      return true;
    } catch (error) {
      this.logger.error('Profile import failed', { error: error.message });
      return false;
    }
  }
}

/**
 * Глобальний експорт
 */
export const adaptiveVAD = new AdaptiveVAD();
