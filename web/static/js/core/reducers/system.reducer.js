/**
 * System Reducer
 *
 * Управляє системним станом додатку
 */

const initialState = {
  initialized: false,
  online: true,
  loading: false,
  error: null,
  websocketConnected: false,
  orchestratorConnected: false,
  servicesStatus: {
    whisper: 'unknown',
    tts: 'unknown',
    goose: 'unknown'
  },
  performance: {
    fps: 60,
    memoryUsage: 0,
    loadTime: 0
  },
  ui: {
    theme: 'dark-cyber',
    sidebarOpen: false,
    modalOpen: false,
    notificationsEnabled: true
  }
};

export function systemReducer(state = initialState, action) {
  switch (action.type) {
  // Initialization
  case 'SYSTEM_INIT_START':
    return {
      ...state,
      loading: true,
      initialized: false
    };

  case 'SYSTEM_INIT_COMPLETE':
    return {
      ...state,
      loading: false,
      initialized: true,
      error: null
    };

  case 'SYSTEM_INIT_ERROR':
    return {
      ...state,
      loading: false,
      initialized: false,
      error: action.payload.error
    };

    // Online status
  case 'SYSTEM_ONLINE':
    return {
      ...state,
      online: true
    };

  case 'SYSTEM_OFFLINE':
    return {
      ...state,
      online: false
    };

    // Loading
  case 'SYSTEM_START_LOADING':
    return {
      ...state,
      loading: true
    };

  case 'SYSTEM_STOP_LOADING':
    return {
      ...state,
      loading: false
    };

    // Errors
  case 'SYSTEM_SET_ERROR':
    return {
      ...state,
      error: action.payload.error
    };

  case 'SYSTEM_CLEAR_ERROR':
    return {
      ...state,
      error: null
    };

    // WebSocket
  case 'SYSTEM_WEBSOCKET_CONNECTED':
    return {
      ...state,
      websocketConnected: true
    };

  case 'SYSTEM_WEBSOCKET_DISCONNECTED':
    return {
      ...state,
      websocketConnected: false
    };

    // Orchestrator
  case 'SYSTEM_ORCHESTRATOR_CONNECTED':
    return {
      ...state,
      orchestratorConnected: true
    };

  case 'SYSTEM_ORCHESTRATOR_DISCONNECTED':
    return {
      ...state,
      orchestratorConnected: false
    };

    // Services status
  case 'SYSTEM_UPDATE_SERVICE_STATUS':
    return {
      ...state,
      servicesStatus: {
        ...state.servicesStatus,
        [action.payload.service]: action.payload.status
      }
    };

  case 'SYSTEM_SET_ALL_SERVICES_STATUS':
    return {
      ...state,
      servicesStatus: action.payload.statuses
    };

    // Performance
  case 'SYSTEM_UPDATE_PERFORMANCE':
    return {
      ...state,
      performance: {
        ...state.performance,
        ...action.payload
      }
    };

  case 'SYSTEM_SET_FPS':
    return {
      ...state,
      performance: {
        ...state.performance,
        fps: action.payload.fps
      }
    };

  case 'SYSTEM_SET_MEMORY':
    return {
      ...state,
      performance: {
        ...state.performance,
        memoryUsage: action.payload.usage
      }
    };

    // UI
  case 'SYSTEM_SET_THEME':
    return {
      ...state,
      ui: {
        ...state.ui,
        theme: action.payload.theme
      }
    };

  case 'SYSTEM_TOGGLE_SIDEBAR':
    return {
      ...state,
      ui: {
        ...state.ui,
        sidebarOpen: !state.ui.sidebarOpen
      }
    };

  case 'SYSTEM_OPEN_MODAL':
    return {
      ...state,
      ui: {
        ...state.ui,
        modalOpen: true
      }
    };

  case 'SYSTEM_CLOSE_MODAL':
    return {
      ...state,
      ui: {
        ...state.ui,
        modalOpen: false
      }
    };

  case 'SYSTEM_TOGGLE_NOTIFICATIONS':
    return {
      ...state,
      ui: {
        ...state.ui,
        notificationsEnabled: !state.ui.notificationsEnabled
      }
    };

  default:
    return state;
  }
}

export default systemReducer;
