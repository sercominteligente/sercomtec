(() => {
  const $ = (selector) => document.querySelector(selector);
  const feedback = $('#feedback');
  const loginForm = $('#login-form');

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
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.classList.toggle('success', success);
  };

  const init = async () => {
    try {
      const status = await api('/api/auth/status');
      if (status.authenticated) {
        location.replace('/admin/');
        return;
      }
      if (status.bootstrapRequired) {
        setFeedback('A área administrativa ainda não foi inicializada. O cadastro inicial está desativado nesta tela.');
      }
    } catch {
      setFeedback('Não foi possível verificar o acesso. Entre novamente pelo Cloudflare Access.');
    }
  };

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    button.disabled = true;
    setFeedback('');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: $('#login-email').value.trim(), password: $('#login-password').value }),
      });
      setFeedback('Acesso validado. Abrindo Central de Operações…', true);
      location.replace('/admin/');
    } catch (error) {
      setFeedback(error.message || 'Não foi possível entrar.');
    } finally {
      button.disabled = false;
    }
  });

  init();
})();
