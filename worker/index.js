const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  },
});

const ADMIN_HOST = 'app.sercomtec.com.br';
const SESSION_COOKIE = 'ser_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LEAD_STATUSES = new Set(['novo', 'contato', 'qualificado', 'proposta', 'ganho', 'perdido']);
const USER_ROLES = new Set(['super_admin', 'admin', 'editor', 'suporte', 'viewer']);
const PORTFOLIO_CATEGORIES = new Set(['projeto', 'site', 'sistema', 'automacao', 'ia', 'design', 'outro']);
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

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const safeJson = (value, fallback = []) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 15);
const normalizeEmail = (value) => text(value, 180).toLowerCase();
const slugify = (value) => text(value, 150).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const parseCookie = (request, key) => {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
};
const bytesToHex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const randomToken = (size = 32) => { const bytes = new Uint8Array(size); crypto.getRandomValues(bytes); return bytesToHex(bytes); };
const sha256Hex = async (value) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

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
  const value = message.toLowerCase();
  if (value.includes('suporte') || value.includes('erro') || value.includes('problema')) return 'Posso ajudar a direcionar o suporte. Qual produto você está usando: SERhub, NegocIAJá ou SER IA MASTER? Se houver erro, envie também a mensagem exibida. Para atendimento humano: suporte@sercomtec.com.br ou WhatsApp (85) 99166-5259.';
  if (value.includes('serhub')) return 'O SERhub centraliza clientes, produtos, serviços, orçamentos, pedidos, ordens de serviço, recibos, relatórios e a operação do negócio em um único ambiente. Posso entender seu segmento e mostrar onde ele pode ajudar.';
  if (value.includes('negocia')) return 'O NegocIAJá é focado em transformar conversas em vendas, reunindo atendimento, catálogo, pedidos, pagamentos e IA. Quer me dizer como sua empresa vende hoje?';
  if (value.includes('master') || value.includes('grupo') || value.includes('produção')) return 'O SER IA MASTER atende clientes e também pode atuar em grupos internos autorizados, apoiando a equipe com status de pedidos, produção, relatórios e informações operacionais conforme as integrações e permissões configuradas.';
  if (value.includes('automação') || value.includes('automat')) return 'A SER comtec também desenvolve automações sob medida. Primeiro entendemos o processo e os gargalos; depois projetamos integrações e fluxos de IA adequados ao seu segmento. O que você gostaria de automatizar hoje?';
  return 'A SER comtec trabalha com SERhub, NegocIAJá, SER IA MASTER e automações personalizadas. Posso ajudá-lo a escolher a solução mais adequada. Qual é o seu segmento e o principal processo que você quer melhorar?';
}

async function handleChat(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const clean = messages.filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .map(m => ({ role: m.role, content: text(m.content, 1500) })).filter(m => m.content);
  const lastUser = [...clean].reverse().find(m => m.role === 'user');
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
  return json({ reply: extractResponseText(payload) || demoReply(lastUser.content), mode: 'ai' });
}

async function sendResend(env, { to, subject, html, replyTo, from }) {
  if (!env.RESEND_API_KEY) return { ok: false, skipped: true, reason: 'RESEND_API_KEY ausente' };
  const payload = {
    from: from || env.RESEND_FROM || 'SER comtec <atendimento@sercomtec.com.br>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  if (!response.ok) console.error('Resend error', response.status, responseText);
  return { ok: response.ok, status: response.status };
}

async function handleContact(request, env) {
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Requisição inválida.' }, 400); }
  if (body.website) return json({ ok: true });
  const nome = text(body.nome, 100); const empresa = text(body.empresa, 120); const whatsapp = normalizePhone(body.whatsapp);
  const email = normalizeEmail(body.email); const segmento = text(body.segmento, 140); const mensagem = text(body.mensagem, 2500);
  const interests = Array.isArray(body.interests) ? body.interests.map(v => text(v, 80)).slice(0, 8) : [];
  if (!nome || whatsapp.length < 10 || !email.includes('@') || !mensagem) return json({ ok: false, error: 'Preencha nome, WhatsApp, e-mail e mensagem.' }, 400);
  const lead = { source: 'sercomtec.com.br', createdAt: nowIso(), nome, empresa, whatsapp, email, segmento, interests, mensagem };
  let stored = false; let leadId = null; let webhookSent = false;
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
      const result = await fetch(env.LEADS_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify({ ...lead, leadId }) });
      webhookSent = result.ok; if (!result.ok) console.error('Lead webhook error', result.status, await result.text());
    } catch (error) { console.error('Lead webhook failure', error); }
  }
  const emailHtml = `<div style="font-family:Arial,sans-serif;color:#17334f;line-height:1.55"><h2>Novo contato pelo site SER comtec</h2><p><b>Nome:</b> ${escapeHtml(nome)}</p><p><b>Empresa:</b> ${escapeHtml(empresa || 'Não informado')}</p><p><b>WhatsApp:</b> ${escapeHtml(whatsapp)}</p><p><b>E-mail:</b> ${escapeHtml(email)}</p><p><b>Segmento:</b> ${escapeHtml(segmento || 'Não informado')}</p><p><b>Interesse:</b> ${escapeHtml(interests.join(', ') || 'Não marcado')}</p><p><b>Mensagem:</b><br>${escapeHtml(mensagem).replace(/\n/g,'<br>')}</p><hr><small>Lead ${escapeHtml(leadId || 'sem-id')} • ${escapeHtml(lead.createdAt)}</small></div>`;
  const emailResult = await sendResend(env, { to: 'atendimento@sercomtec.com.br', subject: `Novo lead: ${nome}${empresa ? ` • ${empresa}` : ''}`, html: emailHtml, replyTo: email });
  const waText = [`Olá, sou ${nome}${empresa ? ` da ${empresa}` : ''}.`, interests.length ? `Tenho interesse em: ${interests.join(', ')}.` : '', segmento ? `Segmento: ${segmento}.` : '', `Necessidade: ${mensagem}`].filter(Boolean).join('\n');
  return json({ ok: true, stored, webhookSent, emailSent: emailResult.ok, leadId, whatsappUrl: `https://wa.me/5585991665259?text=${encodeURIComponent(waText)}` });
}

async function handleSupport(request, env) {
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Requisição inválida.' }, 400); }
  const name = text(body.name || body.nome, 100), email = normalizeEmail(body.email), whatsapp = normalizePhone(body.whatsapp);
  const product = text(body.product, 100), subject = text(body.subject || body.assunto, 180), message = text(body.message || body.mensagem, 3000);
  if (!name || !subject || !message || (!email && whatsapp.length < 10)) return json({ ok:false, error:'Preencha nome, assunto, mensagem e um contato.' },400);
  const id = crypto.randomUUID(), createdAt = nowIso();
  if (env.DB) await env.DB.prepare(`INSERT INTO support_tickets (id, created_at, requester_name, requester_email, requester_whatsapp, product, subject, message, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', 'normal')`).bind(id, createdAt, name, email, whatsapp, product, subject, message).run();
  const html = `<div style="font-family:Arial,sans-serif;color:#17334f"><h2>Novo chamado de suporte</h2><p><b>Solicitante:</b> ${escapeHtml(name)}</p><p><b>Produto:</b> ${escapeHtml(product || 'Não informado')}</p><p><b>Assunto:</b> ${escapeHtml(subject)}</p><p><b>Mensagem:</b><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p><p><b>Contato:</b> ${escapeHtml(email || whatsapp)}</p></div>`;
  const mail = await sendResend(env, { to:'suporte@sercomtec.com.br', from: env.RESEND_SUPPORT_FROM || 'SER comtec Suporte <suporte@sercomtec.com.br>', subject:`Suporte: ${subject}`, html, replyTo: email || undefined });
  return json({ ok:true, ticketId:id, emailSent:mail.ok });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized); return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function parseJwtPart(value) { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))); }
async function getAccessKeys(teamDomain) {
  const raw = String(teamDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!raw) throw new Error('Cloudflare Access Team Domain ausente.');
  const url = `https://${raw}/cdn-cgi/access/certs`;
  if (accessKeysCache.url === url && accessKeysCache.expires > Date.now()) return accessKeysCache.keys;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Falha ao obter chaves do Access: ${res.status}`);
  const data = await res.json(); const keys = Array.isArray(data.keys) ? data.keys : [];
  accessKeysCache = { url, keys, expires: Date.now() + 15 * 60 * 1000 }; return keys;
}
function getAccessToken(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion'); if (header) return header;
  return parseCookie(request, 'CF_Authorization');
}
async function authenticateAccess(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== ADMIN_HOST) return { ok:false,status:404,error:'Não encontrado.' };
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return { ok:false,status:503,error:'Cloudflare Access não configurado.' };
  const token = getAccessToken(request); if (!token) return { ok:false,status:401,error:'Sessão do Cloudflare Access ausente.' };
  const parts = token.split('.'); if (parts.length !== 3) return { ok:false,status:401,error:'Token do Access inválido.' };
  try {
    const [eh, ep, es] = parts; const header = parseJwtPart(eh); const payload = parseJwtPart(ep); const now = Math.floor(Date.now()/1000);
    if (!payload.exp || payload.exp < now) return { ok:false,status:401,error:'Sessão do Access expirada.' };
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audience.includes(env.CF_ACCESS_AUD)) return { ok:false,status:403,error:'Audience do Access não autorizada.' };
    const keys = await getAccessKeys(env.CF_ACCESS_TEAM_DOMAIN); const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return { ok:false,status:401,error:'Chave do Access não encontrada.' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(es), new TextEncoder().encode(`${eh}.${ep}`));
    if (!valid) return { ok:false,status:401,error:'Assinatura do Access inválida.' };
    return { ok:true, user:{ email: payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || '', sub:payload.sub || '' } };
  } catch (error) { console.error('Access verification failure', error); return { ok:false,status:401,error:'Não foi possível validar o Cloudflare Access.' }; }
}

async function passwordHash(password, saltHex, iterations = 310000) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g) || [], h => parseInt(h, 16));
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations, hash:'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
function validPassword(password) { return typeof password === 'string' && password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password); }
async function userCount(env) { const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM admin_users').first(); return Number(row?.total || 0); }
async function createSession(request, env, userId) {
  const token = randomToken(32), tokenHash = await sha256Hex(token), id = crypto.randomUUID(), created = nowIso(), expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO admin_sessions (id,user_id,token_hash,created_at,expires_at,last_seen_at,user_agent,ip_hint) VALUES (?,?,?,?,?,?,?,?)`).bind(id,userId,tokenHash,created,expires,created,text(request.headers.get('user-agent'),300),text(request.headers.get('CF-Connecting-IP'),80)).run();
  return { token, expires };
}
async function getLocalSession(request, env) {
  if (!env.DB) return null; const token = parseCookie(request, SESSION_COOKIE); if (!token) return null;
  const tokenHash = await sha256Hex(token); const row = await env.DB.prepare(`SELECT s.id session_id,s.expires_at,u.id,u.name,u.email,u.role,u.active FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? LIMIT 1`).bind(tokenHash).first();
  if (!row || !row.active || new Date(row.expires_at).getTime() <= Date.now()) { if (row?.session_id) await env.DB.prepare('DELETE FROM admin_sessions WHERE id=?').bind(row.session_id).run(); return null; }
  env.DB.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE id=?').bind(nowIso(), row.session_id).run().catch(()=>{});
  return { sessionId:row.session_id, id:row.id, name:row.name, email:row.email, role:row.role };
}
const sessionCookie = (token, maxAge = SESSION_TTL_SECONDS) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
async function requireLocalAdmin(request, env, roles = null) {
  const user = await getLocalSession(request, env); if (!user) return { ok:false,status:401,error:'Faça login na área administrativa.' };
  if (roles && !roles.includes(user.role)) return { ok:false,status:403,error:'Seu perfil não possui permissão para esta ação.' };
  return { ok:true,user };
}

async function authStatus(request, env) {
  const total = await userCount(env); const user = await getLocalSession(request, env); const access = await authenticateAccess(request, env);
  return json({ ok:true, bootstrapRequired: total === 0, authenticated:Boolean(user), user, access:{ ok:access.ok, email:access.user?.email || '' } });
}
async function authBootstrap(request, env) {
  if (await userCount(env) > 0) return json({ error:'O administrador inicial já foi criado.' },409);
  const access = await authenticateAccess(request, env); if (!access.ok) return json({ error:access.error },access.status);
  let body; try { body = await request.json(); } catch { return json({error:'Dados inválidos.'},400); }
  const name = text(body.name,100), email = normalizeEmail(body.email || access.user.email), password = body.password;
  if (!name || !email.includes('@') || !validPassword(password)) return json({error:'Use nome, e-mail válido e senha com pelo menos 10 caracteres, letras e números.'},400);
  const salt = randomToken(16), iterations = 310000, hash = await passwordHash(password,salt,iterations), id = crypto.randomUUID(), created = nowIso();
  await env.DB.prepare(`INSERT INTO admin_users (id,name,email,role,password_hash,password_salt,password_iterations,active,created_at,created_by) VALUES (?,?,?,'super_admin',?,?,?,1,?,?)`).bind(id,name,email,hash,salt,iterations,created,access.user.email || email).run();
  const session = await createSession(request,env,id);
  return json({ok:true,user:{id,name,email,role:'super_admin'}},200,{ 'set-cookie':sessionCookie(session.token) });
}
async function authLogin(request, env) {
  let body; try { body=await request.json(); } catch { return json({error:'Dados inválidos.'},400); }
  const email=normalizeEmail(body.email), password=String(body.password || ''); const row=await env.DB.prepare('SELECT * FROM admin_users WHERE email=? LIMIT 1').bind(email).first();
  if (!row || !row.active) return json({error:'E-mail ou senha inválidos.'},401);
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return json({error:'Conta temporariamente bloqueada. Aguarde alguns minutos.'},429);
  const hash=await passwordHash(password,row.password_salt,Number(row.password_iterations || 310000));
  if (hash !== row.password_hash) {
    const failed=Number(row.failed_attempts || 0)+1; const locked=failed>=6 ? new Date(Date.now()+15*60*1000).toISOString() : null;
    await env.DB.prepare('UPDATE admin_users SET failed_attempts=?, locked_until=?, updated_at=? WHERE id=?').bind(failed,locked,nowIso(),row.id).run();
    return json({error:'E-mail ou senha inválidos.'},401);
  }
  await env.DB.prepare('UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login_at=?, updated_at=? WHERE id=?').bind(nowIso(),nowIso(),row.id).run();
  const session=await createSession(request,env,row.id);
  return json({ok:true,user:{id:row.id,name:row.name,email:row.email,role:row.role}},200,{ 'set-cookie':sessionCookie(session.token) });
}
async function authLogout(request, env) {
  const user=await getLocalSession(request,env); if(user) await env.DB.prepare('DELETE FROM admin_sessions WHERE id=?').bind(user.sessionId).run();
  return json({ok:true},200,{ 'set-cookie':sessionCookie('',0) });
}

function parseInterests(row) { return safeJson(row.interests_json,[]); }
function mapLead(row) { return { ...row, interests:parseInterests(row) }; }
function mapPortfolio(row) { return { ...row, technologies:safeJson(row.technologies_json,[]), gallery:safeJson(row.gallery_json,[]), featured:Boolean(row.featured), published:Boolean(row.published) }; }
function mapProduct(row) { return { ...row, active:Boolean(row.active), featured:Boolean(row.featured) }; }

async function publicSiteConfig(env) {
  const rows=await env.DB.prepare(`SELECT key,value_json FROM admin_settings WHERE key IN ('site.contact','site.hero')`).all(); const result={};
  for(const row of rows.results || []) result[row.key]=safeJson(row.value_json,{});
  return json({ok:true,contact:result['site.contact'] || {},hero:result['site.hero'] || {}});
}
async function publicProducts(env) { const rows=await env.DB.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort_order ASC,name ASC').all(); return json({ok:true,items:(rows.results||[]).map(mapProduct)}); }
async function publicPortfolio(request, env) {
  const url=new URL(request.url), category=text(url.searchParams.get('category'),40); let query='SELECT * FROM portfolio_items WHERE published=1', params=[];
  if(category){query+=' AND category=?';params.push(category);} query+=' ORDER BY featured DESC,sort_order ASC,created_at DESC LIMIT 100';
  const rows=await env.DB.prepare(query).bind(...params).all(); return json({ok:true,items:(rows.results||[]).map(mapPortfolio)});
}
async function publicLegal(slug, env) { const row=await env.DB.prepare('SELECT slug,title,content,updated_at FROM legal_documents WHERE slug=? AND published=1').bind(slug).first(); return row?json({ok:true,item:row}):json({error:'Documento não encontrado.'},404); }

async function adminOverview(env) {
  const [leadTotals,ticketTotals,users,portfolio] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='novo' THEN 1 ELSE 0 END) new_count FROM leads`).first(),
    env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status NOT IN ('resolvido','fechado') THEN 1 ELSE 0 END) open_count FROM support_tickets`).first(),
    env.DB.prepare(`SELECT COUNT(*) total FROM admin_users WHERE active=1`).first(),
    env.DB.prepare(`SELECT COUNT(*) total FROM portfolio_items WHERE published=1`).first(),
  ]);
  const recent=await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 6').all();
  let fileCount=0; if(env.FILES){try{const listed=await env.FILES.list({limit:1000});fileCount=listed.objects.length;}catch{}}
  return json({ok:true,leads:{total:Number(leadTotals?.total||0),new:Number(leadTotals?.new_count||0)},support:{total:Number(ticketTotals?.total||0),open:Number(ticketTotals?.open_count||0)},users:{total:Number(users?.total||0)},portfolio:{total:Number(portfolio?.total||0)},files:{visible:fileCount},recentLeads:(recent.results||[]).map(mapLead),health:{db:Boolean(env.DB),files:Boolean(env.FILES),openai:Boolean(env.OPENAI_API_KEY),webhook:Boolean(env.LEADS_WEBHOOK_URL),resend:Boolean(env.RESEND_API_KEY)},openaiModel:env.OPENAI_MODEL||'gpt-5.6-luna'});
}
async function adminLeads(request, env) {
  const url=new URL(request.url), q=text(url.searchParams.get('q'),100), status=text(url.searchParams.get('status'),40); let sql='SELECT * FROM leads WHERE 1=1', params=[];
  if(q){sql+=' AND (nome LIKE ? OR empresa LIKE ? OR email LIKE ? OR whatsapp LIKE ?)';const like=`%${q}%`;params.push(like,like,like,like);} if(status&&LEAD_STATUSES.has(status)){sql+=' AND status=?';params.push(status);} sql+=' ORDER BY created_at DESC LIMIT 300';
  const rows=await env.DB.prepare(sql).bind(...params).all(); return json({ok:true,items:(rows.results||[]).map(mapLead)});
}
async function adminUpdateLead(request, env, id, user) {
  let body; try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const current=await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if(!current)return json({error:'Lead não encontrado.'},404);
  const status=LEAD_STATUSES.has(body.status)?body.status:current.status, notes=text(body.notes ?? current.notes,3000), assigned=text(body.assigned_to ?? current.assigned_to,180), updated=nowIso();
  await env.DB.prepare('UPDATE leads SET status=?,notes=?,assigned_to=?,updated_at=? WHERE id=?').bind(status,notes,assigned,updated,id).run();
  if(status!==current.status || notes!==String(current.notes||'')) await env.DB.prepare(`INSERT INTO lead_activity (id,lead_id,type,note,actor_email,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,status!==current.status?'status':'note',notes||`${current.status} → ${status}`,user.email,updated).run();
  const row=await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); return json({ok:true,item:mapLead(row)});
}
async function adminTickets(env) { const rows=await env.DB.prepare('SELECT * FROM support_tickets ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 300').all(); return json({ok:true,items:rows.results||[]}); }
async function adminFiles(env) { if(!env.FILES)return json({ok:true,items:[]}); const listed=await env.FILES.list({limit:500}); return json({ok:true,items:listed.objects.map(o=>({key:o.key,size:o.size,uploaded:o.uploaded,etag:o.etag}))}); }

async function adminPortfolio(request, env) {
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM portfolio_items ORDER BY sort_order ASC,created_at DESC').all();return json({ok:true,items:(rows.results||[]).map(mapPortfolio)});}
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const title=text(body.title,180), category=PORTFOLIO_CATEGORIES.has(body.category)?body.category:'projeto'; if(!title)return json({error:'Informe o título.'},400);
  const id=body.id?text(body.id,80):crypto.randomUUID(), slug=slugify(body.slug||title), timestamp=nowIso(), technologies=Array.isArray(body.technologies)?body.technologies.map(v=>text(v,60)).slice(0,30):[], gallery=Array.isArray(body.gallery)?body.gallery.map(v=>text(v,500)).slice(0,20):[];
  if(request.method==='POST') await env.DB.prepare(`INSERT INTO portfolio_items (id,slug,title,category,summary,description,technologies_json,image_url,gallery_json,project_url,client_name,featured,published,sort_order,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,slug,title,category,text(body.summary,400),text(body.description,6000),JSON.stringify(technologies),text(body.image_url,700),JSON.stringify(gallery),text(body.project_url,700),text(body.client_name,180),body.featured?1:0,body.published===false?0:1,Number(body.sort_order||100),timestamp,timestamp,body.actor||'admin').run();
  else await env.DB.prepare(`UPDATE portfolio_items SET slug=?,title=?,category=?,summary=?,description=?,technologies_json=?,image_url=?,gallery_json=?,project_url=?,client_name=?,featured=?,published=?,sort_order=?,updated_at=?,updated_by=? WHERE id=?`).bind(slug,title,category,text(body.summary,400),text(body.description,6000),JSON.stringify(technologies),text(body.image_url,700),JSON.stringify(gallery),text(body.project_url,700),text(body.client_name,180),body.featured?1:0,body.published===false?0:1,Number(body.sort_order||100),timestamp,body.actor||'admin',id).run();
  const row=await env.DB.prepare('SELECT * FROM portfolio_items WHERE id=?').bind(id).first();return json({ok:true,item:mapPortfolio(row)});
}
async function adminDeletePortfolio(env,id){await env.DB.prepare('DELETE FROM portfolio_items WHERE id=?').bind(id).run();return json({ok:true});}

async function adminProducts(request, env) {
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM products ORDER BY sort_order ASC,name ASC').all();return json({ok:true,items:(rows.results||[]).map(mapProduct)});}
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const name=text(body.name,160);if(!name)return json({error:'Informe o nome do produto.'},400);const id=body.id?text(body.id,80):crypto.randomUUID(),slug=slugify(body.slug||name),timestamp=nowIso();
  if(request.method==='POST') await env.DB.prepare(`INSERT INTO products (id,slug,name,tagline,description,logo_url,image_url,site_url,cta_label,active,featured,sort_order,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,slug,name,text(body.tagline,260),text(body.description,5000),text(body.logo_url,700),text(body.image_url,700),text(body.site_url,700),text(body.cta_label,120),body.active===false?0:1,body.featured===false?0:1,Number(body.sort_order||100),timestamp,timestamp,body.actor||'admin').run();
  else await env.DB.prepare(`UPDATE products SET slug=?,name=?,tagline=?,description=?,logo_url=?,image_url=?,site_url=?,cta_label=?,active=?,featured=?,sort_order=?,updated_at=?,updated_by=? WHERE id=?`).bind(slug,name,text(body.tagline,260),text(body.description,5000),text(body.logo_url,700),text(body.image_url,700),text(body.site_url,700),text(body.cta_label,120),body.active===false?0:1,body.featured===false?0:1,Number(body.sort_order||100),timestamp,body.actor||'admin',id).run();
  const row=await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first();return json({ok:true,item:mapProduct(row)});
}

async function adminLegal(request, env) {
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM legal_documents ORDER BY slug').all();return json({ok:true,items:rows.results||[]});}
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const slug=text(body.slug,80);if(!['privacidade','termos'].includes(slug))return json({error:'Documento inválido.'},400);
  await env.DB.prepare(`UPDATE legal_documents SET title=?,content=?,published=?,updated_at=?,updated_by=? WHERE slug=?`).bind(text(body.title,180),text(body.content,20000),body.published===false?0:1,nowIso(),text(body.actor,180)||'admin',slug).run(); const row=await env.DB.prepare('SELECT * FROM legal_documents WHERE slug=?').bind(slug).first();return json({ok:true,item:row});
}
async function adminSiteSettings(request, env) {
  if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT key,value_json FROM admin_settings WHERE key IN ('site.contact','site.hero')`).all();const values={};for(const row of rows.results||[])values[row.key]=safeJson(row.value_json,{});return json({ok:true,contact:values['site.contact']||{},hero:values['site.hero']||{}});}
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const updated=nowIso(),actor=text(body.actor,180)||'admin';
  if(body.contact) await env.DB.prepare(`INSERT INTO admin_settings (key,value_json,updated_at,updated_by) VALUES ('site.contact',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(JSON.stringify(body.contact),updated,actor).run();
  if(body.hero) await env.DB.prepare(`INSERT INTO admin_settings (key,value_json,updated_at,updated_by) VALUES ('site.hero',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(JSON.stringify(body.hero),updated,actor).run();
  return adminSiteSettings(new Request(request.url,{method:'GET'}),env);
}

async function adminUsers(request, env, current) {
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT id,name,email,role,active,last_login_at,created_at,updated_at FROM admin_users ORDER BY created_at ASC').all();return json({ok:true,items:(rows.results||[]).map(r=>({...r,active:Boolean(r.active)}))});}
  if(!['super_admin','admin'].includes(current.role))return json({error:'Sem permissão para gerenciar usuários.'},403);
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const name=text(body.name,100),email=normalizeEmail(body.email),role=USER_ROLES.has(body.role)?body.role:'editor',password=String(body.password||''); if(!name||!email.includes('@')||!validPassword(password))return json({error:'Informe nome, e-mail e senha com pelo menos 10 caracteres, letras e números.'},400);
  const id=crypto.randomUUID(),salt=randomToken(16),iterations=310000,hash=await passwordHash(password,salt,iterations),created=nowIso(); await env.DB.prepare(`INSERT INTO admin_users (id,name,email,role,password_hash,password_salt,password_iterations,active,created_at,created_by) VALUES (?,?,?,?,?,?,?,1,?,?)`).bind(id,name,email,role,hash,salt,iterations,created,current.email).run();return json({ok:true,item:{id,name,email,role,active:true}});
}
async function adminPatchUser(request, env, id, current) {
  if(!['super_admin','admin'].includes(current.role))return json({error:'Sem permissão.'},403);let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const row=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(id).first();if(!row)return json({error:'Usuário não encontrado.'},404);
  const name=text(body.name ?? row.name,100),role=USER_ROLES.has(body.role)?body.role:row.role,active=body.active===undefined?Number(row.active):(body.active?1:0),updated=nowIso();await env.DB.prepare('UPDATE admin_users SET name=?,role=?,active=?,updated_at=? WHERE id=?').bind(name,role,active,updated,id).run();
  if(body.password){if(!validPassword(body.password))return json({error:'A nova senha precisa ter pelo menos 10 caracteres, letras e números.'},400);const salt=randomToken(16),it=310000,hash=await passwordHash(body.password,salt,it);await env.DB.prepare('UPDATE admin_users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE id=?').bind(hash,salt,it,updated,id).run();await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=? AND id<>?').bind(id,current.sessionId||'').run();}
  return json({ok:true});
}

async function adminConnectors(request, env) {
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM project_connectors ORDER BY name').all();return json({ok:true,items:(rows.results||[]).map(r=>({...r,capabilities:safeJson(r.capabilities_json,[])}))});}
  let body;try{body=await request.json();}catch{return json({error:'Dados inválidos.'},400);} const id=text(body.id,80);if(!id)return json({error:'Conector inválido.'},400);await env.DB.prepare('UPDATE project_connectors SET base_url=?,status=?,notes=?,updated_at=?,updated_by=? WHERE id=?').bind(text(body.base_url,700),text(body.status,60)||'planejado',text(body.notes,3000),nowIso(),text(body.actor,180)||'admin',id).run();return json({ok:true});
}

async function adminUpload(request, env) {
  if(!env.FILES)return json({error:'R2 indisponível.'},503); const url=new URL(request.url),kind=slugify(url.searchParams.get('kind')||'uploads')||'uploads',filename=slugify(url.searchParams.get('name')||'arquivo')||'arquivo';const contentType=request.headers.get('content-type')||'application/octet-stream';
  if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(contentType))return json({error:'Envie uma imagem PNG, JPG, WEBP, GIF ou SVG.'},415);const buffer=await request.arrayBuffer();if(buffer.byteLength>8*1024*1024)return json({error:'Imagem acima de 8 MB.'},413);
  const ext=contentType.includes('png')?'png':contentType.includes('jpeg')?'jpg':contentType.includes('webp')?'webp':contentType.includes('gif')?'gif':'svg';const key=`cms/${kind}/${Date.now()}-${filename}.${ext}`;await env.FILES.put(key,buffer,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'}});return json({ok:true,key,url:`/media/${key}`});
}

async function serveMedia(url, env) { if(!env.FILES)return new Response('Not Found',{status:404});const key=decodeURIComponent(url.pathname.replace(/^\/media\//,''));const object=await env.FILES.get(key);if(!object)return new Response('Not Found',{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('cache-control',headers.get('cache-control')||'public, max-age=3600');return new Response(object.body,{headers}); }

async function handleAdminApi(request, env, url) {
  const auth=await requireLocalAdmin(request,env);if(!auth.ok)return json({error:auth.error},auth.status);const user=auth.user;
  if(url.pathname==='/api/admin/session')return json({ok:true,user});
  if(url.pathname==='/api/admin/overview')return adminOverview(env);
  if(url.pathname==='/api/admin/leads'&&request.method==='GET')return adminLeads(request,env);
  const leadMatch=url.pathname.match(/^\/api\/admin\/leads\/([^/]+)$/);if(leadMatch&&request.method==='PATCH')return adminUpdateLead(request,env,decodeURIComponent(leadMatch[1]),user);
  if(url.pathname==='/api/admin/tickets'&&request.method==='GET')return adminTickets(env);
  if(url.pathname==='/api/admin/files'&&request.method==='GET')return adminFiles(env);
  if(url.pathname==='/api/admin/portfolio'&&['GET','POST','PUT'].includes(request.method)){const req= request.method==='PUT'?new Request(request,{method:'PUT'}):request; const bodyMethod=request.method==='PUT'?'PUT':request.method; return adminPortfolio(req,env,bodyMethod);}
  const portfolioMatch=url.pathname.match(/^\/api\/admin\/portfolio\/([^/]+)$/);if(portfolioMatch&&request.method==='DELETE')return adminDeletePortfolio(env,decodeURIComponent(portfolioMatch[1]));
  if(url.pathname==='/api/admin/products'&&['GET','POST','PUT'].includes(request.method))return adminProducts(request,env);
  if(url.pathname==='/api/admin/legal'&&['GET','PUT'].includes(request.method))return adminLegal(request,env);
  if(url.pathname==='/api/admin/site-settings'&&['GET','PUT'].includes(request.method))return adminSiteSettings(request,env);
  if(url.pathname==='/api/admin/users'&&['GET','POST'].includes(request.method))return adminUsers(request,env,user);
  const userMatch=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);if(userMatch&&request.method==='PATCH')return adminPatchUser(request,env,decodeURIComponent(userMatch[1]),user);
  if(url.pathname==='/api/admin/connectors'&&['GET','PUT'].includes(request.method))return adminConnectors(request,env);
  if(url.pathname==='/api/admin/upload'&&request.method==='POST')return adminUpload(request,env);
  return json({error:'Rota administrativa não encontrada.'},404);
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);

    if(url.pathname==='/api/health')return json({ok:true,service:'ser-comtec-site',time:nowIso(),bindings:{db:Boolean(env.DB),files:Boolean(env.FILES),openai:Boolean(env.OPENAI_API_KEY),resend:Boolean(env.RESEND_API_KEY)}});
    if(url.pathname==='/api/chat'){if(request.method!=='POST')return json({error:'Método não permitido.'},405);return handleChat(request,env);}
    if(url.pathname==='/api/contact'){if(request.method!=='POST')return json({ok:false,error:'Método não permitido.'},405);return handleContact(request,env);}
    if(url.pathname==='/api/support'){if(request.method!=='POST')return json({ok:false,error:'Método não permitido.'},405);return handleSupport(request,env);}
    if(url.pathname==='/api/public/site-config')return publicSiteConfig(env);
    if(url.pathname==='/api/public/products')return publicProducts(env);
    if(url.pathname==='/api/public/portfolio')return publicPortfolio(request,env);
    const legalMatch=url.pathname.match(/^\/api\/public\/legal\/([^/]+)$/);if(legalMatch)return publicLegal(decodeURIComponent(legalMatch[1]),env);
    if(url.pathname.startsWith('/media/'))return serveMedia(url,env);

    if(url.hostname===ADMIN_HOST){
      if(url.pathname==='/api/auth/status'&&request.method==='GET')return authStatus(request,env);
      if(url.pathname==='/api/auth/bootstrap'&&request.method==='POST')return authBootstrap(request,env);
      if(url.pathname==='/api/auth/login'&&request.method==='POST')return authLogin(request,env);
      if(url.pathname==='/api/auth/logout'&&request.method==='POST')return authLogout(request,env);
      if(url.pathname.startsWith('/api/admin/'))return handleAdminApi(request,env,url);

      if(url.pathname==='/'||url.pathname==='/admin'||url.pathname==='/admin/'){
        const user=await getLocalSession(request,env);return env.ASSETS.fetch(new Request(new URL(user?'/admin/index.html':'/admin/login.html',url.origin),request));
      }
      if(url.pathname.startsWith('/admin/')||url.pathname.startsWith('/brand/')||url.pathname==='/icons.svg')return env.ASSETS.fetch(request);
      return env.ASSETS.fetch(new Request(new URL('/admin/login.html',url.origin),request));
    }

    return env.ASSETS.fetch(request);
  },
};
