from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
import psycopg2

from config import Config
from notifications import manager_recipients, send_email

incidents_bp = Blueprint('incidents', __name__)
VALID_STATUSES = {'Open', 'Assigned', 'In Progress', 'Resolved'}
MANAGEMENT_ROLES = {'administrator', 'manager'}


def get_db():
    if not Config.DATABASE_URL:
        raise psycopg2.OperationalError('DATABASE_URL is not configured.')
    return psycopg2.connect(Config.DATABASE_URL)


def predict_severity(title, description):
    text = (title + ' ' + description).lower()
    if any(word in text for word in ['critical', 'down', 'crash', 'outage', 'breach']):
        return 'Critical'
    if any(word in text for word in ['error', 'fail', 'slow', 'timeout']):
        return 'High'
    if any(word in text for word in ['warning', 'issue', 'problem']):
        return 'Medium'
    return 'Low'


def add_activity(cursor, incident_id, actor, event_type, details):
    cursor.execute(
        'INSERT INTO incident_activity (incident_id, actor_username, event_type, details) '
        'VALUES (%s, %s, %s, %s)',
        (incident_id, actor, event_type, details)
    )


def incident_is_visible(row, role, user_id, username):
    if role in MANAGEMENT_ROLES:
        return True
    if role == 'technician':
        return row[1] == user_id
    return row[0] == user_id or (row[0] is None and row[2] == username)


@incidents_bp.route('/', methods=['GET'])
@jwt_required()
def get_incidents():
    claims = get_jwt()
    role = claims.get('role', 'user')
    user_id = claims.get('user_id')
    username = get_jwt_identity()
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        query = '''
            SELECT i.id, i.title, i.description, i.severity, i.status, i.created_at,
                   i.reporter_user_id, i.assigned_user_id, i.reporter_username,
                   COALESCE(r.username, i.reporter_username), i.reporter_email,
                   a.username, a.email, i.resolved_at
            FROM incidents i
            LEFT JOIN app_users r ON r.id = i.reporter_user_id
            LEFT JOIN app_users a ON a.id = i.assigned_user_id
        '''
        params = ()
        if role == 'technician':
            query += ' WHERE i.assigned_user_id = %s'
            params = (user_id,)
        elif role not in MANAGEMENT_ROLES:
            query += ' WHERE i.reporter_user_id = %s OR (i.reporter_user_id IS NULL AND i.reporter_username = %s)'
            params = (user_id, username)
        query += ' ORDER BY i.created_at DESC'
        cur.execute(query, params)
        rows = cur.fetchall()
        incidents = [{
            'id': row[0], 'title': row[1], 'description': row[2], 'severity': row[3],
            'status': row[4], 'created_at': row[5].isoformat() if row[5] else None,
            'reporter_user_id': row[6], 'assigned_user_id': row[7],
            'reporter_username': row[9], 'reporter_email': row[10],
            'assigned_username': row[11], 'assigned_email': row[12],
            'resolved_at': row[13].isoformat() if row[13] else None,
        } for row in rows]
        cur.close()
        return jsonify(incidents)
    except psycopg2.Error:
        return jsonify({'error': 'Incident data is unavailable. Apply the role-workflow database migration.'}), 503
    finally:
        if conn:
            conn.close()


@incidents_bp.route('/', methods=['POST'])
@jwt_required()
def create_incident():
    data = request.get_json() or {}
    title = data.get('title')
    description = data.get('description')
    if not isinstance(title, str) or not isinstance(description, str) or not title.strip() or not description.strip():
        return jsonify({'error': 'A title and description are required.'}), 400
    if len(title.strip()) > 200 or len(description.strip()) > 10000:
        return jsonify({'error': 'Title must be 200 characters or fewer and description 10,000 or fewer.'}), 400

    claims = get_jwt()
    username = get_jwt_identity()
    severity = predict_severity(title, description)
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        assigned = None
        cur.execute('''
            SELECT u.id, u.username, u.email
            FROM app_users u
            LEFT JOIN incidents i ON i.assigned_user_id = u.id
                AND i.status IN ('Assigned', 'In Progress')
            WHERE u.role = 'technician' AND u.is_active = TRUE
            GROUP BY u.id, u.username, u.email
            ORDER BY COUNT(i.id), u.id
            LIMIT 1
        ''')
        assigned = cur.fetchone()
        status = 'Assigned' if assigned else 'Open'
        cur.execute('''
            INSERT INTO incidents
                (title, description, severity, status, reporter_user_id, reporter_username,
                 reporter_email, assigned_user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            title.strip(), description.strip(), severity, status, claims.get('user_id'),
            username, claims.get('email'), assigned[0] if assigned else None
        ))
        incident_id = cur.fetchone()[0]
        add_activity(cur, incident_id, username, 'created', f'Incident reported with {severity} severity.')
        manager_emails = manager_recipients(cur)
        conn.commit()
        cur.close()
        cur = None

        send_email(manager_emails, f'New {severity} incident: {title.strip()}',
                   f'{title.strip()}\n\n{description.strip()}\n\nReported by {username}.')
        if assigned and assigned[2]:
            send_email([assigned[2]], f'Incident assigned to you: {title.strip()}',
                       f'{title.strip()}\n\n{description.strip()}\n\nSeverity: {severity}')
        return jsonify({
            'id': incident_id, 'severity': severity, 'status': status,
            'assigned_to': assigned[1] if assigned else None,
            'message': 'Incident created and routed.'
        }), 201
    except psycopg2.Error:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Incident creation failed. Apply the role-workflow database migration.'}), 503
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@incidents_bp.route('/<int:incident_id>', methods=['PATCH', 'PUT'])
@jwt_required()
def update_incident(incident_id):
    claims = get_jwt()
    role = claims.get('role', 'user')
    user_id = claims.get('user_id')
    username = get_jwt_identity()
    data = request.get_json() or {}
    requested_status = data.get('status')
    requested_assignee = data.get('assigned_user_id')
    if requested_status is not None and requested_status not in VALID_STATUSES:
        return jsonify({'error': 'Choose a valid incident status.'}), 400
    if requested_assignee is not None and role not in MANAGEMENT_ROLES:
        return jsonify({'error': 'Only a manager or administrator can change assignment.'}), 403
    if requested_status is None and requested_assignee is None:
        return jsonify({'error': 'Provide a status or technician assignment to update.'}), 400

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT i.reporter_user_id, i.assigned_user_id, i.reporter_username,
                   i.reporter_email, i.title, i.description, i.status
            FROM incidents i WHERE i.id = %s FOR UPDATE
        ''', (incident_id,))
        incident = cur.fetchone()
        if not incident:
            return jsonify({'error': 'Incident not found.'}), 404
        if role not in MANAGEMENT_ROLES:
            if role != 'technician' or incident[1] != user_id:
                return jsonify({'error': 'You do not have access to update this incident.'}), 403
            if requested_assignee is not None or requested_status not in ('In Progress', 'Resolved'):
                return jsonify({'error': 'Technicians can only start or resolve incidents assigned to them.'}), 403

        assignee = None
        if requested_assignee is not None:
            cur.execute(
                "SELECT id, username, email FROM app_users WHERE id = %s AND role = 'technician' AND is_active = TRUE",
                (requested_assignee,)
            )
            assignee = cur.fetchone()
            if not assignee:
                return jsonify({'error': 'Choose an active technician account.'}), 400

        new_status = requested_status or ('Assigned' if assignee and incident[6] == 'Open' else incident[6])
        new_assignee_id = assignee[0] if assignee else incident[1]
        cur.execute('''
            UPDATE incidents SET status = %s, assigned_user_id = %s,
                resolved_at = CASE WHEN %s = 'Resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (new_status, new_assignee_id, new_status, incident_id))

        if requested_status and requested_status != incident[6]:
            add_activity(cur, incident_id, username, 'status', f'Status changed from {incident[6]} to {requested_status}.')
        if assignee and assignee[0] != incident[1]:
            add_activity(cur, incident_id, username, 'assigned', f'Assigned to {assignee[1]}.')
        manager_emails = manager_recipients(cur)
        conn.commit()
        cur.close()
        cur = None

        if assignee and assignee[0] != incident[1] and assignee[2]:
            send_email([assignee[2]], f'Incident assigned to you: {incident[4]}',
                       f'{incident[4]}\n\n{incident[5]}\n\nCurrent status: {new_status}')
        if requested_status and requested_status != incident[6]:
            if incident[3]:
                send_email([incident[3]], f'Incident update: {incident[4]}',
                           f'Status changed from {incident[6]} to {requested_status} by {username}.')
            if requested_status == 'Resolved':
                send_email(manager_emails, f'Incident resolved: {incident[4]}',
                           f'{incident[4]} has been marked resolved by {username}.')
        return jsonify({'message': 'Incident updated.', 'status': new_status,
                        'assigned_to': assignee[1] if assignee else None})
    except psycopg2.Error:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Incident update failed. Apply the role-workflow database migration.'}), 503
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@incidents_bp.route('/<int:incident_id>/activity', methods=['GET'])
@jwt_required()
def get_incident_activity(incident_id):
    claims = get_jwt()
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            'SELECT reporter_user_id, assigned_user_id, reporter_username FROM incidents WHERE id = %s',
            (incident_id,)
        )
        incident = cur.fetchone()
        if not incident:
            return jsonify({'error': 'Incident not found.'}), 404
        if not incident_is_visible(incident, claims.get('role', 'user'), claims.get('user_id'), get_jwt_identity()):
            return jsonify({'error': 'You do not have access to this incident.'}), 403
        cur.execute(
            'SELECT actor_username, event_type, details, created_at FROM incident_activity '
            'WHERE incident_id = %s ORDER BY created_at DESC LIMIT 50',
            (incident_id,)
        )
        events = [
            {'actor': row[0], 'type': row[1], 'details': row[2], 'created_at': row[3].isoformat()}
            for row in cur.fetchall()
        ]
        cur.close()
        return jsonify(events)
    except psycopg2.Error:
        return jsonify({'error': 'Incident activity is unavailable. Apply the role-workflow database migration.'}), 503
    finally:
        if conn:
            conn.close()