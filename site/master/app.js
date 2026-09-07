const AGENTS = {
  hakham: {
    name: 'Hakham',
    avatar: 'H',
    specialty: 'Estratégia, negócios e automação',
    hello: 'Shalom! Eu sou Hakham. Posso conversar sobre estratégia, negócios, IA, automação, processos, riscos e crescimento. Qual desafio você quer analisar?',
    prompts: ['Como automatizar meu atendimento?', 'Analise uma ideia de negócio', 'Como encontrar gargalos?']
  },
  arcanum: {
    name: 'Arcanum',
    avatar: 'A',
    specialty: 'Branding, design e direção de arte',
    hello: 'Eu sou Arcanum. Minha praia é branding, direção de arte, identidade visual, design gráfico e comunicação visual. O que você quer criar ou melhorar?',
    prompts: ['Como fortalecer minha marca?', 'Avalie uma identidade visual', 'Ideias para uma campanha']
  },
  serafim: {
    name: 'Serafim',
    avatar: 'S',
    specialty: 'Web, sistemas e integrações',
    hello: 'Eu sou Serafim. Posso ajudar com sites, sistemas, APIs, UX, SEO técnico, Cloudflare e integrações. O que você quer construir ou diagnosticar?',
    prompts: ['Arquitetura para um SaaS', 'Como integrar uma API?', 'Melhorar a performance do site']
  },
  serena: {
    name: 'Serena',
    avatar: 'Se',
    specialty: 'Design, comunicação e conteúdo',
    hello: 'Eu sou Serena. Trabalho com comunicação, conteúdo, campanhas e direção estética. Me conte a marca, o público e o objetivo da mensagem.',
    prompts: ['Crie uma linha editorial', 'Como melhorar uma campanha?', 'Ideias para redes sociais']
  },
  luna: {
    name: 'Luna',
    avatar: 'L',
    specialty: 'Educação, estudos e aprendizagem',
    hello: 'Olá! Eu sou Luna. Posso explicar conteúdos, criar exercícios e montar trilhas de estudo de um jeito claro e progressivo. O que você quer aprender?',
    prompts: ['Explique frações de forma simples', 'Monte um plano de estudos', 'Quero começar a programar']
  },
  delta: {
    name: 'Delta',
    avatar: 'D',
    specialty: 'Pesquisa, análise e síntese',
    hello: 'Eu sou Delta. Posso organizar informações, comparar alternativas, estruturar pesquisas e destacar evidências, riscos e incertezas. Qual tema vamos analisar?',
    prompts: ['Compare duas alternativas', 'Estruture uma pesquisa', 'Ajude numa decisão']
  }
};

const state = {
  currentAgent: 'hakham',
  histories: Object.fromEntries(Object.keys(AGENTS).map((key) => [key, []])),
  busy: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const messagesEl = $('#chat-messages');
const promptsEl = $('#quick-prompts');
const form = $('#chat-form');
const input = $('#chat-input');
const sendButton = $('.send-button');
const navToggle = $('.nav-toggle');
const nav = $('#main-nav');

function nowTime() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function addMessage(role, content, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}${options.typing ? ' typing' : ''}`;

  const bubble = document.createElement('p');
  if (options.typing) {
    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    bubble.append(dots);
  } else {
    bubble.textContent = content;
  }

  wrapper.append(bubble);
  if (!options.typing) {
    const time = document.createElement('small');
    time.textContent = options.time || nowTime();
    wrapper.append(time);
  }

  messagesEl.append(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrapper;
}

function renderHistory() {
  messagesEl.replaceChildren();
  const history = state.histories[state.currentAgent];
  const agent = AGENTS[state.currentAgent];

  if (!history.length) {
    history.push({ role: 'assistant', content: agent.hello, time: nowTime(), local: true });
  }

  history.forEach((message) => addMessage(message.role, message.content, { time: message.time }));
}

function renderPrompts() {
  promptsEl.replaceChildren();
  AGENTS[state.currentAgent].prompts.forEach((prompt) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-prompt';
    button.textContent = prompt;
    button.addEventListener('click', () => {
      input.value = prompt;
      resizeInput();
      input.focus();
    });
    promptsEl.append(button);
  });
}

function selectAgent(agentKey, scroll = false) {
  if (!AGENTS[agentKey] || state.busy) return;
  state.currentAgent = agentKey;
  const agent = AGENTS[agentKey];

  $$('.agent-option').forEach((button) => {
    const active = button.dataset.agent === agentKey;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  $('#chat-avatar').textContent = agent.avatar;
  $('#chat-agent-name').textContent = agent.name;
  $('#chat-agent-specialty').textContent = agent.specialty;
  input.placeholder = `Converse com ${agent.name}...`;
  renderHistory();
  renderPrompts();

  if (scroll) {
    $('#master-chat').scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => input.focus(), 450);
  }
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

async function sendMessage(text) {
  if (!text || state.busy) return;
  const agentKey = state.currentAgent;
  const history = state.histories[agentKey];
  const userMessage = { role: 'user', content: text, time: nowTime() };
  history.push(userMessage);
  addMessage('user', text, { time: userMessage.time });

  state.busy = true;
  sendButton.disabled = true;
  $$('.agent-option').forEach((button) => { button.disabled = true; });
  const typing = addMessage('assistant', '', { typing: true });

  try {
    const payloadMessages = history
      .filter((message) => !message.local)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    const response = await fetch('/api/master/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: agentKey, messages: payloadMessages })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.reply) {
      throw new Error(data.error || 'Não foi possível receber uma resposta agora.');
    }

    typing.remove();
    const reply = { role: 'assistant', content: data.reply, time: nowTime() };
    history.push(reply);
    if (state.currentAgent === agentKey) addMessage('assistant', reply.content, { time: reply.time });
  } catch (error) {
    typing.remove();
    const reply = {
      role: 'assistant',
      content: `Não consegui responder agora. ${error.message || 'Tente novamente em instantes.'}`,
      time: nowTime()
    };
    history.push(reply);
    if (state.currentAgent === agentKey) addMessage('assistant', reply.content, { time: reply.time });
  } finally {
    state.busy = false;
    sendButton.disabled = false;
    $$('.agent-option').forEach((button) => { button.disabled = false; });
    input.focus();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  resizeInput();
  sendMessage(text);
});

input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

$$('.agent-option').forEach((button) => button.addEventListener('click', () => selectAgent(button.dataset.agent)));
$$('.choose-agent').forEach((button) => button.addEventListener('click', () => selectAgent(button.dataset.agent, true)));

navToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});

$$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
}));

$('#year').textContent = String(new Date().getFullYear());
selectAgent('hakham');
