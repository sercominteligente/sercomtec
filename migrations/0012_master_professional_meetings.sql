-- SER IA Master · Mesa profissional
-- Memória persistente por projeto, coordenação da reunião e contexto visual.

CREATE TABLE IF NOT EXISTS master_professional_meeting_meta (
  meeting_id INTEGER PRIMARY KEY,
  project_key TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  chair_key TEXT NOT NULL DEFAULT 'hakham',
  vision_context TEXT NOT NULL DEFAULT '',
  memory_context TEXT NOT NULL DEFAULT '',
  report_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_professional_meta_project
  ON master_professional_meeting_meta(project_key, created_at DESC);

CREATE TABLE IF NOT EXISTS master_project_memory (
  project_key TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  memory_text TEXT NOT NULL DEFAULT '',
  meeting_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS master_meeting_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  vision_summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_master_meeting_assets_meeting
  ON master_meeting_assets(meeting_id, id);
