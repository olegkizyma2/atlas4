# Whisper Loopback Audio Problem Fix

**Date:** 11.10.2025 - 03:58 AM  
**Issue:** WhisperKeywordDetection continuously transcribes "Дякую за перегляд!" even when user is silent  
**Status:** DIAGNOSING

## Problem Description

System continuously recognizes the phrase "Дякую за перегляд!" (Ukrainian YouTube outro) even when:
- User is not speaking
- No YouTube tabs are open
- Microphone should be capturing silence

## Evidence

```
[WHISPER_KEYWORD] 📝 Transcribed: "Дякую за перегляд!"
[WHISPER_KEYWORD] 📝 Transcribed: "Дякую за перегляд!"
[WHISPER_KEYWORD] 📝 Transcribed: "Дякую за перегляд!"
```

This repeats every 2.5 seconds (chunk duration).

## Possible Causes

1. **System Audio Loopback**
   - macOS capturing system audio output instead of microphone
   - Audio routing misconfiguration

2. **Cached Audio Hallucination**
   - Whisper model hallucinating based on Ukrainian language prompt
   - Known issue with Whisper when given empty/silent audio

3. **Background Audio Source**
   - Hidden browser tab with video
   - System notification sounds
   - Another application playing audio

## Diagnosis Steps

### Step 1: Check Audio Devices

Run in browser console:
```javascript
navigator.mediaDevices.enumerateDevices().then(devices => {
  const audioInputs = devices.filter(d => d.kind === 'audioinput');
  console.log('🎤 Available microphones:', audioInputs);
  audioInputs.forEach((d, i) => {
    console.log(`${i}. ${d.label} (${d.deviceId})`);
  });
});
```

### Step 2: Check Audio Stream

Run in browser console:
```javascript
navigator.mediaDevices.getUserMedia({ 
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true
  }
}).then(stream => {
  const tracks = stream.getAudioTracks();
  console.log('🎤 Active audio tracks:', tracks);
  tracks.forEach(track => {
    console.log('Track settings:', track.getSettings());
    console.log('Track constraints:', track.getConstraints());
  });
  
  // Create audio context to visualize levels
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  function checkLevel() {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    console.log('🔊 Audio level:', average.toFixed(2));
    
    if (average > 10) {
      console.log('⚠️ Audio detected! Microphone is picking up sound.');
    } else {
      console.log('✅ Silence - no audio input');
    }
  }
  
  // Check for 5 seconds
  const interval = setInterval(checkLevel, 500);
  setTimeout(() => {
    clearInterval(interval);
    stream.getTracks().forEach(t => t.stop());
    audioContext.close();
    console.log('Audio monitoring stopped');
  }, 5000);
});
```

### Step 3: Check Whisper Service

```bash
# Check Whisper logs for audio size
tail -f /Users/dev/Documents/GitHub/atlas4/logs/whisper.log | grep "audio"
```

If audio files are 0 bytes or very small, it's a silence hallucination issue.

### Step 4: Check macOS Audio Settings

1. **System Settings → Sound → Input**
   - Check which device is selected
   - Verify input level meter shows movement when you speak

2. **Activity Monitor → Filter "coreaudiod"**
   - Check if audio daemon is working properly

3. **Audio MIDI Setup** (Applications → Utilities)
   - Check for aggregate devices or loopback configurations

## Fixes

### Fix 1: Force Specific Microphone Device

Modify `whisper-keyword-detection.js` to allow device selection:

```javascript
async startListening() {
    if (this.isListening) {
        this.logger.warn('Already listening for keywords');
        return;
    }

    try {
        // Get available devices first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        
        console.log('[WHISPER_KEYWORD] Available audio inputs:', audioInputs);
        
        // Try to find built-in microphone (not loopback)
        const builtInMic = audioInputs.find(d => 
            d.label.toLowerCase().includes('built-in') || 
            d.label.toLowerCase().includes('internal')
        );
        
        const deviceId = builtInMic?.deviceId || audioInputs[0]?.deviceId;
        console.log('[WHISPER_KEYWORD] Using audio device:', builtInMic?.label || audioInputs[0]?.label);
        
        // Obtain microphone with specific device
        this.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // ... rest of code
    }
}
```

### Fix 2: Detect Silent Audio & Skip Transcription

Add silence detection before sending to Whisper:

```javascript
async recordChunk() {
    return new Promise((resolve, reject) => {
        // ... existing code ...
        
        this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.audioChunks = [];
            
            // Check if audio is actually silent
            const isSilent = await this.detectSilence(audioBlob);
            if (isSilent) {
                console.log('[WHISPER_KEYWORD] 🔇 Silence detected, skipping transcription');
                resolve(null);
                return;
            }
            
            resolve(audioBlob);
        };
    });
}

async detectSilence(audioBlob) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const pcmData = audioBuffer.getChannelData(0);
    
    // Calculate RMS (root mean square) energy
    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
        sum += pcmData[i] * pcmData[i];
    }
    const rms = Math.sqrt(sum / pcmData.length);
    
    // Threshold for silence (adjust as needed)
    const silenceThreshold = 0.01;
    
    console.log('[WHISPER_KEYWORD] Audio RMS level:', rms.toFixed(4));
    
    await audioContext.close();
    return rms < silenceThreshold;
}
```

### Fix 3: Disable Whisper Hallucination

Modify Whisper prompt to reduce hallucination:

In `services/whisper/whispercpp_service.py`:

```python
# Add no_speech_threshold to reject hallucinations
result = model.transcribe(
    audio_path,
    language=language,
    temperature=temperature,
    no_speech_threshold=0.6,  # Higher = more strict (0.0 - 1.0)
    logprob_threshold=-1.0,
    compression_ratio_threshold=2.4
)

# Check if result is likely hallucination
if not result['text'].strip() or result.get('no_speech_prob', 0) > 0.6:
    return {"text": "", "confidence": 0.0}
```

## Next Steps

1. Run diagnostic steps above
2. Check what audio device is being used
3. Implement silence detection
4. Add device selector UI

## Related Issues

- Whisper hallucination on silence: https://github.com/openai/whisper/discussions/679
- MediaDevices audio loopback on macOS: Known Chrome issue

## Status Updates

- **03:58 AM** - Problem identified, creating diagnostic plan
- **TBD** - Awaiting diagnostic results from user
