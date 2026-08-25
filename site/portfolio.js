(() => {
  const root = document.querySelector('#portfolio-grid');
  const filters = [...document.querySelectorAll('#portfolio-filters button')];
  let items = [];
  let category = '';

  const render = () => {
    root.innerHTML = '';
    const visible = items.filter(item => !category || item.category === category);
    if (!visible.length) {
      root.innerHTML = '<div class="portfolio-empty">Nenhum projeto publicado nesta categoria ainda.</div>';
      return;
    }
    visible.forEach(item => {
      const card = document.createElement('article');
      card.className = 'portfolio-card';
      const media = document.createElement('div');
      media.className = 'portfolio-card__media';
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.title;
        img.loading = 'lazy';
        media.appendChild(img);
      } else {
        const placeholder = document.createElement('span');
        placeholder.textContent = 'SER COMTEC';
        media.appendChild(placeholder);
      }
      const body = document.createElement('div');
      body.className = 'portfolio-card__body';
      const cat = document.createElement('div');
      cat.className = 'portfolio-card__category';
      cat.textContent = item.category || 'Projeto';
      const title = document.createElement('h2');
      title.textContent = item.title;
      const summary = document.createElement('p');
      summary.textContent = item.summary || item.description || '';
      const tech = document.createElement('div');
      tech.className = 'portfolio-card__tech';
      (item.technologies || []).slice(0, 7).forEach(value => {
        const tag = document.createElement('i');
        tag.textContent = value;
        tech.appendChild(tag);
      });
      body.append(cat, title, summary, tech);
      if (item.project_url) {
        const link = document.createElement('a');
        link.href = item.project_url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'Ver projeto →';
        body.appendChild(link);
      }
      card.append(media, body);
      root.appendChild(card);
    });
  };

  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    category = button.dataset.category || '';
    render();
  }));

  fetch('/api/public/portfolio')
    .then(response => response.json())
    .then(data => { items = data.items || []; render(); })
    .catch(() => { root.innerHTML = '<div class="portfolio-empty">Não foi possível carregar o portfólio agora.</div>'; });
})();
