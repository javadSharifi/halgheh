import data from './events.json';
import { parts } from './cal';

type Rec = { h: 0 | 1; e: [string, 0 | 1][] };
const years = data.years as unknown as Record<string, Rec>;
const fixed = data.fixed as unknown as Record<string, Rec>;
const [FIRST, LAST] = data.range;

export type DayEvents = { holiday: boolean; list: { title: string; holiday: boolean }[] };

/**
 * Occasions and official holidays of a day, from monasebat.json (see scripts/build-events.mjs). Within the years the file covers
 * (1404-1406) every day is exact, lunar occasions included. Outside them only the occasions that fall on the same Jalali date every
 * year are shown, because the lunar ones move.
 */
export function eventsOn(iso: string): DayEvents | null {
  const { y, m, d } = parts(iso, 'persian');
  const rec = y >= FIRST && y <= LAST ? years[`${y}-${m}-${d}`] : fixed[`${m}-${d}`];
  return rec ? { holiday: rec.h === 1, list: rec.e.map(([title, h]) => ({ title, holiday: h === 1 })) } : null;
}

export const isHoliday = (iso: string) => eventsOn(iso)?.holiday === true;
