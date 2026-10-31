import type { Exchange, ExchangeSettlement } from '../../db';
import { addDays } from '../../cal';

/**
 * Part 3 pure logic: the back-and-forth ledger. No UI, no Dexie import, no clock.
 *
 * Money is the only kind that produces a number, and the two directions are never netted into a single figure the page
 * could mistake for a score: `earn` and `owe` stay separate numbers and `net` is only their difference, shown as one of
 * "طلب خالص" or "بدهی خالص" with a sign the user can read. Items and favours have no amount at all.
 */

/** The kinds the user can record. Only `money` carries an amount. */
export const EXCHANGE_KINDS = ['money', 'item', 'favor', 'other'] as const;
export type ExchangeKind = (typeof EXCHANGE_KINDS)[number];

export const isMoney = (e: Pick<Exchange, 'kind'>) => e.kind === 'money';

/** What is left to pay on one money exchange: the amount minus every settlement recorded against it. */
export function remainingOf(exchange: Exchange, settlements: ExchangeSettlement[]) {
  if (!isMoney(exchange) || exchange.amount === undefined) return undefined;
  const paid = settlements.filter((s) => s.exchangeId === exchange.id).reduce((n, s) => n + (s.amount ?? 0), 0);
  return Math.max(0, exchange.amount - paid);
}

/** Settled when it is marked so, or (money) when the settlements reach the amount. */
export function isSettled(exchange: Exchange, settlements: ExchangeSettlement[]) {
  if (exchange.status === 'settled') return true;
  const left = remainingOf(exchange, settlements);
  return left !== undefined && left <= 0;
}

/**
 * The money balance with one person. `earn` is what they owe me (money I gave that is still open) and `owe` is what I owe
 * them (money I received that is still open), each after settlements. `net === 0` means there is no money balance, which
 * the page shows as "تسویه‌شده" rather than a zero.
 */
export function moneyBalance(personId: string, exchanges: Exchange[], settlements: ExchangeSettlement[]) {
  let earn = 0;
  let owe = 0;
  for (const e of exchanges) {
    if (e.personId !== personId || !isMoney(e) || isSettled(e, settlements)) continue;
    const left = remainingOf(e, settlements) ?? 0;
    if (e.direction === 'gave') earn += left;
    else owe += left;
  }
  return { earn, owe, net: earn - owe };
}

/** The same balance across every person, keyed by person id; a person with no open money has no entry. */
export function balancesByPerson(exchanges: Exchange[], settlements: ExchangeSettlement[]) {
  const ids = new Set(exchanges.filter(isMoney).map((e) => e.personId));
  const out = new Map<string, { earn: number; owe: number; net: number }>();
  for (const id of ids) {
    const b = moneyBalance(id, exchanges, settlements);
    if (b.earn !== 0 || b.owe !== 0) out.set(id, b);
  }
  return out;
}

/**
 * One exchange is due when it is open and has a `dueOn` on or before today. A date-only comparison, so no timezone.
 * A settled row is never due, and a non-money row can be due too: "the book I lent him" can have a return date.
 */
export const isDue = (e: Exchange, today: string) => e.status === 'open' && !!e.dueOn && e.dueOn <= today;
export const isOverdue = (e: Exchange, today: string) => e.status === 'open' && !!e.dueOn && e.dueOn < today;
export const isDueToday = (e: Exchange, today: string) => e.status === 'open' && e.dueOn === today;

/** Every open exchange whose date has come; the Today card and the digest both use this. */
export const dueExchanges = (exchanges: Exchange[], today: string) =>
  exchanges.filter((e) => isDue(e, today)).sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''));

/** The filters the ledger page offers. `earn` / `owe` only make sense for money, which is why they are money-only. */
export type LedgerFilter = 'open' | 'earn' | 'owe' | 'settled';

export function filterExchanges(exchanges: Exchange[], settlements: ExchangeSettlement[], filter: LedgerFilter) {
  switch (filter) {
    case 'open':
      return exchanges.filter((e) => !isSettled(e, settlements));
    case 'earn':
      return exchanges.filter((e) => isMoney(e) && !isSettled(e, settlements) && e.direction === 'gave');
    case 'owe':
      return exchanges.filter((e) => isMoney(e) && !isSettled(e, settlements) && e.direction === 'received');
    case 'settled':
      return exchanges.filter((e) => isSettled(e, settlements));
    default:
      return exchanges;
  }
}

/** Counts for the filter chips, so an empty tab says why instead of looking broken. */
export const filterCounts = (exchanges: Exchange[], settlements: ExchangeSettlement[]) => ({
  open: filterExchanges(exchanges, settlements, 'open').length,
  earn: filterExchanges(exchanges, settlements, 'earn').length,
  owe: filterExchanges(exchanges, settlements, 'owe').length,
  settled: filterExchanges(exchanges, settlements, 'settled').length,
});

/**
 * The order the ledger shows: open before settled, then the nearest due date (undated last), then the newest date. Settled
 * rows sink to the bottom because the page is a memory aid, not an archive.
 */
export function orderExchanges(exchanges: Exchange[], settlements: ExchangeSettlement[]) {
  return [...exchanges].sort((a, b) => {
    const sa = isSettled(a, settlements) ? 1 : 0;
    const sb = isSettled(b, settlements) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    const da = a.dueOn ?? '9999-99-99';
    const db = b.dueOn ?? '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return b.date.localeCompare(a.date);
  });
}

/** Groups exchanges by person for the ledger page, keeping the person order the caller gives. */
export function groupByPerson<T extends Exchange>(exchanges: T[], settlements: ExchangeSettlement[], personOrder: string[]) {
  const groups = new Map<string, T[]>();
  for (const e of orderExchanges(exchanges, settlements)) {
    const list = groups.get(e.personId) ?? [];
    list.push(e as T);
    groups.set(e.personId, list);
  }
  const rank = new Map(personOrder.map((id, i) => [id, i]));
  return [...groups.entries()]
    .map(([personId, list]) => ({ personId, exchanges: list, rank: rank.get(personId) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.rank - b.rank);
}

/** "۳ روز مانده", "امروز", "۲ روز گذشته" for a due date; '' when there is none. */
export function dueText(dueOn: string | undefined, today: string, fa: (n: number) => string) {
  if (!dueOn) return '';
  const diff = Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return 'امروز';
  if (diff > 0) return `${fa(diff)} روز مانده`;
  return `${fa(-diff)} روز گذشته`;
}

/** A due date in the next `days` days (used by the brief's "soon" sections). */
export const dueWithin = (e: Exchange, today: string, days: number) => !!e.dueOn && e.dueOn >= today && e.dueOn <= addDays(today, days);
