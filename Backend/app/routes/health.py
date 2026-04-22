import os
from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health():
    """Check backend health and API configurations"""
    return jsonify({
        "status": "ok",
        "service": "Japanese VA Backend",
        "youtube_api": "configured" if os.environ.get('YOUTUBE_API_KEY') else "NOT CONFIGURED",
        "openai_api": "configured" if os.environ.get('OPENAI_API_KEY') else "NOT CONFIGURED",
        "openrouter_api": "configured" if os.environ.get('OPENROUTER_API_KEY') else "NOT CONFIGURED",
    }), 200
