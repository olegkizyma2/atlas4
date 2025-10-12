#!/usr/bin/env python3
"""
Ukrainian TTS HTTP Server
Простий HTTP сервер для українського TTS
"""

import os
import sys
import time
import logging
import argparse
import io
import json
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
# ukrainian_tts import is done lazily in _init_tts() so we can log environment
# early and avoid module import-time crashes that prevent useful logs.

# Log interpreter info as early as possible (module import time)
try:
    _venv = os.environ.get('VIRTUAL_ENV') or os.environ.get('CONDA_PREFIX')
    logging.getLogger('ukrainian-tts-server').info(f"Module import time - Python executable: {sys.executable}")
    logging.getLogger('ukrainian-tts-server').info(f"Module import time - VIRTUAL_ENV/CONDA_PREFIX: {_venv}")
    logging.getLogger('ukrainian-tts-server').info(f"Module import time - sys.path (first entries): {sys.path[:6]}")
except Exception:
    logging.getLogger('ukrainian-tts-server').exception("Failed to log import-time Python environment")
import soundfile as sf  # type: ignore
import numpy as np
import librosa  # type: ignore

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger('ukrainian-tts-server')

class UkrainianTTSServer:
    def __init__(self, host='127.0.0.1', port=3001, device='cpu'):
        self.host = host
        self.port = port
        self.device = device
        
        # Створюємо Flask app
        self.app = Flask(__name__)
        self.app.config['SECRET_KEY'] = 'ukrainian-tts-server-key'
        
        # Додаємо CORS для frontend
        CORS(self.app)
        
        # Log runtime environment to help diagnose venv/import issues
        try:
            venv = os.environ.get('VIRTUAL_ENV') or os.environ.get('CONDA_PREFIX')
            logger.info(f"Python executable: {sys.executable}")
            logger.info(f"VIRTUAL_ENV/CONDA_PREFIX: {venv}")
            logger.info(f"sys.path (first entries): {sys.path[:6]}")
        except Exception:
            logger.exception("Failed to log Python environment")

        # Ініціалізуємо TTS
        self.tts = None
        self._init_tts()
        
        # Реєструємо маршрути
        self._register_routes()
        
        logger.info(f"Ukrainian TTS Server initialized at {host}:{port}")
    
    def _init_tts(self):
        """Ініціалізуємо TTS систему"""
        try:
            logger.info(f"Initializing Ukrainian TTS on device: {self.device}")
            # Импортируем реализацию внутри функции, чтобы поймать ModuleNotFoundError
            try:
                from ukrainian_tts.tts import TTS, Voices, Stress  # type: ignore
            except Exception as e:
                logger.exception("Failed to import ukrainian_tts.tts")
                self.tts = None
                # Поместим заглушки, чтобы маршрут /voices и т.д. корректно отвечали
                self._Voices = None
                self._Stress = None
                return

            # Спробуємо з заданим девайсом, fallback до CPU якщо помилка
            try:
                self.tts = TTS(cache_folder="../", device=self.device)
            except Exception as e:
                if self.device == "mps" and "float64" in str(e).lower():
                    logger.warning("MPS doesn't support float64, falling back to CPU")
                    self.tts = TTS(cache_folder="../", device="cpu")
                    self.device = "cpu"
                else:
                    raise

            # Сохраняем классы для использования в маршрутах
            self._Voices = Voices
            self._Stress = Stress

            logger.info("Ukrainian TTS initialized successfully")

        except Exception as e:
            logger.exception(f"Failed to initialize Ukrainian TTS: {e}")
            self.tts = None
    
    def _register_routes(self):
        """Реєструємо API маршрути"""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint"""
            return jsonify({
                'status': 'ok' if self.tts else 'error',
                'tts_ready': self.tts is not None,
                'device': self.device,
                'timestamp': time.time()
            })
        
        @self.app.route('/voices', methods=['GET'])
        def get_voices():
            """Список доступних голосів"""
            try:
                if getattr(self, '_Voices', None) is None or self._Voices is None:
                    return jsonify({'voices': [], 'default': None, 'timestamp': time.time()})
                voices_list = [v.value for v in self._Voices] if self._Voices else []
                return jsonify({
                    'voices': voices_list,
                    'default': 'dmytro',
                    'timestamp': time.time()
                })
            except Exception as e:
                logger.error(f"Error getting voices: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/tts', methods=['POST'])
        def synthesize_text():
            """Основний ендпойнт для синтезу мови"""
            try:
                if not self.tts:
                    return jsonify({'error': 'TTS not initialized'}), 503
                
                data = request.get_json()
                if not data:
                    return jsonify({'error': 'JSON body required'}), 400
                
                text = data.get('text', '').strip()
                if not text:
                    return jsonify({'error': 'Text is required'}), 400
                
                # Збільшуємо довжину тексту для підтримки повноцінних відповідей в чаті
                MAX_TEXT_LENGTH = 1500  # символів - достатньо для повних відповідей
                if len(text) > MAX_TEXT_LENGTH:
                    logger.warning(f"Text too long ({len(text)} chars), truncating to {MAX_TEXT_LENGTH}")
                    text = text[:MAX_TEXT_LENGTH].rsplit(' ', 1)[0] + '...'
                    if len(text) > MAX_TEXT_LENGTH:  # якщо навіть після truncate все ще довго
                        text = text[:MAX_TEXT_LENGTH]
                
                voice = data.get('voice', 'dmytro')
                fx = data.get('fx', 'none')  # Звукові ефекти
                speed = float(data.get('speed', 1.0))
                return_audio = data.get('return_audio', False)  # Повертати аудіо файл
                
                logger.info(f"TTS request: text='{text[:50]}...', voice={voice}, fx={fx}, length={len(text)} chars")
                
                # Синтезуємо в пам'яті з обробкою помилок
                buf = io.BytesIO()
                start_time = time.time()
                stress_val: str = "dictionary"  # Default value
                accented: str = text  # Initialize with original text - ЗАВЖДИ буде значення
                
                if getattr(self, '_Stress', None) is not None and self._Stress is not None:
                    if hasattr(self._Stress, 'Dictionary'):
                        stress_val = str(self._Stress.Dictionary.value)

                try:
                    _, accented_result = self.tts.tts(text, voice, stress_val, buf)
                    if accented_result:  # Перевіряємо що результат не None
                        accented = accented_result
                except Exception as e:
                    logger.error(f"TTS synthesis failed: {e}")
                    # accented вже має значення text, використовуємо його
                    # Якщо текст занадто складний, спробуємо поступово зменшувати розмір
                    retry_lengths = [800, 500, 300, 150, 80]  # Поступово зменшуємо
                    success = False
                    
                    for retry_length in retry_lengths:
                        if len(text) > retry_length:
                            shortened_text = text[:retry_length].rsplit(' ', 1)[0] + '...'
                            logger.info(f"Retrying with shortened text ({retry_length} chars): '{shortened_text[:50]}...'")
                            try:
                                buf = io.BytesIO()  # Очищаємо буфер
                                _, accented = self.tts.tts(shortened_text, voice, stress_val, buf)
                                text = shortened_text  # Оновлюємо текст для логування
                                success = True
                                break
                            except Exception as e2:
                                logger.error(f"Text with {retry_length} chars failed: {e2}")
                                continue
                        else:
                            break
                    
                    if not success:
                        return jsonify({'error': f'TTS synthesis failed even with shortened text: {str(e)}'}), 500
                
                synthesis_time = time.time() - start_time
                
                # Читаємо аудіо
                buf.seek(0)
                audio, sr = sf.read(buf, dtype="float32")
                
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                
                # Застосовуємо швидкість
                if speed and abs(speed - 1.0) > 1e-3:
                    try:
                        audio = librosa.effects.time_stretch(audio, rate=speed)
                    except Exception:
                        pass
                
                # Застосовуємо звукові ефекти (простий варіант)
                if fx == "robot":
                    try:
                        audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=-4)
                    except Exception:
                        pass
                
                # Нормалізуємо
                peak = float(np.max(np.abs(audio)) or 1.0)
                audio = (audio / peak) * 0.95
                
                if return_audio:
                    # Повертаємо аудіо файл
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
                    sf.write(temp_file.name, audio, sr, subtype="PCM_16")
                    
                    return send_file(
                        temp_file.name,
                        mimetype='audio/wav',
                        as_attachment=True,
                        download_name=f'tts_{int(time.time())}.wav'
                    )
                else:
                    # Повертаємо JSON відповідь
                    return jsonify({
                        'status': 'success',
                        'accented_text': accented,
                        'synthesis_time': round(synthesis_time, 3),
                        'audio_duration': round(len(audio) / sr, 3),
                        'sample_rate': int(sr),
                        'voice': voice,
                        'fx': fx,
                        'timestamp': time.time()
                    })
                
            except Exception as e:
                # Log full traceback to help diagnose issues (was logging only str(e))
                logger.exception("TTS synthesis error")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/speak', methods=['POST'])
        def speak_text():
            """Альтернативний ендпойнт (сумісність)"""
            return synthesize_text()
        
        @self.app.errorhandler(404)
        def not_found(error):
            return jsonify({'error': 'Endpoint not found'}), 404
        
        @self.app.errorhandler(500)
        def internal_error(error):
            # Log full traceback for internal server errors
            logger.exception(f"Internal server error: {error}")
            return jsonify({'error': 'Internal server error'}), 500
    
    def run(self, debug=False):
        """Запускаємо сервер"""
        try:
            logger.info(f"Starting Ukrainian TTS Server on {self.host}:{self.port}")
            logger.info(f"TTS ready: {self.tts is not None}")
            logger.info(f"Device: {self.device}")
            
            self.app.run(
                host=self.host,
                port=self.port,
                debug=debug,
                threaded=True,
                use_reloader=False
            )
            
        except KeyboardInterrupt:
            logger.info("Server stopped by user")
        except Exception as e:
            logger.error(f"Server error: {e}")
            raise

def main():
    """Головна функція"""
    parser = argparse.ArgumentParser(description="Ukrainian TTS HTTP Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=3001, help="Port to bind to")
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "gpu"], help="Device to use")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    
    args = parser.parse_args()
    
    # Створюємо і запускаємо сервер
    server = UkrainianTTSServer(
        host=args.host,
        port=args.port,
        device=args.device
    )
    server.run(debug=args.debug)

if __name__ == '__main__':
    main()
