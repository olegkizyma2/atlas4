/**
 * Root Reducers Export
 * 
 * Централізований експорт всіх reducers для ATLAS v4.0
 */

export { conversationReducer } from './conversation.reducer.js';
export { model3dReducer } from './model3d.reducer.js';
export { voiceReducer } from './voice.reducer.js';
export { chatReducer } from './chat.reducer.js';
export { systemReducer } from './system.reducer.js';

/**
 * Реєструє всі reducers в store
 * 
 * @param {StateStore} store
 */
export function registerAllReducers(store) {
    const { conversationReducer } = await import('./conversation.reducer.js');
    const { model3dReducer } = await import('./model3d.reducer.js');
    const { voiceReducer } = await import('./voice.reducer.js');
    const { chatReducer } = await import('./chat.reducer.js');
    const { systemReducer } = await import('./system.reducer.js');

    store.registerReducer('conversation', conversationReducer);
    store.registerReducer('model3d', model3dReducer);
    store.registerReducer('voice', voiceReducer);
    store.registerReducer('chat', chatReducer);
    store.registerReducer('system', systemReducer);

    return store;
}

/**
 * Action types для всієї системи
 */
export const ActionTypes = {
    // Conversation
    CONVERSATION_QUICK_SEND_START: 'CONVERSATION_QUICK_SEND_START',
    CONVERSATION_QUICK_SEND_END: 'CONVERSATION_QUICK_SEND_END',
    CONVERSATION_MODE_ACTIVATED: 'CONVERSATION_MODE_ACTIVATED',
    CONVERSATION_MODE_DEACTIVATED: 'CONVERSATION_MODE_DEACTIVATED',
    
    // Model3D
    MODEL3D_SET_EMOTION: 'MODEL3D_SET_EMOTION',
    MODEL3D_START_SPEAKING: 'MODEL3D_START_SPEAKING',
    MODEL3D_STOP_SPEAKING: 'MODEL3D_STOP_SPEAKING',
    
    // Voice
    VOICE_START_RECORDING: 'VOICE_START_RECORDING',
    VOICE_STOP_RECORDING: 'VOICE_STOP_RECORDING',
    VOICE_TTS_START: 'VOICE_TTS_START',
    VOICE_TTS_COMPLETE: 'VOICE_TTS_COMPLETE',
    
    // Chat
    CHAT_ADD_MESSAGE: 'CHAT_ADD_MESSAGE',
    CHAT_START_TYPING: 'CHAT_START_TYPING',
    CHAT_STOP_TYPING: 'CHAT_STOP_TYPING',
    
    // System
    SYSTEM_INIT_COMPLETE: 'SYSTEM_INIT_COMPLETE',
    SYSTEM_WEBSOCKET_CONNECTED: 'SYSTEM_WEBSOCKET_CONNECTED',
    SYSTEM_SET_ERROR: 'SYSTEM_SET_ERROR'
};

export default {
    registerAllReducers,
    ActionTypes
};
