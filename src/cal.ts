import { lang, num, tk } from './i18n';

export type Cal = 'persian' | 'gregory' | 'islamic';
export const CALS: Cal[] = ['persian', 'gregory', 'islamic'];
export const CAL_NAMES: Record<Cal, string> = { persian: tk('شمسی'), gregory: tk('میلادی'), islamic: tk('قمری') };
// shortcut: umalqura (Saudi) can differ 1-2 days from Iran's official Hijri; the user-set offset covers it
const ID: Record<Cal, string> = { persian: 'persian', gregory: 'gregory', islamic: 'islamic-umalqura' };

export const MONTHS: Record<Cal, string[]> = {
  persian: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
  gregory: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
  islamic: ['محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'],
};

// Days are 'YYYY-MM-DD' strings; they are the only date form stored or passed around.
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(ms(iso) + n * 864e5).toISOString().slice(0, 10);
export const today = () => new Date().toLocaleDateString('sv'); // 'sv' prints local YYYY-MM-DD
export const wd = (iso: string) => new Date(ms(iso)).getUTCDay(); // JS weekday, 0 = Sunday
/**
 * Persian digits for a number. Explicitly mapped instead of `toLocaleString('fa')`, because the Android WebView can ship an
 * ICU build without Persian digits and then renders "۴" as "4" — which is exactly what happened on the emulator.
 */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const EN_WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FA_WD = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
/** Single-letter weekday header, by JS weekday (0 = Sunday). */
export const wdInitial = (d: number) => (lang() === 'fa' ? FA_WD : EN_WD)[d];
// Persian month and weekday names stay hand tables: an Android WebView with a cut-down ICU would fall back to English
// names, the same failure that made digits come out latin. English comes from Intl.
const FA_WEEK = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = JS weekday
const SUNDAY = '2024-01-07';
/** Long weekday name by JS weekday (0 = Sunday). */
export const wdName = (d: number) => (lang() === 'fa' ? FA_WEEK[d] : label(addDays(SUNDAY, d), 'gregory', 0, { weekday: 'long' }));
/** Persian digits in fa, latin in en. Kept under the old name: ~30 files call it. */
export const fa = (n: number) => num(n);

const fmt = Object.fromEntries(
  CALS.map((c) => [c, new Intl.DateTimeFormat(`en-u-ca-${ID[c]}-nu-latn`, { timeZone: 'UTC' })]),
) as Record<Cal, Intl.DateTimeFormat>;

const shift = (iso: string, cal: Cal, off: number) => (cal === 'islamic' ? addDays(iso, off) : iso);

export function parts(iso: string, cal: Cal, off = 0) {
  const p: Record<string, string> = {};
  for (const x of fmt[cal].formatToParts(ms(shift(iso, cal, off)))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day };
}

export const label = (iso: string, cal: Cal, off: number, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(`${lang()}-u-ca-${ID[cal]}`, { ...o, timeZone: 'UTC' }).format(ms(shift(iso, cal, off)));

// First day of a month in each calendar, used only to walk a full year and read the English month names out of Intl.
const MONTH_SEED: Record<Cal, string> = { persian: '2020-03-21', gregory: '2020-01-01', islamic: '2020-08-20' };
const enMonths: Partial<Record<Cal, string[]>> = {};
function monthNames(cal: Cal) {
  const cached = enMonths[cal];
  if (cached) return cached;
  const names: string[] = [];
  for (let d = MONTH_SEED[cal], n = 0; n < 12; d = addDays(d, 1)) {
    const m = parts(d, cal).m;
    if (!names[m]) {
      names[m] = label(d, cal, 0, { month: 'long' });
      n++;
    }
  }
  return (enMonths[cal] = names);
}

/** Month name for a 1-based month index in `cal`. */
export const monthName = (cal: Cal, m: number) => (lang() === 'fa' ? MONTHS[cal][m - 1] : monthNames(cal)[m]);

/** "۱۰ جمادی‌الاول ۱۴۴۸": day, month name and plain year (the locale's own year text adds an era suffix like "ه‍.ق."). */
export const fullDate = (iso: string, cal: Cal, off = 0) =>
  `${label(iso, cal, off, { day: 'numeric', month: 'long' })} ${fa(parts(iso, cal, off).y)}`;

/** Every day of the month (in `cal`) that contains `iso`. */
export function month(iso: string, cal: Cal, off = 0) {
  const first = addDays(iso, -(parts(iso, cal, off).d - 1));
  const m = parts(first, cal, off).m;
  const days = [first];
  for (let d = addDays(first, 1); parts(d, cal, off).m === m; d = addDays(d, 1)) days.push(d);
  return days;
}

export const taskOn = (t: { mask: number; start: string; end?: string; active?: boolean; on?: string }, iso: string) =>
  t.active !== false && (t.on ? iso === t.on : ((t.mask >> wd(iso)) & 1) === 1 && t.start <= iso && (!t.end || iso <= t.end));

// shortcut: a birthday on day 30 (Esfand / Hijri) is skipped in years whose month has 29 days
export const bdayOn = (b: { cal: Cal; month: number; day: number }, iso: string, off = 0) => {
  const p = parts(iso, b.cal, off);
  return p.m === b.month && p.d === b.day;
};

/** The month's days padded with the neighbouring months' days so every row has 7 cells; `weekStart` is a JS weekday. */
export function gridCells(days: string[], weekStart: number) {
  const lead = (wd(days[0]) - weekStart + 7) % 7;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  return [
    ...Array.from({ length: lead }, (_, i) => addDays(days[0], i - lead)),
    ...days,
    ...Array.from({ length: trail }, (_, i) => addDays(days[days.length - 1], i + 1)),
  ];
}
