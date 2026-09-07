CREATE TABLE IF NOT EXISTS master_chat_visitors (
  session_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_chat_visitors_expires_at
  ON master_chat_visitors(expires_at);

UPDATE master_roundtable_room
SET public_can_prompt = 1,
    active_agents = '["hakham","arcanum","serafim","serena","luna","delta","orion","lyra","nova","polaris","sirius"]',
    updated_at = strftime('%s','now') * 1000
WHERE id = 1;
