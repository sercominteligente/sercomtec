import professional from './master-professional-entry.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const clean = (value, max = 24000) => String(value ?? '').trim().slice(0, max);
let schemaReady = false;

const TYPE_PREFIX = {
  decision: 'DEC', hypothesis: 'HYP', evidence: 'EVI', learning: 'LRN', no: 'NO', metric: 'MET',
  risk: 'RSK', responsibility: 'OWN', experiment: 'EXP', material: 'MAT', glossary: 'GLO',
  privacy: 'PRV', change: 'CHG', action: 'ACT'
};

const STATUS_VALUES = new Set(['active', 'testing', 'confirmed', 'refuted', 'superseded', 'archived']);

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isAdmin(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = '/api/community/admin/state';
  url.search = '';
  const response = await professional.fetch(new Request(url.toString(), {
    method: 'GET',
    headers: request.headers
  }), env, ctx);
  return response.ok;
}

async function ensureSchema(env) {
  if (schemaReady || !env.DB) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_project_memory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL UNIQUE,
      project_key TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      experiment_key TEXT NOT NULL DEFAULT '',
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      critical INTEGER NOT NULL DEFAULT 0,
      confidence INTEGER NOT NULL DEFAULT 50,
      author_key TEXT NOT NULL DEFAULT 'council',
      owner TEXT NOT NULL DEFAULT '',
      source_note TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      closure_condition TEXT NOT NULL DEFAULT '',
      next_review_text TEXT NOT NULL DEFAULT '',
      linked_items_json TEXT NOT NULL DEFAULT '[]',
      meeting_id INTEGER NOT NULL DEFAULT 0,
      fingerprint TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_master_memory_item_fingerprint ON master_project_memory_items(project_key, fingerprint)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_memory_item_project_status ON master_project_memory_items(project_key, status, updated_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_memory_item_project_type ON master_project_memory_items(project_key, record_type, updated_at DESC)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_project_memory_item_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      item_code TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'council',
      meeting_id INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_memory_versions_item ON master_project_memory_item_versions(item_id, version DESC)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_project_memory_operational_summary (
      project_key TEXT PRIMARY KEY,
      project_name TEXT NOT NULL DEFAULT '',
      summary_text TEXT NOT NULL DEFAULT '',
      active_items INTEGER NOT NULL DEFAULT 0,
      critical_items INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`)
  ]);
  schemaReady = true;
}

function normalizeType(value) {
  const raw = String(value || '').toLowerCase().trim();
  const map = {
    decisao: 'decision', decisão: 'decision', decision: 'decision',
    hipotese: 'hypothesis', hipótese: 'hypothesis', hypothesis: 'hypothesis',
    evidencia: 'evidence', evidência: 'evidence', evidence: 'evidence',
    aprendizado: 'learning', learning: 'learning',
    nao: 'no', não: 'no', no: 'no', rejeitado: 'no',
    metrica: 'metric', métrica: 'metric', metric: 'metric',
    risco: 'risk', risk: 'risk',
    responsavel: 'responsibility', responsável: 'responsibility', responsibility: 'responsibility',
    experimento: 'experiment', experiment: 'experiment',
    material: 'material',
    glossario: 'glossary', glossário: 'glossary', glossary: 'glossary',
    privacidade: 'privacy', privacy: 'privacy',
    mudanca: 'change', mudança: 'change', change: 'change', versao: 'change', versão: 'change',
    acao: 'action', ação: 'action', action: 'action'
  };
  return map[raw] || 'learning';
}

function normalizeStatus(value) {
  const raw = String(value || '').toLowerCase().trim();
  const map = {
    ativo: 'active', active: 'active', aberta: 'active', aberto: 'active',
    em_teste: 'testing', 'em teste': 'testing', testing: 'testing',
    confirmado: 'confirmed', confirmada: 'confirmed', confirmed: 'confirmed',
    refutado: 'refuted', refutada: 'refuted', refuted: 'refuted',
    substituido: 'superseded', substituído: 'superseded', substituida: 'superseded', substituída: 'superseded', superseded: 'superseded',
    arquivado: 'archived', arquivada: 'archived', archived: 'archived'
  };
  const normalized = map[raw] || raw;
  return STATUS_VALUES.has(normalized) ? normalized : 'active';
}

function parseJsonArray(text) {
  const raw = String(text || '').trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return Array.isArray(parsed) ? parsed : [];
      } catch { /* noop */ }
    }
    return [];
  }
}

async function callExtractor(env, projectName, meetingId, brief, report, contributions) {
  if (!env.OPENAI_API_KEY) return [];
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: `Você é o secretário de governança da Memória Mestra do SER IA Master. Extraia apenas registros operacionais que mereçam persistir para reuniões futuras. Retorne SOMENTE um array JSON válido, sem markdown.\n\nTipos permitidos: decision, hypothesis, evidence, learning, no, metric, risk, responsibility, experiment, material, glossary, privacy, change, action.\nStatus permitidos: active, testing, confirmed, refuted, superseded, archived.\n\nCada item deve ter exatamente estas chaves: recordType, title, content, status, critical, confidence, authorKey, owner, sourceNote, sourceUrl, experimentKey, nextAction, closureCondition, nextReview, linkedItems.\n\nRegras: não invente fatos; preserve os NÃOs e alternativas rejeitadas; evidência deve citar origem quando conhecida; hipótese deve ter forma de teste; risco crítico precisa de próxima ação ou condição de encerramento; decisão deve registrar condição de revisão quando houver; métricas precisam de definição operacional; linkedItems é um array de títulos/códigos relacionados; confidence vai de 0 a 100. Gere de 4 a 20 itens, somente os realmente úteis.`,
      input: `PROJETO: ${projectName}\nREUNIÃO: #${meetingId}\n\nBRIEF\n${clean(brief, 12000)}\n\nRELATÓRIO FINAL\n${clean(report, 22000)}\n\nCONTRIBUIÇÕES\n${clean(contributions, 18000)}`
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI ${response.status}`);
  let text = String(payload?.output_text || '');
  if (!text) {
    const parts = [];
    for (const item of Array.isArray(payload?.output) ? payload.output : []) {
      for (const content of Array.isArray(item?.content) ? item.content : []) {
        if (typeof content?.text === 'string') parts.push(content.text);
        if (typeof content?.output_text === 'string') parts.push(content.output_text);
      }
    }
    text = parts.join('\n');
  }
  return parseJsonArray(text);
}

function snapshot(row) {
  return {
    itemCode: row.item_code,
    projectKey: row.project_key,
    projectName: row.project_name,
    experimentKey: row.experiment_key,
    recordType: row.record_type,
    title: row.title,
    content: row.content,
    status: row.status,
    critical: Boolean(row.critical),
    confidence: row.confidence,
    authorKey: row.author_key,
    owner: row.owner,
    sourceNote: row.source_note,
    sourceUrl: row.source_url,
    nextAction: row.next_action,
    closureCondition: row.closure_condition,
    nextReview: row.next_review_text,
    linkedItems: (() => { try { return JSON.parse(row.linked_items_json || '[]'); } catch { return []; } })(),
    meetingId: row.meeting_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function storeItem(env, projectKey, projectName, meetingId, raw) {
  const recordType = normalizeType(raw?.recordType);
  const title = clean(raw?.title, 220);
  const content = clean(raw?.content, 5000);
  if (!title || !content) return null;

  const status = normalizeStatus(raw?.status);
  const critical = raw?.critical === true || Number(raw?.critical) === 1;
  const confidence = Math.max(0, Math.min(100, Number(raw?.confidence) || 50));
  const authorKey = clean(raw?.authorKey || 'council', 80);
  const owner = clean(raw?.owner, 120);
  const sourceNote = clean(raw?.sourceNote, 1000);
  const sourceUrl = /^https?:\/\//i.test(String(raw?.sourceUrl || '')) ? clean(raw.sourceUrl, 1200) : '';
  const experimentKey = clean(raw?.experimentKey, 120);
  let nextAction = clean(raw?.nextAction, 1000);
  const closureCondition = clean(raw?.closureCondition, 1000);
  const nextReview = clean(raw?.nextReview, 180);
  const linkedItems = (Array.isArray(raw?.linkedItems) ? raw.linkedItems : []).map((item) => clean(item, 220)).filter(Boolean).slice(0, 20);

  if (critical && !nextAction && !closureCondition) {
    nextAction = 'Definir ação objetiva, responsável e critério de encerramento antes da próxima revisão.';
  }

  const fingerprint = await sha256Hex(`${projectKey}|${recordType}|${slugify(title)}`);
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT * FROM master_project_memory_items WHERE project_key=? AND fingerprint=? LIMIT 1')
    .bind(projectKey, fingerprint).first();

  if (existing) {
    await env.DB.prepare(`INSERT INTO master_project_memory_item_versions
      (item_id, item_code, version, snapshot_json, changed_by, meeting_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(existing.id, existing.item_code, existing.version, JSON.stringify(snapshot(existing)), authorKey, meetingId, now).run();

    const nextVersion = Number(existing.version || 1) + 1;
    await env.DB.prepare(`UPDATE master_project_memory_items SET
      project_name=?, experiment_key=?, content=?, status=?, critical=?, confidence=?, author_key=?, owner=?, source_note=?, source_url=?,
      next_action=?, closure_condition=?, next_review_text=?, linked_items_json=?, meeting_id=?, version=?, updated_at=?
      WHERE id=?`)
      .bind(projectName, experimentKey, content, status, critical ? 1 : 0, confidence, authorKey, owner, sourceNote, sourceUrl,
        nextAction, closureCondition, nextReview, JSON.stringify(linkedItems), meetingId, nextVersion, now, existing.id).run();
    return existing.item_code;
  }

  const tempCode = `TMP-${crypto.randomUUID()}`;
  const inserted = await env.DB.prepare(`INSERT INTO master_project_memory_items
    (item_code, project_key, project_name, experiment_key, record_type, title, content, status, critical, confidence, author_key, owner,
     source_note, source_url, next_action, closure_condition, next_review_text, linked_items_json, meeting_id, fingerprint, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
    .bind(tempCode, projectKey, projectName, experimentKey, recordType, title, content, status, critical ? 1 : 0, confidence, authorKey, owner,
      sourceNote, sourceUrl, nextAction, closureCondition, nextReview, JSON.stringify(linkedItems), meetingId, fingerprint, now, now).run();
  const id = Number(inserted.meta?.last_row_id || 0);
  const prefix = TYPE_PREFIX[recordType] || 'MEM';
  const itemCode = `MM-${prefix}-${String(id || Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
  await env.DB.prepare('UPDATE master_project_memory_items SET item_code=? WHERE id=?').bind(itemCode, id).run();
  return itemCode;
}

async function rebuildSummary(env, projectKey, projectName) {
  const result = await env.DB.prepare(`SELECT item_code, record_type, title, content, status, critical, confidence, owner, next_action, closure_condition,
      next_review_text, experiment_key, updated_at
    FROM master_project_memory_items WHERE project_key=? AND status != 'archived'
    ORDER BY critical DESC, updated_at DESC LIMIT 120`).bind(projectKey).all();
  const rows = result.results || [];
  const active = rows.filter((row) => !['refuted', 'superseded', 'archived'].includes(row.status));
  const critical = active.filter((row) => Boolean(row.critical));
  const summary = rows.map((row) => {
    const action = row.next_action ? ` | Próxima ação: ${row.next_action}` : '';
    const close = row.closure_condition ? ` | Encerramento: ${row.closure_condition}` : '';
    const review = row.next_review_text ? ` | Revisão: ${row.next_review_text}` : '';
    return `[${row.item_code}] ${row.record_type.toUpperCase()} · ${row.status}${row.critical ? ' · CRÍTICO' : ''}\n${row.title}\n${row.content}${action}${close}${review}`;
  }).join('\n\n');
  await env.DB.prepare(`INSERT INTO master_project_memory_operational_summary
    (project_key, project_name, summary_text, active_items, critical_items, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_key) DO UPDATE SET project_name=excluded.project_name, summary_text=excluded.summary_text,
      active_items=excluded.active_items, critical_items=excluded.critical_items, updated_at=excluded.updated_at`)
    .bind(projectKey, projectName, clean(summary, 28000), active.length, critical.length, Date.now()).run();
}

async function processMeetingMemory(env, meetingId, projectName) {
  if (!env.DB || !meetingId || !projectName) return;
  await ensureSchema(env);
  const projectKey = slugify(projectName);
  if (!projectKey) return;
  const meeting = await env.DB.prepare('SELECT brief, synthesis FROM master_creative_meetings WHERE id=? LIMIT 1').bind(meetingId).first();
  const meta = await env.DB.prepare('SELECT report_text FROM master_professional_meeting_meta WHERE meeting_id=? LIMIT 1').bind(meetingId).first();
  const result = await env.DB.prepare(`SELECT agent_key, phase, content FROM master_creative_meeting_contributions WHERE meeting_id=? ORDER BY id ASC`)
    .bind(meetingId).all();
  const contributions = (result.results || []).map((row) => `${row.agent_key} · ${row.phase}\n${row.content}`).join('\n\n');
  const report = clean(meta?.report_text || meeting?.synthesis || '', 28000);
  if (!report) return;

  let items = [];
  try { items = await callExtractor(env, projectName, meetingId, meeting?.brief || '', report, contributions); }
  catch (error) { console.error('Operational memory extraction failure', error); }
  for (const item of items.slice(0, 24)) {
    try { await storeItem(env, projectKey, projectName, meetingId, item); }
    catch (error) { console.error('Operational memory store failure', error); }
  }
  await rebuildSummary(env, projectKey, projectName);
}

async function handleProjectMemory(request, env, ctx) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  if (!env.DB) return json({ error: 'D1 indisponível.' }, 503);
  await ensureSchema(env);
  const url = new URL(request.url);
  const projectName = clean(url.searchParams.get('project') || '', 120);
  const projectKey = slugify(projectName || url.searchParams.get('key') || '');
  if (!projectKey) return json({ error: 'Informe o projeto.' }, 400);
  const result = await env.DB.prepare('SELECT * FROM master_project_memory_items WHERE project_key=? ORDER BY critical DESC, updated_at DESC LIMIT 300')
    .bind(projectKey).all();
  const summary = await env.DB.prepare('SELECT * FROM master_project_memory_operational_summary WHERE project_key=? LIMIT 1').bind(projectKey).first();
  return json({
    projectKey,
    projectName: summary?.project_name || projectName,
    summary: summary ? { text: summary.summary_text, activeItems: summary.active_items, criticalItems: summary.critical_items, updatedAt: summary.updated_at } : null,
    items: (result.results || []).map(snapshot)
  });
}

async function handleStatusUpdate(request, env, ctx, itemCode) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  if (!env.DB) return json({ error: 'D1 indisponível.' }, 503);
  await ensureSchema(env);
  let body; try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const status = normalizeStatus(body.status);
  const row = await env.DB.prepare('SELECT * FROM master_project_memory_items WHERE item_code=? LIMIT 1').bind(itemCode).first();
  if (!row) return json({ error: 'Registro não encontrado.' }, 404);
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO master_project_memory_item_versions
    (item_id, item_code, version, snapshot_json, changed_by, meeting_id, created_at) VALUES (?, ?, ?, ?, 'superadmin', ?, ?)`)
    .bind(row.id, row.item_code, row.version, JSON.stringify(snapshot(row)), row.meeting_id, now).run();
  await env.DB.prepare('UPDATE master_project_memory_items SET status=?, version=?, updated_at=? WHERE id=?')
    .bind(status, Number(row.version || 1) + 1, now, row.id).run();
  await rebuildSummary(env, row.project_key, row.project_name);
  return json({ ok: true, itemCode, status });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/memory/project' && request.method === 'GET') {
      return handleProjectMemory(request, env, ctx);
    }

    const statusMatch = url.pathname.match(/^\/api\/memory\/item\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'POST') {
      return handleStatusUpdate(request, env, ctx, decodeURIComponent(statusMatch[1]));
    }

    if (url.pathname === '/api/pro/meeting/start' && request.method === 'POST') {
      const clone = request.clone();
      let body = {};
      try { body = await clone.json(); } catch { /* base tratará */ }
      const response = await professional.fetch(request, env, ctx);
      if (response.ok && String(response.headers.get('content-type') || '').includes('application/json')) {
        try {
          const payload = await response.clone().json();
          const projectName = clean(body.projectName || payload.projectName || '', 120);
          if (payload.meetingId && projectName) ctx.waitUntil(processMeetingMemory(env, Number(payload.meetingId), projectName));
        } catch (error) {
          console.error('Operational memory scheduling failure', error);
        }
      }
      return response;
    }

    return professional.fetch(request, env, ctx);
  }
};
