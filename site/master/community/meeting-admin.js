(() => {
  const form = document.querySelector('#meeting-form');
  const brief = document.querySelector('#meeting-brief');
  const project = document.querySelector('#meeting-project');
  const chair = document.querySelector('#meeting-chair');
  const memory = document.querySelector('#meeting-memory');
  const imagesInput = document.querySelector('#meeting-images');
  const preview = document.querySelector('#meeting-image-preview');
  const charCount = document.querySelector('#meeting-char-count');
  const button = document.querySelector('#meeting-start');
  const report = document.querySelector('#meeting-report');
  const status = document.querySelector('#meeting-status');
  if (!form || !brief || !project || !chair || !memory || !imagesInput || !preview || !charCount || !button || !report || !status) return;

  const MAX_IMAGES = 4;
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  let selectedImages = [];

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

  function updateCounter() {
    charCount.textContent = new Intl.NumberFormat('pt-BR').format(brief.value.length);
  }

  function readableSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderImages() {
    preview.replaceChildren();
    selectedImages.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'meeting-image-card';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });

      const info = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = file.name;
      const size = document.createElement('small');
      size.textContent = readableSize(file.size);
      info.append(name, size);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${file.name}`);
      remove.addEventListener('click', () => {
        selectedImages.splice(index, 1);
        renderImages();
      });

      card.append(img, info, remove);
      preview.append(card);
    });
  }

  function acceptImages(files) {
    const validTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const next = [];
    for (const file of files) {
      if (!validTypes.has(file.type)) {
        setStatus(`${file.name}: formato não aceito. Use JPG, PNG ou WebP.`, 'is-error');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus(`${file.name}: ultrapassa 4 MB.`, 'is-error');
        continue;
      }
      next.push(file);
    }
    selectedImages = [...selectedImages, ...next].slice(0, MAX_IMAGES);
    if (files.length + selectedImages.length > MAX_IMAGES) {
      setStatus('A reunião aceita até 4 imagens por vez.', 'is-error');
    }
    imagesInput.value = '';
    renderImages();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function serializeImages() {
    return Promise.all(selectedImages.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await readFileAsDataUrl(file)
    })));
  }

  brief.addEventListener('input', updateCounter);
  imagesInput.addEventListener('change', () => acceptImages([...imagesInput.files]));

  const savedProject = localStorage.getItem('ser-master-last-project');
  const savedChair = localStorage.getItem('ser-master-last-chair');
  if (savedProject) project.value = savedProject;
  if (savedChair && [...chair.options].some((option) => option.value === savedChair)) chair.value = savedChair;
  updateCounter();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = brief.value.trim();
    const projectName = project.value.trim();
    const chairKey = chair.value;

    if (text.length < 12) {
      setStatus('Descreva um pouco melhor a ideia antes de convocar a equipe.', 'is-error');
      brief.focus();
      return;
    }

    localStorage.setItem('ser-master-last-project', projectName);
    localStorage.setItem('ser-master-last-chair', chairKey);

    button.disabled = true;
    brief.disabled = true;
    project.disabled = true;
    chair.disabled = true;
    memory.disabled = true;
    imagesInput.disabled = true;
    report.hidden = true;
    setStatus('Reunião em andamento: o coordenador está montando a pauta, a equipe fará pesquisa e análise por especialidade e depois fechará o relatório...', 'is-running');

    try {
      const images = await serializeImages();
      const result = await call('/api/pro/meeting/start', {
        method: 'POST',
        body: JSON.stringify({
          brief: text,
          projectName,
          chair: chairKey,
          useMemory: memory.checked,
          images
        })
      });

      brief.value = '';
      selectedImages = [];
      renderImages();
      updateCounter();

      if (result.reportUrl) {
        report.href = result.reportUrl;
        report.hidden = false;
      }

      const visual = Number(result.imagesAnalyzed || 0) > 0 ? ` · ${result.imagesAnalyzed} imagem(ns) analisada(s)` : '';
      const memoryNote = result.memoryUsed ? ' · memória anterior utilizada' : '';
      setStatus(`Reunião #${result.meetingId || 'nova'} concluída sob coordenação de ${result.chairName || 'um agente'} com ${result.contributions || 0} contribuições${visual}${memoryNote}.`, 'is-success');
    } catch (error) {
      setStatus(error.message || 'Não foi possível concluir a reunião.', 'is-error');
    } finally {
      button.disabled = false;
      brief.disabled = false;
      project.disabled = false;
      chair.disabled = false;
      memory.disabled = false;
      imagesInput.disabled = false;
    }
  });
})();
