const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
});

const AGENT_INSTRUCTIONS = `Você é o SER IA Assistente, agente oficial do site da SER comtec.

OBJETIVO
Atue como especialista em vendas e suporte técnico. Seja claro, profissional, consultivo e breve. Faça perguntas somente quando forem úteis. Nunca invente preços, prazos, integrações ou funcionalidades não confirmadas.

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

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  if (!Array.isArray(payload?.output)) return '';
  const parts = [];
  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('\n').trim();
}

function demoReply(message) {
  const text = message.toLowerCase();
  if (text.includes('suporte') || text.includes('erro') || text.includes('problema')) {
    return 'Posso ajudar a direcionar o suporte. Qual produto você está usando: SERhub, NegocIAJá ou SER IA MASTER? Se houver erro, envie também a mensagem exibida. Para atendimento humano: suporte@sercomtec.com.br ou WhatsApp (85) 99166-5259.';
  }
  if (text.includes('serhub')) {
    return 'O SERhub centraliza clientes, produtos, serviços, orçamentos, pedidos, ordens de serviço, recibos, relatórios e a operação do negócio em um único ambiente. Posso entender seu segmento e mostrar onde ele pode ajudar.';
  }
  if (text.includes('negocia')) {
    return 'O NegocIAJá é focado em transformar conversas em vendas, reunindo atendimento, catálogo, pedidos, pagamentos e IA. Quer me dizer como sua empresa vende hoje?';
  }
  if (text.includes('master') || text.includes('grupo') || text.includes('produção')) {
    return 'O SER IA MASTER atende clientes e também pode atuar em grupos internos autorizados, apoiando a equipe com status de pedidos, produção, relatórios e informações operacionais conforme as integrações e permissões configuradas.';
  }
  if (text.includes('automação') || text.includes('automat')) {
    return 'A SER comtec também desenvolve automações sob medida. Primeiro entendemos o processo e os gargalos; depois projetamos integrações e fluxos de IA adequados ao seu segmento. O que você gostaria de automatizar hoje?';
  }
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

  if (!env.OPENAI_API_KEY) {
    return json({ reply: demoReply(lastUser.content), mode: 'demo' });
  }

  const input = clean.map((m) => ({ role: m.role, content: m.content }));
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: AGENT_INSTRUCTIONS,
      input,
      max_output_tokens: 450,
    }),
  });

  if (!response.ok) {
    console.error('OpenAI error', response.status, await response.text());
    return json({ error: 'O assistente está temporariamente indisponível. Fale com nossa equipe pelo WhatsApp (85) 99166-5259.' }, 502);
  }

  const payload = await response.json();
  const reply = extractResponseText(payload);
  return json({ reply: reply || demoReply(lastUser.content), mode: 'ai' });
}

function normalizePhone(value) {
  return value.replace(/\D/g, '').slice(0, 15);
}

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

  if (!nome || whatsapp.length < 10 || !email.includes('@') || !mensagem) {
    return json({ ok: false, error: 'Preencha nome, WhatsApp, e-mail e mensagem.' }, 400);
  }

  const lead = {
    source: 'sercomtec.com.br',
    createdAt: new Date().toISOString(),
    nome,
    empresa,
    whatsapp,
    email,
    segmento,
    interests,
    mensagem,
  };

  let stored = false;
  let leadId = null;

  if (env.DB) {
    try {
      leadId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO leads (id, source, created_at, nome, empresa, whatsapp, email, segmento, interests_json, mensagem, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo')
      `).bind(
        leadId, lead.source, lead.createdAt, lead.nome, lead.empresa, lead.whatsapp, lead.email,
        lead.segmento, JSON.stringify(lead.interests), lead.mensagem
      ).run();
      stored = true;
    } catch (error) {
      console.error('D1 lead storage failure', error);
    }
  }

  if (env.LEADS_WEBHOOK_URL) {
    const headers = { 'content-type': 'application/json' };
    if (env.CONTACT_WEBHOOK_TOKEN) headers.authorization = `Bearer ${env.CONTACT_WEBHOOK_TOKEN}`;
    try {
      const result = await fetch(env.LEADS_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(lead) });
      stored = stored || result.ok;
      if (!result.ok) console.error('Lead webhook error', result.status, await result.text());
    } catch (error) {
      console.error('Lead webhook failure', error);
    }
  }

  const waText = [
    `Olá, sou ${nome}${empresa ? ` da ${empresa}` : ''}.`,
    interests.length ? `Tenho interesse em: ${interests.join(', ')}.` : '',
    segmento ? `Segmento: ${segmento}.` : '',
    `Necessidade: ${mensagem}`,
  ].filter(Boolean).join('\n');

  const whatsappUrl = `https://wa.me/5585991665259?text=${encodeURIComponent(waText)}`;
  return json({ ok: true, stored, leadId, whatsappUrl });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') return json({
      ok: true,
      service: 'ser-comtec-site',
      time: new Date().toISOString(),
      bindings: {
        db: Boolean(env.DB),
        files: Boolean(env.FILES),
        openai: Boolean(env.OPENAI_API_KEY),
      },
    });

    if (url.pathname === '/api/chat') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return handleChat(request, env);
    }

    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);
      return handleContact(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
