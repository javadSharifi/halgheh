import type { Birthday, Exchange, Interaction, Person, PersonNote, PersonSkill, Photo, Rule, Skill, Tag, Task } from '../../db';
import { nextOccurrence } from '../../format';
import { normPhone } from '../../phone';
import { normalize } from '../../search';
import { tx } from '../../i18n';

/**
 * Section 6 of TASKS.md, as pure functions with no UI and no Dexie import: build an index from rows, run a query over
 * it, and get back plain "why" facts. Everything here is deterministic and testable without a browser.
 */

/** A row that can be searched, with its fields already flattened into strings. */
export type Doc = {
  kind: 'person' | 'note' | 'todo' | 'interaction' | 'tag' | 'birthday' | 'photo' | 'rule' | 'exchange';
  id: string;
  personId?: string; // set when the row belongs to a person (notes, interactions, birthday)
  title: string;
  fields: string[]; // every searchable string of the row, normalized once at index time
  /** Lower number = earlier in the same group; filled by the page (evidence, trust, recency). */
  rank?: number;
};

export type Index = { docs: Doc[] };

const push = (fields: string[], v: string | undefined | null) => {
  const s = (v ?? '').trim();
  if (s) fields.push(s);
};

/**
 * Section 6: phone search keeps digits and folds a `+98`/`0098`/`98` prefix to a leading `0`, so `+98 912…` and
 * `0912…` are the same number. Both spellings are indexed so either one typed is found.
 */
const pushPhone = (fields: string[], raw: string | undefined | null) => {
  push(fields, raw);
  const n = normPhone(raw ?? '');
  if (n && n !== (raw ?? '').trim()) push(fields, n);
};

/**
 * Every word of the query must match somewhere, and a word may match the middle of a word (section 6 allows a prefix
 * match; using `includes` keeps "مکانیک" findable when the user types "کان"). Returns the fields that matched, which is
 * what the result row shows as its "why" chips.
 */
export function matchedFields(doc: Doc, words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    const hit = doc.fields.find((f) => normalize(f).n.includes(w));
    if (!hit) return []; // one missing word is enough to drop the row
    out.push(hit);
  }
  return out;
}

export const queryWords = (q: string) => normalize(q).n.trim().split(/\s+/).filter(Boolean);

/** The rows the page shows, keeping the order the caller built (the page decides ranking, not this module). */
export function runSearch(index: Index, q: string) {
  const words = queryWords(q);
  if (words.length === 0) return [];
  return index.docs
    .map((doc) => ({ doc, why: matchedFields(doc, words) }))
    .filter((r) => r.why.length > 0);
}

// ---- building the index from rows ----

export type Snap = {
  people: Person[];
  tasks: Task[];
  birthdays: Birthday[];
  notes: PersonNote[];
  interactions: Interaction[];
  tags: Tag[];
  personTags: { id: string; personId: string; tagId: string }[];
  photos: Photo[];
  skills: Skill[];
  personSkills: PersonSkill[];
  ratings?: { personId: string; criterion: string; score: number; ratedAt?: string }[];
  /** Rulebook phase 4: rules are searched by their title and their reason, nothing else. */
  rules?: Rule[];
  /** Part 3: ledger rows are searched by their title and their note. */
  exchanges?: Exchange[];
};

/** Flat list of documents, one per searchable row. Order matters only for ties, so people come first. */
export function buildIndex(s: Snap): Index {
  const docs: Doc[] = [];
  const nameOf = new Map(s.people.map((p) => [p.id, p.displayName]));

  for (const p of s.people) {
    if (p.archivedAt) continue;
    const fields: string[] = [];
    push(fields, p.displayName);
    push(fields, p.firstName);
    push(fields, p.lastName);
    push(fields, p.nickname);
    push(fields, p.city);
    push(fields, p.occupation);
    push(fields, p.workplace);
    for (const ph of p.phones) pushPhone(fields, ph);
    for (const e of p.emails) push(fields, e);
    // the person's tags are searchable as if they were on the person (section 6 lists tags among the searched fields)
    for (const l of s.personTags.filter((x) => x.personId === p.id)) {
      const t = s.tags.find((x) => x.id === l.tagId);
      if (t) push(fields, t.name);
    }
    // R1's skills (and their aliases) are searchable on the person, as section 6 asks
    for (const ps of s.personSkills.filter((x) => x.personId === p.id)) {
      const sk = s.skills.find((x) => x.id === ps.skillId);
      if (!sk) continue;
      push(fields, sk.name);
      for (const a of sk.aliases) push(fields, a);
      push(fields, ps.evidence);
    }
    docs.push({ kind: 'person', id: p.id, title: p.displayName, fields, rank: p.isSelf ? 1 : 0 });
  }

  for (const n of s.notes) {
    const fields: string[] = [];
    push(fields, n.text);
    docs.push({ kind: 'note', id: n.id, personId: n.personId, title: nameOf.get(n.personId) ?? tx('یادداشت'), fields });
  }

  for (const t of s.tasks) {
    const fields: string[] = [];
    push(fields, t.title);
    push(fields, t.description);
    docs.push({ kind: 'todo', id: t.id, title: t.title, fields });
  }

  for (const i of s.interactions) {
    const fields: string[] = [];
    push(fields, i.summary);
    push(fields, i.outcome);
    docs.push({ kind: 'interaction', id: i.id, personId: i.personId, title: i.summary, fields });
  }

  for (const b of s.birthdays) {
    const fields: string[] = [];
    push(fields, b.name);
    pushPhone(fields, b.phone);
    docs.push({ kind: 'birthday', id: b.id, personId: b.personId, title: b.name, fields });
  }

  // G2: photo titles, notes and tags are searchable (section 6)
  for (const ph of s.photos) {
    const fields: string[] = [];
    push(fields, ph.title);
    push(fields, ph.note);
    for (const id of ph.tagIds) {
      const t = s.tags.find((x) => x.id === id);
      if (t) push(fields, t.name);
    }
    docs.push({ kind: 'photo', id: ph.id, personId: ph.personId, title: ph.title, fields });
  }

  // Rulebook phase 4: the rule's text and the story behind it. Archived rules stay out of search, like archived people.
  for (const r of s.rules ?? []) {
    if (r.archivedAt) continue;
    const fields: string[] = [];
    push(fields, r.title);
    push(fields, r.why);
    docs.push({ kind: 'rule', id: r.id, title: r.title, fields });
  }

  // Part 3: the ledger's titles and notes, so "قرض" finds the exchange even years later
  for (const ex of s.exchanges ?? []) {
    const fields: string[] = [];
    push(fields, ex.title);
    push(fields, ex.note);
    docs.push({ kind: 'exchange', id: ex.id, personId: ex.personId, title: ex.title, fields });
  }

  for (const t of s.tags) {
    const fields: string[] = [];
    push(fields, t.name);
    docs.push({ kind: 'tag', id: t.id, title: t.name, fields });
  }

  return { docs };
}

/** The distinct documents of one kind, in index order. */
export const ofKind = (hits: { doc: Doc; why: string[] }[], kind: Doc['kind']) => hits.filter((h) => h.doc.kind === kind);

/**
 * The plain facts section 6 wants next to a person result: best evidence among their skills, the trustworthiness rating
 * (one criterion), and the latest interaction date. Computed once here so the search screen and the WhoCan screen agree.
 * There is no combined score by design.
 */
export function personFacts(s: Snap) {
  const evidence = new Map<string, string>();
  const rank: Record<string, number> = { verified: 3, seen: 2, claimed: 1, unknown: 0 };
  for (const ps of s.personSkills) {
    const cur = evidence.get(ps.personId);
    if (!cur || (rank[ps.evidenceStatus] ?? 0) > (rank[cur] ?? 0)) evidence.set(ps.personId, ps.evidenceStatus);
  }
  const trust = new Map<string, number>();
  // "current value = latest event per person+criterion" (section 5): the newest rating wins, not the highest, so this
  // agrees with whoCanEngine's ranking. Keeping the highest here would show a number the ranking did not use.
  const newest = new Map<string, { score: number; ratedAt: string }>();
  for (const r of s.ratings ?? []) {
    if (r.criterion !== 'trustworthiness') continue; // one criterion only, never summed (rule 9)
    const at = r.ratedAt ?? '';
    const prev = newest.get(r.personId);
    if (!prev || at >= prev.ratedAt) newest.set(r.personId, { score: r.score, ratedAt: at });
  }
  for (const [personId, v] of newest) trust.set(personId, v.score);
  const last = new Map<string, string>();
  for (const i of s.interactions) {
    const cur = last.get(i.personId);
    if (!cur || i.occurredAt > cur) last.set(i.personId, i.occurredAt);
  }
  return { evidence, trust, last };
}

/** Birthdays carry a "when" that the page shows; computed here so the page does not import date code for it. */
export const bdayIn = (b: Birthday, today: string, off: number) => nextOccurrence(b, today, off)?.inDays ?? null;
