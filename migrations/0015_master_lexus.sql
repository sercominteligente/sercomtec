-- SER IA Master · Lexus specialist

CREATE TABLE IF NOT EXISTS master_lexus_settings (
  id INTEGER PRIMARY KEY CHECK (id=1),
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO master_lexus_settings (id, enabled, updated_at)
VALUES (1, 1, 0);
