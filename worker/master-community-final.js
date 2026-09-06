import community from './master-community.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

async function handleAdminMessage(request, env, ctx) {
  const authUrl = new URL(request.url);
  authUrl.pathname = '/api/community/admin/state';
  authUrl.search = '';
  const authResponse = await community.fetch(new Request(authUrl.toString(), {
    method: 'GET',
    headers: request.headers
  }), env, ctx);
  if (!authResponse.ok) return json({ error: 'Acesso restrito ao Super Admin.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const message = clean(body.message);
  if (!message) return json({ error: 'Digite uma mensagem.' }, 400);
  if (!env.DB) return json({ error: 'D1 indisponível.' }, 503);

  await env.DB.prepare(`
    INSERT INTO master_roundtable_messages
      (speaker, display_name, content, sources_json, created_at)
    VALUES ('admin', 'Super Admin', ?, '[]', ?)
  `).bind(message, Date.now()).run();

  const forceUrl = new URL(request.url);
  forceUrl.pathname = '/api/community/admin/force';
  forceUrl.search = '';
  const forceResponse = await community.fetch(new Request(forceUrl.toString(), {
    method: 'POST',
    headers: request.headers,
    body: '{}'
  }), env, ctx);

  if (!forceResponse.ok) {
    const detail = await forceResponse.json().catch(() => ({}));
    return json({ ok: true, generated: false, warning: detail.error || 'Mensagem salva, mas nenhum agente respondeu agora.' });
  }
  const detail = await forceResponse.json().catch(() => ({}));
  return json({ ok: true, generated: Boolean(detail.generated), agent: detail.agent || null });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/community/admin/message') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return handleAdminMessage(request, env, ctx);
    }
    return community.fetch(request, env, ctx);
  }
};
