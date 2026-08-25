(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('.mobile-menu');
  menuToggle?.addEventListener('click', () => {
    const willOpen = mobileMenu.hasAttribute('hidden');
    mobileMenu.toggleAttribute('hidden', !willOpen);
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    const use = menuToggle.querySelector('use');
    if (use) use.setAttribute('href', willOpen ? '/icons.svg#x' : '/icons.svg#menu');
  });
  $$('.mobile-menu a').forEach((link) => link.addEventListener('click', () => {
    mobileMenu.setAttribute('hidden', '');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.querySelector('use')?.setAttribute('href', '/icons.svg#menu');
  }));

  // Contact form
  const leadForm = $('#lead-form');
  const feedback = $('#form-feedback');
  leadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = leadForm.querySelector('button[type="submit"]');
    const formData = new FormData(leadForm);
    const payload = Object.fromEntries(formData.entries());
    payload.interests = formData.getAll('interesse');
    submit.disabled = true;
    submit.firstChild.textContent = 'Enviando... ';
    feedback.className = '';
    feedback.textContent = '';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Falha no envio');

      feedback.className = 'form-feedback success';
      if (result.stored) {
        feedback.textContent = 'Recebemos seus dados. Nossa equipe poderá dar continuidade ao atendimento.';
      } else {
        feedback.textContent = 'Dados preparados. Continue pelo WhatsApp para concluir o envio. ';
      }
      if (result.whatsappUrl) {
        const link = document.createElement('a');
        link.href = result.whatsappUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'Continuar pelo WhatsApp';
        feedback.appendChild(link);
      }
      leadForm.reset();
    } catch (error) {
      feedback.className = 'form-feedback error';
      feedback.textContent = 'Não foi possível enviar agora. Fale conosco pelo WhatsApp (85) 99166-5259.';
    } finally {
      submit.disabled = false;
      submit.firstChild.textContent = 'Enviar para um especialista ';
    }
  });

  // SER IA chat
  const chat = $('#chat-widget');
  const chatFab = $('#chat-fab');
  const closeChat = $('#close-chat');
  const openChat = $('#open-chat');
  const chatForm = $('#chat-form');
  const chatInput = $('#chat-input');
  const chatMessages = $('#chat-messages');
  const chatActions = $('#chat-actions');
  const chatBody = $('#chat-body');
  let history = [];
  let sending = false;

  const setChatOpen = (open) => {
    chat.toggleAttribute('hidden', !open);
    chatFab.toggleAttribute('hidden', open);
    if (open) setTimeout(() => chatInput.focus(), 80);
  };
  closeChat?.addEventListener('click', () => setChatOpen(false));
  chatFab?.addEventListener('click', () => setChatOpen(true));
  openChat?.addEventListener('click', () => setChatOpen(true));

  const addMessage = (role, content, typing = false) => {
    chatMessages.removeAttribute('hidden');
    chatActions?.setAttribute('hidden', '');
    const node = document.createElement('div');
    node.className = `chat-message chat-message--${role}${typing ? ' chat-typing' : ''}`;
    if (typing) {
      node.innerHTML = '<i></i><i></i><i></i>';
      node.dataset.typing = 'true';
    } else {
      node.textContent = content;
    }
    chatMessages.appendChild(node);
    chatBody.scrollTop = chatBody.scrollHeight;
    return node;
  };

  const sendMessage = async (message) => {
    const clean = String(message || '').trim();
    if (!clean || sending) return;
    sending = true;
    chatInput.value = '';
    addMessage('user', clean);
    history.push({ role: 'user', content: clean });
    history = history.slice(-12);
    const typing = addMessage('assistant', '', true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const result = await response.json();
      const reply = result.reply || result.error || 'Não consegui responder agora. Fale com nossa equipe pelo WhatsApp (85) 99166-5259.';
      typing.remove();
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
      history = history.slice(-12);
    } catch (error) {
      typing.remove();
      const reply = 'Estou temporariamente sem conexão com o assistente. Fale conosco pelo WhatsApp (85) 99166-5259.';
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
    } finally {
      sending = false;
      chatInput.focus();
    }
  };

  chatForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(chatInput.value);
  });
  $$('#chat-actions button').forEach((button) => button.addEventListener('click', () => sendMessage(button.dataset.message)));
})();
