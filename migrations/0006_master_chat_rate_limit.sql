CREATE TABLE IF NOT EXISTS master_chat_rate_limit (
  ip_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_chat_rate_limit_updated_at
  ON master_chat_rate_limit(updated_at);
