from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from routes.auth import auth_bp
from routes.incidents import incidents_bp

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)
jwt = JWTManager(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(incidents_bp, url_prefix='/api/incidents')

@app.route('/api/health')
def health():
    return {'status': 'ok', 'message': 'AI DevOps Incident Management System Running!'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)