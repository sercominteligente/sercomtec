import app from './index.js';

const ADMIN_HOST = 'app.sercomtec.com.br';
const SESSION_COOKIE = 'ser_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const HASH_ITERATIONS = 120000;

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  },
});

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const normalizeEmail = (value) => text(value, 180).toLowerCase();
const nowIso = () => new Date().toISOString();
const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (size = 32) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};
const sha256Hex = async (value) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const validPassword = (value) => typeof value === 'string' && value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function parseJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function parseCookie(request, key) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function getAccessToken(request) {
  return request.headers.get('Cf-Access-Jwt-Assertion') || parseCookie(request, 'CF_Authorization');
}

async function authenticateAccess(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== ADMIN_HOST) return { ok: false, status: 404, error: 'Host administrativo inválido.' };
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return { ok: false, status: 503, error: 'Cloudflare Access não configurado.' };

  const token = getAccessToken(request);
  if (!token) return { ok: false, status: 401, error: 'Sessão do Cloudflare Access ausente.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, error: 'Token do Cloudflare Access inválido.' };

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = parseJwtPart(encodedHeader);
    const payload = parseJwtPart(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return { ok: false, status: 401, error: 'Sessão do Cloudflare Access expirada.' };

    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audience.includes(env.CF_ACCESS_AUD)) return { ok: false, status: 403, error: 'Audience do Access não autorizada.' };

    const team = String(env.CF_ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, '').replace(/\/$/, '');
    const certResponse = await fetch(`https://${team}/cdn-cgi/access/certs`, { headers: { accept: 'application/json' } });
    if (!certResponse.ok) return { ok: false, status: 503, error: 'Não foi possível validar as chaves do Cloudflare Access.' };
    const certs = await certResponse.json();
    const jwk = Array.isArray(certs.keys) ? certs.keys.find((key) => key.kid === header.kid) : null;
    if (!jwk) return { ok: false, status: 401, error: 'Chave do Cloudflare Access não encontrada.' };

    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!valid) return { ok: false, status: 401, error: 'Assinatura do Cloudflare Access inválida.' };

    return {
      ok: true,
      user: {
        email: payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || '',
        sub: payload.sub || '',
      },
    };
  } catch (error) {
    console.error('bootstrap access validation failed', error);
    return { ok: false, status: 401, error: 'Não foi possível validar o Cloudflare Access.' };
  }
}

async function derivePasswordHash(password, saltHex, iterations = HASH_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const saltPairs = saltHex.match(/.{1,2}/g) || [];
  const salt = Uint8Array.from(saltPairs, (pair) => Number.parseInt(pair, 16));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function ensureAuthSchema(env) {
  if (!env.DB) return { ok: false, error: 'Binding D1 DB indisponível.' };
  try {
    const [users, sessions] = await Promise.all([
      env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'").first(),
      env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_sessions'").first(),
    ]);
    if (!users || !sessions) return { ok: false, error: 'Migration de autenticação ainda não foi aplicada ao D1.' };
    return { ok: true };
  } catch (error) {
    console.error('bootstrap schema check failed', error);
    return { ok: false, error: 'Não foi possível verificar o schema de autenticação no D1.' };
  }
}

async function bootstrapAdmin(request, env) {
  const schema = await ensureAuthSchema(env);
  if (!schema.ok) return json({ error: schema.error, stage: 'schema' }, 503);

  let count;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM admin_users').first();
    count = Number(row?.total || 0);
  } catch (error) {
    console.error('bootstrap user count failed', error);
    return json({ error: 'Não foi possível consultar os usuários administrativos.', stage: 'database' }, 500);
  }
  if (count > 0) return json({ error: 'O administrador inicial já foi criado.' }, 409);

  const access = await authenticateAccess(request, env);
  if (!access.ok) return json({ error: access.error, stage: 'access' }, access.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos.', stage: 'request' }, 400);
  }

  const name = text(body.name, 100);
  const email = normalizeEmail(body.email || access.user.email);
  const password = String(body.password || '');
  if (!name || !email.includes('@') || !validPassword(password)) {
    return json({ error: 'Use nome, e-mail válido e senha com pelo menos 10 caracteres, letras e números.', stage: 'validation' }, 400);
  }

  let salt;
  let hash;
  try {
    salt = randomHex(16);
    hash = await derivePasswordHash(password, salt, HASH_ITERATIONS);
  } catch (error) {
    console.error('bootstrap password derivation failed', error);
    return json({ error: 'Não foi possível processar a senha com segurança. Tente novamente após o próximo deploy.', stage: 'password' }, 500);
  }

  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const rawSessionToken = randomHex(32);
  const tokenHash = await sha256Hex(rawSessionToken);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const accessEmail = normalizeEmail(access.user.email) || email;

  try {
    const insertUser = env.DB.prepare(`
      INSERT INTO admin_users
      (id,name,email,role,password_hash,password_salt,password_iterations,active,failed_attempts,created_at,created_by)
      VALUES (?,?,?,'super_admin',?,?,?,1,0,?,?)
    `).bind(userId, name, email, hash, salt, HASH_ITERATIONS, createdAt, accessEmail);

    const insertSession = env.DB.prepare(`
      INSERT INTO admin_sessions
      (id,user_id,token_hash,created_at,expires_at,last_seen_at,user_agent,ip_hint)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      sessionId,
      userId,
      tokenHash,
      createdAt,
      expiresAt,
      createdAt,
      text(request.headers.get('user-agent'), 300),
      text(request.headers.get('CF-Connecting-IP'), 80),
    );

    await env.DB.batch([insertUser, insertSession]);
  } catch (error) {
    console.error('bootstrap atomic D1 insert failed', error);
    return json({ error: 'O D1 recusou a criação do administrador. O usuário não foi criado parcialmente.', stage: 'database-write' }, 500);
  }

  return json(
    { ok: true, user: { id: userId, name, email, role: 'super_admin' } },
    200,
    { 'set-cookie': sessionCookie(rawSessionToken) },
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === ADMIN_HOST && url.pathname === '/api/auth/bootstrap' && request.method === 'POST') {
      return bootstrapAdmin(request, env);
    }
    return app.fetch(request, env, ctx);
  },
};
