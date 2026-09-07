import meetings from './master-creative-meeting.js';

const SPECIALTIES = {
  hakham: 'Estratégia, modelo de negócio e síntese executiva',
  arcanum: 'Branding, posicionamento, experiência e diferenciação',
  serafim: 'Tecnologia, arquitetura, integrações e escalabilidade',
  serena: 'Marketing, aquisição, conteúdo e go-to-market',
  luna: 'Jornada do usuário, onboarding, adoção e clareza',
  delta: 'Red team, concorrência, evidências e sincericídio',
  orion: 'Inteligência de mercado, cenários, concorrentes e capital',
  lyra: 'Público-alvo, jobs-to-be-done, empatia e proposta de valor',
  nova: 'Experimentação, ruptura, MVP e novas possibilidades',
  polaris: 'Execução, governança, operação e prontidão para investimento',
  sirius: 'Dados, unit economics, métricas, inconsistências e riscos'
};

async function rewriteJson(response, pathname) {
  if (!response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;

  const data = await response.json();
  if (data?.room) data.room.roomTitle = 'Mesa Criativa de Produtos';

  if (data?.agents && typeof data.agents === 'object') {
    for (const [key, specialty] of Object.entries(SPECIALTIES)) {
      if (data.agents[key]) data.agents[key].specialty = specialty;
    }
  }

  if (pathname === '/api/studio/dna' && Array.isArray(data?.profiles)) {
    for (const profile of data.profiles) {
      if (profile?.key && SPECIALTIES[profile.key]) profile.specialty = SPECIALTIES[profile.key];
    }
  }

  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await meetings.fetch(request, env, ctx);
    if (
      (url.pathname === '/api/community/state' && request.method === 'GET') ||
      (url.pathname === '/api/community/admin/state' && request.method === 'GET') ||
      (url.pathname === '/api/studio/dna' && request.method === 'GET')
    ) {
      return rewriteJson(response, url.pathname);
    }
    return response;
  }
};
