import { type Cal, addDays, bdayOn, fa, wd, wdName } from './cal';
import { lang, tx } from './i18n';

const SAT_FIRST = [6, 0, 1, 2, 3, 4, 5]; // JS weekdays in the order Iranians read the week

/** Weekday mask -> "هر روز", "شنبه تا چهارشنبه" (3+ days in a row) or "شنبه، دوشنبه". */
export function daysText(mask: number) {
  const on = SAT_FIRST.filter((d) => (mask >> d) & 1);
  if (on.length === 7) return tx('هر روز');
  const idx = on.map((d) => SAT_FIRST.indexOf(d));
  const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return on.length >= 3 && run
    ? tx('{a1} تا {a2}', { a1: wdName(on[0]), a2: wdName(on[on.length - 1]) })
    : on.map((d) => wdName(d)).join(lang() === 'fa' ? '، ' : ', ');
}

/** What a task repeats on, for list subtitles. */
export const kindText = (t: { mask: number; on?: string }) => (t.on ? tx('یک‌بار') : daysText(t.mask));

export const greeting = (hour: number) =>
  tx(hour < 5 ? 'شب بخیر' : hour < 12 ? 'صبح بخیر' : hour < 17 ? 'ظهر بخیر' : hour < 20 ? 'عصر بخیر' : 'شب بخیر');

type B = { id: string; name: string; cal: Cal; month: number; day: number; year?: number };

/** The first birthday strictly after `from` within a year and a bit, or null. */
export function nextBirthday<T extends B>(bdays: T[], from: string, off: number) {
  for (let i = 1; i <= 400; i++) {
    const date = addDays(from, i);
    const b = bdays.find((x) => bdayOn(x, date, off));
    if (b) return { b, date, inDays: i };
  }
  return null;
}

export const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Lead options offered for a reminder, in minutes. */
export const LEADS = [0, 5, 10, 15, 30, 60];

/** When to remind about a task on `date` (local time), or null when it has no time or no reminder. */
export function reminderAt(t: { time?: string; remindLead?: number }, date: string): Date | null {
  if (!isTime(t.time) || !Number.isInteger(t.remindLead) || (t.remindLead as number) < 0 || (t.remindLead as number) > 1440) return null;
  return new Date(new Date(`${date}T${t.time}:00`).getTime() - (t.remindLead as number) * 60_000);
}

/** Tasks with a time first (earliest first), then the rest in their original order. */
export const byTime = <T extends { time?: string }>(a: T, b: T) => (isTime(a.time) ? a.time : '99:99').localeCompare(isTime(b.time) ? b.time : '99:99');

/** "۰۷:۲۰": local clock time of a timestamp, as Persian digits. */
export const clock = (ms: number) => {
  const d = new Date(ms);
  return faDigits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
};

/** "یادآور ۱۰ دقیقه قبل" / "یادآور در همان لحظه" / "یادآور ۱ ساعت قبل". */
export const leadText = (min: number) =>
  min === 0
    ? tx('یادآور در همان لحظه')
    : min % 60 === 0
      ? tx('یادآور {a1} ساعت قبل', { a1: fa(min / 60) })
      : tx('یادآور {a1} دقیقه قبل', { a1: fa(min) });

/** "18:30" -> "۱۸:۳۰" */
export const faDigits = (s: string) => (lang() === 'fa' ? s.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[+c]) : s);

/** "۱۰ دقیقه قبل" for the reminder-lead picker. */
export const leadLabel = (min: number) =>
  min === 0 ? tx('در همان لحظه') : min % 60 === 0 ? tx('{a1} ساعت قبل', { a1: fa(min / 60) }) : tx('{a1} دقیقه قبل', { a1: fa(min) });

/** The first day on or after `from` (within a week) that the weekday mask runs, or null for an empty mask. */
export function firstRun(mask: number, from: string) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if ((mask >> wd(d)) & 1) return d;
  }
  return null;
}

// JS weekday bits for the presets of the recurring-task form
export const MASK_ALL = 127;
export const MASK_SAT_TO_WED = (1 << 6) | (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3);
export const MASK_WEEKEND = (1 << 4) | (1 << 5); // Thursday and Friday

/** Persian/Arabic-Indic digits typed on a phone keyboard -> Latin digits, so they can be parsed. */
export const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

/** Most days a month can have (leap days allowed): Esfand 30, Feb 29 and the 30-day Hijri months are accepted. */
export function maxDay(cal: Cal, month: number) {
  if (cal === 'persian') return month <= 6 ? 31 : 30;
  if (cal === 'islamic') return 30;
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** Plausible birth years per calendar; anything else would give a silly age. */
export const YEAR_RANGE: Record<Cal, [number, number]> = { persian: [1200, 1500], islamic: [1200, 1500], gregory: [1800, 2100] };

/** The first day on or after `from` (within 400 days) a birthday falls on. */
export function nextOccurrence<T extends B>(b: T, from: string, off: number) {
  for (let i = 0; i <= 400; i++) {
    const date = addDays(from, i);
    if (bdayOn(b, date, off)) return { date, inDays: i };
  }
  return null;
}

/** "۲٫۴ مگابایت", "۱۲ کیلوبایت", "۹۰ بایت" */
export function formatBytes(n: number) {
  const f = (x: number) => faDigits((Math.round(x * 10) / 10).toString().replace('.', lang() === 'fa' ? '٫' : '.'));
  if (n < 1024) return tx('{a1} بایت', { a1: fa(n) });
  if (n < 1024 * 1024) return tx('{a1} کیلوبایت', { a1: f(n / 1024) });
  return tx('{a1} مگابایت', { a1: f(n / 1024 / 1024) });
}

/** Formats a number with 3-digit comma separators in Persian digits: 1500000 -> "۱,۵۰۰,۰۰۰" */
export function formatNumberFa(n: number): string {
  if (!Number.isFinite(n)) return fa(0);
  const rounded = Math.abs(Math.round(n));
  const parts = String(rounded).split('');
  const withCommas: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && (parts.length - i) % 3 === 0) withCommas.push(',');
    withCommas.push(parts[i]);
  }
  const s = faDigits(withCommas.join(''));
  return n < 0 ? `-${s}` : s;
}

/** Formats an amount with commas and "تومان": 1500000 -> "۱,۵۰۰,۰۰۰ تومان" */
export function formatToman(n: number | undefined): string {
  if (n === undefined || n === null) return '';
  return tx('{a1} تومان', { a1: formatNumberFa(n) });
}

const FA_UNITS = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const FA_TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const FA_TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const FA_HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const FA_SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function chunkToWords(num: number): string {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(FA_HUNDREDS[h]);
  if (rem >= 10 && rem < 20) {
    parts.push(FA_TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const u = rem % 10;
    if (t > 0) parts.push(FA_TENS[t]);
    if (u > 0) parts.push(FA_UNITS[u]);
  }
  return parts.join(' و ');
}

/** Converts an integer amount to readable Persian words: 1500000 -> "یک میلیون و پانصد هزار تومان" */
export function tomanWords(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  if (lang() === 'en') return tx('{a1} تومان', { a1: formatNumberFa(n) });
  const val = Math.round(n);
  if (val === 0) return tx('صفر تومان');
  const isNeg = val < 0;
  let remaining = Math.abs(val);
  const chunks: string[] = [];
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < FA_SCALES.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const text = chunkToWords(chunk);
      const scale = FA_SCALES[scaleIndex];
      chunks.unshift(scale ? `${text} ${scale}` : text);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  const result = chunks.join(' و ') + ' تومان';
  return isNeg ? `منفی ${result}` : result;
}

