import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'mysecretkey123')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'myjwtsecretkey123')
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres@localhost:5432/incident_db')