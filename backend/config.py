import os
import secrets
from dotenv import load_dotenv
load_dotenv()


def load_secret(name):
    configured = os.getenv(name, '')
    return configured if len(configured) >= 32 else secrets.token_hex(32)


class Config:
    SECRET_KEY = load_secret('SECRET_KEY')
    JWT_SECRET_KEY = load_secret('JWT_SECRET_KEY')
    DATABASE_URL = os.getenv('DATABASE_URL')
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    SMTP_HOST = os.getenv('SMTP_HOST', '')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER = os.getenv('SMTP_USER', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    SMTP_FROM = os.getenv('SMTP_FROM', '')
    SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
    INCIDENT_MANAGER_EMAILS = os.getenv('INCIDENT_MANAGER_EMAILS', '')