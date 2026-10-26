import { type Cal, addDays, month, parts } from './cal';

/** Years, months and days from `from` to `to` (from <= to) as `cal` counts them, plus the plain number of days. */
export function span(from: string, to: string, cal: Cal, off = 0) {
  const f = parts(from, cal, off);
  const t = parts(to, cal, off);
  let y = t.y - f.y;
  let m = t.m - f.m;
  let d = t.d - f.d;
  let cursor = to;
  while (d < 0) {
    cursor = addDays(cursor, -parts(cursor, cal, off).d); // last day of the month before
    d += month(cursor, cal, off).length;
    m--;
  }
  while (m < 0) {
    y--;
    m += 12;
  }
  return { y, m, d, days: Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) };
}
