import { describe, expect, it } from 'vitest';
import { taskOn } from './cal';
import { taskReminders } from './reminders';

const exam = { id: 'x', title: 'امتحان', mask: 0, start: '2026-11-10', on: '2026-11-10', before: [1, 2], updatedAt: 0 };
const now = new Date('2026-11-01T08:00:00').getTime();

describe('one-off task', () => {
  it('runs only on its date', () => {
    expect(taskOn(exam, '2026-11-10')).toBe(true);
    expect(taskOn(exam, '2026-11-11')).toBe(false);
    expect(taskOn({ ...exam, active: false }, '2026-11-10')).toBe(false);
  });
  it('reminds 2 and 1 days ahead at 09:00, unless ticked', () => {
    const r = taskReminders([exam], new Set(), '2026-11-01', 30, now, 50);
    expect(r.map((x) => new Date(x.at).getDate())).toEqual([8, 9]);
    expect(r[0].body).toBe('۲ روز دیگر');
    expect(r[1].body).toBe('فردا');
    expect(taskReminders([exam], new Set(['x|2026-11-10']), '2026-11-01', 30, now, 50)).toEqual([]);
  });
});
