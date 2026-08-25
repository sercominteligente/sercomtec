-- SER comtec | Leads do formulário institucional
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'sercomtec.com.br',
  created_at TEXT NOT NULL,
  nome TEXT NOT NULL,
  empresa TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  segmento TEXT,
  interests_json TEXT NOT NULL DEFAULT '[]',
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  assigned_to TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp);
