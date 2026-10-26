import { expect, test } from 'vitest';
import { taskOn } from './cal';
import { taskNotifId, taskReminders } from './reminders';
import { continueChecklist, cycleChecklist, noteNotifId, addTag, cleanTag, DEFAULT_TAGS, MAX_TAGS, normalizeNote, removeTag, sortNotes, tagOptions } from './notes';
import { findMatch, normalize, searchAll, snippet } from './search';
import { formatBytes, MASK_SAT_TO_WED, maxDay, nextOccurrence, toLatinDigits, YEAR_RANGE, MASK_WEEKEND, byTime, clock, daysText, faDigits, firstRun, leadLabel, leadText, greeting, isTime, nextBirthday, reminderAt } from './format';

const bit = (...days: number[]) => days.reduce((m, d) => m | (1 << d), 0); // JS weekdays: 0 Sun .. 6 Sat

test('weekday masks read naturally', () => {
  expect(daysText(127)).toBe('هر روز');
  expect(daysText(bit(6, 0, 1, 2, 3))).toBe('شنبه تا چهارشنبه');
  expect(daysText(bit(6, 1))).toBe('شنبه، دوشنبه');
  expect(daysText(bit(2, 3, 4))).toBe('سه‌شنبه تا پنجشنبه');
  expect(daysText(bit(4, 5, 6))).toBe('شنبه، پنجشنبه، جمعه'); // the week starts on Saturday, so this is not a run
});

test('greeting follows the hour', () => {
  expect([3, 9, 13, 18, 22].map(greeting)).toEqual(['شب بخیر', 'صبح بخیر', 'ظهر بخیر', 'عصر بخیر', 'شب بخیر']);
});

test('next birthday skips the starting day and finds the nearest', () => {
  const bdays = [
    { id: 'a', name: 'A', cal: 'persian' as const, month: 7, day: 29 }, // 2026-10-21
    { id: 'b', name: 'B', cal: 'persian' as const, month: 8, day: 3 }, // 2026-10-25
  ];
  expect(nextBirthday(bdays, '2026-10-21', 0)).toMatchObject({ b: { id: 'b' }, date: '2026-10-25', inDays: 4 });
  expect(nextBirthday([], '2026-10-21', 0)).toBeNull();
});

test('time validation', () => {
  expect(['00:00', '18:30', '23:59'].every(isTime)).toBe(true);
  expect(['24:00', '9:30', '18:60', '', undefined, 1830].some(isTime)).toBe(false);
});

test('reminder time is the task time minus the lead, and absent without a time or a lead', () => {
  const at = reminderAt({ time: '18:30', remindLead: 10 }, '2026-10-21')!;
  expect([at.getHours(), at.getMinutes(), at.getDate()]).toEqual([18, 20, 21]);
  expect(reminderAt({ time: '00:05', remindLead: 10 }, '2026-10-21')!.getDate()).toBe(20); // crosses midnight
  expect(reminderAt({ time: '18:30', remindLead: 0 }, '2026-10-21')!.getMinutes()).toBe(30);
  expect(reminderAt({ time: '18:30' }, '2026-10-21')).toBeNull();
  expect(reminderAt({ remindLead: 5 }, '2026-10-21')).toBeNull();
  expect(reminderAt({ time: '18:30', remindLead: -5 }, '2026-10-21')).toBeNull();
});

test('timed tasks sort first, earliest first; untimed keep their order', () => {
  const l = [{ id: 'a' }, { id: 'b', time: '22:00' }, { id: 'c', time: '07:00' }, { id: 'd' }] as { id: string; time?: string }[];
  expect([...l].sort(byTime).map((x) => x.id)).toEqual(['c', 'b', 'a', 'd']);
});

test('paused and old rows', () => {
  const t = { mask: 127, start: '2026-10-01' };
  expect(taskOn(t, '2026-10-21')).toBe(true); // a row from before the new fields: active
  expect(taskOn({ ...t, active: true }, '2026-10-21')).toBe(true);
  expect(taskOn({ ...t, active: false }, '2026-10-21')).toBe(false);
});

test('clock shows local hours and minutes in Persian digits', () => {
  expect(clock(new Date(2026, 9, 21, 7, 20).getTime())).toBe('۰۷:۲۰');
  expect(clock(new Date(2026, 9, 21, 23, 5).getTime())).toBe('۲۳:۰۵');
});

test('old one-note-per-day rows become titled notes with a date', () => {
  const old = { id: '2026-10-21', text: 'برنامهٔ سفر\nبلیت بگیرم\nکاپشن', updatedAt: 5 };
  expect(normalizeNote(old)).toEqual({ id: '2026-10-21', date: '2026-10-21', title: 'برنامهٔ سفر', text: 'بلیت بگیرم\nکاپشن', tags: [], pinned: false, updatedAt: 5 });
  expect(normalizeNote({ id: 'x', text: 'no day', updatedAt: 1 })).toBeNull(); // cannot tell which day
  expect(normalizeNote(null)).toBeNull();
});

test('new-shape notes are kept as they are, with tags cleaned up', () => {
  const n = normalizeNote({ id: 'n1', date: '2026-10-22', title: '', text: 'a\nb', tags: ['سفر', ' سفر ', '', 3, 'خانواده'], pinned: true, updatedAt: 9 });
  expect(n).toEqual({ id: 'n1', date: '2026-10-22', title: '', text: 'a\nb', tags: ['سفر', 'خانواده'], pinned: true, updatedAt: 9 }); // empty title is not re-split
});

test('pinned notes come first, then newest', () => {
  const mk = (id: string, pinned: boolean, updatedAt: number) => ({ id, date: '2026-10-21', title: '', text: '', tags: [], pinned, updatedAt });
  expect(sortNotes([mk('a', false, 3), mk('b', true, 1), mk('c', false, 5)]).map((n) => n.id)).toEqual(['b', 'c', 'a']);
});

test('reminder lead reads naturally', () => {
  expect([0, 10, 60, 120, 5].map(leadText)).toEqual(['یادآور در همان لحظه', 'یادآور ۱۰ دقیقه قبل', 'یادآور ۱ ساعت قبل', 'یادآور ۲ ساعت قبل', 'یادآور ۵ دقیقه قبل']);
});

test('digits, lead labels and presets', () => {
  expect(faDigits('22:05')).toBe('۲۲:۰۵');
  expect([0, 10, 60].map(leadLabel)).toEqual(['در همان لحظه', '۱۰ دقیقه قبل', '۱ ساعت قبل']);
  expect(daysText(MASK_SAT_TO_WED)).toBe('شنبه تا چهارشنبه');
  expect(daysText(MASK_WEEKEND)).toBe('پنجشنبه، جمعه');
});

test('first run is today when today matches, otherwise the next matching day', () => {
  const wed = 1 << 3; // 2026-10-21 is a Wednesday
  expect(firstRun(wed, '2026-10-21')).toBe('2026-10-21');
  expect(firstRun(1 << 4, '2026-10-21')).toBe('2026-10-22'); // Thursday
  expect(firstRun(1 << 2, '2026-10-21')).toBe('2026-10-27'); // next Tuesday
  expect(firstRun(0, '2026-10-21')).toBeNull();
});

test('digits typed in Persian or Arabic are parsed', () => {
  expect(toLatinDigits('۱۳۶۶')).toBe('1366');
  expect(toLatinDigits('٢٩ مهر')).toBe('29 مهر');
  expect(toLatinDigits('12')).toBe('12');
});

test('month lengths and year ranges', () => {
  expect([maxDay('persian', 1), maxDay('persian', 6), maxDay('persian', 7), maxDay('persian', 12)]).toEqual([31, 31, 30, 30]);
  expect([maxDay('gregory', 2), maxDay('gregory', 4), maxDay('gregory', 12)]).toEqual([29, 30, 31]);
  expect(maxDay('islamic', 5)).toBe(30);
  expect(YEAR_RANGE.persian[0] < 1366 && 1366 < YEAR_RANGE.persian[1]).toBe(true);
});

test('next occurrence counts today as zero days', () => {
  const b = { id: 'a', name: 'A', cal: 'persian' as const, month: 7, day: 29 }; // 2026-10-21
  expect(nextOccurrence(b, '2026-10-21', 0)).toEqual({ date: '2026-10-21', inDays: 0 });
  expect(nextOccurrence(b, '2026-10-22', 0)!.inDays).toBeGreaterThan(300); // next year
});

test('byte sizes in Persian', () => {
  expect([90, 2048, 1536, 2.4 * 1024 * 1024, 5 * 1024 * 1024].map(formatBytes)).toEqual(['۹۰ بایت', '۲ کیلوبایت', '۱٫۵ کیلوبایت', '۲٫۴ مگابایت', '۵ مگابایت']);
});

test('search ignores letter variants, half-spaces, vowel marks and digit scripts', () => {
  expect(findMatch('علی رضایی', 'علي')).toEqual([0, 3]); // Arabic yeh in the query
  expect(findMatch('می‌خواهم', 'میخواهم')).toEqual([0, 8]); // half-space in the text, none in the query
  expect(findMatch('۲۹ مهر', '29')).toEqual([0, 2]); // Latin digits find Persian digits
  expect(findMatch('كتاب', 'کتاب')).toEqual([0, 4]); // Arabic kaf in the text
  expect(findMatch('خرید کادو', 'سارا')).toBeNull();
  expect(findMatch('anything', '   ')).toBeNull();
});

test('match positions refer to the original text even after characters are dropped', () => {
  const text = 'ایده‌های هدیه';
  const [a, b] = findMatch(text, 'هدیه')!;
  expect(text.slice(a, b)).toBe('هدیه');
  expect(normalize('a\u200cb').n).toBe('ab');
});

test('snippets centre on the match and mark cuts', () => {
  const long = 'الف '.repeat(30) + 'سارا' + ' ب'.repeat(40);
  const s = snippet(long, 'سارا');
  expect(s.startsWith('…') && s.endsWith('…') && s.includes('سارا')).toBe(true);
  expect(snippet('کوتاه', 'سارا')).toBe('کوتاه');
});

test('search groups results across notes, tasks and birthdays', () => {
  const note = (id: string, title: string, text: string, updatedAt: number) => ({ id, date: '2026-10-21', title, text, tags: [], pinned: false, updatedAt });
  const data = {
    notes: [note('n1', 'ایده‌های هدیهٔ تولد سارا', 'کتاب شعر', 1), note('n2', 'قرار کافه', 'با سارا و نرگس', 5), note('n3', 'بی‌ربط', 'هیچ', 9)],
    tasks: [{ id: 't1', title: 'خرید کادو برای سارا', mask: 127, start: '2026-10-01', updatedAt: 1 }, { id: 't2', title: 'ورزش', mask: 127, start: '2026-10-01', updatedAt: 1 }],
    birthdays: [{ id: 'b1', name: 'سارا احمدی', cal: 'persian' as const, month: 8, day: 3, updatedAt: 1 }],
  };
  const r = searchAll('سارا', data, '2026-10-21', 0);
  expect(r.notes.map((n) => n.id)).toEqual(['n2', 'n1']); // newest first
  expect(r.tasks.map((t) => t.id)).toEqual(['t1']);
  expect(r.birthdays.map((x) => [x.b.id, x.inDays])).toEqual([['b1', 4]]);
});

test('typed tags are cleaned and never duplicated, in any spelling', () => {
  expect(cleanTag('  سفر   کاری ')).toBe('سفر کاری');
  expect(cleanTag('   ')).toBeNull();
  expect(cleanTag('x'.repeat(50))!.length).toBe(30);
  expect(addTag(['سفر'], ' سفر ')).toEqual(['سفر']);
  expect(addTag(['علی'], 'علي')).toEqual(['علی']); // Arabic yeh is the same tag
  expect(addTag(['سفر'], 'کار')).toEqual(['سفر', 'کار']);
  expect(addTag([], '')).toEqual([]);
  expect(addTag(Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`), 'جدید')).toHaveLength(MAX_TAGS); // full
  expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
});

test('tag options: used tags by popularity, then defaults, then the current note, no repeats', () => {
  const n = (tags: string[]) => ({ id: Math.random().toString(), date: '2026-10-21', title: '', text: '', tags, pinned: false, updatedAt: 1 });
  expect(tagOptions([n(['کار']), n(['کار', 'سفر']), n(['ورزش'])], ['تازه'])).toEqual(['کار', 'سفر', 'ورزش', 'خانواده', 'شخصی', 'تازه']);
  expect(tagOptions([], [])).toEqual(DEFAULT_TAGS);
});

test('checklist button cycles plain -> open -> done -> plain, over every selected line', () => {
  const t0 = 'شیر\nنان';
  const a = cycleChecklist(t0, 0, t0.length);
  expect(a.text).toBe('☐ شیر\n☐ نان');
  const b = cycleChecklist(a.text, 0, a.text.length);
  expect(b.text).toBe('☑ شیر\n☑ نان');
  expect(cycleChecklist(b.text, 0, b.text.length).text).toBe(t0);
  expect(cycleChecklist('الف\nب\nج', 5, 5).text).toBe('الف\nب\nج'.replace('ب', '☐ ب')); // only the caret line
  expect(cycleChecklist('', 0, 0)).toEqual({ text: '☐ ', start: 2, end: 2 });
  expect([a.start, a.end]).toEqual([0, a.text.length]); // several lines stay selected, so the next press cycles the same lines
});

test('enter continues a checklist and an empty item ends it', () => {
  const t = '☐ شیر';
  expect(continueChecklist(t, t.length)).toEqual({ text: '☐ شیر\n☐ ', caret: 8 });
  expect(continueChecklist('x\n☐ ', 4)).toEqual({ text: 'x\n', caret: 2 }); // empty item removed
  expect(continueChecklist('متن ساده', 3)).toBeNull();
  expect(continueChecklist('☑ a\nb', 6)).toBeNull(); // caret on a plain line after the list
});

test('note reminders: kept when valid, ids stable and in range', () => {
  const base = { id: 'n', date: '2026-10-21', title: '', text: '', updatedAt: 1 };
  expect(normalizeNote({ ...base, remindAt: 1_800_000_000_000 })!.remindAt).toBe(1_800_000_000_000);
  expect('remindAt' in normalizeNote({ ...base, remindAt: -5 })!).toBe(false);
  expect('remindAt' in normalizeNote(base)!).toBe(false);
  const id = noteNotifId('9f1c7a52-6d0e-4b3a-9e55-0123456789ab');
  expect(id).toBe(noteNotifId('9f1c7a52-6d0e-4b3a-9e55-0123456789ab'));
  expect(id >= 100_000_000 && id < 900_000_000).toBe(true);
});

test('task reminders: future occurrences with a time and a lead, soonest first, ticked ones skipped', () => {
  const base = { start: '2026-10-01', updatedAt: 1 };
  const tasks = [
    { ...base, id: 'a', title: 'تماس', mask: 127, time: '18:30', remindLead: 10 },
    { ...base, id: 'b', title: 'بدون یادآور', mask: 127, time: '09:00' },
    { ...base, id: 'c', title: 'بدون ساعت', mask: 127, remindLead: 5 },
    { ...base, id: 'd', title: 'متوقف', mask: 127, time: '10:00', remindLead: 0, active: false },
    { ...base, id: 'e', title: 'صبح', mask: 127, time: '07:00', remindLead: 0 },
  ];
  const now = new Date('2026-10-21T12:00:00').getTime();
  const r = taskReminders(tasks, new Set(['a|2026-10-21']), '2026-10-21', 2, now, 50);
  expect(r.map((x) => x.title)).toEqual(['صبح', 'تماس']); // today's 07:00 has passed and a is ticked today, so only the 22nd remains: 07:00, then a at 18:20
  expect(new Date(r[1].at).getHours() * 60 + new Date(r[1].at).getMinutes()).toBe(18 * 60 + 20); // 10 minutes before 18:30
  expect(r[0].body).toBe('ساعت ۰۷:۰۰');
  expect(taskReminders(tasks, new Set(), '2026-10-21', 30, now, 3)).toHaveLength(3); // cap
});

test('task notification ids are stable, per occurrence and clear of the other ranges', () => {
  const a = taskNotifId('t1', '2026-10-21');
  expect(a).toBe(taskNotifId('t1', '2026-10-21'));
  expect(a).not.toBe(taskNotifId('t1', '2026-10-22'));
  expect(a >= 900_000_000 && a < 1_900_000_000).toBe(true);
});
