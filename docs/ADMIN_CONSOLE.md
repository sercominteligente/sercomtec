# SER comtec | Área administrativa

Domínio administrativo: `https://app.sercomtec.com.br`

## Segurança

As APIs em `/api/admin/*` validam o JWT emitido pelo Cloudflare Access. A interface pode carregar sem dados, mas nenhum dado administrativo é liberado sem validação do token.

Configure no Worker:

- `CF_ACCESS_TEAM_DOMAIN`: domínio da equipe do Cloudflare Access, por exemplo `sua-equipe.cloudflareaccess.com`.
- `CF_ACCESS_AUD`: Application Audience (AUD) da aplicação Access criada para `app.sercomtec.com.br`.

A aplicação do Cloudflare Access deve proteger o hostname `app.sercomtec.com.br` e permitir apenas os e-mails/identidades administrativas autorizadas.

## Módulos V1

- Visão geral: indicadores de leads, suporte, R2 e integrações.
- Leads: consulta, filtro, busca, alteração de status e observações.
- Suporte: listagem de tickets.
- Arquivos: listagem do bucket `sercomtec-files`.
- IA & automações: status do SER IA Assistente e webhook de leads.
- Produtos: visão dos produtos publicados.
- Conteúdo do site: dados institucionais em modo protegido/read-only nesta fase.
- Integrações: D1, R2, OpenAI e webhook/n8n.
- Configurações: visão da arquitetura e segurança.

## D1

A migration `0002_admin_console.sql` cria:

- `lead_activity`
- `support_tickets`
- `admin_settings`

O comando de deploy atual aplica as migrations remotas antes de executar `wrangler deploy`.

## Endpoints administrativos

- `GET /api/admin/session`
- `GET /api/admin/overview`
- `GET /api/admin/leads`
- `PATCH /api/admin/leads/:id`
- `GET /api/admin/tickets`
- `GET /api/admin/files`

Todos exigem Cloudflare Access válido e só respondem no hostname `app.sercomtec.com.br`.
