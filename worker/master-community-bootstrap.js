import app from './master-community-final.js';

const ALL_AGENTS = ['hakham','arcanum','serafim','serena','luna','delta','orion','lyra','nova','polaris','sirius'];
let bootstrapped = false;

async function bootstrap(env) {
  if (bootstrapped || !env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS master_chat_visitors (
        session_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_master_chat_visitors_expires_at ON master_chat_visitors(expires_at)')
    ]);

    const row = await env.DB.prepare('SELECT active_agents FROM master_roundtable_room WHERE id=1').first();
    const current = String(row?.active_agents || '');
    if (!current.includes('orion') || !current.includes('sirius')) {
      await env.DB.prepare(`
        UPDATE master_roundtable_room
        SET active_agents=?, public_can_prompt=1, updated_at=?
        WHERE id=1
      `).bind(JSON.stringify(ALL_AGENTS), Date.now()).run();
    }
    bootstrapped = true;
  } catch (error) {
    console.error('SER IA Master community bootstrap failure', error);
  }
}

export default {
  async fetch(request, env, ctx) {
    await bootstrap(env);
    return app.fetch(request, env, ctx);
  }
};
