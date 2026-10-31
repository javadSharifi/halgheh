// Optional sync backend. The app works fully offline; this only stores and relays rows between a person's devices.
interface Env {
  DB: D1Database;
  /** Photo files (B2b). Optional so the Worker still deploys and the app still works before R2 is enabled. */
  PHOTOS?: R2Bucket;
}

const TABLES = new Set([
  'tasks',
  'done',
  'birthdays',
  'people',
  'tags',
  'personTags',
  'personNotes',
  'interactions',
  'skills',
  'personSkills',
  'ratings',
  'relationships',
  'photos',
  // Rulebook phase 1: categories, rules, append-only reviews and the purchase comparison
  'ruleCategories',
  'rules',
  'ruleReviews',
  'compareSessions',
  'compareItems',
  'compareChecks',
  // Rulebook parts 1-3: the broken-rule log, the per-person rule check, and the back-and-forth ledger
  'ruleBreaks',
  'ruleChecks',
  'ruleCheckItems',
  'exchanges',
  'exchangeSettlements',
]);
const MAX_CHANGES = 200; // per request
const MAX_ROW_BYTES = 20_000;
const MAX_ROWS_PER_ACCOUNT = 20_000;
// B2b limits per user and per request
const MAX_PHOTOS_PER_ACCOUNT = 300;
const MAX_PHOTO_BYTES = 1_500_000; // 1.5 MB, matching the client's compression target
const MAX_UPLOAD_REQUEST = 8_000_000; // a hard cap on the whole request body before anything is read
/** Row-sync bodies are small: 200 changes x 20 KB is ~4 MB, so this leaves room without letting a body run wild. */
const MAX_SYNC_REQUEST = 5_000_000;
/** Any other JSON route (register) should be tiny. */
const MAX_JSON_REQUEST = 8_000;

/**
 * B1: rate limits for the two endpoints an attacker would try to hammer. A login attempt also needs the right derived key,
 * but this stops an online guessing loop from being cheap. Limits are per window and per bucket; `retry-after` tells a
 * well-behaved client when to come back.
 */
const LIMITS = {
  register: { max: 5, windowMs: 60 * 60_000 }, // 5 new accounts per hour per IP
  login: { max: 20, windowMs: 10 * 60_000 }, // 20 login attempts per 10 minutes per IP
  sync: { max: 240, windowMs: 60 * 60_000 }, // a normal client batches; this only catches a runaway loop
  photo: { max: 120, windowMs: 60 * 60_000 }, // uploads are heavier than rows; a first backup of 300 photos still fits in a few hours
} as const;
type LimitName = keyof typeof LIMITS;

/** The client IP Cloudflare reports; never used for anything but the rate-limit bucket. */
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

/**
 * Counts one hit in `bucket` and reports whether it is allowed. The window is fixed rather than sliding to keep this to a
 * single statement on D1: when the stored window has expired the row is replaced, otherwise the count is incremented.
 * Counting happens before the work, so a rejected request costs nothing beyond this row.
 */
async function allow(env: Env, name: LimitName, bucket: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const { max, windowMs } = LIMITS[name];
  const now = Date.now();
  const key = `${name}|${bucket}`;
  const row = await env.DB.prepare('SELECT window_start, hits FROM rate_limits WHERE bucket = ?').bind(key).first<{ window_start: number; hits: number }>();
  if (!row || now - row.window_start >= windowMs) {
    await env.DB.prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1) ON CONFLICT (bucket) DO UPDATE SET window_start = excluded.window_start, hits = 1')
      .bind(key, now)
      .run();
    return { ok: true };
  }
  if (row.hits >= max) return { ok: false, retryAfter: Math.ceil((row.window_start + windowMs - now) / 1000) };
  await env.DB.prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ?').bind(key).run();
  return { ok: true };
}

const CORS = {
  'access-control-allow-origin': '*', // bearer-key auth, no cookies, so any origin (the APK's WebView included) may call
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

/**
 * Reads a JSON body but stops at `max` bytes, so a request that lies about (or omits) `content-length` still cannot make
 * the Worker buffer an unbounded string. Returns null when the body is too large or is not valid JSON.
 */
async function readJson(req: Request, max: number): Promise<unknown | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  try {
    // join without Node's Buffer: the Workers runtime is not Node
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    return null;
  }
}

async function accountHash(req: Request): Promise<string | null> {
  const m = /^Bearer ([\w-]{20,64})$/.exec(req.headers.get('authorization') ?? '');
  if (!m) return null;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1]));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Change = { t: string; id: string; updatedAt: number; deleted?: 0 | 1; data?: string };

/**
 * B4: `updatedAt` is the client clock and decides conflicts, so an unbounded value is a real hole — one row pushed with a
 * far-future timestamp would win every later conflict forever and could never be edited again. Timestamps far beyond
 * "now" are refused instead of stored. A clock that is merely a bit off still works (accepted up to the skew below).
 */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000; // one day ahead is tolerated

function validChange(c: Change): boolean {
  return (
    TABLES.has(c?.t) &&
    typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 100 &&
    Number.isSafeInteger(c.updatedAt) && c.updatedAt > 0 &&
    c.updatedAt <= Date.now() + MAX_CLOCK_SKEW_MS &&
    (c.deleted ? true : typeof c.data === 'string' && c.data.length <= MAX_ROW_BYTES)
  );
}

// The bearer key is derived on the phone from email + password, so the server never sees either. It only knows the key's hash.
// Registration is open (no invite, no email check) but rate limited per IP; each account is capped at MAX_ROWS_PER_ACCOUNT.
async function register(req: Request, env: Env, hash: string, ip: string) {
  const parsed = (await readJson(req, MAX_JSON_REQUEST)) as { mode?: string } | null;
  if (parsed === null) return json({ error: 'bad request' }, 400);
  const { mode } = parsed;
  const limit = await allow(env, mode === 'login' ? 'login' : 'register', ip);
  if (!limit.ok) return json({ error: 'rate limited', retryAfter: limit.retryAfter }, 429);
  const exists = !!(await env.DB.prepare('SELECT 1 FROM accounts WHERE hash = ?').bind(hash).first());
  if (mode === 'login') return exists ? json({ ok: true }) : json({ error: 'unknown account' }, 401);
  if (exists) return json({ error: 'exists' }, 409);
  await env.DB.prepare('INSERT INTO accounts (hash, created_at) VALUES (?, ?)').bind(hash, Date.now()).run();
  return json({ ok: true });
}

async function sync(req: Request, env: Env, hash: string, ip: string) {
  if (!(await env.DB.prepare('SELECT 1 FROM accounts WHERE hash = ?').bind(hash).first())) return json({ error: 'unknown key' }, 401);
  // keyed by account as well as IP: one runaway phone must not lock out every other user behind the same address
  const limit = await allow(env, 'sync', `${ip}|${hash.slice(0, 16)}`);
  if (!limit.ok) return json({ error: 'rate limited', retryAfter: limit.retryAfter }, 429);
  const body = (await readJson(req, MAX_SYNC_REQUEST)) as { since?: number; changes?: Change[] } | null;
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


/**
 * B2b: photo files.
 *
 * Storage backend, in order of preference:
 *   1. **R2** whenever the `PHOTOS` binding exists (the intended production path);
 *   2. **D1 chunks** otherwise. R2 has to be switched on in the Cloudflare dashboard, which cannot be done from code, so
 *      this fallback keeps photo backup working today. The client API is identical either way, so enabling R2 later is a
 *      server-side change only — nothing on the phone needs to know.
 *
 * Every key is prefixed with the account hash, so one user's key can never address another user's file.
 */
const photoKey = (hash: string, photoId: string) => `${hash}/photos/${photoId}.jpg`;

/** Only ids the client would actually produce; anything else is rejected before it reaches storage. */
const validPhotoId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(id);

/** D1 chunk size. Small enough that a row stays modest; a 1.5 MB file becomes ~40 rows. */
const CHUNK_CHARS = 50_000;

const backend = (env: Env) => (env.PHOTOS ? 'r2' : 'd1');

async function uploadPhoto(req: Request, env: Env, hash: string, photoId: string) {
  if (!validPhotoId(photoId)) return json({ error: 'bad photo id' }, 400);

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_UPLOAD_REQUEST) return json({ error: 'too large' }, 413);

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) return json({ error: 'empty body' }, 400);
  if (body.byteLength > MAX_PHOTO_BYTES) return json({ error: 'too large' }, 413);
  // a JPEG starts with FF D8; this is a cheap sanity check, not a re-encode
  const head = new Uint8Array(body.slice(0, 2));
  if (head[0] !== 0xff || head[1] !== 0xd8) return json({ error: 'not a jpeg' }, 400);

  if (env.PHOTOS) {
    const key = photoKey(hash, photoId);
    // overwriting an existing photo must not count against the cap a second time
    const existing = await env.PHOTOS.head(key);
    if (!existing) {
      const n = await env.PHOTOS.list({ prefix: `${hash}/photos/`, limit: MAX_PHOTOS_PER_ACCOUNT + 1 });
      if (n.objects.length >= MAX_PHOTOS_PER_ACCOUNT) return json({ error: 'photo limit reached' }, 413);
    }
    await env.PHOTOS.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } });
    return json({ ok: true, bytes: body.byteLength, backend: 'r2' });
  }

  // D1 fallback: count, split into chunks, replace any previous version of the same photo in one batch
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM photo_files WHERE account = ?').bind(hash).first<{ n: number }>();
  const exists = !!(await env.DB.prepare('SELECT 1 FROM photo_files WHERE account = ? AND photo_id = ?').bind(hash, photoId).first());
  if (!exists && (count?.n ?? 0) >= MAX_PHOTOS_PER_ACCOUNT) return json({ error: 'photo limit reached' }, 413);

  // base64 in chunks; TextEncoder-free because the bytes are binary, so encode once and slice the string
  const bytes = new Uint8Array(body);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const b64 = btoa(bin);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_CHARS) chunks.push(b64.slice(i, i + CHUNK_CHARS));

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM photo_chunks WHERE account = ? AND photo_id = ?').bind(hash, photoId),
  ];
  chunks.forEach((data, seq) => {
    stmts.push(env.DB.prepare('INSERT INTO photo_chunks (account, photo_id, seq, data) VALUES (?, ?, ?, ?)').bind(hash, photoId, seq, data));
  });
  stmts.push(
    env.DB.prepare('INSERT INTO photo_files (account, photo_id, bytes, chunks, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (account, photo_id) DO UPDATE SET bytes = excluded.bytes, chunks = excluded.chunks, created_at = excluded.created_at')
      .bind(hash, photoId, body.byteLength, chunks.length, Date.now()),
  );
  await env.DB.batch(stmts);
  return json({ ok: true, bytes: body.byteLength, backend: 'd1' });
}

async function downloadPhoto(env: Env, hash: string, photoId: string) {
  if (!validPhotoId(photoId)) return json({ error: 'bad photo id' }, 400);

  if (env.PHOTOS) {
    const obj = await env.PHOTOS.get(photoKey(hash, photoId));
    if (!obj) return json({ error: 'not found' }, 404);
    return new Response(obj.body, {
      headers: { ...CORS, 'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': 'private, max-age=3600' },
    });
  }

  const meta = await env.DB.prepare('SELECT bytes, chunks FROM photo_files WHERE account = ? AND photo_id = ?').bind(hash, photoId).first<{ bytes: number; chunks: number }>();
  if (!meta) return json({ error: 'not found' }, 404);
  const parts = await env.DB.prepare('SELECT data FROM photo_chunks WHERE account = ? AND photo_id = ? ORDER BY seq').bind(hash, photoId).all<{ data: string }>();
  const b64 = parts.results.map((r) => r.data).join('');
  if (b64.length === 0) return json({ error: 'not found' }, 404);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== meta.bytes) return json({ error: 'corrupt photo' }, 500);
  return new Response(bytes, {
    headers: { ...CORS, 'content-type': 'image/jpeg', 'content-length': String(bytes.length), 'cache-control': 'private, max-age=3600' },
  });
}

/** Lets the client ask which of its photos the server already has, so a restored phone downloads only what is missing. */
async function listPhotos(env: Env, hash: string) {
  if (env.PHOTOS) {
    const out: { id: string; bytes: number }[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await env.PHOTOS.list({ prefix: `${hash}/photos/`, cursor, limit: 1000 });
      for (const o of page.objects) {
        const id = o.key.slice(`${hash}/photos/`.length).replace(/\.jpg$/, '');
        out.push({ id, bytes: o.size });
      }
      if (!page.truncated) break;
      cursor = page.cursor;
    }
    return json({ photos: out, backend: 'r2' });
  }
  const rows = await env.DB.prepare('SELECT photo_id, bytes FROM photo_files WHERE account = ?').bind(hash).all<{ photo_id: string; bytes: number }>();
  return json({ photos: rows.results.map((r) => ({ id: r.photo_id, bytes: r.bytes })), backend: 'd1' });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    /**
     * B4: refuse an oversized body before it is read. `content-length` is checked when present (the usual case); a request
     * without it still hits the per-route caps below, and the photo route re-checks the real byte length after reading.
     * This runs before auth so a flood costs almost nothing.
     */
    const cap = pathname.startsWith('/api/photo') ? MAX_UPLOAD_REQUEST : pathname === '/api/sync' ? MAX_SYNC_REQUEST : MAX_JSON_REQUEST;
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > cap) return json({ error: 'too large' }, 413);
    const hash = await accountHash(req);
    if (!hash) return json({ error: 'unauthorized' }, 401);
    const ip = clientIp(req);

    /**
     * B2b routes. Uploads and downloads are authorized by the same Bearer key as sync; a key that has no account row is
     * rejected before it can touch R2, so a made-up key cannot probe for other users' files.
     */
    if (pathname === '/api/photo' || pathname.startsWith('/api/photo/')) {
      const known = !!(await env.DB.prepare('SELECT 1 FROM accounts WHERE hash = ?').bind(hash).first());
      if (!known) return json({ error: 'unknown key' }, 401);
      const id = pathname.startsWith('/api/photo/') ? pathname.slice('/api/photo/'.length) : new URL(req.url).searchParams.get('id') ?? '';
      if (req.method === 'PUT') {
        const limit = await allow(env, 'photo', `${ip}|${hash.slice(0, 16)}`);
        if (!limit.ok) return json({ error: 'rate limited', retryAfter: limit.retryAfter }, 429);
        return uploadPhoto(req, env, hash, id);
      }
      if (req.method === 'GET' && pathname === '/api/photo') return listPhotos(env, hash);
      if (req.method === 'GET') return downloadPhoto(env, hash, id);
      return json({ error: 'not found' }, 404);
    }

    if (req.method !== 'POST' || (pathname !== '/api/register' && pathname !== '/api/sync')) return json({ error: 'not found' }, 404);
    return pathname === '/api/register' ? register(req, env, hash, ip) : sync(req, env, hash, ip);
  },
};
