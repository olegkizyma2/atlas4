#!/usr/bin/env python3
"""
ATLAS Whisper Speech Recognition Service
Сервіс для розпізнавання мови з використанням faster-whisper Large v3
"""

import os
import io
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('atlas.whisper')

# Конфігурація
WHISPER_PORT = int(os.environ.get('WHISPER_PORT', 3002))
# Дозволяємо керувати параметрами через змінні оточення (сумісно з restart_system.sh)
# Модель: tiny/base/small/medium/large-v1/large-v2/large-v3/distil-large-v3 тощо
WHISPER_MODEL = os.environ.get('WHISPER_MODEL', 'medium')
# Пристрій: 'auto' (рекомендовано), 'cpu', або 'cuda' (якщо доступна NVIDIA GPU)
DEVICE = os.environ.get('WHISPER_DEVICE', 'auto')
# Тип обчислень: float32/float16/bfloat16/int8/int8_float16/... (див. CTranslate2 compute_type)
COMPUTE_TYPE = os.environ.get('WHISPER_COMPUTE_TYPE', 'float32')

# Покращені параметри для кращої якості транскрипції
TEMPERATURE = float(os.environ.get('WHISPER_TEMPERATURE', '0.0'))  # 0.0 для точності
BEAM_SIZE = int(os.environ.get('WHISPER_BEAM_SIZE', '5'))  # розмір пучка для beam search
BEST_OF = int(os.environ.get('WHISPER_BEST_OF', '5'))  # кількість кандидатів
PATIENCE = float(os.environ.get('WHISPER_PATIENCE', '1.0'))  # терпіння для beam search
LENGTH_PENALTY = float(os.environ.get('WHISPER_LENGTH_PENALTY', '1.0'))  # штраф за довжину
COMPRESSION_RATIO_THRESHOLD = float(os.environ.get('WHISPER_COMPRESSION_RATIO_THRESHOLD', '2.4'))
NO_SPEECH_THRESHOLD = float(os.environ.get('WHISPER_NO_SPEECH_THRESHOLD', '0.6'))
CONDITION_ON_PREVIOUS_TEXT = os.environ.get('WHISPER_CONDITION_ON_PREVIOUS_TEXT', 'true').lower() == 'true'
INITIAL_PROMPT = os.environ.get('WHISPER_INITIAL_PROMPT', 'Це українська мова з правильною орфографією, граматикою та пунктуацією.')

# Словник корекції для активаційних слів
ATLAS_ACTIVATION_WORDS = {
    # Українські варіанти
    'атлас': 'Атлас',
    'атлаз': 'Атлас', 
    'атлес': 'Атлас',
    'артлас': 'Атлас',
    'атлось': 'Атлас',
    'атланс': 'Атлас',
    'адлас': 'Атлас',
    'отлас': 'Атлас',
    'етлас': 'Атлас',
    
    # Англійські варіанти  
    'atlas': 'Атлас',
    'atlass': 'Атлас',
    'atlus': 'Атлас',
    'adlas': 'Атлас',
    'atles': 'Атлас',
    'atlantis': 'Атлас',  # часто плутається
    
    # Похибки розпізнавання
    'а т л а с': 'Атлас',  # по літерах
    'а-т-л-а-с': 'Атлас',
    'атл ас': 'Атлас',
    'ат лас': 'Атлас',
    'атла с': 'Атлас',
}

# Створення Flask app
app = Flask(__name__)
CORS(app)

# Глобальні змінні для моделі
whisper_model = None

def correct_atlas_activation_words(text: str) -> str:
    """
    Корекція активаційних слів "Атлас" у транскрипції.
    
    Замінює всі варіанти неправильно розпізнаних слів на правильне "Атлас".
    Особливо важливо для голосової активації системи.
    """
    if not text:
        return text
        
    corrected_text = text
    
    # Пошук та заміна кожного варіанта з словника
    for incorrect, correct in ATLAS_ACTIVATION_WORDS.items():
        # Регістронезалежний пошук з урахуванням меж слів
        import re
        pattern = r'\b' + re.escape(incorrect.lower()) + r'\b'
        corrected_text = re.sub(pattern, correct, corrected_text, flags=re.IGNORECASE)
    
    # Додаткова логіка для схожих звучань
    corrected_text = _advanced_atlas_correction(corrected_text)
    
    return corrected_text

def _advanced_atlas_correction(text: str) -> str:
    """
    Розширена корекція для складних випадків розпізнавання "Атлас".
    """
    import re
    
    # Паттерни для складних випадків
    patterns = [
        # Слова що починаються на "ат" і схожі на "атлас"
        (r'\b(ат\w{0,4}лас?)\b', 'Атлас'),
        (r'\b(атл\w{0,3}с?)\b', 'Атлас'),
        
        # Розбиті по складах
        (r'\b(а\s*т\s*л\w*с?)\b', 'Атлас'),
        (r'\b(ат\s*л\w*с?)\b', 'Атлас'),
        
        # З дефісами або крапками
        (r'\b(а[-.]?т[-.]?л[-.]?а[-.]?с)\b', 'Атлас'),
    ]
    
    corrected = text
    for pattern, replacement in patterns:
        corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
    
    return corrected

def is_valid_transcription(text: str, duration: float) -> bool:
    """Проста валідація результату транскрипції.
    Відсіюємо порожні, занадто короткі або підозрілі результати.
    """
    try:
        if text is None:
            return False
        t = text.strip()
        if not t:
            return False
        # Якщо запис був відносно довгим, а текст занадто короткий — відфільтровуємо
        if duration is not None:
            try:
                d = float(duration)
            except Exception:
                d = 0.0
        else:
            d = 0.0
        if d >= 1.0 and len(t) < 3:
            return False
        # Відфільтрувати суцільне повторення одного символу
        if len(set(t)) <= 1:
            return False
        # Якщо текст довгий, але складається майже не з літер — підозріло
        if len(t) >= 10:
            letters = sum(1 for ch in t if ch.isalpha())
            if letters / max(1, len(t)) < 0.3:
                return False
        return True
    except Exception:
        # У випадку помилки в валідації — краще пропустити текст
        return True

def load_whisper_model():
    """Завантаження моделі faster-whisper Large v3"""
    global whisper_model
    
    if whisper_model is not None:
        return whisper_model
    
    logger.info(f"🤖 Завантаження faster-whisper {WHISPER_MODEL} моделі...")
    logger.info(f"Device: {DEVICE}, Compute type: {COMPUTE_TYPE}")
    start_time = datetime.now()
    
    try:
        # Завантажуємо Large v3 модель
        whisper_model = WhisperModel(
            WHISPER_MODEL,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            download_root=None,  # Використовуємо стандартну директорію
            local_files_only=False
        )
        
        load_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"✅ faster-whisper {WHISPER_MODEL} модель завантажена успішно за {load_time:.2f} секунд!")
        
        return whisper_model
        
    except Exception as e:
        logger.error(f"❌ Помилка завантаження моделі: {e}")
        
        # Fallback до CPU якщо не вдалося
        try:
            logger.info("Спроба fallback на CPU...")
            whisper_model = WhisperModel(
                WHISPER_MODEL,
                device="cpu",
                compute_type="float32"
            )
            load_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ Модель завантажена на CPU за {load_time:.2f} секунд")
            return whisper_model
            
        except Exception as cpu_e:
            logger.error(f"❌ CPU fallback також не вдався: {cpu_e}")
            return None

@app.route('/health')
def health():
    """Перевірка стану сервісу"""
    global whisper_model
    
    try:
        model_loaded = whisper_model is not None
        return jsonify({
            'status': 'ok',
            'model_loaded': model_loaded,
            'model_name': WHISPER_MODEL if model_loaded else None,
            'model': WHISPER_MODEL if model_loaded else None,  # для фронтенд-сумісності
            'device': DEVICE,
            'compute_type': COMPUTE_TYPE,
            'timestamp': datetime.now().isoformat(),
            'service': 'atlas-whisper-large-v3'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Розпізнавання мови з аудіо файлу
    
    Expected:
    - audio file in request.files['audio']
    - optional: language (uk, en, etc.)
    
    Returns:
    - JSON with transcribed text
    """
    try:
        # Перевіряємо наявність аудіо файлу
        if 'audio' not in request.files:
            return jsonify({
                'error': 'No audio file provided',
                'status': 'error'
            }), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({
                'error': 'Empty audio file',
                'status': 'error'
            }), 400
        
        # Отримуємо мову (за замовчуванням українська)
        language = request.form.get('language', 'uk')
        
        logger.info(f"🎤 Transcribing audio file: {audio_file.filename}, language: {language}")
        
        # Завантажуємо модель якщо необхідно
        model = load_whisper_model()
        if model is None:
            return jsonify({
                'error': 'Whisper model not available',
                'status': 'error'
            }), 500
        
        # Додаткові параметри транскрипції
        beam_size = int(request.form.get('beam_size', 5))
        word_timestamps = request.form.get('word_timestamps', 'false').lower() == 'true'
        use_vad = request.form.get('use_vad', 'true').lower() == 'true'
        
        logger.info(f"Параметри: language={language}, beam_size={beam_size}, word_timestamps={word_timestamps}, use_vad={use_vad}")
        
        # Зберігаємо аудіо у тимчасовий файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # Розпізнаємо мову з Large v3
            start_time = datetime.now()
            
            # Налаштовуємо покращені параметри для транскрипції
            transcribe_params = {
                'beam_size': beam_size or BEAM_SIZE,
                'language': language if language != 'auto' else None,
                'word_timestamps': word_timestamps,
                'vad_filter': use_vad,
                'temperature': TEMPERATURE,
                'best_of': BEST_OF,
                'patience': PATIENCE,
                'length_penalty': LENGTH_PENALTY,
                'compression_ratio_threshold': COMPRESSION_RATIO_THRESHOLD,
                'no_speech_threshold': NO_SPEECH_THRESHOLD,
                'condition_on_previous_text': CONDITION_ON_PREVIOUS_TEXT,
                'initial_prompt': INITIAL_PROMPT if INITIAL_PROMPT else None
            }
            
            if use_vad:
                transcribe_params['vad_parameters'] = dict(
                    min_silence_duration_ms=2000,  # Збільшуємо мінімальну тривалість мовчання
                    threshold=0.3,  # Знижуємо поріг детекції голосу для більшої чутливості
                    min_speech_duration_ms=100  # Мінімальна тривалість мови
                )
            
            segments, info = model.transcribe(temp_path, **transcribe_params)
            
            # Збираємо текст з усіх сегментів
            transcription_segments = []
            full_text_parts = []
            
            for segment in segments:
                segment_text = segment.text.strip()
                if segment_text and is_valid_transcription(segment_text, segment.end - segment.start):
                    # Застосовуємо корекцію активаційних слів
                    corrected_segment_text = correct_atlas_activation_words(segment_text)
                    full_text_parts.append(corrected_segment_text)
                    transcription_segments.append({
                        'start': segment.start,
                        'end': segment.end,
                        'text': corrected_segment_text
                    })
            
            full_text = ' '.join(full_text_parts).strip()
            # Додаткова корекція повного тексту
            full_text = correct_atlas_activation_words(full_text)
            transcription_time = (datetime.now() - start_time).total_seconds()
            
            # Перевіряємо чи результат валідний
            if not is_valid_transcription(full_text, info.duration):
                logger.info(f"🚫 Результат відфільтровано: '{full_text}'")
                return jsonify({
                    'status': 'filtered',
                    'text': '',
                    'reason': 'Suspicious or too short transcription',
                    'original_text': full_text,
                    'duration': round(info.duration, 2),
                    'transcription_time': round(transcription_time, 2),
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"✅ Транскрипція завершена за {transcription_time:.2f}с: '{full_text[:100]}...'")
            
            response_data = {
                'status': 'success',
                'text': full_text,
                'language': info.language,
                'language_probability': round(info.language_probability, 4),
                'duration': round(info.duration, 2),
                'transcription_time': round(transcription_time, 2),
                'model': WHISPER_MODEL,
                'segments': transcription_segments if word_timestamps else None,
                'timestamp': datetime.now().isoformat()
            }
            
            return jsonify(response_data)
            
        finally:
            # Видаляємо тимчасовий файл
            try:
                os.unlink(temp_path)
            except Exception as cleanup_error:
                logger.warning(f"Не вдалося видалити тимчасовий файл: {cleanup_error}")
                
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/transcribe_blob', methods=['POST'])
def transcribe_blob():
    """
    Розпізнавання мови з бінарних даних
    
    Expected:
    - binary audio data in request.data
    - optional: language in query params
    
    Returns:
    - JSON with transcribed text
    """
    try:
        # Перевіряємо наявність даних
        if not request.data:
            return jsonify({
                'error': 'No audio data provided',
                'status': 'error'
            }), 400
        
        # Отримуємо мову та параметри
        language = request.args.get('language', 'uk')
        use_vad = request.args.get('use_vad', 'true').lower() == 'true'
        
        logger.info(f"🎤 Transcribing audio blob ({len(request.data)} bytes), language: {language}, use_vad: {use_vad}")
        
        # Завантажуємо модель якщо необхідно
        model = load_whisper_model()
        if model is None:
            return jsonify({
                'error': 'Whisper model not available',
                'status': 'error'
            }), 500
        
        # Зберігаємо дані у тимчасовий файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(request.data)
            temp_path = temp_file.name
        
        try:
            # Розпізнаємо мову
            start_time = datetime.now()
            
            # Налаштовуємо покращені параметри для транскрипції
            transcribe_params = {
                'language': language if language != 'auto' else None,
                'vad_filter': use_vad,
                'beam_size': BEAM_SIZE,
                'temperature': TEMPERATURE,
                'best_of': BEST_OF,
                'patience': PATIENCE,
                'length_penalty': LENGTH_PENALTY,
                'compression_ratio_threshold': COMPRESSION_RATIO_THRESHOLD,
                'no_speech_threshold': NO_SPEECH_THRESHOLD,
                'condition_on_previous_text': CONDITION_ON_PREVIOUS_TEXT,
                'initial_prompt': INITIAL_PROMPT if INITIAL_PROMPT else None
            }
            
            if use_vad:
                transcribe_params['vad_parameters'] = dict(
                    min_silence_duration_ms=2000,  # Збільшуємо мінімальну тривалість мовчання
                    threshold=0.3,  # Знижуємо поріг детекції голосу для більшої чутливості
                    min_speech_duration_ms=100  # Мінімальна тривалість мови
                )
            
            segments, info = model.transcribe(temp_path, **transcribe_params)
            
            transcription_time = (datetime.now() - start_time).total_seconds()
            
            # Збираємо текст з усіх сегментів
            full_text_parts = []
            for segment in segments:
                segment_text = segment.text.strip()
                # Застосовуємо корекцію активаційних слів для кожного сегмента
                corrected_segment_text = correct_atlas_activation_words(segment_text)
                full_text_parts.append(corrected_segment_text)
            
            text = ' '.join(full_text_parts).strip()
            # Додаткова корекція повного тексту
            text = correct_atlas_activation_words(text)
            detected_language = info.language
            
            # Перевіряємо чи результат валідний
            if not is_valid_transcription(text, info.duration):
                logger.info(f"🚫 Blob результат відфільтровано: '{text}'")
                return jsonify({
                    'status': 'filtered',
                    'text': '',
                    'reason': 'Suspicious or too short transcription',
                    'original_text': text,
                    'duration': round(info.duration, 2),
                    'transcription_time': transcription_time,
                    'model': WHISPER_MODEL,
                    'device': DEVICE
                })
            
            logger.info(f"✅ Blob transcription completed in {transcription_time:.2f}s: '{text[:50]}...'")
            
            return jsonify({
                'status': 'success',
                'text': text,
                'language': detected_language,
                'transcription_time': transcription_time,
                'model': WHISPER_MODEL,
                'device': DEVICE
            })
            
        finally:
            # Видаляємо тимчасовий файл
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"❌ Blob transcription error: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/models')
def list_models():
    """Список доступних моделей Whisper"""
    available_models = [
        'tiny', 'tiny.en',
        'base', 'base.en', 
        'small', 'small.en',
        'medium', 'medium.en',
        'large-v1', 'large-v2', 'large-v3'
    ]
    
    return jsonify({
        'available_models': available_models,
        'current_model': WHISPER_MODEL,
        'device': DEVICE,
        'model_loaded': whisper_model is not None
    })

def initialize_service():
    """Ініціалізація сервісу Whisper"""
    logger.info("🚀 Ініціалізація ATLAS Whisper Large v3 Service...")
    logger.info(f"Порт: {WHISPER_PORT}")
    logger.info(f"Модель: {WHISPER_MODEL}")
    logger.info(f"Пристрій: {DEVICE}")
    
    try:
        load_whisper_model()
        logger.info("✅ Сервіс ініціалізовано успішно!")
    except Exception as e:
        logger.error(f"❌ Помилка ініціалізації: {e}")
        raise

if __name__ == '__main__':
    try:
        initialize_service()
        
        logger.info(f"🌐 Запуск сервера на порту {WHISPER_PORT}...")
        app.run(
            host='0.0.0.0',
            port=WHISPER_PORT,
            debug=False,
            threaded=True
        )
        
    except KeyboardInterrupt:
        logger.info("🛑 Сервіс зупинено користувачем")
    except Exception as e:
        logger.error(f"❌ Критична помилка: {e}")
        exit(1)