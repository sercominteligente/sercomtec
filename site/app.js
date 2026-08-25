(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  // Brand refinements approved during mobile homologation.
  // Keep these adjustments isolated from the layout so the Master Visual remains unchanged.
  const brandStyle = document.createElement('style');
  brandStyle.textContent = `
    .brand-lockup{width:auto!important;min-width:226px;display:inline-flex!important;align-items:center;gap:10px;flex:0 0 auto;text-decoration:none}
    .brand-lockup__mark{width:52px!important;height:52px!important;max-height:none!important;object-fit:contain;flex:0 0 52px}
    .brand-lockup__name{display:inline-flex;align-items:baseline;gap:6px;white-space:nowrap;line-height:1;letter-spacing:-.035em}
    .brand-lockup__name strong{font-family:'Manrope','Inter',sans-serif;font-size:28px;font-weight:800;color:#17334f}
    .brand-lockup__name span{font-family:'Manrope','Inter',sans-serif;font-size:24px;font-weight:500;color:#4b5a69}

    .product-logo-lockup{min-height:66px;padding-top:14px!important;padding-bottom:8px!important;display:flex!important;align-items:center;gap:9px}
    .product-logo-lockup>img:not(.negociaja-official-logo){width:39px!important;height:39px!important;object-fit:contain;flex:0 0 39px}
    .product-logo-lockup>strong{display:inline-flex;align-items:baseline;gap:0;font-family:'Manrope','Inter',sans-serif;color:#162f49;font-size:24px;font-weight:800;letter-spacing:-.045em;white-space:nowrap}
    .product-logo-sub{font-weight:500;color:#405469}
    .product-logo-ia{color:#106ea8}
    .product-logo-master{margin-left:4px;font-size:.72em;letter-spacing:-.02em;font-weight:800}

    .product-logo-lockup--negociaja{position:relative;min-height:66px}
    .negociaja-official-logo{width:auto!important;height:47px!important;max-width:205px!important;object-fit:contain;object-position:left center;position:relative;z-index:2;background:#fff}
    .negociaja-logo-fallback{position:absolute;left:20px;top:21px;z-index:1;font-family:'Manrope','Inter',sans-serif;font-size:25px;line-height:1;font-weight:900;letter-spacing:-.045em;color:#0d2b6f;white-space:nowrap}
    .negociaja-logo-fallback span{color:#00b2ff}
    .negociaja-logo-fallback b{color:#ffb300}

    .footer-brand-lockup{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;text-decoration:none}
    .footer-brand-lockup img{width:46px!important;height:46px!important;object-fit:contain}
    .footer-brand-lockup>span{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap;line-height:1}
    .footer-brand-lockup strong{color:#fff;font-family:'Manrope','Inter',sans-serif;font-size:24px;font-style:normal;font-weight:800}
    .footer-brand-lockup em{color:#d9e5ee;font-family:'Manrope','Inter',sans-serif;font-size:21px;font-style:normal;font-weight:500}

    @media(max-width:1230px){
      .brand-lockup{min-width:205px}
      .brand-lockup__mark{width:48px!important;height:48px!important;flex-basis:48px}
      .brand-lockup__name strong{font-size:25px}
      .brand-lockup__name span{font-size:22px}
    }
    @media(max-width:760px){
      .brand-lockup{min-width:0;gap:8px}
      .brand-lockup__mark{width:50px!important;height:50px!important;flex-basis:50px}
      .brand-lockup__name strong{font-size:24px}
      .brand-lockup__name span{font-size:20px}
      .product-logo-lockup{min-height:64px}
      .product-logo-lockup>img:not(.negociaja-official-logo){width:37px!important;height:37px!important;flex-basis:37px}
      .product-logo-lockup>strong{font-size:23px}
      .negociaja-official-logo{height:44px!important;max-width:190px!important}
    }
    @media(max-width:390px){
      .brand-lockup__mark{width:46px!important;height:46px!important;flex-basis:46px}
      .brand-lockup__name strong{font-size:22px}
      .brand-lockup__name span{font-size:18px}
    }
  `;
  document.head.appendChild(brandStyle);

  const headerBrand = $('.site-header .brand');
  if (headerBrand) {
    headerBrand.classList.add('brand-lockup');
    headerBrand.innerHTML = `
      <img class="brand-lockup__mark" src="/brand/icon-192.png" alt="" aria-hidden="true">
      <span class="brand-lockup__name"><strong>SER</strong><span>comtec</span></span>
    `;
  }

  const heroSymbol = $('.hero-symbol');
  if (heroSymbol) heroSymbol.src = '/brand/icon-512.png';

  const productCards = $$('.product-card');
  const serhubBrand = productCards[0]?.querySelector('.product-card__brand');
  if (serhubBrand) {
    serhubBrand.className = 'product-card__brand product-logo-lockup product-logo-lockup--serhub';
    serhubBrand.setAttribute('aria-label', 'SERhub');
    serhubBrand.innerHTML = `
      <img src="/brand/icon-192.png" alt="" aria-hidden="true">
      <strong><span class="product-logo-ser">SER</span><span class="product-logo-sub">hub</span></strong>
    `;
  }

  const negociaBrand = productCards[1]?.querySelector('.product-card__brand');
  if (negociaBrand) {
    negociaBrand.className = 'product-card__brand product-logo-lockup product-logo-lockup--negociaja';
    negociaBrand.setAttribute('aria-label', 'NegocIAJá!');
    negociaBrand.innerHTML = `
      <img class="negociaja-official-logo" src="https://negociaja.com.br/logo-primary.png" alt="NegocIAJá!" loading="lazy">
      <span class="negociaja-logo-fallback" aria-hidden="true">Negoc<span>IA</span><b>Já!</b></span>
    `;
    const officialLogo = negociaBrand.querySelector('.negociaja-official-logo');
    officialLogo?.addEventListener('error', () => officialLogo.setAttribute('hidden', ''));
  }

  const seriaBrand = productCards[2]?.querySelector('.product-card__brand');
  if (seriaBrand) {
    seriaBrand.className = 'product-card__brand product-logo-lockup product-logo-lockup--seriamaster';
    seriaBrand.setAttribute('aria-label', 'SER IA MASTER');
    seriaBrand.innerHTML = `
      <img src="/brand/icon-192.png" alt="" aria-hidden="true">
      <strong><span class="product-logo-ser">SER</span>&nbsp;<span class="product-logo-ia">IA</span><span class="product-logo-master">MASTER</span></strong>
    `;
  }

  const footerBrand = $('.footer-brand');
  if (footerBrand) {
    const oldLogo = footerBrand.querySelector('img');
    if (oldLogo) {
      const lockup = document.createElement('a');
      lockup.className = 'footer-brand-lockup';
      lockup.href = '#inicio';
      lockup.setAttribute('aria-label', 'SER comtec - início');
      lockup.innerHTML = `<img src="/brand/simbolo-branco.png" alt="" aria-hidden="true"><span><strong>SER</strong><em>comtec</em></span>`;
      oldLogo.replaceWith(lockup);
    }
  }

  const chatFabImage = $('#chat-fab img');
  if (chatFabImage) chatFabImage.src = '/brand/icon-192.png';

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
