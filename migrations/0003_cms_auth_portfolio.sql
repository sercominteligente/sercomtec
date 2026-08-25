-- SER comtec | CMS, portfólio, produtos e autenticação local

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'editor',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 310000,
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  user_agent TEXT,
  ip_hint TEXT,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'projeto',
  summary TEXT,
  description TEXT,
  technologies_json TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  gallery_json TEXT NOT NULL DEFAULT '[]',
  project_url TEXT,
  client_name TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_portfolio_published ON portfolio_items(published, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio_items(category, published);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  image_url TEXT,
  site_url TEXT,
  cta_label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active, sort_order);

INSERT OR IGNORE INTO products (id, slug, name, tagline, description, logo_url, site_url, cta_label, active, featured, sort_order, created_at)
VALUES
('prod-serhub','serhub','SERhub','Gestão inteligente para o seu negócio','Centralize clientes, produtos, serviços, orçamentos, pedidos, ordens de serviço, financeiro e operação em um único ambiente.','/brand/icon-192.png',NULL,'Conhecer SERhub',1,1,10,datetime('now')),
('prod-negociaja','negociaja','NegocIAJá','Transforme conversas em vendas','Atendimento, catálogo, pedidos, pagamentos e inteligência artificial trabalhando juntos para ajudar empresas a vender mais.','https://negociaja.com.br/logo-primary.png','https://negociaja.com.br','Conhecer NegocIAJá',1,1,20,datetime('now')),
('prod-seriamaster','ser-ia-master','SER IA MASTER','IA que atende, informa e trabalha com você','Atenda clientes e participe dos grupos da sua empresa informando status de pedidos, produção, relatórios e muito mais.','/brand/icon-192.png',NULL,'Conhecer SER IA MASTER',1,1,30,datetime('now'));

CREATE TABLE IF NOT EXISTS legal_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
INSERT OR IGNORE INTO legal_documents (slug, title, content, published, updated_at)
VALUES
('privacidade','Política de Privacidade','Conteúdo em revisão. Atualize este documento pelo painel administrativo.',1,datetime('now')),
('termos','Termos de Uso','Conteúdo em revisão. Atualize este documento pelo painel administrativo.',1,datetime('now'));

CREATE TABLE IF NOT EXISTS project_connectors (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal',
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'planejado',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
INSERT OR IGNORE INTO project_connectors (id, slug, name, type, base_url, status, capabilities_json, created_at)
VALUES
('connector-serhub','serhub','SERhub','product',NULL,'planejado','["clientes","pedidos","relatorios","operacao"]',datetime('now')),
('connector-negociaja','negociaja','NegocIAJá','product','https://negociaja.com.br','planejado','["vendas","conversas","pedidos","catalogo"]',datetime('now')),
('connector-seriamaster','ser-ia-master','SER IA MASTER','agent',NULL,'planejado','["grupos","relatorios","suporte","operacao"]',datetime('now'));

INSERT OR IGNORE INTO admin_settings (key, value_json, updated_at, updated_by)
VALUES
('site.contact','{"whatsapp":"85991665259","phone":"(85) 99166-5259","instagram":"@ser.com.tec","email":"atendimento@sercomtec.com.br","support_email":"suporte@sercomtec.com.br"}',datetime('now'),'migration'),
('site.hero','{"eyebrow":"INTELIGÊNCIA • AUTOMAÇÃO • RESULTADOS","title":"Tecnologia que trabalha","highlight":"pelo seu negócio.","lead":"Soluções em inteligência artificial, automação e software para transformar processos, atendimento e vendas.","body":"Criamos produtos próprios e desenvolvemos automações personalizadas de acordo com a realidade de cada empresa."}',datetime('now'),'migration');
