#!/usr/bin/env python3
"""
ATLAS Minimal Frontend Server
Простий Flask сервер тільки для статичних файлів та 3D моделі
Вся логіка перенесена в orchestrator
"""

import os
import logging
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, send_from_directory

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('atlas.frontend')

# Get paths
CURRENT_DIR = Path(__file__).parent
TEMPLATE_DIR = CURRENT_DIR / 'templates'
STATIC_DIR = CURRENT_DIR / 'static'
CONFIG_DIR = CURRENT_DIR.parent / 'config'  # Config directory in parent folder

# Create Flask app
app = Flask(__name__, 
           template_folder=str(TEMPLATE_DIR),
           static_folder=str(STATIC_DIR))

# Configuration
FRONTEND_PORT = int(os.environ.get('FRONTEND_PORT', 5001))

@app.route('/')
def index():
    """Serve the main interface with 3D model"""
    return render_template('index.html', 
                         current_time=datetime.now().strftime('%H:%M:%S'),
                         timestamp=int(datetime.now().timestamp()))

@app.route('/config/<path:filename>')
def serve_config(filename):
    """Serve configuration files from /config/ directory"""
    try:
        response = send_from_directory(str(CONFIG_DIR), filename)
        # Set correct MIME type for JavaScript files
        if filename.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'
        # Enable CORS for config files
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    except FileNotFoundError:
        logger.warning(f"Config file not found: {filename}")
        return f"Config file not found: {filename}", 404

@app.route('/health')
def health():
    """Simple health check"""
    return {
        'status': 'ok',
        'service': 'atlas-frontend',
        'timestamp': datetime.now().isoformat(),
        'port': FRONTEND_PORT
    }

@app.route('/tts/play', methods=['POST'])
def play_tts():
    """Receive TTS play request from orchestrator"""
    try:
        data = request.get_json()
        if not data or 'text' not in data or 'voice' not in data:
            return {'error': 'Missing text or voice parameter'}, 400
            
        text = data['text']
        voice = data['voice']
        
        logger.info(f"Received TTS play request: voice={voice}, text={text[:50]}...")
        
        # Здесь можно добавить логику для помещения в очередь TTS
        # Но пока просто возвращаем успех
        
        return {
            'status': 'accepted',
            'voice': voice,
            'text_length': len(text),
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"TTS play request failed: {e}")
        return {'error': str(e)}, 500

if __name__ == '__main__':
    logger.info(f"Starting ATLAS Minimal Frontend Server on port {FRONTEND_PORT}")
    logger.info("Serving static files and 3D model interface")
    logger.info("All API logic handled by orchestrator on port 5101")
    
    app.run(host='0.0.0.0', port=FRONTEND_PORT, debug=False)
