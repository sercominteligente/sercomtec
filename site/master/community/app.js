const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  guest: null,
  room: null,
  party: null,
  agents: {},
  messages: [],
  lastMessageId: 0,
  busy: false,
  tickBusy: false
};

const initials = {
  hakham: 'H', arcanum: 'A', serafim: 'S', serena: 'Se', luna: 'L', delta: 'D',
  orion: 'O', lyra: 'Ly', nova: 'N', polaris: 'P', sirius: 'Si', user: 'V'
};

const messagesEl = $('#messages');
const emptyState = $('#empty-state');
const roster = $('#roster');
const roomStatus = $('#room-status');
const sessionPill = $('#session-pill');
const sessionName = $('#session-name');
const sessionTime = $('#session-time');
const roomTitle = $('#room-title');
const agentCount = $('#agent-count');
const composer = $('#composer');
const input = $('#message-input');
const sendButton = $('#send-button');
const typing = $('#typing');
const joinDialog = $('#join-dialog');
const joinForm = $('#join-form');
const displayName = $('#display-name');
const joinError = $('#join-error');

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
  } catch {
    return '';
  }
}

function renderRoster() {
  roster.replaceChildren();
  const active = state.room?.activeAgents || [];
  agentCount.textContent = `${active.length} ${active.length === 1 ? 'agente' : 'agentes'} na roda`;
  active.forEach((key) => {
    const agent = state.agents[key];
    if (!agent) return;
    const item = document.createElement('div');
    item.className = 'roster-item';
    const avatar = document.createElement('i');
    avatar.textContent = initials[key] || agent.name.slice(0, 2);
    const name = document.createElement('b');
    name.textContent = agent.name;
    item.append(avatar, name);
    item.title = agent.specialty || '';
    roster.append(item);
  });
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
  if (!state.messages.length) {
    messagesEl.append(emptyState);
    return;
  }
  state.messages.forEach((message) => {
    const speaker = message.speaker || 'user';
    const row = document.createElement('article');
    row.className = `message ${speaker === 'user' ? 'user' : ''}`;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials[speaker] || String(message.displayName || '?').slice(0, 2);

    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('b');
    name.textContent = message.displayName || state.agents[speaker]?.name || 'Visitante';
    const detail = document.createElement('span');
    const specialty = state.agents[speaker]?.specialty;
    detail.textContent = `${specialty ? `${specialty} · ` : ''}${formatTime(message.createdAt)}`;
    meta.append(name, detail);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message.content || '';
    wrap.append(meta, bubble);
    renderSources(message.sources, wrap);
    row.append(avatar, wrap);
    messagesEl.append(row);
  });
  if (forceBottom || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updatePermissions() {
  const logged = Boolean(state.guest);
  const canTalk = logged && state.room?.isOpen && state.room?.publicCanPrompt && !state.busy;
  input.disabled = !canTalk;
  sendButton.disabled = !canTalk;
  if (!logged) input.placeholder = 'Entre para conversar...';
  else if (!state.room?.isOpen) input.placeholder = 'A sala está pausada pelo Super Admin.';
  else if (!state.room?.publicCanPrompt) input.placeholder = 'Novas mensagens estão pausadas por enquanto.';
  else if (state.busy) input.placeholder = 'A roda está respondendo...';
  else input.placeholder = 'Escreva do seu jeito...';
}

function renderRoom() {
  if (!state.room) return;
  roomTitle.textContent = state.room.roomTitle || 'Bate-papo das IAs';
  roomStatus.classList.toggle('closed', !state.room.isOpen);
  roomStatus.querySelector('span').textContent = state.room.isOpen ? 'Sala online' : 'Sala pausada';
  renderRoster();
  updatePermissions();
}

function renderSession() {
  if (!state.guest) {
    sessionPill.hidden = true;
    return;
  }
  sessionPill.hidden = false;
  sessionName.textContent = state.guest.name;
  const remaining = Math.max(0, Number(state.guest.expiresAt || 0) - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  sessionTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (remaining <= 0) expireSession();
}

async function loadState({ forceBottom = false, quiet = false } = {}) {
  try {
    const data = await api('/api/community/state');
    const newest = data.messages?.length ? Number(data.messages[data.messages.length - 1].id || 0) : 0;
    const changed = newest !== state.lastMessageId;
    state.guest = data.guest;
    state.room = data.room;
    state.party = data.party;
    state.agents = data.agents || {};
    state.messages = data.messages || [];
    state.lastMessageId = newest;
    renderRoom();
    renderSession();
    if (!quiet || changed) renderMessages(forceBottom || changed);
    if (!state.guest && !joinDialog.open) joinDialog.showModal();
  } catch (error) {
    if (!quiet) console.error(error);
  }
}

async function expireSession() {
  if (!state.guest) return;
  state.guest = null;
  try { await api('/api/community/logout', { method: 'POST', body: '{}' }); } catch { /* noop */ }
  renderSession();
  updatePermissions();
  if (!joinDialog.open) joinDialog.showModal();
}

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  joinError.hidden = true;
  joinError.textContent = '';
  try {
    const data = await api('/api/community/login', {
      method: 'POST',
      body: JSON.stringify({ name: displayName.value })
    });
    state.guest = { name: data.name, expiresAt: data.expiresAt };
    joinDialog.close();
    await loadState({ forceBottom: true });
    input.focus();
  } catch (error) {
    joinError.textContent = error.message;
    joinError.hidden = false;
  }
});

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || state.busy) return;
  state.busy = true;
  typing.hidden = false;
  updatePermissions();
  try {
    await api('/api/community/message', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    });
    input.value = '';
    await loadState({ forceBottom: true });
  } catch (error) {
    if (error.status === 401) await expireSession();
    else window.alert(error.message);
  } finally {
    state.busy = false;
    typing.hidden = true;
    updatePermissions();
    input.focus();
  }
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

async function maybeTick() {
  if (state.tickBusy || state.busy || document.hidden || !state.party?.enabled || !state.room?.isOpen) return;
  state.tickBusy = true;
  try {
    const data = await api('/api/community/tick', { method: 'POST', body: '{}' });
    if (data.generated) await loadState({ forceBottom: true });
  } catch { /* outro navegador pode ter ganhado o turno */ }
  finally { state.tickBusy = false; }
}

loadState({ forceBottom: true });
setInterval(() => loadState({ quiet: true }), 4000);
setInterval(maybeTick, 5000);
setInterval(renderSession, 1000);
