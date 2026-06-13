BEGIN;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx
ON refresh_tokens (family_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
ON refresh_tokens (expires_at);

COMMIT;
