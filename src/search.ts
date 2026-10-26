import type { Birthday, Task } from './db';
import type { Note } from './notes';
import { nextOccurrence, toLatinDigits } from './format';

const ZWNJ_OR_MARK = /[‌‍ً-ٰٟـ]/; // half-space, joiners, vowel marks, tatweel

/**
 * Lowercased text with Arabic letter variants unified, digits made Latin and half-spaces/vowel marks dropped,
 * plus `map[i]` = index in the original string of normalized char i (so a match can be highlighted in the original).
 */
export function normalize(s: string) {
  let n = '';
  const map: number[] = [];
  [...s].forEach((ch, i) => {
    if (ZWNJ_OR_MARK.test(ch)) return;
    const c = toLatinDigits(ch).replace('ي', 'ی').replace('ك', 'ک').replace('ۀ', 'ه').replace('ة', 'ه').replace(/[أإآ]/, 'ا').toLowerCase();
    for (const x of c) {
      n += x;
      map.push(i);
    }
  });
  return { n, map };
}

/** Where `q` occurs in `text`, as [start, end) in the original text, or null. */
export function findMatch(text: string, q: string): [number, number] | null {
  const query = normalize(q).n.trim();
  if (!query) return null;
  const { n, map } = normalize(text);
  const at = n.indexOf(query);
  return at < 0 ? null : [map[at], map[at + query.length - 1] + 1];
}

/** A short piece of `text` around the first match (or its start), with "…" where it was cut. */
export function snippet(text: string, q: string, width = 70) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const m = findMatch(flat, q);
  const from = m ? Math.max(0, m[0] - 20) : 0;
  const part = flat.slice(from, from + width);
  return `${from > 0 ? '…' : ''}${part}${from + width < flat.length ? '…' : ''}`;
}

export type Results = { notes: Note[]; tasks: Task[]; birthdays: { b: Birthday; inDays: number | null }[] };

export function searchAll(q: string, data: { notes: Note[]; tasks: Task[]; birthdays: Birthday[] }, today: string, off: number): Results {
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f && findMatch(f, q));
  return {
    notes: data.notes.filter((n) => has(n.title, n.text, ...n.tags)).sort((a, b) => b.updatedAt - a.updatedAt),
    tasks: data.tasks.filter((t) => has(t.title, t.description)).sort((a, b) => a.title.localeCompare(b.title, 'fa')),
    birthdays: data.birthdays
      .filter((b) => has(b.name))
      .map((b) => ({ b, inDays: nextOccurrence(b, today, off)?.inDays ?? null }))
      .sort((x, y) => (x.inDays ?? 1e6) - (y.inDays ?? 1e6)),
  };
}

// ---- recent searches (device-local, a handful) ----
const RECENT = 'recent-searches';
const MAX_RECENT = 6;

export const loadRecents = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

export function saveRecent(q: string) {
  const t = q.trim();
  if (!t) return;
  try {
    localStorage.setItem(RECENT, JSON.stringify([t, ...loadRecents().filter((x) => normalize(x).n !== normalize(t).n)].slice(0, MAX_RECENT)));
  } catch {
    /* private mode: recents just won't persist */
  }
}

export const clearRecents = () => {
  try {
    localStorage.removeItem(RECENT);
  } catch {
    /* ignore */
  }
};

/** The search screen remembers its query while you open a result and come back; cleared on cancel. */
export const lastSearch = { q: '', filter: 'all' as 'all' | 'notes' | 'tasks' | 'birthdays' };

