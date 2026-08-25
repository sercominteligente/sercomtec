import base from './entry-admin-router.js';
import { pbkdf2Sync, scryptSync, timingSafeEqual } from 'node:crypto';

const ADMIN_HOST = 'app.sercomtec.com.br';
const SESSION_COOKIE = 'ser_admin_session';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const LEGACY_PBKDF2_MAX = 100000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
});
const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const normalizeEmail = (value) => text(value, 180).toLowerCase();
const nowIso = () => new Date().toISOString();
const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => Uint8Array.from((String(hex || '').match(/.{1,2}/g) || []), (pair) => Number.parseInt(pair, 16));
const randomHex = (size = 16) => {
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

function hashPasswordScrypt(password, saltHex) {
  const derived = scryptSync(String(password), hexToBytes(saltHex), 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${bytesToHex(derived)}`;
}

function verifyPassword(password, row) {
  const stored = String(row?.password_hash || '');
  const salt = String(row?.password_salt || '');
  if (!stored || !salt) return false;
  if (stored.startsWith('scrypt$')) {
    const [, nRaw, rRaw, pRaw, expectedHex] = stored.split('$');
    const N = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
    if (!N || !r || !p || !expectedHex) return false;
    const candidate = scryptSync(String(password), hexToBytes(salt), 32, { N, r, p, maxmem: SCRYPT_MAXMEM });
    return safeHashEqual(bytesToHex(candidate), expectedHex);
  }
  const iterations = Number(row.password_iterations || LEGACY_PBKDF2_MAX);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > LEGACY_PBKDF2_MAX) return false;
  const candidate = pbkdf2Sync(String(password), hexToBytes(salt), iterations, 32, 'sha256');
  return safeHashEqual(bytesToHex(candidate), stored);
}

async function getSession(request, env) {
  if (!env.DB) return null;
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    SELECT s.id AS session_id,s.expires_at,u.id,u.name,u.email,u.role,u.active,u.avatar_url
    FROM admin_sessions s
    JOIN admin_users u ON u.id=s.user_id
    WHERE s.token_hash=? LIMIT 1
  `).bind(tokenHash).first();
  if (!row || !row.active || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    sessionId: row.session_id,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar_url: row.avatar_url || '',
  };
}

async function handleProfile(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Faça login na área administrativa.' }, 401);
  if (request.method === 'GET') return json({ ok: true, user: session });
  if (request.method !== 'PATCH') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
  const current = await env.DB.prepare('SELECT * FROM admin_users WHERE id=? LIMIT 1').bind(session.id).first();
  if (!current) return json({ error: 'Usuário não encontrado.' }, 404);

  const name = text(body.name ?? current.name, 100);
  const email = normalizeEmail(body.email ?? current.email);
  const avatarUrl = text(body.avatar_url ?? current.avatar_url, 700);
  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');
  if (!name || !email.includes('@')) return json({ error: 'Informe nome e e-mail válidos.' }, 400);

  const sensitiveChange = email !== normalizeEmail(current.email) || Boolean(newPassword);
  if (sensitiveChange) {
    if (!currentPassword) return json({ error: 'Informe sua senha atual para alterar e-mail ou senha.' }, 400);
    let valid = false;
    try { valid = verifyPassword(currentPassword, current); } catch {}
    if (!valid) return json({ error: 'Senha atual inválida.' }, 401);
  }
  if (newPassword && !validPassword(newPassword)) return json({ error: 'A nova senha precisa ter pelo menos 10 caracteres, letras e números.' }, 400);

  if (email !== normalizeEmail(current.email)) {
    const exists = await env.DB.prepare('SELECT id FROM admin_users WHERE email=? AND id<>? LIMIT 1').bind(email, session.id).first();
    if (exists) return json({ error: 'Este e-mail já está sendo usado por outro usuário.' }, 409);
  }

  const updatedAt = nowIso();
  await env.DB.prepare('UPDATE admin_users SET name=?,email=?,avatar_url=?,updated_at=? WHERE id=?')
    .bind(name, email, avatarUrl, updatedAt, session.id).run();

  if (newPassword) {
    const salt = randomHex(16);
    const hash = hashPasswordScrypt(newPassword, salt);
    await env.DB.prepare('UPDATE admin_users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE id=?')
      .bind(hash, salt, SCRYPT_N, updatedAt, session.id).run();
    await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=? AND id<>?').bind(session.id, session.sessionId).run();
  }

  const user = { ...session, name, email, avatar_url: avatarUrl };
  return json({ ok: true, user });
}

async function deleteLead(request, env, id) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Faça login na área administrativa.' }, 401);
  if (!['super_admin', 'admin'].includes(session.role)) return json({ error: 'Seu perfil não possui permissão para excluir leads.' }, 403);
  const lead = await env.DB.prepare('SELECT id,nome,email FROM leads WHERE id=? LIMIT 1').bind(id).first();
  if (!lead) return json({ error: 'Lead não encontrado.' }, 404);
  await env.DB.prepare('DELETE FROM lead_activity WHERE lead_id=?').bind(id).run();
  await env.DB.prepare('DELETE FROM leads WHERE id=?').bind(id).run();
  return json({ ok: true, deleted: { id: lead.id, nome: lead.nome, email: lead.email } });
}

async function transformAdminHtml(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();

  if (html.includes('id="bootstrap-form"')) {
    html = html.replace(/\s*<form id="bootstrap-form"[\s\S]*?<\/form>/i, '');
    html = html.replace('/admin/login.js', '/admin/login-secure.js');
    html = html.replace(/<p class="login-help">[\s\S]*?<\/p>/i, '<p class="login-help">Novos usuários são cadastrados exclusivamente por administradores autenticados dentro da Central de Operações.</p>');
  }

  if (html.includes('class="admin-shell"')) {
    if (!html.includes('/admin/account-menu.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="/admin/account-menu.css">\n</head>');
    if (!html.includes('/admin/account-menu.js')) html = html.replace('</body>', '  <script src="/admin/account-menu.js" defer></script>\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname === ADMIN_HOST) {
      if (url.pathname === '/api/auth/bootstrap') {
        return json({ error: 'Cadastro inicial desativado. Novos usuários devem ser criados por um administrador autenticado.' }, 404);
      }
      if (url.pathname === '/api/admin/profile') return handleProfile(request, env);
      const leadMatch = url.pathname.match(/^\/api\/admin\/leads\/([^/]+)$/);
      if (leadMatch && request.method === 'DELETE') return deleteLead(request, env, decodeURIComponent(leadMatch[1]));
    }

    const response = await base.fetch(request, env, ctx);
    if (url.hostname === ADMIN_HOST && request.method === 'GET') return transformAdminHtml(response);
    return response;
  },
};
