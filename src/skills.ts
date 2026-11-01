import type { PersonSkill, Skill } from './db';
import { fa, today } from './cal';
import { normalize } from './search';
import { locale, tx, tk } from './i18n';

/**
 * R1 pure logic: the shared skill vocabulary and the evidence attached to one person's skill. No UI, no Dexie import.
 * The staleness window is a constant on purpose ("easy to change", R1).
 */
export const STALE_MONTHS = 12;

export const EVIDENCE_STATUS = [
  ['verified', tk('تأییدشده')],
  ['seen', tk('دیدم')],
  ['claimed', tk('ادعا')],
  ['unknown', tk('نامشخص')],
] as const;

export type EvidenceStatus = PersonSkill['evidenceStatus'];

export const STATUS_LABEL = Object.fromEntries(EVIDENCE_STATUS) as Record<EvidenceStatus, string>;
/** Ordering for lists: the strongest evidence first (section 6 ranking uses the same order). */
export const STATUS_RANK: Record<EvidenceStatus, number> = { verified: 3, seen: 2, claimed: 1, unknown: 0 };

/** `YYYY-MM-DD` minus `months` months, clamped to the end of the shorter month. */
export function monthsAgo(months: number, from = today()) {
  const d = new Date(`${from}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.toISOString().slice(0, 10);
}

/**
 * A skill with no verification date is stale: it has never been confirmed, so it cannot be fresh. A skill verified
 * before the window is stale. Anything else is current.
 */
export function isStale(s: Pick<PersonSkill, 'lastVerifiedAt'>, from = today()) {
  if (!s.lastVerifiedAt) return true;
  return s.lastVerifiedAt < monthsAgo(STALE_MONTHS, from);
}

/** Human text for the stale badge. */
export const staleText = (from = today()) => tx('بیش از {a1} ماه است تأیید نشده', { a1: fa(STALE_MONTHS) });

/**
 * Keys used to match a typed name against the vocabulary. `normalize` drops ZWNJ and collapses nothing, so
 * "برنامه‌نویسی" and "برنامه نویسی" would differ; removing every space makes them the same key. That is what a person
 * typing a skill expects, and it keeps the vocabulary free of near-duplicates.
 */
export const skillKey = (name: string) => normalize(name).n.replace(/\s+/g, '');

/**
 * The skill that already means `name`: a match on the name or on any alias. Used so typing "برنامه‌نویسی" twice, or an
 * alias of an existing skill, links to the one row instead of growing the vocabulary with near-duplicates.
 */
export function findSkill(skills: Skill[], name: string): Skill | undefined {
  const k = skillKey(name);
  if (!k) return undefined;
  return skills.find((s) => skillKey(s.name) === k || s.aliases.some((a) => skillKey(a) === k));
}

/** The vocabulary ordered for a picker: parents with their children directly under them. */
export function skillTree(skills: Skill[]) {
  const byName = (a: Skill, b: Skill) => a.name.localeCompare(b.name, locale());
  const roots = skills.filter((s) => !s.parentId || !skills.some((p) => p.id === s.parentId)).sort(byName);
  return roots.flatMap((r) => [r, ...skills.filter((s) => s.parentId === r.id).sort(byName)]);
}

/** Autocomplete for the skill field: name/alias prefix or substring, best (earliest) match first. */
export function suggestSkills(skills: Skill[], q: string, limit = 6): Skill[] {
  const k = skillKey(q);
  if (!k) return skillTree(skills).slice(0, limit);
  return skills
    .map((s) => {
      const name = skillKey(s.name);
      const alias = s.aliases.map(skillKey).find((a) => a.includes(k)) ?? '';
      if (!name.includes(k) && !alias) return null;
      return { s, score: name === k ? 0 : name.startsWith(k) ? 1 : name.includes(k) ? 2 : 3 };
    })
    .filter((x): x is { s: Skill; score: number } => !!x)
    .sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name, locale()))
    .slice(0, limit)
    .map((x) => x.s);
}

/** One person's skills, strongest evidence first, then name, then the most recently verified. */
export function orderPersonSkills(rows: PersonSkill[], skills: Skill[]) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  return [...rows].sort((a, b) => {
    const d = STATUS_RANK[b.evidenceStatus] - STATUS_RANK[a.evidenceStatus];
    if (d) return d;
    const an = byId.get(a.skillId)?.name ?? '';
    const bn = byId.get(b.skillId)?.name ?? '';
    return an.localeCompare(bn, locale()) || (b.lastVerifiedAt ?? '').localeCompare(a.lastVerifiedAt ?? '');
  });
}

/** Parse and check the numeric fields the form collects as text, so the form and the model agree. */
export function readSkillNumbers(level: string, years: string) {
  const lv = level.trim() === '' ? undefined : Number(level);
  const yr = years.trim() === '' ? undefined : Number(years);
  const levelOk = lv === undefined || (Number.isInteger(lv) && lv >= 1 && lv <= 5);
  const yearsOk = yr === undefined || (Number.isInteger(yr) && yr >= 0 && yr <= 70);
  return { level: lv, years: yr, levelOk, yearsOk, valid: levelOk && yearsOk };
}
