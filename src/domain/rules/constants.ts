/**
 * Every constant of the Rulebook logic, in one file (spec, phase 1). Pure: no UI, no Dexie, no date side effects.
 */

/** Leitner intervals in days. The index is the box number, so box 0 is due one day after the review. */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;

/** The highest box. A `remembered` on box 6 keeps it at 6 instead of overflowing. */
export const MAX_BOX = INTERVAL_DAYS.length - 1;

/** A new rule starts in box 0 and is due the next day. */
export const NEW_RULE_BOX = 0;

/** One review session never hands out more than this many rules. */
export const MAX_REVIEWS_PER_SESSION = 10;

/** The three answers of a review card. `broke` means "I remembered it but did not follow it". */
export const REVIEW_RESULTS = ['remembered', 'forgot', 'broke'] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

/** The three states a rule can have for one item. A missing row means `unknown`, so this is also the default. */
export const CHECK_STATES = ['pass', 'fail', 'unknown'] as const;
export type CheckState = (typeof CHECK_STATES)[number];

/**
 * What the seed writes on a fresh install (or an upgrade with no categories). The last two compare purchases. The names
 * are here, not in the strings file, because they are content rows written by the data layer; `strings/rulebook.ts`
 * re-exports them for any screen that needs to show them.
 */
export const SEED_CATEGORY_NAMES = ['زندگی', 'ارتباط', 'رابطه', 'پول', 'خرید ماشین', 'خرید موبایل'] as const;
/** Marks the one-time seed, so deleting every category does not bring the defaults back on the next start. */
export const SEEDED_KEY = 'halgheh:rulebook-seeded';

export const SEED_CATEGORIES: { name: string; compareEnabled: boolean }[] = SEED_CATEGORY_NAMES.map((name) => ({
  name,
  compareEnabled: name === 'خرید ماشین' || name === 'خرید موبایل',
}));
