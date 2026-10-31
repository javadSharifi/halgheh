import type { Interaction, Person, PersonSkill, Rating, Relationship, Skill, Tag, PersonTag, PersonNote } from './db';
import { normalize } from './search';
import { queryWords } from './domain/search';
import { STATUS_RANK, type EvidenceStatus } from './skills';
import { findPaths, pathText, type Path } from './relationships';

/**
 * R4: "who do I know who can do X?" — section 6 of TASKS.md, deterministic, no AI and no single numeric score.
 *
 * Order, exactly as section 6 states it:
 *   1. people with a matching skill (specialists) before people matched only through other fields;
 *   2. within a group: evidence status (verified > seen > claimed > none), then the user's **trustworthiness** rating
 *      (unrated people are not penalised and sort after rated people of the same evidence level), then the most recent
 *      interaction.
 * Introducers are produced separately and never mixed into the specialist list.
 */

export type Why = {
  /** Which skill matched, when the match was a skill (this is what makes someone a specialist). */
  skills: string[];
  /** Human names of the fields that matched, for the "why" chips. */
  fields: string[];
  evidence?: EvidenceStatus; // best evidence among the matched skills
  /** The single trustworthiness criterion. Never combined with the other five (section 4 rule 9). */
  trust?: number;
  lastContact?: string; // YYYY-MM-DD of the latest interaction
};

export type Hit = { person: Person; why: Why; isSpecialist: boolean };

export type Suggestion = {
  person: Person; // the introducer: the first hop
  specialist: Person;
  path: Path;
  pathText: string; // full path, e.g. "من ← رضا ← علی"
  pathWithTrades: string; // same, with each person's occupation in brackets when known
  uncertain: boolean;
  linkTypes: string[]; // the type of each hop, for the small print (R3's data, not new data)
};

export type Input = {
  people: Person[];
  skills: Skill[];
  personSkills: PersonSkill[];
  ratings: Rating[];
  interactions: Interaction[];
  tags: Tag[];
  personTags: PersonTag[];
  notes: PersonNote[];
};

const FIELD_LABEL = {
  name: 'نام',
  nickname: 'نام مستعار',
  occupation: 'شغل',
  workplace: 'محل کار',
  city: 'شهر',
  skill: 'مهارت',
  tag: 'برچسب',
  phone: 'تلفن',
  email: 'ایمیل',
  note: 'یادداشت',
  interaction: 'تعامل',
} as const;

/** Trust is one criterion only; this constant makes that explicit and searchable. */
const TRUST_CRITERION = 'trustworthiness' as const;

/** The latest value of a criterion ("current value = latest event per person+criterion"). */
function latestRating(ratings: Rating[], personId: string, criterion: string) {
  const rows = ratings.filter((r) => r.personId === personId && r.criterion === criterion);
  if (!rows.length) return undefined;
  return rows.sort((a, b) => b.ratedAt.localeCompare(a.ratedAt) || b.updatedAt - a.updatedAt)[0];
}

/** "verified" is stronger than "seen", which is stronger than "claimed"; a person with no skill is 'none'. */
function bestEvidence(rows: PersonSkill[]): EvidenceStatus | undefined {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => STATUS_RANK[b.evidenceStatus] - STATUS_RANK[a.evidenceStatus])[0].evidenceStatus;
}

function latestInteraction(rows: Interaction[]) {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0].occurredAt;
}

/**
 * Does `word` match this person, and through what? Returns null when the word matches nothing, which drops the person:
 * every word of the query must match (section 6).
 */
function matchWord(
  word: string,
  person: Person,
  personTags: Tag[],
  notes: PersonNote[],
  interactions: Interaction[],
  skills: { row: PersonSkill; skill: Skill }[],
) {
  const has = (v: string | undefined) => !!v && normalize(v).n.includes(word);
  // skills first: a skill match is what makes someone a specialist, so it must not be shadowed by a weaker field
  const hitSkills = skills.filter(({ skill }) => has(skill.name) || skill.aliases.some(has));
  if (hitSkills.length) return { kind: 'skill' as const, labels: [FIELD_LABEL.skill], skills: hitSkills };
  if (has(person.displayName) || has(person.firstName) || has(person.lastName)) return { kind: 'other' as const, labels: [FIELD_LABEL.name], skills: [] };
  if (has(person.nickname)) return { kind: 'other' as const, labels: [FIELD_LABEL.nickname], skills: [] };
  if (has(person.occupation)) return { kind: 'other' as const, labels: [FIELD_LABEL.occupation], skills: [] };
  if (has(person.workplace)) return { kind: 'other' as const, labels: [FIELD_LABEL.workplace], skills: [] };
  if (has(person.city)) return { kind: 'other' as const, labels: [FIELD_LABEL.city], skills: [] };
  if (person.phones.some(has)) return { kind: 'other' as const, labels: [FIELD_LABEL.phone], skills: [] };
  if (person.emails.some(has)) return { kind: 'other' as const, labels: [FIELD_LABEL.email], skills: [] };
  if (personTags.some((t) => has(t.name))) return { kind: 'other' as const, labels: [FIELD_LABEL.tag], skills: [] };
  if (notes.some((n) => has(n.text))) return { kind: 'other' as const, labels: [FIELD_LABEL.note], skills: [] };
  if (interactions.some((i) => has(i.summary) || has(i.outcome))) return { kind: 'other' as const, labels: [FIELD_LABEL.interaction], skills: [] };
  return null;
}

/** Ranked people for a query, specialists first, each with the plain facts section 6 wants shown. */
export function whoCan(q: string, data: Input): Hit[] {
  const words = queryWords(q);
  if (!words.length) return [];
  const byId = new Map(data.people.map((p) => [p.id, p]));

  const hits: Hit[] = [];
  for (const person of data.people) {
    if (person.isSelf || person.archivedAt) continue;
    const ownSkills = data.personSkills
      .filter((r) => r.personId === person.id)
      .map((row) => ({ row, skill: data.skills.find((s) => s.id === row.skillId) }))
      .filter((x): x is { row: PersonSkill; skill: Skill } => !!x.skill);
    const tags = data.personTags
      .filter((l) => l.personId === person.id)
      .map((l) => data.tags.find((t) => t.id === l.tagId))
      .filter((t): t is Tag => !!t);
    const notes = data.notes.filter((n) => n.personId === person.id);
    const interactions = data.interactions.filter((i) => i.personId === person.id);

    const labels = new Set<string>();
    const matchedSkills: { row: PersonSkill; skill: Skill }[] = [];
    let ok = true;
    for (const word of words) {
      const m = matchWord(word, person, tags, notes, interactions, ownSkills);
      if (!m) {
        ok = false;
        break;
      }
      m.labels.forEach((l) => labels.add(l));
      for (const s of m.skills) if (!matchedSkills.some((x) => x.row.id === s.row.id)) matchedSkills.push(s);
    }
    if (!ok) continue;

    const trustRow = latestRating(data.ratings, person.id, TRUST_CRITERION);
    hits.push({
      person,
      isSpecialist: matchedSkills.length > 0,
      why: {
        skills: matchedSkills.map((s) => s.skill.name),
        fields: [...labels],
        evidence: bestEvidence(matchedSkills.map((s) => s.row)),
        trust: trustRow?.score,
        lastContact: latestInteraction(interactions),
      },
    });
  }

  return hits.sort(compareHits);
}

/**
 * Section 6's order. Written as one comparator so every caller agrees, and so the "unrated is not a zero" rule lives in
 * exactly one place: rated people come first by score, then unrated ones, never interleaved as if a missing rating were 0.
 */
export function compareHits(a: Hit, b: Hit) {
  if (a.isSpecialist !== b.isSpecialist) return a.isSpecialist ? -1 : 1;
  const ea = a.why.evidence ? STATUS_RANK[a.why.evidence] : -1;
  const eb = b.why.evidence ? STATUS_RANK[b.why.evidence] : -1;
  if (ea !== eb) return eb - ea;
  const ta = a.why.trust;
  const tb = b.why.trust;
  if (ta !== undefined && tb !== undefined && ta !== tb) return tb - ta;
  if (ta !== undefined && tb === undefined) return -1; // rated first
  if (ta === undefined && tb !== undefined) return 1; // unrated after, but not penalised to 0
  const la = a.why.lastContact ?? '';
  const lb = b.why.lastContact ?? '';
  if (la !== lb) return lb.localeCompare(la); // most recent interaction first
  return a.person.displayName.localeCompare(b.person.displayName, 'fa');
}

/**
 * People who could introduce the user to a specialist: every specialist not directly known is reached with a path of two
 * or more hops. Section 6 puts these in their own section and asks for the full path with `maybe` links marked.
 */
export function introducers(hits: Hit[], data: Input, links: Relationship[], maxDepth = 3): Suggestion[] {
  const self = data.people.find((p) => p.isSelf);
  if (!self) return [];
  const names = new Map(data.people.map((p) => [p.id, p.displayName]));
  const byId = new Map(data.people.map((p) => [p.id, p]));
  // "علی (مکانیک)" as section 6 asks for the path display
  const withTrade = (id: string) => {
    const p = byId.get(id);
    const name = p?.displayName ?? '؟';
    return p?.occupation ? `${name} (${p.occupation})` : name;
  };
  const out: Suggestion[] = [];
  for (const hit of hits.filter((h) => h.isSpecialist)) {
    const paths = findPaths(links, self.id, hit.person.id, names, maxDepth);
    const best = paths[0]; // findPaths already sorts shortest, then closeness, then name
    if (!best || best.people.length <= 2) continue; // directly known: already in the specialist list
    out.push({
      person: byId.get(best.people[1]) ?? hit.person,
      specialist: hit.person,
      path: best,
      pathText: pathText(best, names),
      pathWithTrades: best.people.map(withTrade).join(' ← '),
      uncertain: best.uncertain,
      linkTypes: best.links.map((l) => l.type),
    });
  }
  const seen = new Set<string>();
  return out
    .filter((s) => (seen.has(s.pathText) ? false : (seen.add(s.pathText), true)))
    .sort((a, b) => a.path.people.length - b.path.people.length || a.pathText.localeCompare(b.pathText, 'fa'));
}

/** Re-exported so the page does not need to import from two domain modules. */
export { TRUST_CRITERION };
export type { Path };
