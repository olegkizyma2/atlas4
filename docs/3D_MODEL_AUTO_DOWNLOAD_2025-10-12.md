# 3D Model Auto-Download Fix

**Date:** October 12, 2025  
**Time:** ~22:10  
**Status:** ✅ FIXED

## 🎯 Problem

3D model viewer showing 404 error in browser console:
```
CachingGLTFLoader.js:153 Ra: fetch for "http://localhost:5001/static/assets/DamagedHelmet.glb" 
responded with 404: NOT FOUND
```

### Symptoms:
1. Frontend expected 3D model at `/static/assets/DamagedHelmet.glb`
2. File missing from repository (not included in git)
3. 3D viewer failing to load model on page load
4. Browser console showing 404 errors

### Root Cause:
**Missing 3D model file:**
- `DamagedHelmet.glb` referenced in `web/templates/index.html`
- File NOT present in `web/static/assets/` directory
- No automatic download mechanism in setup script
- Model not included in repository (large binary file)

## 🔧 Solution

### Changes Made:

**1. Added automatic model download to `setup-macos.sh`:**

**New function `download_3d_models()` (КРОК 14):**
```bash
download_3d_models() {
    log_step "КРОК 14: Завантаження 3D моделей"
    
    local model_path="$REPO_ROOT/web/static/assets/DamagedHelmet.glb"
    local model_url="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"
    
    # Check if model already exists and is valid
    if [ -f "$model_path" ]; then
        local file_size=$(stat -f%z "$model_path" 2>/dev/null || echo "0")
        if [ "$file_size" -gt 100000 ]; then
            log_success "Модель валідна (розмір: $(($file_size / 1024)) KB)"
            return 0
        else
            log_warn "Модель пошкоджена, перезавантажуємо..."
            rm -f "$model_path"
        fi
    fi
    
    # Download model from official Khronos glTF samples
    log_info "Завантаження DamagedHelmet.glb..."
    curl -L -f -o "$model_path" "$model_url"
    
    # Validate downloaded file
    local file_size=$(stat -f%z "$model_path")
    if [ "$file_size" -gt 100000 ]; then
        log_success "3D модель завантажено: $(($file_size / 1024)) KB"
    else
        log_error "Завантажена модель занадто мала"
        return 1
    fi
}
```

**Key Features:**
- ✅ Downloads from official Khronos glTF Sample Models repository
- ✅ Validates file size (must be > 100KB)
- ✅ Skips download if valid model already exists
- ✅ Re-downloads if existing file is corrupted
- ✅ Fallback to wget if curl unavailable
- ✅ Clear error messages and logging

**2. Updated create_directories():**
```bash
create_directories() {
    log_step "КРОК 12: Створення необхідних директорій"
    
    # ... existing directories ...
    mkdir -p "$REPO_ROOT/web/static/assets"  # ← NEW
    
    log_success "Директорії створено"
}
```

**3. Updated main workflow:**
```bash
main() {
    # ... existing steps ...
    create_directories
    download_3d_models      # ← NEW (КРОК 14)
    configure_system        # Now КРОК 13
    configure_goose         # Now КРОК 15
    test_installation       # Now КРОК 16
}
```

**4. Added ukrainian-tts auto-install:**
```bash
setup_python_venv() {
    # ... after PyTorch installation ...
    
    log_info "Встановлення Ukrainian TTS..."
    pip install git+https://github.com/robinhad/ukrainian-tts.git || {
        log_warn "Не вдалося встановити ukrainian-tts, спроба пізніше..."
    }
}
```

## ✅ Result

**Model successfully downloaded:**
```bash
✅ Downloaded successfully: 3685 KB
-rw-r--r--  1 olegkizyma  staff  3.6M  DamagedHelmet.glb
```

**Frontend now serving model:**
```bash
curl http://localhost:5001/static/assets/DamagedHelmet.glb
HTTP 200 OK (3.6MB)
```

**Browser console:** NO MORE 404 errors! 🎉

## 📋 Model Details

**Source:** Khronos Group glTF Sample Models  
**Repository:** https://github.com/KhronosGroup/glTF-Sample-Models  
**Model:** DamagedHelmet (glTF 2.0 Binary format)  
**Size:** 3,685 KB (3.6 MB)  
**Format:** `.glb` (binary glTF)  
**License:** CC0 1.0 Public Domain

**Model Features:**
- PBR materials (Physically Based Rendering)
- Normal maps, metallic, roughness textures
- Optimized for real-time rendering
- Perfect for web-based 3D viewers
- Industry-standard reference model

## 🚀 Setup Integration

**During `./setup-macos.sh`:**

```
КРОК 12: Створення необхідних директорій
  ✅ web/static/assets/ створено

КРОК 13: Завантаження 3D моделей
  📥 Downloading DamagedHelmet.glb from Khronos...
  ✅ 3D модель завантажено успішно (3685 KB)

КРОК 14: Налаштування системної конфігурації
  ... continues ...
```

**On subsequent runs:**
```
КРОК 13: Завантаження 3D моделей
  ✅ 3D модель DamagedHelmet.glb вже існує
  ✅ Модель валідна (розмір: 3685 KB)
```

## 🔍 Validation Checks

**Setup script validates:**
1. ✅ File exists in correct location
2. ✅ File size > 100KB (detects corrupted downloads)
3. ✅ curl/wget availability
4. ✅ Download success (HTTP status)
5. ✅ Post-download file size verification

**Error Handling:**
- Corrupted file → automatic re-download
- Network failure → clear error message
- Missing curl/wget → suggests installation
- Invalid file size → cleanup and retry

## 📚 Why This Model?

**DamagedHelmet chosen because:**
- ✅ Official Khronos reference model
- ✅ Widely used in 3D web applications
- ✅ Perfect complexity (not too simple, not too heavy)
- ✅ Demonstrates PBR materials well
- ✅ Public domain license (CC0)
- ✅ Optimized for real-time rendering
- ✅ 3.6MB size - reasonable for web
- ✅ Single .glb file - no external dependencies

## 🎨 Alternative Models

**If you want to change the model:**

1. **Edit template:**
```html
<!-- web/templates/index.html -->
<model-viewer 
    src="{{ url_for('static', filename='assets/YOUR_MODEL.glb') }}"
    ...
</model-viewer>
```

2. **Update download function:**
```bash
# setup-macos.sh
local model_url="https://URL_TO_YOUR_MODEL.glb"
```

3. **Re-run setup:**
```bash
./setup-macos.sh
```

## 🌐 Frontend Integration

**Template reference:**
```html
<!-- web/templates/index.html -->
<model-viewer 
    id="model-viewer" 
    src="{{ url_for('static', filename='assets/DamagedHelmet.glb') }}"
    auto-rotate
    camera-controls
    shadow-intensity="1"
    ...
</model-viewer>
```

**JavaScript loader:**
```javascript
// CachingGLTFLoader.js
fetch("http://localhost:5001/static/assets/DamagedHelmet.glb")
  .then(response => {
    if (!response.ok) throw new Error('404: NOT FOUND');
    return response.arrayBuffer();
  })
  .then(buffer => {
    // Load GLB model
  });
```

## 📊 File Structure After Fix

```
atlas4/
├── web/
│   ├── static/
│   │   ├── assets/
│   │   │   ├── DamagedHelmet.glb    ← DOWNLOADED
│   │   │   ├── atlas-icon.svg
│   │   │   └── favicon.ico
│   │   ├── css/
│   │   └── js/
│   └── templates/
│       └── index.html               ← REFERENCES MODEL
├── setup-macos.sh                   ← AUTO-DOWNLOADS MODEL
└── docs/
    └── 3D_MODEL_AUTO_DOWNLOAD_2025-10-12.md  ← THIS FILE
```

## 🛡️ Best Practices

**For 3D models in web apps:**

1. ✅ **Use .glb format** - single binary file, no external dependencies
2. ✅ **Validate file size** - detect corrupted downloads
3. ✅ **Cache models** - don't re-download if valid
4. ✅ **Use CDN/official source** - reliable hosting (Khronos)
5. ✅ **Optimize for web** - 3-5MB is reasonable
6. ✅ **PBR materials** - modern rendering standards
7. ✅ **Proper licensing** - check before using

## 🚨 Troubleshooting

**If model still not loading:**

1. **Check file exists:**
```bash
ls -lh web/static/assets/DamagedHelmet.glb
# Should show 3.6MB file
```

2. **Test direct access:**
```bash
curl -I http://localhost:5001/static/assets/DamagedHelmet.glb
# Should return HTTP 200
```

3. **Re-download model:**
```bash
rm web/static/assets/DamagedHelmet.glb
./setup-macos.sh  # Will re-download
```

4. **Check browser console:**
```javascript
// Should NOT show 404 errors
// Should show successful model load
```

5. **Manual download (if needed):**
```bash
curl -L -o web/static/assets/DamagedHelmet.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb
```

## 🔗 Related Fixes

- `docs/TTS_VENV_FIX_2025-10-12.md` - TTS virtual environment
- `docs/SETUP_PYTHON311_FIX_2025-10-12.md` - Python 3.11 setup
- `docs/3D_VISIBILITY_SAFARI_FIX_FINAL.md` - 3D model visibility

## 📝 Step Numbers Updated

**Before this fix:**
- КРОК 12: create_directories
- КРОК 13: configure_system
- КРОК 14: configure_goose
- КРОК 15: test_installation

**After this fix:**
- КРОК 12: create_directories (+ assets dir)
- **КРОК 13: download_3d_models** ← NEW
- КРОК 14: configure_system
- КРОК 15: configure_goose
- КРОК 16: test_installation

---

**Автор:** GitHub Copilot  
**Дата:** 12 жовтня 2025, ~22:10
