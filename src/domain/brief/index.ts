import type {
  Birthday,
  Exchange,
  ExchangeSettlement,
  Interaction,
  Person,
  PersonNote,
  Rating,
  Rule,
  RuleBreak,
  RuleCheck,
  RuleCheckItem,
} from '../../db';
import { checkCounts, strictBreaking } from '../rules/personCheck';
import { isSettled, moneyBalance } from '../ledger';
import { breaksOfPerson } from '../rules/breaks';
import { locale } from '../../i18n';

/**
 * Part 4 pure logic: what a pre-meeting brief shows. No UI, no Dexie import, no clock — `today` is always passed in.
 *
 * Every section returns `undefined` when it has nothing to show, and the page simply does not render that section. That is
 * how "never an empty section, never fake data" is enforced in one place instead of in the JSX. Nothing here sums the
 * rating criteria or invents a score.
 */

/** The latest few interactions that have already happened, newest first. A future planned meeting is not "latest". */
export function latestInteractions(interactions: Interaction[], today: string, limit = 3) {
  const past = interactions.filter((i) => i.occurredAt <= today).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  if (past.length === 0) return undefined;
  return past.slice(0, limit);
}

/** Interaction follow-ups that are still open (dated today or later), soonest first. */
export function openFollowUps(interactions: Interaction[], today: string) {
  const rows = interactions.filter((i): i is Interaction & { followUpDate: string } => !!i.followUpDate && i.followUpDate >= today);
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}

/** Open todos this person asked for ("کارهایی که گفته"), earliest due first; a dateless one goes last. */
export function openTodos(tasks: { id: string; title: string; on?: string; fromPersonId?: string }[], doneIds: Set<string>, personId: string) {
  const rows = tasks.filter((t) => t.fromPersonId === personId && !doneIds.has(t.id));
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => (a.on ?? '9999-99-99').localeCompare(b.on ?? '9999-99-99') || a.title.localeCompare(b.title, locale()));
}

/** Open exchanges with this person, undated last, and the money balance as three separate numbers. */
export function openExchanges(exchanges: Exchange[], settlements: ExchangeSettlement[], personId: string) {
  const mine = exchanges.filter((e) => e.personId === personId && !isSettled(e, settlements));
  if (mine.length === 0) return undefined;
  return mine.sort((a, b) => (a.dueOn ?? '9999-99-99').localeCompare(b.dueOn ?? '9999-99-99') || b.date.localeCompare(a.date));
}

/** The money side of the brief, or undefined when there is no money at all (items and favours never make one). */
export function briefBalance(exchanges: Exchange[], settlements: ExchangeSettlement[], personId: string) {
  const b = moneyBalance(personId, exchanges, settlements);
  if (b.earn === 0 && b.owe === 0) return undefined;
  return b;
}

/** A birthday within the next `days` days, with how far away it is; undefined when there is none. */
export function upcomingBirthday(birthday: Birthday | undefined, inDays: number | null | undefined, days = 30) {
  if (!birthday || inDays === null || inDays === undefined) return undefined;
  if (inDays < 0 || inDays > days) return undefined;
  return { birthday, inDays };
}

/** The person's notes as one text blob per row; the page decides how many lines to show. */
export function briefNotes(notes: PersonNote[]) {
  const rows = notes.filter((n) => n.text.trim() !== '');
  if (rows.length === 0) return undefined;
  return rows;
}

/** The six criteria side by side, each with its latest value or undefined; never a total. */
export function briefRatings(ratings: Rating[], criteria: readonly Rating['criterion'][]) {
  const latest = new Map<Rating['criterion'], Rating>();
  for (const r of ratings) {
    const cur = latest.get(r.criterion);
    if (!cur || r.ratedAt >= cur.ratedAt) latest.set(r.criterion, r);
  }
  if (latest.size === 0) return undefined;
  return criteria.map((criterion) => ({ criterion, latest: latest.get(criterion) }));
}

/** The most recent check for this person (open or closed), with its counts and any strict rule marked breaking. */
export function lastCheck(check: RuleCheck | undefined, items: RuleCheckItem[], rules: Rule[]) {
  if (!check) return undefined;
  const mine = items.filter((i) => i.checkId === check.id);
  const active = rules.filter((r) => !r.archivedAt);
  return {
    check,
    counts: checkCounts(active, mine),
    strict: strictBreaking(active, mine),
  };
}

/**
 * The rules I broke with this person in the last 90 days, newest first, each with the rule it belongs to and the plan that
 * came out of it. A break with no plan still appears: the fact that it happened is the point.
 */
export function myBreaksWithPerson(breaks: RuleBreak[], rules: Rule[], personId: string, today: string) {
  const from = shiftDays(today, -90);
  const rows = breaksOfPerson(breaks, personId, from).filter((b) => b.brokenOn <= today);
  if (rows.length === 0) return undefined;
  const byId = new Map(rules.map((r) => [r.id, r]));
  return rows
    .sort((a, b) => b.brokenOn.localeCompare(a.brokenOn))
    .map((b) => ({ break: b, rule: byId.get(b.ruleId) }))
    .filter((r): r is { break: RuleBreak; rule: Rule } => !!r.rule);
}

/** True when nothing at all is worth showing, so the page can say so once instead of rendering eight empty headers. */
export function hasAnyData(s: {
  interactions: ReturnType<typeof latestInteractions>;
  todos: ReturnType<typeof openTodos>;
  exchanges: ReturnType<typeof openExchanges>;
  birthday: ReturnType<typeof upcomingBirthday>;
  notes: ReturnType<typeof briefNotes>;
  ratings: ReturnType<typeof briefRatings>;
  check: ReturnType<typeof lastCheck>;
  breaks: ReturnType<typeof myBreaksWithPerson>;
}) {
  return !!(s.interactions || s.todos || s.exchanges || s.birthday || s.notes || s.ratings || s.check || s.breaks);
}

/** A date-only shift that never goes through a timezone, mirroring `addDays` in `cal.ts`. */
const shiftDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** The person's own row is never a "brief" target; kept here so the page cannot forget it. */
export const briefablePerson = (p: Person | undefined) => (p && !p.isSelf ? p : undefined);
