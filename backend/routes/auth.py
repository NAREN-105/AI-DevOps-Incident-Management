import re
from email.utils import parseaddr

import psycopg2
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from notifications import send_email

auth_bp = Blueprint('auth', __name__)

DEMO_USERS = {
    'admin': {'password': 'OpsAdmin!26-H8m4R', 'role': 'administrator'},
    'user': {'password': 'OpsUser!26-V7q3K', 'role': 'user'},
}


def get_db():
    if not Config.DATABASE_URL:
        raise psycopg2.OperationalError('DATABASE_URL is not configured.')
    return psycopg2.connect(Config.DATABASE_URL)


def create_login_response(username, role, status=200, user_id=None, email=None):
    claims = {'role': role}
    if user_id is not None:
        claims['user_id'] = user_id
    if email:
        claims['email'] = email
    token = create_access_token(identity=username, additional_claims=claims)
    return jsonify({
        'token': token,
        'username': username,
        'role': role,
        'email': email,
        'user_id': user_id,
    }), status


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    requested_role = data.get('role')
    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({'error': 'Invalid credentials'}), 401

    login_name = username.strip().lower()
    demo_account = DEMO_USERS.get(login_name)
    user_id = None
    email = None
    if demo_account:
        valid_password = password == demo_account['password']
        role = demo_account['role']
        username = login_name
    else:
        conn = None
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                'SELECT id, username, email, password_hash, role FROM app_users '
                'WHERE (LOWER(username) = %s OR LOWER(email) = %s) AND is_active = TRUE',
                (login_name, login_name)
            )
            account = cur.fetchone()
            cur.close()
        except psycopg2.Error:
            return jsonify({'error': 'Sign-in service is unavailable. Check the database connection.'}), 503
        finally:
            if conn:
                conn.close()

        valid_password = bool(account and account[3]) and check_password_hash(account[3], password)
        user_id = account[0] if account else None
        username = account[1] if account else login_name
        email = account[2] if account else None
        role = account[4] if account else None

    if valid_password and role and requested_role in (None, role):
        return create_login_response(username, role, user_id=user_id, email=email)
    return jsonify({'error': 'Invalid credentials'}), 401


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not all(isinstance(value, str) for value in (username, email, password)):
        return jsonify({'error': 'Username, email, and password are required.'}), 400

    username = username.strip().lower()
    email = email.strip().lower()
    if not re.fullmatch(r'[a-z0-9_.-]{3,32}', username):
        return jsonify({'error': 'Use 3-32 letters, numbers, dots, underscores, or hyphens for the username.'}), 400
    if parseaddr(email)[1] != email or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
        return jsonify({'error': 'Enter a valid email address.'}), 400
    if len(password) < 12:
        return jsonify({'error': 'Password must be at least 12 characters long.'}), 400
    if username in DEMO_USERS:
        return jsonify({'error': 'That username is reserved.'}), 409

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT 1 FROM app_users WHERE LOWER(username) = %s OR LOWER(email) = %s', (username, email))
        if cur.fetchone():
            return jsonify({'error': 'That username or email is already registered.'}), 409

        cur.execute(
            'INSERT INTO app_users (username, email, password_hash, role) '
            'VALUES (%s, %s, %s, %s) RETURNING id',
            (username, email, generate_password_hash(password), 'user')
        )
        user_id = cur.fetchone()[0]
        conn.commit()
    except psycopg2.IntegrityError:
        if conn:
            conn.rollback()
        return jsonify({'error': 'That username or email is already registered.'}), 409
    except psycopg2.Error:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Sign-up is unavailable. Apply the database migration and check the connection.'}), 503
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    send_email([email], 'Welcome to the incident workspace',
               f'Hi {username}, your incident workspace account is ready.')
    return create_login_response(username, 'user', 201, user_id=user_id, email=email)


@auth_bp.route('/google', methods=['POST'])
def google_login():
    credential = (request.get_json() or {}).get('credential')
    if not Config.GOOGLE_CLIENT_ID:
        return jsonify({'error': 'Google sign-in is not configured for this application.'}), 503
    if not isinstance(credential, str) or not credential:
        return jsonify({'error': 'A Google credential is required.'}), 400

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(
            credential, google_requests.Request(), Config.GOOGLE_CLIENT_ID
        )
        if not claims.get('email_verified'):
            return jsonify({'error': 'Verify your Google email address before continuing.'}), 401
    except ImportError:
        return jsonify({'error': 'Install the Google authentication dependency and restart the API.'}), 503
    except ValueError:
        return jsonify({'error': 'Google sign-in could not verify this account.'}), 401

    email = claims['email'].strip().lower()
    google_sub = claims['sub']
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            'SELECT id, username, email, role FROM app_users '
            'WHERE google_sub = %s OR LOWER(email) = %s',
            (google_sub, email)
        )
        account = cur.fetchone()
        if account:
            user_id, username, account_email, role = account
            cur.execute('UPDATE app_users SET google_sub = %s WHERE id = %s AND google_sub IS NULL',
                        (google_sub, user_id))
            email = account_email or email
        else:
            username = f"g_{google_sub[-12:].lower()}"
            cur.execute(
                'INSERT INTO app_users (username, email, google_sub, role) '
                'VALUES (%s, %s, %s, %s) RETURNING id',
                (username, email, google_sub, 'user')
            )
            user_id = cur.fetchone()[0]
            role = 'user'
            send_email([email], 'Welcome to the incident workspace',
                       f'Hi {username}, your Google account is connected to the incident workspace.')
        conn.commit()
    except psycopg2.Error:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Google sign-in is unavailable. Apply the database migration and check the connection.'}), 503
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    return create_login_response(username, role, user_id=user_id, email=email)


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    if get_jwt().get('role') not in ('administrator', 'manager'):
        return jsonify({'error': 'Manager access required.'}), 403
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            'SELECT id, username, email, role, is_active FROM app_users ORDER BY username'
        )
        users = [
            {'id': row[0], 'username': row[1], 'email': row[2], 'role': row[3], 'is_active': row[4]}
            for row in cur.fetchall()
        ]
        cur.close()
        return jsonify(users)
    except psycopg2.Error:
        return jsonify({'error': 'User directory unavailable. Apply the database migration.'}), 503
    finally:
        if conn:
            conn.close()


@auth_bp.route('/users/<int:user_id>/role', methods=['PATCH'])
@jwt_required()
def update_user_role(user_id):
    if get_jwt().get('role') != 'administrator':
        return jsonify({'error': 'Administrator access required.'}), 403
    role = (request.get_json() or {}).get('role')
    if role not in ('user', 'technician', 'manager'):
        return jsonify({'error': 'Choose user, technician, or manager.'}), 400
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('UPDATE app_users SET role = %s WHERE id = %s RETURNING username', (role, user_id))
        updated = cur.fetchone()
        if not updated:
            conn.rollback()
            return jsonify({'error': 'Account not found.'}), 404
        conn.commit()
        cur.close()
        return jsonify({'username': updated[0], 'role': role})
    except psycopg2.Error:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Unable to update account role.'}), 503
    finally:
        if conn:
            conn.close()