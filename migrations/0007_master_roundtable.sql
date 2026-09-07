CREATE TABLE IF NOT EXISTS master_roundtable_room (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_open INTEGER NOT NULL DEFAULT 1,
  public_can_prompt INTEGER NOT NULL DEFAULT 0,
  web_search_enabled INTEGER NOT NULL DEFAULT 1,
  active_agents TEXT NOT NULL,
  room_title TEXT NOT NULL DEFAULT 'Bate-papo das IAs',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS master_roundtable_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  speaker TEXT NOT NULL,
  display_name TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_roundtable_messages_created_at
  ON master_roundtable_messages(created_at);

INSERT OR IGNORE INTO master_roundtable_room
  (id, is_open, public_can_prompt, web_search_enabled, active_agents, room_title, updated_at)
VALUES
  (1, 1, 0, 1, '["hakham","arcanum","serafim","serena","luna","delta"]', 'Bate-papo das IAs', 0);
