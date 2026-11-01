import type { Interaction, Person } from '../../db/types';

const DAY_MS = 86_400_000;

/** Whole days between two `YYYY-MM-DD` days, later minus earlier. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** The day of the latest interaction with this person, or undefined when there never was one. */
export function lastSeen(personId: string, interactions: Interaction[]): string | undefined {
  let best: string | undefined;
  for (const i of interactions) if (i.personId === personId && (!best || i.occurredAt > best)) best = i.occurredAt;
  return best;
}

/** Days since the last interaction; a person never contacted counts from the day they were added. */
export const daysSinceContact = (person: Person, interactions: Interaction[], day: string, nowMs: number) => {
  const seen = lastSeen(person.id, interactions);
  return seen ? daysBetween(seen, day) : Math.floor((nowMs - person.createdAt) / DAY_MS);
};

export type Overdue = { person: Person; days: number };

export const SNOOZE_DAYS = 7;

/** Snoozes the ring for a week, on the row so it survives a reload and syncs. */
export const withSnooze = (person: Person, nowMs: number): Person => ({
  ...person,
  dueSnoozeUntil: nowMs + SNOOZE_DAYS * DAY_MS,
  updatedAt: nowMs,
});

/** People whose ring is overdue, longest silence first; a snoozed person is left out until the snooze passes. */
export function overdueContacts(people: Person[], interactions: Interaction[], day: string, nowMs: number): Overdue[] {
  const out: Overdue[] = [];
  for (const person of people) {
    if (!person.cadenceDays || person.isSelf || person.archivedAt) continue;
    if ((person.dueSnoozeUntil ?? 0) > nowMs) continue;
    const days = daysSinceContact(person, interactions, day, nowMs);
    if (days > person.cadenceDays) out.push({ person, days });
  }
  return out.sort((a, b) => b.days - a.days);
}
