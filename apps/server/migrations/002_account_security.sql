ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Existing session';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS sessions_id ON sessions(id);
CREATE TABLE IF NOT EXISTS recovery_codes (
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id, code_hash)
);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
