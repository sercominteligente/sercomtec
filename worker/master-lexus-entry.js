import operational from './master-operational-memory.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const clean = (value, max = 24000) => String(value ?? '').trim().slice(0, max);

const LEXUS = {
  key: 'lexus',
  name: 'Lexus',
  specialty: 'ADS Sênior, MarTech, tráfego pago, Analytics e Social Media',
  personality: 'Especialista sênior analítico, pragmático e orientado por mensuração. Conecta produto, engenharia, aquisição e dados. Não aceita campanha sem rastreamento, feature sem evento ou resultado sem métrica confiável.',
  behavior: 'Atue como ponte entre Análise e Desenvolvimento de Sistemas e crescimento. Analise requisitos, arquitetura, APIs, integrações, segurança, dados, GA4, Google Tag Manager, Search Console, Google Ads, Meta Ads, pixels, APIs de conversão, UTMs, atribuição, CRO, funis, remarketing, social media, impulsionamentos, testes A/B, CAC, CPA, ROAS, CTR, frequência, ativação e retenção. Chame Serafim quando houver dependência técnica, Serena para criativos/mensagem/canais, Sirius para validar números, Lyra para público e Nova para experimentos. Diferencie claramente dado observado, hipótese e recomendação.'
};

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady || !env.DB) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_lexus_settings (
      id INTEGER PRIMARY KEY CHECK (id=1),
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_agent_profiles (
      agent_key TEXT PRIMARY KEY,
      personality_prompt TEXT NOT NULL DEFAULT '',
      knowledge_prompt TEXT NOT NULL DEFAULT '',
      behavior_prompt TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_agent_prompt_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_key TEXT NOT NULL,
      personality_prompt TEXT NOT NULL DEFAULT '',
      knowledge_prompt TEXT NOT NULL DEFAULT '',
      behavior_prompt TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_agent_learning_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_key TEXT NOT NULL,
      report_json TEXT NOT NULL DEFAULT '{}',
      messages_analyzed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`)
  ]);
  await env.DB.prepare(`INSERT OR IGNORE INTO master_lexus_settings (id, enabled, updated_at) VALUES (1,1,?)`)
    .bind(Date.now()).run();
  schemaReady = true;
}

async function isAdmin(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = '/api/community/admin/state';
  url.search = '';
  const response = await operational.fetch(new Request(url.toString(), {
    method: 'GET',
    headers: request.headers
  }), env, ctx);
  return response.ok;
}

async function isEnabled(env) {
  if (!env.DB) return true;
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT enabled FROM master_lexus_settings WHERE id=1').first();
  return row ? Boolean(row.enabled) : true;
}

async function getProfile(env) {
  await ensureSchema(env);
  const row = env.DB ? await env.DB.prepare('SELECT * FROM master_agent_profiles WHERE agent_key=? LIMIT 1').bind('lexus').first() : null;
  return {
    key: LEXUS.key,
    name: LEXUS.name,
    specialty: LEXUS.specialty,
    defaultPersonality: LEXUS.personality,
    defaultBehavior: LEXUS.behavior,
    personalityPrompt: clean(row?.personality_prompt || '', 7000),
    knowledgePrompt: clean(row?.knowledge_prompt || '', 12000),
    behaviorPrompt: clean(row?.behavior_prompt || '', 7000),
    updatedAt: Number(row?.updated_at || 0)
  };
}

async function profileForPrompt(env) {
  const profile = await getProfile(env);
  return {
    ...profile,
    personality: profile.personalityPrompt || profile.defaultPersonality,
    behavior: profile.behaviorPrompt || profile.defaultBehavior,
    knowledge: profile.knowledgePrompt || ''
  };
}

async function latestLearning(env) {
  if (!env.DB) return null;
  await ensureSchema(env);
  const row = await env.DB.prepare(`SELECT report_json, messages_analyzed, created_at FROM master_agent_learning_reports WHERE agent_key='lexus' ORDER BY id DESC LIMIT 1`).first();
  if (!row) return null;
  let report = {};
  try { report = JSON.parse(row.report_json || '{}'); } catch { report = {}; }
  return { report, messagesAnalyzed: Number(row.messages_analyzed || 0), createdAt: Number(row.created_at || 0) };
}

async function injectState(response, env, pathname) {
  if (!response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;
  const data = await response.json();
  const enabled = await isEnabled(env);

  if (data?.agents && typeof data.agents === 'object') {
    data.agents.lexus = { name: LEXUS.name, specialty: LEXUS.specialty };
  }
  if (data?.room && Array.isArray(data.room.activeAgents)) {
    const set = new Set(data.room.activeAgents.filter((key) => key !== 'lexus'));
    if (enabled) set.add('lexus');
    data.room.activeAgents = [...set];
  }
  if (pathname === '/api/studio/dna' && Array.isArray(data?.profiles)) {
    if (!data.profiles.some((profile) => profile?.key === 'lexus')) data.profiles.push(await getProfile(env));
    data.latestReports = data.latestReports || {};
    const latest = await latestLearning(env);
    if (latest) data.latestReports.lexus = latest;
  }

  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function handleRoomUpdate(request, env, ctx) {
  let body;
  try { body = await request.clone().json(); } catch { return operational.fetch(request, env, ctx); }
  if (!Array.isArray(body.activeAgents)) return operational.fetch(request, env, ctx);

  await ensureSchema(env);
  const enabled = body.activeAgents.map(String).includes('lexus');
  const baseAgents = body.activeAgents.map(String).filter((key) => key !== 'lexus');
  if (baseAgents.length < 2) return json({ error: 'Mantenha pelo menos dois agentes-base ativos além das extensões da mesa.' }, 400);

  const forwarded = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify({ ...body, activeAgents: baseAgents })
  });
  const response = await operational.fetch(forwarded, env, ctx);
  if (response.ok) {
    await env.DB.prepare('UPDATE master_lexus_settings SET enabled=?, updated_at=? WHERE id=1')
      .bind(enabled ? 1 : 0, Date.now()).run();
  }
  return injectState(response, env, '/api/community/admin/state');
}

async function handleSaveDNA(request, env, ctx) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  await ensureSchema(env);
  let body; try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const personality = clean(body.personalityPrompt, 7000);
  const knowledge = clean(body.knowledgePrompt, 12000);
  const behavior = clean(body.behaviorPrompt, 7000);
  const note = clean(body.note || 'Atualização manual do DNA de Lexus', 400);
  const now = Date.now();
  const current = await env.DB.prepare('SELECT * FROM master_agent_profiles WHERE agent_key=? LIMIT 1').bind('lexus').first();
  await env.DB.prepare(`INSERT INTO master_agent_prompt_versions
    (agent_key, personality_prompt, knowledge_prompt, behavior_prompt, note, created_at)
    VALUES ('lexus',?,?,?,?,?)`)
    .bind(current?.personality_prompt || '', current?.knowledge_prompt || '', current?.behavior_prompt || '', note, now).run();
  await env.DB.prepare(`INSERT INTO master_agent_profiles
    (agent_key, personality_prompt, knowledge_prompt, behavior_prompt, updated_at)
    VALUES ('lexus',?,?,?,?)
    ON CONFLICT(agent_key) DO UPDATE SET
      personality_prompt=excluded.personality_prompt,
      knowledge_prompt=excluded.knowledge_prompt,
      behavior_prompt=excluded.behavior_prompt,
      updated_at=excluded.updated_at`)
    .bind(personality, knowledge, behavior, now).run();
  return json({ ok: true, profile: await getProfile(env) });
}

async function handleResetDNA(request, env, ctx) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  await ensureSchema(env);
  const current = await env.DB.prepare('SELECT * FROM master_agent_profiles WHERE agent_key=? LIMIT 1').bind('lexus').first();
  if (current) {
    await env.DB.prepare(`INSERT INTO master_agent_prompt_versions
      (agent_key, personality_prompt, knowledge_prompt, behavior_prompt, note, created_at)
      VALUES ('lexus',?,?,?,?,?)`)
      .bind(current.personality_prompt || '', current.knowledge_prompt || '', current.behavior_prompt || '', 'Restauração do DNA padrão', Date.now()).run();
    await env.DB.prepare(`UPDATE master_agent_profiles SET personality_prompt='', knowledge_prompt='', behavior_prompt='', updated_at=? WHERE agent_key='lexus'`)
      .bind(Date.now()).run();
  }
  return json({ ok: true, profile: await getProfile(env) });
}

function extractText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('\n').trim();
}

function extractSources(payload) {
  const found = [];
  const add = (source) => {
    const url = String(source?.url || source?.uri || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    let title = clean(source?.title || source?.name || '', 180);
    if (!title) { try { title = new URL(url).hostname; } catch { title = url; } }
    found.push({ url, title });
  };
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const source of Array.isArray(item?.action?.sources) ? item.action.sources : []) add(source);
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) {
        if (annotation?.type === 'url_citation') add(annotation);
      }
    }
  }
  const seen = new Set();
  return found.filter((source) => !seen.has(source.url) && seen.add(source.url)).slice(0, 12);
}

async function callModel(env, request, instructions, input, webSearch = false) {
  if (!env.OPENAI_API_KEY) return { reply: '', sources: [] };
  const body = { model: env.OPENAI_MODEL || 'gpt-5.6-luna', instructions, input };
  if (webSearch) {
    const tool = { type: 'web_search', search_context_size: 'medium' };
    const cf = request.cf || {};
    if (cf.country) tool.user_location = { type: 'approximate', country: String(cf.country).slice(0,2), ...(cf.city ? { city: String(cf.city).slice(0,80) } : {}), ...(cf.region ? { region: String(cf.region).slice(0,80) } : {}) };
    body.tools = [tool];
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI ${response.status}`);
  return { reply: clean(extractText(payload), 18000), sources: extractSources(payload) };
}

async function handleLearning(request, env, ctx) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  await ensureSchema(env);
  const rows = await env.DB.prepare(`SELECT content, created_at FROM master_roundtable_messages WHERE speaker='lexus' ORDER BY id DESC LIMIT 120`).all();
  const messages = (rows.results || []).reverse();
  const profile = await profileForPrompt(env);
  let report = {
    summary: 'Ainda há poucas falas para avaliar Lexus com confiança.',
    strengths: [], public_risks: [], blind_spots: [], prompt_improvements: []
  };
  if (messages.length && env.OPENAI_API_KEY) {
    try {
      const result = await callModel(env, request,
        'Analise o comportamento de um agente de IA profissional. Responda SOMENTE JSON válido com as chaves summary, strengths, public_risks, blind_spots, prompt_improvements. Cada lista deve ter itens curtos e acionáveis. Não invente fatos fora das falas.',
        `AGENTE: Lexus\nESPECIALIDADE: ${LEXUS.specialty}\nPERSONALIDADE ATUAL: ${profile.personality}\nCOMPORTAMENTO ATUAL: ${profile.behavior}\n\nFALAS\n${clean(messages.map((m) => m.content).join('\n\n'), 28000)}`
      );
      const raw = result.reply.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') report = parsed;
    } catch (error) { console.error('Lexus learning report failure', error); }
  }
  await env.DB.prepare(`INSERT INTO master_agent_learning_reports (agent_key, report_json, messages_analyzed, created_at) VALUES ('lexus',?,?,?)`)
    .bind(JSON.stringify(report), messages.length, Date.now()).run();
  return json({ ok: true, report, messagesAnalyzed: messages.length });
}

async function runLexusForMeeting(request, env, meetingId) {
  if (!env.DB || !(await isEnabled(env)) || !env.OPENAI_API_KEY) return null;
  const meeting = await env.DB.prepare('SELECT brief, synthesis FROM master_creative_meetings WHERE id=? LIMIT 1').bind(meetingId).first();
  const meta = await env.DB.prepare('SELECT project_name, report_text, chair_key FROM master_professional_meeting_meta WHERE meeting_id=? LIMIT 1').bind(meetingId).first();
  if (!meeting) return null;
  const rows = await env.DB.prepare(`SELECT agent_key, phase, content FROM master_creative_meeting_contributions WHERE meeting_id=? AND agent_key!='lexus' ORDER BY id ASC`).bind(meetingId).all();
  const context = clean((rows.results || []).map((row) => `${row.agent_key} · ${row.phase}\n${row.content}`).join('\n\n'), 30000);
  const profile = await profileForPrompt(env);
  const room = await env.DB.prepare('SELECT web_search_enabled FROM master_roundtable_room WHERE id=1').first().catch(() => null);

  const analysis = await callModel(env, request,
    `Você é Lexus, especialista sênior da Mesa Criativa SER IA Master.\nESPECIALIDADE: ${LEXUS.specialty}\nPERSONALIDADE: ${profile.personality}\nCOMPORTAMENTO: ${profile.behavior}\n${profile.knowledge ? `CONHECIMENTO COMPLEMENTAR: ${profile.knowledge}\n` : ''}\nVocê entra como décimo segundo especialista. Não faça comentário genérico: conecte engenharia, instrumentação, aquisição e mensuração. Verifique fatos atuais quando necessário. Questione os colegas pelo nome quando houver lacunas. Produza uma contribuição profissional com: arquitetura/integrações relevantes; plano de mensuração; eventos e funil; tráfego pago; GA4/GTM/Search Console; Meta/Google Ads; CRO; social/impulsionamento; métricas; riscos de atribuição; experimentos e próximos passos. Diferencie fato, hipótese e recomendação.`,
    `PROJETO: ${clean(meta?.project_name || '',120)}\n\nBRIEF\n${clean(meeting.brief,16000)}\n\nCONTRIBUIÇÕES DA EQUIPE\n${context}\n\nRELATÓRIO ATUAL\n${clean(meta?.report_text || meeting.synthesis || '',18000)}`,
    Boolean(room?.web_search_enabled)
  );
  if (!analysis?.reply) return null;

  const now = Date.now();
  await env.DB.prepare(`INSERT INTO master_creative_meeting_contributions
    (meeting_id, agent_key, phase, content, sources_json, created_at)
    VALUES (?, 'lexus', '2.5 · ADS, MarTech, Performance e Analytics', ?, ?, ?)`)
    .bind(meetingId, analysis.reply, JSON.stringify(analysis.sources || []), now).run();
  await env.DB.prepare(`INSERT INTO master_roundtable_messages
    (speaker, display_name, content, sources_json, created_at)
    VALUES ('lexus', 'Lexus', ?, ?, ?)`)
    .bind(clean(analysis.reply,6500), JSON.stringify(analysis.sources || []), now).run();

  let integrated = clean(`${meta?.report_text || meeting.synthesis || ''}\n\nLEXUS · ADS, MARTECH, PERFORMANCE E ANALYTICS\n${analysis.reply}`, 30000);
  try {
    const result = await callModel(env, request,
      'Você é o editor executivo do relatório final da Mesa Criativa SER IA Master. Integre a contribuição de Lexus ao relatório existente sem apagar conclusões, divergências ou fontes. Preserve a estrutura profissional e acrescente, onde fizer sentido, mensuração, eventos, analytics, mídia paga, CRO, social, atribuição e próximos testes. Não invente dados nem alegue interesse de investidores. Entregue apenas o relatório final revisado.',
      `RELATÓRIO EXISTENTE\n${clean(meta?.report_text || meeting.synthesis || '',24000)}\n\nCONTRIBUIÇÃO DE LEXUS\n${clean(analysis.reply,14000)}`
    );
    if (result.reply) integrated = result.reply;
  } catch (error) { console.error('Lexus report integration failure', error); }

  await env.DB.prepare('UPDATE master_professional_meeting_meta SET report_text=?, updated_at=? WHERE meeting_id=?')
    .bind(clean(integrated,30000), Date.now(), meetingId).run();
  await env.DB.prepare('UPDATE master_creative_meetings SET synthesis=? WHERE id=?')
    .bind(clean(integrated,30000), meetingId).run();
  return { reply: analysis.reply, sources: analysis.sources || [] };
}

async function handleMeetingStart(request, env, ctx) {
  const response = await operational.fetch(request, env, ctx);
  if (!response.ok || !String(response.headers.get('content-type') || '').includes('application/json')) return response;
  const payload = await response.json();
  if (payload?.meetingId) {
    try {
      const added = await runLexusForMeeting(request, env, Number(payload.meetingId));
      if (added) {
        payload.lexusIncluded = true;
        payload.contributions = Number(payload.contributions || 0) + 1;
      }
    } catch (error) { console.error('Lexus meeting participation failure', error); }
  }
  return json(payload, response.status);
}

export default {
  async fetch(request, env, ctx) {
    await ensureSchema(env);
    const url = new URL(request.url);

    if (url.pathname === '/api/community/admin/room' && request.method === 'POST') {
      return handleRoomUpdate(request, env, ctx);
    }
    if (url.pathname === '/api/studio/dna/lexus' && request.method === 'POST') {
      return handleSaveDNA(request, env, ctx);
    }
    if (url.pathname === '/api/studio/dna/lexus/reset' && request.method === 'POST') {
      return handleResetDNA(request, env, ctx);
    }
    if (url.pathname === '/api/studio/learning/lexus' && request.method === 'POST') {
      return handleLearning(request, env, ctx);
    }
    if (url.pathname === '/api/pro/meeting/start' && request.method === 'POST') {
      return handleMeetingStart(request, env, ctx);
    }

    const response = await operational.fetch(request, env, ctx);
    if (
      (url.pathname === '/api/community/state' && request.method === 'GET') ||
      (url.pathname === '/api/community/admin/state' && request.method === 'GET') ||
      (url.pathname === '/api/studio/dna' && request.method === 'GET')
    ) return injectState(response, env, url.pathname);
    return response;
  }
};
