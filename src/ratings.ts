import { fa } from './cal';
import { tx, tk } from './i18n';
import { RATING_CRITERIA, type Rating, type RatingCriterion } from './db';

/**
 * R2 pure logic. The six criteria are separate forever: nothing in this module sums, averages or ranks them into one
 * number. Each function returns either one criterion's history or a per-criterion view, never a total (section 4 rule 9).
 */

export { RATING_CRITERIA };

/** Persian labels for the six fixed criteria (section 5). Not settings, not user-editable in the MVP. */
export const CRITERION_LABEL: Record<RatingCriterion, string> = {
  trustworthiness: tk('قابل‌اعتماد بودن'),
  punctuality: tk('وقت‌شناسی'),
  manner: tk('رفتار'),
  responsibility: tk('مسئولیت‌پذیری'),
  negotiation: tk('مذاکره'),
  responsiveness: tk('پاسخ‌دهی'),
};

/** One-line hint per criterion, so the user knows what they are scoring. */
export const CRITERION_HINT: Record<RatingCriterion, string> = {
  trustworthiness: tk('حرف و قرارش را نگه می‌دارد؟'),
  punctuality: tk('سر وقت می‌آید و کار را می‌رساند؟'),
  manner: tk('برخوردش چطور است؟'),
  responsibility: tk('کار را تا آخر می‌برد؟'),
  negotiation: tk('در چانه‌زنی و توافق چطور است؟'),
  responsiveness: tk('چقدر جواب می‌دهد و در دسترس است؟'),
};

export const SCORES = [1, 2, 3, 4, 5] as const;
export const isScore = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

/** Newest first: the current value of a criterion is simply the first row. */
const byNewest = (a: Rating, b: Rating) =>
  b.ratedAt.localeCompare(a.ratedAt) || b.updatedAt - a.updatedAt;

/** One criterion's events, newest first. */
export const historyOf = (ratings: Rating[], criterion: RatingCriterion) =>
  ratings.filter((r) => r.criterion === criterion).sort(byNewest);

/** The current value of one criterion, or undefined when it was never rated ("ثبت نشده", never zero). */
export const currentOf = (ratings: Rating[], criterion: RatingCriterion): Rating | undefined =>
  historyOf(ratings, criterion)[0];

/**
 * All six criteria side by side. The entry is the latest event per criterion, or undefined for a criterion the user has
 * not rated yet. Deliberately a list of six independent values: no total, no average.
 */
export function currentRatings(ratings: Rating[]) {
  return RATING_CRITERIA.map((criterion) => ({ criterion, latest: currentOf(ratings, criterion) }));
}

/** The rows the profile shows for history: every event, newest first, across criteria. */
export const allHistory = (ratings: Rating[]) => [...ratings].sort(byNewest);

/** A new event's row. Ratings are append-only, so this never reuses an id of an existing row. */
export function newRating(input: { personId: string; criterion: RatingCriterion; score: number; note?: string; ratedAt: string }, id: string): Rating {
  const row: Rating = {
    id,
    personId: input.personId,
    criterion: input.criterion,
    score: input.score,
    ratedAt: input.ratedAt,
    updatedAt: Date.now(),
  };
  const note = input.note?.replace(/\s+/g, ' ').trim();
  if (note) row.note = note;
  return row;
}

/** Score as stars for display: "۴ از ۵". */
export const scoreText = (score: number) => tx('{a1} از ۵', { a1: fa(score) });
