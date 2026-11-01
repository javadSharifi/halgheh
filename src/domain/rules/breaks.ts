import type { RuleBreak } from '../../db';
import { addDays } from '../../cal';
import { locale } from '../../i18n';

/**
 * Part 1 pure logic: the broken-rule log. No UI, no Dexie import, no clock — every function takes the day it should use,
 * so the same row set always produces the same numbers.
 *
 * The `ruleBreaks` table is the single source of truth for how often a rule was broken. `rules.brokenCount` is a cache of
 * `breaksOf(ruleId).length` (see `ruleData.ts`); nothing else is allowed to add to it.
 */

/** Periods the rule detail shows side by side. `all` is spelled out rather than left as "everything else". */
export const BREAK_PERIODS = [30, 90] as const;
export type BreakPeriod = (typeof BREAK_PERIODS)[number];

/** The breaks of one rule, newest first. Ties (two breaks on one day) fall back to `updatedAt`. */
export const breaksOf = (breaks: RuleBreak[], ruleId: string) =>
  breaks.filter((b) => b.ruleId === ruleId).sort((a, b) => b.brokenOn.localeCompare(a.brokenOn) || b.updatedAt - a.updatedAt);

/** The breaks involving one person (only breaks the user actually linked to them). */
export const breaksOfPerson = (breaks: RuleBreak[], personId: string, since?: string) =>
  breaks.filter((b) => b.personId === personId && (!since || b.brokenOn >= since));

/**
 * True when `day` falls in the last `days` days, counting today as one of them. The window is exactly `days` calendar days
 * — `(today - days, today]` — so "last 30 days" means 30 days, not 31. Date-only, so no timezone is involved.
 */
export const withinDays = (day: string, days: number, today: string) => day > addDays(today, -days) && day <= today;

/**
 * How many times a rule was broken in the last `days` days. A break dated in the future (a mistyped date) is not counted,
 * because "how often lately" must not include something that has not happened.
 */
export const countInDays = (breaks: RuleBreak[], days: number, today: string) => breaks.filter((b) => withinDays(b.brokenOn, days, today)).length;

/**
 * The counts the rule detail shows: last 30 days, last 90 days and all time. All three are separate numbers; nothing is
 * averaged or merged into a single score.
 */
export function breakCounts(breaks: RuleBreak[], ruleId: string, today: string) {
  const mine = breaksOf(breaks, ruleId);
  return {
    d30: countInDays(mine, 30, today),
    d90: countInDays(mine, 90, today),
    all: mine.length,
    /** The newest break, for a one-line summary; undefined when the rule was never broken. */
    latest: mine[0],
  };
}

/**
 * The latest non-empty "what I will do next time" for a rule. The review card hides this behind the reason tap, and the
 * brief shows it next to a break, so both read it from here. An empty or whitespace-only plan is not a plan.
 */
export function latestPlan(breaks: RuleBreak[], ruleId: string): string | undefined {
  return breaksOf(breaks, ruleId).find((b) => !!b.nextTimePlan?.trim())?.nextTimePlan?.trim();
}

/** The latest plan that was written after a specific break, used by the brief to explain a break in context. */
export const planOf = (b: RuleBreak) => b.nextTimePlan?.trim() || undefined;

/**
 * Ordering for the "most broken" filter. Most breaks first, then the most recent break, then the title, so the list is
 * stable when two rules have the same count.
 */
export function orderByBreaks<T extends { id: string; title: string }>(rules: T[], breaks: RuleBreak[]) {
  const byRule = new Map<string, { count: number; latest?: string }>();
  for (const b of breaks) {
    const prev = byRule.get(b.ruleId);
    const count = (prev?.count ?? 0) + 1;
    const latest = !prev?.latest || b.brokenOn > prev.latest ? b.brokenOn : prev.latest;
    byRule.set(b.ruleId, { count, latest });
  }
  // a rule with no break at all has no entry, and is never treated as a zero that ranks above a real one
  return [...rules].sort((a, b) => {
    const ra = byRule.get(a.id);
    const rb = byRule.get(b.id);
    if ((rb?.count ?? 0) !== (ra?.count ?? 0)) return (rb?.count ?? 0) - (ra?.count ?? 0);
    if ((rb?.latest ?? '') !== (ra?.latest ?? '')) return (rb?.latest ?? '').localeCompare(ra?.latest ?? '');
    return a.title.localeCompare(b.title, locale());
  });
}

/** A break whose text fields are all empty is still a break: it records that it happened, and the user can fill it later. */
export const isEmptyBreak = (b: Pick<RuleBreak, 'whatHappened' | 'whyBroke' | 'nextTimePlan'>) =>
  !b.whatHappened?.trim() && !b.whyBroke?.trim() && !b.nextTimePlan?.trim();
