import {
  type CompareCheck,
  type CompareItem,
  type CompareSession,
  type Rule,
  type RuleBreak,
  type RuleCategory,
  type RuleCheck,
  type RuleCheckItem,
  type RuleReview,
  db,
  del,
  put,
  uid,
} from './db';
import { fa, today } from './cal';
import { locale, tx } from './i18n';
import { applyReview, newRuleSchedule } from './domain/rules/schedule';
import { MAX_BOX } from './domain/rules/constants';

/**
 * Every read/write of the rulebook that is not pure logic. Writes go through `put`/`del` only, so sync and the backup
 * both see them (TASKS.md rule 3). No UI imports, so the screens stay thin and this stays testable later.
 */

// ---- ordering and labels ----

/** Categories in the user's own order; the order is stored as `sortOrder`, never as an array position. */
export const orderCategories = (cats: RuleCategory[]) => [...cats].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, locale()));

/** A category's next free order number, so a new one lands at the end. */
export const nextOrder = (cats: RuleCategory[]) => (cats.length ? Math.max(...cats.map((c) => c.sortOrder)) + 1 : 0);

/** Active rules, pinned first, then the ones that need attention soonest. Rules with no pin follow in due order. */
export function orderRules(rules: Rule[]) {
  return [...rules].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.nextReviewOn.localeCompare(b.nextReviewOn) || a.title.localeCompare(b.title, locale()),
  );
}

/** "برای مرور", "فردا", "۳ روز دیگر", "۲ روز دیر". A date-only difference, so no clock is involved. */
export function dueLabel(nextReviewOn: string, t = today()) {
  const diff = Math.round((Date.parse(`${nextReviewOn}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 86_400_000);
  if (diff < 0) return tx('{a1} روز دیر', { a1: fa(-diff) });
  if (diff === 0) return tx('امروز');
  if (diff === 1) return tx('فردا');
  return tx('{a1} روز دیگر', { a1: fa(diff) });
}

/** A rule's place in the Leitner scale, 1-based for humans: box 0 is "جعبهٔ ۱". */
export const boxLabel = (box: number) => tx('جعبهٔ {a1}', { a1: fa(Math.min(Math.max(box, 0), MAX_BOX) + 1) });

/** The rule's own history, newest first (the screens show the latest few). */
export const reviewsOf = async (ruleId: string) => (await db.ruleReviews.where('ruleId').equals(ruleId).toArray()).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));

// ---- rules ----

/** A brand-new rule: box 0, due tomorrow, nothing reviewed yet, and never broken. `brokenCount` starts at 0 and only a
 * `ruleBreaks` row may change it afterwards (see `createBreak`/`deleteBreak`). */
export function newRule(categoryId: string, title: string): Rule {
  const now = Date.now();
  return {
    id: uid(),
    categoryId,
    title: title.replace(/\s+/g, ' ').trim(),
    ...newRuleSchedule(today()),
    brokenCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function addRule(categoryId: string, title: string) {
  const row = newRule(categoryId, title);
  await put('rules', row);
  return row;
}

/** Saves the editable fields. The schedule fields are never touched here: only a review moves a rule's box. */
export async function saveRule(rule: Rule, patch: Partial<Pick<Rule, 'title' | 'why' | 'categoryId' | 'pinned' | 'strict'>>) {
  const next: Rule = { ...rule, ...patch, title: (patch.title ?? rule.title).trim(), updatedAt: Date.now() };
  if (!next.why?.trim()) delete next.why;
  if (!next.pinned) delete next.pinned;
  if (!next.strict) delete next.strict;
  await put('rules', next);
  return next;
}

export async function archiveRule(rule: Rule) {
  const now = Date.now();
  await put('rules', { ...rule, archivedAt: now, updatedAt: now });
}

export async function restoreRule(rule: Rule) {
  const { archivedAt: _archived, ...rest } = rule;
  await put('rules', { ...rest, updatedAt: Date.now() });
}

/**
 * Confirmed hard delete plus tombstone (the existing convention). The rule's reviews and its comparison checks go with it:
 * leaving them behind would keep personal history for a rule the user asked to erase.
 */
export async function deleteRule(rule: Rule) {
  for (const r of await db.ruleReviews.where('ruleId').equals(rule.id).toArray()) await del('ruleReviews', r.id);
  for (const c of await db.compareChecks.where('ruleId').equals(rule.id).toArray()) await del('compareChecks', c.id);
  await del('rules', rule.id);
}

/**
 * Records one review: an append-only `ruleReviews` row first, then the rule updated through `put` with the schedule derived
 * from the review. Nothing else marks a rule reviewed, so a box only ever moves when the user taps an answer.
 *
 * A `broke` review only moves the box here; the break itself is a separate `ruleBreaks` row written by `createBreak`, which
 * is what updates `brokenCount`. That split is why the same break cannot be counted twice.
 */
export async function recordReview(rule: Rule, result: RuleReview['result'], note?: string) {
  const on = today();
  const next = applyReview(rule, result, on);
  const clean = note?.trim();
  await put('ruleReviews', {
    id: uid(),
    ruleId: rule.id,
    reviewedAt: new Date().toISOString(),
    reviewedOn: on,
    result,
    ...(clean ? { note: clean } : {}),
    updatedAt: Date.now(),
  });
  await put('rules', { ...rule, ...next, lastReviewedAt: new Date().toISOString(), updatedAt: Date.now() });
  return next;
}

// ---- categories ----

export async function addCategory(cats: RuleCategory[], name: string) {
  const row: RuleCategory = { id: uid(), name: name.replace(/\s+/g, ' ').trim(), sortOrder: nextOrder(cats), updatedAt: Date.now() };
  await put('ruleCategories', row);
  return row;
}

export async function renameCategory(cat: RuleCategory, name: string) {
  await put('ruleCategories', { ...cat, name: name.replace(/\s+/g, ' ').trim(), updatedAt: Date.now() });
}

/** Moves a category one place up or down by swapping its order number with its neighbour's. */
export async function moveCategory(cats: RuleCategory[], id: string, dir: -1 | 1) {
  const ordered = orderCategories(cats);
  const i = ordered.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  const now = Date.now();
  // rewritten as explicit 0..n-1 so two devices that reorder at once converge on the same sequence
  const next = [...ordered];
  [next[i], next[j]] = [next[j], next[i]];
  for (const [index, cat] of next.entries()) {
    if (cat.sortOrder === index) continue;
    await put('ruleCategories', { ...cat, sortOrder: index, updatedAt: now });
  }
}

export const setCompareEnabled = (cat: RuleCategory, on: boolean) => {
  const row: RuleCategory = { ...cat, updatedAt: Date.now() };
  if (on) row.compareEnabled = true;
  else delete row.compareEnabled;
  return put('ruleCategories', row);
};

/**
 * Deletes a category. A non-empty category must say where its rules go first (`moveTo`), which is what the screen asks;
 * `deleteRules` is the explicit other answer. Sessions of that category go too, with their items and checks.
 */
export async function deleteCategory(cat: RuleCategory, rules: Rule[], choice: { moveTo: string } | { deleteRules: true }) {
  for (const rule of rules) {
    if ('deleteRules' in choice) await deleteRule(rule);
    else await saveRule(rule, { categoryId: choice.moveTo });
  }
  for (const s of await db.compareSessions.where('categoryId').equals(cat.id).toArray()) await deleteSession(s);
  await del('ruleCategories', cat.id);
}

// ---- comparison sessions ----

export async function addSession(categoryId: string, title: string) {
  const now = Date.now();
  const row: CompareSession = { id: uid(), categoryId, title: title.trim() || tx('مقایسه'), status: 'open', createdAt: now, updatedAt: now };
  await put('compareSessions', row);
  return row;
}

/** Open sessions first, then the newest. */
export const orderSessions = (sessions: CompareSession[]) =>
  [...sessions].sort((a, b) => Number(a.status === 'decided') - Number(b.status === 'decided') || b.updatedAt - a.updatedAt);

export async function addItem(session: CompareSession, patch: Pick<CompareItem, 'name'> & Partial<Pick<CompareItem, 'shopName' | 'price' | 'seenOn' | 'note'>>) {
  const now = Date.now();
  const row: CompareItem = {
    id: uid(),
    sessionId: session.id,
    name: patch.name.replace(/\s+/g, ' ').trim(),
    seenOn: patch.seenOn ?? today(),
    ...(patch.shopName?.trim() ? { shopName: patch.shopName.trim() } : {}),
    ...(patch.price !== undefined ? { price: patch.price } : {}),
    ...(patch.note?.trim() ? { note: patch.note.trim() } : {}),
    updatedAt: now,
  };
  await put('compareItems', row);
  await touchSession(session);
  return row;
}

export async function saveItem(item: CompareItem, patch: Partial<Pick<CompareItem, 'name' | 'shopName' | 'price' | 'seenOn' | 'note'>>) {
  const next: CompareItem = { ...item, ...patch, name: (patch.name ?? item.name).trim(), updatedAt: Date.now() };
  if (!next.shopName?.trim()) delete next.shopName;
  if (!next.note?.trim()) delete next.note;
  if (next.price === undefined) delete next.price;
  await put('compareItems', next);
  return next;
}

export const itemsOf = (items: CompareItem[], sessionId: string) => items.filter((i) => i.sessionId === sessionId);

export const checksOf = (checks: CompareCheck[], itemIds: string[]) => {
  const ids = new Set(itemIds);
  return checks.filter((c) => ids.has(c.itemId));
};

/** Writes one check. `unknown` is never stored: the row is removed so a missing row keeps meaning unknown. */
export async function setCheck(itemId: string, ruleId: string, state: CompareCheck['state'], note?: string) {
  const id = `${itemId}|${ruleId}`;
  if (state === 'unknown') return del('compareChecks', id);
  const row: CompareCheck = { id, itemId, ruleId, state, updatedAt: Date.now() };
  const clean = note?.trim();
  if (clean) row.note = clean;
  await put('compareChecks', row);
}

export const touchSession = (session: CompareSession) => put('compareSessions', { ...session, updatedAt: Date.now() });

/** Marks one item as chosen and the session decided; the note is why it was chosen. */
export async function decide(session: CompareSession, itemId: string, reason?: string) {
  const now = Date.now();
  const next: CompareSession = { ...session, status: 'decided', chosenItemId: itemId, updatedAt: now };
  const clean = reason?.trim();
  if (clean) next.decisionNote = clean;
  else delete next.decisionNote;
  await put('compareSessions', next);
}

/** Reopening keeps the checks and the items; only the decision is cleared, so it can be decided again. */
export async function reopen(session: CompareSession) {
  const next: CompareSession = { ...session, status: 'open', updatedAt: Date.now() };
  delete next.chosenItemId;
  delete next.decisionNote;
  await put('compareSessions', next);
}

export async function deleteItem(item: CompareItem) {
  for (const c of await db.compareChecks.where('itemId').equals(item.id).toArray()) await del('compareChecks', c.id);
  await del('compareItems', item.id);
}

export async function deleteSession(session: CompareSession) {
  for (const item of await db.compareItems.where('sessionId').equals(session.id).toArray()) await deleteItem(item);
  await del('compareSessions', session.id);
}

/** "مرور بعدی" line for a rule; the archived case is spelled out rather than shown as a date that never comes. */
export const nextReviewText = (rule: Rule, t = today()) => (rule.archivedAt ? tx('بایگانی‌شده') : dueLabel(rule.nextReviewOn, t));

// ---- Part 1: the broken-rule log ----

/**
 * Records one break. This is the **only** place `rules.brokenCount` goes up: the row is written first, then the rule is
 * re-read and its count recomputed from `ruleBreaks`, so the number can never drift from the log (and can never be
 * incremented twice by a review that also recorded a break).
 *
 * `fields` is allowed to be completely empty: tapping "بعداً" must still record that the break happened.
 */
export async function createBreak(ruleId: string, fields: { brokenOn?: string; personId?: string; whatHappened?: string; whyBroke?: string; nextTimePlan?: string } = {}) {
  const now = Date.now();
  const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
  const row: RuleBreak = {
    id: uid(),
    ruleId,
    brokenOn: fields.brokenOn ?? today(),
    updatedAt: now,
  };
  if (fields.personId) row.personId = fields.personId;
  const what = clean(fields.whatHappened);
  const why = clean(fields.whyBroke);
  const plan = clean(fields.nextTimePlan);
  if (what) row.whatHappened = what;
  if (why) row.whyBroke = why;
  if (plan) row.nextTimePlan = plan;
  await put('ruleBreaks', row);
  await syncBrokenCount(ruleId);
  return row;
}

export async function saveBreak(row: RuleBreak, patch: Partial<Pick<RuleBreak, 'brokenOn' | 'personId' | 'whatHappened' | 'whyBroke' | 'nextTimePlan'>>) {
  const next: RuleBreak = { ...row, ...patch, updatedAt: Date.now() };
  // an emptied field is removed rather than stored as '', so "has a plan" stays a simple existence check
  for (const k of ['whatHappened', 'whyBroke', 'nextTimePlan'] as const) if (!next[k]?.trim()) delete next[k];
  if (!next.personId) delete next.personId;
  await put('ruleBreaks', next);
  return next;
}

/** Deletes one break and recomputes the rule's count, so the counter goes back down by exactly one. */
export async function deleteBreak(row: RuleBreak) {
  await del('ruleBreaks', row.id);
  await syncBrokenCount(row.ruleId);
}

/** Every break of a rule, newest first. */
export const breaksOfRule = async (ruleId: string) => (await db.ruleBreaks.where('ruleId').equals(ruleId).toArray()).sort((a, b) => b.brokenOn.localeCompare(a.brokenOn));

/**
 * Recomputes `rules.brokenCount` from the log and writes it only when it actually differs, so opening a page never
 * produces an outbox entry. Called after any break is created or deleted; nothing else writes this field.
 */
export async function syncBrokenCount(ruleId: string) {
  const rule = await db.rules.get(ruleId);
  if (!rule) return; // the rule itself is gone: nothing to keep in step
  const count = await db.ruleBreaks.where('ruleId').equals(ruleId).count();
  if (rule.brokenCount === count) return;
  await put('rules', { ...rule, brokenCount: count, updatedAt: Date.now() });
}

/** Recomputes the count for every rule, once, so a rule whose rows arrived by sync also shows the right number. */
export async function repairBrokenCounts() {
  const rules = await db.rules.toArray();
  for (const rule of rules) {
    const count = await db.ruleBreaks.where('ruleId').equals(rule.id).count();
    if (rule.brokenCount !== count) await put('rules', { ...rule, brokenCount: count, updatedAt: Date.now() });
  }
}

// ---- Part 2: the per-person rule check ----

/** A new check for one person. The title may be empty, so creating one is a single tap. */
export async function createPersonCheck(personId: string, title: string) {
  const now = Date.now();
  const row: RuleCheck = { id: uid(), personId, title: title.replace(/\s+/g, ' ').trim(), status: 'open', createdAt: now, updatedAt: now };
  await put('ruleChecks', row);
  return row;
}

export const renamePersonCheck = (check: RuleCheck, title: string) =>
  put('ruleChecks', { ...check, title: title.replace(/\s+/g, ' ').trim(), updatedAt: Date.now() });

export const closePersonCheck = (check: RuleCheck) => {
  const now = Date.now();
  return put('ruleChecks', { ...check, status: 'closed', closedAt: now, updatedAt: now });
};

export const reopenPersonCheck = (check: RuleCheck) => {
  const next: RuleCheck = { ...check, status: 'open', updatedAt: Date.now() };
  delete next.closedAt;
  return put('ruleChecks', next);
};

/**
 * Sets one rule's state in a check. `unknown` is not stored: the row is deleted, which is the same convention the purchase
 * comparison uses, so "no row" always means "not checked" and never has to be distinguished from a stored unknown.
 */
export async function setCheckItem(checkId: string, ruleId: string, state: RuleCheckItem['state'], note?: string) {
  const id = `${checkId}|${ruleId}`;
  if (state === 'unknown') return del('ruleCheckItems', id);
  const row: RuleCheckItem = { id, checkId, ruleId, state, updatedAt: Date.now() };
  const clean = note?.trim();
  if (clean) row.note = clean;
  await put('ruleCheckItems', row);
}

export const itemsOfCheck = async (checkId: string) => db.ruleCheckItems.where('checkId').equals(checkId).toArray();

/** Deletes a check with its states (hard delete plus tombstone, the existing convention). */
export async function deletePersonCheck(check: RuleCheck) {
  for (const i of await db.ruleCheckItems.where('checkId').equals(check.id).toArray()) await del('ruleCheckItems', i.id);
  await del('ruleChecks', check.id);
}
