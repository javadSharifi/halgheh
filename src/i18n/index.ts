import { getSettings, useSettings, type Lang } from '../settings';
import { en } from './en';

export type { Lang };
export const LANGS: [Lang, string][] = [['fa', 'فارسی'], ['en', 'English']];

/** Languages written right to left. A new RTL language is one item here, nothing else. */
const RTL: Lang[] = ['fa'];

export const lang = (): Lang => getSettings().lang;
/** The BCP-47 tag for Intl and localeCompare: adding a language needs no other change. */
export const locale = (l: Lang = lang()) => l;
export const dir = (l: Lang = lang()) => (RTL.includes(l) ? 'rtl' : 'ltr');
export const useLang = (): Lang => useSettings().lang;

const DICT: Record<Lang, Record<string, string> | null> = { fa: null, en };

const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/**
 * Digits of a number in the current language. Deliberately no Intl grouping: this feeds years, ages, day numbers
 * and amounts that already carry their own separator, and "1,990" as a year is wrong.
 */
export const num = (n: number | string): string =>
  lang() === 'fa' ? String(n).replace(/\d/g, (d) => DIGITS[+d]) : String(n);

/** Marks a string as a key without rendering it; the tx() at the use site does the translating. */
export const tk = <T extends string>(s: T): T => s;

/** 'بستن|فعل' is the en.ts key; fa and the fallback show only 'بستن'. */
const stripCtx = (s: string) => {
  const i = s.indexOf('|');
  return i < 0 ? s : s.slice(0, i);
};

const fill = (s: string, vars?: Record<string, string | number>) => {
  if (!vars) return s;
  let out = s;
  for (const k in vars) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
};

/**
 * Translates one string. The Persian text is the key: `fa` returns it untouched, `en` looks it up in `en.ts` and
 * falls back to the Persian original. `{name}` placeholders are filled from `vars`.
 */
export function tx(s: string, vars?: Record<string, string | number>): string {
  const l = lang();
  const dict = DICT[l];
  const hit = dict?.[s];
  // a missing line would otherwise show up only as untranslated Persian; warn while developing
  if (import.meta.env.DEV && dict && hit === undefined && /[\u0600-\u06FF]/.test(s)) console.warn('[i18n] missing:', s);
  return fill(hit ?? stripCtx(s), vars);
}

/**
 * Counts. en.ts holds both forms separated by ' | ': "{n} item | {n} items". Persian has one form.
 * `{n}` is filled automatically. Usage: tn('{n} مورد', count)
 */
export function tn(s: string, n: number, vars?: Record<string, string | number>): string {
  const l = lang();
  let line = DICT[l]?.[s] ?? stripCtx(s);
  if (l !== 'fa' && line.includes(' | ')) {
    const forms = line.split(' | ');
    line = new Intl.PluralRules(locale(l)).select(n) === 'one' ? forms[0] : forms[forms.length - 1];
  }
  return fill(line, { n: num(n), ...vars });
}

/** <html lang dir> follows the setting; the app remounts on a change so no render reads a stale language. */
export function applyLang(l: Lang) {
  document.documentElement.lang = l;
  document.documentElement.dir = dir(l);
}
