CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(320),
    password_hash TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    google_sub VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique
    ON app_users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_google_sub_unique
    ON app_users (google_sub) WHERE google_sub IS NOT NULL;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reporter_user_id INTEGER
    REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reporter_username VARCHAR(32);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(320);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER
    REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS incidents_reporter_user_id_idx ON incidents (reporter_user_id);
CREATE INDEX IF NOT EXISTS incidents_assigned_user_id_idx ON incidents (assigned_user_id);
CREATE INDEX IF NOT EXISTS incidents_status_created_at_idx ON incidents (status, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_activity (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    actor_username VARCHAR(32) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS incident_activity_incident_id_idx
    ON incident_activity (incident_id, created_at DESC);