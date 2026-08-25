(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { leads: [], tickets: [], files: [], selectedLead: null, overview: null };

  const titles = {
    dashboard: 'Visão geral', leads: 'Leads', support: 'Suporte', files: 'Arquivos',
    ai: 'IA & automações', products: 'Produtos', site: 'Conteúdo do site',
    integrations: 'Integrações', settings: 'Configurações'
  };

  const esc = (value) => String(value ?? '');
  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(d);
  };
  const bytes = (size) => {
    const n = Number(size || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n/1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n/1024**2).toFixed(1)} MB`;
    return `${(n/1024**3).toFixed(1)} GB`;
  };
  const api = async (path, options = {}) => {
    const res = await fetch(path, { credentials:'same-origin', ...options, headers:{ 'content-type':'application/json', ...(options.headers || {}) } });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const error = new Error(data.error || `Erro ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const showAccessIssue = (message) => {
    const banner = $('#access-banner');
    banner.hidden = false;
    $('#access-message').textContent = message;
  };

  const switchView = (name) => {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#page-title').textContent = titles[name] || 'Administração';
    $('#sidebar').classList.remove('open');
    if (name === 'leads') loadLeads();
    if (name === 'support') loadTickets();
    if (name === 'files') loadFiles();
    if (name === 'integrations') renderIntegrations();
  };
  $$('.nav-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $$('[data-open-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.openView)));
  $('#mobile-nav-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  const statusChip = (status) => {
    const span = document.createElement('span');
    span.className = `status-chip ${esc(status).toLowerCase()}`;
    span.textContent = esc(status || 'novo');
    return span;
  };

  const loadSession = async () => {
    try {
      const data = await api('/api/admin/session');
      const email = data.user?.email || 'Administrador';
      $('#user-email').textContent = email;
      $('#user-name').textContent = email.split('@')[0] || 'Administrador';
      $('#user-initial').textContent = email.slice(0,1).toUpperCase();
      return true;
    } catch (error) {
      if (error.status === 503) showAccessIssue('Cloudflare Access ainda precisa receber Team Domain e Audience no Worker. A interface está pronta, mas os dados administrativos permanecem bloqueados.');
      else if (error.status === 401 || error.status === 403) showAccessIssue('Sua sessão administrativa não foi validada. Entre pelo Cloudflare Access para liberar os dados.');
      else showAccessIssue('Não foi possível validar o acesso administrativo agora.');
      return false;
    }
  };

  const loadOverview = async () => {
    try {
      const data = await api('/api/admin/overview');
      state.overview = data;
      $('#stat-new-leads').textContent = data.leads?.new ?? 0;
      $('#stat-total-leads').textContent = data.leads?.total ?? 0;
      $('#stat-open-tickets').textContent = data.support?.open ?? 0;
      $('#stat-files').textContent = data.files?.visible ?? 0;
      $('#nav-leads-count').textContent = data.leads?.new ?? 0;
      const services = data.health || {};
      const active = [services.db, services.files, services.openai, services.webhook].filter(Boolean).length;
      $('#health-score').textContent = `${active}/4`;
      $('#ai-model').textContent = data.openaiModel || 'Modelo configurado';
      $('#webhook-status').textContent = services.webhook ? 'Webhook configurado' : 'Webhook não configurado';
      renderHealth(services);
      renderRecentLeads(data.recentLeads || []);
      renderIntegrations();
    } catch (error) {
      $('#recent-leads').textContent = 'Dados administrativos indisponíveis até a autenticação ser validada.';
      $('#infra-health').textContent = 'Aguardando Cloudflare Access.';
    }
  };

  const renderHealth = (health) => {
    const items = [
      ['D1', 'Banco de dados', health.db], ['R2', 'Arquivos', health.files],
      ['OpenAI', 'SER IA Assistente', health.openai], ['Webhook', 'Leads / n8n', health.webhook]
    ];
    const root = $('#infra-health'); root.innerHTML = '';
    items.forEach(([name, desc, ok]) => {
      const row = document.createElement('div'); row.className = `health-row ${ok ? 'ok':''}`;
      const dot = document.createElement('i'); const text = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = name;
      const small = document.createElement('span'); small.textContent = desc;
      text.append(strong, small);
      const status = document.createElement('span'); status.textContent = ok ? 'Ativo' : 'Pendente';
      row.append(dot, text, status); root.appendChild(row);
    });
  };

  const renderRecentLeads = (leads) => {
    const root = $('#recent-leads'); root.innerHTML = '';
    if (!leads.length) { root.textContent = 'Nenhum lead recebido ainda.'; return; }
    leads.forEach(lead => {
      const row = document.createElement('div'); row.className = 'compact-lead';
      const who = document.createElement('div'); const name = document.createElement('strong'); name.textContent = lead.nome;
      const company = document.createElement('small'); company.textContent = lead.empresa || lead.email; who.append(name, company);
      const interest = document.createElement('small'); interest.textContent = Array.isArray(lead.interests) && lead.interests.length ? lead.interests.join(', ') : 'Sem interesse marcado';
      row.append(who, interest, statusChip(lead.status)); root.appendChild(row);
    });
  };

  const loadLeads = async () => {
    const tbody = $('#leads-table');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando leads…</td></tr>';
    const q = $('#lead-search').value.trim(); const status = $('#lead-status-filter').value;
    try {
      const data = await api(`/api/admin/leads?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`);
      state.leads = data.items || [];
      renderLeads();
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Não foi possível carregar os leads. Verifique o Cloudflare Access.</td></tr>';
    }
  };

  const renderLeads = () => {
    const tbody = $('#leads-table'); tbody.innerHTML = '';
    if (!state.leads.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum lead encontrado.</td></tr>'; return; }
    state.leads.forEach(lead => {
      const tr = document.createElement('tr');
      const leadCell = document.createElement('td'); const n = document.createElement('strong'); n.textContent = lead.nome;
      const c = document.createElement('small'); c.textContent = lead.empresa || lead.segmento || 'Sem empresa'; leadCell.append(n,c);
      const interest = document.createElement('td'); interest.textContent = lead.interests?.join(', ') || '—';
      const contact = document.createElement('td'); const e = document.createElement('strong'); e.textContent = lead.email; const p = document.createElement('small'); p.textContent = lead.whatsapp; contact.append(e,p);
      const status = document.createElement('td'); status.appendChild(statusChip(lead.status));
      const date = document.createElement('td'); date.textContent = formatDate(lead.created_at);
      const action = document.createElement('td'); const button = document.createElement('button'); button.className = 'row-action'; button.textContent = 'Abrir'; button.addEventListener('click', () => openLead(lead)); action.appendChild(button);
      tr.append(leadCell,interest,contact,status,date,action); tbody.appendChild(tr);
    });
  };

  const openLead = (lead) => {
    state.selectedLead = lead;
    $('#dialog-name').textContent = lead.nome;
    $('#dialog-company').textContent = [lead.empresa, lead.segmento].filter(Boolean).join(' • ') || 'Lead recebido pelo site';
    const d = $('#dialog-details'); d.innerHTML = '';
    [['E-mail',lead.email],['WhatsApp',lead.whatsapp],['Interesse',lead.interests?.join(', ') || '—'],['Mensagem',lead.mensagem || '—'],['Recebido',formatDate(lead.created_at)]].forEach(([label,value]) => {
      const row = document.createElement('div'); const b = document.createElement('strong'); b.textContent = `${label}: `; row.append(b, document.createTextNode(value)); d.appendChild(row);
    });
    $('#dialog-status').value = lead.status || 'novo';
    $('#dialog-notes').value = lead.notes || '';
    $('#lead-dialog').showModal();
  };

  $('#save-lead').addEventListener('click', async () => {
    if (!state.selectedLead) return;
    const button = $('#save-lead'); button.disabled = true; button.textContent = 'Salvando…';
    try {
      const data = await api(`/api/admin/leads/${encodeURIComponent(state.selectedLead.id)}`, { method:'PATCH', body:JSON.stringify({ status:$('#dialog-status').value, notes:$('#dialog-notes').value.trim() }) });
      state.selectedLead = data.item;
      $('#lead-dialog').close();
      await Promise.all([loadLeads(), loadOverview()]);
    } catch (error) { alert(error.message || 'Não foi possível salvar.'); }
    finally { button.disabled = false; button.textContent = 'Salvar alterações'; }
  });

  $('#refresh-leads').addEventListener('click', loadLeads);
  $('#lead-status-filter').addEventListener('change', loadLeads);
  let searchTimer; $('#lead-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadLeads, 350); });

  const loadTickets = async () => {
    const tbody = $('#tickets-table'); tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando chamados…</td></tr>';
    try {
      const data = await api('/api/admin/tickets'); state.tickets = data.items || []; tbody.innerHTML = '';
      if (!state.tickets.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum chamado aberto.</td></tr>'; return; }
      state.tickets.forEach(t => {
        const tr = document.createElement('tr');
        [t.subject || t.requester_name || 'Chamado', t.product || '—', t.priority || 'normal', t.status || 'aberto', formatDate(t.updated_at || t.created_at)].forEach((v,i) => { const td = document.createElement('td'); if(i===0){const s=document.createElement('strong');s.textContent=v;td.appendChild(s)}else td.textContent=v; tr.appendChild(td); });
        tbody.appendChild(tr);
      });
    } catch { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Chamados indisponíveis.</td></tr>'; }
  };
  $('#refresh-tickets').addEventListener('click', loadTickets);

  const loadFiles = async () => {
    const root = $('#files-grid'); root.innerHTML = '<div class="empty-card">Carregando R2…</div>';
    try {
      const data = await api('/api/admin/files'); state.files = data.items || []; root.innerHTML = '';
      if (!state.files.length) { root.innerHTML = '<div class="empty-card">Nenhum arquivo no bucket.</div>'; return; }
      state.files.forEach(f => { const card=document.createElement('article');card.className='file-card';const n=document.createElement('strong');n.textContent=f.key;const s=document.createElement('small');s.textContent=`${bytes(f.size)} • ${formatDate(f.uploaded)}`;card.append(n,s);root.appendChild(card); });
    } catch { root.innerHTML = '<div class="empty-card">R2 indisponível ou acesso não validado.</div>'; }
  };
  $('#refresh-files').addEventListener('click', loadFiles);

  const renderIntegrations = () => {
    const h = state.overview?.health || {};
    [['#int-db',h.db],['#int-r2',h.files],['#int-ai',h.openai],['#int-webhook',h.webhook]].forEach(([selector,ok]) => { const el=$(selector); if(!el)return; el.textContent=ok?'Ativo':'Pendente'; el.classList.toggle('ok',!!ok); });
  };

  (async () => {
    const session = await loadSession();
    if (session) await Promise.all([loadOverview(), loadLeads()]);
  })();
})();
