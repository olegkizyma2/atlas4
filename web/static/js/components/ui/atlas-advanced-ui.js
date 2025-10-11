/**
 * ATLAS Advanced UI Controller - v4.0
 *
 * Головний контролер інтерфейсу з підтримкою:
 * - Модульної архітектури компонентів
 * - Адаптивного дизайну та тем
 * - Інтерактивних елементів управління
 * - Інтеграції з 3D моделлю та TTS
 */

import { AnimatedLoggingSystem } from '../logging/animated-logging.js';
import { AtlasGLBLivingSystem } from '../model3d/atlas-glb-living-system.js';
import { AtlasTTSVisualization } from '../tts/atlas-tts-visualization.js';

export class AtlasAdvancedUI {
  constructor(options = {}) {
    this.config = {
      // Основні налаштування
      enableAnimations: options.enableAnimations !== false,
      enableTooltips: options.enableTooltips !== false,
      enableKeyboardShortcuts: options.enableKeyboardShortcuts !== false,

      // Дизайн та тема
      theme: options.theme || 'dark-cyber',
      accentColor: options.accentColor || '#00ff7f',
      enableDynamicColors: options.enableDynamicColors !== false,

      // Логування
      loggingEnabled: options.loggingEnabled !== false,
      maxLogEntries: options.maxLogEntries || 1000,
      logAnimations: options.logAnimations !== false,

      // 3D модель
      enable3DController: options.enable3DController !== false,
      modelSelector: options.modelSelector || '#model-viewer',

      // TTS візуалізація
      enableTTSVisualization: options.enableTTSVisualization !== false,

      // Адаптивність
      responsiveBreakpoints: options.responsiveBreakpoints || {
        mobile: 768,
        tablet: 1024,
        desktop: 1200
      },

      ...options
    };

    // Стан UI
    this.state = {
      isInitialized: false,
      currentTheme: this.config.theme,
      activeView: 'chat',
      sidebarExpanded: true,
      logsVisible: true,
      deviceType: 'desktop',

      // Анімації
      animationQueue: [],
      isAnimating: false,

      // Взаємодія
      lastInteraction: Date.now(),
      userPreferences: {},

      // Компоненти
      components: new Map()
    };

    // Система подій
    this.eventListeners = new Map();
    this.customEvents = new EventTarget();

    this.init();
  }

  async init() {
    try {
      this.detectDeviceType();
      this.setupTheme();
      await this.initializeComponents();
      this.setupEventListeners();
      this.setupKeyboardShortcuts();
      this.setupTooltips();
      this.setupAnimations();
      this.loadUserPreferences();

      this.state.isInitialized = true;
      this.emit('ui-initialized', { timestamp: Date.now() });

      console.log('🎨 Atlas Advanced UI v4.0 initialized');

      // Початкові анімації
      this.playInitialAnimations();

    } catch (error) {
      console.error('Failed to initialize Atlas UI:', error);
      this.handleInitializationError(error);
    }
  }

  detectDeviceType() {
    const width = window.innerWidth;
    const breakpoints = this.config.responsiveBreakpoints;

    if (width < breakpoints.mobile) {
      this.state.deviceType = 'mobile';
    } else if (width < breakpoints.tablet) {
      this.state.deviceType = 'tablet';
    } else {
      this.state.deviceType = 'desktop';
    }

    document.body.setAttribute('data-device', this.state.deviceType);
    this.emit('device-type-changed', { type: this.state.deviceType });
  }

  setupTheme() {
    // Визначення CSS змінних для теми
    const themes = {
      'dark-cyber': {
        '--primary-color': '#00ffff',
        '--secondary-color': '#00ff7f',
        '--accent-color': this.config.accentColor,
        '--bg-primary': 'rgba(0, 0, 0, 0.95)',
        '--bg-secondary': 'rgba(0, 20, 30, 0.9)',
        '--bg-tertiary': 'rgba(0, 40, 60, 0.8)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#00ffff',
        '--border-color': 'rgba(0, 255, 255, 0.3)',
        '--shadow-color': 'rgba(0, 255, 127, 0.2)',
        '--glow-color': '#00ff7f'
      },
      'light-tech': {
        '--primary-color': '#2563eb',
        '--secondary-color': '#10b981',
        '--accent-color': '#f59e0b',
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f8fafc',
        '--bg-tertiary': '#e2e8f0',
        '--text-primary': '#1e293b',
        '--text-secondary': '#475569',
        '--border-color': '#cbd5e1',
        '--shadow-color': 'rgba(37, 99, 235, 0.1)',
        '--glow-color': '#10b981'
      },
      'neo-green': {
        '--primary-color': '#00ff41',
        '--secondary-color': '#008f11',
        '--accent-color': '#39ff14',
        '--bg-primary': 'rgba(0, 0, 0, 0.98)',
        '--bg-secondary': 'rgba(0, 25, 0, 0.9)',
        '--bg-tertiary': 'rgba(0, 50, 0, 0.7)',
        '--text-primary': '#00ff41',
        '--text-secondary': '#39ff14',
        '--border-color': 'rgba(0, 255, 65, 0.5)',
        '--shadow-color': 'rgba(0, 255, 65, 0.3)',
        '--glow-color': '#39ff14'
      }
    };

    const currentTheme = themes[this.state.currentTheme] || themes['dark-cyber'];

    // Застосовуємо CSS змінні
    Object.entries(currentTheme).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });

    document.body.setAttribute('data-theme', this.state.currentTheme);
    this.emit('theme-changed', { theme: this.state.currentTheme });
  }

  async initializeComponents() {
    // Ініціалізуємо систему логування
    if (this.config.loggingEnabled) {
      await this.initializeLogging();
    }

    // Ініціалізуємо 3D контролер
    if (this.config.enable3DController) {
      await this.initialize3DController();
    }

    // Ініціалізуємо TTS візуалізацію
    if (this.config.enableTTSVisualization) {
      await this.initializeTTSVisualization();
    }

    // Ініціалізуємо користувацькі компоненти
    await this.initializeCustomComponents();
  }

  async initializeLogging() {
    try {
      if (this.config.loggingSystem) {
        this.loggingSystem = this.config.loggingSystem;
        this.state.components.set('logging', this.loggingSystem);
        if (this.loggingSystem) {
          this.loggingSystem.info('Advanced UI connected to existing logging system', 'UI-Controller');
        }
        return;
      }

      const logsContainer = document.getElementById('logs-container-desktop') ||
        document.getElementById('logs-container');

      if (logsContainer) {
        this.loggingSystem = new AnimatedLoggingSystem(logsContainer.id, {
          maxLogs: this.config.maxLogEntries,
          enableGlow: this.config.logAnimations,
          enableTypewriter: this.config.logAnimations && this.state.deviceType === 'desktop',
          autoScroll: true
        });

        this.state.components.set('logging', this.loggingSystem);

        // Тестове повідомлення
        this.loggingSystem.system('Advanced UI System initialized', 'UI-Controller');

      } else {
        console.warn('Logs container not found, logging system disabled');
      }
    } catch (error) {
      console.error('Failed to initialize logging system:', error);
    }
  }

  async initialize3DController() {
    try {
      // Спочатку перевіряємо чи є вже створений живий контролер
      const existingController = window.atlasApp?.managers?.livingBehavior;
      if (existingController) {
        this.modelController = existingController;
        console.log('🎨 Atlas Advanced UI using existing Living Behavior controller');
        return;
      }

      // Якщо живого контролера немає, створюємо Legacy 3D контролер (backup)
      const modelViewer = document.querySelector(this.config.modelSelector);

      if (modelViewer) {
        this.modelController = new Atlas3DModelController(this.config.modelSelector, {
          enableInteraction: true,
          enableBehaviors: true,
          enableTTSVisualization: this.config.enableTTSVisualization,
          animationSpeed: this.state.deviceType === 'mobile' ? 0.8 : 1.0
        });

        console.log('🎨 Atlas Advanced UI created Legacy 3D controller as backup');
        this.state.components.set('model3d', this.modelController);

        // Інтеграція з логуванням
        if (this.loggingSystem) {
          this.loggingSystem.success('3D Model Controller initialized', '3D-System');
        }

      } else {
        console.warn('3D model viewer not found, 3D controller disabled');
      }
    } catch (error) {
      console.error('Failed to initialize 3D controller:', error);
    }
  }

  async initializeTTSVisualization() {
    if (!this.modelController) {
      console.warn('TTS Visualization requires 3D controller, skipping...');
      return;
    }

    try {
      this.ttsVisualization = new AtlasTTSVisualization(this.modelController, {
        enableRealTimeAnalysis: this.state.deviceType !== 'mobile',
        enablePhonemeMapping: true,
        enableFacialAnimation: true
      });

      this.state.components.set('tts-visualization', this.ttsVisualization);

      if (this.loggingSystem) {
        this.loggingSystem.success('TTS Visualization system initialized', 'TTS-System');
      }

    } catch (error) {
      console.error('Failed to initialize TTS visualization:', error);
    }
  }

  async initializeCustomComponents() {
    // Ініціалізуємо кастомні UI елементи
    this.setupTabSwitching();
    this.setupSidebar();
    this.setupModals();
    this.setupNotifications();
    this.setupContextMenus();
    this.setupProgressIndicators();
  }

  setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab');
    const tabViews = document.querySelectorAll('.view');

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const targetView = e.target.id.replace('tab-', '');
        this.switchTab(targetView);
      });
    });
  }

  switchTab(viewName) {
    const tabButtons = document.querySelectorAll('.tab');
    const tabViews = document.querySelectorAll('.view');

    // Оновлюємо активну вкладку
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabViews.forEach(view => view.classList.remove('active'));

    const activeTab = document.getElementById(`tab-${viewName}`);
    const activeView = document.getElementById(`${viewName}-view`);

    if (activeTab && activeView) {
      activeTab.classList.add('active');
      activeView.classList.add('active');
      activeView.style.display = 'block';

      // Сховуємо інші види
      tabViews.forEach(view => {
        if (view !== activeView) {
          view.style.display = 'none';
        }
      });

      this.state.activeView = viewName;
      this.emit('tab-switched', { view: viewName });

      if (this.loggingSystem) {
        this.loggingSystem.info(`Switched to ${viewName} view`, 'UI-Controller');
      }
    }
  }

  setupSidebar() {
    // Логіка для показу/приховування sidebar (якщо є)
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    this.state.sidebarExpanded = !this.state.sidebarExpanded;
    sidebar.classList.toggle('collapsed', !this.state.sidebarExpanded);

    this.emit('sidebar-toggled', { expanded: this.state.sidebarExpanded });
  }

  setupModals() {
    // Система модальних вікон
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-modal]')) {
        this.openModal(e.target.getAttribute('data-modal'));
      }

      if (e.target.matches('.modal-close') || e.target.matches('.modal-backdrop')) {
        this.closeModal();
      }
    });

    // Закриття модалів по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Анімація появи
    if (this.config.enableAnimations) {
      modal.style.transform = 'scale(0.8) translateY(-20px)';
      modal.style.opacity = '0';

      requestAnimationFrame(() => {
        modal.style.transition = 'all 0.3s ease';
        modal.style.transform = 'scale(1) translateY(0)';
        modal.style.opacity = '1';
      });
    }

    this.emit('modal-opened', { modalId });
  }

  closeModal() {
    const activeModal = document.querySelector('.modal.active');
    if (!activeModal) return;

    if (this.config.enableAnimations) {
      activeModal.style.transform = 'scale(0.8) translateY(-20px)';
      activeModal.style.opacity = '0';

      setTimeout(() => {
        activeModal.classList.remove('active');
        document.body.classList.remove('modal-open');
      }, 300);
    } else {
      activeModal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    this.emit('modal-closed');
  }

  setupNotifications() {
    // Система сповіщень
    this.notificationContainer = this.createNotificationContainer();
  }

  createNotificationContainer() {
    let container = document.getElementById('notification-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    return container;
  }

  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icon = this.getNotificationIcon(type);
    notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">×</button>
        `;

    // Додаємо до контейнера
    this.notificationContainer.appendChild(notification);

    // Анімація появи
    if (this.config.enableAnimations) {
      notification.style.transform = 'translateX(100%)';
      requestAnimationFrame(() => {
        notification.style.transition = 'transform 0.3s ease';
        notification.style.transform = 'translateX(0)';
      });
    }

    // Автоматичне видалення
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, duration);
    }

    // Обробник кнопки закриття
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    this.emit('notification-shown', { message, type, duration });

    return notification;
  }

  getNotificationIcon(type) {
    const icons = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    };

    return icons[type] || icons['info'];
  }

  removeNotification(notification) {
    if (this.config.enableAnimations) {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    } else {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }

    this.emit('notification-removed');
  }

  setupContextMenus() {
    // Система контекстних меню
    document.addEventListener('contextmenu', (e) => {
      const target = e.target.closest('[data-context-menu]');
      if (target) {
        e.preventDefault();
        this.showContextMenu(target.getAttribute('data-context-menu'), e.clientX, e.clientY);
      }
    });

    // Закриття контекстного меню при кліку поза ним
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });
  }

  showContextMenu(menuId, x, y) {
    this.hideContextMenu(); // Сховуємо попереднє меню

    const menu = document.getElementById(menuId);
    if (!menu) return;

    menu.classList.add('active');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Перевіряємо, щоб меню не виходило за межі екрану
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }

    this.emit('context-menu-shown', { menuId, x, y });
  }

  hideContextMenu() {
    const activeMenu = document.querySelector('.context-menu.active');
    if (activeMenu) {
      activeMenu.classList.remove('active');
      this.emit('context-menu-hidden');
    }
  }

  setupProgressIndicators() {
    // Система прогрес індикаторів
    this.progressBars = new Map();
  }

  showProgress(id, message = 'Loading...') {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
            <div class="progress-label">${message}</div>
            <div class="progress-track">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-percentage">0%</div>
        `;

    // Додаємо до відповідного контейнера або body
    const container = document.querySelector('.progress-container') || document.body;
    container.appendChild(progressBar);

    this.progressBars.set(id, progressBar);
    this.emit('progress-started', { id, message });

    return progressBar;
  }

  updateProgress(id, percentage, message = null) {
    const progressBar = this.progressBars.get(id);
    if (!progressBar) return;

    const fill = progressBar.querySelector('.progress-fill');
    const label = progressBar.querySelector('.progress-percentage');
    const messageEl = progressBar.querySelector('.progress-label');

    fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    label.textContent = `${Math.round(percentage)}%`;

    if (message) {
      messageEl.textContent = message;
    }

    this.emit('progress-updated', { id, percentage, message });
  }

  hideProgress(id) {
    const progressBar = this.progressBars.get(id);
    if (!progressBar) return;

    if (this.config.enableAnimations) {
      progressBar.style.opacity = '0';
      setTimeout(() => {
        if (progressBar.parentNode) {
          progressBar.parentNode.removeChild(progressBar);
        }
      }, 300);
    } else {
      if (progressBar.parentNode) {
        progressBar.parentNode.removeChild(progressBar);
      }
    }

    this.progressBars.delete(id);
    this.emit('progress-completed', { id });
  }

  setupEventListeners() {
    // Відстеження зміни розміру вікна
    window.addEventListener('resize', () => {
      this.detectDeviceType();
      this.emit('window-resized', { width: window.innerWidth, height: window.innerHeight });
    });

    // Відстеження активності користувача
    ['click', 'keydown', 'mousemove', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.state.lastInteraction = Date.now();
        this.emit('user-activity', { timestamp: this.state.lastInteraction });
      });
    });

    // Інтеграція з голосовим управлінням
    if (window.atlasChat) {
      this.setupChatIntegration();
    }
  }

  setupChatIntegration() {
    const chat = window.atlasChat;

    // Слухаємо події чату
    if (chat.addEventListener) {
      chat.addEventListener('message-sent', (event) => {
        this.onMessageSent(event.detail);
      });

      chat.addEventListener('message-received', (event) => {
        this.onMessageReceived(event.detail);
      });

      chat.addEventListener('tts-started', (event) => {
        this.onTTSStarted(event.detail);
      });

      chat.addEventListener('tts-ended', () => {
        this.onTTSEnded();
      });
    }
  }

  onMessageSent(data) {
    if (this.modelController) {
      if (typeof this.modelController.setEmotion === 'function') {
        this.modelController.setEmotion('listening', 0.6, 1000);
      } else if (typeof this.modelController.triggerEmotion === 'function') {
        this.modelController.triggerEmotion('listening', { intensity: 0.6, duration: 1000 });
      }
    }

    if (this.loggingSystem) {
      this.loggingSystem.info(`User sent message: ${data.message?.substring(0, 50)}...`, 'Chat');
    }

    this.emit('message-sent', data);
  }

  onMessageReceived(data) {
    if (this.modelController) {
      if (typeof this.modelController.setEmotion === 'function') {
        this.modelController.setEmotion('thinking', 0.7, 800);
      } else if (typeof this.modelController.triggerEmotion === 'function') {
        this.modelController.triggerEmotion('thinking', { intensity: 0.7, duration: 800 });
      }
    }

    if (this.loggingSystem) {
      this.loggingSystem.success(`Received response from ${data.agent || 'Atlas'}`, 'Chat');
    }

    this.emit('message-received', data);
  }

  onTTSStarted(data) {
    if (this.ttsVisualization) {
      this.ttsVisualization.startTTS(data.text, data.audioElement);
    }

    // ✅ FIXED: Living Behavior має onTTSStart, НЕ speak
    if (this.modelController) {
      if (typeof this.modelController.speak === 'function') {
        // Legacy 3D controller
        this.modelController.speak(data.text);
      } else if (typeof this.modelController.onTTSStart === 'function') {
        // Living Behavior контролер (основний)
        this.modelController.onTTSStart(data.text, data.audioElement);
      } else if (typeof this.modelController.startSpeaking === 'function') {
        // Living System альтернативний метод
        const agent = data.agent || 'atlas';
        this.modelController.startSpeaking(agent, 0.8);
      } else {
        console.warn('⚠️ Model controller has no TTS method (speak/onTTSStart/startSpeaking)');
      }
    }

    if (this.loggingSystem) {
      this.loggingSystem.info(`TTS started: "${data.text.substring(0, 30)}..."`, 'TTS');
    }

    this.emit('tts-started', data);
  }

  onTTSEnded() {
    if (this.ttsVisualization) {
      this.ttsVisualization.stopTTS();
    }

    if (this.modelController && typeof this.modelController.stopSpeaking === 'function') {
      this.modelController.stopSpeaking();
    } else if (this.modelController && typeof this.modelController.onTTSEnd === 'function') {
      // Fallback для Living Behavior контролера
      this.modelController.onTTSEnd();
    }

    if (this.loggingSystem) {
      this.loggingSystem.info('TTS playback ended', 'TTS');
    }

    this.emit('tts-ended');
  }

  setupKeyboardShortcuts() {
    if (!this.config.enableKeyboardShortcuts) return;

    const shortcuts = {
      'Escape': () => this.closeModal(),
      'F1': (e) => { e.preventDefault(); this.showHelp(); },
      'F11': (e) => { e.preventDefault(); this.toggleFullscreen(); },
      'Ctrl+Shift+L': (e) => { e.preventDefault(); this.toggleLogs(); },
      'Ctrl+Shift+T': (e) => { e.preventDefault(); this.switchTheme(); },
      'Ctrl+Shift+D': (e) => { e.preventDefault(); this.toggleDebugMode(); }
    };

    document.addEventListener('keydown', (e) => {
      const key = e.ctrlKey ? 'Ctrl+' : '' +
        e.shiftKey ? 'Shift+' : '' +
          e.altKey ? 'Alt+' : '' +
      e.key;

      const handler = shortcuts[key];
      if (handler) {
        handler(e);
      }
    });
  }

  setupTooltips() {
    if (!this.config.enableTooltips) return;

    // Автоматичні підказки для елементів з атрибутом title або data-tooltip
    document.addEventListener('mouseenter', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        return;
      }
      const element = target.closest('[title], [data-tooltip]');
      if (element) {
        this.showTooltip(element);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        return;
      }
      const element = target.closest('[title], [data-tooltip]');
      if (element) {
        this.hideTooltip();
      }
    }, true);
  }

  showTooltip(element) {
    const text = element.getAttribute('data-tooltip') || element.getAttribute('title');
    if (!text) return;

    // Temporarily remove title to prevent default tooltip
    if (element.hasAttribute('title')) {
      element.setAttribute('data-original-title', element.getAttribute('title'));
      element.removeAttribute('title');
    }

    const tooltip = this.createTooltip(text);
    this.positionTooltip(tooltip, element);
  }

  createTooltip(text) {
    // Remove existing tooltip
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'atlas-tooltip';
    tooltip.textContent = text;

    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;

    return tooltip;
  }

  positionTooltip(tooltip, element) {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Adjust if tooltip would go off screen
    if (top < 0) {
      top = rect.bottom + 8;
      tooltip.classList.add('tooltip-bottom');
    }

    if (left < 0) {
      left = 8;
    } else if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    if (this.config.enableAnimations) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'scale(0.8)';

      requestAnimationFrame(() => {
        tooltip.style.transition = 'all 0.2s ease';
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'scale(1)';
      });
    }
  }

  hideTooltip() {
    if (this.currentTooltip) {
      if (this.config.enableAnimations) {
        this.currentTooltip.style.opacity = '0';
        this.currentTooltip.style.transform = 'scale(0.8)';

        setTimeout(() => {
          if (this.currentTooltip && this.currentTooltip.parentNode) {
            this.currentTooltip.parentNode.removeChild(this.currentTooltip);
          }
          this.currentTooltip = null;
        }, 200);
      } else {
        if (this.currentTooltip.parentNode) {
          this.currentTooltip.parentNode.removeChild(this.currentTooltip);
        }
        this.currentTooltip = null;
      }
    }

    // Restore original titles
    document.querySelectorAll('[data-original-title]').forEach(el => {
      el.setAttribute('title', el.getAttribute('data-original-title'));
      el.removeAttribute('data-original-title');
    });
  }

  setupAnimations() {
    if (!this.config.enableAnimations) return;

    // Обробка черги анімацій
    setInterval(() => {
      this.processAnimationQueue();
    }, 100);
  }

  playInitialAnimations() {
    if (!this.config.enableAnimations) return;

    // Анімація появи основних елементів
    const elements = document.querySelectorAll('.animate-on-load');

    elements.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('animate-fade-in');
      }, index * 100);
    });

    // Анімація для 3D моделі
    if (this.modelController) {
      setTimeout(() => {
        if (typeof this.modelController.setEmotion === 'function') {
          this.modelController.setEmotion('startup', 0.8, 2000);
        } else if (typeof this.modelController.triggerEmotion === 'function') {
          this.modelController.triggerEmotion('startup', {
            intensity: 0.8,
            duration: 2000
          });
        }
      }, 500);
    }
  }

  processAnimationQueue() {
    if (this.state.isAnimating || this.state.animationQueue.length === 0) return;

    const animation = this.state.animationQueue.shift();
    this.executeAnimation(animation);
  }

  executeAnimation(animation) {
    this.state.isAnimating = true;

    // Виконуємо анімацію
    animation.execute().then(() => {
      this.state.isAnimating = false;
    }).catch((error) => {
      console.error('Animation failed:', error);
      this.state.isAnimating = false;
    });
  }

  // Публічні методи управління
  switchTheme(themeName = null) {
    const themes = ['dark-cyber', 'light-tech', 'neo-green'];
    const currentIndex = themes.indexOf(this.state.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;

    this.state.currentTheme = themeName || themes[nextIndex];
    this.setupTheme();

    if (this.loggingSystem) {
      this.loggingSystem.system(`Theme switched to: ${this.state.currentTheme}`, 'UI-Controller');
    }

    // Зберігаємо в локальне сховище
    localStorage.setItem('atlas-theme', this.state.currentTheme);
  }

  toggleLogs() {
    this.state.logsVisible = !this.state.logsVisible;

    const logsPanel = document.querySelector('.logs-panel');
    if (logsPanel) {
      logsPanel.style.display = this.state.logsVisible ? 'block' : 'none';
    }

    this.emit('logs-toggled', { visible: this.state.logsVisible });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  toggleDebugMode() {
    document.body.classList.toggle('debug-mode');
    const isDebug = document.body.classList.contains('debug-mode');

    if (this.loggingSystem) {
      this.loggingSystem.system(`Debug mode ${isDebug ? 'enabled' : 'disabled'}`, 'UI-Controller');
    }
  }

  showHelp() {
    const helpContent = `
        <h3>ATLAS Interface Shortcuts</h3>
        <ul>
            <li><kbd>F1</kbd> - Show this help</li>
            <li><kbd>F11</kbd> - Toggle fullscreen</li>
            <li><kbd>Ctrl+Shift+L</kbd> - Toggle logs</li>
            <li><kbd>Ctrl+Shift+T</kbd> - Switch theme</li>
            <li><kbd>Ctrl+Shift+D</kbd> - Toggle debug mode</li>
            <li><kbd>Escape</kbd> - Close modals</li>
        </ul>
        `;

    this.showModal('help-modal', 'Help', helpContent);
  }

  showModal(id, title, content) {
    // Створюємо модальне вікно якщо його немає
    let modal = document.getElementById(id);

    if (!modal) {
      modal = document.createElement('div');
      modal.id = id;
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">${content}</div>
                </div>
            `;
      document.body.appendChild(modal);
    }

    this.openModal(id);
  }

  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('atlas-ui-preferences');
      if (saved) {
        this.state.userPreferences = JSON.parse(saved);
      }

      // Застосовуємо збережені налаштування
      const savedTheme = localStorage.getItem('atlas-theme');
      if (savedTheme && savedTheme !== this.state.currentTheme) {
        this.state.currentTheme = savedTheme;
        this.setupTheme();
      }

    } catch (error) {
      console.warn('Failed to load user preferences:', error);
    }
  }

  saveUserPreferences() {
    try {
      localStorage.setItem('atlas-ui-preferences', JSON.stringify(this.state.userPreferences));
      localStorage.setItem('atlas-theme', this.state.currentTheme);
    } catch (error) {
      console.warn('Failed to save user preferences:', error);
    }
  }

  // Система подій
  emit(eventName, data = {}) {
    this.customEvents.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }

  on(eventName, handler) {
    this.customEvents.addEventListener(eventName, handler);

    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(handler);
  }

  off(eventName, handler) {
    this.customEvents.removeEventListener(eventName, handler);

    const handlers = this.eventListeners.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Публічний API
  getComponent(name) {
    return this.state.components.get(name);
  }

  getState() {
    return { ...this.state };
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  handleInitializationError(error) {
    console.error('Atlas UI initialization failed:', error);

    // Показуємо fallback UI
    document.body.innerHTML = `
            <div class="error-container">
                <h1>🤖 Atlas UI Error</h1>
                <p>Failed to initialize the interface. Please refresh the page.</p>
                <button onclick="location.reload()">Refresh</button>
            </div>
        `;
  }

  // Очищення ресурсів
  destroy() {
    // Очищуємо всі компоненти
    this.state.components.forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });

    // Очищуємо слухачі подій
    this.eventListeners.forEach((handlers, eventName) => {
      handlers.forEach(handler => {
        this.customEvents.removeEventListener(eventName, handler);
      });
    });

    // Зберігаємо налаштування
    this.saveUserPreferences();

    console.log('🎨 Atlas Advanced UI destroyed');
  }
}

export default AtlasAdvancedUI;
