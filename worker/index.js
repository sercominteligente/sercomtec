const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
});

const ADMIN_HOST = 'app.sercomtec.com.br';
const LEAD_STATUSES = new Set(['novo', 'contato', 'qualificado', 'proposta', 'ganho', 'perdido']);
let accessKeysCache = { url: '', keys: [], expires: 0 };

const AGENT_INSTRUCTIONS = `Você é o SER IA Assistente, agente oficial do site da SER comtec.

OBJETIVO
Atue como especialista em vendas e suporte técnico. Seja claro, profissional, consultivo e breve. Faça perguntas somente quando forem úteis. Nunca invente preços, prazos, integrações ou funcionalidades não confirmadas.

FORMATAÇÃO DO CHAT
- O chat público prioriza leitura limpa e direta.
- Não use sintaxe Markdown como **negrito**, __sublinhado__, títulos com #, crases ou tabelas.
- Para listas, use itens curtos iniciados por hífen ou numeração simples.
- Use parágrafos curtos e evite blocos excessivamente longos.
- Telefones, e-mails e endereços devem ser escritos normalmente, sem marcadores de formatação.

EMPRESA
SER comtec desenvolve tecnologia, inteligência artificial, automação e software. Também desenvolve automações sob medida conforme a necessidade, processo e segmento de cada cliente.
Site: www.sercomtec.com.br
Instagram: @ser.com.tec
WhatsApp: (85) 99166-5259
Atendimento: atendimento@sercomtec.com.br
Suporte: suporte@sercomtec.com.br

PRODUTOS PRINCIPAIS
1. SERhub: gestão inteligente para pequenos negócios. Centraliza clientes, produtos, serviços, orçamentos, pedidos, ordens de serviço, recibos, relatórios e operação em um único ambiente.
2. NegocIAJá: solução de vendas e atendimento conversacional. Une atendimento, catálogo, pedidos, pagamentos e inteligência artificial para ajudar empresas a vender mais.
3. SER IA MASTER: agente de IA para atendimento, vendas e suporte que também pode atuar, quando autorizado, nos grupos internos da empresa. Pode apoiar equipes com informações de produção, status de pedidos, relatórios e consultas operacionais, respeitando permissões e integrações disponíveis.
4. Automação sob medida: diagnóstico do processo, identificação de gargalos, projeto da solução, integração de sistemas, automação e evolução contínua.

REGRAS DE SUPORTE
- Se a dúvida depender de dados reais da conta, pedido, produção ou ambiente do cliente, diga claramente que o chat público não possui acesso automático a esses dados e encaminhe para suporte.
- Oriente o usuário a informar produto, contexto e mensagem de erro quando houver problema técnico.
- Nunca solicite senha, token, chave de API, código de autenticação ou dados bancários.

REGRAS COMERCIAIS
- Entenda o segmento e o processo que a pessoa quer melhorar.
- Quando houver encaixe, recomende o produto mais adequado e explique o motivo em linguagem simples.
- Quando o caso for específico, recomende automação personalizada.
- Ao identificar intenção de contratação, convide para falar com um especialista pelo WhatsApp (85) 99166-5259 ou atendimento@sercomtec.com.br.

Responda sempre em português do Brasil, salvo se o usuário pedir outro idioma.`;

function normalizeAssistantReply(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return normalizeAssistantReply(payload.output_text);
  if (!Array.isArray(payload?.output)) return '';
  const parts = [];
  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return normalizeAssistantReply(parts.join('\n'));
}

function demoReply(message) {
  const text = message.toLowerCase();
  if (text.includes('suporte') || text.includes('erro') || text.includes('problema')) return 'Posso ajudar a direcionar o suporte. Qual produto você está usando: SERhub, NegocIAJá ou SER IA MASTER? Se houver erro, envie também a mensagem exibida. Para atendimento humano: suporte@sercomtec.com.br ou WhatsApp (85) 99166-5259.';
  if (text.includes('serhub')) return 'O SERhub centraliza clientes, produtos, serviços, orçamentos, pedidos, ordens de serviço, recibos, relatórios e a operação do negócio em um único ambiente. Posso entender seu segmento e mostrar onde ele pode ajudar.';
  if (text.includes('negocia')) return 'O NegocIAJá é focado em transformar conversas em vendas, reunindo atendimento, catálogo, pedidos, pagamentos e IA. Quer me dizer como sua empresa vende hoje?';
  if (text.includes('master') || text.includes('grupo') || text.includes('produção')) return 'O SER IA MASTER atende clientes e também pode atuar em grupos internos autorizados, apoiando a equipe com status de pedidos, produção, relatórios e informações operacionais conforme as integrações e permissões configuradas.';
  if (text.includes('automação') || text.includes('automat')) return 'A SER comtec também desenvolve automações sob medida. Primeiro entendemos o processo e os gargalos; depois projetamos integrações e fluxos de IA adequados ao seu segmento. O que você gostaria de automatizar hoje?';
  return 'A SER comtec trabalha com SERhub, NegocIAJá, SER IA MASTER e automações personalizadas. Posso ajudá-lo a escolher a solução mais adequada. Qual é o seu segmento e o principal processo que você quer melhorar?';
}

async function handleChat(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const clean = messages
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1500) }))
    .filter((m) => m.content);
  const lastUser = [...clean].reverse().find((m) => m.role === 'user');
  if (!lastUser) return json({ error: 'Envie uma mensagem para continuar.' }, 400);
  if (!env.OPENAI_API_KEY) return json({ reply: demoReply(lastUser.content), mode: 'demo' });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-5.6-luna', instructions: AGENT_INSTRUCTIONS, input: clean, max_output_tokens: 450 }),
  });
  if (!response.ok) {
    console.error('OpenAI error', response.status, await response.text());
    return json({ error: 'O assistente está temporariamente indisponível. Fale com nossa equipe pelo WhatsApp (85) 99166-5259.' }, 502);
  }
  const payload = await response.json();
  const reply = extractResponseText(payload);
  return json({ reply: reply || demoReply(lastUser.content), mode: 'ai' });
}

function normalizePhone(value) { return value.replace(/\D/g, '').slice(0, 15); }

async function handleContact(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Requisição inválida.' }, 400); }
  if (body.website) return json({ ok: true });

  const nome = String(body.nome || '').trim().slice(0, 100);
  const empresa = String(body.empresa || '').trim().slice(0, 120);
  const whatsapp = normalizePhone(String(body.whatsapp || ''));
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  const segmento = String(body.segmento || '').trim().slice(0, 140);
  const mensagem = String(body.mensagem || '').trim().slice(0, 2500);
  const interests = Array.isArray(body.interests) ? body.interests.map(String).slice(0, 8) : [];
  if (!nome || whatsapp.length < 10 || !email.includes('@') || !mensagem) return json({ ok: false, error: 'Preencha nome, WhatsApp, e-mail e mensagem.' }, 400);

  const lead = { source: 'sercomtec.com.br', createdAt: new Date().toISOString(), nome, empresa, whatsapp, email, segmento, interests, mensagem };
  let stored = false; let leadId = null;
  if (env.DB) {
    try {
      leadId = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO leads (id, source, created_at, nome, empresa, whatsapp, email, segmento, interests_json, mensagem, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo')`)
        .bind(leadId, lead.source, lead.createdAt, lead.nome, lead.empresa, lead.whatsapp, lead.email, lead.segmento, JSON.stringify(lead.interests), lead.mensagem).run();
      stored = true;
    } catch (error) { console.error('D1 lead storage failure', error); }
  }
  if (env.LEADS_WEBHOOK_URL) {
    const headers = { 'content-type': 'application/json' };
    if (env.CONTACT_WEBHOOK_TOKEN) headers.authorization = `Bearer ${env.CONTACT_WEBHOOK_TOKEN}`;
    try {
      const result = await fetch(env.LEADS_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(lead) });
      stored = stored || result.ok;
      if (!result.ok) console.error('Lead webhook error', result.status, await result.text());
    } catch (error) { console.error('Lead webhook failure', error); }
  }
  const waText = [`Olá, sou ${nome}${empresa ? ` da ${empresa}` : ''}.`, interests.length ? `Tenho interesse em: ${interests.join(', ')}.` : '', segmento ? `Segmento: ${segmento}.` : '', `Necessidade: ${mensagem}`].filter(Boolean).join('\n');
  return json({ ok: true, stored, leadId, whatsappUrl: `https://wa.me/5585991665259?text=${encodeURIComponent(waText)}` });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function parseJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessKeys(teamDomain) {
  const raw = String(teamDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!raw) throw new Error('Cloudflare Access Team Domain ausente.');
  const url = `https://${raw}/cdn-cgi/access/certs`;
  if (accessKeysCache.url === url && accessKeysCache.expires > Date.now()) return accessKeysCache.keys;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Falha ao obter chaves do Access: ${res.status}`);
  const data = await res.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  accessKeysCache = { url, keys, expires: Date.now() + 15 * 60 * 1000 };
  return keys;
}

function getAccessToken(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function authenticateAdmin(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== ADMIN_HOST) return { ok: false, status: 404, error: 'Não encontrado.' };
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return { ok: false, status: 503, error: 'Cloudflare Access ainda não configurado no Worker.' };
  const token = getAccessToken(request);
  if (!token) return { ok: false, status: 401, error: 'Sessão administrativa ausente.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, error: 'Token do Access inválido.' };
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = parseJwtPart(encodedHeader);
    const payload = parseJwtPart(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return { ok: false, status: 401, error: 'Sessão expirada.' };
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audience.includes(env.CF_ACCESS_AUD)) return { ok: false, status: 403, error: 'Audience do Access não autorizada.' };
    const keys = await getAccessKeys(env.CF_ACCESS_TEAM_DOMAIN);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return { ok: false, status: 401, error: 'Chave do Access não encontrada.' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(encodedSignature), signed);
    if (!valid) return { ok: false, status: 401, error: 'Assinatura do Access inválida.' };
    return { ok: true, user: { email: payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || 'administrador', sub: payload.sub || '' } };
  } catch (error) {
    console.error('Cloudflare Access verification failure', error);
    return { ok: false, status: 401, error: 'Não foi possível validar a sessão administrativa.' };
  }
}

function parseInterests(row) {
  try { return JSON.parse(row.interests_json || '[]'); } catch { return []; }
}

function mapLead(row) {
  return { ...row, interests: parseInterests(row) };
}

async function adminOverview(env) {
  const leadCounts = env.DB ? await env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='novo' THEN 1 ELSE 0 END) new_count FROM leads`).first() : { total: 0, new_count: 0 };
  const support = env.DB ? await env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status NOT IN ('resolvido','fechado') THEN 1 ELSE 0 END) open_count FROM support_tickets`).first() : { total: 0, open_count: 0 };
  const recent = env.DB ? await env.DB.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 6`).all() : { results: [] };
  let visibleFiles = 0;
  if (env.FILES) {
    try { visibleFiles = (await env.FILES.list({ limit: 100 })).objects.length; } catch {}
  }
  return json({
    ok: true,
    leads: { total: Number(leadCounts?.total || 0), new: Number(leadCounts?.new_count || 0) },
    support: { total: Number(support?.total || 0), open: Number(support?.open_count || 0) },
    files: { visible: visibleFiles },
    recentLeads: (recent.results || []).map(mapLead),
    health: { db: Boolean(env.DB), files: Boolean(env.FILES), openai: Boolean(env.OPENAI_API_KEY), webhook: Boolean(env.LEADS_WEBHOOK_URL) },
    openaiModel: env.OPENAI_MODEL || 'gpt-5.6-luna',
  });
}

async function adminLeads(request, env) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 100);
  const status = String(url.searchParams.get('status') || '').trim();
  const where = []; const values = [];
  if (q) { where.push('(nome LIKE ? OR empresa LIKE ? OR email LIKE ? OR whatsapp LIKE ?)'); const like = `%${q}%`; values.push(like, like, like, like); }
  if (status && LEAD_STATUSES.has(status)) { where.push('status = ?'); values.push(status); }
  const sql = `SELECT * FROM leads${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 250`;
  const result = await env.DB.prepare(sql).bind(...values).all();
  return json({ ok: true, items: (result.results || []).map(mapLead) });
}

async function updateAdminLead(request, env, user, id) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const status = String(body.status || '').trim();
  const notes = String(body.notes || '').trim().slice(0, 4000);
  if (!LEAD_STATUSES.has(status)) return json({ error: 'Status inválido.' }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE leads SET status=?, notes=?, updated_at=?, assigned_to=COALESCE(assigned_to, ?) WHERE id=?`).bind(status, notes, now, user.email, id).run();
  await env.DB.prepare(`INSERT INTO lead_activity (id, lead_id, type, note, actor_email, created_at) VALUES (?, ?, 'update', ?, ?, ?)`)
    .bind(crypto.randomUUID(), id, `Status: ${status}${notes ? ` | ${notes}` : ''}`.slice(0, 4000), user.email, now).run();
  const row = await env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(id).first();
  if (!row) return json({ error: 'Lead não encontrado.' }, 404);
  return json({ ok: true, item: mapLead(row) });
}

async function adminTickets(env) {
  const result = await env.DB.prepare(`SELECT * FROM support_tickets ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 200`).all();
  return json({ ok: true, items: result.results || [] });
}

async function adminFiles(env) {
  const result = await env.FILES.list({ limit: 100 });
  return json({ ok: true, truncated: result.truncated, items: result.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded?.toISOString?.() || o.uploaded || null, etag: o.etag })) });
}

async function handleAdminApi(request, env) {
  const auth = await authenticateAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const url = new URL(request.url);
  if (url.pathname === '/api/admin/session') return json({ ok: true, user: auth.user });
  if (!env.DB && !url.pathname.endsWith('/files')) return json({ error: 'D1 indisponível.' }, 503);
  if (url.pathname === '/api/admin/overview' && request.method === 'GET') return adminOverview(env);
  if (url.pathname === '/api/admin/leads' && request.method === 'GET') return adminLeads(request, env);
  const leadMatch = url.pathname.match(/^\/api\/admin\/leads\/([^/]+)$/);
  if (leadMatch && request.method === 'PATCH') return updateAdminLead(request, env, auth.user, decodeURIComponent(leadMatch[1]));
  if (url.pathname === '/api/admin/tickets' && request.method === 'GET') return adminTickets(env);
  if (url.pathname === '/api/admin/files' && request.method === 'GET') {
    if (!env.FILES) return json({ error: 'R2 indisponível.' }, 503);
    return adminFiles(env);
  }
  return json({ error: 'Endpoint administrativo não encontrado.' }, 404);
}

async function serveAdminAsset(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/brand/') || url.pathname === '/icons.svg') {
    return env.ASSETS.fetch(request);
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/admin/index.html';
  return env.ASSETS.fetch(new Request(assetUrl.toString(), { headers: request.headers }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') return json({
      ok: true,
      service: 'ser-comtec-site',
      time: new Date().toISOString(),
      bindings: { db: Boolean(env.DB), files: Boolean(env.FILES), openai: Boolean(env.OPENAI_API_KEY) },
    });

    if (url.pathname.startsWith('/api/admin/')) return handleAdminApi(request, env);

    if (url.pathname === '/api/chat') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return handleChat(request, env);
    }

    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);
      return handleContact(request, env);
    }

    if (url.hostname === ADMIN_HOST) return serveAdminAsset(request, env);
    return env.ASSETS.fetch(request);
  },
};
