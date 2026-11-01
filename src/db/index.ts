import Dexie from 'dexie';
import { SEEDED_KEY, SEED_CATEGORIES } from '../domain/rules/constants';
import type {
  Birthday, CompareCheck, CompareItem, CompareSession, Done, Exchange, ExchangeSettlement, Interaction, Occasion, Outbox, Person,
  PersonNote, PersonSkill, PersonTag, Photo, PhotoFile, Rating, Relationship, Rule, RuleBreak, RuleCategory, RuleCheck,
  RuleCheckItem, RuleReview, Skill, TableName, Tag, Task,
} from './types';

// Row types live in ./types; re-exported so every existing `from './db'` import keeps working.
export * from './types';

/** Tables that sync. `photoFiles` is deliberately absent: image bytes are device-local (section 5). */
export const TABLES: TableName[] = [
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
  'ruleCategories',
  'rules',
  'ruleReviews',
  'compareSessions',
  'compareItems',
  'compareChecks',
  'ruleBreaks',
  'ruleChecks',
  'ruleCheckItems',
  'exchanges',
  'exchangeSettlements',
  'occasions',
];

export const db = new Dexie('halgheh') as Dexie & {
  tasks: Dexie.Table<Task, string>;
  done: Dexie.Table<Done, string>;
  birthdays: Dexie.Table<Birthday, string>;
  people: Dexie.Table<Person, string>;
  tags: Dexie.Table<Tag, string>;
  personTags: Dexie.Table<PersonTag, string>;
  personNotes: Dexie.Table<PersonNote, string>;
  interactions: Dexie.Table<Interaction, string>;
  skills: Dexie.Table<Skill, string>;
  personSkills: Dexie.Table<PersonSkill, string>;
  ratings: Dexie.Table<Rating, string>;
  relationships: Dexie.Table<Relationship, string>;
  photos: Dexie.Table<Photo, string>;
  photoFiles: Dexie.Table<PhotoFile, string>;
  ruleCategories: Dexie.Table<RuleCategory, string>;
  rules: Dexie.Table<Rule, string>;
  ruleReviews: Dexie.Table<RuleReview, string>;
  compareSessions: Dexie.Table<CompareSession, string>;
  compareItems: Dexie.Table<CompareItem, string>;
  compareChecks: Dexie.Table<CompareCheck, string>;
  ruleBreaks: Dexie.Table<RuleBreak, string>;
  ruleChecks: Dexie.Table<RuleCheck, string>;
  ruleCheckItems: Dexie.Table<RuleCheckItem, string>;
  exchanges: Dexie.Table<Exchange, string>;
  exchangeSettlements: Dexie.Table<ExchangeSettlement, string>;
  occasions: Dexie.Table<Occasion, string>;
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
// v6: person <-> tag links (P1 named the table but never created it; P3 is the first screen that needs it).
db.version(6).stores({
  personTags: 'id, personId, tagId, updatedAt',
});
// v7: skills (R1). `skills` is the shared vocabulary; `personSkills` is what one person can do, with evidence.
db.version(7).stores({
  skills: 'id, name, parentId, updatedAt',
  personSkills: 'id, personId, skillId, updatedAt',
});
// v8: rating events (R2). Append-only: the latest row per person+criterion is the current value.
db.version(8).stores({
  ratings: 'id, personId, criterion, ratedAt, updatedAt',
});
// v9: relationships (R3). The unique compound key means one link of each type per pair, stored once and in sorted order
// for symmetric types; `aId`/`bId` keep "all links of a person" cheap.
db.version(9).stores({
  relationships: 'id, aId, bId, type, updatedAt, &[aId+bId+type]',
});
// v10: photos (G1). `photos` is synced metadata; `photoFiles` is device-local and must never be added to TABLES.
db.version(10).stores({
  photos: 'id, personId, takenAt, updatedAt',
  photoFiles: 'photoId',
});
// v11: the personal rulebook (Rulebook phase 1) — categories, rules, append-only reviews, and the purchase comparison.
// `compareChecks` is keyed `${itemId}|${ruleId}`, so one item cannot hold two states for the same rule.
db.version(11)
  .stores({
    ruleCategories: 'id, sortOrder, updatedAt',
    rules: 'id, categoryId, nextReviewOn, pinned, archivedAt, updatedAt',
    ruleReviews: 'id, ruleId, reviewedAt, updatedAt',
    compareSessions: 'id, categoryId, status, updatedAt',
    compareItems: 'id, sessionId, updatedAt',
    compareChecks: 'id, itemId, ruleId, updatedAt',
  })
  .upgrade(async (trans) => {
    // An upgrade from v10 seeds here. Dexie does NOT run `upgrade` for a brand-new database, so a first install is covered
    // by `ensureRuleCategories` below instead — both write the same rows through the same helper. `put()` opens its own
    // transaction and cannot be nested inside an upgrade, so the writes go directly on the upgrade transaction.
    const categories = trans.table<RuleCategory, string>('ruleCategories');
    if (await categories.count()) return;
    const outbox = trans.table<Outbox, string>('outbox');
    const now = Date.now();
    for (const [i, seed] of SEED_CATEGORIES.entries()) {
      const id = crypto.randomUUID();
      const row: RuleCategory = { id, name: seed.name, sortOrder: i, updatedAt: now, ...(seed.compareEnabled && { compareEnabled: true }) };
      await categories.put(row);
      await outbox.put({ key: `ruleCategories|${id}`, t: 'ruleCategories', id, deleted: 0, updatedAt: now, op: 'create' });
    }
  });

// v12: Parts 1-3 of the rulebook follow-up — the broken-rule log, the per-person rule check, and the back-and-forth ledger.
// `brokenCount` stops being maintained by a review: from now on it is derived from `ruleBreaks`, which is why the upgrade
// copies every existing `broke` review into a `ruleBreaks` row (the review stays, so the schedule history is untouched).
db.version(12)
  .stores({
    ruleBreaks: 'id, ruleId, brokenOn, personId, updatedAt',
    ruleChecks: 'id, personId, status, updatedAt',
    ruleCheckItems: 'id, checkId, ruleId, updatedAt',
    exchanges: 'id, personId, status, dueOn, date, updatedAt',
    exchangeSettlements: 'id, exchangeId, date, updatedAt',
  })
  .upgrade(async (trans) => {
    const breaks = trans.table<RuleBreak, string>('ruleBreaks');
    const reviews = trans.table<RuleReview, string>('ruleReviews');
    const outbox = trans.table<Outbox, string>('outbox');
    // only on an upgrade that already has rule data; a brand-new database has no reviews to move
    const broke = await reviews.filter((r) => r.result === 'broke').toArray();
    if (!broke.length) return;
    const now = Date.now();
    for (const r of broke) {
      // one break per `broke` review, so the derived count matches the old stored number exactly
      const id = crypto.randomUUID();
      await breaks.put({ id, ruleId: r.ruleId, brokenOn: r.reviewedOn, updatedAt: now });
      await outbox.put({ key: `ruleBreaks|${id}`, t: 'ruleBreaks', id, deleted: 0, updatedAt: now, op: 'create' });
    }
  });

// v13: yearly occasions that are not birthdays (Nowruz, Mother's Day). Same 3-calendar date; `tagId` groups it.
db.version(13).stores({ occasions: 'id, cal, month, updatedAt' });

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

let ruleSeedOnce: Promise<void> | null = null;
/**
 * Seeds the default categories on a brand-new install (Dexie skips `upgrade` when the database is created from scratch).
 * A marker in localStorage records that the seed has happened, so a user who deletes every category is NOT given the
 * defaults back on the next start — the same intent as the upgrade path, which only seeds when it finds the table empty.
 * Runs through `put()` so sync sees the rows.
 */
export const ensureRuleCategories = () => (ruleSeedOnce ??= seedRuleCategories());
async function seedRuleCategories() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (await db.ruleCategories.count()) {
    localStorage.setItem(SEEDED_KEY, String(Date.now())); // rows from sync or an upgrade: nothing to seed
    return;
  }
  const now = Date.now();
  for (const [i, seed] of SEED_CATEGORIES.entries()) {
    await put('ruleCategories', {
      id: uid(),
      name: seed.name,
      sortOrder: i,
      updatedAt: now,
      ...(seed.compareEnabled && { compareEnabled: true }),
    } as RuleCategory & { id: string; updatedAt: number });
  }
  localStorage.setItem(SEEDED_KEY, String(now));
}

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
