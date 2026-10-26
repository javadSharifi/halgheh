import { liveQuery } from 'dexie';
import { TABLES, type TableName, db } from './db';
import { normalizeNote } from './notes';

/** Sync is opt-in: without a saved config none of this runs and the app never touches the network. */
export type SyncCfg = { url: string; key: string; since: number; at: number; email?: string }; // since = server clock we have pulled up to, at = last success

export const DEFAULT_URL: string = import.meta.env.VITE_SYNC_URL ?? '';
const LS = 'sync';
const BATCH = 200; // must match the Worker's MAX_CHANGES
const STALE_MS = 10 * 60_000; // on resume, sync only if the last one is older than this

export const getCfg = (): SyncCfg | null => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? 'null');
  } catch {
    return null;
  }
};
const setCfg = (c: SyncCfg | null) => (c ? localStorage.setItem(LS, JSON.stringify(c)) : localStorage.removeItem(LS));

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function call<T>(cfg: SyncCfg, path: string, body: unknown): Promise<T> {
  const r = await fetch(cfg.url.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}

/** The account key: email and password stretched into 32 bytes. Same email + password on any phone gives the same key. */
export async function deriveKey(email: string, password: string) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`rooznegar|${email.trim().toLowerCase()}`), iterations: 200_000 }, base, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function enqueueAll() {
  for (const t of TABLES) {
    for (const r of await db[t].toArray()) await db.outbox.put({ key: `${t}|${r.id}`, t, id: r.id, deleted: 0, updatedAt: r.updatedAt });
  }
}

/** Create an account (`signUp`) or sign in to an existing one; either way this phone's data is merged with the cloud copy. */
export async function connect(url: string, email: string, password: string, mode: 'register' | 'login') {
  const cfg: SyncCfg = { url, key: await deriveKey(email, password), since: 0, at: 0, email: email.trim().toLowerCase() };
  await call(cfg, '/api/register', { mode });
  setCfg(cfg);
  try {
    await enqueueAll();
    await syncNow();
  } catch (e) {
    setCfg(null);
    await db.outbox.clear();
    throw e;
  }
}

export async function disableSync() {
  setCfg(null);
  await db.outbox.clear();
}

type Remote = { tbl: TableName; id: string; data: string | null; updated_at: number; deleted: 0 | 1 };

async function applyRemote(changes: Remote[]) {
  await db.transaction('rw', [...TABLES.map((t) => db[t]), db.outbox], async () => {
    for (const c of changes) {
      if (!TABLES.includes(c.tbl)) continue;
      const pending = await db.outbox.get(`${c.tbl}|${c.id}`);
      if (pending && pending.updatedAt >= c.updated_at) continue; // our own newer change is still on its way up
      const local = await db[c.tbl].get(c.id);
      if (local && local.updatedAt >= c.updated_at) continue;
      if (c.deleted) {
        await db[c.tbl].delete(c.id);
        continue;
      }
      const parsed = c.data ? JSON.parse(c.data) : null;
      const row = c.tbl === 'notes' ? normalizeNote(parsed) : parsed; // another device may still send the old note shape
      if (row?.id === c.id) await db[c.tbl].put(row);
    }
  });
}

async function run() {
  const cfg = getCfg();
  if (!cfg) return;
  for (;;) {
    const pending = await db.outbox.limit(BATCH).toArray();
    const changes = [];
    for (const o of pending) {
      if (o.deleted) changes.push({ t: o.t, id: o.id, updatedAt: o.updatedAt, deleted: 1 });
      else {
        const row = await db[o.t].get(o.id);
        if (row) changes.push({ t: o.t, id: o.id, updatedAt: o.updatedAt, data: JSON.stringify(row) });
      }
    }
    const res = await call<{ changes: Remote[]; clock: number }>(cfg, '/api/sync', { since: cfg.since, changes });
    await applyRemote(res.changes);
    await db.transaction('rw', db.outbox, async () => {
      for (const o of pending) {
        const cur = await db.outbox.get(o.key);
        if (cur && cur.updatedAt === o.updatedAt && cur.deleted === o.deleted) await db.outbox.delete(o.key); // unchanged since we sent it
      }
    });
    cfg.since = res.clock;
    cfg.at = Date.now();
    setCfg(cfg);
    if (pending.length < BATCH) return;
  }
}

let running: Promise<void> | null = null;
/** One sync at a time; callers share the same run. */
export const syncNow = () => (running ??= run().finally(() => (running = null)));

/** Keeps data flowing while the app is open: after local edits, on resume and when the network returns. Returns the cleanup. */
export function startSync() {
  let timer: ReturnType<typeof setTimeout>;
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(() => {}), ms); // offline or server down: stay quiet, the outbox keeps the changes
  };
  const resume = () => {
    const c = getCfg();
    if (c && Date.now() - c.at > STALE_MS) soon(500);
  };
  const sub = liveQuery(() => db.outbox.count()).subscribe({ next: (n) => n && getCfg() && soon(20_000) }); // batches a burst of edits into one request
  const online = () => getCfg() && soon(1000);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', online);
  resume();
  return () => {
    clearTimeout(timer);
    sub.unsubscribe();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', online);
  };
}
