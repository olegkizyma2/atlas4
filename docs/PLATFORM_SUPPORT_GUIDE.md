# ATLAS Deployment Scripts - Platform Support Guide

**Version:** 4.0  
**Date:** October 12, 2025

---

## 📋 Existing Platform Support

### ✅ macOS (Full Support)

**Script:** `setup-macos.sh`  
**Documentation:** `docs/MACOS_DEPLOYMENT_GUIDE.md`

**Supported:**
- macOS 11.0+ (Big Sur or newer)
- Intel processors (x86_64)
- Apple Silicon (M1/M2/M3 - arm64)
- Metal GPU acceleration
- PyTorch MPS for TTS
- Whisper.cpp with Metal support

**Features:**
- 15 automated installation steps
- Intelligent architecture detection
- Automatic optimization for platform
- Complete testing and diagnostics

---

## 🔨 Adding Support for Other Platforms

### Planned Platform Support

1. **Linux** (Ubuntu/Debian)
   - Script name: `setup-linux.sh`
   - CUDA support for NVIDIA GPUs
   - ROCm support for AMD GPUs

2. **Windows** (WSL2)
   - Script name: `setup-windows.ps1`
   - Native Windows support
   - WSL2 integration

3. **Docker**
   - Dockerfile + docker-compose.yml
   - Multi-platform images
   - Production-ready containers

---

## 📐 Template Structure for New Platform Scripts

### Required Components:

```bash
#!/bin/bash
# 1. Platform Detection
# 2. System Requirements Check
# 3. Package Manager Setup
# 4. Python Installation
# 5. Node.js Installation
# 6. System Dependencies
# 7. Goose AI Installation
# 8. Python Virtual Environment
# 9. Node.js Packages
# 10. Whisper Compilation (with GPU support)
# 11. Model Downloads
# 12. Directory Creation
# 13. Configuration Setup
# 14. Testing
# 15. Final Instructions
```

### Key Sections to Implement:

#### 1. Platform Detection
```bash
detect_platform() {
    # Detect OS type
    # Detect architecture
    # Detect GPU availability
    # Set optimization flags
}
```

#### 2. GPU Support
```bash
setup_gpu_acceleration() {
    # NVIDIA CUDA (Linux/Windows)
    # AMD ROCm (Linux)
    # Metal (macOS)
    # Vulkan fallback
}
```

#### 3. Package Manager
```bash
install_package_manager() {
    # apt (Debian/Ubuntu)
    # yum/dnf (RHEL/Fedora)
    # pacman (Arch)
    # choco (Windows)
    # brew (macOS)
}
```

#### 4. Whisper Compilation
```bash
build_whisper() {
    # Platform-specific compiler flags
    # GPU acceleration options
    # Optimization for architecture
}
```

---

## 🔍 Platform-Specific Considerations

### Linux (Ubuntu/Debian)

**Required changes:**
- Use `apt` instead of `brew`
- CUDA toolkit for NVIDIA GPUs
- Different Python installation (python3-venv)
- systemd service files for daemons
- Different paths (/usr/local instead of /opt/homebrew)

**GPU Support:**
```bash
# NVIDIA CUDA
if nvidia-smi >/dev/null 2>&1; then
    export WHISPER_DEVICE="cuda"
    export TTS_DEVICE="cuda"
fi

# AMD ROCm
if rocm-smi >/dev/null 2>&1; then
    export WHISPER_DEVICE="rocm"
    export TTS_DEVICE="rocm"
fi
```

### Windows (Native + WSL2)

**Required changes:**
- PowerShell script (setup-windows.ps1)
- Chocolatey package manager
- Windows paths (C:\Program Files\...)
- Service installation via Windows Services
- WSL2 integration for Whisper.cpp

**GPU Support:**
```powershell
# NVIDIA CUDA
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $env:WHISPER_DEVICE = "cuda"
    $env:TTS_DEVICE = "cuda"
}
```

### Docker

**Required changes:**
- Multi-stage Dockerfile
- Base images for different architectures
- Volume mounts for models
- docker-compose.yml for orchestration
- Environment variable configuration

**Example Dockerfile structure:**
```dockerfile
# Base stage
FROM python:3.11-slim as base

# Builder stage
FROM base as builder
RUN apt-get update && apt-get install -y build-essential cmake

# Whisper compilation stage
FROM builder as whisper-builder
COPY third_party/whisper.cpp.upstream /whisper
WORKDIR /whisper
RUN make -j$(nproc)

# Final stage
FROM base
COPY --from=whisper-builder /whisper/main /usr/local/bin/whisper
...
```

---

## 📝 Documentation Requirements

For each new platform, create:

1. **Setup Script**
   - `setup-{platform}.sh` or `setup-{platform}.ps1`
   - Well-commented code
   - Error handling
   - Progress indicators

2. **Deployment Guide**
   - `docs/{PLATFORM}_DEPLOYMENT_GUIDE.md`
   - System requirements
   - Step-by-step instructions
   - Troubleshooting section

3. **Quick Start**
   - Update `QUICK_START.md`
   - Add platform-specific section
   - Include platform detection

4. **README Update**
   - Add platform to supported list
   - Update installation instructions

---

## ✅ Testing Requirements

### Each platform script must pass:

1. **Clean Installation Test**
   - Fresh OS installation
   - No pre-installed dependencies
   - Complete automation

2. **GPU Acceleration Test**
   - Verify GPU detection
   - Test Whisper with GPU
   - Test TTS with GPU
   - Measure performance

3. **Service Startup Test**
   - All services start successfully
   - No port conflicts
   - Correct process management

4. **Functional Test**
   - Web interface accessible
   - Voice control works
   - TTS produces audio
   - Whisper transcribes correctly

---

## 🎯 Optimization Guidelines

### Per-Platform Optimizations:

**macOS (Current):**
- ✅ Metal GPU for Whisper (20x faster)
- ✅ MPS for TTS (5-10x faster)
- ✅ 48kHz audio quality
- ✅ Beam search beam_size >= 5

**Linux (Planned):**
- CUDA for Whisper (15-25x faster on NVIDIA)
- ROCm for AMD GPUs (10-15x faster)
- AVX2/AVX-512 CPU optimizations
- TensorRT for production deployments

**Windows (Planned):**
- CUDA support via native Windows
- DirectML for GPU acceleration
- WSL2 for compatibility
- Windows Service integration

**Docker (Planned):**
- Multi-stage builds for smaller images
- Layer caching optimization
- GPU passthrough support
- Kubernetes deployment ready

---

## 📊 Performance Targets

### Whisper Transcription:
- **macOS Metal:** < 0.5s for 5s audio
- **Linux CUDA:** < 0.4s for 5s audio
- **CPU Fallback:** < 3s for 5s audio

### TTS Generation:
- **macOS MPS:** < 1s for 100 characters
- **Linux CUDA:** < 0.8s for 100 characters
- **CPU Fallback:** < 3s for 100 characters

### System Startup:
- **All platforms:** < 30s for all services
- **Docker:** < 60s including image pull

---

## 🔧 Configuration Consistency

### All platforms must support:

1. **Centralized Configuration**
   - `config/global-config.js` as single source
   - Platform-specific overrides in `.env`
   - No hardcoded values

2. **Service Ports**
   - 5001 - Frontend
   - 5101 - Orchestrator
   - 3000 - Goose
   - 3001 - TTS
   - 3002 - Whisper

3. **Environment Variables**
   ```bash
   WHISPER_BACKEND=cpp
   WHISPER_DEVICE=auto  # auto-detect: metal/cuda/rocm/cpu
   TTS_DEVICE=auto      # auto-detect: mps/cuda/rocm/cpu
   REAL_TTS_MODE=true
   ```

---

## 📚 Reference Implementation

### Study the macOS script structure:

```bash
setup-macos.sh
├── Utility Functions (logging, checks)
├── System Requirements Check
├── Package Manager Setup (Homebrew)
├── Language Runtimes (Python, Node.js)
├── System Dependencies
├── Goose AI Installation
├── Python Environment Setup
├── Node.js Dependencies
├── Whisper Compilation (Metal)
├── Model Downloads
├── Directory Structure
├── Configuration (.env)
├── Testing Suite
└── Final Instructions
```

**Key features to replicate:**
- Intelligent platform detection
- Graceful degradation
- Detailed progress output
- Comprehensive error handling
- Testing after installation
- Clear user feedback

---

## 🤝 Contributing

### To add a new platform:

1. **Fork the repository**
2. **Create platform script** (setup-{platform}.sh)
3. **Write documentation** (docs/{PLATFORM}_DEPLOYMENT_GUIDE.md)
4. **Test thoroughly** (all requirements above)
5. **Update main docs** (README.md, QUICK_START.md)
6. **Submit PR** with:
   - Script file
   - Documentation
   - Test results
   - Screenshots/recordings

### PR Requirements:

- [ ] Script follows template structure
- [ ] Documentation is complete
- [ ] All tests pass
- [ ] GPU acceleration works (if available)
- [ ] Clean installation tested
- [ ] Performance metrics documented

---

## 📧 Contact

For questions about adding platform support:

- Open an issue: https://github.com/olegkizyma2/atlas4/issues
- Discussion: https://github.com/olegkizyma2/atlas4/discussions
- Email: [maintainer email]

---

## 📝 Version History

- **v1.0** (Oct 12, 2025) - Initial macOS support
- **v1.1** (TBD) - Linux (Ubuntu/Debian) support
- **v1.2** (TBD) - Windows (WSL2) support
- **v1.3** (TBD) - Docker support
- **v2.0** (TBD) - Full cross-platform support

---

**ATLAS v4.0** - Adaptive Task and Learning Assistant System  
**Platform Support Guide** - Created October 12, 2025
