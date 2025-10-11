/**
 * ATLAS ENHANCED LIVING BEHAVIOR v5.0
 *
 * Покращена жива поведінка для шолома Atlas:
 * - Хаотичні рухи з випадковими паузами
 * - Синхронізація з TTS (анімація мовлення)
 * - Idle наближення до камери (виглядає з монітора)
 * - Природна увага до шуму та активності
 */

export class AtlasLivingBehaviorEnhanced {
  constructor(livingSystem) {
    this.livingSystem = livingSystem;
    this.modelViewer = livingSystem.modelViewer;

    // Стан поведінки
    this.state = {
      lastActivityTime: Date.now(),
      isApproaching: false,
      isSpeaking: false,
      baseDistance: 125,  // Дальша базова позиція для контрасту при наближенні
      closeDistance: 15,  // В 3 РАЗИ ближче - дуже помітне наближення!
      idleThreshold: 15000, // 15 секунд неактивності
      lookingAway: false,
      nextLookTime: Date.now() + 5000, // Перший погляд через 5 секунд
      currentLookDirection: null
    };

    // Створюємо overlay для затемнення
    this.createDarkenOverlay();

    // Застосовуємо базове освітлення одразу після створення overlay
    this.applyBaselineLighting();

    this.init();
  }

  init() {
    console.log('🎭 Initializing Enhanced Living Behavior...');

    // Запускаємо хаотичну поведінку
    this.startChaoticBehavior();

    // Запускаємо idle наближення
    this.startIdleApproach();

    // Слухаємо події TTS
    this.setupTTSListeners();

    // Слухаємо активність користувача
    this.setupActivityListeners();

    console.log('✨ Enhanced Living Behavior активовано!');
  }

  /**
   * Хаотична поведінка - випадкові погляди в різні сторони
   */
  startChaoticBehavior() {
    const checkLook = () => {
      const now = Date.now();

      // Якщо час для нового погляду
      if (now >= this.state.nextLookTime && !this.state.isSpeaking && !this.state.lookingAway) {
        // Випадково вирішуємо чи дивитися
        if (Math.random() < 0.7) { // 70% шанс подивитися
          this.performRandomLook();
        }

        // Наступний погляд через випадковий час
        this.state.nextLookTime = now + this.randomDelay(5000, 15000);
      }

      requestAnimationFrame(checkLook);
    };

    requestAnimationFrame(checkLook);
  }

  /**
   * Виконати випадковий погляд
   */
  performRandomLook() {
    const directions = [
      { y: -50, x: 15, z: 5, name: 'ліворуч', weight: 1.5 },
      { y: 50, x: 15, z: -5, name: 'праворуч', weight: 1.5 },
      { y: -35, x: -25, z: 3, name: 'вгору-ліво', weight: 1.0 },
      { y: 35, x: -25, z: -3, name: 'вгору-право', weight: 1.0 },
      { y: 0, x: 30, z: 0, name: 'вгору', weight: 0.8 },
      { y: -60, x: 5, z: 8, name: 'далеко-ліворуч', weight: 0.5 },
      { y: 60, x: 5, z: -8, name: 'далеко-праворуч', weight: 0.5 },
      { y: 0, x: -30, z: 0, name: 'вниз', weight: 0.3 }
    ];

    // Вибираємо напрямок з урахуванням ваги
    const totalWeight = directions.reduce((sum, d) => sum + d.weight, 0);
    let random = Math.random() * totalWeight;
    let direction = directions[0];

    for (const dir of directions) {
      random -= dir.weight;
      if (random <= 0) {
        direction = dir;
        break;
      }
    }

    // Додаємо випадкові варіації для унікальності
    const variation = {
      y: direction.y + (Math.random() - 0.5) * 15,
      x: direction.x + (Math.random() - 0.5) * 10,
      z: direction.z + (Math.random() - 0.5) * 5
    };

    this.state.currentLookDirection = variation;
    this.state.lookingAway = true;

    console.log(`👀 Дивлюсь ${direction.name}:`, variation);

    // Плавний поворот
    const duration = this.randomDelay(1500, 3000);
    const holdTime = this.randomDelay(800, 2500);

    this.animateLook(variation, duration, holdTime);
  }

  /**
   * Анімація погляду
   */
  animateLook(target, duration, holdTime) {
    const startRotation = {
      y: this.livingSystem.livingState.targetRotation.y,
      x: this.livingSystem.livingState.targetRotation.x,
      z: this.livingSystem.livingState.targetRotation.z
    };

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Інтерполяція
      this.livingSystem.livingState.targetRotation.y = startRotation.y + (target.y - startRotation.y) * eased;
      this.livingSystem.livingState.targetRotation.x = startRotation.x + (target.x - startRotation.x) * eased;
      this.livingSystem.livingState.targetRotation.z = startRotation.z + (target.z - startRotation.z) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Тримаємо погляд
        setTimeout(() => {
          this.returnToNeutral(1500);
        }, holdTime);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Повернення до нейтрального погляду
   */
  returnToNeutral(duration) {
    const startRotation = {
      y: this.livingSystem.livingState.targetRotation.y,
      x: this.livingSystem.livingState.targetRotation.x,
      z: this.livingSystem.livingState.targetRotation.z
    };

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      this.livingSystem.livingState.targetRotation.y = startRotation.y * (1 - eased);
      this.livingSystem.livingState.targetRotation.x = startRotation.x * (1 - eased);
      this.livingSystem.livingState.targetRotation.z = startRotation.z * (1 - eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.state.lookingAway = false;
        this.state.currentLookDirection = null;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Idle наближення - виглядає з монітора
   */
  startIdleApproach() {
    const checkIdle = () => {
      const now = Date.now();
      const timeSinceActivity = now - this.state.lastActivityTime;

      // Якщо більше 10 секунд без активності - наближаємось
      if (timeSinceActivity > this.state.idleThreshold && !this.state.isApproaching && !this.state.isSpeaking) {
        console.log(`⏰ Idle ${timeSinceActivity}ms - наближаюсь!`);
        this.approachCamera();
      }

      // Якщо є активність - відходимо назад
      if (timeSinceActivity < 2000 && this.state.isApproaching) {
        console.log('👋 Активність виявлена - відходжу назад');
        this.retreatCamera();
      }

      requestAnimationFrame(checkIdle);
    };

    requestAnimationFrame(checkIdle);
  }

  /**
   * Наближення до камери
   */
  approachCamera() {
    this.state.isApproaching = true;
    console.log('🔍 Наближаюсь до камери...');

    // Увімкнути інтенсивне затемнення та приглушення шолома
    this.enableDarken();

    const duration = 3000;
    const startDistance = this.state.baseDistance;
    const targetDistance = this.state.closeDistance;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentDistance = startDistance + (targetDistance - startDistance) * eased;

      // Оновлюємо camera orbit
      const theta = this.livingSystem.livingState.currentRotation.y;
      const phi = 75 + this.livingSystem.livingState.currentRotation.x;
      this.modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${currentDistance}%`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Відхід від камери
   */
  retreatCamera() {
    this.state.isApproaching = false;
    console.log('↩️ Відходжу від камери...');

    // Повернутись до базового затемнення
    this.disableDarken();

    const duration = 2000;
    const startDistance = this.state.closeDistance;
    const targetDistance = this.state.baseDistance;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentDistance = startDistance + (targetDistance - startDistance) * eased;

      // Оновлюємо camera orbit
      const theta = this.livingSystem.livingState.currentRotation.y;
      const phi = 75 + this.livingSystem.livingState.currentRotation.x;
      this.modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${currentDistance}%`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Налаштування слухачів TTS
   */
  setupTTSListeners() {
    // Слухаємо події TTS через window
    window.addEventListener('atlas-tts-start', (e) => {
      this.onTTSStart(e.detail);
    });

    window.addEventListener('atlas-tts-end', () => {
      this.onTTSEnd();
    });

    // Також інтегруємось з існуючою системою
    const originalStartSpeaking = this.livingSystem.startSpeaking.bind(this.livingSystem);
    this.livingSystem.startSpeaking = (agent, intensity) => {
      originalStartSpeaking(agent, intensity);
      this.onTTSStart({ agent, intensity });
    };

    const originalStopSpeaking = this.livingSystem.stopSpeaking.bind(this.livingSystem);
    this.livingSystem.stopSpeaking = () => {
      originalStopSpeaking();
      this.onTTSEnd();
    };
  }

  /**
   * Початок TTS
   */
  onTTSStart(detail = {}) {
    console.log('🎤 TTS почався:', detail);

    this.state.isSpeaking = true;
    this.state.lastActivityTime = Date.now();

    // Додаємо клас .speaking для зеленого свічення
    this.modelViewer.classList.add('speaking');

    // Вимикаємо відстеження очима під час мовлення
    this.livingSystem.config.enableEyeTracking = false;

    // Якщо наближені - трохи відходимо
    if (this.state.isApproaching) {
      this.retreatCamera();
    }

    // Вирівнюємось по вертикалі та дивимось на користувача
    // x: 0 - вертикально по центру (не вниз, не вгору)
    // y: невелика варіація для природності
    // z: 0 - без нахилу
    const lookVariation = {
      y: (Math.random() - 0.5) * 4, // ±2 градуси горизонталь (зменшено з 10)
      x: 0 + (Math.random() - 0.5) * 2, // Центр ±1 градус (зменшено з 5)
      z: (Math.random() - 0.5) * 1 // Мінімальний нахил (зменшено з 3)
    };

    // Швидко вирівнюємось і дивимось на користувача
    this.animateLook(lookVariation, 600, 99999); // Тримаємо поки говоримо

    // Запускаємо анімацію мовлення
    this.startSpeakingAnimation();
  }

  /**
   * Кінець TTS
   */
  onTTSEnd() {
    console.log('🛑 TTS закінчився');

    this.state.isSpeaking = false;
    this.state.lastActivityTime = Date.now();

    // Видаляємо клас .speaking
    this.modelViewer.classList.remove('speaking');

    // Вмикаємо відстеження очима назад
    this.livingSystem.config.enableEyeTracking = true;

    // Повертаємось до нейтралі
    this.returnToNeutral(1000);

    // Зупиняємо анімацію мовлення
    this.stopSpeakingAnimation();
  }

  /**
   * Анімація під час мовлення
   */
  startSpeakingAnimation() {
    let phase = 0;

    const animate = () => {
      if (!this.state.isSpeaking) return;

      phase += 0.05; // Зменшено швидкість з 0.1

      // Дуже легкі коливання під час мовлення (природніші)
      const wobbleY = Math.sin(phase) * 0.5; // Зменшено з 2
      const wobbleX = Math.cos(phase * 0.7) * 0.3; // Зменшено з 1
      const wobbleZ = Math.sin(phase * 1.3) * 0.1; // Зменшено з 0.5

      this.livingSystem.livingState.targetRotation.y += wobbleY * 0.05; // Зменшено з 0.1
      this.livingSystem.livingState.targetRotation.x += wobbleX * 0.05; // Зменшено з 0.1
      this.livingSystem.livingState.targetRotation.z += wobbleZ * 0.05; // Зменшено з 0.1

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Зупинка анімації мовлення
   */
  stopSpeakingAnimation() {
    // Анімація зупиниться автоматично через перевірку this.state.isSpeaking
  }

  /**
   * Налаштування слухачів активності
   */
  setupActivityListeners() {
    // Рух миші
    document.addEventListener('mousemove', () => {
      this.state.lastActivityTime = Date.now();
    });

    // Клавіатура
    document.addEventListener('keydown', () => {
      this.state.lastActivityTime = Date.now();
    });

    // Кліки
    document.addEventListener('click', () => {
      this.state.lastActivityTime = Date.now();
    });
  }

  /**
   * Створення overlay для затемнення
   */
  createDarkenOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'atlas-darken-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.75) 100%);
      opacity: 0.35;
      pointer-events: none;
      z-index: 9;
      transition: opacity 2s ease-in-out;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Увімкнути затемнення
   */
  enableDarken() {
    if (this.overlay) {
      this.overlay.style.opacity = '0.9';
      // Плавно зменшуємо яскравість, підсилюємо контраст і тіні для драматичного ефекту
      this.modelViewer.style.filter = 'drop-shadow(0 0 140px rgba(0, 255, 127, 0.85)) brightness(0.78) contrast(1.35)';
    }
  }

  /**
   * Вимкнути затемнення
   */
  disableDarken() {
    this.applyBaselineLighting();
  }

  /**
   * Застосувати базове затемнення та освітлення
   */
  applyBaselineLighting() {
    if (!this.overlay) return;

    this.overlay.style.opacity = '0.45';
    this.modelViewer.style.filter = 'drop-shadow(0 0 80px rgba(0, 255, 127, 0.6)) brightness(0.92) contrast(1.25)';
  }

  /**
   * Випадкова затримка
   */
  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Знищення
   */
  destroy() {
    console.log('💀 Destroying Enhanced Living Behavior...');
    if (this.overlay) {
      this.overlay.remove();
    }
  }
}

export default AtlasLivingBehaviorEnhanced;
