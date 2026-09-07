-- SER IA Master · Memória Mestra Operacional e Auditável

CREATE TABLE IF NOT EXISTS master_project_memory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT NOT NULL UNIQUE,
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  experiment_key TEXT NOT NULL DEFAULT '',
  record_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  critical INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  author_key TEXT NOT NULL DEFAULT 'council',
  owner TEXT NOT NULL DEFAULT '',
  source_note TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  closure_condition TEXT NOT NULL DEFAULT '',
  next_review_text TEXT NOT NULL DEFAULT '',
  linked_items_json TEXT NOT NULL DEFAULT '[]',
  meeting_id INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_memory_item_fingerprint
  ON master_project_memory_items(project_key, fingerprint);

CREATE INDEX IF NOT EXISTS idx_master_memory_item_project_status
  ON master_project_memory_items(project_key, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_memory_item_project_type
  ON master_project_memory_items(project_key, record_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_memory_item_experiment
  ON master_project_memory_items(project_key, experiment_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS master_project_memory_item_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  item_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'council',
  meeting_id INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_memory_versions_item
  ON master_project_memory_item_versions(item_id, version DESC);

CREATE TABLE IF NOT EXISTS master_project_memory_operational_summary (
  project_key TEXT PRIMARY KEY,
  project_name TEXT NOT NULL DEFAULT '',
  summary_text TEXT NOT NULL DEFAULT '',
  active_items INTEGER NOT NULL DEFAULT 0,
  critical_items INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
