import app from './entry-node-auth.js';

const ADMIN_HOST = 'app.sercomtec.com.br';
const PUBLIC_HOSTS = new Set(['sercomtec.com.br', 'www.sercomtec.com.br']);

function assetRequest(request, pathname) {
  const target = new URL(request.url);
  target.pathname = pathname;
  target.search = '';
  return new Request(target.toString(), request);
}

async function hasLocalSession(request, env, ctx) {
  const target = new URL(request.url);
  target.pathname = '/api/admin/session';
  target.search = '';
  const response = await app.fetch(new Request(target.toString(), request), env, ctx);
  return response.ok;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // The public domain can still expose the static /admin files. Always send
    // browser visits to the protected administrative host before any asset is
    // served, otherwise the shell opens without working API routes.
    if (request.method === 'GET' && PUBLIC_HOSTS.has(url.hostname) && /^\/admin(?:\/|$)/.test(url.pathname)) {
      return Response.redirect(`https://${ADMIN_HOST}/admin/`, 302);
    }

    if (url.hostname !== ADMIN_HOST || request.method !== 'GET') {
      return app.fetch(request, env, ctx);
    }

    // One canonical browser URL for the administrative shell.
    // Cloudflare Static Assets canonicalizes index.html to the directory URL;
    // serving /admin/index.html from the Worker caused an index redirect loop.
    if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/index.html') {
      return Response.redirect(`${url.origin}/admin/`, 302);
    }

    if (url.pathname === '/admin/') {
      const authenticated = await hasLocalSession(request, env, ctx);
      if (authenticated) {
        // /admin/ is the canonical Static Assets path and resolves index.html
        // without producing another redirect.
        return env.ASSETS.fetch(assetRequest(request, '/admin/'));
      }
      return env.ASSETS.fetch(assetRequest(request, '/admin/login.html'));
    }

    return app.fetch(request, env, ctx);
  },
};
