CREATE TABLE IF NOT EXISTS master_roundtable_autopilot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  next_at INTEGER NOT NULL DEFAULT 0,
  last_speaker TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO master_roundtable_autopilot
  (id, enabled, interval_seconds, next_at, last_speaker, updated_at)
VALUES
  (1, 0, 30, 0, '', 0);
