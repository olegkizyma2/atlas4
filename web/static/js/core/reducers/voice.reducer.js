/**
 * Voice Reducer
 *
 * Управляє станом голосової системи (STT, TTS, Keyword Detection)
 */

const initialState = {
  // Recording
  recording: false,
  recordingMode: null, // 'quick-send' | 'conversation' | null
  recordingStartTime: null,
  recordingDuration: 0,

  // Transcription
  transcribing: false,
  transcriptionText: '',
  transcriptionConfidence: 0,

  // Keyword detection
  keywordDetecting: false,
  detectedKeyword: null,
  keywordConfidence: 0,

  // TTS
  ttsPlaying: false,
  ttsAgent: null,
  ttsText: '',
  ttsProgress: 0,

  // Microphone
  microphoneAvailable: true,
  microphonePermission: 'prompt', // 'granted' | 'denied' | 'prompt'
  microphoneState: 'idle', // 'idle' | 'listening' | 'recording' | 'processing'

  // Statistics
  sessionsCount: 0,
  totalRecordingTime: 0,
  successfulTranscriptions: 0,
  failedTranscriptions: 0
};

export function voiceReducer(state = initialState, action) {
  switch (action.type) {
  // Recording
  case 'VOICE_START_RECORDING':
    return {
      ...state,
      recording: true,
      recordingMode: action.payload.mode || null,
      recordingStartTime: Date.now(),
      microphoneState: 'recording'
    };

  case 'VOICE_STOP_RECORDING':
    const duration = state.recordingStartTime
      ? Date.now() - state.recordingStartTime
      : 0;

    return {
      ...state,
      recording: false,
      recordingDuration: duration,
      totalRecordingTime: state.totalRecordingTime + duration,
      sessionsCount: state.sessionsCount + 1,
      microphoneState: 'processing'
    };

  case 'VOICE_CANCEL_RECORDING':
    return {
      ...state,
      recording: false,
      recordingMode: null,
      recordingStartTime: null,
      microphoneState: 'idle'
    };

    // Transcription
  case 'VOICE_START_TRANSCRIPTION':
    return {
      ...state,
      transcribing: true,
      transcriptionText: '',
      microphoneState: 'processing'
    };

  case 'VOICE_TRANSCRIPTION_COMPLETE':
    return {
      ...state,
      transcribing: false,
      transcriptionText: action.payload.text || '',
      transcriptionConfidence: action.payload.confidence || 0,
      successfulTranscriptions: state.successfulTranscriptions + 1,
      microphoneState: 'idle'
    };

  case 'VOICE_TRANSCRIPTION_ERROR':
    return {
      ...state,
      transcribing: false,
      transcriptionText: '',
      failedTranscriptions: state.failedTranscriptions + 1,
      microphoneState: 'idle'
    };

  case 'VOICE_CLEAR_TRANSCRIPTION':
    return {
      ...state,
      transcriptionText: '',
      transcriptionConfidence: 0
    };

    // Keyword detection
  case 'VOICE_START_KEYWORD_DETECTION':
    return {
      ...state,
      keywordDetecting: true,
      detectedKeyword: null,
      microphoneState: 'listening'
    };

  case 'VOICE_STOP_KEYWORD_DETECTION':
    return {
      ...state,
      keywordDetecting: false,
      detectedKeyword: null,
      microphoneState: 'idle'
    };

  case 'VOICE_KEYWORD_DETECTED':
    return {
      ...state,
      detectedKeyword: action.payload.keyword,
      keywordConfidence: action.payload.confidence || 0
    };

  case 'VOICE_CLEAR_KEYWORD':
    return {
      ...state,
      detectedKeyword: null,
      keywordConfidence: 0
    };

    // TTS
  case 'VOICE_TTS_START':
    return {
      ...state,
      ttsPlaying: true,
      ttsAgent: action.payload.agent || null,
      ttsText: action.payload.text || '',
      ttsProgress: 0
    };

  case 'VOICE_TTS_UPDATE':
    return {
      ...state,
      ttsProgress: action.payload.progress || 0
    };

  case 'VOICE_TTS_COMPLETE':
    return {
      ...state,
      ttsPlaying: false,
      ttsAgent: null,
      ttsText: '',
      ttsProgress: 0
    };

  case 'VOICE_TTS_ERROR':
    return {
      ...state,
      ttsPlaying: false,
      ttsAgent: null,
      ttsText: ''
    };

    // Microphone
  case 'VOICE_MICROPHONE_AVAILABLE':
    return {
      ...state,
      microphoneAvailable: action.payload.available
    };

  case 'VOICE_MICROPHONE_PERMISSION':
    return {
      ...state,
      microphonePermission: action.payload.permission
    };

  case 'VOICE_MICROPHONE_STATE':
    return {
      ...state,
      microphoneState: action.payload.state
    };

    // Statistics
  case 'VOICE_RESET_STATISTICS':
    return {
      ...state,
      sessionsCount: 0,
      totalRecordingTime: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0
    };

  default:
    return state;
  }
}

export default voiceReducer;
