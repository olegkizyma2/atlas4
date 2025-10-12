# TTS Service Virtual Environment Fix

**Date:** October 12, 2025  
**Time:** ~21:25  
**Status:** ✅ FIXED

## 🎯 Problem

TTS Service status showed `● STOPPED` after system restart:
```
TTS Service:         ● STOPPED
```

### Symptoms:
1. TTS server not starting automatically
2. `restart_system.sh` looking for venv in wrong location
3. `ukrainian-tts` package not found by TTS server

### Root Cause:
**Virtual environment mismatch:**
- `restart_system.sh` searched for venv in `ukrainian-tts/.venv/` or `ukrainian-tts/venv/`
- BUT `ukrainian-tts` package was installed in `web/venv/`
- Script couldn't find the package → TTS server failed to start

## 🔧 Solution

### Changes Made:

**1. Fixed `restart_system.sh` (lines ~418-432):**

**Before:**
```bash
if [ "$REAL_TTS_MODE" = "true" ]; then
    (
        cd "$REPO_ROOT/ukrainian-tts"
        if [ -f ".venv/bin/activate" ]; then
            source .venv/bin/activate
            log_info "Using TTS virtual environment: .venv"
        elif [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
            log_info "Using TTS virtual environment: venv"
        else
            log_warn "No TTS virtual environment found, using system Python"
        fi
        python3 tts_server.py ...
```

**After:**
```bash
if [ "$REAL_TTS_MODE" = "true" ]; then
    (
        # Ukrainian-TTS пакет встановлено в web/venv/, використовуємо його
        cd "$REPO_ROOT/web"
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
            log_info "Using web/venv for TTS (ukrainian-tts package installed here)"
        else
            log_error "web/venv not found! Run: python3 -m venv web/venv && ..."
            return 1
        fi
        # Запускаємо TTS сервер з правильного venv
        cd "$REPO_ROOT/ukrainian-tts"
        python3 tts_server.py ...
```

**Key Fix:**
- Activate `web/venv` FIRST (where ukrainian-tts is installed)
- THEN cd to `ukrainian-tts/` to run the server
- Clear error message if venv not found

**2. Installed ukrainian-tts package:**
```bash
source web/venv/bin/activate
pip install git+https://github.com/robinhad/ukrainian-tts.git
```

**3. Restarted system:**
```bash
./restart_system.sh restart
```

## ✅ Result

**All services now RUNNING:**
```
System Status:
─────────────────────────────────────────
Goose Web Server:    ● RUNNING (PID: 75716, Port: 3000)
Frontend:            ● RUNNING (PID: 75753, Port: 5001)
Orchestrator:        ● RUNNING (PID: 75748, Port: 5101)
Recovery Bridge:     ● RUNNING (PID: 75758, Port: 5102)
TTS Service:         ● RUNNING (PID: 75733, Port: 3001)  ← FIXED!
Whisper Service:     ● RUNNING (PID: 75740, Port: 3002)
```

**TTS Server Logs (success):**
```
2025-10-12 21:25:13 [ukrainian-tts-server] INFO: Initializing Ukrainian TTS on device: mps
2025-10-12 21:25:13 [ukrainian-tts-server] INFO: Python executable: /Users/.../web/venv/bin/python3
2025-10-12 21:25:13 [ukrainian-tts-server] INFO: VIRTUAL_ENV: /Users/.../web/venv
[stanza] INFO: Done loading processors!
```

**System now fully operational!** 🎉

## 🚀 First-Time Setup Notes

On first TTS startup, system downloads models from HuggingFace (~109MB):
- `stanza-uk` tokenize/mwt/pos models (~2MB each)
- Ukrainian language model (~109MB pretrain)

This is normal and only happens once. Models cached in:
- `~/stanza_resources/`
- `~/nltk_data/`

## 📋 Critical Rules

**For ATLAS maintenance:**

1. ✅ **ALWAYS install ukrainian-tts in web/venv:**
   ```bash
   cd web
   source venv/bin/activate
   pip install git+https://github.com/robinhad/ukrainian-tts.git
   ```

2. ✅ **TTS server uses web/venv for packages:**
   - Activate `web/venv` first
   - Then run TTS server from `ukrainian-tts/` directory

3. ✅ **Ukrainian-TTS dependencies:**
   - torch >= 1.9
   - espnet == 202301
   - scipy < 1.12.0
   - librosa >= 0.8.0
   - All must be Python 3.11 compatible

4. ✅ **TTS Device optimization:**
   - Mac M1/M2: use `--device mps` (Metal GPU)
   - Intel/AMD: use `--device cpu`
   - Config: `TTS_DEVICE=mps` in environment

## 🔗 Related Fixes

- `docs/SETUP_PYTHON311_FIX_2025-10-12.md` - Python 3.11 setup
- `docs/GOOSE_CONFIGURATION_FIX_2025-10-12.md` - Goose config
- `docs/GITHUB_MODELS_INTEGRATION_2025-10-12.md` - GitHub Models

## 📊 System Configuration

**TTS Server:**
- Host: `127.0.0.1`
- Port: `3001`
- Device: `mps` (Metal GPU on Mac M1)
- Python: `3.11.14`
- Virtual Env: `web/venv/`

**Package Versions:**
- ukrainian-tts: `6.0`
- espnet: `202301`
- torch: `2.1.0`
- torchaudio: `2.1.0`

---

**Автор:** GitHub Copilot  
**Дата:** 12 жовтня 2025, ~21:30
