-- SER IA Master · Conselho Criativo e Memória Mestra

CREATE TABLE IF NOT EXISTS master_agent_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  speaker_key TEXT NOT NULL,
  target_key TEXT NOT NULL DEFAULT '',
  interaction_type TEXT NOT NULL DEFAULT 'aprofundar',
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_agent_interactions_meeting
  ON master_agent_interactions(meeting_id, id);

CREATE INDEX IF NOT EXISTS idx_master_agent_interactions_speaker
  ON master_agent_interactions(speaker_key, created_at DESC);

CREATE TABLE IF NOT EXISTS master_project_memory_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  record_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  confidence INTEGER NOT NULL DEFAULT 50,
  source_note TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_text TEXT NOT NULL DEFAULT '',
  review_condition TEXT NOT NULL DEFAULT '',
  meeting_id INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'council',
  fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_project_memory_fingerprint
  ON master_project_memory_records(project_key, fingerprint);

CREATE INDEX IF NOT EXISTS idx_master_project_memory_type
  ON master_project_memory_records(project_key, record_type, created_at DESC);

CREATE TABLE IF NOT EXISTS master_council_runs (
  meeting_id INTEGER PRIMARY KEY,
  chair_key TEXT NOT NULL DEFAULT 'hakham',
  requested_turns INTEGER NOT NULL DEFAULT 6,
  completed_turns INTEGER NOT NULL DEFAULT 0,
  distinct_speakers INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  memory_records_added INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL DEFAULT 0
);
