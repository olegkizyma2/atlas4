Відображення у веб:

ATLAS SYSTEM LOGS
17
⌫
⏸
⬇
14:08:52
system
[LoggingSystem]
Animated Logging System v4.0 initialized
14:08:52
success
[LoggingSystem]
✅ Animated Logging System v4.0 готовий
14:08:52
info
[UI-Controller]
Advanced UI connected to existing logging system
14:08:52
success
[TTS-System]
TTS Visualization system initialized
14:08:52
info
[ChatManager]
💬 Ініціалізація Chat Manager
14:08:52
info
[TTS-System]
🎵 Ініціалізація TTS System
14:08:52
success
[WebSocket]
🔗 WebSocket підключення встановлено
14:08:52
info
[WebSocket]
🔗 Реального часу зв'язок встановлено
14:08:52
success
[TTS-System]
✅ TTS сервіс готовий до озвучення
14:08:52
success
[ChatManager]
✅ Chat Manager готовий до роботи
14:08:52
info
[Voice-System]
🎤 Запуск голосового управління...
14:08:52
success
[Voice-System]
✅ Голосове управління готове
14:08:52
success
[Voice-System]
✅ Режими спілкування готові
14:09:26
info
[Chat-System]
📤 Відправка повідомлення до Orchestrator
14:09:38
success
[Chat-System]
✅ Потік завершено успішно
14:10:49
info
[Chat-System]
📤 Відправка повідомлення до Orchestrator
14:11:00
success
[Chat-System]
✅ Потік завершено успішно
INFO: 17
WARN: 0
ERROR: 0
14:09:26
[USER]
Привіт
14:10:49
[USER]
Закрий всі відкриті хроміум, але не хром.
---------------------------------------------


Відображення у енв потрібна корекція у .env.example:

# ===================================
# ATLAS v4.0 - Environment Configuration
# Generated: 2025-10-13 21:30 EEST
# ===================================

# === SYSTEM ===
NODE_ENV=production
BUILD_NUMBER=dev
LOG_LEVEL=info
FORCE_FREE_PORTS=true

# === AI BACKEND CONFIGURATION (NEW 13.10.2025) ===

# Backend mode: 'goose' | 'mcp' | 'hybrid'
# - goose: Use only Goose Desktop for all tasks
# - mcp: Use only MCP Direct (faster, no overhead)
# - hybrid: Auto-select based on task complexity (default)
AI_BACKEND_MODE=mcp

# Primary backend for task execution
AI_BACKEND_PRIMARY=mcp

# Fallback backend when primary fails
AI_BACKEND_FALLBACK=goose

# Disable fallback to Goose on MCP failures (strict mode)
# - true: System will throw errors on MCP failures (no fallback)
# - false: System will fallback to Goose on MCP failures (default, safe)
# НОВИНКА 13.10.2025 - Для тестування MCP без маскування помилок
# РЕКОМЕНДАЦІЯ: false для production, true для development

AI_BACKEND_DISABLE_FALLBACK=true

# === GOOSE DESKTOP ===
GOOSE_BIN=/Applications/Goose.app/Contents/MacOS/goose
GOOSE_DESKTOP_PATH=/Applications/Goose.app/Contents/MacOS/goose
GOOSE_SERVER_PORT=3000
GOOSE_PORT=3000
GOOSE_DISABLE_KEYRING=1


# === TTS & VOICE ===
REAL_TTS_MODE=true
TTS_DEVICE=mps
TTS_PORT=3001

# === WHISPER CONFIGURATION ===
WHISPER_BACKEND=cpp
WHISPER_DEVICE=metal
WHISPER_PORT=3002
WHISPER_CPP_BIN=/Users/dev/Documents/GitHub/atlas4/third_party/whisper.cpp.upstream/build/bin/whisper-cli
WHISPER_CPP_MODEL=/Users/dev/Documents/GitHub/atlas4/models/whisper/ggml-large-v3.bin
WHISPER_CPP_NGL=20
WHISPER_CPP_THREADS=10
WHISPER_CPP_DISABLE_GPU=false

# === NETWORK PORTS ===
ORCHESTRATOR_PORT=5101
WEB_PORT=5001
FRONTEND_PORT=5001

# === FEATURES ===
USE_METAL_GPU=true

# =============================================================================
# MCP Model Configuration (Added 14.10.2025)
# =============================================================================
# Per-stage model selection for MCP Dynamic TODO Workflow
# Available models on localhost:4000 - use lightweight models to avoid rate limits

# ================= MCP MODEL CONFIGURATION (API :4000) ======================
# Всі моделі для MCP Dynamic TODO Workflow (API на порті 4000)
# Можна змінювати для кожної стадії окремо
# Рекомендація: для великих промптів використовувати моделі з великим контекстом

# --- Stage-specific models ---
MCP_MODEL_MODE_SELECTION=mistral-ai/ministral-3b                   # Stage 0: Mode Selection
MCP_MODEL_BACKEND_SELECTION=mistral-ai/ministral-3b                # Stage 0.5: Backend Selection
MCP_MODEL_TODO_PLANNING=mistral-ai/mistral-small-2503              # Stage 1: TODO Planning
MCP_MODEL_PLAN_TOOLS=mistral-ai/mistral-small-2503                 # Stage 2.1: FIXED 15.10.2025 - ЧИСТИЙ JSON (було: phi-4)
MCP_MODEL_VERIFY_ITEM=mistral-ai/mistral-small-2503                # Stage 2.3: FIXED 15.10.2025 - ЧИСТИЙ JSON (було: Phi-3)
MCP_MODEL_ADJUST_TODO=openai/gpt-4o                                # Stage 3: Adjust TODO
MCP_MODEL_FINAL_SUMMARY=mistral-ai/ministral-3b                    # Stage 8: Final Summary

# --- Temperature settings (lower = more deterministic) ---
MCP_TEMP_MODE_SELECTION=0.1
MCP_TEMP_BACKEND_SELECTION=0.1
MCP_TEMP_TODO_PLANNING=0.3
MCP_TEMP_PLAN_TOOLS=0.15                # FIXED 15.10.2025 - знижено для точності (було: 0.2)
MCP_TEMP_VERIFY_ITEM=0.15               # FIXED 15.10.2025 - знижено для точності (було: 0.2)
MCP_TEMP_ADJUST_TODO=0.3
MCP_TEMP_FINAL_SUMMARY=0.5


---------------------------------------

Відображення у веб тулс логи:

diagnostics.js?v=1760612932:191 🔧 ATLAS Diagnostics loaded. Use window.atlasDiagnostics.runDiagnostics() to run tests manually.
(index):115 SW registered: ServiceWorkerRegistration {installing: null, waiting: null, active: ServiceWorker, navigationPreload: NavigationPreloadManager, scope: 'http://localhost:5001/static/js/', …}
logger.js:39 [14:08:52] [APP] 🚀 ATLAS APP INIT: load_1760612932200_18hh7 
logger.js:39 [14:08:52] [APP] 🔌 Initializing WebSocket Connection... 
logger.js:39 [14:08:52] [ATLAS] Connecting to WebSocket: ws://localhost:5102 
logger.js:39 [14:08:52] [APP] ✅ Animated Logging System initialized 
logger.js:39 [14:08:52] [APP] 🧬 Initializing Atlas GLB Living System v4.0... 
atlas-glb-living-system.js:138 🧬 Initializing Atlas GLB Living System v4.0...
atlas-glb-living-system.js:201 ⏳ Waiting for GLB model to load...
logger.js:39 [14:08:52] [APP] 🎭 Initializing Enhanced Living Behavior v5.0... 
atlas-living-behavior-enhanced.js:39 🎭 Initializing Enhanced Living Behavior...
atlas-living-behavior-enhanced.js:53 ✨ Enhanced Living Behavior активовано!
logger.js:39 [14:08:52] [APP] ✨ Enhanced Living Behavior v5.0 активовано! 
logger.js:39 [14:08:52] [APP] ✨ Atlas GLB Living System v4.0 initialized successfully 
logger.js:39 [14:08:52] [APP] 🎵 Initializing TTS Visualization... 
logger.js:39 [14:08:52] [APP] ✅ TTS Visualization initialized 
logger.js:39 [14:08:52] [APP] 🎨 Initializing Advanced UI System... 
atlas-tts-visualization.js:118 🎤 Atlas TTS Visualization v4.0 initialized
atlas-advanced-ui.js:235 🎨 Atlas Advanced UI using existing Living Behavior controller
atlas-tts-visualization.js:118 🎤 Atlas TTS Visualization v4.0 initialized
atlas-advanced-ui.js:92 🎨 Atlas Advanced UI v4.0 initialized
logger.js:39 [14:08:52] [APP] 💬 Initializing Chat Manager... 
logger.js:39 [14:08:52] [CHAT] Initializing Chat Manager... 
logger.js:36 [14:08:52] [TTS] Initializing TTSManager... 
logger.js:36 [14:08:52] [TTS] GET http://localhost:3001/health 
test-glb-living.js?v=1760612932:223 🧪 Atlas GLB Test Suite loaded. Use window.testAtlasGLB.runAll() to run all tests or individual test methods.
logger.js:39 [14:08:52] [ATLAS] WebSocket connected successfully 
logger.js:36 [14:08:52] [ATLAS] Sent WebSocket message: subscribe {channels: Array(4)}
logger.js:39 [14:08:52] [APP] 🔗 WebSocket connected to orchestrator 
logger.js:36 [14:08:52] [TTS] Response from /health {device: 'mps', status: 'ok', timestamp: 1760612932.211094, tts_ready: true}
logger.js:36 [14:08:52] [TTS] TTS health check response: {device: 'mps', status: 'ok', timestamp: 1760612932.211094, tts_ready: true}
logger.js:39 [14:08:52] [TTS] TTS service available 
logger.js:36 [14:08:52] [TTS] ✅ Subscribed to TTS events 
logger.js:39 [14:08:52] [CHAT] UI Elements found: chat-container=true, message-input=true, send-button=true 
logger.js:39 [14:08:52] [CHAT] Chat Manager initialized 
logger.js:39 [14:08:52] [APP] 🎤 Initializing Voice Control System... 
atlas-voice-integration.js:34 🎙️ Initializing ATLAS Voice Control System...
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing VOICE_CONTROL_MANAGER service
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing Voice Control System v4.0
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing WHISPER_SERVICE service
logger.js:36 [14:08:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:08:52.215546', received: {…}}
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Whisper service available: whisper.cpp on metal
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Whisper service initialized (URL: http://localhost:3002)
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] WHISPER_SERVICE service initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing MICROPHONE_BUTTON service
logger.js:177 [14:08:52] [MICROPHONE_BUTTON] [WARN] Media support check failed during initialization (will retry on first use) 
Data: null 
Error: NotFoundError: Requested device not found
_logToConsole @ logger.js:177
_log @ logger.js:132
warn @ logger.js:282
onInitialize @ microphone-button-service.js:157
await in onInitialize
initialize @ base-service.js:92
initializeServices @ voice-control-manager.js:316
await in initializeServices
onInitialize @ voice-control-manager.js:130
initialize @ base-service.js:92
create @ voice-control-manager.js:899
createWithCallbacks @ voice-control-manager.js:929
initialize @ atlas-voice-integration.js:45
initializeAtlasVoice @ atlas-voice-integration.js:598
initializeManagers @ app-refactored.js?v=1760612932:212
await in initializeManagers
init @ app-refactored.js?v=1760612932:80
(anonymous) @ app-refactored.js?v=1760612932:1095
logger.js:177 [14:08:52] [MICROPHONE_BUTTON] [INFO] Microphone button service initialized
logger.js:177 [14:08:52] [MICROPHONE_BUTTON] [INFO] MICROPHONE_BUTTON service initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing SPEECH_RESULTS service
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Speech results service initialized
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] SPEECH_RESULTS service initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing WHISPER_KEYWORD_DETECTION service
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] 🔗 Subscribing to START_KEYWORD_DETECTION event...
whisper-keyword-detection.js:109 [WHISPER_KEYWORD] 🔗 Subscribing to START_KEYWORD_DETECTION event... {eventManager: true, eventManagerOn: 'function'}
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] ✅ Subscribed to START_KEYWORD_DETECTION event
whisper-keyword-detection.js:128 [WHISPER_KEYWORD] ✅ Subscribed to START_KEYWORD_DETECTION event
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Whisper keyword detection initialized
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] WHISPER_KEYWORD_DETECTION service initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initializing POST_CHAT_ANALYZER service
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Post-chat analysis service ready (audio context will initialize on demand)
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] POST_CHAT_ANALYZER service initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Initialized 5 services
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Starting Voice Control System
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Voice Control System started successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] Voice Control System initialized successfully
logger.js:177 [14:08:52] [VOICE_CONTROL_MANAGER] [INFO] VOICE_CONTROL_MANAGER service initialized successfully
atlas-voice-integration.js:88 ✅ ATLAS Voice Control System initialized successfully
logger.js:39 [14:08:52] [APP] ✅ Voice Control System initialized 
logger.js:39 [14:08:52] [APP] 💬 Initializing Conversation Mode Manager... 
app-refactored.js?v=1760612932:235 [APP] 🔍 Voice Control EventManager: {hasVoiceControl: true, hasGetEventManagerMethod: true, eventManager: EventManager, eventManagerEmit: 'function', eventManagerOn: 'function'}
logger.js:177 [14:08:52] [CONVERSATION_MODE] [INFO] 🏗️ Initializing with modular architecture...
logger.js:177 [14:08:52] [CONVERSATION_STATE] [INFO] 🔧 ConversationStateManager initialized
logger.js:177 [14:08:52] [CONVERSATION_MODE] [INFO] 🎙️ Initializing Conversation Mode Manager (Modular)...
logger.js:177 [14:08:52] [CONVERSATION_UI] [INFO] 🔧 ConversationUIController initialized 
Data: {hasMicButton: true, hasStatusElement: false, autoCreate: true}
logger.js:177 [14:08:52] [CONVERSATION_UI] [INFO] ✅ UI Controller initialized
logger.js:177 [14:08:52] [CONVERSATION_EVENTS] [INFO] 🔧 ConversationEventHandlers initialized
logger.js:177 [14:08:52] [CONVERSATION_EVENTS] [INFO] 📡 Subscribing to conversation events...
logger.js:177 [14:08:52] [CONVERSATION_EVENTS] [INFO] ✅ Subscribed to 11 events
logger.js:177 [14:08:52] [CONVERSATION_MODE] [INFO] ✅ Conversation Mode Manager initialized (Modular)
logger.js:39 [14:08:52] [APP] 🔗 Integrating Conversation Mode with system... 
logger.js:39 [14:08:52] [APP] ✅ Conversation Mode integration complete 
logger.js:39 [14:08:52] [APP] ✅ Conversation Mode Manager initialized 
logger.js:39 [14:08:52] [APP] 🔗 All components integrated successfully 
logger.js:39 [14:08:52] [APP] 🎯 All managers initialized successfully 
logger.js:39 [14:08:52] [APP] ✅ All managers initialized successfully 
logger.js:36 [14:08:52] [APP] Switched to chat tab 
logger.js:36 [14:08:52] [APP] Voice controls disabled (replaced by TTS toggle) 
logger.js:39 [14:08:52] [APP] ✅ Atlas Application initialized successfully 
three.module.js:9 [Violation] 'requestAnimationFrame' handler took 118ms
atlas-glb-living-system.js:212 ✅ GLB model loaded successfully
atlas-glb-living-system.js:217 📦 Model info: {hasAnimations: false, animationCount: 0, boundingBox: undefined}
atlas-glb-living-system.js:279 ⚙️ Model defaults configured
atlas-glb-living-system.js:187 🚫 Interaction prompt disabled
atlas-glb-living-system.js:337 🔄 Living loop started
atlas-glb-living-system.js:544 👂 Event listeners set up
atlas-glb-living-system.js:286 🌅 Atlas is awakening...
atlas-glb-living-system.js:567 😊 Emotion: curious (0.80)
atlas-glb-living-system.js:148 ✨ Atlas helmet is now ALIVE!
atlas-glb-living-system.js:172 ✅ Interaction prompt removed
atlas-glb-living-system.js:567 😊 Emotion: startup (0.80)
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
test-glb-living.js?v=1760612932:15 🧪 Atlas GLB Test Suite loaded. Use window.testAtlasGLB for manual testing.
atlas-glb-living-system.js:567 😊 Emotion: neutral (0.50)
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 49.825560115916815, x: 11.390254632869034, z: -3.0459006256014383}
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору: {y: 3.99846275385423, x: 31.906014327251306, z: 0.702647471473854}
logger.js:36 [14:09:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:09:11] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:210 ⏰ Idle 15007ms - наближаюсь!
atlas-living-behavior-enhanced.js:231 🔍 Наближаюсь до камери...
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -46.96823733658967, x: 10.501652513784313, z: 2.5155626228841985}
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
atlas-living-behavior-enhanced.js:216 👋 Активність виявлена - відходжу назад
atlas-living-behavior-enhanced.js:270 ↩️ Відходжу від камери...
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
logger.js:39 [14:09:18] [TTS] Autoplay unlocked via user gesture 
logger.js:36 [14:09:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:09:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:09:22.241273', received: {…}}
logger.js:39 [14:09:26] [CHAT] 💬 sendMessage called with: "Привіт" (isStreaming: false) 
atlas-glb-living-system.js:698 ⚡ Reacting to event: message-sent {}
atlas-glb-living-system.js:567 😊 Emotion: listening (0.70)
atlas-glb-living-system.js:567 😊 Emotion: listening (0.70)
logger.js:36 [14:09:26] [ATLAS] Sent WebSocket message: model3d-command {action: 'set-emotion', params: {…}}
logger.js:39 [14:09:26] [CHAT] Starting message stream... 
logger.js:39 [14:09:26] [CHAT] Streaming to orchestrator: Привіт... 
logger.js:39 [14:09:26] [ORCHESTRATOR] Starting stream: http://localhost:5101/chat/stream 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь далеко-праворуч: {y: 53.216016464117345, x: 1.851771880891829, z: -9.09186445530952}
logger.js:36 [14:09:26] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:09:26.459866', received: {…}}
logger.js:36 [14:09:27] [CHAT] Unknown stream message type mode_selected
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
logger.js:36 [14:09:38] [CHAT] Unknown stream message type mcp_workflow_error
logger.js:39 [14:09:38] [ORCHESTRATOR] Stream completed successfully 
logger.js:39 [14:09:38] [CHAT] Stream completed 
logger.js:39 [14:09:38] [CHAT] Message stream completed successfully 
logger.js:39 [14:09:38] [CHAT] Cleaning up streaming state... 
logger.js:36 [14:09:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:09:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 31.239047903981426, x: -28.0483501199945, z: -1.4933300246274979}
atlas-living-behavior-enhanced.js:210 ⏰ Idle 15005ms - наближаюсь!
atlas-living-behavior-enhanced.js:231 🔍 Наближаюсь до камери...
logger.js:36 [14:09:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:09:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:09:52.218926', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 39.545436273512195, x: -21.703200650214384, z: -2.461403185507434}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 47.29029015503505, x: 13.977632536823458, z: -3.78469375388186}
logger.js:36 [14:10:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:10:11] [ATLAS] Health check received 
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
atlas-living-behavior-enhanced.js:216 👋 Активність виявлена - відходжу назад
atlas-living-behavior-enhanced.js:270 ↩️ Відходжу від камери...
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору: {y: 4.524314752812367, x: 29.072437785883785, z: -1.0975051607898285}
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
logger.js:36 [14:10:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:10:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:10:22.218144', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -47.30901737208987, x: 16.58909698900479, z: 3.2668460207098886}
logger.js:36 [14:10:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:10:41] [ATLAS] Health check received 
logger.js:39 [14:10:49] [CHAT] 💬 sendMessage called with: "Закрий всі відкриті хроміум, але не хром." (isStreaming: false) 
atlas-glb-living-system.js:698 ⚡ Reacting to event: message-sent {}
atlas-glb-living-system.js:567 😊 Emotion: listening (0.70)
atlas-glb-living-system.js:567 😊 Emotion: listening (0.70)
logger.js:36 [14:10:49] [ATLAS] Sent WebSocket message: model3d-command {action: 'set-emotion', params: {…}}
logger.js:39 [14:10:49] [CHAT] Starting message stream... 
logger.js:39 [14:10:49] [CHAT] Streaming to orchestrator: Закрий всі відкриті хроміум, але не хром.... 
logger.js:39 [14:10:49] [ORCHESTRATOR] Starting stream: http://localhost:5101/chat/stream 
logger.js:36 [14:10:49] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:10:49.851543', received: {…}}
logger.js:36 [14:10:51] [CHAT] Unknown stream message type mode_selected
logger.js:36 [14:10:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:10:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:10:52.215706', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -41.93747107077626, x: -23.344254708110586, z: 4.397232647170244}
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
logger.js:36 [14:11:00] [CHAT] Unknown stream message type mcp_workflow_error
logger.js:39 [14:11:00] [ORCHESTRATOR] Stream completed successfully 
logger.js:39 [14:11:00] [CHAT] Stream completed 
logger.js:39 [14:11:00] [CHAT] Message stream completed successfully 
logger.js:39 [14:11:00] [CHAT] Cleaning up streaming state... 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -34.056827654783085, x: -22.26512211542633, z: 4.441685333373849}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 54.30345278319283, x: 18.674644819220312, z: -2.7315384818478075}
atlas-living-behavior-enhanced.js:210 ⏰ Idle 15013ms - наближаюсь!
atlas-living-behavior-enhanced.js:231 🔍 Наближаюсь до камери...
logger.js:36 [14:11:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:11:11] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 32.09465668727685, x: -22.580610135486154, z: -4.906712693400789}
logger.js:36 [14:11:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:11:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:11:22.217529', received: {…}}
logger.js:36 [14:11:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:11:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 39.02456947814912, x: -25.902718293908602, z: -4.338265186139444}
logger.js:36 [14:11:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:11:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:11:52.215947', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 48.72580855246231, x: 14.499317848284873, z: -3.8333358549608336}
logger.js:36 [14:12:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:12:11] [ATLAS] Health check received 
logger.js:36 [14:12:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:12:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:12:22.217638', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 29.780288602307195, x: -27.239059429946778, z: -1.6714836110904703}
logger.js:36 [14:12:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:12:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вниз: {y: -1.8722859035074642, x: -30.870344646203268, z: -2.4907827149301727}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -32.26741159793173, x: -27.45490856874251, z: 4.528692920126501}
logger.js:36 [14:12:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:12:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:12:52.217281', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -40.616595328423145, x: -22.021392097993655, z: 1.0692380323424566}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -41.35744177797371, x: -23.036714616425765, z: 3.1381684238566203}
logger.js:36 [14:13:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:13:11] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -52.728564262259546, x: 15.931070249589927, z: 5.662775876300173}
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-living-behavior-enhanced.js:216 👋 Активність виявлена - відходжу назад
atlas-living-behavior-enhanced.js:270 ↩️ Відходжу від камери...
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
logger.js:36 [14:13:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:13:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:13:22.217537', received: {…}}
atlas-glb-living-system.js:567 😊 Emotion: welcoming (0.60)
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору: {y: 3.824721156757709, x: 26.13521228402408, z: -1.440697362505719}
atlas-glb-living-system.js:567 😊 Emotion: lonely (0.30)
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -56.03039066927418, x: 16.46482298943243, z: 6.406222869599885}
logger.js:36 [14:13:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:13:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вниз: {y: 3.3222839798009, x: -32.29236243444126, z: -0.4188617518402382}
atlas-living-behavior-enhanced.js:210 ⏰ Idle 15013ms - наближаюсь!
atlas-living-behavior-enhanced.js:231 🔍 Наближаюсь до камери...
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -47.866052063995525, x: 14.840537151394093, z: 3.3317529900904868}
logger.js:36 [14:13:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:13:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:13:52.216612', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-ліво: {y: -38.27880865923701, x: -28.600230339806323, z: 3.117320972191499}
logger.js:36 [14:14:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:14:11] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 52.820356935971674, x: 19.09852159229036, z: -5.3172444015241}
logger.js:36 [14:14:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:14:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:14:22.218931', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -56.54059311546018, x: 10.355094679945417, z: 5.686936216400928}
logger.js:36 [14:14:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:14:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 54.43084982461638, x: 19.371615050646078, z: -6.658022963851193}
logger.js:36 [14:14:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:14:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:14:52.216448', received: {…}}
logger.js:36 [14:15:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:15:11] [ATLAS] Health check received 
logger.js:36 [14:15:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:15:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:15:22.219015', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вниз: {y: -6.681179822473862, x: -26.535795720701685, z: -2.314004383916184}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь вгору-право: {y: 40.47273187434391, x: -24.3109870974112, z: -2.651167473992614}
logger.js:36 [14:15:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:15:41] [ATLAS] Health check received 
logger.js:36 [14:15:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:15:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:15:52.219459', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 48.471582854076104, x: 17.056414964487807, z: -4.007306463046666}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь ліворуч: {y: -56.090215708341304, x: 18.820211838374334, z: 6.466732739608444}
logger.js:36 [14:16:11] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:16:11] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 56.08415041834757, x: 13.041487638829416, z: -6.032289338332065}
logger.js:36 [14:16:22] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:16:22] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:16:22.218216', received: {…}}
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 43.175890337884574, x: 11.747944480064982, z: -6.433693725429668}
logger.js:36 [14:16:41] [ATLAS] WebSocket message: health_check 
logger.js:36 [14:16:41] [ATLAS] Health check received 
atlas-living-behavior-enhanced.js:118 👀 Дивлюсь праворуч: {y: 44.726194260722764, x: 11.942157148225109, z: -5.637962047327022}
logger.js:36 [14:16:52] [ATLAS] Sent WebSocket message: ping {}
logger.js:36 [14:16:52] [ATLAS] WebSocket message with missing or undefined type {status: 'ok', timestamp: '2025-10-16T14:16:52.221484', received: {…}}


-------------------------------


Відображення у логах оркестратора:


2025-10-16 14:08:41 [[32MINFO[39M] Axios configured with rate limit handling (429 + Retry-After) {"metadata":{}}
[INIT] Axios configured with 429 rate limit handling
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Registering all services... {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Registered 8 MCP stage processors {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Registered 19 services {"metadata":{"category":"system","component":"startup","services":["config","logger","errorHandler","telemetry","wsManager","webIntegration","sessions","networkConfig","mcpManager","ttsSyncManager","mcpTodoManager","modeSelectionProcessor","atlasTodoPlanningProcessor","serverSelectionProcessor","tetyanaПlanToolsProcessor","tetyanaExecuteToolsProcessor","grishaVerifyItemProcessor","atlasAdjustTodoProcessor","mcpFinalSummaryProcessor"]}}
2025-10-16 14:08:41 [[32MINFO[39M] [DI] Initializing services... {"metadata":{}}
[DI] Initializing services...
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] tts-sync: [TTS-SYNC] ✅ WebSocket Manager connected for TTS delivery {"metadata":{"category":"system","component":"tts-sync"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] tts-sync: [TTS-SYNC] Initialized with 3-level queue system {"metadata":{"category":"system","component":"tts-sync"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Logger service initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: logger
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Error handler initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: errorHandler
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Telemetry initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: telemetry
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] WebSocket manager initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: wsManager
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Web integration initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: webIntegration
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] startup: [DI] Session store initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: sessions
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting MCP servers... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting filesystem... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP filesystem] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting playwright... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP playwright] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting shell... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP shell] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting applescript... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP applescript] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting git... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP git] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] Starting memory... {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:41 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP memory] Initializing... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:42 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP shell] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:42 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP shell] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:42 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP shell] ✅ Loaded 9 tools {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:42 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ shell started (9 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:42 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP memory] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP memory] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP memory] ✅ Loaded 9 tools {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ memory started (9 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP filesystem] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP filesystem] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP filesystem] ✅ Loaded 14 tools {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ filesystem started (14 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP playwright] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP applescript] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP git] ✅ Initialized, waiting for tools list... {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP playwright] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP applescript] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP git] ✅ Ready {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP playwright] ✅ Loaded 32 tools {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ playwright started (32 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-server: [MCP applescript] ✅ Loaded 1 tools {"metadata":{"category":"system","component":"mcp-server"}}
2025-10-16 14:08:43 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ applescript started (1 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:09:03 [[33MWARN[39M] mcp-server {"metadata":{}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ git started (0 tools) {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] mcp-manager: [MCP Manager] ✅ 6/6 servers started {"metadata":{"category":"system","component":"mcp-manager"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: [DI] MCPManager initialized with servers {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: mcpManager
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: [DI] TTSSyncManager initialized with WebSocket TTS {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: ttsSyncManager
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: [DI] MCPTodoManager initialized {"metadata":{"category":"system","component":"startup"}}
[DI] Initialized: mcpTodoManager
2025-10-16 14:09:03 [[32MINFO[39M] [DI] All services initialized {"metadata":{}}
[DI] All services initialized
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: [DI] All services resolved successfully {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: Validating configuration... {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: Configuration validated successfully {"metadata":{"category":"system","component":"startup","agents":5,"stages":13,"services":6}}
2025-10-16 14:09:03 [[32MINFO[39M] [DI] Starting services... {"metadata":{}}
[DI] Starting services...
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: [DI] WebSocket manager ready {"metadata":{"category":"system","component":"startup"}}
[DI] Started: wsManager
2025-10-16 14:09:03 [[32MINFO[39M] [DI] All services started {"metadata":{}}
[DI] All services started
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: Application routes configured {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: Session cleanup timer started {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[32MINFO[39M] WebSocket server started on port 5102 {"metadata":{"port":5102,"heartbeatInterval":30000}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] websocket: WebSocket server running on port 5102 {"metadata":{"category":"system","component":"websocket"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: 🚀 ATLAS Orchestrator v4.0 running on port 5101 {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] features: DI Container, Unified Configuration, Prompt Registry, Web Integration, Real-time Logging, 3D Model Control, TTS Visualization, Centralized State, Unified Error Handling, Agent Manager, Telemetry & Monitoring {"metadata":{"category":"system","component":"features"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] config: Configuration loaded: 5 agents, 13 stages {"metadata":{"category":"system","component":"config"}}
2025-10-16 14:09:03 [[32MINFO[39M] [SYSTEM] startup: ✅ ATLAS Orchestrator fully initialized with DI Container {"metadata":{"category":"system","component":"startup"}}
2025-10-16 14:09:03 [[33MWARN[39M] mcp-server {"metadata":{}}
2025-10-16 14:09:26 [[32MINFO[39M] [WORKFLOW] Stage start - system: Starting workflow for message: "Привіт..." {"metadata":{"category":"workflow","stage":"start","agent":"system","sessionId":"session_1760612966459_8350x6f0s","messageLength":6}}
2025-10-16 14:09:26 [[32MINFO[39M] [WORKFLOW] Stage init - mcp: Starting MCP Dynamic TODO Workflow {"metadata":{"category":"workflow","stage":"init","agent":"mcp","sessionId":"session_1760612966459_8350x6f0s","userMessage":"Привіт"}}
2025-10-16 14:09:26 [[32MINFO[39M] [WORKFLOW] Stage init - mcp: Starting MCP Dynamic TODO Workflow {"metadata":{"category":"workflow","stage":"init","agent":"mcp","sessionId":"session_1760612966459_8350x6f0s","userMessage":"Привіт"}}
2025-10-16 14:09:26 [[32MINFO[39M] [WORKFLOW] Stage stage - system: Stage 0-MCP: Mode Selection {"metadata":{"category":"workflow","stage":"stage","agent":"system","sessionId":"session_1760612966459_8350x6f0s"}}
2025-10-16 14:09:26 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] 🔍 Starting mode selection... {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:09:26 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] Analyzing: "Привіт" {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] Raw response: {"mode": "chat", "confidence": 0.99, "reasoning": "Розмовний запит"} {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] ✅ Mode: chat (confidence: 0.99) {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP]    Reasoning: Розмовний запит {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:09:27 [[32MINFO[39M] [WORKFLOW] Stage stage - system: Mode selected: chat (confidence: 0.99) {"metadata":{"category":"workflow","stage":"stage","agent":"system","sessionId":"session_1760612966459_8350x6f0s","reasoning":"Розмовний запит"}}
2025-10-16 14:09:27 [[32MINFO[39M] [WORKFLOW] Stage stage - atlas: Chat mode detected - Atlas will respond directly {"metadata":{"category":"workflow","stage":"stage","agent":"atlas","sessionId":"session_1760612966459_8350x6f0s"}}
2025-10-16 14:09:27 [[32MINFO[39M] [WORKFLOW] Stage stage - atlas: Stage 1-MCP: TODO Planning {"metadata":{"category":"workflow","stage":"stage","agent":"atlas","sessionId":"session_1760612966459_8350x6f0s"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] 🎯 Starting TODO planning... {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] Request: "Привіт" {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] Context: {"request":"Привіт","timestamp":"2025-10-16T11:09:27.973Z","sessionId":"session_1760612966459_8350x6f0s","recentContext":[]} {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] mcp-todo: [TODO] Creating TODO for request: "Привіт" {"metadata":{"category":"system","component":"mcp-todo"}}
2025-10-16 14:09:27 [[32MINFO[39M] [SYSTEM] mcp-todo: [TODO] Using model: mistral-ai/mistral-small-2503 (temp: 0.3, max_tokens: 4000) {"metadata":{"category":"system","component":"mcp-todo"}}
2025-10-16 14:09:38 [[31MERROR[39M] [MCP-TODO] Failed to create TODO: Cannot read properties of undefined (reading 'content') {"metadata":{"category":"mcp-todo","component":"mcp-todo"}}
2025-10-16 14:09:38 [[31MERROR[39M] atlas-todo-planning {"metadata":{}}
2025-10-16 14:09:38 [[31MERROR[39M] atlas-todo-planning {"metadata":{}}
2025-10-16 14:09:38 [[31MERROR[39M] MCP workflow failed: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content') {"metadata":{"sessionId":"session_1760612966459_8350x6f0s","error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:09:38 [[31MERROR[39M] MCP workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:09:38 [[31MERROR[39M] Step-by-step workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:09:38 [[32MINFO[39M] [HTTP] POST /chat/stream 200 (12143ms) {"metadata":{"category":"http","method":"POST","url":"/chat/stream","status":200,"duration":12143,"ip":"::1","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Ap..."}}
2025-10-16 14:09:41 [[32MINFO[39M] Метрики збережено: /Users/dev/Documents/GitHub/atlas4/logs/metrics/metrics-2025-10-16T11-09-41-438Z.json (1 записів) {"metadata":{}}
2025-10-16 14:10:49 [[32MINFO[39M] [WORKFLOW] Stage start - system: Starting workflow for message: "Закрий всі відкриті хроміум, але не хром...." {"metadata":{"category":"workflow","stage":"start","agent":"system","sessionId":"session_1760612966459_8350x6f0s","messageLength":41}}
2025-10-16 14:10:49 [[32MINFO[39M] [WORKFLOW] Stage init - mcp: Starting MCP Dynamic TODO Workflow {"metadata":{"category":"workflow","stage":"init","agent":"mcp","sessionId":"session_1760612966459_8350x6f0s","userMessage":"Закрий всі відкриті хроміум, але не хром."}}
2025-10-16 14:10:49 [[32MINFO[39M] [WORKFLOW] Stage init - mcp: Starting MCP Dynamic TODO Workflow {"metadata":{"category":"workflow","stage":"init","agent":"mcp","sessionId":"session_1760612966459_8350x6f0s","userMessage":"Закрий всі відкриті хроміум, але не хром."}}
2025-10-16 14:10:49 [[32MINFO[39M] [WORKFLOW] Stage stage - system: Stage 0-MCP: Mode Selection {"metadata":{"category":"workflow","stage":"stage","agent":"system","sessionId":"session_1760612966459_8350x6f0s"}}
2025-10-16 14:10:49 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] 🔍 Starting mode selection... {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:10:49 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] Analyzing: "Закрий всі відкриті хроміум, але не хром." {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] Raw response: {"mode": "task", "confidence": 0.9, "reasoning": "Команда закрити додаток"} {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP] ✅ Mode: task (confidence: 0.9) {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] mode-selection: [STAGE-0-MCP]    Reasoning: Команда закрити додаток {"metadata":{"category":"system","component":"mode-selection"}}
2025-10-16 14:10:51 [[32MINFO[39M] [WORKFLOW] Stage stage - system: Mode selected: task (confidence: 0.9) {"metadata":{"category":"workflow","stage":"stage","agent":"system","sessionId":"session_1760612966459_8350x6f0s","reasoning":"Команда закрити додаток"}}
2025-10-16 14:10:51 [[32MINFO[39M] [WORKFLOW] Stage stage - atlas: Stage 1-MCP: TODO Planning {"metadata":{"category":"workflow","stage":"stage","agent":"atlas","sessionId":"session_1760612966459_8350x6f0s"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] 🎯 Starting TODO planning... {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] Request: "Закрий всі відкриті хроміум, але не хром." {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] atlas-todo-planning: [STAGE-1-MCP] Context: {"request":"Закрий всі відкриті хроміум, але не хром.","timestamp":"2025-10-16T11:10:51.095Z","sessionId":"session_1760612966459_8350x6f0s","recentContext":[]} {"metadata":{"category":"system","component":"atlas-todo-planning"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] mcp-todo: [TODO] Creating TODO for request: "Закрий всі відкриті хроміум, але не хром." {"metadata":{"category":"system","component":"mcp-todo"}}
2025-10-16 14:10:51 [[32MINFO[39M] [SYSTEM] mcp-todo: [TODO] Using model: mistral-ai/mistral-small-2503 (temp: 0.3, max_tokens: 4000) {"metadata":{"category":"system","component":"mcp-todo"}}
2025-10-16 14:11:00 [[31MERROR[39M] [MCP-TODO] Failed to create TODO: Cannot read properties of undefined (reading 'content') {"metadata":{"category":"mcp-todo","component":"mcp-todo"}}
2025-10-16 14:11:00 [[31MERROR[39M] atlas-todo-planning {"metadata":{}}
2025-10-16 14:11:00 [[31MERROR[39M] atlas-todo-planning {"metadata":{}}
2025-10-16 14:11:00 [[31MERROR[39M] MCP workflow failed: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content') {"metadata":{"sessionId":"session_1760612966459_8350x6f0s","error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [[31MERROR[39M] MCP workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [[31MERROR[39M] Step-by-step workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [[32MINFO[39M] [HTTP] POST /chat/stream 200 (10631ms) {"metadata":{"category":"http","method":"POST","url":"/chat/stream","status":200,"duration":10631,"ip":"::1","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Ap..."}}
2025-10-16 14:11:41 [[32MINFO[39M] Метрики збережено: /Users/dev/Documents/GitHub/atlas4/logs/metrics/metrics-2025-10-16T11-11-41-436Z.json (1 записів) {"metadata":{}}
5-10-16 14:11:00 [ERROR] atlas-todo-planning {"metadata":{}}
2025-10-16 14:11:00 [ERROR] MCP workflow failed: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content') {"metadata":{"sessionId":"session_1760612966459_8350x6f0s","error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [ERROR] MCP workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [ERROR] Step-by-step workflow failed {"metadata":{"error":"TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')","sessionId":"session_1760612966459_8350x6f0s","stack":"Error: TODO planning failed: TODO creation failed: Cannot read properties of undefined (reading 'content')\n    at executeMCPWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:301:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async executeStepByStepWorkflow (file:///Users/dev/Documents/GitHub/atlas4/orchestrator/workflow/executor-v3.js:707:12)\n    at async file:///Users/dev/Documents/GitHub/atlas4/orchestrato..."}}
2025-10-16 14:11:00 [INFO] [HTTP] POST /chat/stream 200 (10631ms) {"metadata":{"category":"http","method":"POST","url":"/chat/stream","status":200,"duration":10631,"ip":"::1","userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Ap..."}}
2025-10-16 14:11:41 [INFO] Метрики збережено: /Users/dev/Documents/GitHub/atlas4/logs/metrics/metrics-2025-10-16T11-11-41-436Z.json (1 записів) {"metadata":{}}


-----------------------------------------------

Запуск ПО відбувається з:

dev@And-MAC (main) ~/Documents/GitHub/atlas4 % ./restart_system.sh restart        

╔════════════════════════════════════════════════════════════════╗
║               ATLAS INTELLIGENT SYSTEM MANAGER                ║
╚════════════════════════════════════════════════════════════════╝

[INFO] Stopping ATLAS System...
[INFO] Stopping Recovery Bridge (PID: 10587)...
✅ Recovery Bridge stopped
[INFO] Stopping Frontend (PID: 10582)...
✅ Frontend stopped
[INFO] Stopping Orchestrator (PID: 10577)...
✅ Orchestrator stopped
[INFO] Stopping Goose Web Server (PID: 10528)...
✅ Goose Web Server stopped
[INFO] Stopping TTS Service (PID: 10561)...
✅ TTS Service stopped
[INFO] Stopping Whisper Service (PID: 10569)...
✅ Whisper Service stopped
[INFO] Cleaning up any remaining orchestrator processes...
[INFO] Skipping process PID 14941 (uses protected port 4000)
[INFO] Skipping process PID 14941 (uses protected port 4000)
[INFO] Skipping process PID 14941 (uses protected port 4000)
[INFO] External API service is running on port 4000 (not touched - managed separately)
✅ ATLAS System Stopped

[INFO] Waiting 5 seconds before restart...


╔════════════════════════════════════════════════════════════════╗
║               ATLAS INTELLIGENT SYSTEM MANAGER                ║
╚════════════════════════════════════════════════════════════════╝

[INFO] Starting ATLAS System...
⚡ Starting Goose Web Server on port 3000...
[INFO] Using Goose binary: /opt/homebrew/bin/goose
[INFO] Checking Goose configuration...
[INFO] Testing Goose functionality...
[INFO] Goose configuration appears to be working
[INFO] Waiting for Goose to start...
✅ Goose Web Server started (PID: 15464, attempt 1)
⚡ Starting TTS Service on port 3001...
[INFO] Using web/venv for TTS (ukrainian-tts package installed here)
✅ Real TTS started
⚡ Starting Whisper Service on port 3002...
[INFO] Starting whisper.cpp backend (Metal-ready)
pyav_ok
✅ Whisper Service started with model ggml-large-v3.bin on Metal GPU (whisper-cli default)
⚡ Starting Node.js Orchestrator on port 5101...
✅ Orchestrator started (PID: 15516)
⚡ Starting Python Frontend on port 5001...
✅ Frontend started (PID: 15522)
⚡ Starting Recovery Bridge on port 5102...
✅ Recovery Bridge started (PID: 15527)
[INFO] Local Fallback LLM is disabled
[INFO] Waiting for services to initialize...

System Status:
─────────────────────────────────────────
Goose Web Server:    ● RUNNING (PID: 15464, Port: 3000)
Frontend:            ● RUNNING (PID: 15522, Port: 5001)
Orchestrator:        ● RUNNING (PID: 15516, Port: 5101)
Recovery Bridge:     ● RUNNING (PID: 15527, Port: 5102)
TTS Service:         ● RUNNING (PID: 15499, Port: 3001)
Whisper Service:     ● RUNNING (PID: 15507, Port: 3002)

✅ ATLAS System Started Successfully!

╔════════════════════════════════════════════════════════════════╗
║                     ACCESS POINTS                             ║
╠════════════════════════════════════════════════════════════════╣
║ 🌐 Web Interface:     http://localhost:5001              ║
║ 🦆 Goose Server:      http://localhost:3000              ║
║ 🎭 Orchestrator API:  http://localhost:5101              ║
║ 🔧 Recovery Bridge:   ws://localhost:5102               ║
╚════════════════════════════════════════════════════════════════╝

dev@And-MAC (main) ~/Documents/GitHub/atlas4 % 