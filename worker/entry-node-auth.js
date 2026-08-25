import app from './index.js';
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';

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
const hexToBytes = (hex) => Uint8Array.from((String(hex || '').match(/.{1,2}/g) || []), (pair) => Number.parseInt(pair, 16));
const randomHex = (size = 32) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};
const sha256Hex = async (value) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const validPassword = (value) => typeof value === 'string' && value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);

function parseCookie(request, key) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function parseJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
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
    console.error('node-auth access validation failed', error);
    return { ok: false, status: 401, error: 'Não foi possível validar o Cloudflare Access.' };
  }
}

function derivePasswordHash(password, saltHex, iterations = HASH_ITERATIONS) {
  const salt = hexToBytes(saltHex);
  const derived = pbkdf2Sync(String(password), salt, Number(iterations), 32, 'sha256');
  return bytesToHex(derived);
}

function safeHashEqual(leftHex, rightHex) {
  try {
    const left = hexToBytes(leftHex);
    const right = hexToBytes(rightHex);
    if (!left.length || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
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
    console.error('node-auth schema check failed', error);
    return { ok: false, error: 'Não foi possível verificar o schema de autenticação no D1.' };
  }
}

async function createSession(request, env, userId) {
  const rawToken = randomHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO admin_sessions
    (id,user_id,token_hash,created_at,expires_at,last_seen_at,user_agent,ip_hint)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    id,
    userId,
    tokenHash,
    createdAt,
    expiresAt,
    createdAt,
    text(request.headers.get('user-agent'), 300),
    text(request.headers.get('CF-Connecting-IP'), 80),
  ).run();
  return rawToken;
}

async function bootstrapAdmin(request, env) {
  const schema = await ensureAuthSchema(env);
  if (!schema.ok) return json({ error: schema.error, stage: 'schema' }, 503);

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM admin_users').first();
  if (Number(countRow?.total || 0) > 0) return json({ error: 'O administrador inicial já foi criado.' }, 409);

  const access = await authenticateAccess(request, env);
  if (!access.ok) return json({ error: access.error, stage: 'access' }, access.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.', stage: 'request' }, 400); }

  const name = text(body.name, 100);
  const email = normalizeEmail(body.email || access.user.email);
  const password = String(body.password || '');
  if (!name || !email.includes('@') || !validPassword(password)) {
    return json({ error: 'Use nome, e-mail válido e senha com pelo menos 10 caracteres, letras e números.', stage: 'validation' }, 400);
  }

  const salt = randomHex(16);
  let hash;
  try {
    hash = derivePasswordHash(password, salt, HASH_ITERATIONS);
  } catch (error) {
    console.error('node-auth password derivation failed', error);
    return json({ error: 'Falha ao derivar a senha no runtime do Worker.', stage: 'password-node' }, 500);
  }

  const userId = crypto.randomUUID();
  const createdAt = nowIso();
  const createdBy = normalizeEmail(access.user.email) || email;

  try {
    await env.DB.prepare(`
      INSERT INTO admin_users
      (id,name,email,role,password_hash,password_salt,password_iterations,active,failed_attempts,created_at,created_by)
      VALUES (?,?,?,'super_admin',?,?,?,1,0,?,?)
    `).bind(userId, name, email, hash, salt, HASH_ITERATIONS, createdAt, createdBy).run();

    let sessionToken;
    try {
      sessionToken = await createSession(request, env, userId);
    } catch (sessionError) {
      await env.DB.prepare('DELETE FROM admin_users WHERE id=?').bind(userId).run();
      throw sessionError;
    }

    return json(
      { ok: true, user: { id: userId, name, email, role: 'super_admin' } },
      200,
      { 'set-cookie': sessionCookie(sessionToken) },
    );
  } catch (error) {
    console.error('node-auth bootstrap write failed', error);
    return json({ error: 'Não foi possível concluir a criação do administrador no D1.', stage: 'database-write' }, 500);
  }
}

async function loginAdmin(request, env) {
  const schema = await ensureAuthSchema(env);
  if (!schema.ok) return json({ error: schema.error }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'Informe e-mail e senha.' }, 400);

  const row = await env.DB.prepare('SELECT * FROM admin_users WHERE email=? LIMIT 1').bind(email).first();
  if (!row || !row.active) return json({ error: 'E-mail ou senha inválidos.' }, 401);
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return json({ error: 'Conta temporariamente bloqueada. Aguarde alguns minutos.' }, 429);
  }

  let candidate;
  try {
    candidate = derivePasswordHash(password, row.password_salt, Number(row.password_iterations || HASH_ITERATIONS));
  } catch (error) {
    console.error('node-auth login derivation failed', error);
    return json({ error: 'Não foi possível validar a senha neste momento.' }, 500);
  }

  if (!safeHashEqual(candidate, row.password_hash)) {
    const failed = Number(row.failed_attempts || 0) + 1;
    const lockedUntil = failed >= 6 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await env.DB.prepare('UPDATE admin_users SET failed_attempts=?, locked_until=?, updated_at=? WHERE id=?')
      .bind(failed, lockedUntil, nowIso(), row.id).run();
    return json({ error: 'E-mail ou senha inválidos.' }, 401);
  }

  await env.DB.prepare('UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login_at=?, updated_at=? WHERE id=?')
    .bind(nowIso(), nowIso(), row.id).run();

  const sessionToken = await createSession(request, env, row.id);
  return json(
    { ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } },
    200,
    { 'set-cookie': sessionCookie(sessionToken) },
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === ADMIN_HOST && request.method === 'POST') {
      if (url.pathname === '/api/auth/bootstrap') return bootstrapAdmin(request, env);
      if (url.pathname === '/api/auth/login') return loginAdmin(request, env);
    }
    return app.fetch(request, env, ctx);
  },
};
