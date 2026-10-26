import { describe, expect, it } from 'vitest';
import { span } from './dateSpan';

describe('span', () => {
  it('counts whole years, months and days', () => {
    expect(span('2000-02-15', '2026-10-22', 'gregory')).toMatchObject({ y: 26, m: 8, d: 7 });
  });
  it('borrows from the month before when the day is smaller', () => {
    expect(span('2026-01-31', '2026-03-01', 'gregory')).toMatchObject({ y: 0, m: 0, d: 29, days: 29 });
  });
  it('is zero for the same day', () => {
    expect(span('2026-10-22', '2026-10-22', 'persian')).toMatchObject({ y: 0, m: 0, d: 0, days: 0 });
  });
  it('works in the Jalali calendar', () => {
    // 1 Farvardin 1405 -> 1 Mehr 1405 is six months exactly
    expect(span('2026-03-21', '2026-09-23', 'persian')).toMatchObject({ y: 0, m: 6, d: 0 });
  });
});
