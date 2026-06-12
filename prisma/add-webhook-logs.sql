BEGIN;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  event TEXT,
  reference TEXT,
  signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  raw_body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_logs_provider_idx
ON webhook_logs (provider);

CREATE INDEX IF NOT EXISTS webhook_logs_event_idx
ON webhook_logs (event);

CREATE INDEX IF NOT EXISTS webhook_logs_reference_idx
ON webhook_logs (reference);

CREATE INDEX IF NOT EXISTS webhook_logs_received_at_idx
ON webhook_logs (received_at);

COMMIT;
