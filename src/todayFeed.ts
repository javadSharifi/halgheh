import type { Birthday, Interaction, Person } from './db';
import { addDays, bdayOn, fa, today } from './cal';
import { locale, tx } from './i18n';

/**
 * Pure pieces of the Today dashboard (T3), with no UI and no Dexie import, so they can be tested later without a browser.
 */

export type Upcoming = { b: Birthday; date: string; inDays: number };

/** Birthdays in the next `days` days, today first; several on one day are ordered by name. */
export function birthdaysWithin(bdays: Birthday[], days: number, from = today(), off = 0): Upcoming[] {
  const out: Upcoming[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const onDay = bdays.filter((x) => bdayOn(x, date, off)).sort((a, b) => a.name.localeCompare(b.name, locale()));
    for (const b of onDay) out.push({ b, date, inDays: i });
  }
  return out;
}

/** Interactions whose follow-up date has arrived or passed, most overdue first. */
export function followUpsDue(interactions: Interaction[], from = today()) {
  return interactions
    .filter((i): i is Interaction & { followUpDate: string } => !!i.followUpDate && i.followUpDate <= from)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}

/** The most recently added people, newest first; archived people and the "me" row are left out. */
export function recentPeople(people: Person[], limit = 6) {
  return people
    .filter((p) => !p.isSelf && !p.archivedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/** "۳ روز پیش" / "امروز" for a follow-up date that is today or earlier. */
export function followUpLabel(date: string, from = today()) {
  const diff = Math.round((Date.parse(`${from}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  if (diff <= 0) return tx('امروز');
  if (diff === 1) return tx('دیروز');
  return tx('{a1} روز پیش', { a1: fa(diff) });
}
