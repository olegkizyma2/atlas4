/**
 * Dependency Injection Container
 *
 * Централізоване управління залежностями для ATLAS v4.0
 * Забезпечує loose coupling, легке тестування та чітке управління lifecycle
 *
 * @example
 * const container = new DIContainer();
 *
 * // Register services
 * container.singleton('logger', () => new Logger());
 * container.register('chatManager', (c) => new ChatManager(c.resolve('logger')));
 *
 * // Resolve
 * const chatManager = container.resolve('chatManager');
 */

export class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.resolving = new Set();
    this.instances = new WeakMap();
  }

  /**
     * Реєструє сервіс в контейнері
     *
     * @param {string} name - Унікальне ім'я сервісу
     * @param {Function} factory - Фабрична функція для створення сервісу
     * @param {Object} options - Опції реєстрації
     * @param {boolean} options.singleton - Чи створювати singleton
     * @param {Array<string>} options.dependencies - Явні залежності
     * @returns {DIContainer} - Для chaining
     */
  register(name, factory, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    if (typeof factory !== 'function') {
      throw new Error('Factory must be a function');
    }

    if (this.services.has(name)) {
      console.warn(`Service "${name}" is already registered. Overwriting.`);
    }

    this.services.set(name, {
      factory,
      singleton: options.singleton || false,
      dependencies: options.dependencies || [],
      metadata: options.metadata || {}
    });

    return this;
  }

  /**
     * Реєструє сервіс як singleton
     *
     * @param {string} name - Унікальне ім'я сервісу
     * @param {Function} factory - Фабрична функція
     * @param {Object} options - Додаткові опції
     * @returns {DIContainer}
     */
  singleton(name, factory, options = {}) {
    return this.register(name, factory, { ...options, singleton: true });
  }

  /**
     * Реєструє константне значення
     *
     * @param {string} name - Ім'я константи
     * @param {*} value - Значення
     * @returns {DIContainer}
     */
  value(name, value) {
    return this.singleton(name, () => value);
  }

  /**
     * Резолвить сервіс з контейнера
     *
     * @param {string} name - Ім'я сервісу
     * @returns {*} - Інстанс сервісу
     * @throws {Error} - Якщо сервіс не зареєстрований або circular dependency
     */
  resolve(name) {
    // Перевірка circular dependencies
    if (this.resolving.has(name)) {
      const chain = Array.from(this.resolving).join(' -> ');
      throw new Error(
        `Circular dependency detected: ${chain} -> ${name}`
      );
    }

    // Повертаємо singleton якщо існує
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Отримуємо опис сервісу
    const service = this.services.get(name);
    if (!service) {
      throw new Error(
        `Service "${name}" is not registered in the container. ` +
                `Available services: ${Array.from(this.services.keys()).join(', ')}`
      );
    }

    // Резолвимо сервіс
    this.resolving.add(name);

    try {
      const instance = service.factory(this);

      // Зберігаємо singleton
      if (service.singleton) {
        this.singletons.set(name, instance);
      }

      this.resolving.delete(name);
      return instance;

    } catch (error) {
      this.resolving.delete(name);
      throw new Error(
        `Failed to resolve service "${name}": ${error.message}`
      );
    }
  }

  /**
     * Перевіряє чи зареєстрований сервіс
     *
     * @param {string} name - Ім'я сервісу
     * @returns {boolean}
     */
  has(name) {
    return this.services.has(name);
  }

  /**
     * Видаляє сервіс з контейнера
     *
     * @param {string} name - Ім'я сервісу
     * @returns {boolean} - true якщо сервіс був видалений
     */
  remove(name) {
    this.singletons.delete(name);
    return this.services.delete(name);
  }

  /**
     * Очищає всі сервіси
     */
  clear() {
    this.services.clear();
    this.singletons.clear();
    this.resolving.clear();
  }

  /**
     * Повертає список всіх зареєстрованих сервісів
     *
     * @returns {Array<string>}
     */
  getServices() {
    return Array.from(this.services.keys());
  }

  /**
     * Повертає метадані сервісу
     *
     * @param {string} name - Ім'я сервісу
     * @returns {Object|null}
     */
  getMetadata(name) {
    const service = this.services.get(name);
    return service ? service.metadata : null;
  }

  /**
     * Batch resolution - резолвить кілька сервісів одночасно
     *
     * @param {Array<string>} names - Масив імен сервісів
     * @returns {Object} - Об'єкт з резолвленими сервісами
     */
  resolveMany(names) {
    return names.reduce((acc, name) => {
      acc[name] = this.resolve(name);
      return acc;
    }, {});
  }

  /**
     * Створює child container з доступом до parent сервісів
     *
     * @returns {DIContainer}
     */
  createChild() {
    const child = new DIContainer();

    // Child може резолвити parent сервіси
    const originalResolve = child.resolve.bind(child);
    child.resolve = (name) => {
      if (child.has(name)) {
        return originalResolve(name);
      }
      return this.resolve(name);
    };

    return child;
  }

  /**
     * Виконує функцію з автоматичним resolve залежностей
     *
     * @param {Function} fn - Функція для виконання
     * @param {Array<string>} dependencies - Масив імен залежностей
     * @returns {*} - Результат виконання функції
     */
  call(fn, dependencies = []) {
    const resolvedDeps = dependencies.map(name => this.resolve(name));
    return fn(...resolvedDeps);
  }

  /**
     * Отримує граф залежностей сервісу
     *
     * @param {string} name - Ім'я сервісу
     * @param {Set} visited - Відвідані сервіси (для уникнення циклів)
     * @returns {Object} - Граф залежностей
     */
  getDependencyGraph(name, visited = new Set()) {
    if (visited.has(name)) {
      return { name, circular: true };
    }

    visited.add(name);

    const service = this.services.get(name);
    if (!service) {
      return { name, error: 'Not registered' };
    }

    const dependencies = service.dependencies.map(depName =>
      this.getDependencyGraph(depName, new Set(visited))
    );

    return {
      name,
      singleton: service.singleton,
      dependencies
    };
  }

  /**
     * Debug - виводить інформацію про контейнер
     */
  debug() {
    console.group('🔧 DI Container Debug');
    console.log('Registered services:', this.getServices());
    console.log('Singletons:', Array.from(this.singletons.keys()));
    console.log('Currently resolving:', Array.from(this.resolving));
    console.groupEnd();
  }
}

/**
 * Глобальний контейнер для ATLAS
 * Використовуємо як singleton для всього додатку
 */
export const container = new DIContainer();

/**
 * Helper функція для створення service provider
 *
 * @param {DIContainer} container - DI Container
 * @returns {Function} - Service provider function
 */
export function createServiceProvider(container) {
  return {
    register(name, factory, options) {
      container.register(name, factory, options);
      return this;
    },

    singleton(name, factory, options) {
      container.singleton(name, factory, options);
      return this;
    },

    value(name, value) {
      container.value(name, value);
      return this;
    }
  };
}

export default container;
