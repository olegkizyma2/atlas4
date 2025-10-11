/**
 * Theme Manager
 *
 * Управління темами інтерфейсу
 * Винесено з atlas-advanced-ui.js для модульності
 */

export class ThemeManager {
  constructor(config = {}) {
    this.currentTheme = config.theme || 'dark-cyber';
    this.accentColor = config.accentColor || '#00ff7f';
    this.enableDynamicColors = config.enableDynamicColors !== false;

    this.themes = {
      'dark-cyber': {
        '--primary-color': '#00ffff',
        '--secondary-color': '#00ff7f',
        '--accent-color': this.accentColor,
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
        '--bg-secondary': 'rgba(0, 10, 0, 0.95)',
        '--bg-tertiary': 'rgba(0, 20, 0, 0.9)',
        '--text-primary': '#00ff41',
        '--text-secondary': '#39ff14',
        '--border-color': 'rgba(0, 255, 65, 0.3)',
        '--shadow-color': 'rgba(0, 255, 65, 0.3)',
        '--glow-color': '#00ff41'
      },
      'purple-night': {
        '--primary-color': '#a855f7',
        '--secondary-color': '#ec4899',
        '--accent-color': '#f472b6',
        '--bg-primary': 'rgba(17, 24, 39, 0.98)',
        '--bg-secondary': 'rgba(31, 41, 55, 0.95)',
        '--bg-tertiary': 'rgba(55, 65, 81, 0.9)',
        '--text-primary': '#f3e8ff',
        '--text-secondary': '#e9d5ff',
        '--border-color': 'rgba(168, 85, 247, 0.3)',
        '--shadow-color': 'rgba(168, 85, 247, 0.2)',
        '--glow-color': '#a855f7'
      }
    };
  }

  /**
     * Застосування теми
     */
  apply() {
    const theme = this.themes[this.currentTheme];
    if (!theme) {
      console.warn(`Theme "${this.currentTheme}" not found, using default`);
      this.currentTheme = 'dark-cyber';
      this.apply();
      return;
    }

    // Застосовуємо CSS змінні
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Встановлюємо data атрибут
    document.body.setAttribute('data-theme', this.currentTheme);
  }

  /**
     * Перемикання теми
     */
  switchTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`Theme "${themeName}" not found`);
      return false;
    }

    this.currentTheme = themeName;
    this.apply();

    // Зберігаємо налаштування
    this.savePreference();

    return true;
  }

  /**
     * Циклічне перемикання теми
     */
  toggleTheme() {
    const themeNames = Object.keys(this.themes);
    const currentIndex = themeNames.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;

    this.switchTheme(themeNames[nextIndex]);
  }

  /**
     * Отримання поточної теми
     */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
     * Отримання списку доступних тем
     */
  getAvailableThemes() {
    return Object.keys(this.themes);
  }

  /**
     * Збереження налаштувань теми
     */
  savePreference() {
    try {
      localStorage.setItem('atlas-theme', this.currentTheme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }

  /**
     * Завантаження налаштувань теми
     */
  loadPreference() {
    try {
      const saved = localStorage.getItem('atlas-theme');
      if (saved && this.themes[saved]) {
        this.currentTheme = saved;
      }
    } catch (e) {
      console.warn('Failed to load theme preference:', e);
    }
  }

  /**
     * Додавання нової теми
     */
  addTheme(name, variables) {
    this.themes[name] = variables;
  }

  /**
     * Видалення теми
     */
  removeTheme(name) {
    if (name === this.currentTheme) {
      console.warn('Cannot remove current theme');
      return false;
    }
    delete this.themes[name];
    return true;
  }
}

export default ThemeManager;
