import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'mysecretkey123')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'myjwtsecretkey123')
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://incident_db_npr5_user:vVfiyNdA9CTgAaDBJ2lGmaJXnG3PjwAI@dpg-d6pshr6a2pns73bsg3i0-a.oregon-postgres.render.com/incident_db_npr5')