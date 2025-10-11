/**
 * ATLAS GLB LIVING SYSTEM v4.0
 *
 * Повноцінна жива система для GLB моделі шолома Атласа
 * Реагує на всі події системи як жива розумна істота
 *
 * Features:
 * - 🎭 Емоційні реакції на події
 * - 🎤 Синхронізація з TTS (дихання під час мовлення)
 * - 🎯 Відстеження користувача (очі слідкують за мишкою)
 * - ⚡ Реакції на агентів (Atlas, Тетяна, Гриша)
 * - 🧠 Інтелектуальна поведінка (навчання, пам'ять)
 * - 💚 Природні анімації (дихання, мерехтіння, micro-movements)
 */

export class AtlasGLBLivingSystem {
  constructor(modelViewerSelector, options = {}) {
    this.modelViewer = document.querySelector(modelViewerSelector);

    if (!this.modelViewer) {
      throw new Error(`Model viewer not found: ${modelViewerSelector}`);
    }

    // Конфігурація
    this.config = {
      // Живі функції
      enableBreathing: options.enableBreathing !== false,
      enableEyeTracking: options.enableEyeTracking !== false,
      enableEmotions: options.enableEmotions !== false,
      enableTTSSync: options.enableTTSSync !== false,
      enableIntelligence: options.enableIntelligence !== false,

      // Параметри анімації
      breathingSpeed: options.breathingSpeed || 4000, // мс на цикл
      eyeTrackingSpeed: options.eyeTrackingSpeed || 0.15,
      rotationSmoothness: options.rotationSmoothness || 0.1,
      emotionIntensity: options.emotionIntensity || 1.0,

      // TTS візуалізація
      ttsGlowIntensity: options.ttsGlowIntensity || 1.5,
      ttsRotationAmplitude: options.ttsRotationAmplitude || 1.5, // Зменшено з 3 до 1.5

      // Центр обертання (налаштовуваний)
      rotationCenter: {
        x: options.rotationCenterX || 5,  // Вище базова точка, щоб дивився ближче до верхнього краю екрана
        y: options.rotationCenterY || -1, // Трохи вліво (до логів) - theta
        z: options.rotationCenterZ || 0
      },

      // Особистість
      personality: {
        curiosity: 0.9,
        friendliness: 0.95,
        playfulness: 0.7,
        focus: 0.85,
        ...options.personality
      }
    };

    // Живий стан
    this.livingState = {
      isAlive: false,
      isAwake: false,
      currentEmotion: 'neutral',
      currentAgent: null,
      attentionLevel: 0.5,
      energyLevel: 1.0,

      // Позиція та орієнтація
      targetRotation: { x: 0, y: 0, z: 0 },
      currentRotation: { x: 0, y: 0, z: 0 },
      baseRotation: {
        x: this.config.rotationCenter.x,
        y: this.config.rotationCenter.y,
        z: this.config.rotationCenter.z
      },

      // Миша і користувач
      mousePosition: { x: 0, y: 0 },
      isUserPresent: false,
      lastMouseMove: Date.now(),

      // TTS стан
      isSpeaking: false,
      speechIntensity: 0,

      // Пам'ять і навчання
      interactionHistory: [],
      emotionalMemory: new Map(),
      preferredEmotions: new Map(),

      // Анімація
      breathingPhase: 0,
      idlePhase: 0,
      microMovementPhase: 0
    };

    // Емоційна палітра для різних агентів
    this.agentEmotions = {
      'atlas': {
        color: 'rgba(0, 255, 127, 0.8)',
        intensity: 0.9,
        personality: 'wise',
        glow: '#00ff7f'
      },
      'tetyana': {
        color: 'rgba(31, 156, 255, 0.8)',
        intensity: 0.85,
        personality: 'energetic',
        glow: '#1f9cff'
      },
      'grisha': {
        color: 'rgba(255, 170, 51, 0.8)',
        intensity: 0.8,
        personality: 'focused',
        glow: '#ffaa33'
      },
      'user': {
        color: 'rgba(0, 255, 127, 0.9)',
        intensity: 0.95,
        personality: 'attentive',
        glow: '#00ff7f'
      }
    };

    // Системи анімації
    this.animationFrameId = null;
    this.emotionTimeout = null;
    this.ttsAnalyser = null;

    this.init();
  }

  /**
     * Ініціалізація системи
     */
  async init() {
    console.log('🧬 Initializing Atlas GLB Living System v4.0...');

    try {
      await this.waitForModelLoad();
      this.setupModelDefaults();
      this.hideInteractionPrompt();
      this.startLivingLoop();
      this.setupEventListeners();
      this.awaken();

      console.log('✨ Atlas helmet is now ALIVE!');
    } catch (error) {
      console.error('❌ Failed to initialize Living System:', error);
    }
  }

  /**
   * Примусово приховуємо interaction prompt (палець)
   */
  hideInteractionPrompt() {
    // Встановлюємо атрибути
    this.modelViewer.interactionPrompt = 'none';
    this.modelViewer.interactionPromptThreshold = 0;
    this.modelViewer.setAttribute('interaction-prompt', 'none');
    this.modelViewer.setAttribute('interaction-prompt-threshold', '0');

    // Знаходимо і видаляємо DOM елемент промпту
    setTimeout(() => {
      const promptElement = this.modelViewer.shadowRoot?.querySelector('.interaction-prompt');
      if (promptElement) {
        promptElement.style.display = 'none';
        promptElement.style.opacity = '0';
        promptElement.style.visibility = 'hidden';
        promptElement.remove();
        console.log('✅ Interaction prompt removed');
      }

      // Також приховуємо через CSS
      const style = document.createElement('style');
      style.textContent = `
        model-viewer::part(interaction-prompt) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `;
      document.head.appendChild(style);
    }, 100);

    console.log('🚫 Interaction prompt disabled');
  }

  /**
     * Очікування завантаження GLB моделі
     */
  async waitForModelLoad() {
    return new Promise((resolve, reject) => {
      if (this.modelViewer.loaded) {
        console.log('✅ GLB model already loaded');
        resolve();
        return;
      }

      console.log('⏳ Waiting for GLB model to load...');

      // Збільшено таймаут до 30 секунд
      const timeout = setTimeout(() => {
        console.warn('⚠️ Model load timeout (30s), continuing anyway...');
        console.log('💡 The system will continue to work, but 3D animations may be limited');
        resolve();
      }, 30000);

      this.modelViewer.addEventListener('load', () => {
        clearTimeout(timeout);
        console.log('✅ GLB model loaded successfully');

        // Логуємо інформацію про модель
        const model = this.modelViewer.model;
        if (model) {
          console.log('📦 Model info:', {
            hasAnimations: model.animations?.length > 0,
            animationCount: model.animations?.length || 0,
            boundingBox: model.boundingBox
          });
        }

        resolve();
      }, { once: true });

      this.modelViewer.addEventListener('error', (e) => {
        clearTimeout(timeout);
        console.error('❌ GLB model load error:', e);
        console.warn('💡 Continuing without 3D model - system will work in 2D mode');
        // Продовжуємо виконання замість відхилення
        resolve();
      }, { once: true });
    });
  }

  /**
     * Налаштування дефолтних параметрів моделі
     */
  setupModelDefaults() {
    // Примусово показуємо модель (якщо був reveal="manual")
    if (typeof this.modelViewer.dismissPoster === 'function') {
      this.modelViewer.dismissPoster();
    }

    // Отримуємо центр моделі для правильного обертання
    const model = this.modelViewer.model;
    if (model && model.boundingBox) {
      const bbox = model.boundingBox;
      // Використовуємо методи boundingBox для отримання центру
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerY = (bbox.min.y + bbox.max.y) / 2;
      const centerZ = (bbox.min.z + bbox.max.z) / 2;

      // Встановлюємо центр обертання на центр моделі
      this.modelViewer.cameraTarget = `${centerX}m ${centerY}m ${centerZ}m`;

      console.log('📦 Model center:', { x: centerX, y: centerY, z: centerZ });
    } else {
      // Якщо не вдалося отримати bbox, використовуємо дефолтний центр
      this.modelViewer.cameraTarget = 'auto auto auto';
    }

    // Налаштовуємо камеру для оптимального вигляду шолома
    this.modelViewer.cameraOrbit = '0deg 75deg 105%';
    this.modelViewer.fieldOfView = '30deg';

    // Встановлюємо мінімальну та максимальну відстань камери
    this.modelViewer.minCameraOrbit = 'auto auto 80%';
    this.modelViewer.maxCameraOrbit = 'auto auto 150%';

    // Увімкнення auto-rotate для базової живості
    this.modelViewer.autoRotate = false; // Вимикаємо, бо ми керуємо вручну

    // Вимикаємо interaction-prompt (палець)
    this.modelViewer.interactionPrompt = 'none';
    this.modelViewer.interactionPromptThreshold = 0;

    console.log('⚙️ Model defaults configured');
  }

  /**
     * Пробудження - початкова анімація
     */
  awaken() {
    console.log('🌅 Atlas is awakening...');

    this.livingState.isAlive = true;
    this.livingState.isAwake = true;
    this.livingState.currentEmotion = 'awakening';

    // Плавна анімація пробудження
    this.setEmotion('curious', 0.8, 3000);

    // Додаємо клас для CSS анімації
    this.modelViewer.classList.add('awakening');

    setTimeout(() => {
      this.modelViewer.classList.remove('awakening');
      this.setEmotion('neutral', 0.5, 1000);
    }, 3000);
  }

  /**
     * Головний цикл живої поведінки
     */
  startLivingLoop() {
    const animate = (timestamp) => {
      if (!this.livingState.isAlive) return;

      const deltaTime = timestamp - (this.lastTimestamp || timestamp);
      this.lastTimestamp = timestamp;

      // Природні анімації
      if (this.config.enableBreathing) {
        this.updateBreathing(timestamp);
      }

      // Micro-movements для реалізму
      this.updateMicroMovements(timestamp);

      // Відстеження очима (вимкнено під час мовлення)
      if (this.config.enableEyeTracking && this.livingState.isUserPresent && !this.livingState.isSpeaking) {
        this.updateEyeTracking();
      }

      // Idle анімації
      this.updateIdleBehavior(timestamp);

      // Застосовуємо всі обчислені трансформації
      this.applyTransformations();

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
    console.log('🔄 Living loop started');
  }

  /**
     * Дихання - плавні коливання
     */
  updateBreathing(timestamp) {
    const speed = this.config.breathingSpeed;
    const phase = (timestamp % speed) / speed;
    this.livingState.breathingPhase = phase;

    // Базове дихання - легке масштабування
    const breathIntensity = this.livingState.isSpeaking ? 0.02 : 0.01;
    const breathScale = 1 + Math.sin(phase * Math.PI * 2) * breathIntensity;

    // Під час мовлення - більш інтенсивне дихання
    if (this.livingState.isSpeaking) {
      const speechBreath = 0.015 * this.livingState.speechIntensity;
      this.livingState.targetRotation.z = Math.sin(phase * Math.PI * 4) * 2 * speechBreath;
    }
  }

  /**
     * Micro-movements - невеликі випадкові рухи для життєвості
     */
  updateMicroMovements(timestamp) {
    // Повільний перлін-подібний шум для природності
    const t = timestamp * 0.0001;

    const microX = Math.sin(t * 1.3) * 0.3;
    const microY = Math.cos(t * 0.7) * 0.2;
    const microZ = Math.sin(t * 0.5) * 0.15;

    this.livingState.baseRotation.x += microX * 0.01;
    this.livingState.baseRotation.y += microY * 0.01;
    this.livingState.baseRotation.z += microZ * 0.01;
  }

  /**
     * Відстеження очима (поворот шолома за мишкою)
     */
  updateEyeTracking() {
    const { mousePosition } = this.livingState;
    const speed = this.config.eyeTrackingSpeed;

    // Обчислюємо цільову позицію (ІНВЕРТОВАНО ГОРИЗОНТАЛЬ)
    const targetY = -mousePosition.x * 25; // Горизонтальний поворот (інвертовано)
    const targetX = -mousePosition.y * 15; // Вертикальний нахил

    // Плавний перехід
    this.livingState.targetRotation.y += (targetY - this.livingState.targetRotation.y) * speed;
    this.livingState.targetRotation.x += (targetX - this.livingState.targetRotation.x) * speed;
  }

  /**
     * Idle поведінка - періодичні рухи коли нічого не відбувається
     * ОНОВЛЕНО: Додано виглядання за межі екрану як жива істота
     */
  updateIdleBehavior(timestamp) {
    const timeSinceLastActivity = timestamp - this.livingState.lastMouseMove;

    if (timeSinceLastActivity > 5000 && !this.livingState.isSpeaking) {
      // Повільні idle рухи (базові)
      const t = timestamp * 0.00005;
      const idleRotationY = Math.sin(t) * 5;
      const idleRotationX = Math.cos(t * 0.7) * 3;

      this.livingState.targetRotation.y += idleRotationY * 0.02;
      this.livingState.targetRotation.x += idleRotationX * 0.02;

      // НОВА ПОВЕДІНКА: Виглядання за межі екрану (кожні 8-12 секунд)
      if (timeSinceLastActivity > 8000 && Math.random() < 0.0015) {
        this.performCuriousLook(timestamp);
      }
    }

    // Періодичне "моргання" емоцією
    if (timeSinceLastActivity > 15000 && Math.random() < 0.001) {
      const idleEmotions = ['contemplative', 'peaceful', 'curious'];
      const emotion = idleEmotions[Math.floor(Math.random() * idleEmotions.length)];
      this.setEmotion(emotion, 0.4, 2000);
    }
  }

  /**
   * Цікаве виглядання за межі екрану як жива істота
   */
  performCuriousLook(timestamp) {
    const directions = [
      { y: -45, x: 10, name: 'ліворуч' },   // Дивиться ліворуч
      { y: 45, x: 10, name: 'праворуч' },   // Дивиться праворуч
      { y: -30, x: -20, name: 'вгору-ліво' }, // Вгору-ліворуч
      { y: 30, x: -20, name: 'вгору-право' }, // Вгору-праворуч
      { y: 0, x: 25, name: 'вгору' }        // Прямо вгору
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];

    // Плавний поворот до цільової точки
    const duration = 2000; // 2 секунди на поворот
    const startY = this.livingState.targetRotation.y;
    const startX = this.livingState.targetRotation.x;
    const startTime = timestamp;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out для плавності
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.livingState.targetRotation.y = startY + (direction.y - startY) * eased;
      this.livingState.targetRotation.x = startX + (direction.x - startX) * eased;

      // Тримати погляд 1-2 секунди
      if (progress >= 1 && elapsed < duration + 1500) {
        requestAnimationFrame(animate);
      } else if (progress >= 1) {
        // Повернення до нормального стану
        this.returnToNeutralLook(currentTime);
      } else {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Повернення до нейтрального погляду після цікавого оглядання
   */
  returnToNeutralLook(timestamp) {
    const duration = 1500; // 1.5 секунди на повернення
    const startY = this.livingState.targetRotation.y;
    const startX = this.livingState.targetRotation.x;
    const startTime = timestamp;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3); // Ease-out

      this.livingState.targetRotation.y = startY - startY * eased;
      this.livingState.targetRotation.x = startX - startX * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
     * Застосування всіх трансформацій до моделі
     */
  applyTransformations() {
    const smoothness = this.config.rotationSmoothness;

    // Обчислюємо цільові значення
    const targetX = this.livingState.targetRotation.x + this.livingState.baseRotation.x;
    const targetY = this.livingState.targetRotation.y + this.livingState.baseRotation.y;
    const targetZ = this.livingState.targetRotation.z + this.livingState.baseRotation.z;

    // Лінійна інтерполяція (LERP) для плавного переходу
    this.livingState.currentRotation.x = this.livingState.currentRotation.x + (targetX - this.livingState.currentRotation.x) * smoothness;
    this.livingState.currentRotation.y = this.livingState.currentRotation.y + (targetY - this.livingState.currentRotation.y) * smoothness;
    this.livingState.currentRotation.z = this.livingState.currentRotation.z + (targetZ - this.livingState.currentRotation.z) * smoothness;

    // Застосовуємо до camera orbit
    const theta = this.livingState.currentRotation.y;
    const phi = 75 + this.livingState.currentRotation.x;
    const radius = 105;

    this.modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${radius}%`;
  }

  /**
     * Налаштування слухачів подій
     */
  setupEventListeners() {
    // Відстеження мишки
    document.addEventListener('mousemove', (e) => {
      if (!this.config.enableEyeTracking) return;

      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;

      this.livingState.mousePosition = { x, y };
      this.livingState.isUserPresent = true;
      this.livingState.lastMouseMove = Date.now();
    });

    // Користувач залишив сторінку
    document.addEventListener('mouseleave', () => {
      this.livingState.isUserPresent = false;
      this.setEmotion('lonely', 0.3, 1000);
    });

    document.addEventListener('mouseenter', () => {
      this.livingState.isUserPresent = true;
      this.setEmotion('welcoming', 0.6, 1000);
    });

    console.log('👂 Event listeners set up');
  }

  /**
     * Встановлення емоції
     */
  setEmotion(emotion, intensity = 0.7, duration = 1000) {
    if (!this.config.enableEmotions) return;

    // Запам'ятовуємо емоцію
    this.livingState.currentEmotion = emotion;

    // Застосовуємо візуальний стан
    this.applyEmotionVisuals(emotion, intensity);

    // Анімація емоції
    this.animateEmotion(emotion, intensity, duration);

    // Логування (опціонально)
    if (this.config.enableIntelligence) {
      this.recordEmotion(emotion, intensity);
    }

    console.log(`😊 Emotion: ${emotion} (${intensity.toFixed(2)})`);
  }

  /**
     * Застосування візуальних ефектів емоції
     */
  applyEmotionVisuals(emotion, intensity) {
    // Видаляємо попередні класи емоцій
    this.modelViewer.classList.remove('speaking', 'listening', 'thinking', 'focused');

    // Додаємо новий клас в залежності від емоції
    const emotionClassMap = {
      'speaking': 'speaking',
      'listening': 'listening',
      'thinking': 'thinking',
      'curious': 'thinking',
      'focused': 'focused',
      'alert': 'focused',
      'excited': 'speaking'
    };

    const className = emotionClassMap[emotion];
    if (className) {
      this.modelViewer.classList.add(className);
    }
  }

  /**
     * Анімація емоції
     */
  animateEmotion(emotion, intensity, duration) {
    // Емоційні рухи
    const emotionMovements = {
      'joy': { x: 0, y: 5, z: 0 },
      'curious': { x: -5, y: 0, z: 2 },
      'focused': { x: -3, y: 0, z: 0 },
      'alert': { x: -8, y: 0, z: 1 },
      'excited': { x: 0, y: 8, z: 2 },
      'thinking': { x: -4, y: -3, z: 1 },
      'welcoming': { x: 0, y: 3, z: -1 },
      'satisfied': { x: 2, y: 2, z: 0 }
    };

    const movement = emotionMovements[emotion] || { x: 0, y: 0, z: 0 };

    // Застосовуємо рух
    this.livingState.targetRotation.x += movement.x * intensity;
    this.livingState.targetRotation.y += movement.y * intensity;
    this.livingState.targetRotation.z += movement.z * intensity;

    // Повернення до нейтралі
    if (this.emotionTimeout) {
      clearTimeout(this.emotionTimeout);
    }

    this.emotionTimeout = setTimeout(() => {
      this.livingState.targetRotation.x *= 0.5;
      this.livingState.targetRotation.y *= 0.5;
      this.livingState.targetRotation.z *= 0.5;
    }, duration);
  }

  /**
     * Початок мовлення (TTS)
     */
  startSpeaking(agent = 'atlas', intensity = 0.8) {
    console.log(`🎤 ${agent} started speaking`);

    this.livingState.isSpeaking = true;
    this.livingState.speechIntensity = intensity;
    this.livingState.currentAgent = agent;

    // Емоція для агента
    const agentData = this.agentEmotions[agent] || this.agentEmotions['atlas'];
    this.setEmotion('speaking', agentData.intensity, 99999);

    // Динамічний рух під час мовлення
    this.startSpeechAnimation(agent);
  }

  /**
     * Анімація під час мовлення
     */
  startSpeechAnimation(agent) {
    const agentData = this.agentEmotions[agent] || this.agentEmotions['atlas'];

    // Легкі коливання під час мовлення
    this.speechAnimationInterval = setInterval(() => {
      if (!this.livingState.isSpeaking) return;

      const amplitude = this.config.ttsRotationAmplitude;
      this.livingState.targetRotation.y += (Math.random() - 0.5) * amplitude;
      this.livingState.targetRotation.x += (Math.random() - 0.5) * amplitude * 0.5;
    }, 200);
  }

  /**
     * Кінець мовлення
     */
  stopSpeaking() {
    console.log('🛑 Speaking stopped');

    this.livingState.isSpeaking = false;
    this.livingState.speechIntensity = 0;

    if (this.speechAnimationInterval) {
      clearInterval(this.speechAnimationInterval);
    }

    // Повернення до нейтралі
    this.setEmotion('satisfied', 0.6, 1500);
  }

  /**
   * Compatibility method for TTS start (called from app-refactored.js)
   */
  onTTSStart(text, audioElement) {
    this.startSpeaking(text, audioElement);
  }

  /**
   * Compatibility method for TTS end (called from app-refactored.js)
   */
  onTTSEnd() {
    this.stopSpeaking();
  }

  /**
     * Реакція на подію системи
     */
  reactToEvent(eventType, data = {}) {
    console.log(`⚡ Reacting to event: ${eventType}`, data);

    const reactions = {
      'message-sent': () => this.setEmotion('listening', 0.7, 1500),
      'agent-thinking': () => this.setEmotion('thinking', 0.8, 2000),
      'agent-response': () => this.setEmotion('excited', 0.75, 1200),
      'error': () => this.setEmotion('alert', 1.0, 800),
      'keyword-detected': () => this.setEmotion('alert', 0.9, 600),
      'recording-start': () => this.setEmotion('focused', 0.9, 99999),
      'recording-stop': () => this.setEmotion('processing', 0.7, 1500)
    };

    const reaction = reactions[eventType];
    if (reaction) {
      reaction();
    }
  }

  /**
     * Запис емоції в пам'ять (для навчання)
     */
  recordEmotion(emotion, intensity) {
    const timestamp = Date.now();

    if (!this.livingState.emotionalMemory.has(emotion)) {
      this.livingState.emotionalMemory.set(emotion, []);
    }

    this.livingState.emotionalMemory.get(emotion).push({
      timestamp,
      intensity,
      context: this.livingState.currentAgent
    });

    // Обмежуємо розмір пам'яті
    const history = this.livingState.emotionalMemory.get(emotion);
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
     * Знищення системи
     */
  destroy() {
    console.log('💀 Destroying Atlas Living System...');

    this.livingState.isAlive = false;
    this.livingState.isAwake = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.emotionTimeout) {
      clearTimeout(this.emotionTimeout);
    }

    if (this.speechAnimationInterval) {
      clearInterval(this.speechAnimationInterval);
    }

    console.log('👋 Atlas Living System destroyed');
  }
}

export default AtlasGLBLivingSystem;
