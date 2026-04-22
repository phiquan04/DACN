from flask import Blueprint

# Import blueprints
from .health import health_bp
from .correct import correct_bp
from .alternative import alternative_bp
from .chat import chat_bp
from .youtube import youtube_bp
from .transcribe import transcribe_bp
from .tts import tts_bp
from .practice_test import practice_bp   
# Register all blueprints
def register_blueprints(app):
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(correct_bp, url_prefix='/api')
    app.register_blueprint(alternative_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')
    app.register_blueprint(youtube_bp, url_prefix='/api')
    app.register_blueprint(transcribe_bp, url_prefix='/api')
    app.register_blueprint(tts_bp, url_prefix='/api')
    app.register_blueprint(practice_bp, url_prefix='/api')
