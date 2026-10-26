import Dexie from 'dexie';
import type { Cal } from './cal';
import { type Note, normalizeNote } from './notes';

export type { Note };

// Every row has a client-made UUID id and updatedAt so sync can be added later without a migration.
// mask bit = JS weekday. The optional fields were added later; a row without them means: active, no time, no reminder.
export type Task = {
  id: string;
  title: string;
  mask: number;
  start: string;
  end?: string;
  updatedAt: number;
  description?: string;
  time?: string; // 'HH:MM', local
  remindLead?: number; // minutes before `time` to remind; 0 = at the time; missing = no reminder
  active?: boolean; // false = paused
  on?: string; // one-off task: the only date it runs on (mask is 0)
  before?: number[]; // one-off task: also remind this many days ahead (at `time`, or 09:00)
};
export type Done = { id: string; taskId: string; date: string; updatedAt: number; doneAt?: number }; // id = `${taskId}|${date}`; doneAt = when it was ticked (ms), missing on old rows
export type Birthday = { id: string; name: string; cal: Cal; month: number; day: number; year?: number; phone?: string; updatedAt: number };

export type TableName = 'notes' | 'tasks' | 'done' | 'birthdays';
export const TABLES: TableName[] = ['notes', 'tasks', 'done', 'birthdays'];
/** A local change not yet sent to the server (only used when sync is on). Latest change per row wins. */
export type Outbox = { key: string; t: TableName; id: string; deleted: 0 | 1; updatedAt: number; op?: 'create' | 'edit' | 'delete' }; // op is for the sync screen only; missing on old entries

export const db = new Dexie('date-app') as Dexie & {
  notes: Dexie.Table<Note, string>;
  tasks: Dexie.Table<Task, string>;
  done: Dexie.Table<Done, string>;
  birthdays: Dexie.Table<Birthday, string>;
  outbox: Dexie.Table<Outbox, string>;
};
db.version(1).stores({ notes: 'id', tasks: 'id', done: 'id,date', birthdays: 'id' });
db.version(2).stores({ outbox: 'key' });
// v3: several notes per day. Notes keep their id (so synced copies stay the same row) and gain `date`, which is indexed.
db.version(3)
  .stores({ notes: 'id,date' })
  .upgrade(async (tx) => {
    const migrated: Outbox[] = [];
    await tx.table('notes').toCollection().modify((row, ctx) => {
      const n = normalizeNote(row);
      if (!n || row.date) return; // unreadable, or already in the new shape
      n.updatedAt = Date.now(); // newer than the server's copy, so the new shape wins there too
      ctx.value = n;
      migrated.push({ key: `notes|${n.id}`, t: 'notes', id: n.id, deleted: 0, updatedAt: n.updatedAt });
    });
    await tx.table('outbox').bulkPut(migrated);
  });

/** Every user write goes through put/del so sync sees it. Sync's own writes bypass them. */
export async function put(t: TableName, row: { id: string; updatedAt: number } & Record<string, unknown>) {
  await db.transaction('rw', db[t], db.outbox, async () => {
    const key = `${t}|${row.id}`;
    const existed = await db[t].get(row.id);
    const prev = await db.outbox.get(key);
    await db[t].put(row as never);
    // still a "create" if the server has not seen the row yet, however often it is edited meanwhile
    await db.outbox.put({ key, t, id: row.id, deleted: 0, updatedAt: row.updatedAt, op: prev?.op === 'create' || !existed ? 'create' : 'edit' });
  });
}

export async function del(t: TableName, id: string) {
  await db.transaction('rw', db[t], db.outbox, async () => {
    await db[t].delete(id);
    await db.outbox.put({ key: `${t}|${id}`, t, id, deleted: 1, updatedAt: Date.now(), op: 'delete' });
  });
}

export const uid = () => crypto.randomUUID();

export const exportAll = async () =>
  JSON.stringify({ v: 1, ...Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await db[t].toArray()]))) });

/** Merges a backup into the db. Throws on anything that is not a backup. */
export async function importAll(json: string) {
  const d = JSON.parse(json);
  if (d?.v !== 1 || TABLES.some((t) => d[t] !== undefined && !Array.isArray(d[t]))) throw new Error('bad backup');
  for (const t of TABLES) {
    for (const raw of d[t] ?? []) {
      const row = t === 'notes' ? normalizeNote(raw) : raw; // backups from before multi-note days have the old shape
      if (row) await put(t, row);
    }
  }
}
