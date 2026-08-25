(() => {
  const $ = (s) => document.querySelector(s);
  const feedback = $('#feedback');
  const loginForm = $('#login-form');
  const bootstrapForm = $('#bootstrap-form');
  const title = $('#form-title');
  const intro = $('#form-intro');
  const kicker = $('#form-kicker');

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
    return data;
  };

  const setFeedback = (message, success = false) => {
    feedback.textContent = message || '';
    feedback.classList.toggle('success', success);
  };

  const openAdmin = () => location.replace('/admin/');

  const showBootstrap = (status) => {
    loginForm.hidden = true;
    bootstrapForm.hidden = false;
    kicker.textContent = 'CONFIGURAÇÃO INICIAL';
    title.textContent = 'Crie o primeiro administrador';
    intro.textContent = 'A autenticação externa foi validada. Agora crie a credencial interna da SER comtec.';
    const email = status.access?.email || '';
    $('#setup-email').value = email;
  };

  const init = async () => {
    try {
      const status = await api('/api/auth/status');
      if (status.authenticated) {
        openAdmin();
        return;
      }
      if (status.bootstrapRequired) showBootstrap(status);
    } catch (error) {
      setFeedback('Não foi possível verificar o estado do acesso. Atualize a página ou entre novamente pelo Cloudflare Access.');
    }
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    button.disabled = true;
    setFeedback('');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: $('#login-email').value.trim(), password: $('#login-password').value }),
      });
      setFeedback('Acesso validado. Abrindo painel…', true);
      openAdmin();
    } catch (error) {
      setFeedback(error.message || 'Não foi possível entrar.');
    } finally {
      button.disabled = false;
    }
  });

  bootstrapForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#setup-password').value;
    const confirm = $('#setup-confirm').value;
    if (password !== confirm) {
      setFeedback('As senhas não coincidem.');
      return;
    }
    const button = bootstrapForm.querySelector('button');
    button.disabled = true;
    setFeedback('');
    try {
      await api('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ name: $('#setup-name').value.trim(), email: $('#setup-email').value.trim(), password }),
      });
      setFeedback('Administrador criado. Abrindo Central de Operações…', true);
      openAdmin();
    } catch (error) {
      setFeedback(error.message || 'Não foi possível criar o administrador.');
    } finally {
      button.disabled = false;
    }
  });

  init();
})();
