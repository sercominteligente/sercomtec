(() => {
  const slug = document.body.dataset.legalSlug;
  const root = document.querySelector('#legal-content');
  const title = document.querySelector('#legal-title');
  const updated = document.querySelector('#legal-updated');
  fetch(`/api/public/legal/${encodeURIComponent(slug)}`)
    .then(response => response.json().then(data => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok || !data.item) throw new Error(data.error || 'Documento indisponível');
      title.textContent = data.item.title;
      document.title = `${data.item.title} | SER comtec`;
      root.textContent = data.item.content || '';
      if (data.item.updated_at) {
        const d = new Date(data.item.updated_at);
        updated.textContent = `Atualizado em ${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}`;
      } else updated.textContent = '';
    })
    .catch(error => { root.textContent = error.message || 'Não foi possível carregar o documento.'; });
})();
