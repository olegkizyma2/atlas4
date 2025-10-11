Whisper backends in ATLAS
=========================

This repo provides two interchangeable backends for local speech recognition:

- faster-whisper (CTranslate2) — default, CPU on macOS; supports CUDA on NVIDIA
- whisper.cpp — optional, supports Metal on Apple Silicon (M1/M2) via -ngl

API endpoints are compatible:

- GET  /health
- GET  /models
- POST /transcribe
- POST /transcribe_blob

How to run faster-whisper (default)
-----------------------------------

Environment (examples):

- WHISPER_MODEL: tiny/base/small/medium/large-v1/large-v2/large-v3
- WHISPER_DEVICE: auto|cpu (macOS uses CPU)
- WHISPER_COMPUTE_TYPE: float32|int8|int8_float32|float16|...

Example: large-v3 with int8 for speed on Apple Silicon:

    WHISPER_MODEL=large-v3 WHISPER_COMPUTE_TYPE=int8 ./restart_system.sh

How to run whisper.cpp (Metal)
------------------------------

1) Build whisper.cpp with Metal (macOS):
   - git clone https://github.com/ggerganov/whisper.cpp
   - cd whisper.cpp && make
   - ensure the binary (e.g., ./main) exists

2) Download a model (ggml/gguf), e.g., ggml-large-v3.bin or gguf variant.

3) Start with backend=cpp:

    WHISPER_BACKEND=cpp \
    WHISPER_CPP_BIN=/path/to/whisper.cpp/main \
    WHISPER_CPP_MODEL=/path/to/ggml-large-v3.bin \
    WHISPER_CPP_NGL=20 \
    ./restart_system.sh

Notes:
- WHISPER_CPP_NGL > 0 enables GPU (Metal) offload; tune 10..40 for M1 Max
- WHISPER_CPP_THREADS controls CPU threads for the remaining layers
- Endpoints are the same; front-end does not need changes

Troubleshooting
---------------

- If faster-whisper is slow on macOS, try WHISPER_COMPUTE_TYPE=int8
- If whisper.cpp complains about audio, ensure we convert webm->wav (PyAV installed)
- For model paths, prefer absolute paths; ensure files exist
