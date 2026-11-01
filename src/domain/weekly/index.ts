import type { Done, Interaction, RuleBreak, RuleReview } from '../../db/types';

export type WeekSummary = {
  from: string;
  to: string;
  /** Distinct people talked to this week, most interactions first. */
  talkedTo: { personId: string; count: number }[];
  interactionCount: number;
  tasksDone: number;
  reviews: number;
  breaks: number;
  /** The rule broken most often this week, if any. */
  topBroken?: { ruleId: string; count: number };
};

const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

/**
 * What happened in the closed day range [from, to]. Interactions dated after `to` are planned meetings, not history, so they
 * are left out. A tick counts by when it was ticked (`doneAt`); old rows without it fall back to the todo's own day.
 */
export function summarizeWeek(
  from: string,
  to: string,
  data: { interactions: Interaction[]; dones: Done[]; reviews: RuleReview[]; breaks: RuleBreak[] },
  dayOfMs: (ms: number) => string,
): WeekSummary {
  const mine = data.interactions.filter((i) => inRange(i.occurredAt, from, to));
  const perPerson = new Map<string, number>();
  for (const i of mine) perPerson.set(i.personId, (perPerson.get(i.personId) ?? 0) + 1);

  const weekBreaks = data.breaks.filter((b) => inRange(b.brokenOn, from, to));
  const perRule = new Map<string, number>();
  for (const b of weekBreaks) perRule.set(b.ruleId, (perRule.get(b.ruleId) ?? 0) + 1);
  const top = [...perRule.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    from,
    to,
    talkedTo: [...perPerson.entries()].map(([personId, count]) => ({ personId, count })).sort((a, b) => b.count - a.count),
    interactionCount: mine.length,
    tasksDone: data.dones.filter((d) => inRange(d.doneAt ? dayOfMs(d.doneAt) : d.date, from, to)).length,
    reviews: data.reviews.filter((r) => inRange(r.reviewedOn, from, to)).length,
    breaks: weekBreaks.length,
    topBroken: top ? { ruleId: top[0], count: top[1] } : undefined,
  };
}
