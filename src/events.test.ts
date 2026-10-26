import { expect, test } from 'vitest';
import { addDays, month, parts } from './cal';
import { eventsOn, isHoliday } from './events';

test('Jalali months: 1-6 have 31 days, 7-11 have 30, Esfand 29 (30 in a leap year)', () => {
  const monthLengths = (year: number) => {
    let d = '2020-03-01';
    while (parts(d, 'persian').y !== year || parts(d, 'persian').m !== 1 || parts(d, 'persian').d !== 1) d = addDays(d, 1);
    const out: number[] = [];
    for (let m = 0; m < 12; m++) {
      const days = month(d, 'persian');
      out.push(days.length);
      d = addDays(days[days.length - 1], 1);
    }
    return out;
  };
  const common = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30];
  expect(monthLengths(1403)).toEqual([...common, 30]); // leap year
  for (const y of [1404, 1405, 1406, 1407]) expect(monthLengths(y)).toEqual([...common, 29]);
});

test('occasions inside the supplied years are exact, including lunar holidays', () => {
  const nowruz = eventsOn('2026-03-21')!; // 1 Farvardin 1405
  expect(nowruz.holiday).toBe(true);
  expect(nowruz.list.map((e) => e.title)).toContain('آغاز نوروز');
  const day = eventsOn('2026-10-21')!; // 29 Mehr 1405, an ordinary day with one occasion
  expect([day.holiday, day.list.map((e) => e.title)]).toEqual([false, ['روز صادرات']]);
  expect(eventsOn('2026-10-20')).toBeNull(); // 28 Mehr: nothing listed
});

test('outside the supplied years only the fixed Jalali occasions appear', () => {
  let d = '2028-03-15';
  while (!(parts(d, 'persian').y === 1407 && parts(d, 'persian').m === 1 && parts(d, 'persian').d === 1)) d = addDays(d, 1);
  expect(isHoliday(d)).toBe(true); // Nowruz repeats every year
  let d2 = '2028-02-01';
  while (!(parts(d2, 'persian').y === 1406 && parts(d2, 'persian').m === 11 && parts(d2, 'persian').d === 22)) d2 = addDays(d2, 1);
  expect(eventsOn(d2)!.list.map((e) => e.title)).toContain('پیروزی انقلاب اسلامی ایران');
});
