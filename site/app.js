(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

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
    .product-logo-sub{font-weight:500;color:#405469}.product-logo-ia{color:#106ea8}.product-logo-master{margin-left:4px;font-size:.72em;letter-spacing:-.02em;font-weight:800}
    .product-logo-lockup--negociaja{position:relative;min-height:66px}.negociaja-official-logo{width:auto!important;height:47px!important;max-width:205px!important;object-fit:contain;object-position:left center;position:relative;z-index:2;background:#fff}.negociaja-logo-fallback{position:absolute;left:20px;top:21px;z-index:1;font-family:'Manrope','Inter',sans-serif;font-size:25px;line-height:1;font-weight:900;letter-spacing:-.045em;color:#0d2b6f;white-space:nowrap}.negociaja-logo-fallback span{color:#00b2ff}.negociaja-logo-fallback b{color:#ffb300}
    .footer-brand-lockup{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;text-decoration:none}.footer-brand-lockup img{width:46px!important;height:46px!important;object-fit:contain}.footer-brand-lockup>span{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap;line-height:1}.footer-brand-lockup strong{color:#fff;font-family:'Manrope','Inter',sans-serif;font-size:24px;font-style:normal;font-weight:800}.footer-brand-lockup em{color:#d9e5ee;font-family:'Manrope','Inter',sans-serif;font-size:21px;font-style:normal;font-weight:500}
    .managed-product-image{width:100%;height:100%;object-fit:cover;display:block}.product-card--managed .product-preview{display:grid;place-items:center;background:#f2f7fa}.product-card--managed .product-preview .managed-placeholder{font:800 12px Manrope;color:#8ca2b0;letter-spacing:.12em}
    @media(max-width:1230px){.brand-lockup{min-width:205px}.brand-lockup__mark{width:48px!important;height:48px!important;flex-basis:48px}.brand-lockup__name strong{font-size:25px}.brand-lockup__name span{font-size:22px}}
    @media(max-width:760px){.brand-lockup{min-width:0;gap:8px}.brand-lockup__mark{width:50px!important;height:50px!important;flex-basis:50px}.brand-lockup__name strong{font-size:24px}.brand-lockup__name span{font-size:20px}.product-logo-lockup{min-height:64px}.product-logo-lockup>img:not(.negociaja-official-logo){width:37px!important;height:37px!important;flex-basis:37px}.product-logo-lockup>strong{font-size:23px}.negociaja-official-logo{height:44px!important;max-width:190px!important}}
    @media(max-width:390px){.brand-lockup__mark{width:46px!important;height:46px!important;flex-basis:46px}.brand-lockup__name strong{font-size:22px}.brand-lockup__name span{font-size:18px}}
  `;
  document.head.appendChild(brandStyle);

  const headerBrand = $('.site-header .brand');
  if (headerBrand) {
    headerBrand.classList.add('brand-lockup');
    headerBrand.innerHTML = `<img class="brand-lockup__mark" src="/brand/icon-192.png" alt="" aria-hidden="true"><span class="brand-lockup__name"><strong>SER</strong><span>comtec</span></span>`;
  }
  const heroSymbol = $('.hero-symbol'); if (heroSymbol) heroSymbol.src = '/brand/icon-512.png';
  const chatFabImage = $('#chat-fab img'); if (chatFabImage) chatFabImage.src = '/brand/icon-192.png';

  const productCardsInitial = $$('.product-card');
  const serhubBrand = productCardsInitial[0]?.querySelector('.product-card__brand');
  if (serhubBrand) { serhubBrand.className='product-card__brand product-logo-lockup product-logo-lockup--serhub';serhubBrand.innerHTML=`<img src="/brand/icon-192.png" alt="" aria-hidden="true"><strong><span>SER</span><span class="product-logo-sub">hub</span></strong>`; }
  const negociaBrand = productCardsInitial[1]?.querySelector('.product-card__brand');
  if (negociaBrand) { negociaBrand.className='product-card__brand product-logo-lockup product-logo-lockup--negociaja';negociaBrand.innerHTML=`<img class="negociaja-official-logo" src="https://negociaja.com.br/logo-primary.png" alt="NegocIAJá!" loading="lazy"><span class="negociaja-logo-fallback" aria-hidden="true">Negoc<span>IA</span><b>Já!</b></span>`;negociaBrand.querySelector('img')?.addEventListener('error',e=>e.currentTarget.hidden=true); }
  const seriaBrand = productCardsInitial[2]?.querySelector('.product-card__brand');
  if (seriaBrand) { seriaBrand.className='product-card__brand product-logo-lockup product-logo-lockup--seriamaster';seriaBrand.innerHTML=`<img src="/brand/icon-192.png" alt="" aria-hidden="true"><strong><span>SER</span>&nbsp;<span class="product-logo-ia">IA</span><span class="product-logo-master">MASTER</span></strong>`; }
  const footerBrand = $('.footer-brand');
  if (footerBrand) { const oldLogo=footerBrand.querySelector('img'); if(oldLogo){const lockup=document.createElement('a');lockup.className='footer-brand-lockup';lockup.href='#inicio';lockup.innerHTML=`<img src="/brand/simbolo-branco.png" alt=""><span><strong>SER</strong><em>comtec</em></span>`;oldLogo.replaceWith(lockup);} }

  const injectPortfolioLinks = () => {
    const desktop = $('.desktop-nav');
    if (desktop && !desktop.querySelector('[href="/portfolio.html"]')) {
      const link=document.createElement('a');link.href='/portfolio.html';link.textContent='Portfólio';
      const about=[...desktop.querySelectorAll('a')].find(a=>a.textContent.trim()==='Sobre');desktop.insertBefore(link,about||null);
    }
    const mobile = $('.mobile-menu');
    if (mobile && !mobile.querySelector('[href="/portfolio.html"]')) {
      const link=document.createElement('a');link.href='/portfolio.html';link.textContent='Portfólio';
      const about=[...mobile.querySelectorAll('a')].find(a=>a.textContent.trim()==='Sobre');mobile.insertBefore(link,about||mobile.querySelector('.button'));
    }
    const solutionColumn=[...$$('.site-footer h3')].find(h=>h.textContent.trim()==='Soluções')?.parentElement;
    if(solutionColumn&&!solutionColumn.querySelector('[href="/portfolio.html"]')){const a=document.createElement('a');a.href='/portfolio.html';a.textContent='Portfólio';solutionColumn.insertBefore(a,solutionColumn.firstElementChild?.nextElementSibling||null);}
  };
  injectPortfolioLinks();

  const loadPublicCms = async () => {
    try {
      const response=await fetch('/api/public/site-config');const data=await response.json();if(!response.ok)return;
      const hero=data.hero||{}, heroCopy=$('.hero-copy');
      if(heroCopy){const eyebrow=heroCopy.querySelector('.eyebrow');if(eyebrow&&hero.eyebrow)eyebrow.textContent=hero.eyebrow;const h1=heroCopy.querySelector('h1');if(h1&&(hero.title||hero.highlight)){h1.textContent='';h1.append(document.createTextNode(`${hero.title||'Tecnologia que trabalha'} `));const span=document.createElement('span');span.textContent=hero.highlight||'pelo seu negócio.';h1.appendChild(span);}const ps=heroCopy.querySelectorAll('p');if(ps[0]&&hero.lead)ps[0].textContent=hero.lead;if(ps[1]&&hero.body)ps[1].textContent=hero.body;}
      const contact=data.contact||{};
      if(contact.phone){$$('a[href^="https://wa.me/"]').forEach(a=>{const digits=(contact.whatsapp||contact.phone).replace(/\D/g,'');if(digits)a.href=`https://wa.me/${digits.startsWith('55')?digits:`55${digits}`}`;});}
    } catch {}
  };

  const applyProduct = (card,item,index) => {
    card.dataset.productSlug=item.slug||'';
    const brand=card.querySelector('.product-card__brand');
    if(index>2 || !['serhub','negociaja','ser-ia-master'].includes(item.slug)){
      brand.className='product-card__brand product-logo-lockup';brand.innerHTML='';
      if(item.logo_url){const img=document.createElement('img');img.src=item.logo_url;img.alt='';img.addEventListener('error',()=>img.remove());brand.appendChild(img);}const strong=document.createElement('strong');strong.textContent=item.name;brand.appendChild(strong);
    }
    const preview=card.querySelector('.product-preview');
    if(preview&&item.image_url){preview.innerHTML='';const img=document.createElement('img');img.className='managed-product-image';img.src=item.image_url;img.alt=`${item.name} - interface`;preview.appendChild(img);card.classList.add('product-card--managed');}
    const content=card.querySelector('.product-card__content');if(content){const h=content.querySelector('h3');const p=content.querySelector('p');const a=content.querySelector('a');if(h&&item.tagline)h.textContent=item.tagline;if(p&&item.description)p.textContent=item.description;if(a){a.childNodes[0].textContent=`${item.cta_label||`Conhecer ${item.name}`} `;a.href=item.site_url||'#contato';if(item.site_url){a.target='_blank';a.rel='noreferrer';}}}
  };
  const loadPublicProducts = async () => {
    try { const response=await fetch('/api/public/products');const data=await response.json();if(!response.ok||!Array.isArray(data.items))return;const grid=$('.product-grid');if(!grid)return;let cards=$$('.product-card');data.items.forEach((item,index)=>{let card=cards[index];if(!card){card=document.createElement('article');card.className='product-card product-card--managed';card.innerHTML=`<div class="product-card__brand product-logo-lockup"><strong></strong></div><div class="product-preview"><span class="managed-placeholder">SER COMTEC</span></div><div class="product-card__content"><h3></h3><p></p><a href="#contato">Conhecer solução <svg><use href="/icons.svg#arrow-right"/></svg></a></div>`;grid.appendChild(card);cards.push(card);}applyProduct(card,item,index);});cards.slice(data.items.length).forEach(c=>c.hidden=true); } catch {}
  };
  loadPublicCms();loadPublicProducts();

  const menuToggle=$('.menu-toggle'),mobileMenu=$('.mobile-menu');
  menuToggle?.addEventListener('click',()=>{const willOpen=mobileMenu.hasAttribute('hidden');mobileMenu.toggleAttribute('hidden',!willOpen);menuToggle.setAttribute('aria-expanded',String(willOpen));const use=menuToggle.querySelector('use');if(use)use.setAttribute('href',willOpen?'/icons.svg#x':'/icons.svg#menu');});
  $$('.mobile-menu a').forEach(link=>link.addEventListener('click',()=>{mobileMenu.setAttribute('hidden','');menuToggle?.setAttribute('aria-expanded','false');menuToggle?.querySelector('use')?.setAttribute('href','/icons.svg#menu');}));

  const leadForm=$('#lead-form'),feedback=$('#form-feedback');
  leadForm?.addEventListener('submit',async(event)=>{event.preventDefault();const submit=leadForm.querySelector('button[type="submit"]');const formData=new FormData(leadForm);const payload=Object.fromEntries(formData.entries());payload.interests=formData.getAll('interesse');submit.disabled=true;submit.firstChild.textContent='Enviando... ';feedback.className='';feedback.textContent='';try{const response=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Falha no envio');feedback.className='form-feedback success';feedback.textContent=result.emailSent?'Recebemos seus dados e nossa equipe comercial já foi notificada.':'Recebemos seus dados. Nossa equipe poderá dar continuidade ao atendimento.';if(result.whatsappUrl){const link=document.createElement('a');link.href=result.whatsappUrl;link.target='_blank';link.rel='noreferrer';link.textContent='Continuar pelo WhatsApp';feedback.appendChild(link);}leadForm.reset();}catch{feedback.className='form-feedback error';feedback.textContent='Não foi possível enviar agora. Fale conosco pelo WhatsApp (85) 99166-5259.';}finally{submit.disabled=false;submit.firstChild.textContent='Enviar para um especialista ';}});

  const chat=$('#chat-widget'),chatFab=$('#chat-fab'),closeChat=$('#close-chat'),openChat=$('#open-chat'),chatForm=$('#chat-form'),chatInput=$('#chat-input'),chatMessages=$('#chat-messages'),chatActions=$('#chat-actions'),chatBody=$('#chat-body');let history=[],sending=false;
  const setChatOpen=(open)=>{chat?.toggleAttribute('hidden',!open);chatFab?.toggleAttribute('hidden',open);if(open)setTimeout(()=>chatInput?.focus(),80);};closeChat?.addEventListener('click',()=>setChatOpen(false));chatFab?.addEventListener('click',()=>setChatOpen(true));openChat?.addEventListener('click',()=>setChatOpen(true));
  const addMessage=(role,content,typing=false)=>{chatMessages.removeAttribute('hidden');chatActions?.setAttribute('hidden','');const node=document.createElement('div');node.className=`chat-message chat-message--${role}${typing?' chat-typing':''}`;if(typing){node.innerHTML='<i></i><i></i><i></i>';}else node.textContent=content;chatMessages.appendChild(node);chatBody.scrollTop=chatBody.scrollHeight;return node;};
  const sendMessage=async(message)=>{const clean=String(message||'').trim();if(!clean||sending)return;sending=true;chatInput.value='';addMessage('user',clean);history.push({role:'user',content:clean});history=history.slice(-12);const typing=addMessage('assistant','',true);try{const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})});const result=await response.json();const reply=result.reply||result.error||'Não consegui responder agora. Fale com nossa equipe pelo WhatsApp (85) 99166-5259.';typing.remove();addMessage('assistant',reply);history.push({role:'assistant',content:reply});history=history.slice(-12);}catch{typing.remove();addMessage('assistant','Estou temporariamente sem conexão com o assistente. Fale conosco pelo WhatsApp (85) 99166-5259.');}finally{sending=false;chatInput.focus();}};
  chatForm?.addEventListener('submit',event=>{event.preventDefault();sendMessage(chatInput.value);});$$('#chat-actions button').forEach(button=>button.addEventListener('click',()=>sendMessage(button.dataset.message)));
})();
