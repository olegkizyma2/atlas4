/**
 * Chat Reducer
 *
 * Управляє станом чату та повідомлень
 */

const initialState = {
  messages: [],
  typing: false,
  typingAgent: null,
  currentAgent: null,
  pendingMessage: null,
  lastMessageTime: null,
  unreadCount: 0,
  ttsEnabled: true,
  autoScroll: true
};

export function chatReducer(state = initialState, action) {
  switch (action.type) {
  // Messages
  case 'CHAT_ADD_MESSAGE':
    return {
      ...state,
      messages: [...state.messages, {
        id: action.payload.id || `msg_${Date.now()}`,
        role: action.payload.role,
        content: action.payload.content,
        agent: action.payload.agent || null,
        timestamp: action.payload.timestamp || Date.now(),
        read: false
      }],
      lastMessageTime: Date.now(),
      unreadCount: action.payload.role === 'assistant'
        ? state.unreadCount + 1
        : state.unreadCount
    };

  case 'CHAT_UPDATE_MESSAGE':
    return {
      ...state,
      messages: state.messages.map(msg =>
        msg.id === action.payload.id
          ? { ...msg, ...action.payload.updates }
          : msg
      )
    };

  case 'CHAT_DELETE_MESSAGE':
    return {
      ...state,
      messages: state.messages.filter(msg => msg.id !== action.payload.id)
    };

  case 'CHAT_CLEAR_MESSAGES':
    return {
      ...state,
      messages: [],
      unreadCount: 0
    };

    // Typing indicator
  case 'CHAT_START_TYPING':
    return {
      ...state,
      typing: true,
      typingAgent: action.payload.agent || null
    };

  case 'CHAT_STOP_TYPING':
    return {
      ...state,
      typing: false,
      typingAgent: null
    };

    // Current agent
  case 'CHAT_SET_AGENT':
    return {
      ...state,
      currentAgent: action.payload.agent
    };

  case 'CHAT_CLEAR_AGENT':
    return {
      ...state,
      currentAgent: null
    };

    // Pending message
  case 'CHAT_SET_PENDING':
    return {
      ...state,
      pendingMessage: action.payload.message
    };

  case 'CHAT_CLEAR_PENDING':
    return {
      ...state,
      pendingMessage: null
    };

    // Unread count
  case 'CHAT_MARK_READ':
    return {
      ...state,
      messages: state.messages.map(msg => ({
        ...msg,
        read: true
      })),
      unreadCount: 0
    };

  case 'CHAT_INCREMENT_UNREAD':
    return {
      ...state,
      unreadCount: state.unreadCount + 1
    };

    // Settings
  case 'CHAT_TOGGLE_TTS':
    return {
      ...state,
      ttsEnabled: !state.ttsEnabled
    };

  case 'CHAT_SET_TTS':
    return {
      ...state,
      ttsEnabled: action.payload.enabled
    };

  case 'CHAT_TOGGLE_AUTO_SCROLL':
    return {
      ...state,
      autoScroll: !state.autoScroll
    };

  case 'CHAT_SET_AUTO_SCROLL':
    return {
      ...state,
      autoScroll: action.payload.enabled
    };

  default:
    return state;
  }
}

export default chatReducer;
