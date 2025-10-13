# Whisper Core ML Disable Fix — 2025-10-13

## Problem
- `whisper-cli` crashed with `failed to load Core ML model` every time the Whisper service executed a transcription command.
- The CLI binary was compiled with `WHISPER_COREML=ON` and expected a precompiled encoder `.mlmodelc`, which we do not ship in the repository.
- Frontend quick-send requests therefore triggered repeated `HTTP 500` responses even though the audio payload was valid.

## Root Cause
- The upstream build in `third_party/whisper.cpp.upstream` enables Core ML by default when building on Apple Silicon.
- When the Core ML encoder bundle is missing, `whisper-cli` aborts with `rc=3`, returning an empty JSON payload to the Flask wrapper.
- We additionally forced `--no-gpu` in the service command, pushing the CLI onto the slower CPU path as a workaround.

## Resolution
1. Reconfigured the embedded `whisper.cpp` build with `WHISPER_COREML=OFF` while keeping `Metal` enabled.
   ```bash
   cmake -B build -DWHISPER_COREML=OFF -DWHISPER_METAL=ON
   cmake --build build --target whisper-cli
   ```
2. Updated `whispercpp_service.py` to only append `--no-gpu` when the new env flag `WHISPER_CPP_DISABLE_GPU=true` is explicitly provided.
3. Restarted the Atlas stack so the Flask service picks up the rebuilt binary and updated Python logic.

## Result
- Whisper service now runs on Metal GPU without requiring a Core ML encoder bundle.
- Quick-send and conversation transcriptions succeed with 200 OK responses (no more retry storms).
- Optional CPU fallback is still available via `WHISPER_CPP_DISABLE_GPU=true`.
- `curl` test confirms healthy response:
  ```json
  {"status":"success","device":"metal","transcription_time":6.19}
  ```

## Follow-up
- Future rebuilds of `whisper.cpp` must include `-DWHISPER_COREML=OFF` (or `WHISPER_COREML_ALLOW_FALLBACK=ON`) to avoid reintroducing the crash.
- Documented the new environment flag in `.github/copilot-instructions.md`.
