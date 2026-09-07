import creative from './master-creative-meeting.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const clean = (value, max = 50000) => String(value ?? '').trim().slice(0, max);

const AGENTS = {
  hakham: { name: 'Hakham', specialty: 'Estratégia, modelo de negócio e síntese executiva' },
  arcanum: { name: 'Arcanum', specialty: 'Branding, posicionamento, experiência e diferenciação' },
  serafim: { name: 'Serafim', specialty: 'Tecnologia, arquitetura, integrações e escalabilidade' },
  serena: { name: 'Serena', specialty: 'Marketing, aquisição, conteúdo e go-to-market' },
  luna: { name: 'Luna', specialty: 'Jornada do usuário, onboarding, adoção e clareza' },
  delta: { name: 'Delta', specialty: 'Red team, concorrência, evidências e sincericídio' },
  orion: { name: 'Orion', specialty: 'Inteligência de mercado, cenários, concorrentes e capital' },
  lyra: { name: 'Lyra', specialty: 'Público-alvo, jobs-to-be-done, empatia e proposta de valor' },
  nova: { name: 'Nova', specialty: 'Experimentação, ruptura, MVP e novas possibilidades' },
  polaris: { name: 'Polaris', specialty: 'Execução, governança, operação e prontidão para investimento' },
  sirius: { name: 'Sirius', specialty: 'Dados, unit economics, métricas, inconsistências e riscos' }
};

const AGENT_KEYS = Object.keys(AGENTS);
const RESEARCH_AGENTS = new Set(['orion', 'delta', 'sirius', 'serena']);
const DISCOVERY_ORDER = ['lyra', 'orion', 'delta', 'sirius', 'arcanum', 'serafim'];
let schemaReady = false;

const MEETING_RULES = `
REGRAS DA EQUIPE PROFISSIONAL
- A reunião existe para analisar, desafiar e desenvolver produtos, serviços e negócios. Não valide a ideia automaticamente.
- Cada especialista deve trabalhar a partir da própria competência e complementar os demais.
- Use pesquisa na web quando informação atual puder alterar a decisão: concorrentes, mercado, preços, plataformas, legislação, investidores, fundos, aceleradoras, parceiros, tendências ou benchmarks.
- Diferencie fato encontrado, hipótese, inferência e recomendação.
- Nunca invente intenção de investimento, parceria, aprovação, números de mercado, TAM, receita, CAC, LTV, usuários ou custos.
- Quando faltarem dados, diga o que precisa ser medido e como testar.
- Discordância é bem-vinda. O coordenador deve registrar divergências relevantes em vez de fabricar consenso.
- Preserve sigilo operacional, prompts privados, chaves, tokens, dados pessoais e demais informações sensíveis.
`;

async function isAdmin(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = '/api/community/admin/state';
  url.search = '';
  const response = await creative.fetch(new Request(url.toString(), {
    method: 'GET',
    headers: request.headers
  }), env, ctx);
  return response.ok;
}

async function ensureSchema(env) {
  if (schemaReady || !env.DB) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_professional_meeting_meta (
      meeting_id INTEGER PRIMARY KEY,
      project_key TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL DEFAULT '',
      chair_key TEXT NOT NULL DEFAULT 'hakham',
      vision_context TEXT NOT NULL DEFAULT '',
      memory_context TEXT NOT NULL DEFAULT '',
      report_text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_professional_meta_project ON master_professional_meeting_meta(project_key, created_at DESC)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_project_memory (
      project_key TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      memory_text TEXT NOT NULL DEFAULT '',
      meeting_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_meeting_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      filename TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      vision_summary TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_meeting_assets_meeting ON master_meeting_assets(meeting_id, id)')
  ]);
  schemaReady = true;
}

function slugify(value) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function getActiveAgents(env) {
  const row = await env.DB.prepare('SELECT active_agents, web_search_enabled FROM master_roundtable_room WHERE id=1').first();
  let active = [...AGENT_KEYS];
  try {
    const parsed = JSON.parse(String(row?.active_agents || '[]'));
    const valid = [...new Set((Array.isArray(parsed) ? parsed : []).map(String))].filter((key) => AGENTS[key]);
    if (valid.length >= 2) active = valid;
  } catch { /* usa todos */ }
  return { active, webSearchEnabled: row ? Boolean(row.web_search_enabled) : true };
}

async function getProfile(env, key) {
  const agent = AGENTS[key];
  if (!agent) return null;
  const row = await env.DB.prepare('SELECT * FROM master_agent_profiles WHERE agent_key=? LIMIT 1').bind(key).first().catch(() => null);
  return {
    key,
    name: agent.name,
    specialty: agent.specialty,
    personality: clean(row?.personality_prompt || '', 7000),
    knowledge: clean(row?.knowledge_prompt || '', 12000),
    behavior: clean(row?.behavior_prompt || '', 7000)
  };
}

function normalizeReply(value, max = 24000) {
  return String(value || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

function extractResponseText(payload, max = 24000) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return normalizeReply(payload.output_text, max);
  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return normalizeReply(parts.join('\n'), max);
}

function extractSources(payload) {
  const found = [];
  const add = (source) => {
    if (!source || typeof source !== 'object') return;
    const url = String(source.url || source.uri || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    let fallback = url;
    try { fallback = new URL(url).hostname; } catch { /* noop */ }
    found.push({ url, title: clean(source.title || source.name || fallback, 180) });
  };
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    const sources = item?.action?.sources || item?.sources || [];
    if (Array.isArray(sources)) sources.forEach(add);
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) {
        if (annotation?.type === 'url_citation') add(annotation);
      }
    }
  }
  const seen = new Set();
  return found.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 12);
}

function webTool(request, key = '') {
  const tool = {
    type: 'web_search',
    search_context_size: RESEARCH_AGENTS.has(key) ? 'medium' : 'low'
  };
  const cf = request.cf || {};
  if (cf.country) {
    tool.user_location = {
      type: 'approximate',
      country: String(cf.country).slice(0, 2),
      ...(cf.city ? { city: String(cf.city).slice(0, 80) } : {}),
      ...(cf.region ? { region: String(cf.region).slice(0, 80) } : {})
    };
  }
  return tool;
}

async function callResponse(env, request, { instructions, input, webSearch = false, agentKey = '', max = 24000 }) {
  if (!env.OPENAI_API_KEY) return { reply: 'Modo demonstração: OPENAI_API_KEY não configurada.', sources: [] };
  const body = {
    model: env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions,
    input
  };
  if (webSearch) body.tools = [webTool(request, agentKey)];
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI ${response.status}`);
  return { reply: extractResponseText(payload, max), sources: extractSources(payload) };
}

function sanitizeImages(images) {
  const safe = [];
  for (const item of Array.isArray(images) ? images.slice(0, 4) : []) {
    const name = clean(item?.name || 'imagem', 120);
    const type = clean(item?.type || '', 60).toLowerCase();
    const size = Math.max(0, Number(item?.size || 0));
    const dataUrl = String(item?.dataUrl || '');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) continue;
    if (size > 4 * 1024 * 1024) continue;
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(dataUrl)) continue;
    if (dataUrl.length > 6_000_000) continue;
    safe.push({ name, type, size, dataUrl });
  }
  return safe;
}

async function analyzeImages(env, request, images, brief) {
  if (!images.length) return '';
  if (!env.OPENAI_API_KEY) return `Foram anexadas ${images.length} imagens, mas a análise visual está indisponível no modo demonstração.`;
  const content = [{
    type: 'input_text',
    text: `Analise as imagens como material de uma reunião profissional de produto. Extraia detalhes visuais úteis, textos legíveis, fluxos, telas, marca, elementos de UX, problemas, oportunidades, inconsistências e tudo que possa alterar a análise. Não invente o que não estiver visível. Contexto do briefing:\n${clean(brief, 9000)}`
  }];
  for (const image of images) content.push({ type: 'input_image', image_url: image.dataUrl });
  const result = await callResponse(env, request, {
    instructions: 'Você é o módulo de visão da Mesa Criativa SER IA Master. Produza memória visual factual e estruturada para os demais especialistas. Não faça a decisão final do produto.',
    input: [{ role: 'user', content }],
    max: 12000
  });
  return result.reply;
}

async function distillBrief(env, request, brief) {
  if (brief.length <= 18000 || !env.OPENAI_API_KEY) return brief;
  const result = await callResponse(env, request, {
    instructions: `Você prepara briefings extensos para uma equipe profissional multiagente. Comprima sem perder requisitos, nomes, números, restrições, decisões, hipóteses, público, integrações, regras e exceções. Não acrescente fatos. Organize em seções claras. O original ficará arquivado, portanto sua função é criar um contexto operacional fiel para a reunião.`,
    input: brief,
    max: 18000
  });
  return result.reply || brief.slice(0, 18000);
}

async function loadProjectMemory(env, projectKey) {
  if (!projectKey) return '';
  const row = await env.DB.prepare('SELECT memory_text FROM master_project_memory WHERE project_key=? LIMIT 1').bind(projectKey).first();
  return clean(row?.memory_text || '', 24000);
}

async function saveRoundtableMessage(env, speaker, displayName, content, sources = []) {
  await env.DB.prepare(`
    INSERT INTO master_roundtable_messages (speaker, display_name, content, sources_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    speaker,
    clean(displayName, 100),
    clean(content, 6500),
    JSON.stringify((Array.isArray(sources) ? sources : []).slice(0, 10)),
    Date.now()
  ).run();
}

async function saveContribution(env, meetingId, key, phase, result) {
  await env.DB.prepare(`
    INSERT INTO master_creative_meeting_contributions
      (meeting_id, agent_key, phase, content, sources_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    meetingId,
    key,
    clean(phase, 120),
    clean(result.reply, 24000),
    JSON.stringify((Array.isArray(result.sources) ? result.sources : []).slice(0, 12)),
    Date.now()
  ).run();
  await saveRoundtableMessage(env, key, AGENTS[key]?.name || key, result.reply, result.sources || []);
}

function teamContext(entries, max = 30000) {
  return clean((Array.isArray(entries) ? entries : []).map((entry) => {
    const agent = AGENTS[entry.key];
    return `${agent?.name || entry.key} · ${agent?.specialty || ''}\n${entry.reply}`;
  }).join('\n\n'), max);
}

function sourceContext(entries) {
  const all = [];
  const seen = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const source of Array.isArray(entry.sources) ? entry.sources : []) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      all.push(`${source.title || source.url} — ${source.url}`);
      if (all.length >= 30) return all.join('\n');
    }
  }
  return all.join('\n');
}

async function callChairOpening(env, request, chairKey, brief, memory, vision, participants, webSearchEnabled) {
  const chair = await getProfile(env, chairKey);
  const team = participants.map((key) => `${AGENTS[key].name}: ${AGENTS[key].specialty}`).join('\n');
  return callResponse(env, request, {
    instructions: `Você é ${chair.name}, coordenador desta reunião profissional do SER IA Master.\n${chair.personality}\n${chair.behavior}\n${MEETING_RULES}\nSua função agora é assumir a mesa: interpretar o briefing, declarar as perguntas decisivas, distribuir foco entre os especialistas e estabelecer o que precisa ser comprovado antes da síntese. Não entregue ainda o relatório final.`,
    input: `BRIEF OPERACIONAL\n${brief}\n\nMEMÓRIA DO PROJETO\n${memory || '(primeira reunião ou memória desativada)'}\n\nMEMÓRIA VISUAL\n${vision || '(sem imagens)'}\n\nEQUIPE DISPONÍVEL\n${team}`,
    webSearch: Boolean(webSearchEnabled),
    agentKey: chairKey,
    max: 7000
  });
}

async function callSpecialist(env, request, key, brief, memory, vision, chairOpening, prior, phase, webSearchEnabled) {
  const profile = await getProfile(env, key);
  const customKnowledge = profile.knowledge ? `\nCONHECIMENTO PERSONALIZADO\n${profile.knowledge}` : '';
  return callResponse(env, request, {
    instructions: `Você é ${profile.name}, especialista da Mesa Criativa SER IA Master.\nESPECIALIDADE: ${profile.specialty}\nPERSONALIDADE: ${profile.personality || 'profissional, crítica e colaborativa'}\nCOMPORTAMENTO: ${profile.behavior || 'analise profundamente dentro da sua especialidade'}${customKnowledge}\n${MEETING_RULES}\nO coordenador da mesa já definiu a pauta. Responda como especialista: aprofunde, pesquise quando necessário, cite fatos atuais apenas quando verificados e não repita os colegas. Entregue achados, riscos, oportunidades, decisões ou testes úteis.`,
    input: `FASE: ${phase}\n\nBRIEF OPERACIONAL\n${brief}\n\nMEMÓRIA DURADOURA DO PROJETO\n${memory || '(sem memória anterior)'}\n\nCONTEXTO VISUAL\n${vision || '(sem imagens)'}\n\nORIENTAÇÃO DO COORDENADOR\n${chairOpening}\n\nCONTRIBUIÇÕES ANTERIORES\n${prior || '(nenhuma ainda)'}`,
    webSearch: Boolean(webSearchEnabled),
    agentKey: key,
    max: 9000
  });
}

async function runWave(env, request, meetingId, keys, brief, memory, vision, chairOpening, prior, phase, webSearchEnabled) {
  const settled = await Promise.allSettled(keys.map(async (key) => ({
    key,
    ...(await callSpecialist(env, request, key, brief, memory, vision, chairOpening, prior, phase, webSearchEnabled))
  })));
  const results = [];
  for (const item of settled) {
    if (item.status !== 'fulfilled') {
      console.error('Professional meeting specialist failure', item.reason);
      continue;
    }
    results.push(item.value);
    await saveContribution(env, meetingId, item.value.key, phase, item.value);
  }
  return results;
}

async function callChairReport(env, request, chairKey, brief, memory, vision, opening, contributions, webSearchEnabled) {
  const chair = await getProfile(env, chairKey);
  const sources = sourceContext(contributions);
  return callResponse(env, request, {
    instructions: `Você é ${chair.name}, coordenador responsável pela decisão e pelo relatório final da reunião.\n${chair.personality}\n${chair.behavior}\n${MEETING_RULES}\nProduza um RELATÓRIO PROFISSIONAL DETALHADO. Consolide a equipe sem apagar divergências. Não invente fatos. Sempre diferencie evidência, hipótese e recomendação. Estruture, quando aplicável: 1) resumo executivo e decisão; 2) problema e proposta de valor; 3) público e jobs-to-be-done; 4) mercado, concorrentes e diferenciação; 5) produto/MVP e experiência; 6) tecnologia e escalabilidade; 7) modelo de negócio e métricas; 8) marketing e go-to-market; 9) investidores, aceleradoras, parceiros e capital com fit plausível, nunca interesse presumido; 10) riscos e red team; 11) plano 30/60/90 dias; 12) testes e métricas de validação; 13) perguntas em aberto; 14) fontes e sinais de mercado. Seja detalhado, objetivo e acionável.`,
    input: `BRIEF OPERACIONAL\n${brief}\n\nMEMÓRIA ANTERIOR DO PROJETO\n${memory || '(sem memória anterior)'}\n\nMEMÓRIA VISUAL\n${vision || '(sem imagens)'}\n\nABERTURA DO COORDENADOR\n${opening}\n\nCONTRIBUIÇÕES DA EQUIPE\n${teamContext(contributions, 42000)}\n\nFONTES COLETADAS\n${sources || '(nenhuma fonte web coletada)'}`,
    webSearch: Boolean(webSearchEnabled),
    agentKey: chairKey,
    max: 28000
  });
}

async function refreshProjectMemory(env, request, projectKey, projectName, previousMemory, meetingId, brief, vision, report) {
  if (!projectKey) return;
  let memoryText = clean(`${previousMemory}\n\nREUNIÃO #${meetingId}\n${report}`, 28000);
  if (env.OPENAI_API_KEY) {
    try {
      const result = await callResponse(env, request, {
        instructions: `Você mantém a memória duradoura de um projeto profissional. Atualize a memória com fatos, decisões, restrições, arquitetura, público, hipóteses, métricas, riscos, pendências e aprendizados que possam ser necessários em reuniões futuras. Remova repetição e conversa passageira. Não invente nada. Preserve mudanças de decisão com contexto temporal.`,
        input: `PROJETO: ${projectName}\n\nMEMÓRIA ANTERIOR\n${previousMemory || '(vazia)'}\n\nBRIEF DA NOVA REUNIÃO\n${clean(brief, 10000)}\n\nCONTEXTO VISUAL\n${clean(vision, 6000)}\n\nRELATÓRIO FINAL\n${clean(report, 22000)}`,
        max: 24000
      });
      if (result.reply) memoryText = result.reply;
    } catch (error) {
      console.error('Project memory refresh failure', error);
    }
  }
  await env.DB.prepare(`
    INSERT INTO master_project_memory (project_key, project_name, memory_text, meeting_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(project_key) DO UPDATE SET
      project_name=excluded.project_name,
      memory_text=excluded.memory_text,
      meeting_count=master_project_memory.meeting_count + 1,
      updated_at=excluded.updated_at
  `).bind(projectKey, projectName, clean(memoryText, 28000), Date.now()).run();
}

async function handleStart(request, env, ctx) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  if (!env.DB) return json({ error: 'D1 indisponível.' }, 503);
  await ensureSchema(env);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }

  const briefOriginal = clean(body.brief, 50000);
  if (briefOriginal.length < 12) return json({ error: 'Envie um briefing com mais contexto antes de convocar a equipe.' }, 400);

  const projectName = clean(body.projectName || '', 120);
  const projectKey = projectName ? slugify(projectName) : '';
  const chairKey = AGENTS[String(body.chair || '').toLowerCase()] ? String(body.chair).toLowerCase() : 'hakham';
  const useMemory = body.useMemory !== false;
  const images = sanitizeImages(body.images);
  const { active, webSearchEnabled } = await getActiveAgents(env);
  const participants = active.filter((key) => key !== chairKey);
  if (!participants.length) return json({ error: 'Mantenha pelo menos um especialista além do coordenador.' }, 400);

  const created = await env.DB.prepare(`
    INSERT INTO master_creative_meetings (brief, status, created_at)
    VALUES (?, 'running', ?)
  `).bind(briefOriginal, Date.now()).run();
  const meetingId = Number(created.meta?.last_row_id || 0);
  if (!meetingId) return json({ error: 'Não foi possível abrir a reunião.' }, 500);

  let memory = '';
  if (useMemory && projectKey) memory = await loadProjectMemory(env, projectKey);

  let vision = '';
  try { vision = await analyzeImages(env, request, images, briefOriginal); }
  catch (error) {
    console.error('Meeting vision failure', error);
    vision = `A análise visual falhou nesta reunião. Arquivos recebidos: ${images.map((item) => item.name).join(', ') || 'nenhum'}.`;
  }

  let operationalBrief = briefOriginal;
  try { operationalBrief = await distillBrief(env, request, briefOriginal); }
  catch (error) {
    console.error('Brief distillation failure', error);
    operationalBrief = briefOriginal.slice(0, 18000);
  }

  const now = Date.now();
  await env.DB.prepare(`
    INSERT OR REPLACE INTO master_professional_meeting_meta
      (meeting_id, project_key, project_name, chair_key, vision_context, memory_context, report_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
  `).bind(meetingId, projectKey, projectName, chairKey, clean(vision, 16000), clean(memory, 24000), now, now).run();

  for (const image of images) {
    await env.DB.prepare(`
      INSERT INTO master_meeting_assets (meeting_id, filename, mime_type, size_bytes, vision_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(meetingId, image.name, image.type, image.size, clean(vision, 12000), Date.now()).run();
  }

  await saveRoundtableMessage(
    env,
    'admin',
    'Super Admin',
    `Reunião profissional #${meetingId}${projectName ? ` · ${projectName}` : ''}\nCoordenador: ${AGENTS[chairKey].name}\n\n${clean(briefOriginal, 5200)}`,
    []
  );

  let opening;
  try {
    opening = await callChairOpening(env, request, chairKey, operationalBrief, memory, vision, participants, webSearchEnabled);
    await saveContribution(env, meetingId, chairKey, '0 · Coordenação e pauta', opening);
  } catch (error) {
    console.error('Chair opening failure', error);
    opening = { reply: `${AGENTS[chairKey].name} assumiu a coordenação. A equipe seguirá análise por especialidade e consolidará divergências no relatório final.`, sources: [] };
    await saveContribution(env, meetingId, chairKey, '0 · Coordenação e pauta', opening);
  }

  const wave1Keys = DISCOVERY_ORDER.filter((key) => participants.includes(key));
  const wave2Keys = participants.filter((key) => !wave1Keys.includes(key));

  const wave1 = await runWave(
    env, request, meetingId, wave1Keys, operationalBrief, memory, vision, opening.reply,
    '', '1 · Descoberta, mercado, evidências e viabilidade', webSearchEnabled
  );

  const wave2 = await runWave(
    env, request, meetingId, wave2Keys, operationalBrief, memory, vision, opening.reply,
    teamContext(wave1, 22000), '2 · Produto, crescimento, operação e execução', webSearchEnabled
  );

  const contributions = [...wave1, ...wave2];
  let finalReport;
  try {
    finalReport = await callChairReport(env, request, chairKey, operationalBrief, memory, vision, opening.reply, contributions, webSearchEnabled);
  } catch (error) {
    console.error('Chair report failure', error);
    finalReport = {
      reply: `Relatório provisório da reunião #${meetingId}.\n\n${teamContext(contributions, 22000)}`,
      sources: []
    };
  }

  await saveContribution(env, meetingId, chairKey, '3 · Relatório final do coordenador', finalReport);
  await env.DB.prepare(`
    UPDATE master_creative_meetings
    SET status='completed', synthesis=?, completed_at=?
    WHERE id=?
  `).bind(clean(finalReport.reply, 28000), Date.now(), meetingId).run();
  await env.DB.prepare(`
    UPDATE master_professional_meeting_meta
    SET report_text=?, updated_at=? WHERE meeting_id=?
  `).bind(clean(finalReport.reply, 28000), Date.now(), meetingId).run();

  if (projectKey && useMemory) {
    ctx.waitUntil(refreshProjectMemory(
      env, request, projectKey, projectName, memory, meetingId, operationalBrief, vision, finalReport.reply
    ));
  }

  return json({
    ok: true,
    meetingId,
    projectName,
    chair: chairKey,
    chairName: AGENTS[chairKey].name,
    contributions: contributions.length + 2,
    imagesAnalyzed: images.length,
    memoryUsed: Boolean(memory),
    reportUrl: `/api/pro/meeting/${meetingId}/report.pdf`
  });
}

async function getMeetingReportData(env, meetingId) {
  await ensureSchema(env);
  const meeting = await env.DB.prepare('SELECT * FROM master_creative_meetings WHERE id=? LIMIT 1').bind(meetingId).first();
  if (!meeting) return null;
  const meta = await env.DB.prepare('SELECT * FROM master_professional_meeting_meta WHERE meeting_id=? LIMIT 1').bind(meetingId).first();
  const result = await env.DB.prepare(`
    SELECT agent_key, phase, content, sources_json, created_at
    FROM master_creative_meeting_contributions
    WHERE meeting_id=? ORDER BY id ASC
  `).bind(meetingId).all();
  return { meeting, meta: meta || {}, contributions: result.results || [] };
}

function pdfClean(value) {
  return String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?');
}

function pdfEscape(value) {
  return pdfClean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfText(value, width = 92) {
  const lines = [];
  for (const rawLine of pdfClean(value).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) { lines.push(''); continue; }
    const words = line.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) { current = word; continue; }
      if ((current + ' ' + word).length <= width) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function toLatin1Bytes(binaryString) {
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) bytes[i] = binaryString.charCodeAt(i) & 0xff;
  return bytes;
}

function buildPdf(title, body) {
  const allLines = [pdfClean(title), '', ...wrapPdfText(body, 92)];
  const pageSize = 50;
  const chunks = [];
  for (let i = 0; i < allLines.length; i += pageSize) chunks.push(allLines.slice(i, i + pageSize));
  if (!chunks.length) chunks.push(['Relatório vazio.']);

  const objects = {};
  const kids = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  chunks.forEach((lines, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const commands = ['BT', '/F1 10 Tf', '50 790 Td', '14 TL'];
    for (const line of lines) {
      commands.push(`(${pdfEscape(line)}) Tj`);
      commands.push('T*');
    }
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  const maxId = 3 + chunks.length * 2;
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = new Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return toLatin1Bytes(pdf);
}

async function handlePdf(request, env, ctx, meetingId) {
  if (!(await isAdmin(request, env, ctx))) return json({ error: 'Acesso restrito ao Super Admin.' }, 401);
  if (!env.DB) return json({ error: 'D1 indisponível.' }, 503);
  const data = await getMeetingReportData(env, meetingId);
  if (!data) return json({ error: 'Reunião não encontrada.' }, 404);

  const chairKey = String(data.meta?.chair_key || 'hakham');
  const projectName = clean(data.meta?.project_name || '', 120);
  const report = clean(data.meta?.report_text || data.meeting.synthesis || '', 28000);
  const sourceLines = [];
  const seen = new Set();
  for (const contribution of data.contributions) {
    let sources = [];
    try { sources = JSON.parse(contribution.sources_json || '[]'); } catch { sources = []; }
    for (const source of sources) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      sourceLines.push(`${source.title || source.url}: ${source.url}`);
    }
  }

  const body = [
    `Projeto: ${projectName || 'Sem nome informado'}`,
    `Reunião: #${meetingId}`,
    `Coordenador: ${AGENTS[chairKey]?.name || chairKey}`,
    `Data: ${new Date(Number(data.meeting.created_at || Date.now())).toISOString()}`,
    '',
    'BRIEFING ORIGINAL',
    clean(data.meeting.brief, 14000),
    '',
    data.meta?.vision_context ? `CONTEXTO VISUAL\n${clean(data.meta.vision_context, 8000)}\n` : '',
    'RELATÓRIO FINAL',
    report || 'Relatório ainda não disponível.',
    '',
    sourceLines.length ? `FONTES COLETADAS\n${sourceLines.join('\n')}` : 'FONTES COLETADAS\nNenhuma fonte web registrada.'
  ].filter(Boolean).join('\n');

  const bytes = buildPdf(`SER IA Master · Relatório da Reunião #${meetingId}`, body);
  const safeName = slugify(projectName || `reuniao-${meetingId}`) || `reuniao-${meetingId}`;
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="SER-IA-Master-${safeName}-${meetingId}.pdf"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/pro/meeting/start') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return handleStart(request, env, ctx);
    }

    const pdfMatch = url.pathname.match(/^\/api\/pro\/meeting\/(\d+)\/report\.pdf$/);
    if (pdfMatch) {
      if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
      return handlePdf(request, env, ctx, Number(pdfMatch[1]));
    }

    return creative.fetch(request, env, ctx);
  }
};
