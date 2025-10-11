/**
 * Model3D Reducer
 *
 * Управляє станом 3D моделі шолома
 */

const initialState = {
  emotion: 'neutral',
  intensity: 0.5,
  duration: 0,
  speaking: false,
  agent: null,
  breathing: true,
  eyeTracking: true,
  mousePosition: { x: 0, y: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  isAlive: false,
  attentionLevel: 0.5,
  energyLevel: 1.0
};

export function model3dReducer(state = initialState, action) {
  switch (action.type) {
  // Emotion
  case 'MODEL3D_SET_EMOTION':
    return {
      ...state,
      emotion: action.payload.emotion,
      intensity: action.payload.intensity || 0.7,
      duration: action.payload.duration || 2000
    };

  case 'MODEL3D_RESET_EMOTION':
    return {
      ...state,
      emotion: 'neutral',
      intensity: 0.5
    };

    // Speaking
  case 'MODEL3D_START_SPEAKING':
    return {
      ...state,
      speaking: true,
      agent: action.payload.agent || null
    };

  case 'MODEL3D_STOP_SPEAKING':
    return {
      ...state,
      speaking: false,
      agent: null
    };

    // Breathing
  case 'MODEL3D_TOGGLE_BREATHING':
    return {
      ...state,
      breathing: !state.breathing
    };

  case 'MODEL3D_SET_BREATHING':
    return {
      ...state,
      breathing: action.payload.enabled
    };

    // Eye tracking
  case 'MODEL3D_TOGGLE_EYE_TRACKING':
    return {
      ...state,
      eyeTracking: !state.eyeTracking
    };

  case 'MODEL3D_SET_EYE_TRACKING':
    return {
      ...state,
      eyeTracking: action.payload.enabled
    };

    // Mouse position
  case 'MODEL3D_UPDATE_MOUSE_POSITION':
    return {
      ...state,
      mousePosition: action.payload
    };

    // Rotation
  case 'MODEL3D_UPDATE_ROTATION':
    return {
      ...state,
      rotation: {
        ...state.rotation,
        ...action.payload
      }
    };

    // Life state
  case 'MODEL3D_WAKE_UP':
    return {
      ...state,
      isAlive: true,
      energyLevel: 1.0
    };

  case 'MODEL3D_SLEEP':
    return {
      ...state,
      isAlive: false,
      energyLevel: 0.1
    };

    // Attention
  case 'MODEL3D_SET_ATTENTION':
    return {
      ...state,
      attentionLevel: Math.max(0, Math.min(1, action.payload.level))
    };

    // Energy
  case 'MODEL3D_SET_ENERGY':
    return {
      ...state,
      energyLevel: Math.max(0, Math.min(1, action.payload.level))
    };

    // Agent-specific emotions
  case 'MODEL3D_AGENT_EMOTION':
    const { agent, emotion } = action.payload;
    return {
      ...state,
      agent,
      emotion,
      intensity: 0.8
    };

  default:
    return state;
  }
}

export default model3dReducer;
