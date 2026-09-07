CREATE TABLE IF NOT EXISTS master_agent_profiles (
  agent_key TEXT PRIMARY KEY,
  personality_prompt TEXT NOT NULL DEFAULT '',
  knowledge_prompt TEXT NOT NULL DEFAULT '',
  behavior_prompt TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS master_agent_prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_key TEXT NOT NULL,
  personality_prompt TEXT NOT NULL DEFAULT '',
  knowledge_prompt TEXT NOT NULL DEFAULT '',
  behavior_prompt TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_agent_prompt_versions_agent_created
  ON master_agent_prompt_versions(agent_key, created_at DESC);

CREATE TABLE IF NOT EXISTS master_observatory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messages_analyzed INTEGER NOT NULL DEFAULT 0,
  analysis_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_observatory_snapshots_created
  ON master_observatory_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS master_agent_learning_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_key TEXT NOT NULL,
  report_json TEXT NOT NULL DEFAULT '{}',
  messages_analyzed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_agent_learning_reports_agent_created
  ON master_agent_learning_reports(agent_key, created_at DESC);
