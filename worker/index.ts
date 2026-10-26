// Optional sync backend. The app works fully offline; this only stores and relays rows between a person's devices.
interface Env {
  DB: D1Database;
}

const TABLES = new Set(['notes', 'tasks', 'done', 'birthdays']);
const MAX_CHANGES = 200; // per request
const MAX_ROW_BYTES = 20_000;
const MAX_ROWS_PER_ACCOUNT = 20_000;

const CORS = {
  'access-control-allow-origin': '*', // bearer-key auth, no cookies, so any origin (the APK's WebView included) may call
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

async function accountHash(req: Request): Promise<string | null> {
  const m = /^Bearer ([\w-]{20,64})$/.exec(req.headers.get('authorization') ?? '');
  if (!m) return null;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1]));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Change = { t: string; id: string; updatedAt: number; deleted?: 0 | 1; data?: string };

function validChange(c: Change): boolean {
  return (
    TABLES.has(c?.t) &&
    typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 100 &&
    Number.isSafeInteger(c.updatedAt) && c.updatedAt > 0 &&
    (c.deleted ? true : typeof c.data === 'string' && c.data.length <= MAX_ROW_BYTES)
  );
}

// The bearer key is derived on the phone from email + password, so the server never sees either. It only knows the key's hash.
// shortcut: anyone can create accounts (no invite, no email check); each account is capped at MAX_ROWS_PER_ACCOUNT. Add a per-IP limit if it is abused.
async function register(req: Request, env: Env, hash: string) {
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: string };
  const exists = !!(await env.DB.prepare('SELECT 1 FROM accounts WHERE hash = ?').bind(hash).first());
  if (mode === 'login') return exists ? json({ ok: true }) : json({ error: 'unknown account' }, 401);
  if (exists) return json({ error: 'exists' }, 409);
  await env.DB.prepare('INSERT INTO accounts (hash, created_at) VALUES (?, ?)').bind(hash, Date.now()).run();
  return json({ ok: true });
}

async function sync(req: Request, env: Env, hash: string) {
  if (!(await env.DB.prepare('SELECT 1 FROM accounts WHERE hash = ?').bind(hash).first())) return json({ error: 'unknown key' }, 401);
  const body = (await req.json().catch(() => null)) as { since?: number; changes?: Change[] } | null;
  const since = body?.since;
  const changes = body?.changes ?? [];
  if (!body || !Number.isSafeInteger(since) || !Array.isArray(changes) || changes.length > MAX_CHANGES || !changes.every(validChange)) {
    return json({ error: 'bad request' }, 400);
  }

  const stmts: D1PreparedStatement[] = [];
  if (changes.length) {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM rows WHERE account = ?').bind(hash).first<{ n: number }>();
    if ((n?.n ?? 0) + changes.length > MAX_ROWS_PER_ACCOUNT) return json({ error: 'full' }, 413);
    stmts.push(env.DB.prepare('UPDATE accounts SET clock = clock + 1 WHERE hash = ?').bind(hash));
    // Last write wins per row: an older updatedAt never overwrites a newer one.
    const upsert = env.DB.prepare(
      `INSERT INTO rows (account, tbl, id, data, updated_at, deleted, server_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT clock FROM accounts WHERE hash = ?))
       ON CONFLICT (account, tbl, id) DO UPDATE SET
         data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, server_at = excluded.server_at
       WHERE excluded.updated_at > rows.updated_at`,
    );
    for (const c of changes) stmts.push(upsert.bind(hash, c.t, c.id, c.deleted ? null : c.data, c.updatedAt, c.deleted ? 1 : 0, hash));
  }
  // shortcut: a pull that races another device's push can miss that push until the next change; a "full resync" button fixes it if it ever matters
  stmts.push(
    env.DB.prepare('SELECT tbl, id, data, updated_at, deleted FROM rows WHERE account = ? AND server_at > ?').bind(hash, since),
    env.DB.prepare('SELECT clock FROM accounts WHERE hash = ?').bind(hash),
  );
  const res = await env.DB.batch(stmts);
  const pulled = res[res.length - 2].results;
  const clock = (res[res.length - 1].results[0] as { clock: number }).clock;
  return json({ changes: pulled, clock });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST' || (pathname !== '/api/register' && pathname !== '/api/sync')) return json({ error: 'not found' }, 404);
    const hash = await accountHash(req);
    if (!hash) return json({ error: 'unauthorized' }, 401);
    return pathname === '/api/register' ? register(req, env, hash) : sync(req, env, hash);
  },
};
