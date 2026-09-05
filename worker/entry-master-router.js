import base from './entry-admin-features.js';
import master from './master.js';

const MASTER_HOST = 'master.sercomtec.com.br';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === MASTER_HOST) return master.fetch(request, env, ctx);
    return base.fetch(request, env, ctx);
  }
};
