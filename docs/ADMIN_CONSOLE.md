# SER comtec | Central de Operações

Domínio: `https://app.sercomtec.com.br`

## Objetivo

A área administrativa evolui de um painel do site para uma Central de Operações: CMS, CRM, suporte, portfólio, produtos, usuários, arquivos e integrações. A arquitetura mantém espaço para que SERhub, NegocIAJá, SER IA MASTER e projetos futuros sejam conectados gradualmente por APIs/eventos.

## Segurança

A proteção usa duas camadas:

1. **Cloudflare Access** protege o hostname externo `app.sercomtec.com.br`.
2. **Autenticação interna SER comtec** usa usuários individuais, PBKDF2-SHA256 com salt por usuário e sessões HttpOnly/Secure/SameSite=Strict.

O primeiro usuário `super_admin` é criado pelo próprio login personalizado. O bootstrap só é aceito quando a identidade Cloudflare Access é validada e ainda não existe usuário local.

Variáveis do Worker:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `RESEND_API_KEY` para notificações de e-mail
- `RESEND_FROM` opcional, padrão `SER comtec <atendimento@sercomtec.com.br>`
- `RESEND_SUPPORT_FROM` opcional, padrão `SER comtec Suporte <suporte@sercomtec.com.br>`

## Módulos

### Visão geral
Indicadores de leads, suporte, portfólio e saúde da infraestrutura.

### Leads
Dados recebidos do formulário do site, busca, status, responsável, observações e histórico. O lead continua gravado no D1, pode seguir para n8n e também gera notificação por Resend para `atendimento@sercomtec.com.br`.

### Portfólio
CRUD de projetos com categorias `projeto`, `site`, `sistema`, `automacao`, `ia`, `design` e `outro`. Suporta imagem no R2, tecnologias, cliente, link, destaque, publicação e ordenação. A página pública é `/portfolio.html`.

### Produtos
CRUD de nome, slug, tagline, descrição, logo, imagem, URL, CTA, estado e ordenação. O site público consulta `/api/public/products`.

### Conteúdo do site
Textos do Hero e informações de contato são armazenados em `admin_settings` e publicados por `/api/public/site-config`, preservando o layout aprovado.

### Políticas & termos
`privacidade` e `termos` ficam no D1 e são editáveis pelo painel. As páginas públicas carregam `/api/public/legal/:slug`.

### Suporte
Tickets ficam em `support_tickets`. O endpoint público `POST /api/support` pode criar tickets e notificar `suporte@sercomtec.com.br` via Resend.

### Arquivos
Uploads de imagens do CMS são gravados em `sercomtec-files` e servidos por `/media/*`.

### Usuários
Perfis disponíveis: `super_admin`, `admin`, `editor`, `suporte` e `viewer`.

### Integrações
A tabela `project_connectors` registra slots para SERhub, NegocIAJá, SER IA MASTER e futuros produtos. A ideia é conectar dados progressivamente, sem tornar o painel dependente de todos os sistemas ao mesmo tempo.

## Migrations

- `0001_leads.sql`: leads do site
- `0002_admin_console.sql`: histórico, suporte e settings
- `0003_cms_auth_portfolio.sql`: usuários, sessões, portfólio, produtos, documentos legais e conectores
- `0004_seed_legal_content.sql`: conteúdo institucional inicial das páginas legais

O deploy aplica migrations remotas antes de `wrangler deploy`.

## Endpoints públicos

- `POST /api/contact`
- `POST /api/support`
- `POST /api/chat`
- `GET /api/public/site-config`
- `GET /api/public/products`
- `GET /api/public/portfolio`
- `GET /api/public/legal/:slug`
- `GET /media/*`

## Autenticação local

- `GET /api/auth/status`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`

## Endpoints administrativos principais

- `GET /api/admin/session`
- `GET /api/admin/overview`
- `GET /api/admin/leads`
- `PATCH /api/admin/leads/:id`
- `GET /api/admin/tickets`
- `GET /api/admin/files`
- `GET|POST|PUT /api/admin/portfolio`
- `DELETE /api/admin/portfolio/:id`
- `GET|POST|PUT /api/admin/products`
- `GET|PUT /api/admin/site-settings`
- `GET|PUT /api/admin/legal`
- `GET|POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET|PUT /api/admin/connectors`
- `POST /api/admin/upload`
