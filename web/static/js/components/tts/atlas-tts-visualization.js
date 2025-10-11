/**
 * ATLAS TTS Visualization System - v4.0
 *
 * Модуль для візуалізації TTS озвучування з:
 * - Синхронізацією з аудіо потоком
 * - Анімацією рота/обличчя персонажа
 * - Реактивними ефектами на основі аудіо аналізу
 * - Інтеграцією з 3D моделлю
 */

/**
 * @typedef {Object} AudioVisualizationData
 * @property {number} volume - Поточна гучність (0-1)
 * @property {number} pitch - Висота тону (0-1)
 * @property {Array<number>} frequencies - Частотний спектр
 * @property {number} energy - Енергія сигналу
 * @property {number} clarity - Чіткість звуку
 */

/**
 * @typedef {Object} PhonemeData
 * @property {string} phoneme - Фонема
 * @property {number} startTime - Час початку (мс)
 * @property {number} duration - Тривалість (мс)
 * @property {number} intensity - Інтенсивність
 */

export class AtlasTTSVisualization {
  constructor(modelController, options = {}) {
    this.modelController = modelController;

    // Конфігурація
    this.config = {
      // Основні налаштування
      enableRealTimeAnalysis: options.enableRealTimeAnalysis !== false,
      enablePhonemeMapping: options.enablePhonemeMapping !== false,
      enableFacialAnimation: options.enableFacialAnimation !== false,

      // Аудіо аналіз
      fftSize: options.fftSize || 1024,
      smoothingTimeConstant: options.smoothingTimeConstant || 0.8,
      minDecibels: options.minDecibels || -90,
      maxDecibels: options.maxDecibels || -10,

      // Візуальні ефекти
      volumeResponseSensitivity: options.volumeResponseSensitivity || 1.2,
      pitchResponseRange: options.pitchResponseRange || [0.5, 2.0],
      frequencyVisualizationBands: options.frequencyVisualizationBands || 8,

      // Анімація рота/обличчя
      mouthAnimationIntensity: options.mouthAnimationIntensity || 0.8,
      facialExpressionSensitivity: options.facialExpressionSensitivity || 0.6,
      eyeBlinkFrequency: options.eyeBlinkFrequency || 3000,

      // Колірна схема
      visualizationColors: options.visualizationColors || [
        '#00ffff', '#00ff7f', '#7fff00', '#ffff00',
        '#ff7f00', '#ff0080', '#8000ff', '#0080ff'
      ],

      // Продуктивність
      updateInterval: options.updateInterval || 50,
      maxConcurrentEffects: options.maxConcurrentEffects || 3,

      ...options
    };

    // Стан системи
    this.state = {
      isActive: false,
      isAnalyzing: false,
      currentTTSText: '',
      audioElement: null,
      audioContext: null,
      analyser: null,
      mediaSource: null,

      // Поточні дані
      volume: 0,
      pitch: 0,
      frequencies: new Array(this.config.frequencyVisualizationBands).fill(0),
      energy: 0,

      // Анімація
      mouthOpenness: 0,
      eyeBlinkState: 0,
      facialExpression: 'neutral',

      // Фонеми та слова
      phonemes: [],
      currentPhoneme: null,
      wordProgress: 0,

      // Ефекти
      activeEffects: new Map(),
      effectQueue: []
    };

    // Данні аналізу
    this.analysisData = new Float32Array(this.config.fftSize / 2);
    this.timeData = new Float32Array(this.config.fftSize);

    // Таймери та інтервали
    this.updateTimer = null;
    this.blinkTimer = null;
    this.effectProcessTimer = null;

    this.init();
  }

  async init() {
    await this.setupAudioContext();
    this.setupPhonemeMapping();
    this.setupFacialAnimations();
    this.setupVisualEffects();
    this.startPeriodicUpdates();

    console.log('🎤 Atlas TTS Visualization v4.0 initialized');
  }

  async setupAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('Web Audio API not supported');
      return false;
    }

    try {
      this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.state.analyser = this.state.audioContext.createAnalyser();

      // Налаштування аналізатору
      this.state.analyser.fftSize = this.config.fftSize;
      this.state.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
      this.state.analyser.minDecibels = this.config.minDecibels;
      this.state.analyser.maxDecibels = this.config.maxDecibels;

      return true;
    } catch (error) {
      console.error('Failed to setup audio context:', error);
      return false;
    }
  }

  setupPhonemeMapping() {
    // Мапінг фонем на візуальні форми рота
    this.phonemeToMouthShape = {
      // Голосні
      'a': { openness: 0.8, width: 0.7, shape: 'open' },
      'e': { openness: 0.6, width: 0.8, shape: 'semi-open' },
      'i': { openness: 0.4, width: 0.9, shape: 'smile' },
      'o': { openness: 0.7, width: 0.5, shape: 'round' },
      'u': { openness: 0.5, width: 0.3, shape: 'pucker' },

      // Приголосні
      'p': { openness: 0.0, width: 0.4, shape: 'closed' },
      'b': { openness: 0.0, width: 0.4, shape: 'closed' },
      'm': { openness: 0.0, width: 0.4, shape: 'closed' },
      'f': { openness: 0.2, width: 0.6, shape: 'teeth' },
      'v': { openness: 0.2, width: 0.6, shape: 'teeth' },
      'th': { openness: 0.3, width: 0.7, shape: 'tongue' },
      's': { openness: 0.2, width: 0.8, shape: 'hiss' },
      'sh': { openness: 0.3, width: 0.5, shape: 'pucker' },
      't': { openness: 0.1, width: 0.7, shape: 'tongue-tip' },
      'd': { openness: 0.1, width: 0.7, shape: 'tongue-tip' },
      'n': { openness: 0.1, width: 0.7, shape: 'tongue-tip' },
      'l': { openness: 0.3, width: 0.8, shape: 'tongue-side' },
      'r': { openness: 0.4, width: 0.8, shape: 'curl' },

      // Дефолт для невідомих звуків
      'default': { openness: 0.3, width: 0.6, shape: 'neutral' }
    };

    // Емоційні модифікатори
    this.emotionModifiers = {
      'happy': { openness: 1.2, width: 1.1, intensity: 1.1 },
      'sad': { openness: 0.8, width: 0.9, intensity: 0.8 },
      'excited': { openness: 1.3, width: 1.2, intensity: 1.3 },
      'calm': { openness: 0.9, width: 1.0, intensity: 0.9 },
      'angry': { openness: 1.1, width: 0.8, intensity: 1.2 },
      'neutral': { openness: 1.0, width: 1.0, intensity: 1.0 }
    };
  }

  setupFacialAnimations() {
    if (!this.config.enableFacialAnimation) return;

    // Початок періодичних морганьів
    this.startEyeBlinking();

    // Базові вирази обличчя
    this.facialExpressions = {
      'neutral': { eyebrows: 0, eyes: 0, cheeks: 0 },
      'speaking': { eyebrows: 0.1, eyes: 0.1, cheeks: 0.05 },
      'listening': { eyebrows: 0.2, eyes: 0.1, cheeks: 0 },
      'thinking': { eyebrows: 0.3, eyes: -0.1, cheeks: 0 },
      'surprised': { eyebrows: 0.5, eyes: 0.3, cheeks: 0.2 }
    };
  }

  setupVisualEffects() {
    // Ініціалізація візуальних ефектів
    this.visualEffects = {
      // Пульсуючий ефект на основі гучності
      volumePulse: {
        type: 'glow',
        trigger: 'volume',
        threshold: 0.3,
        intensity: (volume) => Math.min(volume * 2, 1),
        color: '#00ffff',
        duration: 200
      },

      // Кольорова зміна на основі частот
      frequencyColors: {
        type: 'color',
        trigger: 'frequency',
        mapping: this.createFrequencyColorMapping(),
        duration: 300
      },

      // Анімація частинок навколо моделі
      audioParticles: {
        type: 'particles',
        trigger: 'energy',
        threshold: 0.4,
        count: (energy) => Math.floor(energy * 10),
        duration: 1000
      },

      // Ефект "хвилі" під час говоріння
      speechWave: {
        type: 'wave',
        trigger: 'speaking',
        amplitude: (volume) => volume * 0.5,
        frequency: (pitch) => 0.5 + pitch * 1.5,
        duration: 'continuous'
      }
    };
  }

  createFrequencyColorMapping() {
    const colors = this.config.visualizationColors;
    const bandCount = this.config.frequencyVisualizationBands;

    return Array.from({ length: bandCount }, (_, i) => ({
      band: i,
      color: colors[i % colors.length],
      threshold: 0.1 + (i * 0.1)
    }));
  }

  startPeriodicUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      if (this.state.isActive && this.state.isAnalyzing) {
        this.updateAudioAnalysis();
        this.updateVisualizations();
      }
    }, this.config.updateInterval);

    // Обробка черги ефектів
    this.effectProcessTimer = setInterval(() => {
      this.processEffectQueue();
    }, 100);
  }

  startEyeBlinking() {
    if (!this.config.enableFacialAnimation) return;

    const scheduleNextBlink = () => {
      const delay = this.config.eyeBlinkFrequency + (Math.random() * 2000 - 1000);
      this.blinkTimer = setTimeout(() => {
        this.triggerEyeBlink();
        scheduleNextBlink();
      }, delay);
    };

    scheduleNextBlink();
  }

  // Публічні методи для TTS інтеграції
  startTTS(text, audioElement = null) {
    this.state.currentTTSText = text;
    this.state.isActive = true;

    if (audioElement && this.state.audioContext) {
      this.connectAudioSource(audioElement);
    }

    // Аналіз тексту для прогнозування фонем
    if (this.config.enablePhonemeMapping) {
      this.analyzeTextForPhonemes(text);
    }

    // Повідомляємо 3D модель про початок TTS
    if (this.modelController) {
      try {
        if (typeof this.modelController.speak === 'function') {
          // Legacy 3D controller API
          this.modelController.speak(text);
        } else if (typeof this.modelController.onTTSStart === 'function') {
          // Living behavior controller API
          this.modelController.onTTSStart(text, audioElement);
        } else if (typeof this.modelController.startSpeaking === 'function') {
          // Simplified fallback used by living system
          const agent = this.config?.agent || 'atlas';
          this.modelController.startSpeaking(agent, 0.8);
        }
      } catch (error) {
        console.warn('⚠️ Model controller TTS start handler failed:', error);
      }
    }

    console.log('🎤 TTS Visualization started for:', text.substring(0, 50) + '...');
  }

  stopTTS() {
    this.state.isActive = false;
    this.state.isAnalyzing = false;
    this.state.currentTTSText = '';

    // Очищаємо активні ефекти
    this.clearAllEffects();

    // Повертаємо обличчя до нейтрального стану
    this.resetFacialAnimation();

    // Повідомляємо 3D модель про зупинку TTS
    if (this.modelController) {
      try {
        if (typeof this.modelController.stopSpeaking === 'function') {
          this.modelController.stopSpeaking();
        } else if (typeof this.modelController.onTTSEnd === 'function') {
          this.modelController.onTTSEnd();
        }
      } catch (error) {
        console.warn('⚠️ Model controller TTS stop handler failed:', error);
      }
    }

    console.log('🎤 TTS Visualization stopped');
  }

  connectAudioSource(audioElement) {
    if (!this.state.audioContext || !audioElement) return;

    try {
      // Відключаємо попереднє джерело
      if (this.state.mediaSource) {
        this.state.mediaSource.disconnect();
      }

      // Підключаємо нове джерело
      this.state.mediaSource = this.state.audioContext.createMediaElementSource(audioElement);
      this.state.mediaSource.connect(this.state.analyser);
      this.state.analyser.connect(this.state.audioContext.destination);

      this.state.audioElement = audioElement;
      this.state.isAnalyzing = true;

      // Слухачі подій аудіо
      audioElement.addEventListener('play', () => {
        this.state.isAnalyzing = true;
      });

      audioElement.addEventListener('pause', () => {
        this.state.isAnalyzing = false;
      });

      audioElement.addEventListener('ended', () => {
        this.stopTTS();
      });

    } catch (error) {
      console.error('Failed to connect audio source:', error);
    }
  }

  updateAudioAnalysis() {
    if (!this.state.analyser) return;

    // Отримуємо частотні дані
    this.state.analyser.getByteFrequencyData(this.analysisData);

    // Отримуємо тимчасові дані для аналізу форми хвилі
    this.state.analyser.getByteTimeDomainData(this.timeData);

    // Обчислюємо основні параметри
    this.calculateAudioMetrics();

    // Оновлюємо стан рота та обличчя
    this.updateMouthAnimation();
    this.updateFacialExpression();
  }

  calculateAudioMetrics() {
    // Гучність (RMS)
    let sum = 0;
    for (let i = 0; i < this.analysisData.length; i++) {
      sum += (this.analysisData[i] / 255) ** 2;
    }
    this.state.volume = Math.sqrt(sum / this.analysisData.length);

    // Частоти по діапазонах
    const bandSize = Math.floor(this.analysisData.length / this.config.frequencyVisualizationBands);
    for (let i = 0; i < this.config.frequencyVisualizationBands; i++) {
      let bandSum = 0;
      for (let j = 0; j < bandSize; j++) {
        bandSum += this.analysisData[i * bandSize + j] / 255;
      }
      this.state.frequencies[i] = bandSum / bandSize;
    }

    // Енергія сигналу
    this.state.energy = this.state.frequencies.reduce((sum, freq) => sum + freq, 0) / this.state.frequencies.length;

    // Приблизна висота тону (спрощена)
    const fundamentalIndex = this.findFundamentalFrequency();
    this.state.pitch = Math.min(fundamentalIndex / (this.analysisData.length / 4), 1);
  }

  findFundamentalFrequency() {
    let maxIndex = 0;
    let maxValue = 0;

    // Шукаємо в діапазоні людського голосу (приблизно 85-255 Hz)
    const startIndex = Math.floor((85 / 22050) * this.analysisData.length);
    const endIndex = Math.floor((255 / 22050) * this.analysisData.length);

    for (let i = startIndex; i < Math.min(endIndex, this.analysisData.length); i++) {
      if (this.analysisData[i] > maxValue) {
        maxValue = this.analysisData[i];
        maxIndex = i;
      }
    }

    return maxIndex;
  }

  updateMouthAnimation() {
    if (!this.config.enableFacialAnimation) return;

    // Базова анімація рота на основі гучності
    const volumeIntensity = Math.min(this.state.volume * this.config.volumeResponseSensitivity, 1);

    // Модуляція на основі поточної фонеми (якщо доступна)
    let phonemeModifier = { openness: 1, width: 1 };
    if (this.state.currentPhoneme) {
      const phonemeShape = this.phonemeToMouthShape[this.state.currentPhoneme] ||
        this.phonemeToMouthShape['default'];
      phonemeModifier = phonemeShape;
    }

    // Емоційний модифікатор
    const emotion = this.modelController ? this.modelController.getState().emotion : 'neutral';
    const emotionMod = this.emotionModifiers[emotion] || this.emotionModifiers['neutral'];

    // Розрахунок фінального стану рота
    this.state.mouthOpenness = Math.min(
      volumeIntensity *
      phonemeModifier.openness *
      emotionMod.openness *
      this.config.mouthAnimationIntensity,
      1
    );

    // Передаємо дані в 3D контролер
    if (this.modelController) {
      this.modelController.updateTTSVisualization({
        volume: this.state.volume,
        pitch: this.state.pitch,
        frequencies: this.state.frequencies,
        mouthOpenness: this.state.mouthOpenness,
        isPlaying: this.state.isActive
      });
    }
  }

  updateFacialExpression() {
    // Визначаємо вираз обличчя на основі аудіо характеристик
    let expression = 'speaking';

    if (this.state.volume < 0.1) {
      expression = 'neutral';
    } else if (this.state.energy > 0.7) {
      expression = 'excited';
    } else if (this.state.pitch > 0.7) {
      expression = 'surprised';
    }

    if (this.state.facialExpression !== expression) {
      this.state.facialExpression = expression;
      this.applyFacialExpression(expression);
    }
  }

  applyFacialExpression(expression) {
    const expressionData = this.facialExpressions[expression] || this.facialExpressions['neutral'];

    // Тут можна додати код для анімації частин обличчя
    // Наприклад, через CSS анімації або Three.js морфінг

    console.log(`🎭 Facial expression: ${expression}`, expressionData);
  }

  updateVisualizations() {
    // Оновлюємо всі активні візуальні ефекти
    Object.entries(this.visualEffects).forEach(([name, effect]) => {
      this.updateVisualEffect(name, effect);
    });

    // Очищаємо застарілі ефекти
    this.cleanupExpiredEffects();
  }

  updateVisualEffect(name, effect) {
    let shouldTrigger = false;
    let intensity = 0;

    switch (effect.trigger) {
      case 'volume': {
        shouldTrigger = this.state.volume > effect.threshold;
        intensity = effect.intensity ? effect.intensity(this.state.volume) : this.state.volume;
        break;
      }

      case 'frequency': {
        const maxFreq = Math.max(...this.state.frequencies);
        shouldTrigger = maxFreq > 0.2;
        intensity = maxFreq;
        break;
      }

      case 'energy': {
        shouldTrigger = this.state.energy > effect.threshold;
        intensity = this.state.energy;
        break;
      }

      case 'speaking': {
        shouldTrigger = this.state.isActive && this.state.volume > 0.1;
        intensity = this.state.volume;
        break;
      }
    }

    if (shouldTrigger && !this.state.activeEffects.has(name)) {
      this.triggerVisualEffect(name, effect, intensity);
    } else if (!shouldTrigger && this.state.activeEffects.has(name)) {
      this.stopVisualEffect(name);
    }
  }

  triggerVisualEffect(name, effect, intensity) {
    const effectInstance = {
      name,
      type: effect.type,
      intensity,
      startTime: Date.now(),
      duration: effect.duration,
      ...effect
    };

    this.state.activeEffects.set(name, effectInstance);

    // Застосовуємо ефект
    this.applyVisualEffect(effectInstance);
  }

  applyVisualEffect(effectInstance) {
    switch (effectInstance.type) {
      case 'glow':
        this.applyGlowEffect(effectInstance);
        break;
      case 'color':
        this.applyColorEffect(effectInstance);
        break;
      case 'particles':
        this.applyParticleEffect(effectInstance);
        break;
      case 'wave':
        this.applyWaveEffect(effectInstance);
        break;
    }
  }

  applyGlowEffect(effect) {
    const color = effect.color || '#00ffff';
    const intensity = effect.intensity || 0.5;

    if (this.modelController && this.modelController.modelViewer) {
      this.modelController.modelViewer.style.filter = `
                drop-shadow(0 0 ${20 + intensity * 30}px ${color})
                brightness(${1 + intensity * 0.2})
            `;
    }
  }

  applyColorEffect(effect) {
    if (!effect.mapping || !this.modelController) return;

    // Знаходимо домінуючий частотний діапазон
    const dominantBand = this.state.frequencies.indexOf(Math.max(...this.state.frequencies));
    const colorMapping = effect.mapping[dominantBand];

    if (colorMapping && this.state.frequencies[dominantBand] > colorMapping.threshold) {
      // Застосовуємо колір до моделі
      if (this.modelController.modelViewer) {
        this.modelController.modelViewer.style.filter = `hue-rotate(${dominantBand * 45}deg)`;
      }
    }
  }

  applyParticleEffect(effect) {
    // Створення анімованих частинок навколо моделі
    const particleCount = effect.count ? effect.count(effect.intensity) : 5;

    for (let i = 0; i < particleCount; i++) {
      this.createAudioParticle(effect.intensity);
    }
  }

  createAudioParticle(intensity) {
    const particle = document.createElement('div');
    particle.className = 'audio-particle';
    particle.style.cssText = `
            position: absolute;
            width: ${4 + intensity * 6}px;
            height: ${4 + intensity * 6}px;
            background: radial-gradient(circle, ${this.config.visualizationColors[0]}, transparent);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            animation: particleFloat ${1000 + Math.random() * 2000}ms ease-out forwards;
        `;

    // Позиціонуємо відносно 3D моделі
    if (this.modelController && this.modelController.modelViewer) {
      const modelRect = this.modelController.modelViewer.getBoundingClientRect();
      particle.style.left = `${modelRect.left + modelRect.width / 2 + (Math.random() - 0.5) * 200}px`;
      particle.style.top = `${modelRect.top + modelRect.height / 2 + (Math.random() - 0.5) * 200}px`;
    }

    document.body.appendChild(particle);

    // Видаляємо після анімації
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 3000);
  }

  applyWaveEffect(effect) {
    // Створюємо хвильовий ефект навколо моделі
    if (!this.modelController || !this.modelController.modelViewer) return;

    const amplitude = effect.amplitude ? effect.amplitude(this.state.volume) : 0.1;
    const frequency = effect.frequency ? effect.frequency(this.state.pitch) : 1;

    // Застосовуємо хвильову анімацію
    const time = (Date.now() - effect.startTime) / 1000;
    const waveIntensity = Math.sin(time * frequency * Math.PI) * amplitude;

    this.modelController.modelViewer.style.transform += ` scale(${1 + waveIntensity})`;
  }

  stopVisualEffect(name) {
    const effect = this.state.activeEffects.get(name);
    if (!effect) return;

    // Очищаємо ефект
    this.cleanupVisualEffect(effect);
    this.state.activeEffects.delete(name);
  }

  cleanupVisualEffect(effect) {
    if (!this.modelController || !this.modelController.modelViewer) return;

    switch (effect.type) {
      case 'glow':
      case 'color':
        this.modelController.modelViewer.style.filter = '';
        break;

      case 'wave':
        // Сброс трансформації буде виконано в наступному циклі анімації
        break;
    }
  }

  cleanupExpiredEffects() {
    const now = Date.now();

    this.state.activeEffects.forEach((effect, name) => {
      if (effect.duration !== 'continuous' &&
        (now - effect.startTime) > effect.duration) {
        this.stopVisualEffect(name);
      }
    });
  }

  clearAllEffects() {
    this.state.activeEffects.forEach((effect, name) => {
      this.stopVisualEffect(name);
    });
    this.state.activeEffects.clear();
  }

  processEffectQueue() {
    // Обробка черги ефектів для оптимізації продуктивності
    if (this.state.effectQueue.length === 0) return;

    const maxEffects = this.config.maxConcurrentEffects;
    while (this.state.effectQueue.length > 0 && this.state.activeEffects.size < maxEffects) {
      const effect = this.state.effectQueue.shift();
      this.triggerVisualEffect(effect.name, effect, effect.intensity);
    }
  }

  // Фонемічний аналіз тексту
  analyzeTextForPhonemes(text) {
    // Спрощений фонемічний аналіз для української мови
    this.state.phonemes = this.textToPhonemes(text);

    // Запускаємо синхронізацію фонем з часом
    if (this.state.phonemes.length > 0) {
      this.startPhonemeSync();
    }
  }

  textToPhonemes(text) {
    // Базова конверсія тексту в фонеми (потрібна більш складна реалізація)
    const words = text.toLowerCase().split(/\\s+/);
    const phonemes = [];
    let timeOffset = 0;

    words.forEach(word => {
      // Спрощене мапування букв до фонем
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const phoneme = this.charToPhoneme(char);
        if (phoneme) {
          phonemes.push({
            phoneme,
            startTime: timeOffset,
            duration: 150, // середня тривалість фонеми
            word,
            position: i
          });
          timeOffset += 150;
        }
      }
      timeOffset += 100; // пауза між словами
    });

    return phonemes;
  }

  charToPhoneme(char) {
    const charToPhonemeMap = {
      'а': 'a', 'е': 'e', 'і': 'i', 'и': 'i', 'о': 'o', 'у': 'u',
      'п': 'p', 'б': 'b', 'м': 'm', 'ф': 'f', 'в': 'v',
      'т': 't', 'д': 'd', 'н': 'n', 'с': 's', 'з': 's',
      'л': 'l', 'р': 'r', 'к': 'k', 'г': 'g', 'х': 'h',
      'ж': 'sh', 'ш': 'sh', 'ч': 'sh', 'щ': 'sh'
    };

    return charToPhonemeMap[char] || 'default';
  }

  startPhonemeSync() {
    let phonemeIndex = 0;
    const startTime = Date.now();

    const syncPhonemes = () => {
      if (!this.state.isActive || phonemeIndex >= this.state.phonemes.length) {
        this.state.currentPhoneme = null;
        return;
      }

      const elapsed = Date.now() - startTime;
      const currentPhoneme = this.state.phonemes[phonemeIndex];

      if (elapsed >= currentPhoneme.startTime) {
        this.state.currentPhoneme = currentPhoneme.phoneme;
        phonemeIndex++;
      }

      setTimeout(syncPhonemes, 50);
    };

    syncPhonemes();
  }

  triggerEyeBlink() {
    this.state.eyeBlinkState = 1;

    // Анімація моргання
    setTimeout(() => {
      this.state.eyeBlinkState = 0;
    }, 150);

    if (this.modelController) {
      // Тут можна додати анімацію моргання для 3D моделі
    }
  }

  resetFacialAnimation() {
    this.state.mouthOpenness = 0;
    this.state.facialExpression = 'neutral';
    this.state.eyeBlinkState = 0;

    if (this.modelController && this.modelController.modelViewer) {
      this.modelController.modelViewer.style.transform = '';
      this.modelController.modelViewer.style.filter = '';
    }
  }

  // Публічний API
  getVisualizationData() {
    return {
      volume: this.state.volume,
      pitch: this.state.pitch,
      frequencies: [...this.state.frequencies],
      energy: this.state.energy,
      mouthOpenness: this.state.mouthOpenness,
      facialExpression: this.state.facialExpression,
      isActive: this.state.isActive
    };
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  // Очищення ресурсів
  destroy() {
    this.stopTTS();

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
    }

    if (this.effectProcessTimer) {
      clearInterval(this.effectProcessTimer);
    }

    if (this.state.audioContext) {
      this.state.audioContext.close();
    }

    console.log('🎤 Atlas TTS Visualization destroyed');
  }
}

export default AtlasTTSVisualization;
