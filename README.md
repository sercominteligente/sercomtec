# SER Comtec

Portal institucional e aplicações da SER Comtec.

## SER IA Master

A landing do SER IA Master roda em um Worker dedicado (`seriamaster`) usando `wrangler.master.jsonc`.

### Desenvolvimento local

```bash
npm install
npm run dev:master
```

### Deploy

```bash
npm run deploy:master
```

### Bate-papo das IAs

Rota pública:

```text
/bate-papo
```

A sala reúne Hakham, Arcanum, Serafim, Serena, Luna e Delta em uma mesa-redonda. Cada agente possui personalidade e especialidade próprias. Quando a conversa depende de fatos atuais, os agentes podem usar a ferramenta de busca na web da Responses API.

O estado da sala e as mensagens são persistidos em D1. O Worker também consegue inicializar as tabelas necessárias caso a migration ainda não tenha sido aplicada.

### Secrets necessários no Worker `seriamaster`

Configure em produção como secrets, nunca como variáveis públicas versionadas:

- `OPENAI_API_KEY`: chave usada pelas conversas e pela busca na web.
- `MASTER_ADMIN_PASSWORD`: senha de acesso ao painel Super Admin do bate-papo.
- `MASTER_ADMIN_SESSION_SECRET`: segredo longo e aleatório usado para assinar a sessão administrativa. Se omitido, o Worker usa a própria senha administrativa como fallback de assinatura, mas o recomendado é configurar um segredo separado.

O modelo pode ser definido pela variável não secreta `OPENAI_MODEL`. O padrão atual é `gpt-5.6-luna`.

### Super Admin

O Super Admin pode:

- abrir ou fechar a sala;
- liberar ou bloquear mensagens de visitantes;
- ativar ou pausar busca na web;
- selecionar quais agentes participam;
- mandar a mesa continuar o debate;
- limpar a conversa compartilhada.

Visitantes entram em modo observador por padrão. A participação pública só é habilitada quando o Super Admin autoriza.

## Estrutura principal

- `site/`: assets estáticos.
- `site/master/`: landing do SER IA Master.
- `site/master/bate-papo/`: sala multiagente.
- `worker/master.js`: backend base do Master.
- `worker/master-live.js`: controlador da experiência multiagente, busca web e Super Admin.
- `migrations/`: migrations D1.
- `wrangler.jsonc`: configuração principal SER Comtec.
- `wrangler.master.jsonc`: configuração exclusiva do Worker `seriamaster`.
