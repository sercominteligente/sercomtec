(() => {
  const form = document.querySelector('#meeting-form');
  const brief = document.querySelector('#meeting-brief');
  const button = document.querySelector('#meeting-start');
  const status = document.querySelector('#meeting-status');
  if (!form || !brief || !button || !status) return;

  async function call(path, options = {}) {
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

  function setStatus(message, type = '') {
    status.textContent = message;
    status.classList.remove('is-running', 'is-success', 'is-error');
    if (type) status.classList.add(type);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = brief.value.trim();
    if (text.length < 12) {
      setStatus('Descreva um pouco melhor a ideia antes de convocar a mesa.', 'is-error');
      brief.focus();
      return;
    }

    button.disabled = true;
    brief.disabled = true;
    setStatus('Reunião em andamento: pesquisa, mercado, produto, crescimento e execução estão sendo analisados...', 'is-running');

    try {
      const result = await call('/api/meeting/start', {
        method: 'POST',
        body: JSON.stringify({ brief: text })
      });
      brief.value = '';
      setStatus(`Reunião #${result.meetingId || 'nova'} concluída com ${result.contributions || 0} contribuições. Hakham fechou a síntese executiva.`, 'is-success');
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setStatus(error.message || 'Não foi possível concluir a reunião.', 'is-error');
    } finally {
      button.disabled = false;
      brief.disabled = false;
    }
  });
})();
