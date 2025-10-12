#!/usr/bin/env python3
"""
ATLAS Whisper.cpp Speech Recognition Service (Metal on Apple Silicon)

Эндпоинты совместимы с существующим faster-whisper сервисом:
  - GET  /health
  - GET  /models
  - POST /transcribe           (multipart: audio, language, use_vad, ...)
  - POST /transcribe_blob      (raw body, ?language=uk&use_vad=true)

Требования:
  - Установленный бинарь whisper.cpp (main), путь в WHISPER_CPP_BIN
  - Загруженная модель (ggml/gguf), путь в WHISPER_CPP_MODEL
  - Для Metal: whisper.cpp должен быть собран с Metal, используйте -ngl > 0

Примечание: whisper.cpp не поддерживает WebM/Opus напрямую, поэтому мы конвертируем
в WAV PCM 16k mono через PyAV.
"""

import json
import logging
import os
import tempfile
import subprocess
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
import av  # PyAV

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('atlas.whispercpp')

# Конфигурация через окружение
PORT = int(os.environ.get('WHISPER_PORT', 3002))
WHISPER_CPP_BIN = os.environ.get('WHISPER_CPP_BIN', '')
WHISPER_CPP_MODEL = os.environ.get('WHISPER_CPP_MODEL', '')
WHISPER_CPP_LANG_DEFAULT = os.environ.get('WHISPER_CPP_LANG', 'uk')
WHISPER_CPP_THREADS = int(os.environ.get('WHISPER_CPP_THREADS', '6'))  # Збільшено до 6 для M1 Max
WHISPER_CPP_NGL = int(os.environ.get('WHISPER_CPP_NGL', '30'))  # Збільшено до 30 шарів на GPU для кращого використання Metal
WHISPER_CPP_MAXLEN = int(os.environ.get('WHISPER_CPP_MAXLEN', '0'))  # 0 = без ограничения

# Покращені параметри для Large-v3 моделі
WHISPER_CPP_TEMPERATURE = float(os.environ.get('WHISPER_CPP_TEMPERATURE', '0.0'))  # 0.0 для точності
WHISPER_CPP_BEST_OF = int(os.environ.get('WHISPER_CPP_BEST_OF', '5'))  # кількість кандидатів
WHISPER_CPP_BEAM_SIZE = int(os.environ.get('WHISPER_CPP_BEAM_SIZE', '5'))  # розмір пучка
WHISPER_CPP_PATIENCE = float(os.environ.get('WHISPER_CPP_PATIENCE', '1.0'))  # терпіння для beam search
WHISPER_CPP_LENGTH_PENALTY = float(os.environ.get('WHISPER_CPP_LENGTH_PENALTY', '1.0'))  # штраф за довжину
WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD = float(os.environ.get('WHISPER_CPP_COMPRESSION_RATIO_THRESHOLD', '2.4'))
WHISPER_CPP_NO_SPEECH_THRESHOLD = float(os.environ.get('WHISPER_CPP_NO_SPEECH_THRESHOLD', '0.6'))
WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT = os.environ.get('WHISPER_CPP_CONDITION_ON_PREVIOUS_TEXT', 'true').lower() == 'true'
WHISPER_CPP_INITIAL_PROMPT = os.environ.get('WHISPER_CPP_INITIAL_PROMPT', 'Це українська мова з правильною орфографією, граматикою та пунктуацією. Олег Миколайович розмовляє з Атласом.')

# Словник корекції для активаційних слів (аналогічно faster-whisper)
ATLAS_ACTIVATION_WORDS = {
    # Українські варіанти
    'атлас': 'Атлас', 'атлаз': 'Атлас', 'атлес': 'Атлас', 'артлас': 'Атлас',
    'атлось': 'Атлас', 'атланс': 'Атлас', 'адлас': 'Атлас', 'отлас': 'Атлас', 'етлас': 'Атлас',
    # Англійські варіанти  
    'atlas': 'Атлас', 'atlass': 'Атлас', 'atlus': 'Атлас', 'adlas': 'Атлас',
    'atles': 'Атлас', 'atlantis': 'Атлас',
    # Похибки розпізнавання
    'а т л а с': 'Атлас', 'а-т-л-а-с': 'Атлас', 'атл ас': 'Атлас',
    'ат лас': 'Атлас', 'атла с': 'Атлас',
}

app = Flask(__name__)
CORS(app)


def correct_atlas_activation_words(text: str) -> str:
    """Корекція активаційних слів "Атлас" у транскрипції whisper.cpp."""
    if not text:
        return text
        
    import re
    corrected_text = text
    
    # Пошук та заміна кожного варіанта з словника
    for incorrect, correct in ATLAS_ACTIVATION_WORDS.items():
        pattern = r'\b' + re.escape(incorrect.lower()) + r'\b'
        corrected_text = re.sub(pattern, correct, corrected_text, flags=re.IGNORECASE)
    
    # Додаткові паттерни для складних випадків
    patterns = [
        (r'\b(ат\w{0,4}лас?)\b', 'Атлас'),
        (r'\b(а\s*т\s*л\w*с?)\b', 'Атлас'),
        (r'\b(а[-.]?т[-.]?л[-.]?а[-.]?с)\b', 'Атлас'),
    ]
    
    for pattern, replacement in patterns:
        corrected_text = re.sub(pattern, replacement, corrected_text, flags=re.IGNORECASE)
    
    return corrected_text

def _check_ready():
    bin_ok = WHISPER_CPP_BIN and Path(WHISPER_CPP_BIN).exists()
    model_ok = WHISPER_CPP_MODEL and Path(WHISPER_CPP_MODEL).exists()
    return bin_ok, model_ok


def _convert_to_wav16k_mono(in_path: str, out_path: str):
    """Конвертировать входной аудио-файл (webm/opus/...) в PCM WAV 16k mono."""
    input_container = av.open(in_path)
    audio_stream = None
    for stream in input_container.streams:
        if stream.type == 'audio':
            audio_stream = stream
            break
    
    if audio_stream is None:
        raise RuntimeError('No audio stream found')

    output_container = av.open(out_path, mode='w', format='wav')
    output_stream = output_container.add_stream('pcm_s16le', rate=16000)
    output_stream.layout = 'mono'
    
    resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)

    for frame in input_container.decode(audio_stream):
        # Type-safe check: PyAV decode can yield VideoFrame, AudioFrame, or SubtitleSet
        if isinstance(frame, av.AudioFrame):
            resampled_frames = resampler.resample(frame)
            if resampled_frames:
                for resampled_frame in resampled_frames:
                    packets = output_stream.encode(resampled_frame)
                    if packets:
                        output_container.mux(packets)

    # Flush encoder
    packets = output_stream.encode(None)
    if packets:
        output_container.mux(packets)

    output_container.close()
    input_container.close()


def _run_whisper_cpp(wav_path: str, language: str):
    """Запуск whisper.cpp и возврат результата (text, raw json)."""
    # Выводим JSON для удобного парсинга
    with tempfile.TemporaryDirectory() as td:
        base = str(Path(td) / 'out')
        # whisper.cpp сейчас поставляет 2 утилиты:
        #  - старый 'main' (устарел, но поддерживает -ngl, -f flag)
        #  - новый 'whisper-cli' (рекомендуется, НЕ поддерживает -ngl, file БЕЗ -f)
        bin_name = os.path.basename(WHISPER_CPP_BIN).lower()
        
        # FIXED 13.10.2025 - whisper-cli очікує файл БЕЗ -f прапорця в кінці команди
        # Старий 'main': -f /path/to/file.wav
        # Новий 'whisper-cli': /path/to/file.wav (в кінці, без -f)
        is_whisper_cli = 'whisper-cli' in bin_name
        
        cmd = [
            WHISPER_CPP_BIN,
            '-m', WHISPER_CPP_MODEL,
            '-l', language or WHISPER_CPP_LANG_DEFAULT,
            '-t', str(WHISPER_CPP_THREADS),
            '-oj',  # вывод JSON
            '-of', base,
        ]
        
        # Для старого бінаря додаємо -f, для whisper-cli - файл в кінці
        if not is_whisper_cli:
            cmd += ['-f', wav_path]
        
        # FIXED 13.10.2025 v2 - Додаємо ТІЛЬКИ параметри які підтримує whisper-cli
        # whisper-cli НЕ підтримує: --patience, --length-penalty, --compression-ratio-threshold, --no-condition-on-previous-text, --no-coreml
        # Підтримує: --best-of (-bo), --beam-size (-bs), --temperature (-tp), --no-speech-thold (-nth)
        
        if WHISPER_CPP_TEMPERATURE >= 0:  # whisper-cli дефолт 0.0
            cmd += ['-tp', str(WHISPER_CPP_TEMPERATURE)]
        
        if WHISPER_CPP_BEST_OF > 1:
            cmd += ['-bo', str(WHISPER_CPP_BEST_OF)]
            
        if WHISPER_CPP_BEAM_SIZE > 1:
            cmd += ['-bs', str(WHISPER_CPP_BEAM_SIZE)]
            
        if WHISPER_CPP_NO_SPEECH_THRESHOLD != 0.6:  # whisper-cli дефолт 0.60
            cmd += ['-nth', str(WHISPER_CPP_NO_SPEECH_THRESHOLD)]
        
        # Initial prompt підтримується через --prompt (тестуємо)
        if WHISPER_CPP_INITIAL_PROMPT:
            cmd += ['--prompt', WHISPER_CPP_INITIAL_PROMPT]
        
        # Добавляем offload-флаг только для старого бинаря 'main'
        if not is_whisper_cli and WHISPER_CPP_NGL > 0:
            cmd[0:0]  # no-op для читаемости
            cmd.insert(10, '-ngl')
            cmd.insert(11, str(WHISPER_CPP_NGL))
            
        if WHISPER_CPP_MAXLEN > 0:
            cmd += ['-ml', str(WHISPER_CPP_MAXLEN)]
        
        # FIXED 13.10.2025 - whisper-cli очікує файл В КІНЦІ команди БЕЗ -f прапорця
        # Це КРИТИЧНО! Інакше whisper-cli показує help і НЕ запускається
        if is_whisper_cli:
            cmd.append(wav_path)  # Файл в кінці для whisper-cli

        logger.info('Running whisper.cpp: %s', ' '.join(cmd))
        start = datetime.now()
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        dur = (datetime.now() - start).total_seconds()

        if proc.returncode != 0:
            raise RuntimeError(f'whisper.cpp failed: rc={proc.returncode}, stderr={proc.stderr[-500:]}')

        # Файл JSON по базовому имени `base`.json
        json_path = base + '.json'
        if not Path(json_path).exists():
            # как fallback — попытаемся вычитать stdout (на новых версиях -oj пишет файл)
            try:
                data = json.loads(proc.stdout)
            except Exception as e:
                # FIXED 13.10.2025 - Логуємо stderr для діагностики
                logger.error(f'whisper.cpp JSON parse failed. stdout={proc.stdout[:200]}, stderr={proc.stderr[-500:]}')
                raise RuntimeError(f'whisper.cpp did not produce JSON output: {str(e)}')
        else:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

        # Собираем текст, учитывая разные форматы JSON:
        #  - whisper-cli (-oj): top-level 'transcription' = list, элементы со структурой
        #    { "timestamps": {"from": "00:00:00,000", "to": "00:00:01,140"},
        #      "offsets": {"from": 0, "to": 1140}, "text": "..." }
        #  - старый main (-oj): 'transcription': { 'segments': [ { start, end, text } ] }
        def _parse_timecode(tc: str) -> float:
            # Формат "HH:MM:SS,mmm" -> секунды float
            try:
                hh, mm, rest = tc.split(':')
                ss, ms = rest.split(',')
                return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000.0
            except Exception:
                return 0.0

        text_parts = []
        segments_out = []

        if isinstance(data.get('transcription'), list):
            # Новый формат whisper-cli
            for seg in data['transcription']:
                txt = (seg.get('text') or '').strip()
                # Застосовуємо корекцію активаційних слів
                corrected_txt = correct_atlas_activation_words(txt) if txt else txt
                
                # В приоритете используем offsets (мс), fallback к timestamps
                start = end = 0.0
                off = seg.get('offsets') or {}
                if isinstance(off, dict) and 'from' in off and 'to' in off:
                    try:
                        start = float(off['from']) / 1000.0
                        end = float(off['to']) / 1000.0
                    except Exception:
                        start = end = 0.0
                else:
                    ts = seg.get('timestamps') or {}
                    if isinstance(ts, dict):
                        start = _parse_timecode(ts.get('from', '00:00:00,000'))
                        end = _parse_timecode(ts.get('to', '00:00:00,000'))

                if corrected_txt:
                    text_parts.append(corrected_txt)
                segments_out.append({'start': start, 'end': end, 'text': corrected_txt})

        else:
            # Старый формат
            segments = []
            tr = data.get('transcription')
            if isinstance(tr, dict):
                segments = tr.get('segments', []) or []
            if not segments:
                segments = data.get('segments', []) or []

            for seg in segments:
                txt = (seg.get('text') or '').strip()
                # Застосовуємо корекцію активаційних слів
                corrected_txt = correct_atlas_activation_words(txt) if txt else txt
                if corrected_txt:
                    text_parts.append(corrected_txt)
                segments_out.append({
                    'start': float(seg.get('start', 0.0) or 0.0),
                    'end': float(seg.get('end', 0.0) or 0.0),
                    'text': corrected_txt,
                })
        full_text = ' '.join(text_parts).strip()
        # Додаткова корекція повного тексту
        full_text = correct_atlas_activation_words(full_text)

        return full_text, segments_out, dur


@app.route('/health')
def health():
    bin_ok, model_ok = _check_ready()
    bin_name = os.path.basename(WHISPER_CPP_BIN).lower() if WHISPER_CPP_BIN else ''
    # whisper-cli uses GPU by default (unless --no-gpu is passed)
    # old 'main' binary uses GPU when -ngl > 0
    uses_metal = 'whisper-cli' in bin_name or WHISPER_CPP_NGL > 0
    
    return jsonify({
        'status': 'ok' if (bin_ok and model_ok) else 'not-ready',
        'backend': 'whisper.cpp',
        'binary': WHISPER_CPP_BIN,
        'binary_type': 'whisper-cli (GPU default)' if 'whisper-cli' in bin_name else 'main (ngl offload)',
        'model_path': WHISPER_CPP_MODEL,
        'device': 'metal' if uses_metal else 'cpu',
        'ngl': WHISPER_CPP_NGL if 'whisper-cli' not in bin_name else 'N/A (GPU enabled by default)',
        'threads': WHISPER_CPP_THREADS,
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/models')
def models():
    bin_name = os.path.basename(WHISPER_CPP_BIN).lower() if WHISPER_CPP_BIN else ''
    uses_metal = 'whisper-cli' in bin_name or WHISPER_CPP_NGL > 0
    
    return jsonify({
        'available_models': [
            'ggml-base.bin', 'ggml-small.bin', 'ggml-medium.bin', 'ggml-large-v2.bin', 'ggml-large-v3.bin',
            'gguf-base', 'gguf-small', 'gguf-medium', 'gguf-large-v2', 'gguf-large-v3'
        ],
        'current_model': os.path.basename(WHISPER_CPP_MODEL) if WHISPER_CPP_MODEL else None,
        'device': 'metal' if uses_metal else 'cpu',
        'model_loaded': Path(WHISPER_CPP_MODEL).exists() if WHISPER_CPP_MODEL else False
    })


def _transcribe_common(tmp_audio_path: str, language: str):
    bin_ok, model_ok = _check_ready()
    if not bin_ok:
        raise RuntimeError('WHISPER_CPP_BIN not set or binary not found')
    if not model_ok:
        raise RuntimeError('WHISPER_CPP_MODEL not set or model file not found')

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as wavf:
        wav_path = wavf.name
    try:
        _convert_to_wav16k_mono(tmp_audio_path, wav_path)
        text, segments, trans_dur = _run_whisper_cpp(wav_path, language)
        return text, segments, trans_dur
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


@app.route('/transcribe', methods=['POST'])
def transcribe_file():
    if 'audio' not in request.files:
        return jsonify({'status': 'error', 'error': 'No audio file provided'}), 400
    audio_file = request.files['audio']
    language = request.form.get('language', WHISPER_CPP_LANG_DEFAULT)

    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmpf:
        audio_file.save(tmpf.name)
        tmp_path = tmpf.name

    try:
        text, segments, trans_dur = _transcribe_common(tmp_path, language)
        bin_name = os.path.basename(WHISPER_CPP_BIN).lower() if WHISPER_CPP_BIN else ''
        uses_metal = 'whisper-cli' in bin_name or WHISPER_CPP_NGL > 0
        
        return jsonify({
            'status': 'success',
            'text': text,
            'language': language,
            'transcription_time': round(trans_dur, 2),
            'model': os.path.basename(WHISPER_CPP_MODEL) if WHISPER_CPP_MODEL else None,
            'device': 'metal' if uses_metal else 'cpu',
            'segments': segments,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error('Transcription error: %s', e)
        return jsonify({'status': 'error', 'error': str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.route('/transcribe_blob', methods=['POST'])
def transcribe_blob():
    if not request.data:
        return jsonify({'status': 'error', 'error': 'No audio data provided'}), 400
    language = request.args.get('language', WHISPER_CPP_LANG_DEFAULT)

    with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmpf:
        tmpf.write(request.data)
        tmp_path = tmpf.name

    try:
        text, segments, trans_dur = _transcribe_common(tmp_path, language)
        return jsonify({
            'status': 'success',
            'text': text,
            'language': language,
            'transcription_time': round(trans_dur, 2),
            'model': os.path.basename(WHISPER_CPP_MODEL) if WHISPER_CPP_MODEL else None,
            'device': 'metal' if ('whisper-cli' in os.path.basename(WHISPER_CPP_BIN).lower() or WHISPER_CPP_NGL > 0) else 'cpu',
            'segments': segments,
        })
    except Exception as e:
        logger.error('Blob transcription error: %s', e)
        return jsonify({'status': 'error', 'error': str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def initialize():
    bin_name = os.path.basename(WHISPER_CPP_BIN).lower() if WHISPER_CPP_BIN else 'unknown'
    uses_metal = 'whisper-cli' in bin_name or WHISPER_CPP_NGL > 0
    
    logger.info('🚀 Initializing ATLAS Whisper.cpp Service (Metal-ready) ...')
    logger.info('Port: %s', PORT)
    logger.info('Binary: %s', WHISPER_CPP_BIN)
    logger.info('Binary type: %s', 'whisper-cli (GPU by default)' if 'whisper-cli' in bin_name else 'main (ngl offload)')
    logger.info('Model:  %s', WHISPER_CPP_MODEL)
    
    if 'whisper-cli' in bin_name:
        logger.info('Device: metal (whisper-cli uses GPU by default, use --no-gpu to disable)')
    else:
        logger.info('Device: %s (ngl=%d)', 'metal' if WHISPER_CPP_NGL > 0 else 'cpu', WHISPER_CPP_NGL)


if __name__ == '__main__':
    try:
        initialize()
        app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info('🛑 Stopped by user')
    except Exception as e:
        logger.error('❌ Critical error: %s', e)
        raise
