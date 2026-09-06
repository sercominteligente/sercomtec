const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  admin: false,
  adminConfigured: false,
  room: null,
  agents: {},
  messages: [],
  busy: false,
  lastMessageId: 0
};

const initials = {
  hakham: 'H',
  arcanum: 'A',
  serafim: 'S',
  serena: 'Se',
  luna: 'L',
  delta: 'D',
  admin: 'SA',
  user: 'V'
};

const messagesEl = $('#messages');
const emptyState = $('#empty-state');
const composer = $('#composer');
const topicInput = $('#topic-input');
const sendRound = $('#send-round');
const thinkingBar = $('#thinking-bar');
const roomPill = $('#room-pill');
const roomTitle = $('#room-title');
const webStatus = $('#web-status');
const activeCount = $('#active-count');
const agentRoster = $('#agent-roster');
const observerNote = $('#observer-note');
const adminButton = $('#admin-button');
const guestControls = $('#guest-controls');
const adminControls = $('#admin-controls');
const roleBadge = $('#role-badge');
const adminAgentList = $('#admin-agent-list');
const loginDialog = $('#login-dialog');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const adminPassword = $('#admin-password');

function escapeUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha ${response.status}`);
  return data;
}

function agentName(key) {
  return state.agents[key]?.name || (key === 'admin' ? 'Super Admin' : key === 'user' ? 'Visitante' : key);
}

function formatTime(value) {
  const date = new Date(Number(value) || Date.now());
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function renderRoster() {
  if (!state.room) return;
  agentRoster.replaceChildren();
  const active = new Set(state.room.activeAgents || []);

  Object.entries(state.agents).forEach(([key, agent]) => {
    const card = document.createElement('div');
    card.className = `roster-agent${active.has(key) ? '' : ' muted'}`;

    const avatar = document.createElement('span');
    avatar.className = 'roster-avatar';
    avatar.textContent = initials[key] || agent.name.slice(0, 1);

    const copy = document.createElement('span');
    copy.className = 'roster-copy';
    const name = document.createElement('b');
    name.textContent = agent.name;
    const specialty = document.createElement('small');
    specialty.textContent = agent.specialty;
    copy.append(name, specialty);

    const dot = document.createElement('i');
    dot.className = 'roster-dot';
    dot.title = active.has(key) ? 'Ativo' : 'Fora desta mesa';

    card.append(avatar, copy, dot);
    agentRoster.append(card);
  });

  activeCount.textContent = `${active.size} ${active.size === 1 ? 'ativo' : 'ativos'}`;
}

function renderSources(sources, target) {
  const valid = (Array.isArray(sources) ? sources : [])
    .map((source) => ({ ...source, safeUrl: escapeUrl(source.url) }))
    .filter((source) => source.safeUrl)
    .slice(0, 6);
  if (!valid.length) return;

  const list = document.createElement('div');
  list.className = 'source-list';
  valid.forEach((source) => {
    const link = document.createElement('a');
    link.href = source.safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `↗ ${source.title || new URL(source.safeUrl).hostname}`;
    link.title = source.safeUrl;
    list.append(link);
  });
  target.append(list);
}

function renderMessages(forceBottom = false) {
  const wasNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  messagesEl.replaceChildren();

  if (!state.messages.length) {
    messagesEl.append(emptyState);
    return;
  }

  state.messages.forEach((message) => {
    const speaker = message.speaker || 'user';
    const row = document.createElement('article');
    row.className = `message-row ${speaker}`;

    const avatar = document.createElement('span');
    avatar.className = 'message-avatar';
    avatar.textContent = initials[speaker] || agentName(speaker).slice(0, 2);

    const body = document.createElement('div');
    body.className = 'message-body';

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('b');
    name.textContent = message.displayName || agentName(speaker);
    const detail = document.createElement('span');
    const specialty = state.agents[speaker]?.specialty;
    detail.textContent = `${specialty ? `${specialty} · ` : ''}${formatTime(message.createdAt)}`;
    meta.append(name, detail);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.content || '';

    body.append(meta, bubble);
    renderSources(message.sources, body);
    row.append(avatar, body);
    messagesEl.append(row);
  });

  if (forceBottom || wasNearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setComposerPermission() {
  if (!state.room) return;
  const canPrompt = state.admin || (state.room.isOpen && state.room.publicCanPrompt);
  topicInput.disabled = state.busy || !canPrompt;
  sendRound.disabled = state.busy || !canPrompt;

  if (state.busy) {
    topicInput.placeholder = 'A mesa está debatendo...';
  } else if (!state.room.isOpen && !state.admin) {
    topicInput.placeholder = 'A mesa foi fechada pelo Super Admin.';
  } else if (!state.admin && !state.room.publicCanPrompt) {
    topicInput.placeholder = 'Modo observador. O Super Admin está com o microfone.';
  } else {
    topicInput.placeholder = 'Jogue um tema na mesa...';
  }
}

function renderRoomState() {
  if (!state.room) return;
  roomTitle.textContent = state.room.roomTitle || 'Bate-papo das IAs';

  roomPill.classList.toggle('closed', !state.room.isOpen);
  roomPill.querySelector('span').textContent = state.room.isOpen ? 'Mesa online' : 'Mesa fechada';

  webStatus.classList.toggle('off', !state.room.webSearchEnabled);
  webStatus.querySelector('b').textContent = state.room.webSearchEnabled ? 'Web ativa' : 'Web pausada';

  observerNote.classList.toggle('allowed', Boolean(state.room.publicCanPrompt));
  observerNote.querySelector('strong').textContent = state.room.publicCanPrompt ? 'Participação liberada' : 'Modo observador';
  observerNote.querySelector('small').textContent = state.room.publicCanPrompt
    ? 'Visitantes podem jogar temas na mesa.'
    : 'O Super Admin decide quando o público pode lançar temas.';

  renderRoster();
  setComposerPermission();
}

function renderAdminAgentList() {
  if (!state.room) return;
  adminAgentList.replaceChildren();
  const active = new Set(state.room.activeAgents || []);

  Object.entries(state.agents).forEach(([key, agent]) => {
    const label = document.createElement('label');
    label.className = 'admin-agent-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = active.has(key);
    checkbox.dataset.agent = key;
    const span = document.createElement('span');
    span.textContent = agent.name;
    label.append(checkbox, span);
    adminAgentList.append(label);
  });

  $$('input[data-agent]', adminAgentList).forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const selected = $$('input[data-agent]:checked', adminAgentList).map((input) => input.dataset.agent);
      if (selected.length < 2) {
        checkbox.checked = true;
        window.alert('Deixe pelo menos dois agentes na mesa. Um debate de uma IA só fica meio triste. 😄');
        return;
      }
      await saveRoom({ activeAgents: selected });
    });
  });
}

function renderAdmin() {
  adminButton.classList.toggle('active', state.admin);
  adminButton.textContent = state.admin ? 'Super Admin ✓' : 'Super Admin';
  roleBadge.textContent = state.admin ? 'Super Admin' : 'Visitante';
  guestControls.hidden = state.admin;
  adminControls.hidden = !state.admin;

  if (!state.admin || !state.room) return;
  $('#room-open').checked = state.room.isOpen;
  $('#public-prompt').checked = state.room.publicCanPrompt;
  $('#web-search').checked = state.room.webSearchEnabled;
  renderAdminAgentList();
}

function renderAll(forceBottom = false) {
  renderRoomState();
  renderMessages(forceBottom);
  renderAdmin();
}

async function loadState({ quiet = false, forceBottom = false } = {}) {
  try {
    const data = await api('/api/master/room');
    const newestId = data.messages?.length ? Number(data.messages[data.messages.length - 1].id || 0) : 0;
    const changed = newestId !== state.lastMessageId || Boolean(data.admin) !== state.admin;

    state.admin = Boolean(data.admin);
    state.adminConfigured = Boolean(data.adminConfigured);
    state.room = data.room;
    state.agents = data.agents || {};
    state.messages = data.messages || [];
    state.lastMessageId = newestId;

    if (!quiet || changed) renderAll(forceBottom || changed);
    else {
      renderRoomState();
      renderAdmin();
    }
  } catch (error) {
    if (!quiet) console.error(error);
  }
}

async function saveRoom(patch) {
  if (!state.admin || state.busy) return;
  try {
    const data = await api('/api/master/admin/room', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    state.room = data.room;
    renderAll();
  } catch (error) {
    window.alert(error.message);
    await loadState();
  }
}

async function submitRound(topic) {
  const text = String(topic || '').trim();
  if (!text || state.busy) return;

  state.busy = true;
  thinkingBar.hidden = false;
  setComposerPermission();
  sendRound.querySelector('span').textContent = 'Debatendo...';

  try {
    await api('/api/master/roundtable', {
      method: 'POST',
      body: JSON.stringify({ topic: text })
    });
    topicInput.value = '';
    await loadState({ forceBottom: true });
  } catch (error) {
    window.alert(error.message);
  } finally {
    state.busy = false;
    thinkingBar.hidden = true;
    sendRound.querySelector('span').textContent = 'Soltar na mesa';
    setComposerPermission();
    topicInput.focus();
  }
}

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  submitRound(topicInput.value);
});

topicInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

$$('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    topicInput.value = button.dataset.prompt || '';
    topicInput.focus();
  });
});

function openLogin() {
  if (state.admin) {
    $('#control-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  loginError.hidden = true;
  loginError.textContent = '';
  adminPassword.value = '';
  loginDialog.showModal();
  setTimeout(() => adminPassword.focus(), 50);
}

adminButton.addEventListener('click', openLogin);
$('#login-inline').addEventListener('click', openLogin);
$('#dialog-close').addEventListener('click', () => loginDialog.close());

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  try {
    await api('/api/master/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: adminPassword.value })
    });
    loginDialog.close();
    await loadState({ forceBottom: true });
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});

$('#room-open').addEventListener('change', (event) => saveRoom({ isOpen: event.target.checked }));
$('#public-prompt').addEventListener('change', (event) => saveRoom({ publicCanPrompt: event.target.checked }));
$('#web-search').addEventListener('change', (event) => saveRoom({ webSearchEnabled: event.target.checked }));

$('#continue-button').addEventListener('click', () => {
  submitRound('Continuem a conversa entre vocês. Reajam às falas anteriores, aprofundem os pontos mais interessantes e, se houver motivo, discordem de forma argumentada. Não repitam a rodada anterior.');
});

$('#clear-button').addEventListener('click', async () => {
  if (!window.confirm('Limpar todo o bate-papo da sala?')) return;
  try {
    await api('/api/master/admin/clear', { method: 'POST', body: '{}' });
    state.lastMessageId = 0;
    await loadState({ forceBottom: true });
  } catch (error) {
    window.alert(error.message);
  }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/master/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    state.admin = false;
    await loadState();
  }
});

loadState({ forceBottom: true });
setInterval(() => {
  if (!state.busy && !document.hidden) loadState({ quiet: true });
}, 5000);
