const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  admin: false,
  room: null,
  party: null,
  agents: {},
  messages: [],
  visitors: [],
  busy: false,
  lastMessageId: 0
};

const initials = {
  hakham: 'H', arcanum: 'A', serafim: 'S', serena: 'Se', luna: 'L', delta: 'D',
  orion: 'O', lyra: 'Ly', nova: 'N', polaris: 'P', sirius: 'Si', admin: 'SA', user: 'V'
};

const adminShell = $('#admin-shell');
const loginDialog = $('#login-dialog');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const passwordInput = $('#admin-password');
const messagesEl = $('#messages');
const visitorList = $('#visitor-list');
const agentToggles = $('#agent-toggles');
const thinking = $('#thinking');

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
  if (!response.ok) {
    const error = new Error(data.error || `Falha ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(Number(value) || Date.now()));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function renderSources(sources, target) {
  const valid = (Array.isArray(sources) ? sources : [])
    .map((source) => ({ ...source, url: safeUrl(source.url) }))
    .filter((source) => source.url)
    .slice(0, 6);
  if (!valid.length) return;
  const list = document.createElement('div');
  list.className = 'sources';
  valid.forEach((source) => {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `↗ ${source.title || new URL(source.url).hostname}`;
    list.append(link);
  });
  target.append(list);
}

function renderMessages(forceBottom = false) {
  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  messagesEl.replaceChildren();
  state.messages.forEach((message) => {
    const speaker = message.speaker || 'user';
    const row = document.createElement('article');
    row.className = `message ${speaker}`;
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials[speaker] || String(message.displayName || '?').slice(0, 2);
    const body = document.createElement('div');
    body.className = 'body';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('b');
    name.textContent = message.displayName || state.agents[speaker]?.name || 'Visitante';
    const detail = document.createElement('span');
    detail.textContent = `${state.agents[speaker]?.specialty ? `${state.agents[speaker].specialty} · ` : ''}${formatTime(message.createdAt)}`;
    meta.append(name, detail);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message.content || '';
    body.append(meta, bubble);
    renderSources(message.sources, body);
    row.append(avatar, body);
    messagesEl.append(row);
  });
  if (forceBottom || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderVisitors() {
  visitorList.replaceChildren();
  $('#online-count').textContent = String(state.visitors.length);
  if (!state.visitors.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-visitors';
    empty.textContent = 'Ninguém ativo nos últimos 2 minutos.';
    visitorList.append(empty);
    return;
  }
  state.visitors.forEach((visitor) => {
    const card = document.createElement('div');
    card.className = 'visitor-card';
    const name = document.createElement('b');
    name.textContent = visitor.display_name;
    const meta = document.createElement('small');
    const left = Math.max(0, Number(visitor.expires_at || 0) - Date.now());
    meta.textContent = `última atividade ${formatTime(visitor.last_seen_at)} · sessão encerra em ~${Math.ceil(left / 60000)} min`;
    card.append(name, meta);
    visitorList.append(card);
  });
}

function renderAgents() {
  agentToggles.replaceChildren();
  const active = new Set(state.room?.activeAgents || []);
  Object.entries(state.agents).forEach(([key, agent]) => {
    const label = document.createElement('label');
    label.className = 'agent-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = active.has(key);
    checkbox.dataset.agent = key;
    const span = document.createElement('span');
    span.textContent = `${agent.name} · ${agent.specialty}`;
    label.append(checkbox, span);
    agentToggles.append(label);
    checkbox.addEventListener('change', saveSelectedAgents);
  });
  $('#active-count').textContent = String(active.size);
}

async function saveSelectedAgents(event) {
  const selected = $$('input[data-agent]:checked', agentToggles).map((input) => input.dataset.agent);
  if (selected.length < 2) {
    event.target.checked = true;
    window.alert('Mantenha pelo menos dois agentes ativos.');
    return;
  }
  await saveRoom({ activeAgents: selected });
}

function renderControls() {
  if (!state.room || !state.party) return;
  $('#room-title').textContent = state.room.roomTitle || 'Bate-papo das IAs';
  $('#room-open').checked = state.room.isOpen;
  $('#public-prompt').checked = state.room.publicCanPrompt;
  $('#web-search').checked = state.room.webSearchEnabled;
  $('#autopilot').checked = state.party.enabled;
  $('#interval').value = String(state.party.intervalSeconds || 30);
  renderAgents();
  renderVisitors();
}

async function loadState({ forceBottom = false, quiet = false } = {}) {
  try {
    const data = await api('/api/community/admin/state');
    state.admin = true;
    state.room = data.room;
    state.party = data.party;
    state.agents = data.agents || {};
    state.messages = data.messages || [];
    state.visitors = data.visitors || [];
    const newest = state.messages.length ? Number(state.messages[state.messages.length - 1].id || 0) : 0;
    const changed = newest !== state.lastMessageId;
    state.lastMessageId = newest;
    adminShell.hidden = false;
    $('#logout-button').hidden = false;
    renderControls();
    if (!quiet || changed) renderMessages(forceBottom || changed);
    if (loginDialog.open) loginDialog.close();
  } catch (error) {
    state.admin = false;
    adminShell.hidden = true;
    $('#logout-button').hidden = true;
    if (error.status === 401 && !loginDialog.open) loginDialog.showModal();
    else if (!quiet) console.error(error);
  }
}

async function saveRoom(patch) {
  try {
    const data = await api('/api/community/admin/room', {
      method: 'POST', body: JSON.stringify(patch)
    });
    state.room = data.room;
    renderControls();
  } catch (error) {
    window.alert(error.message);
    await loadState();
  }
}

async function saveParty(patch) {
  try {
    const data = await api('/api/community/admin/party', {
      method: 'POST', body: JSON.stringify(patch)
    });
    state.party = data.party;
    renderControls();
  } catch (error) {
    window.alert(error.message);
    await loadState();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  try {
    await api('/api/master/admin/login', {
      method: 'POST', body: JSON.stringify({ password: passwordInput.value })
    });
    passwordInput.value = '';
    await loadState({ forceBottom: true });
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/master/admin/logout', { method: 'POST', body: '{}' }); } finally {
    state.admin = false;
    adminShell.hidden = true;
    $('#logout-button').hidden = true;
    loginDialog.showModal();
  }
});

$('#room-open').addEventListener('change', (event) => saveRoom({ isOpen: event.target.checked }));
$('#public-prompt').addEventListener('change', (event) => saveRoom({ publicCanPrompt: event.target.checked }));
$('#web-search').addEventListener('change', (event) => saveRoom({ webSearchEnabled: event.target.checked }));
$('#autopilot').addEventListener('change', (event) => saveParty({ enabled: event.target.checked }));
$('#interval').addEventListener('change', (event) => saveParty({ intervalSeconds: Number(event.target.value) }));

$('#force-button').addEventListener('click', async () => {
  if (state.busy) return;
  state.busy = true;
  thinking.hidden = false;
  try {
    await api('/api/community/admin/force', { method: 'POST', body: '{}' });
    await loadState({ forceBottom: true });
  } catch (error) {
    window.alert(error.message);
  } finally {
    state.busy = false;
    thinking.hidden = true;
  }
});

$('#clear-button').addEventListener('click', async () => {
  if (!window.confirm('Limpar toda a conversa pública?')) return;
  try {
    await api('/api/community/admin/clear', { method: 'POST', body: '{}' });
    state.lastMessageId = 0;
    await loadState({ forceBottom: true });
  } catch (error) { window.alert(error.message); }
});

$('#admin-composer').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#admin-message');
  const text = input.value.trim();
  if (!text || state.busy) return;
  state.busy = true;
  thinking.hidden = false;
  try {
    await api('/api/community/admin/message', {
      method: 'POST', body: JSON.stringify({ message: text })
    });
    input.value = '';
    await loadState({ forceBottom: true });
  } catch (error) { window.alert(error.message); }
  finally { state.busy = false; thinking.hidden = true; }
});

loadState({ forceBottom: true });
setInterval(() => {
  if (!document.hidden && !state.busy) loadState({ quiet: true });
}, 4000);
