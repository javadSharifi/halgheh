import { expect, test } from 'vitest';
import { addDays, bdayOn, fullDate, gridCells, month, parts, taskOn } from './cal';

test('same day in three calendars', () => {
  expect(parts('2026-10-21', 'gregory')).toEqual({ y: 2026, m: 10, d: 21 });
  expect(parts('2026-10-21', 'persian')).toEqual({ y: 1405, m: 7, d: 29 });
  const h = parts('2026-10-21', 'islamic');
  expect([h.y, h.m]).toEqual([1448, 5]);
});

test('hijri offset moves the day', () => {
  const a = parts('2026-10-21', 'islamic', 0).d;
  expect(parts('2026-10-21', 'islamic', 1).d).toBe(a + 1);
  expect(parts('2026-10-21', 'persian', 1).d).toBe(29); // offset is hijri-only
});

test('month grid', () => {
  const m = month('2026-10-21', 'persian');
  expect([m[0], m.length]).toEqual(['2026-09-23', 30]); // Mehr 1405
  expect(month('2026-02-10', 'gregory').length).toBe(28);
});

test('weekly task and birthday matching', () => {
  const sat = 1 << 6; // 2026-10-24 is a Saturday
  const t = { mask: sat, start: '2026-10-01' };
  expect(taskOn(t, '2026-10-24')).toBe(true);
  expect(taskOn(t, '2026-10-25')).toBe(false);
  expect(taskOn({ ...t, end: '2026-10-20' }, '2026-10-24')).toBe(false);
  expect(bdayOn({ cal: 'persian', month: 7, day: 29 }, '2026-10-21')).toBe(true);
  expect(bdayOn({ cal: 'persian', month: 7, day: 29 }, addDays('2026-10-21', 1))).toBe(false);
});

test('calendar grid pads to whole weeks for any week start', () => {
  const mehr = month('2026-10-21', 'persian'); // 1 Mehr 1405 is a Wednesday, 30 days
  const sat = gridCells(mehr, 6);
  expect([sat.length, sat[0], sat[4], sat[sat.length - 1]]).toEqual([35, '2026-09-19', '2026-09-23', '2026-10-23']);
  const sun = gridCells(mehr, 0);
  expect([sun.length, sun[0]]).toEqual([35, '2026-09-20']);
  const feb = gridCells(month('2026-02-10', 'gregory'), 0); // 1 Feb 2026 is a Sunday, 28 days: no padding at all
  expect([feb.length, feb[0], feb[27]]).toEqual([28, '2026-02-01', '2026-02-28']);
});

test('full date has no era suffix', () => {
  expect(fullDate('2026-10-21', 'islamic')).toBe('۱۰ جمادی‌الاول ۱۴۴۸');
  expect(fullDate('2026-10-21', 'persian')).toBe('۲۹ مهر ۱۴۰۵');
  expect(fullDate('2026-10-21', 'gregory')).toBe('۲۱ اکتبر ۲۰۲۶');
});
