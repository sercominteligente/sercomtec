# SER comtec — Site Institucional V1

Implementação do template visual aprovado da SER comtec, preparada para GitHub + Cloudflare Workers Static Assets.

## O que está pronto

- Home responsiva fiel ao Master Visual V1.
- Identidade SER comtec aplicada com os PNGs transparentes oficiais.
- Hero institucional, faixa de confiança e três produtos principais.
- SERhub, NegocIAJá e SER IA MASTER como carros-chefe.
- SER IA MASTER apresentado também como agente operacional em grupos internos autorizados.
- Seção de automação sob medida e fluxo de trabalho 01–06.
- Formulário comercial funcional com endpoint `/api/contact`.
- Persistência de leads em D1 via binding `DB`.
- Fallback do formulário para WhatsApp quando o webhook externo não estiver configurado.
- Chat SER IA Assistente com endpoint `/api/chat`.
- Modo de demonstração local do chat quando `OPENAI_API_KEY` ainda não estiver configurada.
- Integração pronta com OpenAI Responses API quando a chave for adicionada no Cloudflare.
- R2 `sercomtec-files` configurado no binding `FILES` para arquivos futuros.
- SEO básico, JSON-LD, robots.txt e sitemap.xml.
- Páginas provisórias de Privacidade e Termos.
- Master visual e manual da marca mantidos como referência de projeto.

## Estrutura

```text
SER_COMTEC_SITE_V1/
├─ migrations/
│  └─ 0001_leads.sql
├─ site/
│  ├─ brand/
│  ├─ legal/
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ icons.svg
├─ worker/
│  └─ index.js
├─ wrangler.jsonc
├─ package.json
└─ README.md
```

## Rodar localmente

```bash
npm install
npm run dev
```

## Chat com OpenAI

Sem chave, o chat funciona em modo de demonstração. Para ativar IA real:

```bash
npx wrangler secret put OPENAI_API_KEY
```

Modelo padrão: `gpt-5.6-luna`.

## Leads / n8n

O endpoint `/api/contact` grava no D1 e pode, opcionalmente, espelhar o lead para n8n/CRM via:

```bash
npx wrangler secret put LEADS_WEBHOOK_URL
npx wrangler secret put CONTACT_WEBHOOK_TOKEN
```

`CONTACT_WEBHOOK_TOKEN` é opcional.

## Deploy

```bash
npm run deploy
```

Domínios previstos: `sercomtec.com.br`, `www.sercomtec.com.br` e `app.sercomtec.com.br`.

## Referência visual congelada

O Master Visual V1 aprovado continua sendo a especificação visual do projeto e deve ser usado nas revisões de fidelidade antes de cada publicação. Os arquivos pesados de referência não fazem parte do bundle público de produção.

## Infraestrutura oficial

- Worker: `sercomtec`
- D1: `sercomtec-db` (binding: `DB`)
- R2: `sercomtec-files` (binding: `FILES`)
- Site: `https://www.sercomtec.com.br`
- Área do Cliente: `https://app.sercomtec.com.br`

### D1

O Worker persiste os leads em `env.DB`. O binding do banco já está declarado no `wrangler.jsonc` e a migration inicial está em `migrations/0001_leads.sql`.

Aplicar a migration remota:

```bash
npx wrangler d1 migrations apply sercomtec-db --remote
```

## Pendências de produção

- Aplicar a migration remota do D1.
- Configurar `OPENAI_API_KEY` como secret do Worker.
- Definir webhook de leads/n8n quando desejado.
- Conectar URLs reais de cada produto.
- Revisar juridicamente Política de Privacidade e Termos de Uso.
- Substituir mockups internos por screenshots reais dos sistemas quando disponíveis.

---

## SER IA Master

A landing do SER IA Master roda em um Worker dedicado (`seriamaster`) usando `wrangler.master.jsonc`.

### Desenvolvimento local do Master

```bash
npm install
npm run dev:master
```

### Deploy do Master

```bash
npm run deploy:master
```

### Bate-papo das IAs

Rota pública:

```text
/bate-papo
```

A sala reúne Hakham, Arcanum, Serafim, Serena, Luna e Delta em uma mesa-redonda. Cada agente possui personalidade e especialidade próprias. Quando a conversa depende de fatos atuais, notícias, versões de software, produtos, empresas ou outros dados recentes, os agentes recebem acesso à ferramenta `web_search` da OpenAI Responses API e decidem automaticamente quando pesquisar. Para temas criativos ou conceituais, a busca pode ser dispensada para manter velocidade e custo sob controle.

O estado da sala e as mensagens são persistidos em D1. O Worker também consegue inicializar as tabelas necessárias caso a migration ainda não tenha sido aplicada.

### Secrets necessários no Worker `seriamaster`

Configure em produção como secrets, nunca como variáveis públicas versionadas:

- `OPENAI_API_KEY`: chave usada pelas conversas e pela busca na web.
- `MASTER_ADMIN_PASSWORD`: senha de acesso ao painel Super Admin do bate-papo.
- `MASTER_ADMIN_SESSION_SECRET`: segredo longo e aleatório usado para assinar a sessão administrativa. Se omitido, o Worker usa a própria senha administrativa como fallback de assinatura, mas o recomendado é configurar um segredo separado.

O modelo pode ser definido pela variável não secreta `OPENAI_MODEL`. O padrão atual é `gpt-5.6-luna`.

### Super Admin do Bate-papo

O Super Admin pode:

- abrir ou fechar a sala;
- liberar ou bloquear mensagens de visitantes;
- ativar ou pausar busca na web;
- selecionar quais agentes participam;
- mandar a mesa continuar o debate;
- limpar a conversa compartilhada.

Visitantes entram em modo observador por padrão. A participação pública só é habilitada quando o Super Admin autoriza. A sessão administrativa usa cookie `HttpOnly`, `Secure` e `SameSite=Strict` com duração de 12 horas.

### Personalidades dos agentes

- **Hakham:** estrategista provocador, orientado a métricas, riscos e execução.
- **Arcanum:** diretor de arte exigente, visual e avesso a soluções genéricas.
- **Serafim:** engenheiro pragmático, focado em produção, manutenção e arquitetura simples.
- **Serena:** comunicadora humana, focada em clareza, público, conteúdo e conexão.
- **Luna:** tutora curiosa e socrática, especializada em explicar e organizar ideias complexas.
- **Delta:** pesquisador cético, orientado a evidências, probabilidades e incertezas.

### Arquivos específicos do Master

- `site/master/`: landing do SER IA Master.
- `site/master/bate-papo/`: sala multiagente.
- `worker/master.js`: backend base do Master.
- `worker/master-live.js`: controlador da experiência multiagente, busca web e Super Admin.
- `migrations/0006_master_chat_rate_limit.sql`: rate limit público.
- `migrations/0007_master_roundtable.sql`: sala e mensagens do bate-papo.
- `wrangler.master.jsonc`: configuração exclusiva do Worker `seriamaster`.
