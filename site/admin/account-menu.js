(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const roleLabel = (role) => ({
    super_admin: 'Super administrador',
    admin: 'Administrador',
    editor: 'Editor',
    suporte: 'Suporte',
    viewer: 'Consulta',
  }[role] || role || 'Usuário');

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || `Erro ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const uploadAvatar = async (file, name) => {
    const response = await fetch(`/api/admin/upload?kind=avatars&name=${encodeURIComponent(name || 'perfil')}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': file.type },
      body: file,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a foto.');
    return data.url;
  };

  let profile = null;
  let menu = null;
  let dialog = null;

  const setAvatar = (element, user) => {
    if (!element) return;
    const initial = (user?.name || user?.email || 'S').trim().slice(0, 1).toUpperCase();
    if (user?.avatar_url) {
      element.style.backgroundImage = `url("${String(user.avatar_url).replace(/"/g, '%22')}")`;
      element.textContent = '';
    } else {
      element.style.backgroundImage = '';
      element.textContent = initial;
    }
  };

  const syncHeader = (user) => {
    const name = $('#user-name');
    const email = $('#user-email');
    if (name) name.textContent = user.name || 'Administrador';
    if (email) email.textContent = user.email || 'SER comtec';
    setAvatar($('#user-initial'), user);
    if (menu) {
      $('#account-name', menu).textContent = user.name || 'Administrador';
      $('#account-email', menu).textContent = user.email || '';
      $('#account-role', menu).textContent = roleLabel(user.role);
      setAvatar($('#account-avatar', menu), user);
    }
  };

  const buildMenu = () => {
    menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.id = 'account-menu';
    menu.innerHTML = `
      <div class="account-menu__head">
        <span class="account-menu__avatar" id="account-avatar">S</span>
        <div><strong id="account-name">Administrador</strong><small id="account-email"></small><em id="account-role">Usuário</em></div>
      </div>
      <button class="account-menu__action" type="button" data-account-action="profile"><span>Editar perfil</span><b>›</b></button>
      <button class="account-menu__action" type="button" data-account-action="settings"><span>Configurações</span><b>›</b></button>
      <button class="account-menu__action danger" type="button" data-account-action="logout"><span>Sair</span><b>↗</b></button>`;
    document.body.appendChild(menu);

    const account = $('.admin-user');
    if (account) {
      account.setAttribute('role', 'button');
      account.setAttribute('tabindex', '0');
      account.setAttribute('aria-label', 'Abrir menu da conta');
      const toggle = (event) => {
        event?.stopPropagation();
        menu.classList.toggle('open');
      };
      account.addEventListener('click', toggle);
      account.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      });
    }

    document.addEventListener('click', (event) => {
      if (menu && !menu.contains(event.target) && !$('.admin-user')?.contains(event.target)) menu.classList.remove('open');
    });

    $('[data-account-action="profile"]', menu).addEventListener('click', () => {
      menu.classList.remove('open');
      openProfile();
    });
    $('[data-account-action="settings"]', menu).addEventListener('click', () => {
      menu.classList.remove('open');
      document.querySelector('[data-view="settings"]')?.click();
    });
    $('[data-account-action="logout"]', menu).addEventListener('click', async () => {
      menu.classList.remove('open');
      try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
      location.replace('/admin/');
    });
  };

  const buildProfileDialog = () => {
    dialog = document.createElement('dialog');
    dialog.className = 'profile-dialog';
    dialog.id = 'profile-dialog';
    dialog.innerHTML = `
      <form class="profile-card" id="profile-form">
        <div class="profile-head"><div><span>MINHA CONTA</span><h2>Editar perfil</h2></div><button class="profile-close" type="button" aria-label="Fechar">×</button></div>
        <div class="profile-photo-row"><span class="profile-photo" id="profile-photo">S</span><label>Foto do perfil<input id="profile-photo-file" type="file" accept="image/png,image/jpeg,image/webp"></label></div>
        <div class="profile-grid">
          <label>Nome<input id="profile-name" maxlength="100" required></label>
          <label>E-mail<input id="profile-email" type="email" maxlength="180" required></label>
          <label class="span-2">Senha atual<input id="profile-current-password" type="password" autocomplete="current-password" placeholder="Obrigatória para alterar e-mail ou senha"></label>
          <label>Nova senha<input id="profile-new-password" type="password" autocomplete="new-password" minlength="10" placeholder="Deixe vazio para manter"></label>
          <label>Confirme a nova senha<input id="profile-confirm-password" type="password" autocomplete="new-password" minlength="10"></label>
        </div>
        <p class="profile-help">A foto é armazenada no R2. Alterações de e-mail ou senha exigem a senha atual.</p>
        <div class="profile-actions"><button type="button" class="quiet-button" data-profile-cancel>Cancelar</button><button type="submit" class="primary-button">Salvar perfil</button></div>
      </form>`;
    document.body.appendChild(dialog);

    $('.profile-close', dialog).addEventListener('click', () => dialog.close());
    $('[data-profile-cancel]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    $('#profile-photo-file', dialog).addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) $('#profile-photo', dialog).style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
    });

    $('#profile-form', dialog).addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = $('#profile-form button[type="submit"]', dialog);
      const name = $('#profile-name', dialog).value.trim();
      const email = $('#profile-email', dialog).value.trim();
      const currentPassword = $('#profile-current-password', dialog).value;
      const newPassword = $('#profile-new-password', dialog).value;
      const confirmPassword = $('#profile-confirm-password', dialog).value;
      if (newPassword !== confirmPassword) {
        alert('As novas senhas não coincidem.');
        return;
      }
      submit.disabled = true;
      try {
        let avatarUrl = profile?.avatar_url || '';
        const file = $('#profile-photo-file', dialog).files?.[0];
        if (file) avatarUrl = await uploadAvatar(file, name);
        const data = await api('/api/admin/profile', {
          method: 'PATCH',
          body: JSON.stringify({ name, email, avatar_url: avatarUrl, current_password: currentPassword, new_password: newPassword }),
        });
        profile = data.user;
        syncHeader(profile);
        dialog.close();
      } catch (error) {
        alert(error.message || 'Não foi possível atualizar o perfil.');
      } finally {
        submit.disabled = false;
      }
    });
  };

  const openProfile = () => {
    if (!dialog || !profile) return;
    $('#profile-name', dialog).value = profile.name || '';
    $('#profile-email', dialog).value = profile.email || '';
    $('#profile-current-password', dialog).value = '';
    $('#profile-new-password', dialog).value = '';
    $('#profile-confirm-password', dialog).value = '';
    $('#profile-photo-file', dialog).value = '';
    setAvatar($('#profile-photo', dialog), profile);
    dialog.showModal();
  };

  const resolveOpenLead = async () => {
    const leadDialog = $('#lead-dialog');
    if (!leadDialog?.open) return null;
    const name = ($('#dialog-name')?.textContent || '').trim();
    const details = $('#dialog-details')?.textContent || '';
    const emailMatch = details.match(/E-mail:\s*([^\s]+)/i);
    const phoneMatch = details.match(/WhatsApp:\s*([^\n]+)/i);
    const data = await api('/api/admin/leads');
    const items = data.items || [];
    const candidates = items.filter((lead) => {
      if (name && String(lead.nome || '').trim() !== name) return false;
      if (emailMatch && String(lead.email || '').trim() !== emailMatch[1].trim()) return false;
      if (phoneMatch) {
        const a = String(lead.whatsapp || '').replace(/\D/g, '');
        const b = phoneMatch[1].replace(/\D/g, '');
        if (b && a !== b) return false;
      }
      return true;
    });
    return candidates[0] || null;
  };

  const installLeadDelete = () => {
    if (!['super_admin', 'admin'].includes(profile?.role)) return;
    const actions = $('#lead-dialog .dialog-actions');
    if (!actions || $('#delete-lead')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'delete-lead';
    button.className = 'lead-delete-button';
    button.textContent = 'Excluir lead';
    actions.prepend(button);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const lead = await resolveOpenLead();
        if (!lead) throw new Error('Não foi possível identificar este lead. Feche e abra novamente.');
        if (!confirm(`Excluir definitivamente o lead “${lead.nome}”? Esta ação não pode ser desfeita.`)) return;
        await api(`/api/admin/leads/${encodeURIComponent(lead.id)}`, { method: 'DELETE' });
        $('#lead-dialog')?.close();
        document.querySelector('#refresh-leads')?.click();
      } catch (error) {
        alert(error.message || 'Não foi possível excluir o lead.');
      } finally {
        button.disabled = false;
      }
    });
  };

  const boot = async () => {
    buildMenu();
    buildProfileDialog();
    try {
      const data = await api('/api/admin/profile');
      profile = data.user;
      syncHeader(profile);
      const banner = $('#access-banner');
      if (banner) { banner.hidden = true; banner.style.display = 'none'; }
      installLeadDelete();
      const securityText = $('#view-settings .settings-panel p');
      if (securityText) securityText.textContent = 'Cloudflare Access protege o domínio por fora. A Central de Operações usa credenciais individuais, senhas derivadas com scrypt e sessões próprias por dentro.';
    } catch (error) {
      if (error.status === 401) location.replace('/admin/');
    }
  };

  boot();
})();
