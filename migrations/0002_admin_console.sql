-- SER comtec | Estrutura operacional da área administrativa
CREATE TABLE IF NOT EXISTS lead_activity (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  note TEXT,
  actor_email TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  requester_name TEXT NOT NULL,
  requester_email TEXT,
  requester_whatsapp TEXT,
  product TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_product ON support_tickets(product);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
