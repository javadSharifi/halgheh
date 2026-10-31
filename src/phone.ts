import { toLatinDigits } from './format';

/**
 * Phone numbers are stored as the user typed them minus spaces and dashes, but compared and dialled in one form:
 * Latin digits, `+98`/`0098`/`98` folded to a leading `0`, and separators removed. Section 6 of TASKS.md asks for
 * exactly this so Iranian numbers written four ways still match one another.
 */
export function normPhone(raw: string) {
  let s = toLatinDigits(raw).replace(/[\s\-().]/g, '');
  if (s.startsWith('+98')) s = `0${s.slice(3)}`;
  else if (s.startsWith('0098')) s = `0${s.slice(4)}`;
  else if (s.startsWith('98') && s.length === 12) s = `0${s.slice(2)}`; // 98912… without the plus
  return s;
}

const PHONE_OK = /^\+?\d{5,15}$/;

/** True when `raw` is a plausible phone number after normalization. Empty is not valid here: callers filter empties first. */
export const phoneValid = (raw: string) => PHONE_OK.test(normPhone(raw));

/** Splits a pasted list ("0912…، ۰۲۱…" or one per line) into cleaned, de-duplicated numbers. */
export function splitPhones(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n،;؛]+/)) {
    const p = normPhone(part);
    if (!p || out.includes(p)) continue;
    out.push(p);
  }
  return out;
}

/** Everything a person form can be asked to prove is not blank, without trimming what the user typed. */
export const personNameValid = (s: string) => s.replace(/\s+/g, ' ').trim().length > 0;
