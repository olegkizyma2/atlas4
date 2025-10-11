/**
 * State Store - Redux-like State Management для ATLAS v4.0
 *
 * Централізоване управління станом з передбачуваними змінами
 * Забезпечує single source of truth для всієї програми
 *
 * @example
 * const store = new StateStore(initialState);
 *
 * // Register reducers
 * store.registerReducer('conversation', conversationReducer);
 *
 * // Subscribe to changes
 * store.subscribe((state, prevState) => {
 *     console.log('State changed:', state);
 * });
 *
 * // Dispatch actions
 * store.dispatch({ type: 'CONVERSATION_MODE_ACTIVATED' });
 */

export class StateStore {
  constructor(initialState = {}) {
    this.state = this.deepFreeze(initialState);
    this.reducers = new Map();
    this.listeners = new Set();
    this.middleware = [];
    this.history = [];
    this.maxHistorySize = 50;
    this.isDispatching = false;
  }

  /**
     * Реєструє reducer для модуля
     *
     * @param {string} key - Ключ в state (назва модуля)
     * @param {Function} reducer - Функція reducer (state, action) => newState
     */
  registerReducer(key, reducer) {
    if (typeof reducer !== 'function') {
      throw new Error(`Reducer for "${key}" must be a function`);
    }

    this.reducers.set(key, reducer);

    // Ініціалізуємо state для цього reducer
    if (!(key in this.state)) {
      this.state = {
        ...this.state,
        [key]: reducer(undefined, { type: '@@INIT' })
      };
    }
  }

  /**
     * Додає middleware
     *
     * @param {Function} middleware - (store) => (next) => (action) => result
     */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.middleware.push(middleware);
  }

  /**
     * Відправляє action для зміни стану
     *
     * @param {Object} action - Action об'єкт з обов'язковим полем type
     * @returns {Object} - Action що був відправлений
     */
  dispatch(action) {
    if (!action || typeof action !== 'object') {
      throw new Error('Action must be an object');
    }

    if (!action.type) {
      throw new Error('Action must have a "type" property');
    }

    if (this.isDispatching) {
      throw new Error('Reducers may not dispatch actions');
    }

    try {
      this.isDispatching = true;

      // Apply middleware
      let dispatchChain = (act) => this._dispatch(act);

      for (let i = this.middleware.length - 1; i >= 0; i--) {
        dispatchChain = this.middleware[i](this)(dispatchChain);
      }

      return dispatchChain(action);

    } finally {
      this.isDispatching = false;
    }
  }

  /**
     * Внутрішня функція dispatch
     *
     * @private
     */
  _dispatch(action) {
    const prevState = this.state;

    // Apply all reducers
    const nextState = {};
    for (const [key, reducer] of this.reducers.entries()) {
      nextState[key] = reducer(prevState[key], action);
    }

    this.state = this.deepFreeze(nextState);

    // Add to history
    this.addToHistory(action, prevState, this.state);

    // Notify listeners if state changed
    if (prevState !== this.state) {
      this.notifyListeners(this.state, prevState, action);
    }

    return action;
  }

  /**
     * Підписується на зміни стану
     *
     * @param {Function} listener - (state, prevState, action) => void
     * @returns {Function} - Unsubscribe function
     */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
     * Повертає поточний стан
     *
     * @returns {Object} - Поточний стан (frozen)
     */
  getState() {
    return this.state;
  }

  /**
     * Повертає частину стану за ключем
     *
     * @param {string} key - Ключ модуля
     * @returns {*} - Стан модуля
     */
  getModuleState(key) {
    return this.state[key];
  }

  /**
     * Сповіщає всіх listeners про зміну стану
     *
     * @private
     */
  notifyListeners(state, prevState, action) {
    for (const listener of this.listeners) {
      try {
        listener(state, prevState, action);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    }
  }

  /**
     * Додає запис в історію
     *
     * @private
     */
  addToHistory(action, prevState, nextState) {
    this.history.push({
      action,
      prevState,
      nextState,
      timestamp: Date.now()
    });

    // Обмежуємо розмір історії
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
     * Повертає історію змін
     *
     * @param {number} limit - Максимальна кількість записів
     * @returns {Array} - Історія змін
     */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
     * Глибоке заморожування об'єкта
     *
     * @private
     */
  deepFreeze(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj[prop] !== null &&
                (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
                !Object.isFrozen(obj[prop])) {
        this.deepFreeze(obj[prop]);
      }
    });

    return obj;
  }

  /**
     * Створює selector для обчислюваних значень
     *
     * @param {Function} selectorFn - (state) => value
     * @returns {Function} - Memoized selector
     */
  createSelector(selectorFn) {
    let lastState = null;
    let lastResult = null;

    return () => {
      if (this.state !== lastState) {
        lastState = this.state;
        lastResult = selectorFn(this.state);
      }
      return lastResult;
    };
  }

  /**
     * Replays actions from history
     *
     * @param {number} steps - Кількість кроків назад
     */
  replay(steps = 1) {
    if (steps > this.history.length) {
      steps = this.history.length;
    }

    const targetHistory = this.history.slice(0, -steps);

    // Reset state
    this.state = {};
    this.history = [];

    // Replay actions
    for (const record of targetHistory) {
      this.dispatch(record.action);
    }
  }

  /**
     * Debug - виводить інформацію про store
     */
  debug() {
    console.group('🏪 State Store Debug');
    console.log('Current state:', this.state);
    console.log('Registered reducers:', Array.from(this.reducers.keys()));
    console.log('Listeners count:', this.listeners.size);
    console.log('Middleware count:', this.middleware.length);
    console.log('History size:', this.history.length);
    console.groupEnd();
  }

  /**
     * Очищує store
     */
  clear() {
    this.listeners.clear();
    this.history = [];
  }
}

/**
 * Helper функції для створення actions
 */
export const actionCreators = {
  /**
     * Створює action creator
     *
     * @param {string} type - Тип action
     * @returns {Function} - Action creator function
     */
  create(type) {
    return (payload = {}) => ({
      type,
      payload,
      timestamp: Date.now()
    });
  },

  /**
     * Створює async action creator (thunk)
     *
     * @param {Function} asyncFn - Async function
     * @returns {Function} - Thunk action creator
     */
  async(asyncFn) {
    return (store) => (next) => (action) => {
      if (typeof action === 'function') {
        return action(store.dispatch, store.getState);
      }
      return next(action);
    };
  }
};

/**
 * Middleware для логування actions
 */
export const loggingMiddleware = (store) => (next) => (action) => {
  console.group(`Action: ${action.type}`);
  console.log('Payload:', action.payload);
  console.log('Previous state:', store.getState());

  const result = next(action);

  console.log('Next state:', store.getState());
  console.groupEnd();

  return result;
};

/**
 * Middleware для dev tools
 */
export const devToolsMiddleware = (store) => (next) => (action) => {
  if (window.__REDUX_DEVTOOLS_EXTENSION__) {
    window.__REDUX_DEVTOOLS_EXTENSION__.send(action, store.getState());
  }
  return next(action);
};

/**
 * Глобальний store для ATLAS
 */
export const store = new StateStore({
  conversation: {},
  model3d: {},
  voice: {},
  chat: {},
  system: {}
});

export default store;
