from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import psycopg2
from config import Config

incidents_bp = Blueprint('incidents', __name__)

def get_db():
    return psycopg2.connect(Config.DATABASE_URL)

def predict_severity(title, description):
    text = (title + ' ' + description).lower()
    if any(word in text for word in ['critical', 'down', 'crash', 'outage', 'breach']):
        return 'Critical'
    elif any(word in text for word in ['error', 'fail', 'slow', 'timeout']):
        return 'High'
    elif any(word in text for word in ['warning', 'issue', 'problem']):
        return 'Medium'
    else:
        return 'Low'

@incidents_bp.route('/', methods=['GET'])
@jwt_required()
def get_incidents():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
    rows = cur.fetchall()
    incidents = []
    for row in rows:
        incidents.append({
            'id': row[0], 'title': row[1], 'description': row[2],
            'severity': row[3], 'status': row[4], 'created_at': str(row[5])
        })
    cur.close()
    conn.close()
    return jsonify(incidents)

@incidents_bp.route('/', methods=['POST'])
@jwt_required()
def create_incident():
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    severity = predict_severity(title, description)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO incidents (title, description, severity, status) VALUES (%s, %s, %s, %s) RETURNING id",
        (title, description, severity, 'Open')
    )
    incident_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'id': incident_id, 'severity': severity, 'message': 'Incident created!'}), 201

@incidents_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_incident(id):
    data = request.get_json()
    status = data.get('status')
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE incidents SET status=%s WHERE id=%s", (status, id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Incident updated!'})