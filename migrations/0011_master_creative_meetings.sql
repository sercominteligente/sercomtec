CREATE TABLE IF NOT EXISTS master_creative_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  synthesis TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS master_creative_meeting_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  agent_key TEXT NOT NULL,
  phase TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_creative_contributions_meeting
  ON master_creative_meeting_contributions(meeting_id, id);
