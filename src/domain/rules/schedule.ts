import type { Rule, RuleReview } from '../../db';
import { addDays } from '../../cal';
import { INTERVAL_DAYS, MAX_BOX, MAX_REVIEWS_PER_SESSION, NEW_RULE_BOX, type ReviewResult } from './constants';

/**
 * Phase 1: the Leitner schedule of a rule, as pure functions (no UI, no Dexie, no timezone conversion).
 * Box `b` means "review again after INTERVAL_DAYS[b] days", so box 0 is due the next day. Every date here is a
 * `YYYY-MM-DD` string and is moved with `addDays`, which works in UTC and never shifts a day across a timezone.
 */

/** The interval of a box, clamped so a corrupted box number cannot produce `undefined` days. */
export const boxInterval = (box: number) => INTERVAL_DAYS[Math.min(Math.max(Math.trunc(box), 0), MAX_BOX)];

/** A brand-new rule: box 0, due the next day, never reviewed. `brokenCount` is not touched here (see `applyReview`). */
export function newRuleSchedule(from: string) {
  return { box: NEW_RULE_BOX, nextReviewOn: addDays(from, boxInterval(NEW_RULE_BOX)), reviewCount: 0 };
}

/**
 * What one review does to a rule. `remembered` moves up a box (and stops at the top); `forgot` goes back to box 0;
 * `broke` is "I remembered it but did not follow it", so it also drops to box 0.
 *
 * **`brokenCount` is deliberately not part of this.** It used to be incremented here, which made the same break count
 * twice as soon as a break could also be recorded outside a review (Part 1). It is now derived from `ruleBreaks` alone and
 * written by `createBreak`/`deleteBreak` in `ruleData.ts`; a review only moves the schedule.
 *
 * `nextReviewOn` is always the review day plus the interval of the **new** box, which is what makes history replayable.
 * The review instant itself (`lastReviewedAt`) is not part of this: the caller stamps `new Date().toISOString()` when it
 * writes the review row, so the derived state depends only on the review's day.
 */
export function applyReview(
  rule: Pick<Rule, 'box' | 'reviewCount'>,
  result: ReviewResult,
  reviewedOn: string,
): { box: number; nextReviewOn: string; reviewCount: number } {
  const box = result === 'remembered' ? Math.min(rule.box + 1, MAX_BOX) : NEW_RULE_BOX;
  return {
    box,
    nextReviewOn: addDays(reviewedOn, boxInterval(box)),
    reviewCount: (rule.reviewCount || 0) + 1,
  };
}

/** Due when the review day has arrived or passed. A date-only comparison, so no clock and no timezone is involved. */
export const isDue = (rule: Pick<Rule, 'nextReviewOn' | 'archivedAt'>, today: string) => !rule.archivedAt && rule.nextReviewOn <= today;

/** How many days late a rule is; 0 means due today, a negative number means it is not due yet. */
export const daysLate = (rule: Pick<Rule, 'nextReviewOn'>, today: string) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${rule.nextReviewOn}T00:00:00Z`)) / 86_400_000);

/**
 * The rules one session offers: archived rules never appear, due ones only, most overdue first, at most
 * `MAX_REVIEWS_PER_SESSION`. Rules due on the same day keep a stable order by title so the list does not shuffle.
 */
export function dueRules(rules: Rule[], today: string, cap = MAX_REVIEWS_PER_SESSION): Rule[] {
  return rules
    .filter((r) => isDue(r, today))
    .sort((a, b) => a.nextReviewOn.localeCompare(b.nextReviewOn) || a.title.localeCompare(b.title, 'fa'))
    .slice(0, cap);
}

/** Count of rules that are due today or earlier, ignoring the session cap. */
export const dueCount = (rules: Rule[], today: string) => rules.filter((r) => isDue(r, today)).length;

/**
 * Rebuilds a rule's box and due date from its review history alone. The schedule is derived, never authoritative:
 * this is the function that proves the history is enough (the row's own fields are just a cache of this result).
 */
export function replaySchedule(reviews: RuleReview[], from: string) {
  const ordered = [...reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  return ordered.reduce(
    (state, r) => {
      const next = applyReview(state, r.result, r.reviewedOn);
      return { box: next.box, nextReviewOn: next.nextReviewOn, reviewCount: next.reviewCount };
    },
    { ...newRuleSchedule(from), reviewCount: 0 },
  );
}

