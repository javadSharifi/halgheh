import type { Rule, RuleCheckItem, RuleCategory } from '../../db';
import { locale, tx } from '../../i18n';

/**
 * Part 2 pure logic: the per-person rule check. No UI, no Dexie import.
 *
 * Four states, and only one of them is a problem: `keeping` counts as kept, `breaking` counts as broken, `na` is a real
 * decision the user made ("this rule is not about this"), and a missing row is `unknown`. `unknown` is never counted as
 * breaking and never as kept — the summary shows it as its own number.
 */

export const CHECK_STATES = ['keeping', 'breaking', 'na', 'unknown'] as const;
export type CheckItemState = (typeof CHECK_STATES)[number];

/** The state of one rule in a check; a missing row means unknown, which is why this never returns undefined. */
export function stateOf(items: RuleCheckItem[], ruleId: string): CheckItemState {
  return items.find((i) => i.ruleId === ruleId)?.state ?? 'unknown';
}

/**
 * The summary: how many kept, how many broken, how many decided to be irrelevant, and how many left unchecked. `total` is
 * the number of rules the check was scoped to, so the four counts always add up to it.
 */
export function checkCounts(rules: Rule[], items: RuleCheckItem[]) {
  const mine = new Map(items.map((i) => [i.ruleId, i.state]));
  let keeping = 0;
  let breaking = 0;
  let na = 0;
  let unknown = 0;
  for (const r of rules) {
    const s = mine.get(r.id) ?? 'unknown';
    if (s === 'keeping') keeping++;
    else if (s === 'breaking') breaking++;
    else if (s === 'na') na++;
    else unknown++;
  }
  return { keeping, breaking, na, unknown, total: rules.length };
}

/**
 * The strict ("خط قرمز") rules marked as breaking. These are the deal-breakers the user is about to cross, so they get
 * their own red list instead of being folded into the count.
 */
export function strictBreaking(rules: Rule[], items: RuleCheckItem[]) {
  const mine = new Map(items.map((i) => [i.ruleId, i.state]));
  return rules.filter((r) => r.strict && mine.get(r.id) === 'breaking');
}

/** A rule inside its category, for the grouped list. The category travels with the rule so the page renders no lookups. */
export type GroupedRule = { category: RuleCategory | undefined; rules: Rule[] };

/**
 * Rules grouped by category, in the user's own category order, with the rules of each group in title order. A rule whose
 * category is missing (deleted on another device) still appears, under an undefined category the page labels plainly.
 */
export function groupByCategory(rules: Rule[], categories: RuleCategory[]): GroupedRule[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, Rule[]>();
  for (const r of rules) {
    const list = groups.get(r.categoryId) ?? [];
    list.push(r);
    groups.set(r.categoryId, list);
  }
  return [...groups.entries()]
    .map(([categoryId, list]) => ({
      category: byId.get(categoryId),
      rules: [...list].sort((a, b) => a.title.localeCompare(b.title, locale())),
      order: byId.get(categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.order - b.order || (a.category?.name ?? '').localeCompare(b.category?.name ?? '', locale()))
    .map(({ category, rules: list }) => ({ category, rules: list }));
}

/** Every non-archived rule, which is what a new check starts from. */
export const checkableRules = (rules: Rule[]) => rules.filter((r) => !r.archivedAt);

/**
 * Filters for the check page: the category chip and the search box. `query` is matched against the normalized title and
 * reason by the caller, so this only narrows by category.
 */
export const rulesInCategory = (rules: Rule[], categoryId: string | null) => (categoryId ? rules.filter((r) => r.categoryId === categoryId) : rules);

/**
 * The "فقط قوانین انتخاب‌شده" switch. A rule counts as chosen when the user gave it any state other than unknown, because
 * that is exactly the set the summary counts. Unchosen rules stay hidden while the switch is on, so the list is only the
 * subset the user actually decided to judge.
 */
export const chosenRules = (rules: Rule[], items: RuleCheckItem[]) => {
  const decided = new Set(items.filter((i) => i.state !== 'unknown').map((i) => i.ruleId));
  return rules.filter((r) => decided.has(r.id));
};

/** A plain one-line summary of a closed check, e.g. "۳ رعایت · ۱ می‌شکنم · ۲ بررسی‌نشده". */
export const summaryLine = (counts: ReturnType<typeof checkCounts>, fa: (n: number) => string) =>
  tx('{a1} رعایت · {a2} می‌شکنم · {a3} بررسی‌نشده', { a1: fa(counts.keeping), a2: fa(counts.breaking), a3: fa(counts.unknown) });
