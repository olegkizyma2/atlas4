#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CPP_DIR="$ROOT_DIR/third_party/whisper.cpp"
MODEL_DIR="$ROOT_DIR/models/whisper"
MODEL_FILE="$MODEL_DIR/ggml-large-v3.bin"

echo "[setup] Ensuring directories..."
mkdir -p "$CPP_DIR" "$MODEL_DIR"

if [ ! -x "$CPP_DIR/main" ]; then
  echo "[setup] Cloning & building whisper.cpp..."
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$tmpdir/whisper.cpp"
  (cd "$tmpdir/whisper.cpp" && make)
  if [ -f "$tmpdir/whisper.cpp/bin/main" ]; then
    cp "$tmpdir/whisper.cpp/bin/main" "$CPP_DIR/main"
  elif [ -f "$tmpdir/whisper.cpp/bin/whisper-cli" ]; then
    cp "$tmpdir/whisper.cpp/bin/whisper-cli" "$CPP_DIR/main"
  elif [ -f "$tmpdir/whisper.cpp/build/bin/main" ]; then
    cp "$tmpdir/whisper.cpp/build/bin/main" "$CPP_DIR/main"
  elif [ -f "$tmpdir/whisper.cpp/build/bin/whisper-cli" ]; then
    cp "$tmpdir/whisper.cpp/build/bin/whisper-cli" "$CPP_DIR/main"
  elif [ -f "$tmpdir/whisper.cpp/main" ]; then
    cp "$tmpdir/whisper.cpp/main" "$CPP_DIR/main"
  else
    echo "[setup] ERROR: built main binary not found" >&2
    exit 1
  fi
  chmod +x "$CPP_DIR/main"
else
  echo "[setup] whisper.cpp binary already present: $CPP_DIR/main"
fi

if [ ! -f "$MODEL_FILE" ]; then
  echo "[setup] Downloading ggml-large-v3.bin model (~3.1GB)..."
  curl -L -o "$MODEL_FILE" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin?download=true
else
  echo "[setup] Model already present: $MODEL_FILE"
fi

echo "[setup] Done. You can start with:"
echo "  WHISPER_BACKEND=cpp WHISPER_CPP_BIN=$CPP_DIR/main WHISPER_CPP_MODEL=$MODEL_FILE ./restart_system.sh"
