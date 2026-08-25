import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-2025')
    DATABASE_URL = os.getenv(
        'DATABASE_URL',
        'sqlite:///./chatbot.db'
    )

    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    DEBUG = False

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False
    SQLALCHEMY_ECHO = True

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    SQLALCHEMY_ECHO = False

class TestingConfig(Config):
    TESTING = True
    DATABASE_URL = 'sqlite:///:memory:'
    SQLALCHEMY_ECHO = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config(config_name=None):
    if config_name is None:
        config_name = os.getenv('ENVIRONMENT', 'development')
    if config_name == 'production' and not os.getenv('SECRET_KEY'):
        # Refuse to start rather than silently sign JWTs with the
        # publicly-known dev default — anyone who has read this repo could
        # forge a valid token for any user.
        raise RuntimeError(
            "SECRET_KEY environment variable must be set when ENVIRONMENT=production."
        )
    return config.get(config_name, config['development'])
