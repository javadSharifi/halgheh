import type { CompareCheck, CompareItem, Rule } from '../../db';
import type { CheckState } from '../rules/constants';

/**
 * Phase 1 + 5: the pure comparison logic. No UI, no Dexie import, no single merged score anywhere: the numbers are kept
 * side by side (pass / fail / unknown / total) and items are ordered by plain rules, never by a computed index.
 *
 * "Unknown" is a real third state: a missing `compareChecks` row means unknown, and unknown is never counted as a pass
 * and never as a fail. A rule that has no row is not a zero.
 */

export type ItemStats = { pass: number; fail: number; unknown: number; total: number };

/** The state of one rule for one item; a missing row means unknown, which is why this never returns undefined. */
export function stateOf(itemId: string, ruleId: string, checks: CompareCheck[]): CheckState {
  return checks.find((c) => c.itemId === itemId && c.ruleId === ruleId)?.state ?? 'unknown';
}

/**
 * Counts for one item, over the rules the caller passes in (the page passes the category's non-archived rules, which is
 * what makes a rule added later appear as unknown and an archived rule disappear).
 */
export function statsFor(itemId: string, rules: Rule[], checks: CompareCheck[]): ItemStats {
  const mine = new Map(checks.filter((c) => c.itemId === itemId).map((c) => [c.ruleId, c.state]));
  let pass = 0;
  let fail = 0;
  for (const r of rules) {
    const s = mine.get(r.id) ?? 'unknown';
    if (s === 'pass') pass++;
    else if (s === 'fail') fail++;
  }
  return { pass, fail, unknown: rules.length - pass - fail, total: rules.length };
}

/** The strict (deal-breaker) rules this item breaks. The item stays in the list; only the flag says it broke one. */
export function strictFailures(itemId: string, rules: Rule[], checks: CompareCheck[]): Rule[] {
  const mine = new Map(checks.filter((c) => c.itemId === itemId).map((c) => [c.ruleId, c.state]));
  return rules.filter((r) => r.strict && mine.get(r.id) === 'fail');
}

/** The order the item cards and the matrix columns use: most passes, then fewest unknown, then the lower known price. */
export function orderItems(items: CompareItem[], rules: Rule[], checks: CompareCheck[]): CompareItem[] {
  const byId = new Map(items.map((i) => [i.id, statsFor(i.id, rules, checks)]));
  return [...items].sort((a, b) => {
    const sa = byId.get(a.id) as ItemStats;
    const sb = byId.get(b.id) as ItemStats;
    if (sb.pass !== sa.pass) return sb.pass - sa.pass;
    if (sa.unknown !== sb.unknown) return sa.unknown - sb.unknown;
    // a known price sorts before an unknown one; two known prices sort lower first
    const pa = a.price;
    const pb = b.price;
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return 0;
  });
}

/** One rule's two states when two items are put side by side. */
export type Diff = { rule: Rule; a: CheckState; b: CheckState };

/**
 * The differences between two items over the given rules. `onlyDiff` is the screen's switch: when off, every rule is
 * listed (so the user can see agreement too); when on, only rules whose states differ remain.
 */
export function differences(aId: string, bId: string, rules: Rule[], checks: CompareCheck[], onlyDiff = true): Diff[] {
  const rows = rules.map((rule) => ({ rule, a: stateOf(aId, rule.id, checks), b: stateOf(bId, rule.id, checks) }));
  return onlyDiff ? rows.filter((r) => r.a !== r.b) : rows;
}

/** How many of the item's rules are still unchecked: what the "quick check" button offers to finish. */
export const uncheckedCount = (itemId: string, rules: Rule[], checks: CompareCheck[]) => statsFor(itemId, rules, checks).unknown;

/** French-free formatting input: the price as a plain number, or undefined when the user left it empty. */
export function parsePrice(raw: string): number | undefined {
  const digits = raw.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[^\d.]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}
