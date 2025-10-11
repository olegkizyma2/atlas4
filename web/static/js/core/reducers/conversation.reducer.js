/**
 * Conversation Reducer
 *
 * Управляє станом системи спілкування (Quick-send та Conversation mode)
 */

const initialState = {
  mode: 'idle', // 'idle' | 'quick-send' | 'conversation'
  active: false,
  waitingForUser: false,
  keywordListening: false,
  recording: false,
  speaking: false,
  agent: null,
  conversationHistory: [],
  lastKeywordTime: null,
  timeoutId: null
};

export function conversationReducer(state = initialState, action) {
  switch (action.type) {
  // Quick-send mode
  case 'CONVERSATION_QUICK_SEND_START':
    return {
      ...state,
      mode: 'quick-send',
      active: true,
      recording: true
    };

  case 'CONVERSATION_QUICK_SEND_END':
    return {
      ...state,
      mode: 'idle',
      active: false,
      recording: false
    };

    // Conversation mode
  case 'CONVERSATION_MODE_ACTIVATED':
    return {
      ...state,
      mode: 'conversation',
      active: true,
      keywordListening: true
    };

  case 'CONVERSATION_MODE_DEACTIVATED':
    return {
      ...initialState,
      conversationHistory: state.conversationHistory
    };

    // Keyword detection
  case 'CONVERSATION_KEYWORD_DETECTED':
    return {
      ...state,
      keywordListening: false,
      lastKeywordTime: Date.now()
    };

  case 'CONVERSATION_START_KEYWORD_LISTENING':
    return {
      ...state,
      keywordListening: true
    };

    // Recording
  case 'CONVERSATION_RECORDING_START':
    return {
      ...state,
      recording: true
    };

  case 'CONVERSATION_RECORDING_STOP':
    return {
      ...state,
      recording: false
    };

    // TTS (Atlas speaking)
  case 'CONVERSATION_TTS_STARTED':
    return {
      ...state,
      speaking: true,
      agent: action.payload.agent || null
    };

  case 'CONVERSATION_TTS_COMPLETED':
    return {
      ...state,
      speaking: false,
      waitingForUser: true
    };

    // Waiting for user response
  case 'CONVERSATION_WAITING_USER':
    return {
      ...state,
      waitingForUser: true
    };

  case 'CONVERSATION_USER_RESPONDED':
    return {
      ...state,
      waitingForUser: false
    };

    // History
  case 'CONVERSATION_ADD_TO_HISTORY':
    return {
      ...state,
      conversationHistory: [
        ...state.conversationHistory,
        action.payload
      ]
    };

  case 'CONVERSATION_CLEAR_HISTORY':
    return {
      ...state,
      conversationHistory: []
    };

    // Timeout
  case 'CONVERSATION_SET_TIMEOUT':
    return {
      ...state,
      timeoutId: action.payload.timeoutId
    };

  case 'CONVERSATION_CLEAR_TIMEOUT':
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    return {
      ...state,
      timeoutId: null
    };

  default:
    return state;
  }
}

export default conversationReducer;
