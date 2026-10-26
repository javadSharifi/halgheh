import Dexie from 'dexie';
import type { Cal } from './cal';

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
export type Birthday = { id: string; name: string; cal: Cal; month: number; day: number; year?: number; phone?: string; personId?: string; updatedAt: number };

/** A person in the notebook. `isSelf: 1` marks the single "me" row; other rows leave it out. */
export type Person = {
  id: string;
  isSelf?: 1;
  displayName: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phones: string[];
  emails: string[];
  city?: string;
  occupation?: string;
  workplace?: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};
export type Tag = { id: string; name: string; updatedAt: number };
export type PersonNote = { id: string; personId: string; text: string; updatedAt: number };
export type Interaction = {
  id: string;
  personId: string;
  type: 'meeting' | 'call' | 'message' | 'other';
  occurredAt: string; // YYYY-MM-DD
  summary: string;
  outcome?: string;
  followUpDate?: string; // YYYY-MM-DD
  updatedAt: number;
};

export type TableName = 'tasks' | 'done' | 'birthdays' | 'people' | 'tags' | 'personNotes' | 'interactions';
export const TABLES: TableName[] = ['tasks', 'done', 'birthdays', 'people', 'tags', 'personNotes', 'interactions'];
/** A local change not yet sent to the server (only used when sync is on). Latest change per row wins. */
export type Outbox = { key: string; t: TableName; id: string; deleted: 0 | 1; updatedAt: number; op?: 'create' | 'edit' | 'delete' }; // op is for the sync screen only; missing on old entries

export const db = new Dexie('halgheh') as Dexie & {
  tasks: Dexie.Table<Task, string>;
  done: Dexie.Table<Done, string>;
  birthdays: Dexie.Table<Birthday, string>;
  people: Dexie.Table<Person, string>;
  tags: Dexie.Table<Tag, string>;
  personNotes: Dexie.Table<PersonNote, string>;
  interactions: Dexie.Table<Interaction, string>;
  outbox: Dexie.Table<Outbox, string>;
};
db.version(1).stores({ notes: 'id', tasks: 'id', done: 'id,date', birthdays: 'id' });
db.version(2).stores({ outbox: 'key' });
// v3: several notes per day. Kept as history; the notes feature is gone in v4.
db.version(3).stores({ notes: 'id,date' });
// v4: remove the daily-notes table; the people app stores notes with a person instead (P1).
db.version(4).stores({ notes: null });
// v5: the people notebook; birthdays can point at a person.
db.version(5).stores({
  people: 'id, isSelf, displayName, updatedAt, archivedAt',
  tags: 'id, name',
  personNotes: 'id, personId, updatedAt',
  interactions: 'id, personId, occurredAt, followUpDate, updatedAt',
  birthdays: 'id, personId',
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

let selfOnce: Promise<void> | null = null;
/** Creates the single "me" row once per install, through put() so it can sync. */
export const ensureSelf = () => (selfOnce ??= createSelf());
async function createSelf() {
  if (await db.people.where('isSelf').equals(1).count()) return;
  const now = Date.now();
  await put('people', { id: uid(), isSelf: 1, displayName: 'من', phones: [], emails: [], createdAt: now, updatedAt: now });
}

export const exportAll = async () =>
  JSON.stringify({ v: 1, ...Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await db[t].toArray()]))) });

/** Merges a backup into the db. Throws on anything that is not a backup. */
export async function importAll(json: string) {
  const d = JSON.parse(json);
  if (d?.v !== 1 || TABLES.some((t) => d[t] !== undefined && !Array.isArray(d[t]))) throw new Error('bad backup');
  for (const t of TABLES) {
    for (const row of d[t] ?? []) await put(t, row);
  }
}
