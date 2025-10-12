/**
 * @fileoverview Speaker Voice Profile System
 * Learns and compares user's voice signature to distinguish from background speakers
 * 
 * Features:
 * - Voice timbre analysis (spectral features)
 * - Pitch pattern recognition
 * - Speaker identification and comparison
 * - Background speaker filtering
 * 
 * @version 1.0.0
 * @date 2025-10-11
 */

import { VoiceLogger } from '../utils/voice-logger.js';

/**
 * Speaker profile containing voice characteristics
 */
export class SpeakerProfile {
  constructor(speakerId = 'user') {
    this.speakerId = speakerId;
    this.samples = [];
    this.maxSamples = 20; // Keep last 20 samples for profile
    
    // Voice signature features
    this.averagePitch = 0;
    this.pitchRange = { min: 0, max: 0 };
    this.spectralCentroid = 0;
    this.spectralBandwidth = 0;
    this.mfccSignature = null; // Average MFCC coefficients
    this.formants = []; // Формантні частоти
    
    // Confidence metrics
    this.sampleCount = 0;
    this.lastUpdated = null;
    this.isCalibrated = false;
  }

  /**
   * Add a voice sample to the profile
   */
  addSample(audioFeatures) {
    this.samples.push({
      ...audioFeatures,
      timestamp: Date.now()
    });

    // Limit sample history
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.sampleCount++;
    this.lastUpdated = Date.now();
    
    // Recalculate profile
    this.updateProfile();
    
    // Calibrate after 5+ samples
    if (this.sampleCount >= 5 && !this.isCalibrated) {
      this.isCalibrated = true;
    }
  }

  /**
   * Update profile statistics from samples
   */
  updateProfile() {
    if (this.samples.length === 0) return;

    // Calculate average pitch
    const pitches = this.samples.map(s => s.pitch || 0).filter(p => p > 0);
    if (pitches.length > 0) {
      this.averagePitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
      this.pitchRange.min = Math.min(...pitches);
      this.pitchRange.max = Math.max(...pitches);
    }

    // Calculate spectral features
    const centroids = this.samples.map(s => s.spectralCentroid || 0).filter(c => c > 0);
    if (centroids.length > 0) {
      this.spectralCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length;
      const variance = centroids.reduce((sum, c) => sum + Math.pow(c - this.spectralCentroid, 2), 0) / centroids.length;
      this.spectralBandwidth = Math.sqrt(variance);
    }

    // Calculate average MFCC signature
    const mfccSamples = this.samples.filter(s => s.mfcc && s.mfcc.length > 0);
    if (mfccSamples.length > 0) {
      const mfccLength = mfccSamples[0].mfcc.length;
      this.mfccSignature = new Float32Array(mfccLength);
      
      for (let i = 0; i < mfccLength; i++) {
        const values = mfccSamples.map(s => s.mfcc[i]);
        this.mfccSignature[i] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    // Extract formants (simplified - use spectral peaks)
    this.formants = this.extractFormants();
  }

  /**
   * Extract formant frequencies from spectral data
   */
  extractFormants() {
    // Simplified formant extraction
    // Real implementation would use LPC or other methods
    const formants = [];
    
    // Typical formant ranges (Hz):
    // F1: 300-1000, F2: 800-2500, F3: 1700-3500
    if (this.spectralCentroid > 0) {
      formants.push(this.spectralCentroid * 0.6); // Approximate F1
      formants.push(this.spectralCentroid * 1.2); // Approximate F2
      formants.push(this.spectralCentroid * 1.8); // Approximate F3
    }
    
    return formants;
  }

  /**
   * Compare this profile with audio features
   * Returns similarity score [0-1]
   */
  compareSimilarity(audioFeatures) {
    if (!this.isCalibrated || !audioFeatures) {
      return 0.5; // Unknown
    }

    let score = 0;
    let weights = 0;

    // Compare pitch (30% weight)
    if (audioFeatures.pitch && this.averagePitch > 0) {
      const pitchDiff = Math.abs(audioFeatures.pitch - this.averagePitch);
      const pitchRange = this.pitchRange.max - this.pitchRange.min;
      const pitchSimilarity = Math.max(0, 1 - pitchDiff / (pitchRange + 50));
      score += pitchSimilarity * 0.3;
      weights += 0.3;
    }

    // Compare spectral centroid (25% weight)
    if (audioFeatures.spectralCentroid && this.spectralCentroid > 0) {
      const centroidDiff = Math.abs(audioFeatures.spectralCentroid - this.spectralCentroid);
      const centroidSimilarity = Math.max(0, 1 - centroidDiff / (this.spectralCentroid + 100));
      score += centroidSimilarity * 0.25;
      weights += 0.25;
    }

    // Compare MFCC (45% weight - most important)
    if (audioFeatures.mfcc && this.mfccSignature && 
        audioFeatures.mfcc.length === this.mfccSignature.length) {
      const mfccDistance = this.calculateMFCCDistance(audioFeatures.mfcc, this.mfccSignature);
      // Convert distance to similarity (lower distance = higher similarity)
      const mfccSimilarity = Math.exp(-mfccDistance / 10);
      score += mfccSimilarity * 0.45;
      weights += 0.45;
    }

    return weights > 0 ? score / weights : 0.5;
  }

  /**
   * Calculate Euclidean distance between MFCC vectors
   */
  calculateMFCCDistance(mfcc1, mfcc2) {
    let sum = 0;
    const length = Math.min(mfcc1.length, mfcc2.length);
    
    for (let i = 0; i < length; i++) {
      const diff = mfcc1[i] - mfcc2[i];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum / length);
  }

  /**
   * Export profile for storage
   */
  export() {
    return {
      speakerId: this.speakerId,
      averagePitch: this.averagePitch,
      pitchRange: this.pitchRange,
      spectralCentroid: this.spectralCentroid,
      spectralBandwidth: this.spectralBandwidth,
      mfccSignature: this.mfccSignature ? Array.from(this.mfccSignature) : null,
      formants: this.formants,
      sampleCount: this.sampleCount,
      lastUpdated: this.lastUpdated,
      isCalibrated: this.isCalibrated
    };
  }

  /**
   * Import profile from storage
   */
  import(data) {
    this.speakerId = data.speakerId || this.speakerId;
    this.averagePitch = data.averagePitch || 0;
    this.pitchRange = data.pitchRange || { min: 0, max: 0 };
    this.spectralCentroid = data.spectralCentroid || 0;
    this.spectralBandwidth = data.spectralBandwidth || 0;
    this.mfccSignature = data.mfccSignature ? new Float32Array(data.mfccSignature) : null;
    this.formants = data.formants || [];
    this.sampleCount = data.sampleCount || 0;
    this.lastUpdated = data.lastUpdated || null;
    this.isCalibrated = data.isCalibrated || false;
  }
}

/**
 * Speaker Recognition System
 * Manages multiple speaker profiles and identifies speakers
 */
export class SpeakerRecognitionSystem {
  constructor(config = {}) {
    this.logger = new VoiceLogger('SPEAKER_RECOGNITION');
    this.config = {
      similarityThreshold: config.similarityThreshold || 0.7, // 70% similarity to match
      learningEnabled: config.learningEnabled !== false,
      maxProfiles: config.maxProfiles || 5,
      storageKey: config.storageKey || 'atlas_speaker_profiles',
      ...config
    };

    this.profiles = new Map();
    this.currentSpeaker = null;
    
    // Load saved profiles
    this.loadProfiles();
    
    // Create or load user profile
    if (!this.profiles.has('user')) {
      this.profiles.set('user', new SpeakerProfile('user'));
    }
  }

  /**
   * Identify speaker from audio features
   */
  identifySpeaker(audioFeatures) {
    if (this.profiles.size === 0) {
      return { speakerId: 'unknown', confidence: 0, isUser: false };
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [speakerId, profile] of this.profiles.entries()) {
      if (!profile.isCalibrated) continue;

      const similarity = profile.compareSimilarity(audioFeatures);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = speakerId;
      }
    }

    const isUser = bestMatch === 'user';
    const confidence = bestScore;
    const matchesUser = isUser && confidence >= this.config.similarityThreshold;

    this.logger.info(`Speaker identified: ${bestMatch || 'unknown'} (confidence: ${(confidence * 100).toFixed(1)}%)`);

    return {
      speakerId: bestMatch || 'unknown',
      confidence,
      isUser,
      matchesUser,
      allScores: this.getAllSimilarityScores(audioFeatures)
    };
  }

  /**
   * Get similarity scores for all profiles
   */
  getAllSimilarityScores(audioFeatures) {
    const scores = {};
    
    for (const [speakerId, profile] of this.profiles.entries()) {
      if (profile.isCalibrated) {
        scores[speakerId] = profile.compareSimilarity(audioFeatures);
      }
    }
    
    return scores;
  }

  /**
   * Learn from user's voice (add sample to user profile)
   */
  learnUserVoice(audioFeatures) {
    if (!this.config.learningEnabled) return;

    const userProfile = this.profiles.get('user');
    if (userProfile) {
      userProfile.addSample(audioFeatures);
      this.logger.info(`User voice profile updated (${userProfile.sampleCount} samples, calibrated: ${userProfile.isCalibrated})`);
      
      // Save periodically
      if (userProfile.sampleCount % 5 === 0) {
        this.saveProfiles();
      }
    }
  }

  /**
   * Check if audio is from the user vs background speaker
   */
  isUserSpeaking(audioFeatures) {
    const result = this.identifySpeaker(audioFeatures);
    return result.matchesUser;
  }

  /**
   * Get user profile
   */
  getUserProfile() {
    return this.profiles.get('user');
  }

  /**
   * Save profiles to localStorage
   */
  saveProfiles() {
    try {
      const data = {};
      for (const [speakerId, profile] of this.profiles.entries()) {
        data[speakerId] = profile.export();
      }
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
      this.logger.info(`Saved ${this.profiles.size} speaker profiles`);
    } catch (error) {
      this.logger.error('Failed to save speaker profiles', null, error);
    }
  }

  /**
   * Load profiles from localStorage
   */
  loadProfiles() {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        for (const [speakerId, profileData] of Object.entries(data)) {
          const profile = new SpeakerProfile(speakerId);
          profile.import(profileData);
          this.profiles.set(speakerId, profile);
        }
        this.logger.info(`Loaded ${this.profiles.size} speaker profiles`);
      }
    } catch (error) {
      this.logger.error('Failed to load speaker profiles', null, error);
    }
  }

  /**
   * Reset user profile (recalibrate)
   */
  resetUserProfile() {
    this.profiles.set('user', new SpeakerProfile('user'));
    this.saveProfiles();
    this.logger.info('User profile reset - recalibration needed');
  }

  /**
   * Get calibration status
   */
  getCalibrationStatus() {
    const userProfile = this.profiles.get('user');
    return {
      isCalibrated: userProfile?.isCalibrated || false,
      sampleCount: userProfile?.sampleCount || 0,
      samplesNeeded: Math.max(0, 5 - (userProfile?.sampleCount || 0))
    };
  }
}

/**
 * Global speaker recognition system instance
 */
export const speakerRecognition = new SpeakerRecognitionSystem();
