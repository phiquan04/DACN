import os
from flask import Flask, render_template
from flask_cors import CORS
from dotenv import load_dotenv

from config import get_config
from app.models import init_db
from app.routes import register_blueprints

load_dotenv()

def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))
    
    # Setup CORS
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "expose_headers": ["Content-Type"],
        }
    })
    
    # Initialize database
    init_db(app)
    
    # Register all blueprints
    register_blueprints(app)
    
    # Home route
    @app.route('/', methods=['GET'])
    def index():
        return render_template('index.html')
    
    # Error handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        print(f"Unhandled exception: {e}", flush=True)
        from flask import jsonify
        return jsonify({"error": str(e)}), 500
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host='127.0.0.1',
        port=8080,
        threaded=False,
        use_reloader=False,
        debug=os.getenv('FLASK_ENV') == 'development'
    )