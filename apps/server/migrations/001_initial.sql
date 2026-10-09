CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK (length(username) BETWEEN 3 AND 32)
);
CREATE TABLE IF NOT EXISTS corporations (
 id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 state jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0,
 CHECK (jsonb_typeof(state) = 'object'), CHECK ((state->>'cash')::numeric >= 0)
);
CREATE TABLE IF NOT EXISTS world (id integer PRIMARY KEY CHECK(id=1), state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS idempotency (
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 key text NOT NULL, payload_hash text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,key)
);
CREATE TABLE IF NOT EXISTS economic_audit (
 id bigserial PRIMARY KEY, account_id uuid, action text NOT NULL, region_id text,
 payload jsonb NOT NULL, changes jsonb NOT NULL, revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS economic_audit_account ON economic_audit(account_id,created_at DESC);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
