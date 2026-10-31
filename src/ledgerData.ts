import { type Exchange, type ExchangeSettlement, db, del, put, uid } from './db';
import { today } from './cal';
import { remainingOf } from './domain/ledger';

/**
 * Every write of the ledger goes through here and therefore through `put`/`del`, so sync and the backup both see it.
 * The pure money rules live in `domain/ledger`; this file only moves rows and keeps the settlement/status pair consistent.
 */

export type ExchangeDraft = {
  personId: string;
  direction: Exchange['direction'];
  kind: Exchange['kind'];
  title: string;
  amount?: number;
  date?: string;
  dueOn?: string;
  note?: string;
};

/** Records one exchange. An amount is dropped for every kind except money, so a favour can never carry a number. */
export async function addExchange(draft: ExchangeDraft) {
  const now = Date.now();
  const row: Exchange = {
    id: uid(),
    personId: draft.personId,
    direction: draft.direction,
    kind: draft.kind,
    title: draft.title.replace(/\s+/g, ' ').trim(),
    date: draft.date ?? today(),
    status: 'open',
    updatedAt: now,
  };
  if (draft.kind === 'money' && draft.amount !== undefined) row.amount = draft.amount;
  if (draft.dueOn) row.dueOn = draft.dueOn;
  if (draft.note?.trim()) row.note = draft.note.trim();
  await put('exchanges', row);
  return row;
}

/** Saves the editable fields. Changing the kind away from money clears the amount, because it would be meaningless there. */
export async function saveExchange(row: Exchange, patch: Partial<ExchangeDraft>) {
  const next: Exchange = { ...row, ...patch, title: (patch.title ?? row.title).trim(), updatedAt: Date.now() };
  if (next.kind !== 'money') delete next.amount;
  else if (patch.amount === undefined && row.amount !== undefined && row.kind === 'money') next.amount = row.amount;
  if (!next.dueOn) delete next.dueOn;
  if (!next.note?.trim()) delete next.note;
  await put('exchanges', next);
  return next;
}

/** Marks a non-money exchange settled, or a money one settled without recording the payments individually. */
export async function settleExchange(row: Exchange) {
  await put('exchanges', { ...row, status: 'settled', settledOn: today(), updatedAt: Date.now() });
}

/** Reopening clears the settled date, so a settled row can go back to open without carrying a stale date. */
export async function reopenExchange(row: Exchange) {
  const next: Exchange = { ...row, status: 'open', updatedAt: Date.now() };
  delete next.settledOn;
  await put('exchanges', next);
}

/**
 * Records a payment (money only). When the payments reach the amount the exchange becomes settled in the same step, so the
 * list never shows a fully paid row as still open; a partial payment leaves it open.
 */
export async function addSettlement(exchange: Exchange, amount: number | undefined, note?: string) {
  const now = Date.now();
  const row: ExchangeSettlement = { id: uid(), exchangeId: exchange.id, date: today(), updatedAt: now };
  if (exchange.kind === 'money' && amount !== undefined) row.amount = amount;
  if (note?.trim()) row.note = note.trim();
  await put('exchangeSettlements', row);

  const settlements = await db.exchangeSettlements.where('exchangeId').equals(exchange.id).toArray();
  const left = remainingOf({ ...exchange, status: 'open' }, settlements);
  if (left !== undefined && left <= 0) {
    await put('exchanges', { ...exchange, status: 'settled', settledOn: today(), updatedAt: Date.now() });
  }
  return row;
}

/** Deletes a payment and reopens the exchange if the remaining amount is positive again. */
export async function deleteSettlement(row: ExchangeSettlement, exchange: Exchange) {
  await del('exchangeSettlements', row.id);
  if (exchange.status !== 'settled') return;
  const settlements = await db.exchangeSettlements.where('exchangeId').equals(exchange.id).toArray();
  const left = remainingOf({ ...exchange, status: 'open' }, settlements);
  if (left === undefined || left > 0) await reopenExchange(exchange);
}

/** Deletes an exchange with its payments. */
export async function deleteExchange(row: Exchange) {
  for (const s of await db.exchangeSettlements.where('exchangeId').equals(row.id).toArray()) await del('exchangeSettlements', s.id);
  await del('exchanges', row.id);
}

/** The person's exchanges, newest first; used by the profile section and the brief. */
export const exchangesOfPerson = async (personId: string) =>
  (await db.exchanges.where('personId').equals(personId).toArray()).sort((a, b) => b.date.localeCompare(a.date));
